// fleet.yml is the file a forker edits. It answers two questions: which model,
// and which services the agents are allowed to touch. Everything here has a
// working default so a fresh clone boots with no config at all.

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

export type TargetKind = "local" | "ssh" | "docker";

export type TargetConfig = {
    kind: TargetKind;
    /** ssh only */
    host?: string;
    user?: string;
    port?: number;
    /** ssh: path to private key. Defaults to the ssh agent. */
    keyPath?: string;
    /** docker only */
    container?: string;
};

export type ServiceConfig = {
    name: string;
    /** Which entry in `targets` this service lives on. Defaults to `default` target. */
    target?: string;
    /** Log files to tail. Relative paths resolve against the repo root. */
    logPaths?: string[];
    /** Optional URL probed by check_server_health. */
    healthUrl?: string;
    /** How the service is restarted on its target. Auto-detected when omitted. */
    restart?: {
        /** launchd (macOS), systemd (Linux), docker. */
        manager?: "launchd" | "systemd" | "docker" | "none";
        /** launchd label, systemd unit, or container name. */
        unit?: string;
    };
};

export type LlmConfig = {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
};

export type PolicyDefaults = {
    /** read-only tools: check_server_health, fetch_latest_logs, scan_network */
    read?: "auto" | "manual" | "propose_only";
    /** mutating tools: restart_service */
    write?: "auto" | "manual" | "propose_only";
};

export type FleetConfig = {
    llm?: LlmConfig;
    default?: string;
    targets?: Record<string, TargetConfig>;
    services?: ServiceConfig[];
    policies?: PolicyDefaults;
    /** CIDRs scan_network is allowed to probe. Empty means localhost only. */
    scanAllowlist?: string[];
    /** How many tool-call round trips one task may make before it must answer. */
    maxToolRounds?: number;
};

const CONFIG_FILENAMES = ["fleet.yml", "fleet.yaml"];
const CACHE_TTL_MS = 5_000;

let cache: { at: number; config: FleetConfig; file: string | null } | null = null;

export function repoRoot(): string {
    // scripts/ lives one level under the repo root.
    return path.resolve(__dirname, "..");
}

export function findConfigFile(): string | null {
    // fleet.local.yml wins so a forker can keep real hostnames out of git.
    const candidates = ["fleet.local.yml", "fleet.local.yaml", ...CONFIG_FILENAMES];
    for (const name of candidates) {
        const p = path.join(repoRoot(), name);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

/**
 * Loads fleet.yml, cached briefly so a 5s poll loop doesn't re-read the file
 * on every tick while still picking up edits without a restart.
 */
export function loadFleetConfig(opts: { force?: boolean } = {}): FleetConfig {
    if (!opts.force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.config;

    const file = findConfigFile();
    let config: FleetConfig = {};
    if (file) {
        try {
            const raw = yaml.load(fs.readFileSync(file, "utf-8"));
            config = (raw && typeof raw === "object" ? raw : {}) as FleetConfig;
        } catch (err: any) {
            // A typo in fleet.yml must be loud: silently falling back to defaults
            // would let an agent run with no service allowlist.
            throw new Error(`Failed to parse ${file}: ${err.message}`);
        }
    }

    validate(config, file);
    cache = { at: Date.now(), config, file };
    return config;
}

export function clearConfigCache(): void {
    cache = null;
}

function validate(config: FleetConfig, file: string | null): void {
    const errors: string[] = [];
    const where = file ? path.basename(file) : "fleet.yml";

    if (config.targets) {
        for (const [name, t] of Object.entries(config.targets)) {
            if (!t?.kind) errors.push(`targets.${name} is missing 'kind' (local | ssh | docker)`);
            if (t?.kind === "ssh" && !t.host) errors.push(`targets.${name} is ssh but has no 'host'`);
            if (t?.kind === "docker" && !t.container) errors.push(`targets.${name} is docker but has no 'container'`);
        }
    }

    const targetNames = new Set(Object.keys(config.targets ?? {}));
    const defaultTarget = config.default ?? "local";

    if (config.services) {
        const seen = new Set<string>();
        for (const s of config.services) {
            if (!s?.name) {
                errors.push("a service entry has no 'name'");
                continue;
            }
            if (seen.has(s.name)) errors.push(`duplicate service name '${s.name}'`);
            seen.add(s.name);
            const target = s.target ?? defaultTarget;
            // An unknown target is the kind of mistake that only shows up at
            // restart time, so refuse to load it.
            if (target !== "local" && !targetNames.has(target)) {
                errors.push(`service '${s.name}' references unknown target '${target}'`);
            }
        }
    }

    if (errors.length) {
        throw new Error(`Invalid ${where}:\n  - ${errors.join("\n  - ")}`);
    }
}

// ---- Convenience accessors used by the tools ----

export function getTarget(name?: string): TargetConfig {
    const config = loadFleetConfig();
    const key = name ?? config.default ?? "local";
    if (key === "local" && !config.targets?.["local"]) return { kind: "local" };
    const t = config.targets?.[key];
    if (!t) throw new Error(`Unknown target '${key}'. Known: ${Object.keys(config.targets ?? {}).join(", ") || "local"}`);
    return t;
}

/** Resolves a logPaths entry against the repo root when it is relative. */
export function resolveLogPath(p: string): string {
    return path.isAbsolute(p) ? p : path.join(repoRoot(), p);
}

export function findService(name: string): ServiceConfig | null {
    const config = loadFleetConfig();
    return config.services?.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export function listServiceNames(): string[] {
    return (loadFleetConfig().services ?? []).map((s) => s.name);
}

export function maxToolRounds(): number {
    const configured = loadFleetConfig().maxToolRounds;
    const n = Number.isFinite(configured) ? Number(configured) : 6;
    return Math.max(1, Math.min(20, n));
}

export function policyDefaults(): Required<PolicyDefaults> {
    const p = loadFleetConfig().policies ?? {};
    return {
        read: p.read ?? "auto",
        write: p.write ?? "propose_only",
    };
}
