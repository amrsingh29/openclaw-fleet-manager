import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import { AgentBrain } from "./openclaw_brain.js";

const execAsync = promisify(exec);
dotenv.config();

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
const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌ Missing CONVEX_URL env var");
    process.exit(1);
}
const client = new ConvexHttpClient(CONVEX_URL);

// GLOBAL STATE
let agentConfig: any = null;
let brain: AgentBrain | null = null;

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
        let apiKey = process.env.OPENAI_API_KEY;
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
                brain = new AgentBrain(agentConfig.name, agentConfig.soul);
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

async function processTasks(agentId: any) {
    // 1. Check for current active task
    const tasks = await client.query(api.tasks.list);
    const myTask = tasks.find((t: any) => t.assigneeIds?.includes(agentId) && (t.status === 'in_progress' || t.status === 'assigned'));

    if (myTask) {
        // Auto-Start
        if (myTask.status === 'assigned') {
            await client.mutation(api.tasks.updateStatus, { id: myTask._id, status: 'in_progress' });
            // 4. Update status to Working
            await client.mutation(api.agents.updateStatus, { id: agentId, status: 'working' });
            return;
        }

        console.log(`🚀 Working on: ${myTask.title}`);

        let output = "[Error: Brain not initialized]";
        if (brain) {
            // Real Intelligence: Agents actually think about the task!
            // Wait a random time to simulate "effort" (and avoid rate limits)
            await new Promise(r => setTimeout(r, 2000));

            output = await brain.work(myTask.title, myTask.description);
        } else {
            await new Promise(r => setTimeout(r, 1000));
        }

        await client.mutation(api.tasks.complete, {
            taskId: myTask._id,
            agentId,
            output: output
        });
        await client.mutation(api.agents.updateStatus, { id: agentId, status: 'idle' });
        return;
    }

    // 2. No active task? Look for new work in Inbox
    const inboxTasks = tasks.filter((t: any) => t.status === 'inbox');

    // Prioritize Team Tasks, then Global Tasks
    const eligibleTask = inboxTasks.find((t: any) => {
        // If task is assigned to a specific team, I must be on that team
        if (t.teamId) {
            return t.teamId === agentConfig.teamId;
        }
        // If task is global (no teamId), anyone can take it (or maybe only if I don't have a team preference?)
        // For now, allow global tasks to be taken by anyone.
        return true;
    });

    if (eligibleTask) {
        console.log(`✋ Claiming task: ${eligibleTask.title}`);
        const success = await client.mutation(api.tasks.claim, {
            taskId: eligibleTask._id,
            agentId
        });

        if (success) {
            await client.mutation(api.agents.updateStatus, { id: agentId, status: 'working' });
        }
    }
}

// Multi-channel Cursor Tracking
const lastChatTimes: Record<string, number> = {
    'general': Date.now()
};

async function processChat(agentId: any) {
    if (!brain || !agentConfig) return;

    // Channels to listen to: General + My Team (+ My Current Task)
    const channels = ['general'];
    if (agentConfig.teamId) {
        const teamChannel = `team-${agentConfig.teamId}`;
        channels.push(teamChannel);
        if (!lastChatTimes[teamChannel]) {
            lastChatTimes[teamChannel] = Date.now();
        }
    }

    if (agentConfig.currentTaskId) {
        const taskChannel = `task-${agentConfig.currentTaskId}`;
        channels.push(taskChannel);
        if (!lastChatTimes[taskChannel]) {
            lastChatTimes[taskChannel] = Date.now();
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

                if (shouldReply) {
                    const mode = isMentioned ? "Mentioned" : "Proactive";
                    console.log(`[${channelId}] 💬 ${mode} (Depth: ${currentDepth}): "${msg.content}"`);

                    // Goal-Aware Filtering: If it's proactive (not mentioned), check if it's a real goal
                    if (isTeamChannel && !isMentioned) {
                        // For now, let's use a simple regex or keyword check to save tokens
                        // In a real scenario, this would be a "cheap" LLM intent classification
                        const isGoal = /need|help|fix|check|restart|error|bug|issue|task/i.test(msg.content);
                        if (!isGoal) {
                            // console.log(`[${channelId}] 🤐 Ignoring chatter (No goal intent detected).`);
                            continue;
                        }
                    }

                    const reply = await brain.ask([], msg.content);

                    // 🛡️ Sentient Silence: Check for NO_REPLY
                    if (reply.includes("NO_REPLY")) {
                        console.log(`[${channelId}] 🤐 Agent chose silence (Sentient Silence).`);
                        continue;
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
