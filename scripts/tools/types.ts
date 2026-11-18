// The contract every tool implements. Kept narrow on purpose: a tool describes
// itself (so the model can pick it), declares whether it mutates anything (so
// the policy gate can decide), and runs with already-validated arguments.

import { ToolSchema } from "../llm/types.js";

export type ToolEffect = "read" | "write";

export type ToolContext = {
    /** Service names the operator has declared in fleet.yml. Already checked by the registry. */
    serviceName?: string;
    /** Resolved target for this call (local | ssh | docker). */
    targetKind: "local" | "ssh" | "docker";
    /** True when a human approved this specific call, so a confirm gate can pass. */
    approved?: boolean;
    /** Correlation id for logging. */
    callId: string;
    /** The agent making the call, so tools like create_task can attribute work. */
    agentName?: string;
    agentId?: string;
    /** Mission Control access, for the few tools that need shared state. */
    backend?: import("./backend.js").FleetBackend;
};

export type ToolResult = {
    ok: boolean;
    /** What the model reads. Keep it tight: this goes into the context window. */
    output: string;
    /** Structured detail for the audit log, not shown to the model. */
    meta?: Record<string, unknown>;
    /** Set when the tool declined because a policy requires approval. */
    needsApproval?: boolean;
};

export interface FleetTool {
    name: string;
    description: string;
    /** JSON Schema for arguments, handed to the provider as the tool definition. */
    parameters: Record<string, unknown>;
    effect: ToolEffect;
    /** Policy actionType used against the convex policies table. Defaults to name. */
    actionType?: string;
    /** Guardrail: validates and coerces raw model arguments before execute. */
    validate(args: Record<string, unknown>): Record<string, unknown>;
    execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export function toSchema(t: FleetTool): ToolSchema {
    return { name: t.name, description: t.description, parameters: t.parameters };
}

/** Thrown by a validator when the model's arguments cannot be used. */
export class ToolArgumentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ToolArgumentError";
    }
}

export function requireString(args: Record<string, unknown>, key: string, what: string): string {
    const v = args[key];
    if (typeof v !== "string" || !v.trim()) {
        throw new ToolArgumentError(`Missing or empty '${key}'. Expected ${what}.`);
    }
    return v.trim();
}
