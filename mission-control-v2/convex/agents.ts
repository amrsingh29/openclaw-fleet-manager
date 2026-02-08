import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";

export const list = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db.query("agents")
            .filter(q => q.eq(q.field("orgId"), orgId))
            .collect();
    },
});

// Used by the Universal Runner to auto-register
export const register = mutation({
    args: { name: v.string(), role: v.string(), sessionKey: v.string() },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const existing = await ctx.db.query("agents")
            .filter(q => q.and(
                q.eq(q.field("name"), args.name),
                q.eq(q.field("orgId"), orgId)
            ))
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
            orgId: orgId ?? undefined,
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
        const orgId = await getOrgId(ctx);
        const existing = await ctx.db.query("agents")
            .filter(q => q.and(
                q.eq(q.field("name"), args.name),
                q.eq(q.field("orgId"), orgId)
            ))
            .first();

        if (existing) throw new Error("Agent with this name already exists in your organization!");

        const agentId = await ctx.db.insert("agents", {
            name: args.name,
            role: args.role,
            teamId: args.teamId,
            soul: args.soul,
            orgId: orgId,
            sessionKey: `pending-${Date.now()}`,
            status: "offline", // Offline until the runner connects
            lastHeartbeat: Date.now()
        });
        return agentId;
    }
});

/**
 * Gets a single agent by ID (filtered by Org)
 */
export const getAgent = query({
    args: { id: v.id("agents") },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const agent = await ctx.db.get(args.id);
        if (!agent || (orgId && agent.orgId !== orgId)) return null;
        return agent;
    }
});

/**
 * Internal: Updates the container ID after cloud spawn.
 */
export const updateCloudState = mutation({
    args: { id: v.id("agents"), containerId: v.string() },
    handler: async (ctx, args) => {
        // Usually called via Action (orchestrator:hireAgent)
        await ctx.db.patch(args.id, {
            // @ts-ignore (Will add containerId to schema next)
            containerId: args.containerId
        });
    }
});

/**
 * Deletes an agent.
 */
export const remove = mutation({
    args: { id: v.id("agents") },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const agent = await ctx.db.get(args.id);
        if (!agent || agent.orgId !== orgId) throw new Error("Unauthorized");

        await ctx.db.delete(args.id);
    }
});

export const update = mutation({
    args: {
        id: v.id("agents"),
        name: v.optional(v.string()),
        role: v.optional(v.string()),
        teamId: v.optional(v.id("teams")),
        soul: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const agent = await ctx.db.get(args.id);
        if (!agent || agent.orgId !== orgId) throw new Error("Unauthorized");

        const { id, ...updates } = args;
        await ctx.db.patch(id, updates);
    }
});

export const updateStatus = mutation({
    args: {
        id: v.id("agents"),
        status: v.union(v.literal("idle"), v.literal("active"), v.literal("working"), v.literal("blocked"), v.literal("offline"))
    },
    handler: async (ctx, args) => {
        // Status updates can be from runner, maybeGetOrgId
        const orgId = await maybeGetOrgId(ctx);
        const agent = await ctx.db.get(args.id);
        if (!agent || (orgId && agent.orgId !== orgId)) throw new Error("Unauthorized");

        await ctx.db.patch(args.id, { status: args.status, lastHeartbeat: Date.now() });
    }
});

export const heartbeat = mutation({
    args: { id: v.id("agents") },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.id);
        if (!agent) throw new Error("Agent not found");
        // Heartbeat is often automated, check orgId if identity is present
        const orgId = await maybeGetOrgId(ctx);
        if (orgId && agent.orgId !== orgId) throw new Error("Unauthorized");

        await ctx.db.patch(args.id, { lastHeartbeat: Date.now() });
    }
});

export const clearAll = mutation({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const agents = await ctx.db.query("agents")
            .filter(q => q.eq(q.field("orgId"), orgId))
            .collect();
        for (const agent of agents) {
            await ctx.db.delete(agent._id);
        }
        return agents.length;
    }
});

/**
 * Internal: Finds agents with containers that have been idle too long.
 */
export const findInactiveWithContainers = mutation({
    args: { timeoutSeconds: v.number() },
    handler: async (ctx, args) => {
        const cutoff = Date.now() - (args.timeoutSeconds * 1000);
        const agents = await ctx.db.query("agents")
            .filter(q => q.and(
                q.neq(q.field("containerId"), undefined),
                q.neq(q.field("containerId"), ""),
                q.lt(q.field("lastHeartbeat"), cutoff)
            ))
            .collect();
        return agents;
    }
});

export const getIdentity = mutation({
    args: { name: v.string(), sessionKey: v.string() },
    handler: async (ctx, args) => {
        // Runner uses this, might not have orgId yet depending on how it's launched
        // For SaaS, the runner MUST be launched with an identity or token
        const orgId = await maybeGetOrgId(ctx);

        const existing = await ctx.db.query("agents")
            .filter(q => q.and(
                q.eq(q.field("name"), args.name),
                orgId ? q.eq(q.field("orgId"), orgId) : true
            ))
            .first();

        if (!existing) {
            throw new Error(`Agent '${args.name}' not found.`);
        }

        // Update heartbeat
        await ctx.db.patch(existing._id, {
            sessionKey: args.sessionKey,
            lastHeartbeat: Date.now(),
            status: 'idle'
        });

        return existing;
    }
});
