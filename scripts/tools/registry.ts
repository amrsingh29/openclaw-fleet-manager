// The registry is the only way a tool runs. It does four things in order, and
// each one is a place the design can fail safely:
//
//   1. resolve the tool by name (unknown name -> model gets told, no crash)
//   2. validate arguments (bad shape -> model gets told what was wrong)
//   3. ask the gate whether this may run now (policy + allowlist)
//   4. execute, timing it and returning structured audit metadata
//
// Tools are registered explicitly rather than by directory scan, so adding one
// is a one-line change a reviewer can see. A plugin directory is a nice idea and
// a bad default: it makes the allowlist invisible.

import { FleetTool, ToolArgumentError, ToolContext, ToolResult, toSchema } from "./types.js";
import { checkServerHealth } from "./check-server-health.js";
import { fetchLatestLogs } from "./fetch-logs.js";
import { scanNetwork } from "./scan-network.js";
import { restartService } from "./restart-service.js";
import { ToolSchema } from "../llm/types.js";

const ALL_TOOLS: FleetTool[] = [checkServerHealth, fetchLatestLogs, scanNetwork, restartService];

export type GateDecision = {
    allow: boolean;
    /** Human-readable reason, surfaced to the model when denied. */
    reason?: string;
    /** True when the action should become a proposal instead of executing. */
    needsApproval?: boolean;
};

/**
 * Decides whether a write may proceed. Read tools bypass this entirely.
 * Kept as an injected function so the runner can back it with the Convex
 * policies table while tests can pass a fixed answer.
 */
export type WriteGate = (tool: FleetTool, args: Record<string, unknown>) => Promise<GateDecision>;

export type ExecuteOptions = {
    callId: string;
    gate?: WriteGate;
    approved?: boolean;
    /** Restrict which tools are available at all, e.g. per team allowedTools. */
    allowTools?: string[];
};

export class ToolRegistry {
    private tools = new Map<string, FleetTool>();

    constructor(tools: FleetTool[] = ALL_TOOLS) {
        for (const t of tools) this.tools.set(t.name, t);
    }

    list(): FleetTool[] {
        return [...this.tools.values()];
    }

    find(name: string): FleetTool | undefined {
        return this.tools.get(name);
    }

    /** The schema array handed to the provider. */
    schemas(allowTools?: string[]): ToolSchema[] {
        return this.list()
            .filter((t) => !allowTools || allowTools.includes(t.name))
            .map(toSchema);
    }

    async execute(name: string, rawArgs: Record<string, unknown>, opts: ExecuteOptions): Promise<ToolResult> {
        const started = Date.now();

        if (opts.allowTools && !opts.allowTools.includes(name)) {
            return {
                ok: false,
                output: `Tool '${name}' is not enabled for this team. Available: ${opts.allowTools.join(", ")}.`,
            };
        }

        const tool = this.find(name);
        if (!tool) {
            return {
                ok: false,
                output:
                    `Unknown tool '${name}'. Available tools: ${this.list().map((t) => t.name).join(", ")}. ` +
                    "Do not invent tool names.",
            };
        }

        let args: Record<string, unknown>;
        try {
            args = tool.validate(rawArgs ?? {});
        } catch (err: any) {
            if (err instanceof ToolArgumentError) {
                return { ok: false, output: `Invalid arguments for ${name}: ${err.message}` };
            }
            return { ok: false, output: `Could not read arguments for ${name}: ${err.message}` };
        }

        if (tool.effect === "write" && opts.gate && !opts.approved) {
            const decision = await opts.gate(tool, args);
            if (!decision.allow) {
                return {
                    ok: false,
                    needsApproval: decision.needsApproval,
                    output: decision.reason ?? "This action requires commander approval and was not executed.",
                    meta: { gated: true, elapsedMs: Date.now() - started },
                };
            }
        }

        const ctx: ToolContext = {
            callId: opts.callId,
            targetKind: "local",
            approved: opts.approved,
        };

        try {
            const result = await tool.execute(args, ctx);
            return {
                ...result,
                meta: { ...(result.meta ?? {}), elapsedMs: Date.now() - started },
            };
        } catch (err: any) {
            // A thrown tool is a bug, not a model error. Say so plainly so it
            // shows up in the task output instead of being retried forever.
            return {
                ok: false,
                output: `Tool '${name}' threw: ${err?.message ?? String(err)}`,
                meta: { threw: true, elapsedMs: Date.now() - started },
            };
        }
    }
}

/** Default registry, used by the runner and by `npm run doctor`. */
export const defaultRegistry = new ToolRegistry();

export { ToolArgumentError };
export * from "./types.js";
