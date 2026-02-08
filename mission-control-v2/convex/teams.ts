import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all teams
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("teams").collect();
    },
});

// Get a single team by ID
export const get = query({
    args: { id: v.id("teams") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
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
        const existing = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", args.slug)).first();
        if (existing) throw new Error("Team slug already exists");

        return await ctx.db.insert("teams", {
            name: args.name,
            slug: args.slug,
            mission: args.mission,
            allowedTools: [],
            createdTime: Date.now(),
        });
    },
});
