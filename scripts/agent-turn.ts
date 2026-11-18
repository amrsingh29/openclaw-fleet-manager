// The agent turn: model call -> tool calls -> results -> model call, until the
// model stops asking for tools or we hit the round cap.
//
// This replaces two older paths, both broken: shelling out to an `openclaw` CLI
// that is not in the repo, and a regex that looked for a fenced ```json block the
// model was never instructed to emit. One loop serves both chat and tasks now.

import { ChatMessage, LlmProvider, ToolCall } from "./llm/types.js";
import { ToolRegistry, WriteGate } from "./tools/registry.js";
import { ToolResult } from "./tools/types.js";
import { maxToolRounds } from "./fleet-config.js";

export type ToolEvent = {
    callId: string;
    tool: string;
    args: Record<string, unknown>;
    result: ToolResult;
    elapsedMs: number;
};

export type TurnOptions = {
    provider: LlmProvider;
    registry: ToolRegistry;
    system: string;
    messages: ChatMessage[];
    /**
     * Tool names this agent may use. An empty array or undefined means no tools,
     * which is the right default for plain chat.
     */
    allowTools?: string[];
    gate?: WriteGate;
    maxRounds?: number;
    maxTokens?: number;
    temperature?: number;
    /** Called for every tool execution so the caller can log to Convex. */
    onToolEvent?: (e: ToolEvent) => void | Promise<void>;
    /** Called when a tool needs approval, so the caller can raise a proposal. */
    onNeedsApproval?: (info: {
        tool: string;
        args: Record<string, unknown>;
        reason: string;
    }) => void | Promise<void>;
};

export type TurnResult = {
    text: string;
    /** Every tool call made this turn, in order, for the audit trail. */
    tools: ToolEvent[];
    /** Why the loop ended. "max_rounds" means the model kept asking for tools. */
    endedBecause: "answered" | "max_rounds" | "truncated" | "error";
    rounds: number;
};

export async function runTurn(opts: TurnOptions): Promise<TurnResult> {
    const { provider, registry, system } = opts;
    const useTools = Array.isArray(opts.allowTools) && opts.allowTools.length > 0;
    const schemas = useTools ? registry.schemas(opts.allowTools) : undefined;
    const cap = opts.maxRounds ?? maxToolRounds();

    const messages: ChatMessage[] = [...opts.messages];
    const events: ToolEvent[] = [];
    let rounds = 0;

    while (rounds < cap) {
        rounds++;

        const res = await provider.chat({
            system,
            messages,
            tools: schemas,
            maxTokens: opts.maxTokens,
            temperature: opts.temperature,
        });

        // No tool calls: this is the answer.
        if (!res.toolCalls.length) {
            const text = res.text.trim();
            return {
                text: text || "(no reply)",
                tools: events,
                endedBecause: res.stopReason === "length" ? "truncated" : "answered",
                rounds,
            };
        }

        // Record the assistant turn so the next request carries the tool_use
        // blocks the provider needs to match results against.
        messages.push({ role: "assistant", content: res.text ?? "", toolCalls: res.toolCalls });

        for (const call of res.toolCalls) {
            const started = Date.now();
            const result = await registry.execute(call.name, call.args, {
                callId: call.id,
                gate: opts.gate,
            });
            const elapsedMs = Date.now() - started;

            const event: ToolEvent = { callId: call.id, tool: call.name, args: call.args, result, elapsedMs };
            events.push(event);
            await opts.onToolEvent?.(event);

            if (result.needsApproval) {
                await opts.onNeedsApproval?.({
                    tool: call.name,
                    args: call.args,
                    reason: result.output,
                });
            }

            messages.push({
                role: "user",
                content: formatToolResult(call.name, result),
                toolCallId: call.id,
            });
        }

        // If every call this round was blocked on approval, continuing would just
        // loop the model against the same refusal. Stop and let the human decide.
        const allBlocked = res.toolCalls.every(
            (c) => events.find((e) => e.callId === c.id)?.result.needsApproval,
        );
        if (allBlocked) {
            return {
                text:
                    res.text?.trim() ||
                    "I need commander approval before I can proceed with that action. I have raised it for review.",
                tools: events,
                endedBecause: "answered",
                rounds,
            };
        }
    }

    // Cap reached. Ask for a summary with tools off, so the agent still reports
    // rather than dropping the task on the floor.
    const summary = await provider.chat({
        system,
        messages: [
            ...messages,
            {
                role: "user",
                content:
                    "You have used your tool budget for this turn. Summarise what you found and what remains, " +
                    "without calling any more tools.",
            },
        ],
        tools: undefined,
        maxTokens: opts.maxTokens,
    });

    return {
        text: summary.text.trim() || "Tool budget exhausted without a summary.",
        tools: events,
        endedBecause: "max_rounds",
        rounds,
    };
}

function formatToolResult(toolName: string, result: ToolResult): string {
    const header = result.ok ? `[${toolName} result]` : `[${toolName} error]`;
    return `${header}\n${result.output}`;
}

/** Which tools mutate state, for the proposal path. */
export function isMutating(registry: ToolRegistry, name: string): boolean {
    return registry.find(name)?.effect === "write";
}

export type { ToolCall };
