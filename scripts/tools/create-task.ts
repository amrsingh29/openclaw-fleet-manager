// Delegation. This is the tool that makes a commander an actual commander: it
// files work against a named agent instead of doing everything itself.
//
// Routing is by explicit name, resolved against the real roster. The alternative
// (drop it in the inbox and let whoever polls first take it) already exists and is
// wrong for specialists: it lets an SEO analyst claim an nginx restart. If the
// model names nobody, the task goes to the inbox intentionally, and the board
// shows that nobody owns it.

import { FleetTool, ToolArgumentError, ToolResult, requireString } from "./types.js";
import { FleetBackend } from "./backend.js";
import { delegationLimits } from "../fleet-config.js";

export const createTask: FleetTool = {
    name: "create_task",
    description:
        "Creates a mission for another agent and optionally assigns it by name. " +
        "Use this to delegate instead of doing everything yourself. " +
        "The assignee must be an agent that actually exists.",
    // Filing work for a teammate is a write: it changes shared state and costs
    // another agent's time, so it goes through the same policy gate as a restart.
    effect: "write",
    actionType: "create_task",
    parameters: {
        type: "object",
        properties: {
            title: { type: "string", description: "Short imperative title, e.g. 'Collect live metrics for web-01'." },
            description: {
                type: "string",
                description:
                    "What the agent should do, including what would count as done. Be specific about the service name.",
            },
            assignee: {
                type: "string",
                description:
                    "Name of the agent to assign this to. Omit only if it genuinely does not matter who picks it up.",
            },
            priority: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Defaults to medium.",
            },
        },
        required: ["title", "description"],
    },

    validate(args) {
        const title = requireString(args, "title", "a short mission title");
        const description = requireString(args, "description", "what the agent should do");

        if (title.length > 200) throw new ToolArgumentError("Title is too long; keep it under 200 characters.");
        if (description.length > 8000) throw new ToolArgumentError("Description is too long; keep it under 8000 characters.");

        let priority: "low" | "medium" | "high" = "medium";
        if (args.priority !== undefined) {
            const p = String(args.priority).toLowerCase();
            if (!["low", "medium", "high"].includes(p)) {
                throw new ToolArgumentError("'priority' must be low, medium, or high.");
            }
            priority = p as "low" | "medium" | "high";
        }

        const assignee = args.assignee === undefined ? undefined : requireString(args, "assignee", "an agent name");

        return { title, description, priority, assignee };
    },

    async execute(args, ctx): Promise<ToolResult> {
        const backend = ctx.backend;
        if (!backend) {
            return {
                ok: false,
                output:
                    "Delegation is unavailable: this runner has no Mission Control connection. " +
                    "Report the finding yourself instead.",
            };
        }

        const title = String(args.title);
        const description = String(args.description);
        const priority = args.priority as "low" | "medium" | "high";
        const requested = args.assignee as string | undefined;

        // Limits are checked before anything is written, so a refused delegation
        // leaves no trace in the board.
        const limits = delegationLimits();
        let ctxCounts;
        try {
            ctxCounts = await backend.delegationContext({
                taskId: ctx.taskId,
                agentId: ctx.agentId,
            });
        } catch {
            // If the counts cannot be read, refuse rather than risk unbounded
            // delegation. Failing closed is the right call for a loop guard.
            return {
                ok: false,
                output:
                    "Could not check delegation limits, so I will not create a task. " +
                    "Report what you would have delegated instead.",
            };
        }

        const myDepth = (ctxCounts.currentDepth ?? 0) + 1;
        if (myDepth > limits.maxDepth) {
            return {
                ok: false,
                output:
                    `Delegation depth limit reached (${limits.maxDepth}). This mission is already ` +
                    `${ctxCounts.currentDepth} hop(s) from the original request. ` +
                    "Do not delegate further: either do the work with your own tools, or report " +
                    "plainly what is blocked and why so a human can decide.",
            };
        }

        if (ctxCounts.childCount >= limits.maxChildrenPerTask) {
            return {
                ok: false,
                output:
                    `This mission already has ${ctxCounts.childCount} sub-tasks, which is the limit ` +
                    `(${limits.maxChildrenPerTask}). Do not split it further; report what you have ` +
                    "and what remains.",
            };
        }

        if (ctxCounts.agentCreatesLastHour >= limits.maxPerAgentPerHour) {
            return {
                ok: false,
                output:
                    `You have created ${ctxCounts.agentCreatesLastHour} tasks in the last hour, which is ` +
                    `the limit (${limits.maxPerAgentPerHour}). Stop delegating and report. If the fleet is ` +
                    "genuinely overloaded, say so; a human needs to widen the limits or add capacity.",
            };
        }

        const agents = await backend.listAgents();

        let assignee: { id: string; name: string; role: string; status: string } | undefined;

        if (requested) {
            // Match on exact name first, then case-insensitive, then role. Models
            // say "the SRE" as often as they say "Shuri", and both are reasonable.
            const norm = requested.trim().toLowerCase();
            assignee =
                agents.find((a) => a.name.toLowerCase() === norm) ??
                agents.find((a) => a.role.toLowerCase() === norm) ??
                agents.find((a) => a.role.toLowerCase().includes(norm));

            if (!assignee) {
                return {
                    ok: false,
                    output:
                        `No agent named '${requested}'. The roster is: ` +
                        `${agents.map((a) => `${a.name} (${a.role})`).join(", ") || "(empty)"}. ` +
                        "Pick one of those, or omit 'assignee' to leave it for whoever is free.",
                };
            }
        }

        // A commander delegating to itself is usually a loop rather than intent.
        if (assignee && ctx.agentName && assignee.name.toLowerCase() === ctx.agentName.toLowerCase()) {
            return {
                ok: false,
                output:
                    `You are ${ctx.agentName}; assigning this mission to yourself would only loop. ` +
                    "Either do the work now with your own tools, or pick a different agent.",
            };
        }

        const taskId = await backend.createTask({
            title,
            description,
            priority,
            assigneeId: assignee?.id,
            createdByAgentId: ctx.agentId,
            parentTaskId: ctx.taskId,
            depth: myDepth,
        });

        await backend.logActivity({
            type: "task_delegated",
            agentId: ctx.agentId,
            // The delegated task, so the child's whole history is one query.
            taskId,
            message: assignee
                ? `${ctx.agentName ?? "Agent"} assigned "${title}" to ${assignee.name}`
                : `${ctx.agentName ?? "Agent"} filed "${title}" in the inbox`,
            metadata: { assignee: assignee?.name, priority, depth: myDepth },
        });

        if (!assignee) {
            return {
                ok: true,
                output:
                    `Filed "${title}" in the inbox (no assignee). Any idle agent may claim it. ` +
                    `Task id ${taskId}.`,
                meta: { taskId, assigned: false },
            };
        }

        // Be honest about whether anyone is actually going to run it. An offline
        // assignee means the task sits there, and the model should say so rather
        // than reporting the delegation as done.
        const offline = /offline/i.test(assignee.status);
        return {
            ok: true,
            output:
                `Assigned "${title}" to ${assignee.name} (${assignee.role}), priority ${priority}. Task id ${taskId}.` +
                (offline
                    ? `\nNote: ${assignee.name} is currently offline, so this will wait until their runner is up. Say so if the commander needs action now.`
                    : `\n${assignee.name} will claim it within a few seconds.`),
            meta: { taskId, assigned: true, assignee: assignee.name, offline },
        };
    },
};
