import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("agents").collect();
    },
});

export const register = mutation({
    args: { name: v.string(), role: v.string(), sessionKey: v.string() },
    handler: async (ctx, args) => {
        // Upsert by NAME. The name (e.g. "Jarvis") should be the unique identifier for the fleet.
        const existing = await ctx.db.query("agents")
            .filter(q => q.eq(q.field("name"), args.name))
            .first();

        if (existing) {
            // Update the session key to the new one so we can recognize it later if needed
            // But primarily we just return the ID
            await ctx.db.patch(existing._id, {
                sessionKey: args.sessionKey,
                lastHeartbeat: Date.now(),
                status: 'idle' // Reset status on reconnect
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
