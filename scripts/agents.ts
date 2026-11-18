// npm run agents — every runner, without the dashboard or Convex front-end.
//
// The dashboard is optional; the agents are not. Useful on a headless box, or when
// you already have `npm run convex` and `npm run ui` in other terminals.
//
//   npm run agents                 # all souls
//   npm run agents -- jarvis shuri # only these

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { repoRoot } from "./fleet-config.js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const children: ChildProcess[] = [];
const colours = [33, 34, 32, 35, 31, 96];

function prefix(name: string, colour: number): (line: string) => void {
    const padded = name.padEnd(8).slice(0, 8);
    return (line: string) => {
        for (const l of line.split("\n")) {
            if (l.trim()) process.stdout.write(`\x1b[${colour}m${padded}\x1b[0m | ${l}\n`);
        }
    };
}

function main() {
    if (!process.env.CONVEX_URL && !process.env.VITE_CONVEX_URL) {
        console.error("CONVEX_URL not set. Run `npm run setup` first.");
        process.exit(1);
    }

    const configDir = path.join(repoRoot(), "agents", "configs");
    if (!fs.existsSync(configDir)) {
        console.error(`No soul directory at ${configDir}`);
        process.exit(1);
    }

    const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
    const all = fs
        .readdirSync(configDir)
        .filter((f) => f.endsWith(".soul.md") && f !== "template.soul.md")
        .map((f) => f.replace(".soul.md", ""));

    const chosen = requested.length
        ? all.filter((n) => requested.some((r) => r.toLowerCase() === n.toLowerCase()))
        : all;

    if (!chosen.length) {
        console.error(`No matching souls. Available: ${all.join(", ")}`);
        process.exit(1);
    }

    console.log(`Starting ${chosen.length} agent(s): ${chosen.join(", ")}\n`);

    chosen.forEach((name, i) => {
        const child = spawn(
            "npx",
            ["tsx", "scripts/agent-runner.ts", `--config=agents/configs/${name}.soul.md`],
            { cwd: repoRoot(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
        );
        const out = prefix(name, colours[i % colours.length]);
        child.stdout?.on("data", (b: Buffer) => out(b.toString()));
        child.stderr?.on("data", (b: Buffer) => out(b.toString()));
        child.on("exit", (code) => out(`exited (${code})`));
        children.push(child);
    });
}

function shutdown() {
    for (const c of children) {
        try {
            c.kill("SIGTERM");
        } catch {
            /* already gone */
        }
    }
    setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
