// An agent's brain: a soul prompt plus a provider, wrapped around the tool loop.
//
// This used to call OpenAI directly with a hardcoded model and no tools. It now
// delegates to the provider layer (so any provider works) and to runTurn (so
// tools actually execute). Kept the class name and the ask/work method names so
// the runner and any forks that import this file keep working.

import * as dotenv from "dotenv";
import { createProvider, ChatMessage, LlmProvider } from "./llm/index.js";
import { ToolRegistry, defaultRegistry, WriteGate } from "./tools/registry.js";
import { runTurn, ToolEvent, TurnUsage } from "./agent-turn.js";
import { policyDefaults, listServiceNames } from "./fleet-config.js";
import type { FleetBackend } from "./tools/backend.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

export type BrainMessage = ChatMessage;

export type BrainCallbacks = {
    /** Fired for each tool the agent runs, so the runner can audit it. */
    onToolEvent?: (e: ToolEvent) => void | Promise<void>;
    onNeedsApproval?: (info: { tool: string; args: Record<string, unknown>; reason: string }) => void | Promise<void>;
};

export class AgentBrain {
    private agentName: string;
    private bio: string;
    private provider: LlmProvider;
    private registry: ToolRegistry;
    private callbacks: BrainCallbacks;
    private backend?: FleetBackend;
    private agentId?: string;
    /** Set while a mission is being executed, so delegation records its parent. */
    private currentTaskId?: string;

    setCurrentTask(taskId?: string): void {
        this.currentTaskId = taskId;
    }

    constructor(
        agentName: string,
        bio: string,
        opts: {
            provider?: LlmProvider;
            registry?: ToolRegistry;
            callbacks?: BrainCallbacks;
            /** Mission Control access, enabling create_task. */
            backend?: FleetBackend;
            /** The agent's own id, so delegation can attribute and avoid self-assignment. */
            agentId?: string;
        } = {},
    ) {
        this.agentName = agentName;
        this.bio = bio || `You are ${agentName}.`;
        this.provider = opts.provider ?? createProvider().provider;
        this.registry = opts.registry ?? defaultRegistry;
        this.callbacks = opts.callbacks ?? {};
        this.backend = opts.backend;
        this.agentId = opts.agentId;
    }

    get model(): string {
        return this.provider.model;
    }

    get providerId(): string {
        return this.provider.id;
    }

    /**
     * Chat reply. Tools are available here too: an agent asked in the War Room
     * to check something can actually check it, which was the dead path before.
     */
    async ask(recentHistory: BrainMessage[], newMessage: string): Promise<string> {
        const messages: BrainMessage[] = [...recentHistory, { role: "user", content: newMessage }];

        try {
            const turn = await runTurn({
                provider: this.provider,
                registry: this.registry,
                system: this.chatSystemPrompt(),
                messages,
                // Chat gets tools, but only the read-only ones: a chat message
                // should not restart a service without a task and an approval
                // trail behind it.
                // Chat gets reads plus delegation; a chat message should not be
                // able to restart a service without a task behind it.
                allowTools: this.registry
                    .list()
                    .filter((t) => t.effect === "read" || t.name === "create_task")
                    .map((t) => t.name),
                gate: this.policyGate(),
                maxRounds: 3,
                agentName: this.agentName,
                agentId: this.agentId,
                backend: this.backend,
                onToolEvent: this.callbacks.onToolEvent,
                onNeedsApproval: this.callbacks.onNeedsApproval,
            });

            const reply = turn.text.trim();
            if (this.isSilence(reply)) return "NO_REPLY";
            return reply;
        } catch (err: any) {
            console.error("Brain Error:", err.message);
            return `[Brain Malfunction]: ${err.message}`;
        }
    }

    /**
     * Task execution. Full tool access, so an assigned mission can investigate
     * and act. Returns markdown, which is what the task card renders.
     */
    async work(
        title: string,
        description: string,
    ): Promise<{ text: string; tools: ToolEvent[]; usage: TurnUsage }> {
        try {
            const turn = await runTurn({
                provider: this.provider,
                registry: this.registry,
                system: this.taskSystemPrompt(),
                messages: [{ role: "user", content: `TASK: ${title}\nDETAILS: ${description}` }],
                allowTools: this.registry.list().map((t) => t.name),
                gate: this.policyGate(),
                agentName: this.agentName,
                agentId: this.agentId,
                taskId: this.currentTaskId,
                backend: this.backend,
                onToolEvent: this.callbacks.onToolEvent,
                onNeedsApproval: this.callbacks.onNeedsApproval,
            });
            return { text: turn.text, tools: turn.tools, usage: turn.usage };
        } catch (err: any) {
            console.error("Brain Work Error:", err.message);
            // A failed turn still burned tokens before it threw, but nothing
            // was reported, so record zero rather than inventing a figure.
            return {
                text: `[Brain Error]: ${err.message}`,
                tools: [],
                usage: { inputTokens: 0, outputTokens: 0, rounds: 0 },
            };
        }
    }

