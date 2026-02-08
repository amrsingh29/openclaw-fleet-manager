import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";

export const list = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db.query("activities")
            .filter(q => q.eq(q.field("orgId"), orgId))
            .order("desc")
            .take(20);
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
            metadata: args.metadata,
            orgId: finalOrgId ?? undefined,
            timestamp: Date.now(),
        });
    },
});
