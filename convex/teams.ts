import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId } from "./utils";

// List all teams
export const list = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db.query("teams")
            .filter(q => q.eq(q.field("orgId"), orgId))
            .collect();
    },
});

// Get a single team by ID
export const get = query({
    args: { id: v.id("teams") },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const team = await ctx.db.get(args.id);
        if (!team || team.orgId !== orgId) throw new Error("Unauthorized");
        return team;
    },
});

// Create a new team (Admin only - for future UI)
export const create = mutation({
    args: {
        name: v.string(),
        slug: v.string(),
        mission: v.string(),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const existing = await ctx.db.query("teams")
            .filter(q => q.and(
                q.eq(q.field("slug"), args.slug),
                q.eq(q.field("orgId"), orgId)
            ))
            .first();

        if (existing) throw new Error("Team slug already exists in your organization");

        return await ctx.db.insert("teams", {
            name: args.name,
            slug: args.slug,
            mission: args.mission,
            orgId: orgId,
            allowedTools: [],
            createdTime: Date.now(),
        });
    },
});
