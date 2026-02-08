"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

interface EditAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    agent: {
        _id: Id<"agents">;
        name: string;
        role: string;
        teamId?: Id<"teams">;
        soul?: string;
    };
    onSuccess?: () => void;
}

export function EditAgentModal({
    isOpen,
    onClose,
    agent,
    onSuccess,
}: EditAgentModalProps) {
    const [name, setName] = useState(agent.name);
    const [role, setRole] = useState(agent.role);
    const [soul, setSoul] = useState(agent.soul || "");
    const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | undefined>(agent.teamId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const teams = useQuery(api.teams.list);
    const updateAgent = useMutation(api.agents.update);

    // Sync state when agent prop changes (e.g. when opening modal for different agent)
    useEffect(() => {
        setName(agent.name);
        setRole(agent.role);
        setSoul(agent.soul || "");
        setSelectedTeamId(agent.teamId || undefined);
    }, [agent]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await updateAgent({
                id: agent._id,
                name,
                role,
                teamId: selectedTeamId,
                soul,
            });

            toast.success("Agent updated successfully", {
                description: `${name}'s configuration has been updated.`,
            });

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Failed to update agent:", error);
            toast.error("Failed to update agent", {
                description: error instanceof Error ? error.message : "An unexpected error occurred",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <DialogTitle>Edit Agent Configuration</DialogTitle>
                    </div>
                    <DialogDescription>
                        Update {agent.name}'s role, team assignment, and core personality.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Agent Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Agent Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Role */}
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Input
                                id="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Team Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="team">Team Assignment</Label>
                        <Select
                            value={selectedTeamId || ""}
                            onValueChange={(value) => setSelectedTeamId(value as Id<"teams">)}
                        >
                            <SelectTrigger id="team">
                                <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                                {teams?.map((team) => (
                                    <SelectItem key={team._id} value={team._id}>
                                        {team.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Personality (Soul) */}
                    <div className="space-y-2">
                        <Label htmlFor="soul">Personality (Soul)</Label>
                        <Textarea
                            id="soul"
                            placeholder="e.g. You are a meticulous QA engineer who values precision..."
                            value={soul}
                            onChange={(e) => setSoul(e.target.value)}
                            rows={6}
                            className="resize-none font-mono text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span>Pro Tip:</span> Be specific about the agent's tone, constraints, and expertise.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Update Agent"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
