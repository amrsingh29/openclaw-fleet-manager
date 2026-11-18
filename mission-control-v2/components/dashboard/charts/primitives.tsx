"use client";

// Four chart shapes, hand-rolled.
//
// A chart library would be ~100 kB for shapes this small. These use the same
// approach as the rest of v2: Tailwind classes plus next-themes, no CSS variables
// and no external scales, so nothing here needs a theme prop drilled through.
//
// Every component is a pure function of its props. No chart invents a point: a
// series with one entry draws one bar, and an empty series says so.

import { useTheme } from "next-themes";

const AXIS = { dark: "#334155", light: "#e2e8f0" } as const;
const LABEL = { dark: "#94a3b8", light: "#64748b" } as const;
const ACCENT = "#06b6d4";
const WARN = "#f59e0b";
const BAD = "#ef4444";

/** next-themes reports undefined until mounted; treat that as dark (the default). */
function useIsDark(): boolean {
    const { resolvedTheme } = useTheme();
    return resolvedTheme !== "light";
}

/** Formats a duration without pretending to a precision the data lacks. */
export function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = s / 60;
    if (m < 60) return `${Math.round(m)}m`;
    const h = m / 60;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
}

export function formatCount(n: number | null | undefined): string {
    if (n === null || n === undefined) return "—";
    if (n < 1000) return String(n);
    return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}

/** Percentages stay integers below 10% so a 0.4% failure is not rounded to 0. */
export function formatPercent(ratio: number | null | undefined): string {
    if (ratio === null || ratio === undefined) return "—";
    const pct = ratio * 100;
    if (pct > 0 && pct < 1) return "<1%";
    return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

export function Stat({
    label,
    value,
    sub,
    tone = "default",
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: "default" | "warn" | "bad";
}) {
    const dark = useIsDark();
    const toneClass =
        tone === "bad"
            ? "text-red-400"
            : tone === "warn"
              ? "text-amber-400"
              : dark
                ? "text-white"
                : "text-slate-900";

    return (
        <div
            className={`rounded-xl border p-4 backdrop-blur-md ${
                dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
            }`}
        >
            <div
                className={`text-xs font-semibold uppercase tracking-wider ${
                    dark ? "text-slate-500" : "text-slate-400"
                }`}
            >
                {label}
            </div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
            {sub && <div className={`mt-0.5 text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>{sub}</div>}
        </div>
    );
}

export function Panel({
    title,
    subtitle,
    right,
    children,
}: {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    const dark = useIsDark();
    return (
        <div className={`rounded-xl border backdrop-blur-md ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
            <div
                className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${
                    dark ? "border-white/5" : "border-slate-100"
                }`}
            >
                <div>
                    <h3 className={`text-sm font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>{title}</h3>
                    {subtitle && <p className={`mt-0.5 text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>{subtitle}</p>}
                </div>
                {right}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

/** Horizontal bars with a label and a right-aligned value. */
export function BarList({
    rows,
    emptyMessage = "No data in this window.",
    tone = "accent",
}: {
    rows: { label: string; value: number; hint?: string }[];
    emptyMessage?: string;
    tone?: "accent" | "warn";
}) {
    const dark = useIsDark();
    if (!rows.length) {
        return <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>{emptyMessage}</p>;
    }
    const max = Math.max(...rows.map((r) => r.value), 1);
    const fill = tone === "warn" ? WARN : ACCENT;

    return (
        <div className="space-y-2">
            {rows.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                    <div
                        className={`w-28 flex-none truncate text-xs ${dark ? "text-slate-400" : "text-slate-600"}`}
                        title={r.label}
                    >
                        {r.label}
                    </div>
                    <div className={`h-2 flex-1 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-slate-100"}`}>
                        <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: fill }}
                        />
                    </div>
                    <div
                        className={`w-14 flex-none text-right text-xs tabular-nums ${
                            dark ? "text-slate-300" : "text-slate-700"
                        }`}
                    >
                        {r.hint ?? formatCount(r.value)}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Daily columns, drawn with flex boxes rather than SVG.
 *
 * SVG needs a fixed coordinate space, and stretching one to the container via
 * preserveAspectRatio="none" makes bar widths meaningless. Flex columns are
 * responsive by construction and need no scale maths.
 *
 * A day with no completions is drawn as an empty slot, not skipped: "nothing
 * finished on Tuesday" is information, and omitting the day would compress the
 * timeline into a lie about when the work happened.
 */
export function ColumnSeries({
    points,
    label = "per day",
    height = 96,
}: {
    points: { start: number; value: number }[];
    label?: string;
    height?: number;
}) {
    const dark = useIsDark();
    const palette = dark ? "dark" : "light";

    if (!points.length) {
        return (
            <div className="flex h-24 items-center justify-center text-xs" style={{ color: LABEL[palette] }}>
                No activity in this window.
            </div>
        );
    }

    const max = Math.max(...points.map((p) => p.value), 1);

    return (
        <div>
            <div className="flex items-stretch gap-1.5" style={{ height }}>
                {points.map((p) => {
                    // A zero day gets no fill, but it does get its slot drawn, so
                    // the chart reads as "eight days, mostly quiet" rather than as
                    // one lonely bar floating in whitespace.
                    const h = p.value === 0 ? 0 : Math.max(3, (p.value / max) * (height - 6));
                    const title = `${new Date(p.start).toISOString().slice(0, 10)}: ${p.value} completed`;
                    return (
                        <div
                            key={p.start}
                            className="relative flex flex-1 flex-col justify-end rounded-sm"
                            // The track behind every slot is what makes a quiet day
                            // visible as a slot instead of as empty space.
                            style={{ backgroundColor: dark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)" }}
                            title={title}
                        >
                            {h > 0 && (
                                <div
                                    className="w-full rounded-sm transition-all"
                                    style={{ height: h, backgroundColor: ACCENT, opacity: 0.85 }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-1 h-px w-full" style={{ backgroundColor: AXIS[palette] }} />
            <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: LABEL[palette] }}>
                <span>{new Date(points[0].start).toISOString().slice(5, 10)}</span>
                <span>
                    {label} · max {max}
                </span>
                <span>{new Date(points[points.length - 1].start).toISOString().slice(5, 10)}</span>
            </div>
        </div>
    );
}

/**
 * A single ratio as an arc. Used for success rate, where the useful information is
 * "how far from perfect" rather than the raw count.
 */
export function Gauge({ ratio, caption, size = 84 }: { ratio: number | null; caption: string; size?: number }) {
    const dark = useIsDark();
    const palette = dark ? "dark" : "light";

    if (ratio === null) {
        return (
            <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
                <span className="text-xs" style={{ color: LABEL[palette] }}>
                    no data
                </span>
                <span className="mt-1 text-[10px]" style={{ color: LABEL[palette] }}>
                    {caption}
                </span>
            </div>
        );
    }

    const r = size / 2 - 6;
    const circumference = 2 * Math.PI * r;
    const filled = circumference * Math.min(1, Math.max(0, ratio));
    const colour = ratio >= 0.95 ? ACCENT : ratio >= 0.8 ? WARN : BAD;

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={AXIS[palette]} strokeWidth="6" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={colour}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${circumference - filled}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={dark ? "#e2e8f0" : "#0f172a"}
                    fontSize="15"
                    fontWeight="700"
                >
                    {formatPercent(ratio)}
                </text>
            </svg>
            <span className="mt-1 text-[10px]" style={{ color: LABEL[palette] }}>
                {caption}
            </span>
        </div>
    );
}
