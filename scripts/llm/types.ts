// The one place a model provider is named. Everything above this file (souls,
// tasks, chat, tools, policies) is provider-agnostic on purpose: the only thing
// that changes between OpenAI, a gateway, Ollama, or an Anthropic shim is which
// adapter runs here.

export type ChatRole = "system" | "user" | "assistant";

export type TextPart = { type: "text"; text: string };

export type ChatMessage = {
    role: ChatRole;
    content: string | TextPart[];
    /** Present when this message is the model's own prior tool request. */
    toolCalls?: ToolCall[];
    /** Present when this message is a tool result being fed back. */
    toolCallId?: string;
};

export type ToolCall = {
    id: string;
    name: string;
    /** Already JSON-parsed. Adapters are responsible for not handing back raw strings. */
    args: Record<string, unknown>;
};

export type ToolSchema = {
    name: string;
    description: string;
    /** JSON Schema for the arguments object. */
    parameters: Record<string, unknown>;
};

export type ChatRequest = {
    system: string;
    messages: ChatMessage[];
    tools?: ToolSchema[];
    maxTokens?: number;
    temperature?: number;
};

export type ChatResponse = {
    /** Assistant prose. Empty string when the model only asked for tools. */
    text: string;
    toolCalls: ToolCall[];
    /**
     * Why the model stopped. "tool_calls" and "stop" are the two the runner acts
     * on; "length" means we truncated mid-thought and should not trust the reply.
     */
    stopReason: "stop" | "tool_calls" | "length" | "content_filter" | "unknown";
    usage?: { inputTokens?: number; outputTokens?: number };
    /** Raw provider payload, for debugging a runner that misbehaves. */
    raw?: unknown;
};

export interface LlmProvider {
    /** Human-readable identifier used in logs and `npm run doctor`. */
    readonly id: string;
    /** The concrete model string sent on the wire. */
    readonly model: string;
    chat(req: ChatRequest): Promise<ChatResponse>;
}

export class LlmError extends Error {
    constructor(
        message: string,
        readonly kind:
            | "auth"
            | "model_not_found"
            | "rate_limit"
            | "context_length"
            | "network"
            | "bad_response"
            | "unknown",
        readonly raw?: unknown,
    ) {
        super(message);
        this.name = "LlmError";
    }
}

/** Maps a provider error body onto the kinds the runner can actually react to. */
export function classifyHttpError(status: number, body: any): LlmError {
    const msg: string =
        body?.error?.message ?? body?.message ?? (typeof body === "string" ? body : JSON.stringify(body ?? {}));
    const code: string = body?.error?.code ?? body?.error?.type ?? "";

    if (status === 401 || status === 403) return new LlmError(msg, "auth", body);
    if (status === 404 || code === "model_not_found") return new LlmError(msg, "model_not_found", body);
    if (status === 429) return new LlmError(msg, "rate_limit", body);
    if (/context|too many tokens|maximum context/i.test(msg) || code === "context_length_exceeded") {
        return new LlmError(msg, "context_length", body);
    }
    if (status >= 500) return new LlmError(msg, "network", body);
    return new LlmError(msg, "unknown", body);
}
