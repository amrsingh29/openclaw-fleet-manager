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
};

export interface FleetBackend {
    /** Every agent in the caller's org, so delegation can resolve a name to an id. */
    listAgents(): Promise<AgentSummary[]>;
    /** Creates a task. Returns its id. */
    createTask(task: NewTask): Promise<string>;
    /** Writes an activity row. Best-effort: callers must not fail a mission on it. */
    logActivity(entry: {
        type: string;
        message: string;
        agentId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
}
