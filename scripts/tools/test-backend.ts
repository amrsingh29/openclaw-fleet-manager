// A FleetBackend fake for tests. Shared so every tool test does not hand-roll the
// whole interface, and so adding a backend method only breaks one file.
//
// Not production code. Named *.test-helper.ts and excluded from the build.

import type { FleetBackend, AgentSummary, NewTask, ProposalRef } from "./backend.js";

export type FakeRecorded = {
    tasks: NewTask[];
    activities: { type: string; message: string }[];
    proposals: { action: string; params: Record<string, unknown>; rationale: string; taskId?: string }[];
    results: { proposalId: string; ok: boolean; result: string }[];
};

export function fakeBackend(agents: AgentSummary[] = []): {
    backend: FleetBackend;
    recorded: FakeRecorded;
} {
    const recorded: FakeRecorded = { tasks: [], activities: [], proposals: [], results: [] };

    const backend: FleetBackend = {
        async listAgents() {
            return agents;
        },
        async createTask(task) {
            recorded.tasks.push(task);
            return `task_${recorded.tasks.length}`;
        },
        async logActivity(entry) {
            recorded.activities.push({ type: entry.type, message: entry.message });
        },
        async createProposal(proposal) {
            recorded.proposals.push({
                action: proposal.action,
                params: proposal.params,
                rationale: proposal.rationale,
                taskId: proposal.taskId,
            });
            return { proposalId: `proposal_${recorded.proposals.length}`, status: "pending" };
        },
        async listApprovedForAgent(): Promise<ProposalRef[]> {
            return [];
        },
        async markProposalResult(proposalId, ok, result) {
            recorded.results.push({ proposalId, ok, result });
        },
    };

    return { backend, recorded };
}
