import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

dotenv.config();

const CONFIG_PATH = process.argv.find(arg => arg.startsWith("--config="))?.split("=")[1];

if (!CONFIG_PATH) {
    console.error("Usage: tsx scripts/agent-runner.ts --config=<path-to-soul.md>");
    process.exit(1);
}

// 1. Read Configuration
const soulContent = fs.readFileSync(CONFIG_PATH, "utf-8");
const nameMatch = soulContent.match(/\*\*Name:\*\*\s*(.*)/);
const roleMatch = soulContent.match(/\*\*Role:\*\*\s*(.*)/);
const keyMatch = soulContent.match(/\*\*Session Key:\*\*\s*(.*)/);

const AGENT_NAME = nameMatch ? nameMatch[1].trim() : "Unknown";
const AGENT_ROLE = roleMatch ? roleMatch[1].trim() : "Agent";
const SESSION_KEY = keyMatch ? keyMatch[1].trim() : `agent:${Date.now()}`;

console.log(`🤖 Starting Agent: ${AGENT_NAME} (${AGENT_ROLE})`);

// 2. Connect to Convex
const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌ Missing CONVEX_URL env var");
    process.exit(1);
}
const client = new ConvexHttpClient(CONVEX_URL);

// 3. Main Loop
async function main() {
    console.log("🔌 Connecting to Mission Control...");

    // Register/Get ID
    const agentId = await client.mutation(api.agents.register, {
        name: AGENT_NAME,
        role: AGENT_ROLE,
        sessionKey: SESSION_KEY
    });

    console.log(`✅ Registered with ID: ${agentId}`);

    // Heartbeat Loop (every 30s)
    setInterval(async () => {
        try {
            await client.mutation(api.agents.heartbeat, { id: agentId });
        } catch (e) {
            console.error("❌ Heartbeat failed:", e);
        }
    }, 30000);

    // Task & Activity Loop
    const runLoop = async () => {
        try {
            await processTasks(agentId);
        } catch (e) {
            console.error("Error in loop:", e);
        }

        // Poll chat
        await processChat(agentId, AGENT_NAME, CONFIG_PATH || "");

        // Schedule next run only after previous one finishes
        setTimeout(runLoop, 5000);
    };

    // Start the loop
    runLoop();
}

async function processTasks(agentId: any) {
    try {
        // 1. Fetch current view of tasks
        const tasks = await client.query(api.tasks.list);

        // 2. Do I have a task?
        // Look for in_progress OR assigned (legacy fallback)
        const myTask = tasks.find((t: any) => t.assigneeIds?.includes(agentId) && (t.status === 'in_progress' || t.status === 'assigned'));

        if (myTask) {
            // AUTO-RECOVERY: If it's still just 'assigned', mark it in_progress
            if (myTask.status === 'assigned') {
                console.log(`▶️ Auto-Starting mission: ${myTask.title}`);
                await client.mutation(api.tasks.updateStatus, { id: myTask._id, status: 'in_progress' });
                return; // Loop will catch it as in_progress next tick
            }

            console.log(`🚀 Executing mission: ${myTask.title}`);

            // Run OpenClaw Agent
            try {
                const cmd = `openclaw agent --message "${myTask.description}" --session-id "task-${myTask._id}" --local`;
                console.log(`> ${cmd}`);

                const { stdout, stderr } = await execAsync(cmd, {
                    timeout: 60000,
                    env: { ...process.env, CI: 'true' }
                });

                const output = stdout || stderr || "Mission executed successfully.";
                console.log("✅ Execution Result:", output.slice(0, 100) + "...");

                // Atomic Complete
                await client.mutation(api.tasks.complete, {
                    taskId: myTask._id,
                    agentId,
                    output: output
                });

                await client.mutation(api.agents.updateStatus, { id: agentId, status: 'idle' });

            } catch (err: any) {
                console.error("❌ Execution Failed:", err.message);

                // Capturing output on error is critical for debugging "why" it failed
                const failureOutput = err.stdout || err.stderr || err.message;

                // We save the output using 'complete' (to set the field), then flip back to 'review'
                await client.mutation(api.tasks.complete, {
                    taskId: myTask._id,
                    agentId,
                    output: `[NEEDS REVIEW]: ${failureOutput}`
                });

                await client.mutation(api.tasks.updateStatus, { id: myTask._id, status: 'review' });

                await client.mutation(api.activities.log, {
                    agentId,
                    type: "task_completed",
                    message: `${AGENT_NAME} failed mission: "${myTask.title}"`,
                    metadata: { error: err.message }
                });
            }
            return;
        }

        // 3. If idle, look for new work
        const inboxTask = tasks.find((t: any) => t.status === 'inbox');
        if (inboxTask) {
            // Atomic Claim
            const success = await client.mutation(api.tasks.claim, { taskId: inboxTask._id, agentId });

            if (success) {
                console.log(`👀 Successfully claimed mission: ${inboxTask.title}`);
                // Status update to in_progress is now handled in claim mutation
                await client.mutation(api.agents.updateStatus, { id: agentId, status: 'working' });
            } else {
                // Taken
            }
            return;
        }

        // 4. Just looking alive (Random status updates when idle)
        const statuses = ["active", "idle"];
        if (Math.random() > 0.95) { // Less frequent updates
            const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
            await client.mutation(api.agents.updateStatus, { id: agentId, status: newStatus });
        }

    } catch (e) {
        console.error("Error in loop:", e);
    }
}


