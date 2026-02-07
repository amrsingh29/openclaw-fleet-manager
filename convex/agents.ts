import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("agents").collect();
    },
});

// Used by the Universal Runner to auto-register (Legacy)
export const register = mutation({
    args: { name: v.string(), role: v.string(), sessionKey: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("agents")
            .filter(q => q.eq(q.field("name"), args.name))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                sessionKey: args.sessionKey,
                lastHeartbeat: Date.now(),
                status: 'idle'
            });
            return existing._id;
        }

        return await ctx.db.insert("agents", {
            name: args.name,
            role: args.role,
            sessionKey: args.sessionKey,
            status: "idle",
            lastHeartbeat: Date.now()
        });
    }
});

// Used by the Admin UI to create a new agent
export const hire = mutation({
    args: {
        name: v.string(),
        role: v.string(),
        teamId: v.id("teams"),
        soul: v.string()
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("agents")
            .filter(q => q.eq(q.field("name"), args.name))
            .first();

        if (existing) throw new Error("Agent with this name already exists!");

        const agentId = await ctx.db.insert("agents", {
            name: args.name,
            role: args.role,
            teamId: args.teamId,
            soul: args.soul,
            sessionKey: `pending-${Date.now()}`,
            status: "offline", // Offline until the runner connects
            lastHeartbeat: Date.now()
        });
        return agentId;
    }
});

export const updateStatus = mutation({
    args: { id: v.id("agents"), status: v.string() },
    handler: async (ctx, args) => {
        // @ts-ignore
        await ctx.db.patch(args.id, { status: args.status, lastHeartbeat: Date.now() });
    }
});

export const heartbeat = mutation({
    args: { id: v.id("agents") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { lastHeartbeat: Date.now() });
    }
});

export const clearAll = mutation({
    args: {},
    handler: async (ctx) => {
        const agents = await ctx.db.query("agents").collect();
        for (const agent of agents) {
            await ctx.db.delete(agent._id);
        }
        return agents.length;
    }
});

export const getIdentity = mutation({
    args: { name: v.string(), sessionKey: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("agents")
            .filter(q => q.eq(q.field("name"), args.name))
            .first();

        if (!existing) {
            throw new Error(`Agent '${args.name}' not found. Please hire them in the Admin UI first.`);
        }

        // Update heartbeat
        await ctx.db.patch(existing._id, {
            sessionKey: args.sessionKey,
            lastHeartbeat: Date.now(),
            status: 'idle'
        });

        // Return full identity including SOUL and Team
        return existing;
    }
});
