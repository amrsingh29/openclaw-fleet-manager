// Real host metrics. On the local target this reads this machine; over ssh it
// runs one batched probe; on docker it asks the container. The model gets the
// same shape of answer either way, which is what keeps the soul prompts honest.

import * as os from "os";
import * as fs from "fs";
import { FleetTool, ToolContext, ToolResult, requireString } from "./types.js";
import { run, runText } from "./exec.js";
import { findService, getTarget, TargetConfig } from "../fleet-config.js";

export const checkServerHealth: FleetTool = {
    name: "check_server_health",
    description:
        "Reports CPU, memory, disk and uptime for a host, plus whether a named service is running. " +
        "Read-only. Use it before deciding whether a service needs attention.",
    effect: "read",
    actionType: "read_metrics",
    parameters: {
        type: "object",
        properties: {
            service: {
                type: "string",
                description: "Service name as declared in fleet.yml. Determines which host to inspect.",
            },
        },
        required: ["service"],
    },

    validate(args) {
        return { service: requireString(args, "service", "a service name from fleet.yml") };
    },

    async execute(args, ctx): Promise<ToolResult> {
        const name = String(args.service);
        const service = findService(name);
        if (!service) {
            return {
                ok: false,
                output:
                    `Unknown service '${name}'. The operator has declared: ` +
                    `${(require("../fleet-config.js").listServiceNames() as string[]).join(", ") || "(none)"}. ` +
                    "Do not guess hostnames; ask the commander to add it to fleet.yml.",
            };
        }

        const target = getTarget(service.target);

        try {
            const health = await probeHost(target);
            const serviceState = await probeService(service, target);

            const lines = [
                `Host: ${health.host} (${target.kind})`,
                `Uptime: ${health.uptime}`,
                `Load: ${health.load}`,
                `CPU cores: ${health.cores}`,
                `Memory: ${health.memory}`,
                `Disk: ${health.disk}`,
                `Service ${name}: ${serviceState}`,
            ];
            if (service.healthUrl) {
                lines.push(`Health endpoint: ${await probeUrl(service.healthUrl)}`);
            }

            return {
                ok: true,
                output: lines.join("\n"),
                meta: { target: target.kind, host: health.host },
            };
        } catch (err: any) {
            return { ok: false, output: `Health check failed for '${name}': ${err.message}` };
        }
    },
};

type HostHealth = {
    host: string;
    uptime: string;
    load: string;
    cores: number;
    memory: string;
    disk: string;
};

async function probeHost(target: TargetConfig): Promise<HostHealth> {
    if (target.kind === "local") return probeLocal();
    if (target.kind === "docker") return probeDocker(target);
    return probeSsh(target);
}

function probeLocal(): HostHealth {
    const load = os.loadavg();
    const total = os.totalmem();
    const free = os.freemem();
    const usedPct = Math.round(((total - free) / total) * 100);

    let disk = "unknown";
    try {
        // node has no statfs binding, so shell out read-only via df with an argv.
        const df = require("child_process").execFileSync("df", ["-h", "/"], { encoding: "utf-8", timeout: 5000 });
        const row = df.trim().split("\n")[1];
        if (row) {
            const cols = row.split(/\s+/);
            // macOS: Filesystem Size Used Avail Capacity ...; Linux similar enough.
            disk = `${cols[2]} used of ${cols[1]} (${cols[4] ?? cols[3]})`;
        }
    } catch {
        /* df missing or unusual layout; report unknown rather than lie */
    }

    return {
        host: os.hostname(),
        uptime: formatUptime(os.uptime()),
        load: `${load[0].toFixed(2)} / ${load[1].toFixed(2)} / ${load[2].toFixed(2)} (1/5/15m)`,
        cores: os.cpus().length,
        memory: `${gb(total - free)} used of ${gb(total)} (${usedPct}%)`,
        disk,
    };
}

