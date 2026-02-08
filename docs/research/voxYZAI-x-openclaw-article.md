# I Built an AI Company with OpenClaw + Vercel + Supabase

> **Source**: [Twitter/X Post](https://x.com/Voxyz_ai/status/2019914775061270747)
> **Author**: VoxYZ AI

6 AI agents, 1 VPS, 1 Supabase database — going from "agents can talk" to "agents run the website autonomously" took me two weeks. This article covers exactly what's missing in between, how to fix it, and an architecture you can take home and use.

## Starting Point: You Have OpenClaw. Now What?

If you've been playing with AI agents recently, chances are you already have OpenClaw set up. It solves a big problem: letting Claude use tools, browse the web, operate files, and run scheduled tasks. You can assign cron jobs to agents — daily tweets, hourly intel scans, periodic research reports.

That's where I started too. My project is called **VoxYZ Agent World** — 6 AI agents autonomously operating a website from inside a pixel-art office. The tech stack is simple:

*   **OpenClaw (on VPS)**: The agents' "brain" — runs roundtable discussions, cron jobs, deep research.
*   **Next.js + Vercel**: Website frontend + API layer.
*   **Supabase**: Single source of truth for all state (proposals, missions, events, memories).

### Six roles, each with a job:
*   **Minion**: Makes decisions.
*   **Sage**: Analyzes strategy.
*   **Scout**: Gathers intel.
*   **Quill**: Writes content.
*   **Xalt**: Manages social media.
*   **Observer**: Does quality checks.

OpenClaw's cron jobs get them to "show up for work" every day. **Roundtable** lets them discuss, vote, and reach consensus. But that's just "can talk," not "can operate."

Everything the agents produce — drafted tweets, analysis reports, content pieces — stays in OpenClaw's output layer. Nothing turns it into actual execution, and nothing tells the system "done" after execution completes. Between "agents can produce output" and "agents can run things end-to-end," there's a full **execute → feedback → re-trigger loop** missing.

---

## What a Closed Loop Looks Like

A truly unattended agent system needs this cycle running:

1.  Agent proposes an idea (**Proposal**)
2.  Auto-approval check (**Auto-Approve**)
3.  Create mission + steps (**Mission + Steps**)
4.  Worker claims and executes (**Worker**)
5.  Emit event (**Event**)
6.  Trigger new reactions (**Trigger / Reaction**)
7.  Repeat.

---

## Pitfall 1: Two Places Fighting Over Work

My VPS had OpenClaw workers claiming and executing tasks. At the same time, Vercel had a heartbeat cron running mission-worker, also trying to claim the same tasks. No coordination, pure race condition.

**Fix**: Cut one. VPS is the sole executor. Vercel only runs the lightweight control plane (evaluate triggers, process reaction queue, clean up stuck tasks).

```javascript
// Heartbeat now does only 4 things
const triggerResult = await evaluateTriggers(sb, 4_000);
const reactionResult = await processReactionQueue(sb, 3_000);
const learningResult = await promoteInsights(sb);
const staleResult = await recoverStaleSteps(sb);
```

---

## Pitfall 2: Triggered But Nobody Picked It Up

Triggers were directly inserting into the `ops_mission_proposals` table, but the normal approval flow was being skipped.

**Fix**: Extract a shared function `createProposalAndMaybeAutoApprove`. Every path that creates a proposal — API, triggers, reactions — must call this one function.

```typescript
// proposal-service.ts — the single entry point
export async function createProposalAndMaybeAutoApprove(
  sb: SupabaseClient,
  input: ProposalServiceInput,
) {
  // 1. Check daily limit
  // 2. Check Cap Gates
  // 3. Insert proposal
  // 4. Emit event
  // 5. Evaluate auto-approve
  // 6. If approved → create mission + steps
}
```

---

## Pitfall 3: Queue Keeps Growing When Quota Is Full

Tweet quota was full, but proposals were still being approved, generating missions and queued steps. The worker saw the quota was full and just skipped, leading to a massive backlog.

**Fix**: **Cap Gates** — reject at the proposal entry point. Don't let it generate queued steps in the first place.

```javascript
const STEP_KIND_GATES = {
  write_content: checkWriteContentGate,
  post_tweet:    checkPostTweetGate,
  deploy:        checkDeployGate,
};
```

---

## Making It Alive: Triggers + Reaction Matrix

### Triggers
4 built-in rules — each detects a condition and returns a proposal template:

| Condition | Action | Cooldown |
| :--- | :--- | :--- |
| Tweet engagement > 5% | Growth analyzes viral factor | 2 hours |
| Mission failed | Sage diagnoses root cause | 1 hour |
| New content published | Observer reviews quality | 2 hours |
| Insight upvoted | Auto-promote to memory | 4 hours |

### Reaction Matrix
Spontaneous inter-agent interaction stored in `ops_policy`:

```json
{
  "patterns": [
    { "source": "twitter-alt", "tags": ["tweet","posted"], "target": "growth", "type": "analyze", "probability": 0.3 },
    { "source": "*", "tags": ["mission:failed"], "target": "brain", "type": "diagnose", "probability": 1.0 }
  ]
}
```

---

## Full Architecture

Three layers with clear responsibilities:
1.  **OpenClaw (VPS)**: Think + Execute (brain + hands)
2.  **Vercel**: Approve + Monitor (control plane)
3.  **Supabase**: All state (shared cortex)

---

# Internal Analysis: OpenClaw Fleet Manager vs. VoxYZ

To evolve our Fleet Manager toward this "Autonomous Enterprise" model, we should evaluate the following architectural shifts.

## 1. Feature Comparison

| Feature | OpenClaw Fleet Manager (Current) | VoxYZ (Autonomous) |
| :--- | :--- | :--- |
| **Data Layer** | **Convex**: Real-time sync & polling. | **Supabase**: Relational state & Heartbeat cron. |
| **Logic Layer** | **Command-first**: User-driven tasks. | **Proposal-first**: Autonomous proposals + Cap Gates. |
| **Control Plane** | Integrated in UI/Runners. | Decoupled (Vercel API routes as Auditor). |
| **Claiming** | Atomic DB Mutations (Native). | Soft-locking (Coordination needed). |

## 2. Collaboration Models

*   **The Roundtable Model**: VoxYZ uses a voting system for agents to reach consensus before acting. Our current model is more direct (Lead assigns to Specialist).
*   **Event-Driven Reactions**: VoxYZ agents react to state changes (e.g., a viral tweet) rather than just `@mentions`. This makes the "War Room" proactive.
*   **The Auditor Loop**: VoxYZ has a specific "Self-Healing" routine (`recoverStaleSteps`) that ensures the system doesn't get stuck if a VPS runner blips.

## 3. Implementation Lessons for Our Project

1.  **Adopt the "Proposal" Pattern**: Instead of creating a task directly, create a `proposal` that checks against an `ops_policy` (quotas, allowed tools, sanity checks).
2.  **Implement a Heartbeat Auditor**: Create a background process in Convex/Next.js that looks for "Stale" tasks (in progress for >30 mins) and identifies root causes.
3.  **Add Probability-Based Reactions**: Introduce a "Reaction Matrix" where agents occasionally contribute to local context without being specifically asked, increasing the "aliveness" of the War Room.
4.  **Cap Gates**: Implement hard limits on tool usage (e.g., daily API budgets) at the task creation stage to prevent automated loops from draining resources.
