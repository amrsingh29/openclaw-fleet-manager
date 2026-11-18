// npm run doctor — checks a fresh clone is actually usable, in the order things
// break. Prints a pass/fail per stage and exits non-zero on failure so CI and a
// nervous forker get the same answer.
//
// The tool-calling check matters most: a model that cannot emit a real tool call
// will look fine in chat and do nothing on a task, which is the worst failure
// mode to debug blind.

import * as fs from "fs";
import * as os from "os";
import * as dotenv from "dotenv";
import { createProvider, LlmError } from "./llm/index.js";
import { loadFleetConfig, findConfigFile, listServiceNames, repoRoot } from "./fleet-config.js";
import { defaultRegistry } from "./tools/registry.js";
import { runTurn } from "./agent-turn.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

type CheckResult = { name: string; ok: boolean; detail: string; fatal?: boolean };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string, fatal = false) {
    results.push({ name, ok, detail, fatal });
    const mark = ok ? "\x1b[32m✓\x1b[0m" : fatal ? "\x1b[31m✗\x1b[0m" : "\x1b[33m!\x1b[0m";
    console.log(`${mark} ${name}`);
    console.log(`    ${detail.split("\n").join("\n    ")}`);
}

async function main() {
    console.log("\nOpenClaw Fleet Manager — doctor\n");

    // 1. Node version
    const major = Number(process.version.replace(/^v/, "").split(".")[0]);
    record(
        "Node version",
        major >= 18,
        `${process.version}${major >= 18 ? "" : " — need v18 or newer"}`,
        true,
    );

    // 2. fleet.yml
    const configFile = findConfigFile();
    let cfg = null as ReturnType<typeof loadFleetConfig> | null;
    try {
        cfg = loadFleetConfig({ force: true });
        const services = listServiceNames();
        record(
            "fleet.yml",
            true,
            configFile
                ? `${configFile.replace(repoRoot() + "/", "")} loaded; ${services.length} service(s): ${services.join(", ") || "(none)"}`
                : "no fleet.yml found — running on defaults, agents have no services to act on",
        );
    } catch (err: any) {
        record("fleet.yml", false, err.message, true);
    }

    // 3. Model provider configured
    let provider;
    try {
        const resolved = createProvider();
        provider = resolved.provider;
        const warnings = resolved.warnings.length ? `\n${resolved.warnings.join("\n")}` : "";
        record(
            "Model provider",
            true,
            `provider=${resolved.provider.id} model=${resolved.provider.model} (from ${resolved.source})${warnings}`,
        );
    } catch (err: any) {
        record("Model provider", false, err.message, true);
        finish();
        return;
    }

    // 4. Model responds at all
    try {
        const res = await provider.chat({
            system: "You are a health check. Reply with exactly: OK",
            messages: [{ role: "user", content: "Reply with exactly: OK" }],
            maxTokens: 16,
            temperature: 0,
        });
        const sawOk = /ok/i.test(res.text);
        record(
            "Model replies",
            sawOk,
            sawOk
                ? `got "${res.text.trim().slice(0, 60)}"`
                : `model replied but not as asked: "${res.text.trim().slice(0, 120) || "(empty)"}"`,
            false,
        );
    } catch (err: any) {
        record("Model replies", false, describeLlmError(err), true);
        finish();
        return;
    }

    // 5. Model supports tool calling — the check that saves an evening
    try {
        const registry = defaultRegistry;
        const turn = await runTurn({
            provider,
            registry,
            system:
                "You are a health check. Call the check_server_health tool exactly once for the service 'this-host', " +
                "then report what you found in one sentence.",
            messages: [{ role: "user", content: "Check the health of service 'this-host'." }],
            allowTools: ["check_server_health"],
            maxRounds: 3,
            maxTokens: 512,
            temperature: 0,
        });

        if (turn.tools.length === 0) {
            record(
                "Tool calling",
                false,
                `The model answered without calling a tool.\n` +
                    `Most likely cause: ${provider.model} does not support tool calling, or ignores tool definitions.\n` +
                    `Switch to a model that does (GPT-4o, Claude, Llama 3.1+, Qwen 2.5+), or answer chat only.`,
                true,
            );
        } else {
            const first = turn.tools[0];
            record(
                "Tool calling",
                first.result.ok,
                `called ${first.tool}(${JSON.stringify(first.args)}) in ${first.elapsedMs}ms\n` +
                    `result: ${first.result.output.split("\n").slice(0, 4).join("\n")}`,
                false,
            );
            if (turn.endedBecause === "max_rounds") {
                record("Tool loop termination", false, "model kept calling tools past the round cap", false);
            }
        }
    } catch (err: any) {
        record("Tool calling", false, describeLlmError(err), false);
    }

    // 6. Convex reachable
    const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
    if (!convexUrl) {
        record("Convex", false, "CONVEX_URL not set — run `npm run setup`", true);
    } else {
        try {
            const res = await fetch(`${convexUrl.replace(/\/$/, "")}/version`, {
                signal: AbortSignal.timeout(5000),
            });
            record("Convex", res.ok, `${convexUrl} responded ${res.status}`, true);
        } catch (err: any) {
            record("Convex", false, `cannot reach ${convexUrl}: ${err.message}`, true);
        }
    }

    // 7. Every configured log path exists (warning only: logs may not exist yet)
    if (cfg?.services?.length) {
        const missing: string[] = [];
        for (const s of cfg.services) {
            for (const p of s.logPaths ?? []) {
                const abs = p.startsWith("/") ? p : `${repoRoot()}/${p}`;
                if (!fs.existsSync(abs)) missing.push(`${s.name}: ${p}`);
            }
        }
        record(
            "Log paths",
            missing.length === 0,
            missing.length ? `not present yet:\n${missing.join("\n")}` : "all configured log paths exist",
        );
    }

    finish();
}

function describeLlmError(err: any): string {
    if (err instanceof LlmError) {
        switch (err.kind) {
            case "auth":
                return `Authentication failed. Check your API key. (${err.message})`;
            case "model_not_found":
                return `Model "not found". Check LLM_MODEL / fleet.yml llm.model against what the provider serves.`;
            case "rate_limit":
                return `Rate limited. Wait, or use a smaller model. (${err.message})`;
            case "context_length":
                return `Prompt too long for this model. (${err.message})`;
            case "network":
                return `Cannot reach the provider. Check LLM_BASE_URL and your network. (${err.message})`;
            default:
                return err.message;
        }
    }
    return err?.message ?? String(err);
}

function finish() {
    const failed = results.filter((r) => !r.ok && r.fatal);
    const warned = results.filter((r) => !r.ok && !r.fatal);

    console.log("");
    if (failed.length) {
        console.log(`\x1b[31m${failed.length} blocking problem(s):\x1b[0m ${failed.map((f) => f.name).join(", ")}`);
        console.log("Fix those before starting the runner.\n");
        process.exit(1);
    }
    if (warned.length) {
        console.log(`\x1b[33m${warned.length} warning(s):\x1b[0m ${warned.map((w) => w.name).join(", ")}`);
    }
    console.log("\x1b[32mReady.\x1b[0m Start the fleet with: npm run setup && npm run dev\n");
}

main().catch((err) => {
    console.error("\nDoctor crashed:", err?.message ?? err);
    process.exit(1);
});
