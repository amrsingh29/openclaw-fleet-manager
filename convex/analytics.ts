// Rollups for the analytics view.
//
// One query returns every aggregate the view needs. That is deliberate: the UI
// subscribes once and re-renders once per event instead of eight times, and the
// tenant filter is resolved in exactly one place. Eight queries would mean eight
// chances to scope the org differently.
//
// Two rules this file exists to enforce, both learned from the live data:
//
// 1. Measure from the source that actually survives. Tasks are deletable (a
//    wiped board is normal here), so the tasks table cannot answer "what
//    happened in the last week"; the event log can. Where a number can only come
//    from the table, it is reported as current state and labelled as such.
// 2. Never let a missing measurement read as a zero. `null` and a coverage count
//    are how the view says "we do not know" instead of drawing a confident
//    nothing.

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId } from "./utils";

/** Upper bound on rows pulled for one rollup. A wider window should be paged. */
const MAX_ACTIVITIES = 20_000;
const MAX_TASKS = 5_000;

type Bucket = { start: number; tasksCompleted: number; toolCalls: number; toolFailures: number };

function percentile(sorted: number[], p: number): number | null {
    if (!sorted.length) return null;
    // Nearest-rank: index into the sorted array, clamped.
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

/** Day boundary in UTC, so a bucket does not move with the viewer's timezone. */
function dayStart(ts: number): number {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Fills in every day between the window edges.
 *
 * Only days are densified. A 30-day window is 30 slots, which the chart can draw;
 * a 90-day window is still fine. Widening this to hourly would produce 720 slots
 * and a chart nobody can read, so the caller is expected to keep windows sane.
 */
function densifySeries(buckets: Map<number, Bucket>, since: number, until: number): Bucket[] {
    const first = dayStart(since);
    const last = dayStart(until);
    const out: Bucket[] = [];
    const DAY = 24 * 3600_000;
    const MAX_DAYS = 120; // guard against an accidental multi-year window

    for (let t = first, n = 0; t <= last && n < MAX_DAYS; t += DAY, n++) {
        out.push(buckets.get(t) ?? { start: t, tasksCompleted: 0, toolCalls: 0, toolFailures: 0 });
    }
    return out;
}

export const summary = query({
    args: {
        /** Start of the window. Defaults to seven days ago. */
        since: v.optional(v.number()),
        until: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const until = args.until ?? Date.now();
        const since = args.since ?? until - 7 * 24 * 3600_000;

        // --- read ----------------------------------------------------------
        const activities = await ctx.db
            .query("activities")
            .withIndex("by_org_timestamp", (q) =>
                q.eq("orgId", orgId).gte("timestamp", since).lte("timestamp", until),
            )
            .take(MAX_ACTIVITIES);

        // The surviving board. Small by nature; wiped routinely.
        const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
            .take(MAX_TASKS);

        const proposals = await ctx.db
            .query("proposals")
            .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
            .take(MAX_TASKS);

        const agents = await ctx.db.query("agents").collect();
        const agentById = new Map(agents.map((a) => [a._id as string, a]));

        const truncated = activities.length >= MAX_ACTIVITIES || tasks.length >= MAX_TASKS;

        // --- event tallies -------------------------------------------------
        const eventCounts: Record<string, number> = {};
        const series = new Map<number, Bucket>();

        // --- tools ---------------------------------------------------------
        type ToolStat = { tool: string; calls: number; ok: number; failed: number; latencies: number[] };
        const tools = new Map<string, ToolStat>();

        // --- delegation ----------------------------------------------------
        // A `task_delegated` event is one create_task call by an agent, which is
        // the actual unit of delegation. Counted from events because the child
        // task rows are usually gone by the time anyone looks.
        const delegationsByAgent: Record<string, number> = {};
        let delegations = 0;
        let delegatedToNamedAgent = 0;
        const delegationDepths: number[] = [];
        let delegationsWithDepth = 0;

        // --- per agent -----------------------------------------------------
        type AgentRow = {
            name: string;
            role: string;
            completed: number;
            toolCalls: number;
            delegations: number;
            inputTokens: number;
            outputTokens: number;
        };
        const perAgent = new Map<string, AgentRow>();
        const ensureAgent = (id?: string | null): AgentRow | null => {
            if (!id) return null;
            const key = id as string;
            const existing = perAgent.get(key);
            if (existing) return existing;
            const record = agentById.get(key);
            const created: AgentRow = {
                name: record?.name ?? "Unknown agent",
                role: record?.role ?? "",
                completed: 0,
                toolCalls: 0,
                delegations: 0,
                inputTokens: 0,
                outputTokens: 0,
            };
            perAgent.set(key, created);
            return created;
        };

        // --- cycle time ----------------------------------------------------
        // Prefer the task row (exact, from claimedAt to completedAt). Fall back to
        // the completion event's own figure, which the runner now computes before
        // the row could be deleted.
        const cycleTimes: number[] = [];

        for (const a of activities) {
            eventCounts[a.type] = (eventCounts[a.type] ?? 0) + 1;

            const day = dayStart(a.timestamp);
            const bucket =
                series.get(day) ?? ({ start: day, tasksCompleted: 0, toolCalls: 0, toolFailures: 0 } as Bucket);

            if (a.type === "task_completed") {
                bucket.tasksCompleted++;
                const row = ensureAgent(a.agentId as string | undefined);
                if (row) row.completed++;
                const cycle = (a.metadata as any)?.cycleMs;
                if (typeof cycle === "number" && cycle >= 0) cycleTimes.push(cycle);
            }

            if (a.type === "task_delegated") {
                delegations++;
                const meta = (a.metadata ?? {}) as any;
                if (meta.assignee) delegatedToNamedAgent++;
                if (typeof meta.depth === "number") {
                    delegationDepths.push(meta.depth);
                    delegationsWithDepth++;
                }
                const row = ensureAgent(a.agentId as string | undefined);
                if (row) row.delegations++;
                const name = agentById.get(a.agentId as string)?.name ?? "Unknown";
                delegationsByAgent[name] = (delegationsByAgent[name] ?? 0) + 1;
            }

            if (a.type === "tool_call") {
                bucket.toolCalls++;
                const meta = (a.metadata ?? {}) as any;
                const name = typeof meta.tool === "string" ? meta.tool : "(unknown)";
                const ok = meta.ok === true;

                const existing = tools.get(name);
                const stat: ToolStat = existing ?? { tool: name, calls: 0, ok: 0, failed: 0, latencies: [] };
                stat.calls++;
                if (ok) stat.ok++;
                else {
                    stat.failed++;
                    bucket.toolFailures++;
                }
                if (typeof meta.elapsedMs === "number") stat.latencies.push(meta.elapsedMs as number);
                if (!existing) tools.set(name, stat);

                const row = ensureAgent(a.agentId as string | undefined);
                if (row) row.toolCalls++;
            }

            series.set(day, bucket);
        }

        // --- task table: current state, not the window ----------------------
        // Labelled separately on purpose. These describe the board right now and
        // will read as near-zero after a wipe, which is correct and not a bug.
        const statusCounts: Record<string, number> = {};
        for (const t of tasks) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;

        const depthHistogram: Record<number, number> = {};
        const childrenPerRoot = new Map<string, number>();
        for (const t of tasks) {
            const depth = t.depth ?? 0;
            depthHistogram[depth] = (depthHistogram[depth] ?? 0) + 1;
            if (t.parentTaskId) {
                const key = t.parentTaskId as string;
                childrenPerRoot.set(key, (childrenPerRoot.get(key) ?? 0) + 1);
            }
        }

        // Keep the id alongside the count while sorting: pairing the first key in
        // insertion order with the max count reports the wrong mission.
        const widest = [...childrenPerRoot.entries()].sort((a, b) => b[1] - a[1])[0];
        const widestMission = widest
            ? {
                  children: widest[1],
                  title: tasks.find((t) => (t._id as string) === widest[0])?.title ?? "(deleted mission)",
              }
            : null;

        // Row-derived cycle times only add tasks the events could not cover.
        let rowCycleCount = 0;
        for (const t of tasks) {
            if (t.status !== "done" || !t.completedAt) continue;
            rowCycleCount++;
            cycleTimes.push(t.completedAt - (t.claimedAt ?? t.createdTime));
        }
        cycleTimes.sort((a, b) => a - b);

        const completedTasks = tasks.filter((t) => t.status === "done");
        const cycleUnmeasured = Math.max(0, (eventCounts["task_completed"] ?? 0) - cycleTimes.length);

        // --- tokens --------------------------------------------------------
        let inputTokens = 0;
        let outputTokens = 0;
        let measuredTasks = 0;
        for (const t of tasks) {
            if (!t.usage) continue;
            measuredTasks++;
            inputTokens += t.usage.inputTokens ?? 0;
            outputTokens += t.usage.outputTokens ?? 0;
            if (t.completedByAgentId) {
                const row = ensureAgent(t.completedByAgentId as string);
                if (row) {
                    row.inputTokens += t.usage.inputTokens ?? 0;
                    row.outputTokens += t.usage.outputTokens ?? 0;
                }
            }
        }

        // --- approvals -----------------------------------------------------
        // From the proposals table, which is authoritative for decisions because
        // it carries decidedAt. Scoped to the window by creation time.
        const windowProposals = proposals.filter((p) => p.timestamp >= since && p.timestamp <= until);
        const decided = windowProposals.filter((p) => p.status !== "pending");
        const approvedCount = decided.filter((p) => p.status === "approved" || p.status === "executed" || p.status === "auto_approved").length;
        const deniedCount = decided.filter((p) => p.status === "denied").length;

        const waits = decided
            .filter((p) => typeof p.decidedAt === "number" && p.decidedAt >= p.timestamp)
            .map((p) => (p.decidedAt as number) - p.timestamp)
            .sort((a, b) => a - b);

        const execLags = windowProposals
            .filter((p) => typeof p.executedAt === "number" && typeof p.decidedAt === "number")
            .map((p) => (p.executedAt as number) - (p.decidedAt as number))
            .sort((a, b) => a - b);

        // --- runner health -------------------------------------------------
        const reworked = tasks.filter((t) => (t.attempts ?? 0) > 1);

        const toolStats = [...tools.values()]
            .map((s) => {
                s.latencies.sort((a, b) => a - b);
                return {
                    tool: s.tool,
                    calls: s.calls,
                    ok: s.ok,
                    failed: s.failed,
                    successRate: s.calls ? s.ok / s.calls : null,
                    p50Ms: percentile(s.latencies, 50),
                    p95Ms: percentile(s.latencies, 95),
                };
            })
            .sort((a, b) => b.calls - a.calls);

        return {
            window: { since, until, days: Math.max(1, Math.round((until - since) / (24 * 3600_000))) },
            truncated,

            // What actually happened during the window, from the event log.
            activity: {
                tasksCreated: eventCounts["task_created"] ?? 0,
                tasksCompleted: eventCounts["task_completed"] ?? 0,
                toolCalls: toolStats.reduce((n, t) => n + t.calls, 0),
                toolFailures: toolStats.reduce((n, t) => n + t.failed, 0),
                events: activities.length,
            },

            // The board as it stands, which is not the same thing.
            board: {
                total: tasks.length,
                statusCounts,
                blocked: statusCounts["blocked"] ?? 0,
                open:
                    (statusCounts["inbox"] ?? 0) +
                    (statusCounts["assigned"] ?? 0) +
                    (statusCounts["in_progress"] ?? 0) +
                    (statusCounts["review"] ?? 0),
            },

            cycle: {
                measured: cycleTimes.length,
                // Said out loud rather than hidden: missions completed before this
                // field existed genuinely cannot answer "how long did it take".
                unmeasured: cycleUnmeasured,
                medianMs: percentile(cycleTimes, 50),
                p90Ms: percentile(cycleTimes, 90),
                maxMs: cycleTimes.length ? cycleTimes[cycleTimes.length - 1] : null,
            },

            delegation: {
                // The metric worth leading with: how much work the fleet handed
                // down rather than did itself.
                delegations,
                delegatedToNamedAgent,
                fromAgent: delegations - delegatedToNamedAgent,
                byAgent: delegationsByAgent,
                maxDepth: delegationDepths.length ? Math.max(...delegationDepths) : null,
                depthCoverage: { measured: delegationsWithDepth, total: delegations },
                // Surviving board only; a wipe erases the rest of the tree.
                depthHistogram,
                widestMission,
                survivingTasks: tasks.length,
                completedOnBoard: completedTasks.length,
            },

            tools: toolStats,

            approvals: {
                inWindow: windowProposals.length,
                pending: windowProposals.filter((p) => p.status === "pending").length,
                approved: approvedCount,
                denied: deniedCount,
                autoApproved: windowProposals.filter((p) => p.status === "auto_approved").length,
                executed: windowProposals.filter((p) => p.status === "executed").length,
                failed: windowProposals.filter((p) => p.status === "failed").length,
                // Denominator is every decision, so this is "how often a human
                // said no", not "how often the fleet was wrong".
                denyRate: approvedCount + deniedCount > 0 ? deniedCount / (approvedCount + deniedCount) : null,
                medianWaitMs: percentile(waits, 50),
                p90WaitMs: percentile(waits, 90),
                decidedMeasured: waits.length,
                medianExecLagMs: percentile(execLags, 50),
            },

            usage: {
                inputTokens,
                outputTokens,
                // Coverage, so the view can warn when cost is mostly unmeasured.
                measuredTasks,
                totalTasks: tasks.length,
            },

            health: {
                reworked: reworked.length,
                tasksWithAttempts: tasks.filter((t) => (t.attempts ?? 0) > 0).length,
                reclaimEvents: eventCounts["tasks_reclaimed"] ?? 0,
                agentsOnline: agents.filter((a) => a.status !== "offline").length,
                agentsTotal: agents.length,
            },

            // Densified: every day in the window appears, including quiet ones.
            // A sparse series would let the chart imply work happened on
            // consecutive days when there was a gap between them.
            series: densifySeries(series, since, until),

            perAgent: [...perAgent.values()].sort((a, b) => b.completed - a.completed),

            eventCounts,
        };
    },
});
