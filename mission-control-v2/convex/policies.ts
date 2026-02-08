import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId } from "./utils";
import { Id } from "./_generated/dataModel";

/**
 * Sets or updates a policy for a specific action type for a team (or global).
 */
export const setPolicy = mutation({
    args: {
        teamId: v.optional(v.id("teams")),
        actionType: v.string(),
        policy: v.union(v.literal("auto"), v.literal("manual"), v.literal("propose_only")),
        maxCost: v.optional(v.number()),
        minConfidence: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);

        // Check for existing policy
        const existing = await ctx.db
            .query("policies")
            .withIndex("by_org_team_action", (q) =>
                q.eq("orgId", orgId).eq("teamId", args.teamId).eq("actionType", args.actionType)
            )
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                policy: args.policy,
                maxCost: args.maxCost,
                minConfidence: args.minConfidence,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("policies", {
                ...args,
                orgId,
            });
        }
    },
});

/**
 * Evaluates a proposed action against existing policies.
 * Returns the status the proposal should take ('pending' or 'auto_approved').
 */
export const evaluateAction = internalQuery({
    args: {
        orgId: v.string(),
        teamId: v.optional(v.id("teams")),
        actionType: v.string(),
        cost: v.optional(v.number()),
        confidence: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // 1. Find specific team policy for this action
        let policy = await ctx.db
            .query("policies")
            .withIndex("by_org_team_action", (q) =>
                q.eq("orgId", args.orgId).eq("teamId", args.teamId).eq("actionType", args.actionType)
            )
            .unique();

        // 2. Fallback to global team policy (*)
        if (!policy) {
            policy = await ctx.db
                .query("policies")
                .withIndex("by_org_team_action", (q) =>
                    q.eq("orgId", args.orgId).eq("teamId", args.teamId).eq("actionType", "*")
                )
                .unique();
        }

        // 3. Fallback to global org policy (teamId: null)
        if (!policy) {
            policy = await ctx.db
                .query("policies")
                .withIndex("by_org_team_action", (q) =>
                    q.eq("orgId", args.orgId).eq("teamId", undefined).eq("actionType", args.actionType)
                )
                .unique();
        }

        // 4. Ultimate fallback: manual approval (Safety First)
        if (!policy || policy.policy === "manual") {
            return "pending";
        }

        if (policy.policy === "propose_only") {
            return "pending";
        }

        // 5. check cost threshold
        if (policy.maxCost !== undefined && args.cost !== undefined && args.cost > policy.maxCost) {
            return "pending";
        }

        // 6. check confidence threshold
        if (policy.minConfidence !== undefined && args.confidence !== undefined && args.confidence < policy.minConfidence) {
            return "pending";
        }

        return "auto_approved";
    },
});

/**
 * Lists all policies for the organization.
 */
export const list = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db
            .query("policies")
            .filter((q) => q.eq(q.field("orgId"), orgId))
            .collect();
    },
});
