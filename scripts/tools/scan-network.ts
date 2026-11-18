// TCP connect probes against hosts the operator listed in fleet.yml.
// No nmap, no SYN scanning, no port sweep of arbitrary ranges: the model picks
// a host from the allowlist and a small set of ports, and we report what
// accepted a connection. This is enough to answer "is the API reachable".

import * as net from "net";
import { FleetTool, ToolArgumentError, ToolResult, requireString } from "./types.js";
import { loadFleetConfig } from "../fleet-config.js";

const DEFAULT_PORTS = [80, 443];
const MAX_PORTS = 12;
const CONNECT_TIMEOUT_MS = 1500;
const MAX_HOSTS = 8;

export const scanNetwork: FleetTool = {
    name: "scan_network",
    description:
        "Probes whether specific TCP ports accept connections on an allowlisted host. Read-only. " +
        "Only hosts listed in fleet.yml scanAllowlist are permitted.",
    effect: "read",
    actionType: "scan_network",
    parameters: {
        type: "object",
        properties: {
            host: { type: "string", description: "Hostname or IP. Must appear in fleet.yml scanAllowlist." },
            ports: {
                type: "array",
                items: { type: "number" },
                description: `Ports to probe, max ${MAX_PORTS}. Defaults to ${DEFAULT_PORTS.join(", ")}.`,
            },
        },
        required: ["host"],
    },

    validate(args) {
        const host = requireString(args, "host", "a hostname or IP from scanAllowlist");

        let ports = DEFAULT_PORTS;
        if (args.ports !== undefined) {
            if (!Array.isArray(args.ports)) throw new ToolArgumentError("'ports' must be an array of numbers.");
            const nums = args.ports.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
            if (!nums.length) throw new ToolArgumentError("'ports' contained no valid port numbers (1-65535).");
            ports = Array.from(new Set(nums)).slice(0, MAX_PORTS);
        }

        return { host, ports };
    },

    async execute(args): Promise<ToolResult> {
        const host = String(args.host);
        const ports = args.ports as number[];

        const allow = loadFleetConfig().scanAllowlist ?? [];
        if (!isAllowed(host, allow)) {
            return {
                ok: false,
                output:
                    `Host '${host}' is not in scanAllowlist, so I will not probe it. ` +
                    (allow.length
                        ? `Allowed: ${allow.join(", ")}.`
                        : "scanAllowlist is empty; ask the commander to add this host to fleet.yml."),
            };
        }

        const results = await Promise.all(ports.map((p) => probe(host, p)));
        const open = results.filter((r) => r.open).map((r) => r.port);
        const closed = results.filter((r) => !r.open);

        const lines = [`Scan of ${host}:`];
        lines.push(
            open.length
                ? `  Open: ${open.map((p) => `${p} (${portName(p)})`).join(", ")}`
                : "  Open: none",
        );
        if (closed.length) {
            lines.push(
                `  Closed/filtered: ${closed
                    .map((r) => `${r.port}${r.error ? ` [${r.error}]` : ""}`)
                    .join(", ")}`,
            );
        }

        return {
            ok: true,
            output: lines.join("\n"),
            meta: { host, open, probed: ports.length },
        };
    },
};

/** Supports exact hostnames and simple CIDR-free globs like "10.0.1.*". */
function isAllowed(host: string, allow: string[]): boolean {
    if (!allow.length) return false;
    const h = host.toLowerCase();
    for (const entry of allow) {
        const e = entry.toLowerCase().trim();
        if (!e) continue;
        if (e === h) return true;
        if (e.startsWith("*.") && h.endsWith(e.slice(1))) return true;
        if (e.endsWith("*") && h.startsWith(e.slice(0, -1))) return true;
    }
    return false;
}

function probe(host: string, port: number): Promise<{ port: number; open: boolean; error?: string }> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const done = (open: boolean, error?: string) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ port, open, error });
        };

        socket.setTimeout(CONNECT_TIMEOUT_MS);
        socket.once("connect", () => done(true));
        socket.once("timeout", () => done(false, "timeout"));
        socket.once("error", (err: any) => done(false, err?.code ?? "error"));

        try {
            socket.connect(port, host);
        } catch (err: any) {
            done(false, err?.code ?? "error");
        }
    });
}

function portName(port: number): string {
    const names: Record<number, string> = {
        22: "ssh",
        80: "http",
        443: "https",
        3000: "dev",
        5432: "postgres",
        6379: "redis",
        8000: "http-alt",
        8080: "http-alt",
        27017: "mongo",
    };
    return names[port] ?? "unknown";
}
