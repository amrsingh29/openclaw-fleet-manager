"use client";

import { motion } from "framer-motion";
import { ClipboardList, Target, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface StrategicDirectiveProps {
    content: string;
    agents: any[];
}

export function StrategicDirective({ content, agents }: StrategicDirectiveProps) {
    // Basic parsing for the autonomous directive
    const taskBlocks = content.split("ACTION: create_task").slice(1);
    const mainText = content.split("ACTION: create_task")[0];

    const getAgentName = (id: string) => {
        return agents.find(a => a._id === id)?.name || "Unknown Agent";
    };

    return (
        <div className="flex flex-col gap-3 w-full max-w-full md:max-w-2xl overflow-hidden">
            {mainText.trim() && (
                <div className="px-4 py-3 rounded-2xl text-sm bg-card/40 border border-white/5 rounded-tl-none">
                    <MarkdownRenderer content={mainText} className="text-foreground/90" />
                </div>
            )}

            {taskBlocks.map((block, i) => {
                const title = block.match(/TITLE: (.*)/)?.[1]?.trim();
                const desc = block.match(/DESCRIPTION: (.*)/)?.[1]?.trim();
                const missionId = block.match(/MISSION_ID: (.*)/)?.[1]?.trim();
                const priority = block.match(/PRIORITY: (.*)/)?.[1]?.trim();
                const assigneeId = block.match(/ASSIGNEE_ID: (.*)/)?.[1]?.trim();
                const assigneeName = assigneeId ? getAgentName(assigneeId) : null;

                return (
                    <motion.div
                        key={i}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-xl border border-cyan-500/50 dark:border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/5 backdrop-blur-md flex flex-col gap-3 relative overflow-hidden group"
                    >
                        {/* Cyber decoration */}
                        <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100 transition-opacity">
                            <Target className="w-12 h-12 text-cyan-500 -rotate-12 translate-x-4 -translate-y-4" />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-cyan-500/20">
                                <ClipboardList className="w-4 h-4 text-cyan-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500">Strategic Directive</h4>
                                    {assigneeName && (
                                        <>
                                            <span className="text-[10px] text-muted-foreground/40">/</span>
                                            <Badge variant="outline" className="h-3.5 text-[8px] border-cyan-500/20 text-cyan-500 bg-cyan-500/5 font-mono px-1">
                                                ASSIGNED: {assigneeName.toUpperCase()}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                                <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
                            </div>
                            {priority && (
                                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px] font-mono">
                                    P{priority}
                                </Badge>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {desc}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3 text-cyan-500" />
                                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">Mission: {missionId}</span>
                            </div>
                            <div className="px-2 py-0.5 rounded bg-cyan-500 text-black text-[9px] font-bold uppercase tracking-widest">
                                Assigned
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
