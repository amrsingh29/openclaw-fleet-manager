import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("activities").order("desc").take(20);
    },
});

export const log = mutation({
    args: {
        agentId: v.optional(v.id("agents")),
        type: v.string(), // "task_assigned", "task_completed", "status_change", "task_created", "message_sent"
        message: v.string(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("activities", {
            type: args.type,
            agentId: args.agentId,
            message: args.message,
            metadata: args.metadata,
            timestamp: Date.now(),
        });
    },
});
