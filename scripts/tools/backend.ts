// The narrow slice of Mission Control a tool is allowed to touch.
//
// Tools do not import the Convex client directly. They take this interface, which
// keeps them unit-testable with a fake and makes it visible in one file exactly
// what a tool can read or write in the shared database.
//
// Deliberately small: an agent needs to see who exists and to file work. It does
// not get to rewrite agents, policies, or other people's tasks.

export type AgentSummary = {
    id: string;
    name: string;
    role: string;
    status: string;
    teamId?: string;
};

export type NewTask = {
    title: string;
    description: string;
    priority?: "low" | "medium" | "high";
    /** Resolved agent id. Omit to leave the task in the inbox for any agent. */
    assigneeId?: string;
    teamId?: string;
    /** Who asked for this, for the audit trail. */
    createdByAgentId?: string;
    /** Lineage, so delegation depth can be enforced and the chain read back. */
    parentTaskId?: string;
    depth?: number;
};

/** Lineage facts the tool needs before it may delegate. */
export type DelegationContext = {
    /** Depth of the task currently being worked. 0 for human-created. */
    currentDepth: number;
    /** How many tasks the current mission has already spawned. */
    childCount: number;
    /** How many tasks this agent has created in the last hour. */
    agentCreatesLastHour: number;
};

export type ProposalRef = {
    id: string;
    action: string;
    params: Record<string, unknown>;
    rationale: string;
    taskId?: string;
};

export interface FleetBackend {
    /** Every agent in the caller's org, so delegation can resolve a name to an id. */
    listAgents(): Promise<AgentSummary[]>;
    /** Creates a task. Returns its id. */
    createTask(task: NewTask): Promise<string>;
    /** Counts used to enforce delegation limits before a task is created. */
    delegationContext(args: { taskId?: string; agentId?: string }): Promise<DelegationContext>;
    /** Writes an activity row. Best-effort: callers must not fail a mission on it. */
    logActivity(entry: {
        type: string;
        message: string;
        agentId?: string;
        /** Which mission this event belongs to, so activity is queryable by task. */
        taskId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;

    // ---- approval loop ----

    /** Raises a proposal for an action the policy would not allow immediately. */
    createProposal(proposal: {
        agentId: string;
        action: string;
        params: Record<string, unknown>;
        rationale: string;
        taskId?: string;
    }): Promise<{ proposalId: string; status: "pending" | "auto_approved" }>;

    /** Proposals a human has approved that this agent has not run yet. */
    listApprovedForAgent(agentId: string): Promise<ProposalRef[]>;

    /** Records the outcome of executing an approved proposal. */
    markProposalResult(proposalId: string, ok: boolean, result: string): Promise<void>;
}
