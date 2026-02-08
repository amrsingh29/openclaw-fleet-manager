"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AssignTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    agent?: {
        _id: Id<"agents">;
        name: string;
        teamId?: Id<"teams">;
    };
    task?: {
        _id: Id<"tasks">;
        title: string;
        teamId?: Id<"teams">;
    };
    onSuccess?: () => void;
}

export function AssignTaskModal({
    isOpen,
    onClose,
    agent,
    task,
    onSuccess,
}: AssignTaskModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const tasks = useQuery(api.tasks.list) || [];
    const agents = useQuery(api.agents.list) || [];
    const assignTask = useMutation(api.tasks.assign);

    // Filter available tasks (Inbox ones, ideally same team)
    const availableTasks = tasks.filter((t) => {
        const isInbox = t.status === "inbox";
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTeam = agent?.teamId ? t.teamId === agent.teamId : true;
        return isInbox && matchesSearch && matchesTeam;
    });

    // Filter available agents (Ideally same team)
    const availableAgents = agents.filter((a) => {
        const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTeam = task?.teamId ? a.teamId === task.teamId : true;
        return matchesSearch && matchesTeam;
    });

    const handleAssign = async (targetId: Id<"tasks"> | Id<"agents">) => {
        setIsSubmitting(true);
        try {
            const taskId = task?._id || (targetId as Id<"tasks">);
            const agentId = agent?._id || (targetId as Id<"agents">);

            await assignTask({ taskId, agentId });

            toast.success("Task assigned successfully");
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Failed to assign task:", error);
            toast.error("Failed to assign task");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
            setSearchQuery("");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <DialogTitle>
                            {agent ? `Assign Task to ${agent.name}` : `Assign Agent to Mission`}
                        </DialogTitle>
                    </div>
                    <DialogDescription>
                        {agent
                            ? "Select an unassigned mission for this agent to execute."
                            : `Select an agent to handle "${task?.title}".`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={agent ? "Search missions..." : "Search agents..."}
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg p-2">
                        {agent ? (
                            <div className="space-y-2">
                                {availableTasks.length > 0 ? (
                                    availableTasks.map((t) => (
                                        <button
                                            key={t._id}
                                            onClick={() => handleAssign(t._id)}
                                            disabled={isSubmitting}
                                            className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border group flex items-start gap-3"
                                        >
                                            <div className="p-1.5 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                <ClipboardList className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{t.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                                                        {t.priority || "Normal"}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground italic">
                                                        Inbox
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        No unassigned missions found.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {availableAgents.length > 0 ? (
                                    availableAgents.map((a) => (
                                        <button
                                            key={a._id}
                                            onClick={() => handleAssign(a._id)}
                                            disabled={isSubmitting}
                                            className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border group flex items-center gap-3"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-sm font-bold">
                                                {a.name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{a.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{a.role}</p>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        No eligible agents found.
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