    private chatSystemPrompt(): string {
        const toolNames = this.registry
            .list()
            .filter((t) => t.effect === "read")
            .map((t) => `- ${t.name}: ${t.description}`)
            .join("\n");

        // Naming the services explicitly matters: without this the model refuses
        // to call a tool because it cannot be sure a service name is real, which
        // reads as a bug even though the guards are working correctly.
        const services = listServiceNames();
        const serviceLine = services.length
            ? `The declared services are: ${services.map((s) => `"${s}"`).join(", ")}.`
            : "No services are declared, so tools that need one will refuse. Say so if asked for live data.";

        return `
You are ${this.agentName}.
${this.bio}

Tone: Keep responses concise, professional, and consistent with your personality.
Context: You are chatting in a 'War Room' with a human commander and other agents.

TOOLS
You can call these read-only tools when a question genuinely needs live data:
${toolNames || "(none configured)"}

${serviceLine}

If the commander asks about "this host", "the system", "the machine" or similar and
exactly one service is declared, use that service. Do not refuse for lack of a name
when there is only one candidate.

Use create_task when work belongs to a specialist rather than to you. Delegating is
not passing the buck: it is how a squad with distinct roles actually divides a problem.
State the assignee by name, and prefer doing the small thing yourself over raising a
mission for a one-line answer.

Never invent a hostname, service name, file path, or agent name. If a tool refuses or
returns an error, report it plainly rather than retrying with guessed arguments.

SENTIENT SILENCE
If you are observing a conversation and determine that no response is necessary from
you (you are not mentioned AND the chatter is irrelevant), respond ONLY with "NO_REPLY".
If you are explicitly mentioned or assigned a goal, you MUST respond.
`;
    }

    private taskSystemPrompt(): string {
        const toolList = this.registry
            .list()
            .map((t) => `- ${t.name} (${t.effect}): ${t.description}`)
            .join("\n");

        return `
You are ${this.agentName}.
${this.bio}

OBJECTIVE
You have been assigned a mission. Investigate and act using the tools available,
then report the RESULT.

TOOLS
${toolList}

DELEGATION
You have create_task. If this mission is coordination rather than hands-on work, split
it: assign the parts to the agents whose roles fit, then report what you dispatched.
Do not create a task for work you can finish yourself with the tools you already have,
and do not assign a mission to yourself.

RULES
- Only the services declared in fleet.yml exist. Never invent a hostname, service
  name, file path, or agent name; if you need one that is not declared, say so.
- Prefer the least invasive tool that answers the question. Read before you write.
- A restart requires approval under the default policy. If a tool says it needs
  approval, report that you have raised it and stop; do not try to work around it.
- Never claim you did something you did not do. Tool output is evidence; anything
  else is speculation, so label it as such.

OUTPUT
Markdown. Lead with the outcome in one line, then the evidence you actually
collected, then anything still unresolved. Cite real numbers from tool output;
do not fabricate plausible-looking metrics.
`;
    }

    /**
     * Maps the fleet.yml policy defaults onto the registry's gate. The Convex
     * policies table can override this per team once the runner passes its org
     * and team through; the file default is the floor, not the ceiling.
     */
    private policyGate(): WriteGate {
        const defaults = policyDefaults();
        return async (tool) => {
            // Delegation gets its own tier: filing work for a teammate is not the
            // same risk as stopping a service, and gating it would leave the
            // commander unable to assign anything without a human in the loop.
            const setting =
                tool.name === "create_task"
                    ? defaults.delegate
                    : tool.effect === "write"
                      ? defaults.write
                      : defaults.read;
            if (setting === "auto") return { allow: true };
            return {
                allow: false,
                needsApproval: true,
                reason:
                    `Policy for ${tool.effect} actions is '${setting}' (fleet.yml), so ${tool.name} was not executed. ` +
                    `A commander must approve it from the proposals panel.`,
            };
        };
    }

    /** Models occasionally answer the literal word even when unprompted. */
    private isSilence(reply: string): boolean {
        return /^"?NO_REPLY"?\.?$/i.test(reply.trim());
    }
}
