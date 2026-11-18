import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";

/**
 * The live feed in the sidebar. Deliberately small: it is a glance, not a record.
 *
 * Do not build aggregates on this. It is capped, so any total computed from it
 * describes the last `limit` events while the caller will assume it describes
 * the period. Use `range` or `analytics.summary` instead.
 */
export const list = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        // Index the order rather than sorting in memory.
        return await ctx.db
            .query("activities")
            .withIndex("by_org_timestamp", (q) => q.eq("orgId", orgId))
            .order("desc")
            .take(Math.min(args.limit ?? 20, 200));
    },
});

/**
 * A bounded window of the event stream, for anything that needs the whole period
 * rather than the newest handful. This is the read path analytics uses.
 *
 * `take` is a hard ceiling, not a page size: a caller asking for a year of a busy
 * fleet should narrow the window rather than expect an unbounded scan.
 */
export const range = query({
    args: {
        since: v.number(),
        until: v.optional(v.number()),
        take: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const until = args.until ?? Date.now();
        return await ctx.db
            .query("activities")
            .withIndex("by_org_timestamp", (q) =>
                q.eq("orgId", orgId).gte("timestamp", args.since).lte("timestamp", until),
            )
            .take(Math.min(args.take ?? 5000, 20_000));
    },
});

/** Everything that happened on one mission, oldest first, for the task drawer. */
export const forTask = query({
    args: { taskId: v.id("tasks"), take: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const rows = await ctx.db
            .query("activities")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .take(Math.min(args.take ?? 500, 2000));

        // The index gives no org guarantee on its own, so scope explicitly. Rows
        // written before tenant scoping existed have no orgId; include those
        // rather than hiding history.
        return rows
            .filter((r) => !r.orgId || r.orgId === orgId)
            .sort((a, b) => a.timestamp - b.timestamp);
    },
});

export const log = mutation({
    args: {
        agentId: v.optional(v.id("agents")),
        type: v.string(), // "task_assigned", "task_completed", "status_change", "task_created", "message_sent"
        message: v.string(),
        taskId: v.optional(v.id("tasks")),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);

        // If agentId is provided, use its orgId if user orgId is missing
        let finalOrgId = orgId;
        if (!finalOrgId && args.agentId) {
            const agent = await ctx.db.get(args.agentId);
            if (agent) finalOrgId = agent.orgId ?? null;
        }

        if (!finalOrgId) {
            // Fallback to getOrgId if it's a manager action
            finalOrgId = await getOrgId(ctx);
        }

        await ctx.db.insert("activities", {
            type: args.type,
            agentId: args.agentId,
            message: args.message,
            taskId: args.taskId,
            metadata: args.metadata,
            orgId: finalOrgId ?? undefined,
            timestamp: Date.now(),
        });
    },
});
