import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";

export const list = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db.query("tasks")
            .filter(q => q.eq(q.field("orgId"), orgId))
            .order("desc")
            .collect();
    },
});

export const create = mutation({
    args: {
        title: v.string(),
        description: v.string(),
        status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done"), v.literal("blocked")),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        teamId: v.optional(v.id("teams")),
        parentTaskId: v.optional(v.id("tasks")),
        depth: v.optional(v.number()),
        createdByAgentId: v.optional(v.id("agents")),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const taskId = await ctx.db.insert("tasks", {
            title: args.title,
            description: args.description,
            status: args.status,
            priority: args.priority,
            teamId: args.teamId,
            orgId: orgId,
            createdTime: Date.now(),
            lastUpdated: Date.now(),
            parentTaskId: args.parentTaskId,
            depth: args.depth ?? 0,
            createdByAgentId: args.createdByAgentId,
        });
        // Log activity
        await ctx.db.insert("activities", {
            type: "task_created",
            message: `Task created: ${args.title}`,
            orgId: orgId,
            taskId,
            timestamp: Date.now(),
            metadata: {
                depth: args.depth ?? 0,
                ...(args.parentTaskId ? { parentTaskId: args.parentTaskId } : {}),
                ...(args.createdByAgentId ? { createdByAgentId: args.createdByAgentId } : {}),
            },
        });
        return taskId;
    },
});

export const updateStatus = mutation({
    args: {
        id: v.id("tasks"),
        status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done"), v.literal("blocked"))
    },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.id);
        if (!task) {
            console.warn(`updateStatus: task ${args.id} no longer exists; ignoring`);
            return { ok: false, reason: "task_missing" as const };
        }
        if (orgId && task.orgId !== orgId) throw new Error("Unauthorized: task belongs to another org");

        // A card dragged to Done by a human never passes through `complete`, so
        // stamp the finish time here too. Only the first transition counts;
        // reopening and re-closing a card must not move it.
        const finishing = args.status === "done" && !task.completedAt;

        await ctx.db.patch(args.id, {
            status: args.status,
            lastUpdated: Date.now(),
            ...(finishing ? { completedAt: Date.now() } : {}),
        });
        return { ok: true as const };
    },
});

export const claim = mutation({
    args: {
        taskId: v.id("tasks"),
        agentId: v.id("agents"),
        leaseSeconds: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Claiming might be by agent (maybeGetOrgId)
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.taskId);
        if (!task || (orgId && task.orgId !== orgId)) {
            return false;
        }

        // Atomic check: Is it still in inbox?
        if (task.status !== 'inbox') {
            return false; // Already taken
        }

        const agent = await ctx.db.get(args.agentId);
        if (!agent || agent.orgId !== task.orgId) throw new Error("Unauthorized agent");

        // Claim it, with a lease so a dead runner can be detected.
        const now = Date.now();
        const leaseMs = (args.leaseSeconds ?? 600) * 1000;
        await ctx.db.patch(args.taskId, {
            status: 'in_progress',
            assigneeIds: [args.agentId],
            lastUpdated: now,
            claimedAt: now,
            leaseExpiresAt: now + leaseMs,
            attempts: (task.attempts ?? 0) + 1,
        });

        // Log assignment
        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            message: `Agent claimed task: ${task.title}`,
            orgId: task.orgId,
            taskId: args.taskId,
            timestamp: Date.now(),
            metadata: { attempt: (task.attempts ?? 0) + 1 }
        });

        return true;
    }
});

export const assign = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents") },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const task = await ctx.db.get(args.taskId);
        if (!task || task.orgId !== orgId) throw new Error("Task not found");

        const agent = await ctx.db.get(args.agentId);
        if (!agent || agent.orgId !== orgId) throw new Error("Agent not found");

        await ctx.db.patch(args.taskId, {
            status: 'assigned',
            assigneeIds: [args.agentId],
            lastUpdated: Date.now()
        });

        // Log assignment
        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            message: `Manager assigned task: ${task.title}`,
            orgId: orgId,
            taskId: args.taskId,
            timestamp: Date.now(),
            metadata: { agentId: args.agentId }
        });

        return true;
    }
});

/**
 * Ends a mission and records what it cost.
 *
 * `usage` is optional so an older runner that has not been updated still works.
 * When it is missing, the task and its completion event simply carry no token
 * figures, and cost analytics treats the mission as unmeasured rather than free.
 */
