import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";

export const list = query({
    args: { channelId: v.string() },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db
            .query("messages")
            .filter((q) => q.and(
                q.eq(q.field("channelId"), args.channelId),
                q.eq(q.field("orgId"), orgId)
            ))
            .order("desc")
            .take(50);
    },
});

export const listRecent = query({
    args: { channelId: v.string(), after: v.number() },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const messages = await ctx.db
            .query("messages")
            .filter((q) => q.and(
                q.eq(q.field("channelId"), args.channelId),
                orgId ? q.eq(q.field("orgId"), orgId) : true
            ))
            .order("desc")
            .take(20);

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
        const orgId = await maybeGetOrgId(ctx);

        // Validation: If agent is message sender, it must exist
        if (args.agentId) {
            const agent = await ctx.db.get(args.agentId);
            if (!agent || (orgId && agent.orgId !== orgId)) throw new Error("Unauthorized agent");
            // Use agent's orgId if no user orgId
            const finalOrgId = orgId || agent.orgId;

            await ctx.db.insert("messages", {
                channelId: args.channelId,
                content: args.content,
                fromAgentId: args.agentId,
                taskId: args.taskId,
                timestamp: Date.now(),
                orgId: finalOrgId
            });
        } else {
            // Sent by human manager
            const userOrgId = await getOrgId(ctx);
            await ctx.db.insert("messages", {
                channelId: args.channelId,
                content: args.content,
                timestamp: Date.now(),
                orgId: userOrgId
            });
        }
    },
});
