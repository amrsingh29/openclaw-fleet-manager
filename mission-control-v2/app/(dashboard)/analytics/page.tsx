"use client";

// The analytics view.
//
// One subscription to analytics.summary. Every panel reads from that one object,
// so the whole page updates together and cannot show two panels disagreeing about
// the same window.
//
// The layout is ordered by what the numbers are for: what the fleet did, where the
// work went, whether the tools held up, and how the approval loop behaved. Wherever
// the data cannot answer a question, the panel says so in place of a number rather
// than drawing a reassuring zero.

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "next-themes";
import {
    BarList,
    ColumnSeries,
    Gauge,
    Panel,
    Stat,
    formatCount,
    formatDuration,
    formatPercent,
} from "@/components/dashboard/charts/primitives";
import { RefreshCw, TrendingUp, GitBranch, Wrench, ShieldCheck, Activity, AlertTriangle } from "lucide-react";

const WINDOWS = [
    { label: "24h", days: 1 },
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
] as const;

export default function AnalyticsPage() {
    const { resolvedTheme } = useTheme();
    const dark = resolvedTheme !== "light";
    const [days, setDays] = useState<number>(7);

    // Recomputed only when the window changes, so the query arg is stable and
    // Convex does not resubscribe on every render.
    const since = useMemo(() => Date.now() - days * 24 * 3600_000, [days]);
    const data = useQuery(api.analytics.summary, { since });

    if (data === undefined) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500">Loading analytics…</p>
            </div>
        );
    }

    const { activity, board, cycle, delegation, tools, approvals, usage, health, series, perAgent } = data;

    // A task that closes without tokens is unmeasured, not free. Saying so is the
    // difference between an honest dashboard and a flattering one.
    const usageCoverage = usage.totalTasks > 0 ? usage.measuredTasks / usage.totalTasks : null;
    const totalTokens = usage.inputTokens + usage.outputTokens;

    const delegationRows = Object.entries(delegation.byAgent)
        .map(([label, value]) => ({ label, value: value as number }))
        .sort((a, b) => b.value - a.value);

    return (
        <div className="h-full overflow-y-auto no-scrollbar">
            <div className="mx-auto max-w-[1400px] px-6 py-6">
                {/* Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className={`flex items-center gap-2 text-lg font-bold ${dark ? "text-white" : "text-slate-900"}`}>
                            <TrendingUp className="h-5 w-5 text-cyan-500" />
                            Fleet Analytics
                        </h1>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {activity.events.toLocaleString()} events in the last {data.window.days} day
                            {data.window.days === 1 ? "" : "s"}
                            {data.truncated && " · window truncated, narrow the range for exact figures"}
                        </p>
                    </div>

                    <div className={`flex items-center gap-1 rounded-lg border p-0.5 ${dark ? "border-white/10" : "border-slate-200"}`}>
                        {WINDOWS.map((w) => (
                            <button
                                key={w.label}
                                onClick={() => setDays(w.days)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    days === w.days
                                        ? "bg-cyan-500/15 text-cyan-400"
                                        : dark
                                          ? "text-slate-400 hover:text-white"
                                          : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                {w.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Headline */}
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat
                        label="Missions completed"
                        value={formatCount(activity.tasksCompleted)}
                        sub={`${formatCount(activity.tasksCreated)} created`}
                    />
                    <Stat
                        label="Delegations"
                        value={formatCount(delegation.delegations)}
                        sub={`${delegation.fromAgent} filed to the inbox`}
                    />
                    <Stat
                        label="Tool calls"
                        value={formatCount(activity.toolCalls)}
                        sub={`${activity.toolFailures} failed`}
                    />
                    <Stat
                        label="Median cycle time"
                        value={formatDuration(cycle.medianMs)}
                        sub={cycle.unmeasured > 0 ? `${cycle.unmeasured} unmeasured` : "claim to done"}
                        tone={cycle.medianMs === null ? "warn" : "default"}
                    />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {/* Throughput */}
                    <div className="xl:col-span-2">
                        <Panel
                            title="Missions completed per day"
                            subtitle="From the event log, so a wiped board does not erase the history"
                            right={<Activity className="h-4 w-4 text-slate-500" />}
                        >
                            <ColumnSeries points={series.map((s) => ({ start: s.start, value: s.tasksCompleted }))} />
                        </Panel>
                    </div>

                    {/* Tool health */}
                    <Panel title="Tool reliability" subtitle="Success rate across every call">
                        <div className="flex items-center justify-around">
                            <Gauge
                                ratio={activity.toolCalls ? (activity.toolCalls - activity.toolFailures) / activity.toolCalls : null}
                                caption="all tools"
                            />
                            <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-cyan-500" />
                                    <span className={dark ? "text-slate-300" : "text-slate-700"}>
                                        {formatCount(activity.toolCalls - activity.toolFailures)} ok
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-red-500" />
                                    <span className={dark ? "text-slate-300" : "text-slate-700"}>
                                        {formatCount(activity.toolFailures)} failed
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Delegation — the metric this product is for */}
                <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Panel
                        title="Delegation by agent"
                        subtitle="create_task calls, i.e. work handed to a teammate rather than done directly"
                        right={<GitBranch className="h-4 w-4 text-slate-500" />}
                    >
                        <BarList rows={delegationRows} emptyMessage="No agent delegated any work in this window." />

                        <div
                            className={`mt-4 space-y-1 border-t pt-3 text-xs ${
                                dark ? "border-white/5 text-slate-400" : "border-slate-100 text-slate-600"
                            }`}
                        >
                            <div className="flex justify-between">
                                <span>Assigned to a named agent</span>
                                <span className="tabular-nums">{delegation.delegatedToNamedAgent}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Filed to the inbox</span>
                                <span className="tabular-nums">{delegation.fromAgent}</span>
                            </div>
                            {delegation.widestMission && (
                                <div className="flex justify-between gap-4">
                                    <span className="truncate">Widest surviving mission</span>
                                    <span className="flex-none tabular-nums">
                                        {delegation.widestMission.children} children
                                    </span>
                                </div>
                            )}
                        </div>
                    </Panel>

                    <Panel
                        title="Work distribution"
                        subtitle="What each agent finished and ran, from the event log"
                        right={<Activity className="h-4 w-4 text-slate-500" />}
                    >
                        {perAgent.length === 0 ? (
                            <p className="text-xs text-slate-500">No agent activity.</p>
                        ) : (
                            <div className="overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="text-slate-500">
                                            <th className="pb-2 font-medium">Agent</th>
                                            <th className="pb-2 text-right font-medium">Done</th>
                                            <th className="pb-2 text-right font-medium">Tools</th>
                                            <th className="pb-2 text-right font-medium">Delegated</th>
                                            <th className="pb-2 text-right font-medium">Tokens</th>
                                        </tr>
                                    </thead>
                                    <tbody className={dark ? "text-slate-300" : "text-slate-700"}>
                                        {perAgent.map((a) => (
                                            <tr
                                                key={a.name}
                                                className={`border-t ${dark ? "border-white/5" : "border-slate-100"}`}
                                            >
                                                <td className="py-1.5">
                                                    <div className="font-medium">{a.name}</div>
                                                    <div className="text-[10px] text-slate-500">{a.role}</div>
                                                </td>
                                                <td className="py-1.5 text-right tabular-nums">{a.completed}</td>
                                                <td className="py-1.5 text-right tabular-nums">{a.toolCalls}</td>
                                                <td className="py-1.5 text-right tabular-nums">{a.delegations}</td>
                                                <td className="py-1.5 text-right tabular-nums">
                                                    {a.inputTokens + a.outputTokens > 0
                                                        ? formatCount(a.inputTokens + a.outputTokens)
                                                        : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </div>

                {/* Tools + approvals */}
                <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Panel
                        title="Per-tool breakdown"
                        subtitle="Calls, failure rate and latency, by tool"
                        right={<Wrench className="h-4 w-4 text-slate-500" />}
                    >
                        {tools.length === 0 ? (
                            <p className="text-xs text-slate-500">No tool calls in this window.</p>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-slate-500">
                                        <th className="pb-2 font-medium">Tool</th>
                                        <th className="pb-2 text-right font-medium">Calls</th>
                                        <th className="pb-2 text-right font-medium">Success</th>
                                        <th className="pb-2 text-right font-medium">p50</th>
                                        <th className="pb-2 text-right font-medium">p95</th>
                                    </tr>
                                </thead>
                                <tbody className={dark ? "text-slate-300" : "text-slate-700"}>
                                    {tools.map((t) => (
                                        <tr key={t.tool} className={`border-t ${dark ? "border-white/5" : "border-slate-100"}`}>
                                            <td className="py-1.5 font-mono text-[11px]">{t.tool}</td>
                                            <td className="py-1.5 text-right tabular-nums">{t.calls}</td>
                                            <td
                                                className={`py-1.5 text-right tabular-nums ${
                                                    t.successRate !== null && t.successRate < 0.8 ? "text-red-400" : ""
                                                }`}
                                            >
                                                {formatPercent(t.successRate)}
                                            </td>
                                            <td className="py-1.5 text-right tabular-nums">{formatDuration(t.p50Ms)}</td>
                                            <td className="py-1.5 text-right tabular-nums">{formatDuration(t.p95Ms)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Panel>

                    <Panel
                        title="Approval loop"
                        subtitle="What needed a human, and how long it took"
                        right={<ShieldCheck className="h-4 w-4 text-slate-500" />}
                    >
                        <div className="mb-4 grid grid-cols-3 gap-2">
                            <div>
                                <div className={`text-lg font-bold tabular-nums ${dark ? "text-white" : "text-slate-900"}`}>
                                    {approvals.inWindow}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">raised</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold tabular-nums text-cyan-400">{approvals.approved}</div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">approved</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold tabular-nums text-red-400">{approvals.denied}</div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">denied</div>
                            </div>
                        </div>

                        <div
                            className={`space-y-1 border-t pt-3 text-xs ${
                                dark ? "border-white/5 text-slate-400" : "border-slate-100 text-slate-600"
                            }`}
                        >
                            <div className="flex justify-between">
                                <span>Deny rate</span>
                                <span className="tabular-nums">{formatPercent(approvals.denyRate)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Median wait for a human</span>
                                <span className="tabular-nums">{formatDuration(approvals.medianWaitMs)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>p90 wait</span>
                                <span className="tabular-nums">{formatDuration(approvals.p90WaitMs)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Executed / failed</span>
                                <span className="tabular-nums">
                                    {approvals.executed} / {approvals.failed}
                                </span>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Current state + cost + health */}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <Panel title="Board right now" subtitle="Live task rows, not the window">
                        <BarList
                            rows={Object.entries(board.statusCounts)
                                .map(([label, value]) => ({ label, value: value as number }))
                                .sort((a, b) => b.value - a.value)}
                            emptyMessage="The board is empty."
                        />
                        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                            {board.total} task row{board.total === 1 ? "" : "s"} survive on the board.
                            {activity.tasksCreated > board.total &&
                                ` ${activity.tasksCreated - board.total} created in this window have since been removed, which is why headline figures come from the event log.`}
                        </p>
                    </Panel>

                    <Panel title="Token usage" subtitle="Recorded per mission since this was instrumented">
                        {usage.measuredTasks === 0 ? (
                            <>
                                <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-600"}`}>
                                    No measured missions yet.
                                </p>
                                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                                    Usage is captured from the next mission each runner completes. Missions finished
                                    before that cannot report tokens, so this panel stays empty rather than showing a
                                    confident zero.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className={`text-2xl font-bold tabular-nums ${dark ? "text-white" : "text-slate-900"}`}>
                                    {formatCount(totalTokens)}
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {formatCount(usage.inputTokens)} in, {formatCount(usage.outputTokens)} out
                                </p>
                                <div
                                    className={`mt-3 space-y-1 border-t pt-3 text-xs ${
                                        dark ? "border-white/5 text-slate-400" : "border-slate-100 text-slate-600"
                                    }`}
                                >
                                    <div className="flex justify-between">
                                        <span>Missions measured</span>
                                        <span className="tabular-nums">
                                            {usage.measuredTasks} / {usage.totalTasks}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Coverage</span>
                                        <span className="tabular-nums">{formatPercent(usageCoverage)}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </Panel>

                    <Panel title="Runner health" subtitle="Rework is the honest quality proxy">
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className={dark ? "text-slate-400" : "text-slate-600"}>
                                    <RefreshCw className="mr-1 inline h-3 w-3" />
                                    Reworked (attempts &gt; 1)
                                </span>
                                <span className={`tabular-nums ${health.reworked > 0 ? "text-amber-400" : ""}`}>
                                    {health.reworked}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={dark ? "text-slate-400" : "text-slate-600"}>
                                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                                    Lease reclaim sweeps
                                </span>
                                <span className="tabular-nums">{health.reclaimEvents}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={dark ? "text-slate-400" : "text-slate-600"}>
                                    Blocked, needs a human
                                </span>
                                <span className={`tabular-nums ${board.blocked > 0 ? "text-red-400" : ""}`}>
                                    {board.blocked}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={dark ? "text-slate-400" : "text-slate-600"}>Agents online</span>
                                <span className="tabular-nums">
                                    {health.agentsOnline} / {health.agentsTotal}
                                </span>
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
