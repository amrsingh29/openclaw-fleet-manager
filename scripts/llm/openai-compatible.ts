// Adapter for any endpoint that speaks the OpenAI Chat Completions API.
// That is a wider set than the name suggests: OpenAI, Azure OpenAI, OpenRouter,
// Groq, Together, Fireworks, LM Studio, Ollama (/v1), vLLM, llama.cpp server,
// and most internal gateways.
//
// Deliberately plain fetch rather than the openai SDK: one code path, no SDK
// version drift, and the request body is visible when something misbehaves.

import {
    ChatRequest,
    ChatResponse,
    LlmError,
    LlmProvider,
    ToolCall,
    classifyHttpError,
} from "./types.js";

export type OpenAICompatibleOptions = {
    baseUrl: string;
    apiKey?: string;
    model: string;
    /** Some gateways need extra headers; some local servers need a dummy key. */
    extraHeaders?: Record<string, string>;
    /** Per-request timeout. Local models on cold load can be slow. */
    timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;

export class OpenAICompatibleProvider implements LlmProvider {
    readonly id: string;
    readonly model: string;
    private opts: OpenAICompatibleOptions;

    constructor(opts: OpenAICompatibleOptions) {
        if (!opts.baseUrl) throw new Error("OpenAI-compatible provider requires a baseUrl");
        if (!opts.model) throw new Error("OpenAI-compatible provider requires a model");
        this.opts = opts;
        this.model = opts.model;
        // Hostname is enough to tell gateways apart in logs without leaking keys.
        let host = "custom";
        try {
            host = new URL(opts.baseUrl).host;
        } catch {
            /* localhost shorthand like "localhost:11434/v1" */
            host = opts.baseUrl.split("/")[0];
        }
        this.id = `openai-compatible:${host}`;
    }

    async chat(req: ChatRequest): Promise<ChatResponse> {
        const url = `${this.opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;

        const body: Record<string, unknown> = {
            model: this.model,
            messages: toWireMessages(req),
        };
        if (req.tools?.length) {
            body.tools = req.tools.map((t) => ({
                type: "function",
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                },
            }));
            body.tool_choice = "auto";
        }
        if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
        if (req.temperature !== undefined) body.temperature = req.temperature;

        const headers: Record<string, string> = {
            "content-type": "application/json",
            ...(this.opts.extraHeaders ?? {}),
        };
        // Local servers (Ollama, llama.cpp) reject a missing Authorization on some
        // versions and ignore a bogus one on others, so only send when we have a key.
        if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        let res: Response;
        try {
            res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (err: any) {
            clearTimeout(timer);
            const aborted = err?.name === "AbortError";
            throw new LlmError(
                aborted
                    ? `Request to ${url} timed out after ${this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`
                    : `Network error calling ${url}: ${err?.message ?? err}`,
                "network",
                err,
            );
        }
        clearTimeout(timer);

        const text = await res.text();
        let json: any = undefined;
        try {
            json = text ? JSON.parse(text) : undefined;
        } catch {
            /* non-JSON error page */
        }

        if (!res.ok) throw classifyHttpError(res.status, json ?? text);

        const choice = json?.choices?.[0];
        if (!choice) {
            throw new LlmError(
                `Provider returned no choices. Body: ${text.slice(0, 400)}`,
                "bad_response",
                json,
            );
        }

        const message = choice.message ?? {};
        const toolCalls = parseToolCalls(message.tool_calls);
        const finish = choice.finish_reason;

        return {
            text: normaliseContent(message.content),
            toolCalls,
            stopReason: mapFinishReason(finish, toolCalls.length > 0),
            usage: json?.usage
                ? {
                      inputTokens: json.usage.prompt_tokens,
                      outputTokens: json.usage.completion_tokens,
                  }
                : undefined,
            raw: json,
        };
    }
}

function normaliseContent(content: unknown): string {
    if (typeof content === "string") return content;
    // Some providers return content as an array of parts even in chat completions.
    if (Array.isArray(content)) {
        return content
            .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
            .join("")
            .trim();
    }
    return "";
}

function parseToolCalls(raw: unknown): ToolCall[] {
    if (!Array.isArray(raw)) return [];
    const out: ToolCall[] = [];
    for (const call of raw) {
        const name = call?.function?.name;
        if (!name) continue;
        out.push({
            id: call.id ?? `call_${out.length}_${Date.now()}`,
            name,
            args: parseArgs(call.function?.arguments),
        });
    }
    return out;
}

/**
 * Arguments arrive as a JSON string per the spec, but local models routinely
 * emit malformed or wrapped JSON. Never throw here: a bad argument blob should
 * surface as a tool error the model can read and recover from, not a crash.
 */
function parseArgs(raw: unknown): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw !== "string") return {};

    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
    } catch {
        // Common local-model failure: fenced JSON, or prose around the object.
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenced ? fenced[1].trim() : trimmed;
        const braced = candidate.match(/\{[\s\S]*\}/);
        if (braced) {
            try {
                const parsed = JSON.parse(braced[0]);
                if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
            } catch {
                /* fall through */
            }
        }
        return { __unparsed: trimmed };
    }
}

function mapFinishReason(reason: unknown, hasToolCalls: boolean): ChatResponse["stopReason"] {
    if (hasToolCalls) return "tool_calls";
    switch (reason) {
        case "stop":
            return "stop";
        case "length":
            return "length";
        case "tool_calls":
        case "function_call":
            return "tool_calls";
        case "content_filter":
            return "content_filter";
        default:
            return "unknown";
    }
}

/** Turns our neutral message shape into the wire shape for this API. */
function toWireMessages(req: ChatRequest): unknown[] {
    const out: unknown[] = [{ role: "system", content: req.system }];

    for (const m of req.messages) {
        if (m.toolCallId) {
            out.push({
                role: "tool",
                tool_call_id: m.toolCallId,
                content: typeof m.content === "string" ? m.content : flattenParts(m.content),
            });
            continue;
        }

        if (m.toolCalls?.length) {
            out.push({
                role: "assistant",
                content: typeof m.content === "string" ? m.content || null : flattenParts(m.content) || null,
                tool_calls: m.toolCalls.map((c) => ({
                    id: c.id,
                    type: "function",
                    function: { name: c.name, arguments: JSON.stringify(c.args) },
                })),
            });
            continue;
        }

        out.push({
            role: m.role,
            content: typeof m.content === "string" ? m.content : flattenParts(m.content),
        });
    }

    return out;
}

function flattenParts(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
            .join("")
            .trim();
    }
    return "";
}
