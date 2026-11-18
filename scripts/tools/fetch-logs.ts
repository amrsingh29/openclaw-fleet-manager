// Tail a real log file. Clamped line count, clamped byte window, and the path
// must come from fleet.yml — the model names a service, never a path.

import * as fs from "fs";
import { FleetTool, ToolArgumentError, ToolResult, requireString } from "./types.js";
import { run } from "./exec.js";
import { findService, getTarget, resolveLogPath, TargetConfig } from "../fleet-config.js";

const MAX_LINES = 200;
const DEFAULT_LINES = 50;
const MAX_BYTES = 256 * 1024;

export const fetchLatestLogs: FleetTool = {
    name: "fetch_latest_logs",
    description:
        "Returns the most recent lines from a service's log file, as declared in fleet.yml. Read-only.",
    effect: "read",
    actionType: "read_logs",
    parameters: {
        type: "object",
        properties: {
            service: { type: "string", description: "Service name as declared in fleet.yml." },
            lines: {
                type: "number",
                description: `How many trailing lines to return (1-${MAX_LINES}). Defaults to ${DEFAULT_LINES}.`,
            },
        },
        required: ["service"],
    },

    validate(args) {
        const service = requireString(args, "service", "a service name from fleet.yml");
        let lines = DEFAULT_LINES;
        if (args.lines !== undefined) {
            const n = Number(args.lines);
            if (!Number.isFinite(n) || n < 1) throw new ToolArgumentError("'lines' must be a positive number.");
            lines = Math.min(Math.floor(n), MAX_LINES);
        }
        return { service, lines };
    },

    async execute(args): Promise<ToolResult> {
        const serviceName = String(args.service);
        const lines = Number(args.lines) || DEFAULT_LINES;

        const service = findService(serviceName);
        if (!service) {
            return { ok: false, output: `Unknown service '${serviceName}'. It is not declared in fleet.yml.` };
        }

        const paths = service.logPaths ?? [];
        if (!paths.length) {
            return {
                ok: false,
                output:
                    `No logPaths configured for '${serviceName}'. ` +
                    "Ask the commander to add logPaths to this service in fleet.yml.",
            };
        }

        const target = getTarget(service.target);

        try {
            if (target.kind === "ssh") {
                return await tailSsh(serviceName, paths, lines, target);
            }
            if (target.kind === "docker") {
                return await tailDocker(serviceName, lines, target, service.restart?.unit ?? serviceName);
            }
            return tailLocal(serviceName, paths, lines);
        } catch (err: any) {
            return { ok: false, output: `Could not read logs for '${serviceName}': ${err.message}` };
        }
    },
};

function tailLocal(serviceName: string, paths: string[], lines: number): ToolResult {
    const chunks: string[] = [];
    const missing: string[] = [];

    for (const raw of paths) {
        const resolved = resolveLogPath(raw);
        if (!fs.existsSync(resolved)) {
            missing.push(resolved);
            continue;
        }
        const text = readTail(resolved, lines);
        chunks.push(`--- ${resolved} ---\n${text}`);
    }

    if (!chunks.length) {
        return {
            ok: false,
            output:
                `None of the configured log files exist for '${serviceName}':\n` +
                missing.map((m) => `  ${m}`).join("\n") +
                "\nThe service may not have written to these paths yet.",
        };
    }

    let out = chunks.join("\n\n");
    if (missing.length) out += `\n\n(also configured, not present: ${missing.join(", ")})`;
    return { ok: true, output: truncate(out), meta: { files: chunks.length } };
}

/** Reads the last N lines without loading a multi-GB log into memory. */
function readTail(file: string, lines: number): string {
    const stat = fs.statSync(file);
    const windowSize = Math.min(stat.size, MAX_BYTES);
    const start = stat.size - windowSize;

    const fd = fs.openSync(file, "r");
    try {
        const buffer = Buffer.alloc(windowSize);
        fs.readSync(fd, buffer, 0, windowSize, start);
        let text = buffer.toString("utf-8");
        // Drop a partial first line when we started mid-file.
        if (start > 0) {
            const nl = text.indexOf("\n");
            if (nl >= 0) text = text.slice(nl + 1);
        }
        const all = text.split("\n").filter((l) => l.length > 0);
        return all.slice(-lines).join("\n");
    } finally {
        fs.closeSync(fd);
    }
}

async function tailSsh(serviceName: string, paths: string[], lines: number, target: TargetConfig): Promise<ToolResult> {
    // tail -n is the same on every Linux/macOS, so one round trip covers all paths.
    const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8"];
    if (target.port) args.push("-p", String(target.port));
    if (target.keyPath) args.push("-i", target.keyPath);
    args.push(target.user ? `${target.user}@${target.host}` : String(target.host));

    const quoted = paths.map((p) => `'${p.replace(/'/g, `'\\''`)}'`).join(" ");
    args.push(`tail -n ${lines} ${quoted} 2>&1`);

    const r = await run("ssh", args, { timeoutMs: 15000 });
    if (r.missing) return { ok: false, output: "ssh is not installed on this machine." };
    if (!r.ok && !r.stdout) {
        return { ok: false, output: `ssh to ${target.host} failed: ${r.stderr.trim() || `exit ${r.code}`}` };
    }
    return { ok: true, output: truncate(r.stdout.trim() || "(no output)"), meta: { target: "ssh" } };
}

async function tailDocker(
    serviceName: string,
    lines: number,
    target: TargetConfig,
    container: string,
): Promise<ToolResult> {
    const r = await run("docker", ["logs", "--tail", String(lines), target.container ?? container], { timeoutMs: 20000 });
    if (r.missing) return { ok: false, output: "docker is not installed on this machine." };
    if (!r.ok && !r.stdout && !r.stderr) {
        return { ok: false, output: `docker logs failed: ${r.stderr.trim() || `exit ${r.code}`}` };
    }
    const out = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
    return { ok: true, output: truncate(out || "(no output)"), meta: { target: "docker" } };
}

function truncate(text: string): string {
    const MAX_CHARS = 12_000;
    if (text.length <= MAX_CHARS) return text;
    // Keep the tail: recent lines matter more than old ones.
    return `(truncated to last ${MAX_CHARS} chars)\n${text.slice(-MAX_CHARS)}`;
}
