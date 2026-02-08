import { MutationCtx, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_APP_NAME = process.env.FLY_APP_NAME || "openclaw-runners";
const FLY_ORG_NAME = process.env.FLY_ORG_NAME || "personal";

/**
 * Convex Action to spawn a new Fly.io Machine for an agent.
 */
export async function spawnAgentMachine(ctx: ActionCtx, args: { agentId: string, agentName: string }) {
    if (!FLY_API_TOKEN) {
        console.warn("⚠️ FLY_API_TOKEN not set. Running in Mock Mode.");
        return "mock_machine_id_" + Math.random().toString(36).substring(7);
    }

    const response = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${FLY_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: `agent-${args.agentName.toLowerCase()}-${Math.random().toString(36).substring(7)}`,
            config: {
                image: "registry.fly.io/" + FLY_APP_NAME,
                env: {
                    AGENT_NAME: args.agentName,
                    CONVEX_URL: process.env.CONVEX_URL || "",
                },
                guest: {
                    cpu_kind: "shared",
                    cpus: 1,
                    memory_mb: 256,
                },
            },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Fly.io Machine Spawn Failed: ${response.statusText} - ${errorBody}`);
    }

    const machine = await response.json();
    return machine.id as string;
}

/**
 * Convex Action to stop and delete a Fly.io Machine.
 */
export async function stopAgentMachine(ctx: ActionCtx, args: { machineId: string }) {
    if (!FLY_API_TOKEN) return;

    await fetch(`https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines/${args.machineId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${FLY_API_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
}