async function probeSsh(target: TargetConfig): Promise<HostHealth> {
    // One round trip, not six: ssh setup dominates the cost.
    const remote = "uptime; nproc; free -m 2>/dev/null || vm_stat; df -h / | tail -1; hostname";
    const r = await run("ssh", sshArgs(target, [remote]), { timeoutMs: 15000 });
    if (r.missing) throw new Error("ssh is not installed on this machine");
    if (!r.ok) throw new Error(`ssh to ${target.host} failed: ${r.stderr.trim() || `exit ${r.code}`}`);

    const lines = r.stdout.trim().split("\n");
    const uptimeLine = lines[0] ?? "";
    const loadMatch = uptimeLine.match(/load averages?: ([\d.,\s]+)/i);
    const cores = Number(lines[1]?.trim()) || 0;

    return {
        host: (lines[lines.length - 1] ?? target.host ?? "").trim(),
        uptime: uptimeLine.split(/\s+up\s+/)[1]?.split(",")[0]?.trim() ?? uptimeLine,
        load: loadMatch ? loadMatch[1].trim() : "unknown",
        cores,
        memory: summariseFree(lines[2] ?? ""),
        disk: (lines[3] ?? "").trim(),
    };
}

async function probeDocker(target: TargetConfig): Promise<HostHealth> {
    const container = target.container ?? "";
    const std = await runText("docker", ["exec", container, "sh", "-c", "uptime; nproc; free -m; df -h /"]);
    const lines = std.split("\n");
    const loadMatch = (lines[0] ?? "").match(/load averages?: ([\d.,\s]+)/i);
    return {
        host: container,
        uptime: (lines[0] ?? "").split(/\s+up\s+/)[1]?.split(",")[0]?.trim() ?? "unknown",
        load: loadMatch ? loadMatch[1].trim() : "unknown",
        cores: Number(lines[1]?.trim()) || 0,
        memory: summariseFree(lines[2] ?? ""),
        disk: (lines[3] ?? "").trim(),
    };
}

async function probeService(
    service: { name: string; restart?: { manager?: string; unit?: string } },
    target: TargetConfig,
): Promise<string> {
    if (target.kind === "docker") {
        const out = await runText("docker", ["inspect", "-f", "{{.State.Status}}", service.restart?.unit ?? service.name]);
        return out || "not found in container";
    }

    if (target.kind === "ssh") {
        const r = await run("ssh", sshArgs(target, [`systemctl is-active ${shellSafe(service.restart?.unit ?? service.name)} 2>/dev/null || true`]), {
            timeoutMs: 10000,
        });
        return (r.stdout || r.stderr).trim() || "unknown";
    }

    // Local: try systemd first, then launchd on macOS.
    const unit = service.restart?.unit ?? service.name;
    const manager = service.restart?.manager;

    if (manager === "launchd" || process.platform === "darwin") {
        const r = await run("launchctl", ["list", unit]);
        if (r.ok) return "running (launchd)";
        if (!r.missing) {
            // launchctl returns non-zero with a message for unknown labels.
            if (/Could not find service|no such process/i.test(r.stderr)) return "not loaded (launchd)";
            return `launchd: ${r.stderr.trim().split("\n")[0] || "unknown"}`;
        }
    }

    const r = await run("systemctl", ["is-active", unit]);
    if (r.missing) return "not found (no launchd label, no systemd unit)";
    return r.stdout.trim() || "inactive";
}

async function probeUrl(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        return `${res.status} ${res.statusText}`.trim();
    } catch (err: any) {
        return `unreachable (${err?.name === "AbortError" ? "timeout" : err?.message ?? "error"})`;
    } finally {
        clearTimeout(timer);
    }
}

function sshArgs(target: TargetConfig, command: string[]): string[] {
    const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new"];
    if (target.port) args.push("-p", String(target.port));
    if (target.keyPath) args.push("-i", target.keyPath);
    args.push(target.user ? `${target.user}@${target.host}` : String(target.host));
    // The remote command is a single string by ssh's contract, so quote the
    // pieces we build. No model-derived value reaches this without passing
    // through the fleet.yml lookup above.
    args.push(command.join(" "));
    return args;
}

/** Escapes a value for use inside the single remote-command string ssh requires. */
function shellSafe(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

function summariseFree(block: string): string {
    const memLine = block.split("\n").find((l) => /^Mem:/.test(l));
    if (!memLine) return block.split("\n")[0]?.trim() || "unknown";
    const cols = memLine.split(/\s+/).filter(Boolean);
    const total = Number(cols[1]);
    const used = Number(cols[2]);
    if (!Number.isFinite(total) || !Number.isFinite(used)) return memLine.trim();
    return `${(used / 1024).toFixed(1)} GiB used of ${(total / 1024).toFixed(1)} GiB (${Math.round((used / total) * 100)}%)`;
}

function gb(bytes: number): string {
    return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}
