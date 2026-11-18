import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useTheme } from '../context/ThemeContext';
import { ShieldCheck, ShieldAlert, Check, X, ChevronDown, ChevronRight, Clock } from 'lucide-react';

/**
 * The human half of the approval loop.
 *
 * A write tool that policy blocks does not fail silently: the agent records a
 * proposal with the exact arguments it wanted to run, and this panel is where a
 * person says yes or no. Approving it makes the runner execute precisely what was
 * shown here, not a fresh attempt by the model.
 */
export function ProposalsPanel({ expanded = false }: { expanded?: boolean }) {
    const { theme } = useTheme();
    const pending = useQuery(api.proposals.listPending) || [];
    const recent = useQuery(api.proposals.listRecent) || [];
    const approve = useMutation(api.proposals.approve);
    const deny = useMutation(api.proposals.deny);

    const [busy, setBusy] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const act = async (id: string, fn: () => Promise<unknown>) => {
        setBusy(id);
        setError(null);
        try {
            await fn();
        } catch (err: any) {
            setError(err?.message ?? 'Action failed');
        } finally {
            setBusy(null);
        }
    };

    const label = (t: string) => (t || '').replace(/_/g, ' ');

    if (!expanded) {
        // Collapsed strip: a badge is enough, the point is to be noticed.
        return pending.length > 0 ? (
            <div className="flex flex-col items-center gap-1 pt-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-500">{pending.length}</span>
            </div>
        ) : null;
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className={`flex items-center justify-between px-1 pb-3 mb-1 border-b flex-none
                ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${pending.length ? 'text-amber-500' : 'text-slate-500'}`} />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        Approvals
                    </h3>
                </div>
                {pending.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        {pending.length}
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-2 px-2 py-1.5 rounded bg-red-500/10 text-red-500 text-[11px]">{error}</div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
                {pending.length === 0 && (
                    <div className={`rounded-lg border border-dashed p-4 text-center
                        ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                        <ShieldCheck className="w-5 h-5 mx-auto mb-1.5 text-slate-500 opacity-50" />
                        <p className="text-[11px] text-slate-500 leading-snug">
                            Nothing waiting.
                            <br />
                            Agents are operating within policy.
                        </p>
                    </div>
                )}

                {pending.map((p: any) => (
                    <div
                        key={p._id}
                        className={`rounded-lg border p-2.5
                            ${theme === 'dark' ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-300 bg-amber-50'}`}
                    >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold truncate">{label(p.action)}</div>
                                <div className="text-[10px] text-slate-500 truncate">
                                    {p.agentName}{p.agentRole ? ` · ${p.agentRole}` : ''}
                                </div>
                            </div>
                            <Clock className="w-3 h-3 text-amber-500 flex-none mt-0.5" />
                        </div>

                        {/* The exact arguments, because this is what would run. */}
                        <pre className={`text-[10px] leading-snug rounded p-1.5 mb-2 overflow-x-auto
                            ${theme === 'dark' ? 'bg-black/30 text-slate-300' : 'bg-white text-slate-700'}`}>
{JSON.stringify(p.params, null, 1)}
                        </pre>

                        {p.rationale && (
                            <p className="text-[10px] text-slate-500 mb-2 leading-snug line-clamp-3">
                                {p.rationale.split('\n')[0]}
                            </p>
                        )}

                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={busy === p._id}
                                onClick={() => act(p._id, () => approve({ proposalId: p._id, decidedBy: 'commander' }))}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded
                                    bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                                    text-white text-[10px] font-bold transition-colors"
                            >
                                <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                                disabled={busy === p._id}
                                onClick={() => act(p._id, () => deny({ proposalId: p._id, reason: 'Denied from dashboard' }))}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded
                                    disabled:opacity-50 text-[10px] font-bold transition-colors
                                    ${theme === 'dark'
                                        ? 'bg-white/10 hover:bg-white/20 text-slate-300'
                                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                            >
                                <X className="w-3 h-3" /> Deny
                            </button>
                        </div>
                    </div>
                ))}

                {recent.length > 0 && (
                    <div className="pt-1">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-400"
                        >
                            {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            History ({recent.length})
                        </button>
                        {showHistory && (
                            <div className="mt-1.5 space-y-1">
                                {recent.map((p: any) => (
                                    <div key={p._id} className="flex items-center gap-1.5 text-[10px] py-0.5">
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full flex-none ${
                                                p.status === 'executed' || p.status === 'approved'
                                                    ? 'bg-emerald-500'
                                                    : p.status === 'failed' || p.status === 'denied'
                                                      ? 'bg-red-500'
                                                      : 'bg-slate-500'
                                            }`}
                                        />
                                        <span className="truncate text-slate-500">
                                            {label(p.action)} · {p.agentName}
                                        </span>
                                        <span className="ml-auto text-slate-600 flex-none">{p.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
