import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { channelId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("messages")
            .filter((q) => q.eq(q.field("channelId"), args.channelId))
            .order("desc")
            .take(50);
    },
});

export const listRecent = query({
    args: { channelId: v.string(), after: v.number() },
    handler: async (ctx, args) => {
        // Note: Simple filter. Indexing 'timestamp' would be better for perf in prod.
        const messages = await ctx.db
            .query("messages")
            .filter((q) => q.eq(q.field("channelId"), args.channelId))
            .order("desc")
            .take(20); // Take last 20, then filter time in memory to catch edge cases or use q.gt if index existed

        return messages.filter(m => m.timestamp > args.after).reverse();
    },
});

export const send = mutation({
    args: {
        channelId: v.string(),
        content: v.string(),
        agentId: v.optional(v.id("agents")),
        taskId: v.optional(v.id("tasks")),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("messages", {
            channelId: args.channelId,
            content: args.content,
            fromAgentId: args.agentId,
            taskId: args.taskId,
            timestamp: Date.now(),
        });

        // Log to activity feed if it's a significant message?
        // Maybe not every chat message, that would spam the feed.
    },
});
