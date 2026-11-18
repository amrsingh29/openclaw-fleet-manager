// FleetBackend implementation over the Convex HTTP client.
//
// Kept out of the tools themselves so a tool never imports the generated API;
// tests pass a fake instead, and this file is the only place that knows how
// Mission Control is actually reached.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import type { FleetBackend, AgentSummary, NewTask, ProposalRef } from "./backend.js";

export class ConvexBackend implements FleetBackend {
    constructor(private client: ConvexHttpClient) {}

    async listAgents(): Promise<AgentSummary[]> {
        const agents = await this.client.query(api.agents.list);
        return (agents as any[]).map((a) => ({
            id: a._id,
            name: a.name,
            role: a.role,
            status: a.status,
            teamId: a.teamId,
        }));
    }

    async createTask(task: NewTask): Promise<string> {
        // Assigned work goes straight to 'assigned' with an assigneeId, which only
        // that agent's runner will pick up. Unassigned work goes to the inbox for
        // the normal claim race.
        const taskId = await this.client.mutation(api.tasks.create, {
            title: task.title,
            description: task.description,
            priority: task.priority ?? "medium",
            // Only include teamId when set: the generated arg type wants a real
            // Id<"teams">, and passing undefined explicitly fails its validator.
            ...(task.teamId ? { teamId: task.teamId as any } : {}),
            status: task.assigneeId ? "assigned" : "inbox",
        });

        if (task.assigneeId) {
            // tasks.create does not take an assignee, so assignment is a second
            // call. Both are cheap and the pair is not racy: the task is not in the
            // inbox, so no other runner can claim it in between.
            await this.client.mutation(api.tasks.assign, {
                taskId: taskId as any,
                agentId: task.assigneeId as any,
            });
        }

        return taskId as string;
    }

    async logActivity(entry: {
        type: string;
        message: string;
        agentId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        try {
            await this.client.mutation(api.activities.log, {
                type: entry.type,
                message: entry.message,
                ...(entry.agentId ? { agentId: entry.agentId as any } : {}),
                ...(entry.metadata ? { metadata: entry.metadata } : {}),
            });
        } catch {
            // Audit is best-effort: losing a log line must not fail the mission.
        }
    }

    async createProposal(proposal: {
        agentId: string;
        action: string;
        params: Record<string, unknown>;
        rationale: string;
        taskId?: string;
    }): Promise<{ proposalId: string; status: "pending" | "auto_approved" }> {
        const res = await this.client.mutation(api.proposals.createProposal, {
            agentId: proposal.agentId as any,
            action: proposal.action,
            params: proposal.params,
            rationale: proposal.rationale,
            ...(proposal.taskId ? { taskId: proposal.taskId as any } : {}),
        });
        return res as { proposalId: string; status: "pending" | "auto_approved" };
    }

    async listApprovedForAgent(agentId: string): Promise<ProposalRef[]> {
        const rows = await this.client.query(api.proposals.listApprovedForAgent, {
            agentId: agentId as any,
        });
        return (rows as any[]).map((p) => ({
            id: p._id,
            action: p.action,
            params: p.params ?? {},
            rationale: p.rationale,
            taskId: p.taskId,
        }));
    }

    async markProposalResult(proposalId: string, ok: boolean, result: string): Promise<void> {
        await this.client.mutation(api.proposals.markResult, {
            proposalId: proposalId as any,
            ok,
            result,
        });
    }
}
