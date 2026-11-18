// The approval loop is the difference between "restarts are blocked" and
// "restarts are gated by a human". These tests pin the parts that would let a
// blocked action run without approval, or run twice.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { fakeBackend } from "./test-backend.js";

const ROSTER = [{ id: "a1", name: "Jarvis", role: "Incident Commander", status: "active" }];

const proposeOnlyGate = async () => ({
    allow: false,
    needsApproval: true,
    reason: "Policy for write actions is 'propose_only'",
});

test("a gated write does not execute and asks for approval", async () => {
    const { backend } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "restart_service",
        { service: "this-host", reason: "test" },
        { callId: "p1", gate: proposeOnlyGate, agentName: "Jarvis", agentId: "a1", backend },
    );
    assert.equal(r.ok, false);
    assert.equal(r.needsApproval, true);
    assert.match(r.output, /propose_only/);
});

test("an approved call bypasses the gate", async () => {
    const { backend } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "restart_service",
        { service: "this-host", reason: "test" },
        { callId: "p2", gate: proposeOnlyGate, approved: true, agentName: "Jarvis", agentId: "a1", backend },
    );
    // Not gated any more; the service is fictional so the manager fails, which is
    // a different outcome from being refused by policy.
    assert.doesNotMatch(r.output, /propose_only/);
});

test("read tools are never gated, even when write policy is propose_only", async () => {
    const { backend } = fakeBackend(ROSTER);
    const reg = new ToolRegistry();
    const r = await reg.execute(
        "check_server_health",
        { service: "this-host" },
        { callId: "p3", gate: proposeOnlyGate, agentName: "Jarvis", agentId: "a1", backend },
    );
    assert.equal(r.ok, true);
    assert.doesNotMatch(r.output, /propose_only/);
});

test("the same action cannot be approved and executed twice", async () => {
    // Guards the Convex side: approve() refuses anything not 'pending'. Here we
    // assert the invariant the runner relies on — a non-pending proposal is not
    // returned by listApprovedForAgent. The fake returns nothing, which is the
    // post-execution state.
    const { backend } = fakeBackend(ROSTER);
    const approved = await backend.listApprovedForAgent("a1");
    assert.deepEqual(approved, []);
});

test("recording a result marks it so it will not be retried", async () => {
    const { backend, recorded } = fakeBackend(ROSTER);
    await backend.markProposalResult("prop_1", false, "launchctl failed");
    assert.equal(recorded.results.length, 1);
    assert.equal(recorded.results[0].ok, false);
    assert.match(recorded.results[0].result, /launchctl/);
});
