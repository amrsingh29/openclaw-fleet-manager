import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import { AgentBrain } from "./openclaw_brain.js";

const execAsync = promisify(exec);
import path from "path";
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// ARGUMENT PARSING
const rawAgentName = process.argv.find(arg => arg.startsWith("--name="))?.split("=")[1];
// Strip both straight and curly quotes (common on Mac copy-paste)
const agentName = rawAgentName?.replace(/["'“”]/g, "");

if (!agentName) {
    console.error("❌ Usage: tsx scripts/universal-runner.ts --name=\"AgentName\"");
    process.exit(1);
}
const AGENT_NAME_ARG: string = agentName;


const SESSION_KEY = `universal:${Date.now()}`;

// CONFIG
const deploymentUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";
console.log(`🔌 Connecting to Mission Control at ${deploymentUrl} as [${AGENT_NAME_ARG}]...`);

if (!deploymentUrl) {
    console.error("❌ Missing CONVEX_URL env var");
    process.exit(1);
}
const client = new ConvexHttpClient(deploymentUrl);

// GLOBAL STATE
let agentConfig: any = null;
let brain: AgentBrain | null = null;
let orchestration: OrchestrationSkills | null = null;
let apiKey: string | undefined = undefined;

async function main() {
    console.log(`🔌 Connecting to Mission Control as [${AGENT_NAME_ARG}]...`);

    try {
        // 1. Fetch Identity (This is the "Universal" magic)
        // The Runner doesn't know who it is until the DB tells it.
        agentConfig = await client.mutation(api.agents.getIdentity, {
            name: AGENT_NAME_ARG,
            sessionKey: SESSION_KEY
        });

        console.log(`✅ Identity Downloaded: ${agentConfig.name} (${agentConfig.role})`);
        console.log(`🧠 Soul Loaded: ${agentConfig.soul ? "Yes" : "Using Default"}`);

        // 2. Fetch API Keys from Secure Vault
        apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey && agentConfig.orgId) {
            console.log(`🔐 Fetching API Key from Secure Vault for Org: ${agentConfig.orgId}...`);
            try {
                const vaultKey = await client.action(api.secrets.getSecret, {
                    orgId: agentConfig.orgId,
                    keyName: "openai_api_key"
                });
                apiKey = vaultKey ?? undefined;
                if (apiKey) console.log("✅ Key retrieved from Vault.");
                else console.warn("⚠️ No key found in Vault. Agent may malfunction.");
            } catch (err: any) {
                console.error("❌ Vault Access Failed:", err.message);
            }
        }

        // 3. Initialize Brain
        const soul = agentConfig.soul || `You are ${agentConfig.name}, a helpful AI assistant.`;
        brain = new AgentBrain(agentConfig.name, soul, apiKey);

        // 4. Start Loops
        startHeartbeat(agentConfig._id);
        runLoop(agentConfig._id);

    } catch (err: any) {
        console.error("❌ Startup Failed:", err.message);
        console.log("💡 Tip: You must 'Hire' this agent in the Admin UI first.");
        process.exit(1);
    }
}

// --- LOOPS ---

const HEARTBEAT_INTERVAL = 10000; // 10s (Faster to detect changes)

function startHeartbeat(id: any) {
    setInterval(async () => {
        try {
            await client.mutation(api.agents.heartbeat, { id });

            // Hot Reload: Check if Soul changed
            const freshConfig: any = await client.mutation(api.agents.getIdentity, {
                name: agentConfig.name,
                sessionKey: agentConfig.sessionKey
            });

            if (freshConfig.soul !== agentConfig.soul) {
                console.log(`♻️ Soul Update Detected for ${agentConfig.name}! Reloading Brain...`);
                agentConfig = freshConfig; // Update global state
                brain = new AgentBrain(agentConfig.name, agentConfig.soul, apiKey);
                console.log(`🧠 Brain Reloaded.`);
            }
        } catch (err) {
            console.error("Heartbeat Error:", err);
        }
    }, HEARTBEAT_INTERVAL);
}

async function runLoop(agentId: any) {
    try {
        await processTasks(agentId);
    } catch (e) {
        console.error("Loop Error:", e);
    }

    try {
        await processChat(agentId);
    } catch (e) {
        console.error("Chat Error:", e);
    }

    setTimeout(() => runLoop(agentId), 5000);
}

// --- LOGIC (Shared with agent-runner.ts but using global state) ---

import { OrchestrationSkills } from "./orchestration_skills.js";

async function processTasks(agentId: any) {
    if (!orchestration) {
        orchestration = new OrchestrationSkills(client as any, agentConfig.orgId);
    }

    // 1. Check for tasks EXPLICITLY assigned to me
    const tasks = await client.query(api.tasks.list);
    const myTask = tasks.find((t: any) =>
        t.assignedTo === agentId && (t.status === 'in_progress' || t.status === 'pending' || t.status === 'assigned' || t.status === 'inbox')
    );

    if (myTask) {
        // Auto-Start
        if (myTask.status === 'assigned' || (myTask.status as string) === 'pending' || (myTask.status as string) === 'inbox') {
            await client.mutation((api.messages as any).updateTaskStatus, { taskId: myTask._id, status: 'in_progress' });
            await client.mutation(api.agents.updateStatus, { id: agentId, status: 'working' });
            return;
        }

        console.log(`🚀 Strategic Work: ${myTask.title} (Mission: ${(myTask as any).missionId || "None"})`);

        // HEARTBEAT UPDATE for this specific task
        await client.mutation((api.messages as any).updateTaskStatus as any, {
            taskId: myTask._id,
            status: 'in_progress',
            // heartbeat: Date.now() // Temporarily disabled due to schema mismatch
        });

        let output = "[Error: Brain not initialized]";
        if (brain) {
            output = await brain.work(myTask.title, myTask.description);
        }

        // COMPLETE TASK with output/result
        await client.mutation((api.messages as any).updateTaskStatus, {
            taskId: myTask._id,
            status: 'done',
            result: output
        } as any);

        await client.mutation(api.agents.updateStatus, { id: agentId, status: 'idle' });
        console.log(`✅ Task Completed: ${myTask.title}`);

        // 🎯 Proactive Feedback: Notify the team channel that the task is done
        await client.mutation(api.messages.send, {
            channelId: `team-${agentConfig.teamId}`,
            content: `✅ TASK COMPLETED: ${myTask.title}\nRESULT: ${output}`,
            agentId: agentId,
            depth: 1
        } as any);

        return;
    }

    // 2. Legacy Inbox Handling (If still using global inbox)
    // ...
}

// Multi-channel Cursor Tracking - look back 15 minutes on start to catch missed triggers
const START_TIME = Date.now() - (15 * 60 * 1000);
const lastChatTimes: Record<string, number> = {
    'general': START_TIME
};

async function processChat(agentId: any) {
    if (!brain || !agentConfig) return;

    // Channels to listen to: General + My Team (+ My Current Task)
    const channels = ['general'];
    if (agentConfig.teamId) {
        const teamChannel = `team-${agentConfig.teamId}`;
        channels.push(teamChannel);
        if (!lastChatTimes[teamChannel]) {
            lastChatTimes[teamChannel] = START_TIME;
        }
    }

    if (agentConfig.currentTaskId) {
        const taskChannel = `task-${agentConfig.currentTaskId}`;
        channels.push(taskChannel);
        if (!lastChatTimes[taskChannel]) {
            lastChatTimes[taskChannel] = START_TIME;
        }
    }

    for (const channelId of channels) {
        // @ts-ignore
        const newMessages = await client.query(api.messages.listRecent, {
            channelId: channelId,
            after: lastChatTimes[channelId]
        });

        if (newMessages.length > 0) {
            // Update cursor for THIS channel
            lastChatTimes[channelId] = Math.max(...newMessages.map((m: any) => m.timestamp));

            for (const msg of newMessages) {
                const isSelf = msg.fromAgentId === agentId;
                const isMentioned = msg.content.toLowerCase().includes(agentConfig.name.toLowerCase());
                const isTeamChannel = channelId.startsWith('team-');
                const currentDepth = (msg as any).depth || 0;

                // 🛡️ LOOP SHIELD: Recursion Depth Limit
                if (currentDepth >= 5) {
                    if (isMentioned) {
                        console.warn(`[${channelId}] 🛑 Recursion Limit Reached (Depth: ${currentDepth}). Silencing to prevent loop.`);
                    }
                    continue;
                }

                // Decide whether to reply:
                // 1. If explicitly mentioned
                // 2. If it's a Team Channel (Proactive Mode)
                let shouldReply = !isSelf && (isMentioned || isTeamChannel);

                // 3. 🛡️ LOOP SHIELD: CASE CLOSED Check
                if (msg.content.includes("CASE CLOSED") || msg.content.includes("INCIDENT RESOLVED")) {
                    console.log(`[${channelId}] 🛑 Misson Complete signal detected. Standing by.`);
                    continue;
                }

                // 4. 🛡️ LOOP SHIELD: Ignore Task Completion notifications unless mentioned
                if (msg.content.includes("TASK COMPLETED") && !isMentioned) {
                    // checks if I was the one who completed it to strictly avoid self-loops
                    if (msg.fromAgentId === agentId) {
                        console.log(`[${channelId}] 🤐 Ignoring my own task completion notification.`);
                        continue;
                    }
                    // Otherwise, only the Commander (Jarvis) should likely respond to these proactively
                    if (!agentConfig.role.toLowerCase().includes("commander") && agentConfig.name !== "Jarvis") {
                        console.log(`[${channelId}] 🤐 Ignoring task completion (Not my jurisdiction).`);
                        continue;
                    }
                }

                if (shouldReply) {
                    const mode = isMentioned ? "Mentioned" : "Proactive";
                    console.log(`[${channelId}] 💬 ${mode} (Depth: ${currentDepth}): "${msg.content}"`);

                    // 5. 🛡️ ORCHESTRATION: Strict Subordination
                    // If I am NOT the Commander (Jarvis), I should NOT reply proactively to general chatter.
                    // I should only reply if:
                    // a) I am explicitly mentioned (@Marcus)
                    // b) The message is from the Commander (Jarvis) - implicit via isMentioned usually, but let's be safe
                    // c) It is a direct DM (not a Team Channel)
                    const isCommander = agentConfig.role.toLowerCase().includes("commander") || agentConfig.name === "Jarvis";

                    if (!isCommander && isTeamChannel && !isMentioned) {
                        // Optional: Check if message is from Commander? 
                        // For now, Strict Mode: Wait for specific instructions (which usually come as Tasks or @Mentions)
                        // console.log(`[${channelId}] 🤐 Strict Subordination: Waiting for orders.`);
                        continue;
                    }

                    // Goal-Aware Filtering (Only for Commander now)
                    if (isTeamChannel && !isMentioned && isCommander) {
                        // For now, let's use a simple regex or keyword check to save tokens
                        // In a real scenario, this would be a "cheap" LLM intent classification
                        const isGoal = /need|help|fix|check|restart|error|bug|issue|task|urgent|critical|report/i.test(msg.content);
                        if (!isGoal) {
                            // console.log(`[${channelId}] 🤐 Ignoring chatter (No goal intent detected).`);
                            continue;
                        }
                    }

                    // ORCHESTRATION: Inject fleet capabilities if manager
                    let contextMessage = msg.content;
                    if (agentConfig.role.toLowerCase().includes("commander") || agentConfig.name === "Jarvis") {
                        const fleet = await orchestration!.get_fleet_capabilities();
                        const tasks = await client.query(api.tasks.list);
                        const activeTasks = tasks.filter((t: any) =>
                            (t.missionId || t.status === 'inbox') &&
                            t.status !== 'archived' &&
                            t.status !== 'done'
                        ).slice(0, 5);

                        contextMessage = `FLEET_CAPABILITIES: ${JSON.stringify(fleet)}\n\nACTIVE_TASKS: ${JSON.stringify(activeTasks)}\n\nUSER_MESSAGE: ${msg.content}`;
                    }

                    const reply = await brain.ask([], contextMessage);

                    // 🛡️ Sentient Silence: Check for NO_REPLY
                    if (reply.includes("NO_REPLY")) {
                        console.log(`[${channelId}] 🤐 Agent chose silence (Sentient Silence).`);
                        continue;
                    }

                    // 🎯 ORCHESTRATION: Parse and Execute Actions
                    if (reply.includes("ACTION: create_task")) {
                        console.log(`🎯 Orchestration Action detected in [${agentConfig.name}] response!`);
                        const taskBlocks = reply.split("ACTION: create_task").slice(1);
                        for (const block of taskBlocks) {
                            const title = block.match(/TITLE: (.*)/)?.[1]?.trim();
                            const desc = block.match(/DESCRIPTION: (.*)/)?.[1]?.trim();
                            const assignee = block.match(/ASSIGNEE_ID: (.*)/)?.[1]?.trim();
                            const missionId = block.match(/MISSION_ID: (.*)/)?.[1]?.trim() || `mission-${Date.now()}`;
                            const priority = parseInt(block.match(/PRIORITY: (.*)/)?.[1] || "5");

                            if (title && desc && assignee) {
                                await orchestration!.create_task({
                                    title,
                                    description: desc,
                                    assigneeId: assignee,
                                    missionId,
                                    priority,
                                    teamId: agentConfig.teamId
                                });
                            }
                        }
                    }

                    await client.mutation(api.messages.send, {
                        channelId: channelId,
                        content: reply,
                        agentId: agentId,
                        depth: currentDepth + 1 // 🛡️ Increment Depth
                    } as any);
                    console.log(`🤖 Reply: ${reply}`);
                }
            }
        }
    }
}

main().catch(console.error);
