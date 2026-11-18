# Analytics dashboard

An operator view of what the fleet actually did, built from rows the agents already write. This
document records what the store contains, what blocks honest numbers, and the order to fix them in.

## Why the first refactor is data, not charts

Every chart here is a claim about the past. A cap in the read path or a field nobody writes turns
that claim into a lie that looks like a chart. Both problems exist today, and both are cheap to fix
before anything is drawn.

## What the store holds

Probed against the local deployment: six tasks, five agents, twenty visible activity rows (the cap
described below is why only twenty), one pending proposal.

| Table | Rows | Fields that carry analytics |
|---|---|---|
| `tasks` | 6, all `done` | `createdTime`, `lastUpdated`, `claimedAt`, `attempts`, `depth`, `parentTaskId`, `createdByAgentId`, `status`, `assigneeIds` |
| `agents` | 5 | `status`, `lastHeartbeat`, `role`, `teamId` |
| `activities` | event stream | `type`, `timestamp`, `agentId`, `metadata.{tool, ok, elapsedMs, taskId, output}` |
| `proposals` | 1 pending | `status`, `timestamp`, `decidedAt`, `decidedBy`, `cost` |
| `policies` | 8 | `actionType`, `policy`, `maxCost`, `minConfidence` |

Event types emitted by the code (`grep 'type: "'`, not a guess from the schema):

```
task_created       task_assigned      task_completed     task_delegated
tool_call          tasks_reclaimed    proposal_created   proposal_approved
proposal_denied    proposal_executed  proposal_failed    action_auto_executed
```

That is a real event vocabulary. It is enough to answer most questions an operator would ask, and it
matters that it came from the call sites: `proposals.ts` emits five types that a reader of the schema
alone would never find.

## Three defects that make today's numbers wrong

**1. The activity feed query is capped at 20 rows.**

`convex/activities.ts:10` — `.take(20)`. Any aggregate written against this query describes the last
twenty events while the label says "this week". Nothing downstream can be trusted until a range
query exists.

**2. Token usage is read from the provider and then discarded.**

Both adapters return it (`scripts/llm/openai-compatible.ts:131`, `scripts/llm/anthropic.ts:112`), and
`ChatResponse.usage` is typed in `scripts/llm/types.ts:50`. `runTurn` never reads the field, so the
loop drops it before it can be stored. `proposals.cost` is declared in the schema and no caller
writes it.

Cost per task is therefore a persistence problem, not a charting problem. Retrofitting recovers no
history, which is why it is in phase 0 rather than phase 3.

**3. There is no completion timestamp.**

Task duration currently has to be inferred from `claimedAt` → `lastUpdated`, and `lastUpdated` is
overwritten by every status change, including ones that happen after the work finished. Good enough
for a rough median, wrong for anything quoted to a customer.

Two smaller issues fixed in the same pass: `activities` has no index at all (every query filters and
sorts in memory), and `taskId` lives inside `metadata` rather than being a column, so activity cannot
be looked up by task through an index.

## Metrics that are computable once phase 0 lands

| Theme | Metric | Source |
|---|---|---|
| Throughput | Tasks completed per day, per agent, per team | `task_completed` events |
| Speed | Median and p90 cycle time, claim to complete | `claimedAt` → `completedAt` |
| Delegation | Depth histogram, children per mission, tasks created per agent | `depth`, `parentTaskId`, `createdByAgentId` |
| Tool reliability | Calls, success rate, p50/p95 latency, per tool | `tool_call` metadata |
| Approval funnel | Pending, approved, denied, auto-approved; human decision latency; deny rate | `proposals` |
| Runner health | `attempts` distribution, reclaim count, tasks parked as blocked | `attempts`, `tasks_reclaimed` |
| Cost | Tokens in and out per agent and per task, estimated spend | *requires defect 2 fixed* |

### The metric worth leading with

Delegation fan-out. The comment on `convex/schema.ts:38` names the failure mode that motivated the
field in the first place: a chain of agents re-delegating the same problem turned one mission into
45. Depth and parent were added so `create_task` could refuse before the swarm grew.

The ratio of child tasks to root missions, and the distribution of depth, is the number that shows
this system doing something a single agent cannot. It is also already recorded, so it costs nothing
to display.

### Quality proxies, honestly labelled

Output length is not quality, and a word count chart invites the wrong conclusion. The two defensible
proxies both mean "this went wrong":

- `attempts > 1` — the task was abandoned by a dead or hung runner and reissued.
- status `blocked` — repeated abandonment, parked for a human.

Present both as *rework*, and say what they measure.

## Phases

### Phase 0 — make the data trustworthy *(done)*

No UI. What landed:

