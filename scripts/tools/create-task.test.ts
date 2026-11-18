// Delegation is the tool most likely to go wrong quietly: a bad assignee name, a
// self-assignment loop, or a task filed against an offline agent that nobody ever
// runs. Each of those gets a test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import type { FleetBackend, AgentSummary, NewTask } from "./backend.js";

type Recorded = { tasks: NewTask[]; activities: { type: string; message: string }[] };

function fakeBackend(agents: AgentSummary[]): { backend: FleetBackend; recorded: Recorded } {
    const recorded: Recorded = { tasks: [], activities: [] };
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
    };
    return { backend, recorded };
}

const ROSTER: AgentSummary[] = [
    { id: "a1", name: "Jarvis", role: "Incident Commander", status: "active" },
    { id: "a2", name: "Shuri", role: "Site Reliability Engineer", status: "active" },
    { id: "a3", name: "Vision", role: "Observability Specialist", status: "offline" },
];

const gate = async () => ({ allow: true });

test("assigns to an agent by exact name", async () => {
    const { backend, recorded } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "Collect metrics", description: "Check web-01 CPU and report." },
        { callId: "c1", gate, agentName: "Jarvis", agentId: "a1", backend, approved: true },
    );
    // assignee omitted -> goes to inbox
    assert.equal(r.ok, true);
    assert.equal(recorded.tasks[0].assigneeId, undefined);

    const r2 = await reg.execute(
        "create_task",
        { title: "Collect metrics", description: "Check web-01 CPU.", assignee: "Shuri" },
        { callId: "c2", gate, agentName: "Jarvis", agentId: "a1", backend, approved: true },
    );
    assert.equal(r2.ok, true);
    assert.equal(recorded.tasks[1].assigneeId, "a2");
    assert.match(r2.output, /Shuri/);
});

test("resolves an assignee by role when the model names a role instead", async () => {
    const { backend, recorded } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "Look at logs", description: "Tail it.", assignee: "site reliability engineer" },
        { callId: "c3", gate, agentName: "Jarvis", agentId: "a1", backend, approved: true },
    );
    assert.equal(r.ok, true);
    assert.equal(recorded.tasks[0].assigneeId, "a2");
});

test("an unknown assignee is refused and the roster is listed", async () => {
    const { backend, recorded } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "x", description: "y", assignee: "Friday" },
        { callId: "c4", gate, agentName: "Jarvis", agentId: "a1", backend, approved: true },
    );
    assert.equal(r.ok, false);
    assert.match(r.output, /No agent named 'Friday'/);
    assert.match(r.output, /Shuri/);
    assert.equal(recorded.tasks.length, 0, "nothing should be filed for an unknown agent");
});

test("self-assignment is refused as a loop", async () => {
    const { backend, recorded } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "x", description: "y", assignee: "Jarvis" },
        { callId: "c5", gate, agentName: "Jarvis", agentId: "a1", backend, approved: true },
    );
    assert.equal(r.ok, false);
    assert.match(r.output, /assigning this mission to yourself/);
    assert.equal(recorded.tasks.length, 0);
});

test("delegating to an offline agent reports that it will wait", async () => {
    const { backend } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "x", description: "y", assignee: "Vision" },
        { callId: "c6", gate, agentName: "Jarvis", agentId: "a1", backend, approved: true },
    );
    assert.equal(r.ok, true);
    assert.match(r.output, /offline/);
    assert.match(r.output, /wait/i);
});

test("no backend means delegation is unavailable, not silently lost", async () => {
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "x", description: "y" },
        { callId: "c7", gate, agentName: "Jarvis", approved: true },
    );
    assert.equal(r.ok, false);
    assert.match(r.output, /no Mission Control connection/);
});

test("delegation is gated like any other write when policy says so", async () => {
    const { backend, recorded } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const proposeOnly = async () => ({ allow: false, needsApproval: true, reason: "policy propose_only" });
    const r = await reg.execute(
        "create_task",
        { title: "x", description: "y", assignee: "Shuri" },
        { callId: "c8", gate: proposeOnly, agentName: "Jarvis", agentId: "a1", backend },
    );
    assert.equal(r.ok, false);
    assert.equal(r.needsApproval, true);
    assert.equal(recorded.tasks.length, 0);
});

test("title and description are required", async () => {
    const { backend } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const noTitle = await reg.execute(
        "create_task",
        { title: "", description: "y" },
        { callId: "c9", gate, agentName: "Jarvis", backend, approved: true },
    );
    assert.equal(noTitle.ok, false);
    assert.match(noTitle.output, /Missing or empty 'title'/);
});
