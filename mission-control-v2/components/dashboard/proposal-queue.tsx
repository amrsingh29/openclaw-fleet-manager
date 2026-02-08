"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, ShieldAlert, Cpu } from "lucide-react";
import { Doc, Id } from "@/convex/_generated/dataModel";

export function ProposalQueue() {
    const proposals = useQuery(api.proposals.listPending) || [];
    const approve = useMutation(api.proposals.approve);
    const deny = useMutation(api.proposals.deny);

    if (proposals.length === 0) {
        return (
            <div className="p-8 text-center border border-dashed rounded-2xl bg-muted/20">
                <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">No Pending Proposals</p>
                <p className="text-xs text-muted-foreground mt-1 text-balance">Agents are operating within standard parameters.</p>
            </div>
        );
    }

    const handleApprove = async (id: Id<"proposals">) => {
        try {
            await approve({ proposalId: id });
            toast.success("Action Approved", { description: "The agent has been authorized to proceed." });
        } catch (err) {
            toast.error("Failed to approve proposal");
        }
    };

    const handleDeny = async (id: Id<"proposals">) => {
        try {
            await deny({ proposalId: id });
            toast.error("Action Blocked", { description: "The agent has been stopped from proceeding." });
        } catch (err) {
            toast.error("Failed to deny proposal");
        }
    };

    const formatRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-bold uppercase tracking-widest">Action Queue</h2>
                </div>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-500 animate-pulse">
                    {proposals.length} PENDING
                </div>
            </div>

            <div className="space-y-3">
                {proposals.map((proposal: Doc<"proposals">) => (
                    <div
                        key={proposal._id}
                        className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 backdrop-blur-sm group hover:border-orange-500/40 transition-all"
                    >
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-orange-500/10">
                                    <Cpu className="w-4 h-4 text-orange-500" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold tracking-tight">
                                        Agent Request: <span className="text-orange-500">{proposal.action}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2">
                                        {formatRelativeTime(proposal.timestamp)}
                                        {proposal.confidence !== undefined && (
                                            <span className={`px-1 rounded ${proposal.confidence > 0.9 ? 'text-green-500 bg-green-500/10' : 'text-orange-500 bg-orange-500/10'}`}>
                                                {Math.round(proposal.confidence * 100)}% Confidence
                                            </span>
                                        )}
                                        {proposal.cost !== undefined && (
                                            <span className="text-blue-400 bg-blue-400/10 px-1 rounded">
                                                ${proposal.cost.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-xs text-muted-foreground line-clamp-2 italic mb-3">
                                "{proposal.rationale}"
                            </p>
                            {proposal.params && (
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] text-blue-400 overflow-x-auto max-h-32">
                                    <pre>{JSON.stringify(proposal.params, null, 2)}</pre>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-500 border border-green-500/20"
                                onClick={() => handleApprove(proposal._id)}
                            >
                                <Check className="w-3.5 h-3.5 mr-2" />
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10"
                                onClick={() => handleDeny(proposal._id)}
                            >
                                <X className="w-3.5 h-3.5 mr-2" />
                                Deny
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
