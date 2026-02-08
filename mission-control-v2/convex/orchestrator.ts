import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { spawnAgentMachine, stopAgentMachine } from "./fly_client";

/**
 * Orchestrates the "Hire" process: inserts to DB then boots the cloud container.
 */
export const hireAgent = action({
    args: {
        name: v.string(),
        role: v.string(),
        teamId: v.id("teams"),
        soul: v.string()
    },
    handler: async (ctx, args) => {
        // 1. Call Mutation to insert record
        const agentId = await ctx.runMutation(api.agents.hire, args);

        try {
            // 2. Spawn Cloud Machine
            const machineId = await spawnAgentMachine(ctx, {
                agentId: agentId as string,
                agentName: args.name
            });

            // 3. Update agent with machine ID
            await ctx.runMutation(api.agents.updateCloudState, {
                id: agentId,
                containerId: machineId
            });

            return { agentId, machineId };
        } catch (err) {
            console.error("Cloud spawn failed, but agent created in DB:", err);
            return { agentId, error: "Cloud spawn failed" };
        }
    }
});

/**
 * Orchestrates "Firing" or "Stopping" an agent.
 */
export const fireAgent = action({
    args: { agentId: v.id("agents") },
    handler: async (ctx, args) => {
        // 1. Get containerId
        const agent = await ctx.runQuery(api.agents.getAgent, { id: args.agentId });
        if (!agent) return;

        if (agent.containerId) {
            // 2. Stop Cloud Machine
            await stopAgentMachine(ctx, { machineId: agent.containerId });
        }

        // 3. Remove/Archive agent in DB
        await ctx.runMutation(api.agents.remove, { id: args.agentId });
    }
});

/**
 * Periodically called via Cron to stop containers of inactive agents.
 */
export const reapInactiveAgents = action({
    args: {},
    handler: async (ctx) => {
        // 1. Find agents offline for > 15 mins (using internal mutation)
        const deadAgents = await ctx.runMutation(api.agents.findInactiveWithContainers, {
            timeoutSeconds: 15 * 60
        });

        for (const agent of deadAgents) {
            if (agent.containerId) {
                console.log(`🧹 Reaping inactive agent: ${agent.name} (${agent.containerId})`);
                await stopAgentMachine(ctx, { machineId: agent.containerId });

                // Clear container ID in DB
                await ctx.runMutation(api.agents.updateCloudState, {
                    id: agent._id,
                    containerId: ""
                });
            }
        }
    }
});
