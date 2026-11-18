// Guards against the swarm failure that turned one mission into 45.
//
// The real incident: Jarvis was asked to restart a service he could not verify,
// delegated to Shuri, who hit the same wall and delegated to Vision, who
// delegated back. Every hop restated the same blocked request. Nothing in the
// code stopped the chain, so it grew until a human noticed the board.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { fakeBackend } from "./test-backend.js";
import { delegationLimits } from "../fleet-config.js";

const ROSTER = [
    { id: "a1", name: "Jarvis", role: "Incident Commander", status: "active" },
    { id: "a2", name: "Shuri", role: "Site Reliability Engineer", status: "active" },
    { id: "a3", name: "Vision", role: "Observability Specialist", status: "active" },
];

const gate = async () => ({ allow: true });
const limits = delegationLimits();

function run(ctxCounts: any, taskId = "t-current") {
    const { backend, recorded } = fakeBackend(ROSTER, ctxCounts);
    const reg = new ToolRegistry();
    return reg
        .execute(
            "create_task",
            { title: "Do the thing", description: "Please.", assignee: "Shuri" },
            { callId: "c1", gate, agentName: "Jarvis", agentId: "a1", taskId, backend, approved: true },
        )
        .then((r) => ({ r, recorded }));
}

test("delegation is refused once the depth limit is reached", async () => {
    const { r, recorded } = await run({ currentDepth: limits.maxDepth });
    assert.equal(r.ok, false);
    assert.match(r.output, /depth limit/i);
    assert.equal(recorded.tasks.length, 0, "a refused delegation must not create a task");
});

test("delegation is allowed just below the depth limit", async () => {
    const { r, recorded } = await run({ currentDepth: limits.maxDepth - 1 });
    assert.equal(r.ok, true);
    assert.equal(recorded.tasks.length, 1);
    // Lineage is recorded so the chain is readable afterwards.
    assert.equal(recorded.tasks[0].depth, limits.maxDepth);
    assert.equal(recorded.tasks[0].parentTaskId, "t-current");
});

test("a mission cannot spawn more than its child budget", async () => {
    const { r, recorded } = await run({ childCount: limits.maxChildrenPerTask });
    assert.equal(r.ok, false);
    assert.match(r.output, /sub-tasks|limit/i);
    assert.equal(recorded.tasks.length, 0);
});

test("the per-agent hourly brake stops a runaway delegate", async () => {
    const { r, recorded } = await run({ agentCreatesLastHour: limits.maxPerAgentPerHour });
    assert.equal(r.ok, false);
    assert.match(r.output, /last hour/i);
    assert.equal(recorded.tasks.length, 0);
});

test("limits fail closed when the counts cannot be read", async () => {
    // A backend that throws must not be treated as "no limits".
    const backend = {
        async listAgents() {
            return ROSTER;
        },
        async createTask() {
            throw new Error("should not be called");
        },
        async logActivity() {},
        async delegationContext() {
            throw new Error("convex unreachable");
        },
        async createProposal() {
            return { proposalId: "x", status: "pending" as const };
        },
        async listApprovedForAgent() {
            return [];
        },
        async markProposalResult() {},
    };
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "create_task",
        { title: "t", description: "d", assignee: "Shuri" },
        { callId: "c9", gate, agentName: "Jarvis", agentId: "a1", taskId: "t1", backend: backend as any, approved: true },
    );
    assert.equal(r.ok, false);
    assert.match(r.output, /Could not check delegation limits/);
});

test("a human-created task can delegate, because depth starts at zero", async () => {
    const { r, recorded } = await run({ currentDepth: 0, childCount: 0, agentCreatesLastHour: 0 });
    assert.equal(r.ok, true);
    assert.equal(recorded.tasks[0].depth, 1);
});

test("limits are sane defaults and configurable", () => {
    assert.ok(limits.maxDepth >= 1 && limits.maxDepth <= 5, "depth default should allow a real chain");
    assert.ok(limits.maxChildrenPerTask >= 2, "one child is too tight to split work");
    assert.ok(limits.maxPerAgentPerHour >= 5);
});
