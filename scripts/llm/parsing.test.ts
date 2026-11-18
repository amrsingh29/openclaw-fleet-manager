// Argument parsing is where local models break in practice, so it gets its own
// tests. A malformed argument blob must never crash the runner: it should become
// a tool error the model can read and recover from.

import { test } from "node:test";
import assert from "node:assert/strict";

// parseArgs is not exported (it is an implementation detail), so this exercises
// it through the public provider surface by inspecting a tool call we construct.
// Kept as a behavioural check rather than a unit test of internals.
import { OpenAICompatibleProvider } from "./openai-compatible.js";

function providerReturning(toolArguments: unknown): OpenAICompatibleProvider {
    const p = new OpenAICompatibleProvider({
        baseUrl: "http://example.invalid/v1",
        model: "test-model",
        apiKey: "test",
    });
    // Stub fetch at the transport boundary: this is exactly what the provider
    // does, so the parsing path under test runs unchanged.
    (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
            JSON.stringify({
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: null,
                            tool_calls: [
                                { id: "call_1", type: "function", function: { name: "check_server_health", arguments: toolArguments } },
                            ],
                        },
                        finish_reason: "tool_calls",
                    },
                ],
            }),
    });
    return p;
}

test("plain JSON arguments parse", async () => {
    const p = providerReturning('{"service":"this-host"}');
    const res = await p.chat({ system: "s", messages: [{ role: "user", content: "go" }] });
    assert.equal(res.toolCalls.length, 1);
    assert.deepEqual(res.toolCalls[0].args, { service: "this-host" });
    assert.equal(res.stopReason, "tool_calls");
});

test("fenced JSON arguments parse (common local-model failure)", async () => {
    const p = providerReturning('```json\n{"service":"this-host"}\n```');
    const res = await p.chat({ system: "s", messages: [{ role: "user", content: "go" }] });
    assert.deepEqual(res.toolCalls[0].args, { service: "this-host" });
});

test("prose around the JSON object still parses", async () => {
    const p = providerReturning('Sure, I will call it: {"service":"this-host"} — done.');
    const res = await p.chat({ system: "s", messages: [{ role: "user", content: "go" }] });
    assert.deepEqual(res.toolCalls[0].args, { service: "this-host" });
});

test("unparseable arguments do not throw; they are surfaced for recovery", async () => {
    const p = providerReturning("service=this-host");
    const res = await p.chat({ system: "s", messages: [{ role: "user", content: "go" }] });
    assert.equal(res.toolCalls.length, 1);
    assert.ok("__unparsed" in res.toolCalls[0].args);
});

test("empty arguments become an empty object", async () => {
    const p = providerReturning("");
    const res = await p.chat({ system: "s", messages: [{ role: "user", content: "go" }] });
    assert.deepEqual(res.toolCalls[0].args, {});
});

test("no tool calls means a normal answer", async () => {
    const p = new OpenAICompatibleProvider({
        baseUrl: "http://example.invalid/v1",
        model: "test-model",
        apiKey: "test",
    });
    (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
            JSON.stringify({
                choices: [
                    { message: { role: "assistant", content: "All good." }, finish_reason: "stop" },
                ],
            }),
    });
    const res = await p.chat({ system: "s", messages: [{ role: "user", content: "hi" }] });
    assert.equal(res.text, "All good.");
    assert.equal(res.toolCalls.length, 0);
    assert.equal(res.stopReason, "stop");
});
