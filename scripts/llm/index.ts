// Provider selection. One switch, driven by fleet.yml with env vars as overrides
// so CI and Docker can set a model without editing files.

import { LlmProvider } from "./types.js";
import { OpenAICompatibleProvider, OpenAICompatibleOptions } from "./openai-compatible.js";
import { AnthropicProvider } from "./anthropic.js";
import { loadFleetConfig, LlmConfig } from "../fleet-config.js";

export * from "./types.js";

export type ProviderResolution = {
    provider: LlmProvider;
    /** Where the settings came from, for `npm run doctor` output. */
    source: "fleet.yml" | "env" | "mixed";
    warnings: string[];
};

/**
 * Known-host shortcuts. A forker who writes `provider: openai` gets the right
 * base URL without having to look it up; anyone else sets baseUrl explicitly.
 */
const KNOWN_BASE_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    groq: "https://api.groq.com/openai/v1",
    together: "https://api.together.xyz/v1",
    fireworks: "https://api.fireworks.ai/inference/v1",
    deepseek: "https://api.deepseek.com/v1",
    ollama: "http://localhost:11434/v1",
    lmstudio: "http://localhost:1234/v1",
    vllm: "http://localhost:8000/v1",
};

const ENV_KEY_BY_PROVIDER: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    groq: "GROQ_API_KEY",
    together: "TOGETHER_API_KEY",
    fireworks: "FIREWORKS_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    ollama: "",
    lmstudio: "",
    vllm: "",
};

/** Post-validation shape: model is required, baseUrl is required except for anthropic. */
export type ResolvedLlmConfig = LlmConfig & { model: string; provider: string };

export function resolveLlmConfig(cfg?: LlmConfig): {
    llm: ResolvedLlmConfig;
    source: "fleet.yml" | "env" | "mixed";
    warnings: string[];
} {
    const warnings: string[] = [];
    const fromFile = cfg ?? loadFleetConfig().llm ?? {};

    // Env wins over the file: that is what makes Docker and CI workable.
    const envProvider = process.env.LLM_PROVIDER?.trim();
    const envModel = process.env.LLM_MODEL?.trim() || process.env.OPENAI_MODEL?.trim();
    const envBaseUrl = process.env.LLM_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim();

    const providerName = (envProvider || fromFile.provider || "openai-compatible").toLowerCase();
    const model = envModel || fromFile.model || "";
    const baseUrl = envBaseUrl || fromFile.baseUrl || KNOWN_BASE_URLS[providerName] || "";

    let source: "fleet.yml" | "env" | "mixed" = "fleet.yml";
    if (envProvider || envModel || envBaseUrl) {
        source = fromFile.provider || fromFile.model || fromFile.baseUrl ? "mixed" : "env";
    }

    if (!model) {
        throw new Error(
            "No model configured. Set llm.model in fleet.yml, or export LLM_MODEL / OPENAI_MODEL.\n" +
                "Example: LLM_MODEL=llama3.1:8b LLM_PROVIDER=ollama",
        );
    }

    if (providerName !== "anthropic" && !baseUrl) {
        throw new Error(
            `Unknown provider '${providerName}' and no baseUrl set.\n` +
                `Known: ${Object.keys(KNOWN_BASE_URLS).join(", ")}, anthropic, openai-compatible.\n` +
                "Or set llm.baseUrl in fleet.yml to any OpenAI-compatible endpoint.",
        );
    }

    // Key resolution. `openai-compatible` is not a vendor, so there is no single
    // env var for it: it could be a gateway, a proxy, or a local server. Try the
    // specific provider first, then the generic names, then the file.
    //
    // This used to look up ENV_KEY_BY_PROVIDER[providerName] and fall back to
    // LLM_API_KEY only, so setting OPENAI_API_KEY with provider=openai-compatible
    // silently produced an empty key and a 401 from the gateway.
    const specific = ENV_KEY_BY_PROVIDER[providerName];
    const candidates = [
        specific,
        "LLM_API_KEY",
        // A generic fallback worth having: most people with one key for an
        // OpenAI-shaped endpoint set it as OPENAI_API_KEY whatever the host is.
        "OPENAI_API_KEY",
    ].filter((v): v is string => Boolean(v));

    let apiKey = "";
    for (const envVar of candidates) {
        const v = process.env[envVar]?.trim();
        if (v) {
            apiKey = v;
            break;
        }
    }
    if (!apiKey) apiKey = (fromFile.apiKey ?? "").trim();

    // Local servers legitimately need no key; hosted ones do. Warn rather than throw
    // so a forker sees the problem in doctor output instead of a wall of 401s.
    const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal/.test(baseUrl);
    if (!apiKey && providerName !== "anthropic" && !isLocal) {
        warnings.push(`No API key found for ${providerName}. Tried ${candidates.join(", ")} and llm.apiKey in fleet.yml.`);
    }

    return {
        llm: {
            provider: providerName,
            model,
            baseUrl,
            apiKey,
            temperature: fromFile.temperature,
            maxTokens: fromFile.maxTokens,
            timeoutMs: fromFile.timeoutMs,
            extraHeaders: fromFile.extraHeaders,
        },
        source,
        warnings,
    };
}

export function createProvider(cfg?: LlmConfig): ProviderResolution {
    const { llm, source, warnings } = resolveLlmConfig(cfg);

    if (llm.provider === "anthropic") {
        return {
            provider: new AnthropicProvider({
                apiKey: llm.apiKey ?? "",
                model: llm.model,
                baseUrl: llm.baseUrl || "https://api.anthropic.com",
                timeoutMs: llm.timeoutMs,
            }),
            source,
            warnings,
        };
    }

    const opts: OpenAICompatibleOptions = {
        baseUrl: llm.baseUrl ?? KNOWN_BASE_URLS[llm.provider] ?? "",
        apiKey: llm.apiKey,
        model: llm.model,
        extraHeaders: llm.extraHeaders,
        timeoutMs: llm.timeoutMs,
    };

    return { provider: new OpenAICompatibleProvider(opts), source, warnings };
}
