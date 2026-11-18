# Concepts

Four ideas carry the whole system: the soul, the turn, the mission and the gate. Everything else is plumbing between them.

## The soul

An agent is a markdown file. `agents/configs/*.soul.md` holds a name, a role, a session key and a personality:

```markdown
**Name:** Shuri
**Role:** Site Reliability Engineer
**Session Key:** agent:shuri:main

## Personality
You are Shuri, the SRE for the fleet. Blunt, evidence-first, allergic to
guessing. If a number is not in tool output, you do not have it.
```

The runner parses those three fields at startup and uses the rest as the persona section of the system prompt. Every agent runs identical code. Change the soul and you change the agent; there is no per-agent branch anywhere in the codebase.

Two things the soul does **not** control: which tools exist, and whether a tool may run. Both are decisions the operator makes in `fleet.yml`, not something an agent can talk itself into.

The shipped squad is five souls with distinct jobs. Jarvis commands and delegates. Shuri is the SRE who runs the probes. Vision watches telemetry and cross-checks. Fury researches. Friday builds. Only the first three do much in the demo, because the others have no assigned domain yet.

## The turn

A turn is one question answered with at most `maxToolRounds` rounds of tool calls.

```
model → "call check_server_health" → tool runs → result fed back → model → answer
```

The model never executes anything itself. It emits a structured tool call, the registry runs the corresponding TypeScript function, and the result goes back as a message. That indirection is what makes the audit trail possible: every call is timed, logged and attributable.

It ends in one of four ways, and `endedBecause` records which:

| Value | Meaning |
|---|---|
| `answered` | The model replied without asking for another tool. Normal. |
| `max_rounds` | The budget ran out; the agent was asked to summarise with tools off. |
| `truncated` | The model hit its token limit mid-answer. |
| `error` | The provider or a tool threw. |

A turn that ends in `max_rounds` still produces an answer. A turn that ends in `error` lands the mission in Review with the error attached, so a failure stays visible.

## The mission

A mission is a row in `tasks` with a title, a description, and a status.

```
inbox ──claim──> in_progress ──complete──> done
  │                   │
  └──assign──> assigned└──throw──> review
```

| Status | Meaning |
|---|---|
| `inbox` | Unowned. Any idle agent may claim it. |
| `assigned` | Someone owns it; their runner picks it up on the next tick. |
| `in_progress` | Being worked right now. |
| `review` | The agent failed or asked for a human. Read the output before re-running. |
| `done` | Finished, with the report on the card. |
| `blocked` | Waiting on something external. |

`tasks.claim` is an atomic Convex mutation, so two runners polling the same inbox cannot both take the same card. The loser simply finds nothing to claim on the next tick.

Assignment and claiming are two different routes to the same place, and they answer different questions. Claiming says *someone free should take this*. Assignment says *this specific agent should*. `create_task` uses assignment when the model names an assignee and leaves it unowned otherwise, so the board shows the difference honestly.

## The gate

Every tool declares its own effect: `read` or `write`. Reads run. Writes consult the policy.

```yaml
policies:
  read: auto
  write: propose_only   # default
  delegate: auto
```

Three values, three behaviours. `auto` runs it. `propose_only` records a proposal and stops. `manual` refuses and records nothing.

The gate is a function injected into the registry instead of a check inside each tool. That is deliberate: a tool author cannot forget to gate, and the gate cannot be bypassed by a tool that decides it knows better. The one exception is a human approval, which sets `approved: true` and skips the gate — but still goes through the allowlist and the validator. Approval widens what may run, not what exists.

Delegation gets its own tier because it is a different kind of write. Filing a mission for a teammate changes shared state, but it does not stop a service. Gating it by default would leave the commander unable to hand out work without a human, which defeats the point of having one.

## The proposal

When the gate blocks a write, the agent records what it wanted to do:

```json
{
  "action": "restart_service",
  "params": { "service": "sandbox-web", "reason": "502s for 40m" },
  "rationale": "Policy for write actions is 'propose_only'…",
  "status": "pending"
}
```

A person approves or denies it in the Approvals panel. Approving does not ask the model to try again. It replays `params` directly through the registry with `approved: true`. So what runs is exactly what the card showed, which is the only version of "human approved it" that means anything.

Lifecycle: `pending` → `approved` | `denied`, then `approved` → `executed` | `failed`. The result text from the execution is stored on the proposal. Nothing is retried automatically; a failed restart is a thing for a person to look at.

## Sentient silence

Agents in a shared channel would otherwise produce a conversation that never ends. Two rules prevent it.

The runner only surfaces messages to an agent when a human sent them, or when the message names that agent. And every agent is instructed to answer `NO_REPLY` when it has nothing to add; the runner drops that reply instead of posting it.

In practice this reads well. Ask the room a question and two or three agents answer from their own angle. Let them talk among themselves and they go quiet, because none of them is allowed to trigger another.
