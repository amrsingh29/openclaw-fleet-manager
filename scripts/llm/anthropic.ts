// Native Anthropic adapter. Their OpenAI-compat endpoint exists, but it drops
// tool_use content blocks and prompt caching, and the message shape is different
// enough that translating by hand here is clearer than shimming on top of the
// OpenAI adapter's assumptions (system message inline, tool results as messages).

import { ChatMessage, ChatRequest, ChatResponse, LlmError, LlmProvider, ToolCall, classifyHttpError } from "./types.js";

export type AnthropicOptions = {
    apiKey: string;
    model: string;
    baseUrl?: string;
    timeoutMs?: number;
    /** "2023-06-01" is current as of writing. */
    anthropicVersion?: string;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements LlmProvider {
    readonly id: string;
    readonly model: string;
    private opts: AnthropicOptions;

    constructor(opts: AnthropicOptions) {
        if (!opts.apiKey) {
            throw new LlmError("Anthropic provider requires an API key (ANTHROPIC_API_KEY or llm.apiKey)", "auth");
        }
        if (!opts.model) throw new Error("Anthropic provider requires a model");
        this.opts = opts;
        this.model = opts.model;
        this.id = "anthropic";
    }

    async chat(req: ChatRequest): Promise<ChatResponse> {
        const base = (this.opts.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
        const url = `${base}/v1/messages`;

        const body: Record<string, unknown> = {
            model: this.model,
            // Anthropic requires max_tokens, unlike the OpenAI shape.
            max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
            system: req.system,
            messages: toAnthropicMessages(req.messages),
        };
        if (req.temperature !== undefined) body.temperature = req.temperature;
        if (req.tools?.length) {
            body.tools = req.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters,
            }));
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        let res: Response;
        try {
            res = await fetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": this.opts.apiKey,
                    "anthropic-version": this.opts.anthropicVersion ?? DEFAULT_VERSION,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (err: any) {
            clearTimeout(timer);
            throw new LlmError(
                err?.name === "AbortError" ? `Anthropic request timed out` : `Network error calling Anthropic: ${err?.message}`,
                "network",
                err,
            );
        }
        clearTimeout(timer);

        const text = await res.text();
        let json: any;
        try {
            json = text ? JSON.parse(text) : undefined;
        } catch {
            /* non-JSON */
        }
        if (!res.ok) throw classifyHttpError(res.status, json ?? text);

        // Anthropic returns an array of content blocks: text, tool_use, thinking.
        const blocks: any[] = Array.isArray(json?.content) ? json.content : [];
        const prose = blocks
            .filter((b) => b?.type === "text")
            .map((b) => b.text ?? "")
            .join("")
            .trim();

        const toolCalls: ToolCall[] = blocks
            .filter((b) => b?.type === "tool_use" && b.name)
            .map((b) => ({
                id: b.id ?? `call_${Date.now()}`,
                name: b.name,
                args: (b.input && typeof b.input === "object" ? b.input : {}) as Record<string, unknown>,
            }));

        const stopReason = mapStopReason(json?.stop_reason, toolCalls.length > 0);

        return {
            text: prose,
            toolCalls,
            stopReason,
            usage: json?.usage
                ? { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens }
                : undefined,
            raw: json,
        };
    }
}

function mapStopReason(reason: unknown, hasToolCalls: boolean): ChatResponse["stopReason"] {
    if (hasToolCalls) return "tool_calls";
    switch (reason) {
        case "end_turn":
        case "stop_sequence":
            return "stop";
        case "tool_use":
            return "tool_calls";
        case "max_tokens":
            return "length";
        case "refusal":
            return "content_filter";
        default:
            return "unknown";
    }
}

/**
 * Our neutral shape keeps tool results as their own messages; Anthropic wants
 * every tool_result for one assistant turn bundled into a single user message.
 * Grouping here keeps the runner's loop simple.
 */
function toAnthropicMessages(messages: ChatMessage[]): unknown[] {
    const out: any[] = [];

    for (const m of messages) {
        if (m.toolCallId) {
            const block = {
                type: "tool_result",
                tool_use_id: m.toolCallId,
                content: typeof m.content === "string" ? m.content : flatten(m.content),
            };
            // Append to a trailing user message of tool_results when possible.
            const last = out[out.length - 1];
            if (last && last.role === "user" && Array.isArray(last.content) && last.content.every((c: any) => c.type === "tool_result")) {
                last.content.push(block);
            } else {
                out.push({ role: "user", content: [block] });
            }
            continue;
        }

        if (m.toolCalls?.length) {
            const blocks: any[] = [];
            const prose = typeof m.content === "string" ? m.content : flatten(m.content);
            if (prose) blocks.push({ type: "text", text: prose });
            for (const c of m.toolCalls) {
                blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
            }
            out.push({ role: "assistant", content: blocks });
            continue;
        }

        out.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : flatten(m.content),
        });
    }

    return out;
}

function flatten(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("").trim();
    }
    return "";
}