// -- Brain Integration --
import { AgentBrain } from "./openclaw_brain.js";

// Global cache for brains (so we don't re-init constantly)
const brains: Record<string, AgentBrain> = {};

async function getBrain(agentName: string, configPath: string) {
    if (brains[agentName]) return brains[agentName];

    // Read the full SOUL file to get the personality
    let soulContent = `You are ${agentName}.`;
    try {
        if (configPath) {
            soulContent = fs.readFileSync(configPath, "utf-8");
        }
    } catch (e) {
        console.error("Error reading soul:", e);
    }

    console.log(`🧠 Initializing Brain for ${agentName}...`);
    brains[agentName] = new AgentBrain(agentName, soulContent);
    return brains[agentName];
}

// Global state for chat
let lastChatTime = Date.now();

async function processChat(agentId: any, agentName: string, configPath: string) {
    try {
        const CHANNEL = 'general';
        // @ts-ignore
        const newMessages = await client.query(api.messages.listRecent, {
            channelId: CHANNEL,
            after: lastChatTime
        });

        if (newMessages.length > 0) {
            lastChatTime = Math.max(...newMessages.map((m: any) => m.timestamp));

            // Get Brain
            const brain = await getBrain(agentName, configPath);

            for (const msg of newMessages) {
                // Modified Logic: Reply if (User) OR (Mentioned) AND (Not Self)
                const isUser = !msg.fromAgentId;
                const isSelf = msg.fromAgentId === agentId; // Or check name if ID varies
                const isMentioned = msg.content.toLowerCase().includes(AGENT_NAME.toLowerCase());

                if (!isSelf && (isUser || isMentioned)) {
                    console.log(`💬 Incoming from ${isUser ? "User" : "Agent"}: "${msg.content}"`);

                    // 1. Ask Brain
                    let reply = await brain.ask([], msg.content);

                    // 2. Check for Tool Usage (JSON)
                    if (reply.includes("```json")) {
                        console.log("🛠️ Agent using tool...");
                        try {
                            const match = reply.match(/```json\n([\s\S]*?)\n```/);
                            if (match) {
                                const toolCall = JSON.parse(match[1]);
                                console.log(`> Executing: ${toolCall.tool}`);

                                // Dynamic Import to avoid top-level issues
                                const { ToolRegistry } = await import("./tools.js");
                                const result = await ToolRegistry.execute(toolCall.tool, toolCall.args);

                                console.log(`> Result: ${result}`);

                                // 3. Recursion: Feed result back to brain
                                reply = await brain.ask(
                                    [{ role: 'assistant', content: reply }],
                                    `System: Tool executed. Result: ${result}. Now answer the user.`
                                );
                            }
                        } catch (err) {
                            console.error("Tool execution failed:", err);
                            reply += "\n(System: I tried to use a tool but failed.)";
                        }
                    }

                    await client.mutation(api.messages.send, {
                        channelId: CHANNEL,
                        content: reply,
                        agentId: agentId
                    });
                    console.log(`🤖 Reply: ${reply}`);
                }
            }
        }
    } catch (e) {
        console.error("Chat error:", e);
    }
}

main().catch(console.error);
