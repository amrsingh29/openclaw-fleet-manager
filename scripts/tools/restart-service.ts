// The only mutating tool. Everything about its shape is defensive:
//
// - The service must be declared in fleet.yml, so the model cannot name an
//   arbitrary unit. There is no path from a model argument to a shell string.
// - Management is done via launchctl / systemctl / docker with argv arrays.
// - No sudo. If the unit needs elevation the tool reports that and stops; it is
//   the operator's call, not the agent's.
// - After issuing the restart it re-probes, so the model is told whether the
//   service actually came back rather than being told "probably fine".

import { FleetTool, ToolResult, requireString } from "./types.js";
import { run } from "./exec.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { findService, getTarget, TargetConfig, ServiceConfig } from "../fleet-config.js";

const execFileAsync = promisify(execFile);
const POST_RESTART_WAIT_MS = 2000;

export const restartService: FleetTool = {
    name: "restart_service",
    description:
        "Restarts a service declared in fleet.yml and reports whether it came back. " +
        "Mutating: may require commander approval depending on policy.",
    effect: "write",
    actionType: "restart_service",
    parameters: {
        type: "object",
        properties: {
            service: { type: "string", description: "Service name as declared in fleet.yml." },
            reason: {
                type: "string",
                description: "One sentence on why a restart is warranted. Shown to the commander for approval.",
            },
        },
        required: ["service", "reason"],
    },

    validate(args) {
        const service = requireString(args, "service", "a service name from fleet.yml");
        const reason = requireString(args, "reason", "a short reason for the restart");
        return { service, reason };
    },

    async execute(args): Promise<ToolResult> {
        const name = String(args.service);
        const service = findService(name);
        if (!service) {
            return { ok: false, output: `Unknown service '${name}'. It is not declared in fleet.yml, so I will not touch it.` };
        }

        const target = getTarget(service.target);
        const unit = service.restart?.unit ?? name;

        // "none" is an explicit opt-out: the operator declared this service as
        // not-restartable by agents, so report that instead of guessing a manager.
        if (service.restart?.manager === "none") {
            return {
                ok: false,
                output: `'${name}' is marked manager: none in fleet.yml, so agents may not restart it.`,
            };
        }

        const manager: Manager = service.restart?.manager ?? guessManager(target);

        try {
            const result = await doRestart(manager, unit, target);
            if (!result.ok) {
                return { ok: false, output: result.message, meta: { manager, unit } };
            }

            // Give the service a moment, then report real state rather than intent.
            await new Promise((r) => setTimeout(r, POST_RESTART_WAIT_MS));
            const state = await currentState(manager, unit, target);

            return {
                ok: true,
                output: `${result.message}\nPost-restart state: ${state}`,
                meta: { manager, unit, state },
            };
        } catch (err: any) {
            return { ok: false, output: `Restart of '${name}' failed: ${err.message}` };
        }
    },
};

type Manager = "launchd" | "systemd" | "docker";

function guessManager(target: TargetConfig): Manager {
    if (target.kind === "docker") return "docker";
    return process.platform === "darwin" ? "launchd" : "systemd";
}

async function doRestart(
    manager: Manager,
    unit: string,
    target: TargetConfig,
): Promise<{ ok: boolean; message: string }> {
    if (target.kind === "docker") {
        const r = await run("docker", ["restart", target.container ?? unit], { timeoutMs: 30000 });
        if (r.missing) return { ok: false, message: "docker is not installed on this machine." };
        if (!r.ok) return { ok: false, message: `docker restart failed: ${r.stderr.trim() || `exit ${r.code}`}` };
        return { ok: true, message: `Restarted container '${target.container ?? unit}' via docker.` };
    }

    if (target.kind === "ssh") {
        const remote =
            manager === "launchd"
                ? `launchctl kickstart -k ${q(unit)}`
                : `systemctl restart ${q(unit)}`;
        const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8"];
        if (target.port) args.push("-p", String(target.port));
        if (target.keyPath) args.push("-i", target.keyPath);
        args.push(target.user ? `${target.user}@${target.host}` : String(target.host), remote);

        const r = await run("ssh", args, { timeoutMs: 30000 });
        if (r.missing) return { ok: false, message: "ssh is not installed on this machine." };
        if (!r.ok) {
            const hint = /permission denied|access denied|must be root|interactive authentication/i.test(
                r.stderr + r.stdout,
            )
                ? " (this needs elevation on the target; I will not escalate silently)"
                : "";
            return { ok: false, message: `ssh restart failed: ${(r.stderr || r.stdout).trim() || `exit ${r.code}`}${hint}` };
        }
        return { ok: true, message: `Restarted '${unit}' on ${target.host} via ${manager}.` };
    }

    // Local.
    if (manager === "launchd") {
        // kickstart -k is a hard restart; it does not require root for the user's
        // own agents, which is the only case we support.
        const r = await run("launchctl", ["kickstart", "-k", unit], { timeoutMs: 20000 });
        if (r.missing) return { ok: false, message: "launchctl is not available on this machine." };
        if (!r.ok) {
            const msg = (r.stderr || r.stdout).trim();
            const needsRoot = /permission denied|operation not permitted|not privileged/i.test(msg);
            return {
                ok: false,
                message: needsRoot
                    ? `launchd refused '${unit}' without elevation. I will not run sudo; the commander must restart it.`
                    : `launchctl kickstart failed: ${msg || `exit ${r.code}`}`,
            };
        }
        return { ok: true, message: `Restarted launchd label '${unit}'.` };
    }

    const r = await run("systemctl", ["restart", unit], { timeoutMs: 30000 });
    if (r.missing) return { ok: false, message: "systemctl is not available on this machine." };
    if (!r.ok) {
        const msg = (r.stderr || r.stdout).trim();
        const needsRoot = /access denied|interactive authentication required|must be root/i.test(msg);
        return {
            ok: false,
            message: needsRoot
                ? `systemd refused '${unit}' without elevation. I will not run sudo; the commander must restart it.`
                : `systemctl restart failed: ${msg || `exit ${r.code}`}`,
        };
    }
    return { ok: true, message: `Restarted systemd unit '${unit}'.` };
}

async function currentState(manager: Manager, unit: string, target: TargetConfig): Promise<string> {
    if (target.kind === "docker") {
        const r = await run("docker", ["inspect", "-f", "{{.State.Status}}", target.container ?? unit]);
        return r.ok ? r.stdout.trim() : "unknown";
    }
    if (target.kind === "ssh") {
        const remote = manager === "launchd" ? `launchctl list ${q(unit)}` : `systemctl is-active ${q(unit)}`;
        const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8"];
        if (target.port) args.push("-p", String(target.port));
        if (target.keyPath) args.push("-i", target.keyPath);
        args.push(target.user ? `${target.user}@${target.host}` : String(target.host), remote);
        const r = await run("ssh", args, { timeoutMs: 10000 });
        return (r.stdout || r.stderr).trim().split("\n")[0] || "unknown";
    }
    if (manager === "launchd") {
        const r = await run("launchctl", ["list", unit]);
        return r.ok ? "running" : "not loaded";
    }
    const r = await run("systemctl", ["is-active", unit]);
    return r.stdout.trim() || "inactive";
}

function q(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
