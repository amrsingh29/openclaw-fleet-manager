import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";
import { internal } from "./_generated/api";

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
        status: v.string(),
        priority: v.optional(v.number()),
        teamId: v.optional(v.id("teams"))
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
        });
        // Log activity
        await ctx.db.insert("activities", {
            type: "task_created",
            message: `Task created: ${args.title}`,
            orgId: orgId,
            timestamp: Date.now(),
            metadata: { taskId }
        });
        return taskId;
    },
});

export const updateStatus = mutation({
    args: {
        id: v.id("tasks"),
        status: v.string()
    },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.id);
        if (!task || (orgId && task.orgId !== orgId)) throw new Error("Unauthorized");

        await ctx.db.patch(args.id, { status: args.status, lastUpdated: Date.now() });

        // Trigger Event Stream
        await ctx.scheduler.runAfter(0, internal.events.processEvent as any, {
            type: "task_status_changed",
            orgId: task.orgId || "org_2saas_dev_mock_id",
            metadata: { taskId: args.id, status: args.status }
        });
    },
});

export const claim = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents") },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.taskId);
        if (!task || (orgId && task.orgId !== orgId)) {
            return false;
        }

        if (task.status !== 'inbox' && task.status !== 'pending') {
            return false;
        }

        const agent = await ctx.db.get(args.agentId);
        if (!agent || agent.orgId !== task.orgId) throw new Error("Unauthorized agent");

        await ctx.db.patch(args.taskId, {
            status: 'in_progress',
            assignedTo: args.agentId,
            lastUpdated: Date.now()
        });

        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            message: `Agent claimed task: ${task.title}`,
            orgId: task.orgId,
            timestamp: Date.now(),
            metadata: { taskId: args.taskId }
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
            assignedTo: args.agentId,
            lastUpdated: Date.now()
        });

        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            message: `Manager assigned task: ${task.title}`,
            orgId: orgId,
            timestamp: Date.now(),
            metadata: { taskId: args.taskId }
        });

        return true;
    }
});

export const complete = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents"), output: v.string() },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const task = await ctx.db.get(args.taskId);
        if (!task || (orgId && task.orgId !== orgId)) throw new Error("Unauthorized");

        await ctx.db.patch(args.taskId, {
            status: 'completed',
            result: args.output,
            lastUpdated: Date.now()
        });

        await ctx.db.insert("activities", {
            type: "task_completed",
            agentId: args.agentId,
            message: `Agent completed task`,
            orgId: task.orgId,
            timestamp: Date.now(),
            metadata: { taskId: args.taskId, output: args.output }
        });
    }
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

export const deleteTask = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

export const patchTask = mutation({
    args: {
        id: v.id("tasks"),
        teamId: v.optional(v.id("teams")),
        status: v.optional(v.string()),
        priority: v.optional(v.number()),
        assignedTo: v.optional(v.id("agents")),
    },
    handler: async (ctx, args) => {
        const { id, ...parts } = args;
        await ctx.db.patch(id, parts);
    }
});