export const complete = mutation({
    args: {
        taskId: v.id("tasks"),
        agentId: v.id("agents"),
        output: v.string(),
        /** Set when the turn loop reported what the model actually charged. */
        usage: v.optional(
            v.object({
                inputTokens: v.optional(v.number()),
                outputTokens: v.optional(v.number()),
                rounds: v.optional(v.number()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.taskId);

        // A task can disappear between claim and complete (wiped board, deleted by
        // a human). Throwing here killed the runner loop with a misleading
        // "Unauthorized"; return quietly instead, since the work is moot.
        if (!task) {
            console.warn(`complete: task ${args.taskId} no longer exists; ignoring`);
            return { ok: false, reason: "task_missing" as const };
        }
        if (orgId && task.orgId !== orgId) throw new Error("Unauthorized: task belongs to another org");

        const now = Date.now();

        await ctx.db.patch(args.taskId, {
            status: 'done',
            output: args.output,
            lastUpdated: now,
            // Preserve the first finish time: a task completed by a runner and
            // then patched again by updateStatus must not lose its cycle time.
            ...(task.completedAt ? {} : { completedAt: now }),
            completedByAgentId: args.agentId,
            ...(args.usage ? { usage: args.usage } : {}),
        });

        // Log completion. The output goes in the task, not in the event: a full
        // report per event is what makes an activity scan expensive later.
        await ctx.db.insert("activities", {
            type: "task_completed",
            agentId: args.agentId,
            message: `Agent completed task`,
            orgId: task.orgId,
            taskId: args.taskId,
            timestamp: now,
            metadata: {
                title: task.title,
                depth: task.depth ?? 0,
                attempts: task.attempts ?? 0,
                cycleMs: task.claimedAt ? now - task.claimedAt : undefined,
                ...(args.usage ? { usage: args.usage } : {}),
            },
        });

        return { ok: true as const, completedAt: task.completedAt ?? now };
    }
});

/**
 * The numbers a delegating agent needs before it is allowed to create a task:
 * how deep it already is, how many children the mission has, and how many tasks
 * this agent has made in the last hour. Computed server-side so a model cannot
 * talk its way past the limit.
 */
export const delegationContext = query({
    args: { taskId: v.optional(v.id("tasks")), agentId: v.optional(v.id("agents")) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const tasks = (await ctx.db.query("tasks").collect()).filter(
            (t) => !orgId || t.orgId === orgId,
        );

        const current = args.taskId ? tasks.find((t) => t._id === args.taskId) : undefined;
        const childCount = args.taskId ? tasks.filter((t) => t.parentTaskId === args.taskId).length : 0;

        const hourAgo = Date.now() - 3600_000;
        const agentCreatesLastHour = args.agentId
            ? tasks.filter((t) => t.createdByAgentId === args.agentId && t.createdTime > hourAgo).length
            : 0;

        return {
            currentDepth: current?.depth ?? 0,
            childCount,
            agentCreatesLastHour,
        };
    },
});

/**
 * Extends the lease on a task an agent is actively working, so a long mission is
 * not reclaimed out from under the runner doing it.
 */
export const renewLease = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents"), leaseSeconds: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.taskId);
        if (!task || (orgId && task.orgId !== orgId)) return false;
        // Only the agent holding it may renew it.
        if (!task.assigneeIds?.includes(args.agentId)) return false;

        const now = Date.now();
        await ctx.db.patch(args.taskId, {
            leaseExpiresAt: now + (args.leaseSeconds ?? 600) * 1000,
        });
        return true;
    },
});

/**
 * Finds tasks whose lease has expired, i.e. whose runner died or hung mid-mission.
 *
 * This is what makes an abandoned claim recoverable instead of permanent. The
 * task goes back to 'inbox' with its assignees cleared, so any idle agent can
 * pick it up, and attempts is incremented so a task that keeps killing runners
 * eventually stops being handed out.
 */
export const reclaimExpired = mutation({
    args: { now: v.optional(v.number()), maxAttempts: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const now = args.now ?? Date.now();
        const maxAttempts = args.maxAttempts ?? 3;

        const tasks = await ctx.db.query("tasks").collect();
        const reclaimed: string[] = [];
        const givenUp: string[] = [];
        // Titles are for the message; ids are what analytics can join on.
        const reclaimedIds: string[] = [];
        const givenUpIds: string[] = [];

        for (const task of tasks) {
            if (orgId && task.orgId !== orgId) continue;
            if (task.status !== "in_progress" && task.status !== "assigned") continue;
            if (!task.leaseExpiresAt || task.leaseExpiresAt > now) continue;

            const attempts = task.attempts ?? 0;

            if (attempts >= maxAttempts) {
                // Repeatedly abandoned: park it for a human rather than burning
                // another agent on it.
                await ctx.db.patch(task._id, {
                    status: "blocked",
                    leaseExpiresAt: undefined,
                    lastUpdated: now,
                    output:
                        (task.output ? task.output + "\n\n" : "") +
                        `[reclaimed] Abandoned ${attempts} time(s); needs a human.`,
                });
                givenUp.push(task.title);
                givenUpIds.push(task._id);
            } else {
                await ctx.db.patch(task._id, {
                    status: "inbox",
                    assigneeIds: undefined,
                    leaseExpiresAt: undefined,
                    claimedAt: undefined,
                    lastUpdated: now,
                });
                reclaimed.push(task.title);
                reclaimedIds.push(task._id);
            }
        }

        if (reclaimed.length || givenUp.length) {
            await ctx.db.insert("activities", {
                type: "tasks_reclaimed",
                message:
                    `${reclaimed.length} abandoned task(s) returned to the inbox` +
                    (givenUp.length ? `, ${givenUp.length} parked as blocked` : ""),
                orgId,
                timestamp: now,
                metadata: {
                    reclaimed,
                    givenUp,
                    reclaimedIds,
                    givenUpIds,
                    reason: "lease_expired",
                },
            });
        }

        return { reclaimed, givenUp };
    },
});

/** Deletes one task. Useful for clearing synthetic or mistaken rows. */
export const remove = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const task = await ctx.db.get(args.id);
        if (!task || (orgId && task.orgId !== orgId)) throw new Error("Task not found");
        await ctx.db.delete(args.id);
    },
});

export const clearAll = mutation({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const tasks = await ctx.db.query("tasks")
            .filter(q => q.eq(q.field("orgId"), orgId))
            .collect();
        for (const task of tasks) {
            await ctx.db.delete(task._id);
        }
    }
});
