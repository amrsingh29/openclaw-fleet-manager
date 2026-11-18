// Guards the properties that make this safe to hand to an LLM. Each test here
// corresponds to a way the old mock tools could have been abused or could have
// silently lied.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { defaultRegistry } from "./registry.js";

const alwaysAllowGate = async () => ({ allow: true });
const proposeOnlyGate = async () => ({
    allow: false,
    needsApproval: true,
    reason: "policy propose_only",
});

test("unknown tool names are refused, not improvised", async () => {
    const r = await defaultRegistry.execute("exec_command", { cmd: "rm -rf /" }, { callId: "t1" });
    assert.equal(r.ok, false);
    assert.match(r.output, /Unknown tool/);
    assert.match(r.output, /Available tools:/);
});

test("missing required arguments are reported with the expectation", async () => {
    const r = await defaultRegistry.execute("check_server_health", { service: "" }, { callId: "t2" });
    assert.equal(r.ok, false);
    assert.match(r.output, /Missing or empty 'service'/);
});

test("undeclared services are refused before any work happens", async () => {
    const r = await defaultRegistry.execute("check_server_health", { service: "prod-db-01" }, { callId: "t3" });
    assert.equal(r.ok, false);
    assert.match(r.output, /Unknown service/);
    assert.match(r.output, /Do not guess/);
});

test("line count is clamped rather than trusted", async () => {
    const r = await defaultRegistry.execute(
        "fetch_latest_logs",
        { service: "this-host", lines: 100000 },
        { callId: "t4" },
    );
    // Whether the log exists depends on the checkout; the clamp is what matters.
    assert.ok(r.output.length < 20_000);
});

test("non-allowlisted hosts are refused by scan_network", async () => {
    const r = await defaultRegistry.execute("scan_network", { host: "8.8.8.8" }, { callId: "t5" });
    assert.equal(r.ok, false);
    assert.match(r.output, /not in scanAllowlist/);
});

test("a write tool under propose_only policy needs approval and does not run", async () => {
    const r = await defaultRegistry.execute(
        "restart_service",
        { service: "this-host", reason: "test" },
        { callId: "t6", gate: proposeOnlyGate },
    );
    assert.equal(r.ok, false);
    assert.equal(r.needsApproval, true);
    assert.match(r.output, /propose_only/);
});

test("a pre-approved write bypasses the gate but still respects the allowlist", async () => {
    const allowed = await defaultRegistry.execute(
        "restart_service",
        { service: "this-host", reason: "test" },
        { callId: "t7", gate: alwaysAllowGate, approved: true },
    );
    // The service is fictional, so the manager fails; the point is that it got
    // as far as attempting it rather than being blocked by policy.
    assert.doesNotMatch(allowed.output, /propose_only/);

    const denied = await defaultRegistry.execute(
        "restart_service",
        { service: "not-declared", reason: "test" },
        { callId: "t8", gate: alwaysAllowGate, approved: true },
    );
    assert.equal(denied.ok, false);
    assert.match(denied.output, /not declared in fleet.yml/);
});

test("team-level tool restrictions are enforced", async () => {
    const r = await defaultRegistry.execute(
        "scan_network",
        { host: "localhost" },
        { callId: "t9", allowTools: ["check_server_health"] },
    );
    assert.equal(r.ok, false);
    assert.match(r.output, /not enabled for this team/);
});

test("schemas expose only the tools a team may use", () => {
    const names = defaultRegistry.schemas(["check_server_health"]).map((s) => s.name);
    assert.deepEqual(names, ["check_server_health"]);
});

test("every tool declares an effect, and exactly one mutates", () => {
    const tools = defaultRegistry.list();
    const writes = tools.filter((t) => t.effect === "write");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].name, "restart_service");
    for (const t of tools) {
        assert.ok(t.parameters && typeof t.parameters === "object", `${t.name} has no schema`);
        assert.ok(t.description.length > 20, `${t.name} description too thin for a model to choose on`);
    }
});
