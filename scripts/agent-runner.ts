// One process per agent. Polls Convex for work, runs it through the tool loop,
// writes results back. The loop is deliberately dumb: all the intelligence lives
// in the soul prompt and the tools, so a failure here is easy to read in a log.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { AgentBrain, BrainCallbacks } from "./openclaw_brain.js";
import { ToolEvent } from "./agent-turn.js";
import { defaultRegistry } from "./tools/registry.js";
import { ConvexBackend } from "./tools/convex-backend.js";
import { listServiceNames } from "./fleet-config.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const POLL_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;

// ---- argument parsing -------------------------------------------------------

const configArg = process.argv.find((a) => a.startsWith("--config="))?.split("=")[1];
const channelArg = process.argv.find((a) => a.startsWith("--channel="))?.split("=")[1];

if (!configArg) {
    console.error("Usage: tsx scripts/agent-runner.ts --config=agents/configs/<name>.soul.md [--channel=general]");
    process.exit(1);
}

const soulPath = configArg.replace(/["'""]/g, "");
if (!fs.existsSync(soulPath)) {
    console.error(`Soul file not found: ${soulPath}`);
    process.exit(1);
}

const soulContent = fs.readFileSync(soulPath, "utf-8");
const nameMatch = soulContent.match(/\*\*Name:\*\*\s*(.*)/);
const roleMatch = soulContent.match(/\*\*Role:\*\*\s*(.*)/);
const keyMatch = soulContent.match(/\*\*Session Key:\*\*\s*(.*)/);

const AGENT_NAME = (nameMatch?.[1] ?? "Unknown").trim();
const AGENT_ROLE = (roleMatch?.[1] ?? "Agent").trim();
const SESSION_KEY = (keyMatch?.[1] ?? `agent:${Date.now()}`).trim();
const CHANNEL = (channelArg ?? "general").replace(/["'""]/g, "");

// ---- Convex client ----------------------------------------------------------

const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing CONVEX_URL. Run `npm run setup`, or set it in .env.");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// ---- brain ------------------------------------------------------------------

const toolEvents: ToolEvent[] = [];

const callbacks: BrainCallbacks = {
    onToolEvent: async (e) => {
        toolEvents.push(e);
        console.log(
            `  🛠️  ${e.tool}(${JSON.stringify(e.args)}) -> ${e.result.ok ? "ok" : "FAILED"} in ${e.elapsedMs}ms`,
        );
        if (!e.result.ok) console.log(`      ${e.result.output.split("\n")[0]}`);
    },
    onNeedsApproval: async (info) => {
        console.log(`  ⏸️  Needs approval: ${info.tool} — ${info.reason.split("\n")[0]}`);
    },
};

let brain: AgentBrain | null = null;
let agentIdRef: any = null;

function getBrain(): AgentBrain {
    if (!brain) {
        console.log(`🧠 Initialising brain for ${AGENT_NAME}...`);
        brain = new AgentBrain(AGENT_NAME, soulContent, {
            callbacks,
            // The backend is what lets this agent delegate. Passing the id too so
            // create_task can refuse a mission assigned to itself.
            backend: new ConvexBackend(client),
            agentId: agentIdRef,
        });
        console.log(`   provider=${brain.providerId} model=${brain.model}`);
    }
    return brain;
}

// ---- audit ------------------------------------------------------------------

/** Writes every tool call to the activity feed so the UI shows real work. */
async function logToolEvents(agentId: any, taskId: string | null): Promise<void> {
    for (const e of toolEvents) {
        try {
            await client.mutation(api.activities.log, {
                agentId,
                type: "tool_call",
                message: `${AGENT_NAME} ran ${e.tool}${e.result.ok ? "" : " (failed)"}`,
                metadata: {
                    tool: e.tool,
                    args: e.args,
                    ok: e.result.ok,
                    elapsedMs: e.elapsedMs,
                    taskId,
                    output: e.result.output.slice(0, 500),
                },
            });
        } catch (err: any) {
            // Audit failure must not abort the mission; it is logged locally.
            console.error("Could not log tool event:", err.message);
        }
    }
    toolEvents.length = 0;
}

// ---- task loop --------------------------------------------------------------

async function processTasks(agentId: any): Promise<void> {
    const tasks = await client.query(api.tasks.list);

    // Work already mine, in progress.
    const mine = tasks.find(
        (t: any) =>
            Array.isArray(t.assigneeIds) &&
            t.assigneeIds.includes(agentId) &&
            (t.status === "in_progress" || t.status === "assigned"),
    );

    if (mine) {
        if (mine.status === "assigned") {
            await client.mutation(api.tasks.updateStatus, { id: mine._id, status: "in_progress" });
            return; // next tick picks it up as in_progress
        }

        console.log(`🚀 Mission: ${mine.title}`);
        await client.mutation(api.agents.updateStatus, { id: agentId, status: "working" });

        try {
            const { text, tools } = await getBrain().work(mine.title, mine.description);
            const summary = summariseTools(tools);
            console.log(`✅ Done: ${text.split("\n")[0].slice(0, 120)}`);

            await client.mutation(api.tasks.complete, {
                taskId: mine._id,
                agentId,
                output: summary ? `${text}\n\n---\n**Tools used**\n${summary}` : text,
            });
            await client.mutation(api.tasks.updateStatus, { id: mine._id, status: "done" });
            await logToolEvents(agentId, mine._id);
        } catch (err: any) {
            console.error("❌ Mission failed:", err.message);
            await client.mutation(api.tasks.complete, {
                taskId: mine._id,
                agentId,
                output: `[NEEDS REVIEW]: ${err.message}`,
            });
            await client.mutation(api.tasks.updateStatus, { id: mine._id, status: "review" });
            await logToolEvents(agentId, mine._id);
        } finally {
            await client.mutation(api.agents.updateStatus, { id: agentId, status: "idle" });
        }
        return;
    }

    // Nothing of mine: try to claim unowned work.
    const inboxTask = tasks.find((t: any) => t.status === "inbox" && !t.assigneeIds?.length);
    if (inboxTask) {
        const claimed = await client.mutation(api.tasks.claim, { taskId: inboxTask._id, agentId });
        if (claimed) console.log(`👀 Claimed: ${inboxTask.title}`);
    }
}

function summariseTools(tools: ToolEvent[]): string {
    if (!tools.length) return "";
    return tools
        .map((t) => `- \`${t.tool}\` ${JSON.stringify(t.args)} → ${t.result.ok ? "ok" : "failed"} (${t.elapsedMs}ms)`)
        .join("\n");
}

// ---- chat loop --------------------------------------------------------------

let lastChatTime = Date.now() - 60_000;

async function processChat(agentId: any): Promise<void> {
    const messages = await client.query(api.messages.listRecent, {
        channelId: CHANNEL,
        after: lastChatTime,
    });

    if (!messages.length) return;

    lastChatTime = Math.max(...messages.map((m: any) => m.timestamp));

    for (const msg of messages) {
        const isSelf = msg.fromAgentId === agentId;
        if (isSelf) continue;

        const fromHuman = !msg.fromAgentId;
        const mentioned = String(msg.content).toLowerCase().includes(AGENT_NAME.toLowerCase());

        // Agents answer humans and direct mentions only. This is what keeps
        // three agents from talking to each other forever.
        if (!fromHuman && !mentioned) continue;

        console.log(`💬 ${fromHuman ? "Commander" : "Agent"}: ${String(msg.content).slice(0, 100)}`);

        const reply = await getBrain().ask([], msg.content);
        await logToolEvents(agentId, null);

        if (reply === "NO_REPLY") {
            console.log("   (stayed silent)");
            continue;
        }

        await client.mutation(api.messages.send, {
            channelId: CHANNEL,
            content: reply,
            agentId,
        });
        console.log(`🤖 ${AGENT_NAME}: ${reply.split("\n")[0].slice(0, 120)}`);
    }
}

// ---- main -------------------------------------------------------------------

async function main(): Promise<void> {
    console.log(`🤖 ${AGENT_NAME} (${AGENT_ROLE})`);
    console.log(`   channel #${CHANNEL}, convex ${CONVEX_URL}`);
    console.log(`   services: ${listServiceNames().join(", ") || "(none declared in fleet.yml)"}`);

    const agentId = await client.mutation(api.agents.register, {
        name: AGENT_NAME,
        role: AGENT_ROLE,
        sessionKey: SESSION_KEY,
    });
    agentIdRef = agentId;
    console.log(`✅ Registered as ${agentId}`);

    setInterval(() => {
        client.mutation(api.agents.heartbeat, { id: agentId }).catch((e) => {
            console.error("Heartbeat failed:", e?.message ?? e);
        });
    }, HEARTBEAT_INTERVAL_MS);

    const loop = async () => {
        try {
            await processTasks(agentId);
        } catch (e: any) {
            console.error("Task loop error:", e?.message ?? e);
        }
        try {
            await processChat(agentId);
        } catch (e: any) {
            console.error("Chat loop error:", e?.message ?? e);
        }
        setTimeout(loop, POLL_INTERVAL_MS);
    };

    await loop();
}

main().catch((err) => {
    console.error("Fatal:", err?.message ?? err);
    process.exit(1);
});
