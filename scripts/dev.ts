// npm run dev — brings up the whole stack in one terminal: Convex, the dashboard,
// and every agent soul it can find. Ctrl-C stops all of it.
//
// This exists because the README asks for three terminals plus one per agent,
// which is the point where a curious forker gives up.

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { repoRoot } from "./fleet-config.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const children: ChildProcess[] = [];

function prefix(name: string, colour: number): (line: string) => void {
    const padded = name.padEnd(8).slice(0, 8);
    return (line: string) => {
        for (const l of line.split("\n")) {
            if (l.trim()) process.stdout.write(`\x1b[${colour}m${padded}\x1b[0m │ ${l}\n`);
        }
    };
}

function start(name: string, cmd: string, args: string[], colour: number, cwd = repoRoot()): ChildProcess {
    const out = prefix(name, colour);
    const child = spawn(cmd, args, {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
    });
    child.stdout?.on("data", (b: Buffer) => out(b.toString()));
    child.stderr?.on("data", (b: Buffer) => out(b.toString()));
    child.on("exit", (code) => out(`exited (${code})`));
    children.push(child);
    return child;
}

async function main() {
    if (!process.env.CONVEX_URL && !process.env.VITE_CONVEX_URL) {
        console.error("CONVEX_URL not set. Run `npm run setup` first.");
        process.exit(1);
    }

    console.log("Starting OpenClaw Fleet Manager. Ctrl-C stops everything.\n");

    // 1. Convex backend.
    start("convex", "npx", ["convex", "dev"], 36);

    // Give it a moment to claim the port before the UIs try to subscribe.
    await new Promise((r) => setTimeout(r, 4000));

    // 2. Dashboard v1 (Vite). Skipped if deps are missing so a fresh clone still
    //    gets agents running rather than failing on a missing node_modules.
    const dashDir = path.join(repoRoot(), "mission-control-dashboard");
    if (fs.existsSync(path.join(dashDir, "node_modules"))) {
        start("ui", "npm", ["run", "dev"], 35, dashDir);
    } else {
        console.log("\x1b[33mui      \x1b[0m │ skipped: run `npm --prefix mission-control-dashboard install` to enable");
    }

    // 3. Every soul file gets a runner.
    const configDir = path.join(repoRoot(), "agents", "configs");
    const souls = fs.existsSync(configDir)
        ? fs.readdirSync(configDir).filter((f) => f.endsWith(".soul.md") && f !== "template.soul.md")
        : [];

    if (!souls.length) {
        console.log("\x1b[33magent   \x1b[0m │ no soul files in agents/configs/");
    }

    const colours = [33, 34, 32, 35, 31, 96];
    souls.forEach((soul, i) => {
        const name = soul.replace(".soul.md", "");
        start(name, "npx", ["tsx", "scripts/agent-runner.ts", `--config=agents/configs/${soul}`], colours[i % colours.length]);
    });

    console.log(`\n${souls.length} agent(s) starting: ${souls.map((s) => s.replace(".soul.md", "")).join(", ")}\n`);
}

function shutdown() {
    console.log("\nShutting down...");
    for (const c of children) {
        try {
            c.kill("SIGTERM");
        } catch {
            /* already gone */
        }
    }
    setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
    console.error("dev failed:", err?.message ?? err);
    shutdown();
});
