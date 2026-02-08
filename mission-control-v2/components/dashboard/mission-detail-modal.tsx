"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Terminal, Calendar, User, Zap, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MissionDetailModalProps {
    task: any | null;
    isOpen: boolean;
    onClose: () => void;
    agents: any[];
}

export function MissionDetailModal({ task, isOpen, onClose, agents }: MissionDetailModalProps) {
    if (!task) return null;

    const date = new Date(task.createdTime || Date.now()).toLocaleString();
    const assigneeId = task.assigneeIds?.[0];
    const agent = assigneeId ? agents.find((a) => a._id === assigneeId) : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background/95 backdrop-blur-2xl border-white/10 shadow-2xl rounded-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-[9px] py-0.5 px-1.5 border-primary/20 text-primary/80 bg-primary/5">
                            TASK-{task._id?.slice(-4)}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold border
                                ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' :
                                    task.status === 'review' ? 'bg-amber-500/10 text-amber-400 border-amber-500/10' :
                                        task.status === 'in_progress' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/10' :
                                            'bg-slate-500/10 text-slate-400 border-slate-500/10'}
                            `}
                        >
                            {task.status.replace('_', ' ')}
                        </Badge>
                        {task.priority === 'high' && (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/10 border text-[9px] py-0 px-1.5 uppercase tracking-wider font-semibold">
                                HIGH PRIORITY
                            </Badge>
                        )}
                    </div>
                    <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                        {task.title}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-12 custom-scrollbar">
                    {/* Meta Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="w-10 h-10 flex-none rounded-lg bg-primary/5 flex items-center justify-center text-primary/60 border border-primary/10">
                                <User size={20} />
                            </div>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-[9px] text-foreground/50 uppercase font-black tracking-widest mb-1.5">Assigned Agent</p>
                                <p className="text-sm font-semibold tracking-tight text-foreground/90 truncate">{agent?.name || 'Unassigned'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="w-10 h-10 flex-none rounded-lg bg-primary/5 flex items-center justify-center text-primary/60 border border-primary/10">
                                <Clock size={20} />
                            </div>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-[9px] text-foreground/50 uppercase font-black tracking-widest mb-1.5">Creation Interval</p>
                                <p className="text-sm font-semibold tracking-tight text-foreground/90 truncate">{date}</p>
                            </div>
                        </div>
                    </div>

                    {/* Directives */}
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 flex-none rounded-lg bg-primary/5 flex items-center justify-center text-primary/60 border border-primary/10">
                            <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50 mb-3">Mission Directives</h3>
                            <div className="p-5 rounded-xl bg-white/[0.01] border border-white/5 text-sm leading-relaxed text-foreground/80 font-medium italic">
                                {task.description}
                            </div>
                        </div>
                    </div>

                    {/* Output */}
                    {(task.output || task.status === 'done' || task.status === 'review') && (
                        <div className="flex items-start gap-4 pb-4">
                            <div className="w-10 h-10 flex-none rounded-lg bg-primary/5 flex items-center justify-center text-primary/60 border border-primary/10">
                                <Terminal size={20} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50 mb-3">Tactical Result</h3>
                                <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-xl ring-1 ring-white/5">
                                    <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                        <div className="flex gap-1.5 opacity-30">
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[8px] font-mono font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">INTEL_CHANNEL_SECURE</span>
                                            <Zap size={10} className="text-primary/60 animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="p-6 prose prose-invert dark:prose-invert prose-slate max-w-none 
                                        prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
                                        prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:text-sm
                                        prose-strong:text-cyan-400/90 prose-strong:font-bold
                                        prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                                        prose-code:text-amber-300/90 prose-code:bg-amber-400/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                        prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/5 prose-pre:rounded-lg prose-pre:p-4
                                        prose-ul:border-l prose-ul:border-primary/10 prose-ul:pl-4
                                        prose-li:marker:text-primary">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {task.output || "_Scanning for operational data..._"}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
