// npm run setup — makes a fresh clone bootable.
//
// Deliberately boring: creates .env from the example if missing, starts an
// anonymous local Convex deployment, seeds teams/agents, and stamps the orgId
// that every query filters on. The last step is the one that used to leave a
// seeded database rendering as an empty fleet.

import { execFile, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { repoRoot } from "./fleet-config.js";

const execFileAsync = promisify(execFile);

function log(msg: string) {
    console.log(msg);
}
function step(msg: string) {
    console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
}
function ok(msg: string) {
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function warn(msg: string) {
    console.log(`  \x1b[33m!\x1b[0m ${msg}`);
}

async function main() {
    const root = repoRoot();
    process.chdir(root);

    log("\nOpenClaw Fleet Manager — setup\n");

    // 1. Node version
    step("Checking Node");
    const major = Number(process.version.replace(/^v/, "").split(".")[0]);
    if (major < 18) {
        console.error(`  ✗ Node ${process.version} is too old. Need v18 or newer.`);
        process.exit(1);
    }
    ok(`Node ${process.version}`);

    // 2. .env
    step("Checking environment file");
    const envPath = path.join(root, ".env");
    const examplePath = path.join(root, ".env.example");
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(examplePath)) {
            fs.copyFileSync(examplePath, envPath);
            ok("Created .env from .env.example — edit it to set your model provider");
        } else {
            fs.writeFileSync(envPath, "# Add your model provider settings here\n");
            warn("Created an empty .env — you will need to set a model provider");
        }
    } else {
        ok(".env exists");
    }

    dotenv.config({ path: envPath });
    dotenv.config({ path: path.join(root, ".env.local"), override: true });

    if (!process.env.OPENAI_API_KEY && !process.env.LLM_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        warn(
            "No model API key found in .env.\n" +
                "    Set one of OPENAI_API_KEY / ANTHROPIC_API_KEY / LLM_API_KEY,\n" +
                "    or use a local model: LLM_PROVIDER=ollama LLM_MODEL=llama3.1:8b",
        );
    }

    // 3. fleet.yml
    step("Checking fleet configuration");
    const fleetPath = ["fleet.yml", "fleet.yaml", "fleet.local.yml"].map((f) => path.join(root, f)).find((p) => fs.existsSync(p));
    if (fleetPath) {
        ok(`${path.basename(fleetPath)} found`);
    } else {
        warn("No fleet.yml — agents will have no services to act on. See fleet.yml in the repo root for the format.");
    }

    // 4. Local Convex deployment
    step("Starting local Convex deployment");
    const hasConvexUrl = Boolean(process.env.CONVEX_URL || process.env.VITE_CONVEX_URL);
    const deploymentSet = Boolean(process.env.CONVEX_DEPLOYMENT);

    if (deploymentSet && hasConvexUrl) {
        ok(`Already configured: ${process.env.CONVEX_DEPLOYMENT} at ${process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL}`);
    } else {
        log("  Provisioning an anonymous local deployment (no Convex account needed)...");
        try {
            // --once runs codegen + push and exits, unlike `convex dev` which watches.
            await execFileAsync(
                "npx",
                ["convex", "dev", "--configure", "new", "--dev-deployment", "local", "--once"],
                {
                    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
                    timeout: 300_000,
                },
            );
            ok("Deployment created; settings written to .env.local");
        } catch (err: any) {
            warn(`Automatic provisioning failed: ${(err.stderr ?? err.message ?? "").split("\n")[0]}`);
            warn("Run this yourself, then re-run setup:\n\n    CONVEX_AGENT_MODE=anonymous npx convex dev\n");
            process.exit(1);
        }

        // Re-read what convex wrote.
        dotenv.config({ path: path.join(root, ".env.local"), override: true });
        if (process.env.CONVEX_URL && !process.env.CONVEX_DEPLOYMENT) {
            warn("CONVEX_DEPLOYMENT missing from .env.local; check the convex output above");
        }
    }

    // 5. App-level env vars (the UIs and runner each read a different name)
    step("Wiring app environment");
    const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
    if (!convexUrl) {
        warn("Still no CONVEX_URL. Cannot continue.");
        process.exit(1);
    }

    const ensureLine = (file: string, key: string, value: string) => {
        const p = path.join(root, file);
        let content = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
        const re = new RegExp(`^${key}=.*$`, "m");
        if (re.test(content)) {
            content = content.replace(re, `${key}=${value}`);
        } else {
            content = `${content.trimEnd()}\n${key}=${value}\n`.trimStart();
        }
        fs.writeFileSync(p, content);
    };

    const appEnv = path.join(root, ".env");
    let envContent = fs.readFileSync(appEnv, "utf-8");
    for (const [key, value] of Object.entries({
        CONVEX_URL: convexUrl,
        VITE_CONVEX_URL: convexUrl,
    })) {
        const re = new RegExp(`^${key}=.*$`, "m");
        envContent = re.test(envContent)
            ? envContent.replace(re, `${key}=${value}`)
            : `${envContent.trimEnd()}\n${key}=${value}\n`;
    }
    fs.writeFileSync(appEnv, envContent);
    ok(`.env points at ${convexUrl}`);

    // The v1 dashboard reads VITE_CONVEX_URL from its own directory.
    const dashEnv = path.join(root, "mission-control-dashboard", ".env.local");
    if (fs.existsSync(path.dirname(dashEnv))) {
        ensureLine("mission-control-dashboard/.env.local", "VITE_CONVEX_URL", convexUrl);
        ok("mission-control-dashboard/.env.local written");
    }

    // v2 is a Next app and reads NEXT_PUBLIC_CONVEX_URL.
    const v2Env = path.join(root, "mission-control-v2", ".env.local");
    if (fs.existsSync(path.dirname(v2Env))) {
        ensureLine("mission-control-v2/.env.local", "NEXT_PUBLIC_CONVEX_URL", convexUrl);
        ok("mission-control-v2/.env.local written");
    }

    // 6. Seed. These need a running backend, so start one, seed, then stop it.
    step("Seeding teams, agents and policies");
    const backend = spawn(
        "npx",
        ["convex", "dev"],
        { env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" }, stdio: "pipe" },
    );

    const ready = await waitForReady(backend, 120_000);
    if (!ready) {
        backend.kill();
        warn("Convex backend did not report ready within 120s. Run `npm run convex` in another terminal, then `npm run seed`.");
        process.exit(1);
    }
    ok("Backend ready");

    for (const fn of ["seed:populate", "init:setupEnterprise", "maintenance:repair"]) {
        try {
            const { stdout } = await execFileAsync("npx", ["convex", "run", fn], {
                env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
                timeout: 60_000,
            });
            // Convex prints a JSON result, which may span lines. Take the last
            // meaningful line but keep it readable rather than showing a brace.
            const lines = stdout
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l && !l.includes("DeprecationWarning") && l !== "{" && l !== "}" && l !== "}");
            const summary = lines[lines.length - 1] ?? "done";
            ok(`${fn} → ${summary.length > 110 ? summary.slice(0, 110) + "…" : summary}`);
        } catch (err: any) {
            warn(`${fn} failed: ${(err.stderr ?? err.message ?? "").split("\n")[0]}`);
        }
    }

    backend.kill();

    // 7. Done
    log("\n\x1b[32mSetup complete.\x1b[0m\n");
    log("Next:");
    log("  1. npm run doctor          — verify the model can actually call tools");
    log("  2. npm run dev             — start Convex + dashboard + agents\n");
    log("Or start pieces separately: npm run convex | npm run ui | npm run agent -- --config=agents/configs/jarvis.soul.md\n");
}

/** Waits for the convex dev process to print its ready line. */
function waitForReady(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const done = (v: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(v);
        };

        const timer = setTimeout(() => done(false), timeoutMs);

        const onData = (buf: Buffer) => {
            const text = buf.toString();
            // "Convex functions ready" is the deploy signal; "Started running a
            // deployment" means the binary is up but functions are not yet pushed.
            if (/Convex functions ready/i.test(text)) done(true);
        };

        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);
        child.on("exit", () => done(false));
        child.on("error", () => done(false));
    });
}

main().catch((err) => {
    console.error("\nSetup failed:", err?.message ?? err);
    process.exit(1);
});