- `activities.range` — bounded window query with `since`/`until`/`take`. `activities.list` keeps its
  small cap on purpose and now reads through the index instead of sorting in memory.
- Indexes `by_org_timestamp` and `by_task` on `activities`, plus `by_org_created` and `by_org_status`
  on `tasks`.
- `taskId` promoted to a real column on `activities` and written by every logger: task lifecycle,
  tool calls, delegation, and all five proposal events. The backend interface grew a `taskId` field
  so tools can attribute events without reaching into metadata.
- `completedAt` and `completedByAgentId` on `tasks`. `complete` stamps the first finish time, and
  `updateStatus` stamps it too when a human drags a card to Done, because that path never passes
  through `complete`. Both guard on "not already set", so reopening and re-closing a card cannot
  move the timestamp.
- `usage` threaded provider → `runTurn` → `turn.usage` → `AgentBrain.work` → `tasks.complete`, stored
  on the task and on the completion event. `runTurn` now accumulates across rounds, including the
  summary call, because each round is a separate response with its own usage.

Verified against the live deployment, not just compiled:

```
task fields: completedAt=1794969666651, byAgent=true, usage={"inputTokens":1234,...}
completedAt stable across updateStatus: true
task_completed  taskId=set  meta={"attempts":1,"cycleMs":5,"depth":0,"usage":{...}}
```

`npm test` 36/36, both `tsc -p` projects clean.

Deliberately not done: `proposals.cost` is still unwritten. It needs a price table (per-model rates)
that the repo does not have, and a made-up rate would be a fabricated number. Token counts are now
recorded, so cost becomes a multiplication the moment rates are supplied.

### Phase 0b — the price table

Small. Add per-model input/output rates to `fleet.yml`, then compute cost from the recorded `usage`
on read. Doing it on read rather than on write means a rate correction fixes history instead of
leaving a trail of stale figures.

### Phase 1 — one rollup query *(done)*

`convex/analytics.ts`, a single org-scoped query returning every aggregate in one round trip. The
view subscribes once and re-renders once per event, and the tenant filter is resolved in exactly one
place.

Running it against the live 705-event dataset changed the design twice, and both changes were
corrections to real mistakes rather than polish:

**Events and table rows are not interchangeable.** The first version reported `tasksCompleted: 116`
next to `tasksCreated: 6`, because completion came from the event log and creation came from the
tasks table. The board had been wiped between runs, so 120 creates survived only as events. The two
figures are now reported as separate things: `activity` (what happened in the window, from events)
and `board` (what exists right now, from rows). A number that describes the board is labelled as
such.

**Delegation had to be counted from events.** The first version counted child rows by
`parentTaskId`, and returned `delegated: 0` while 62 `task_delegated` events sat in the log. A
`task_delegated` event is one `create_task` call, which is the actual unit of delegation, and it
survives the board being wiped. That is now the source.

The query also reports coverage rather than assuming completeness: `cycle.unmeasured` says how many
completions cannot answer "how long did it take", and `usage.measuredTasks` says how many missions
carry token figures.

### Phase 2 — the view *(done)*

`Analytics.tsx` plus four chart primitives in `mission-control-dashboard/src/components/charts/`.
New `analytics` value on `currentView` in `App.tsx` and a sidebar entry beside Dashboard and War Room.
Window toggle for 24h / 7d / 30d. Light and dark both verified by screenshot.

Hand-rolled SVG and flex boxes rather than a chart library: the bundle is already 683 kB against
Vite's 500 kB warning, and the shapes needed are bars, a donut and columns.

One rendering bug worth recording, because it is the kind that gets shipped: the first
`ColumnSeries` was SVG scaled with `preserveAspectRatio="none"`, which made a two-point series draw
two 120px-wide bars and read as a broken chart. It now uses flex columns with no coordinate space to
scale. Related: the series is densified server-side so a quiet day appears as an empty slot instead
of being omitted, since omitting it would compress the timeline into a false claim about when work
happened.

Target is `mission-control-dashboard/` — the Vite app the README calls supported. `mission-control-v2`
drifts from this backend and is out of scope.

## Two things to settle before phase 2

**Small data.** Six tasks render as a flat line with one dot. The dashboard needs a seeded history or
an explicit demo mode before it is shown to anyone. A seeded dataset of a few hundred synthetic
missions with plausible depth and latency distributions makes the view honest as a demo and is
clearly labelled as seed data.

**Charts.** Hand-rolled SVG matches the existing glassmorphic components and keeps the bundle where
it is; the app already ships 664 kB against Vite's 500 kB warning, so pulling in a chart library has
a real cost. The shapes needed are bars, a sparkline, a donut and a histogram.
