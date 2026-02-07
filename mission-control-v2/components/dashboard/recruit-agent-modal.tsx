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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UserPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface RecruitAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId?: Id<"teams">;
    onSuccess?: () => void;
}

export function RecruitAgentModal({
    isOpen,
    onClose,
    teamId,
    onSuccess,
}: RecruitAgentModalProps) {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [soul, setSoul] = useState("You are a helpful assistant.");
    const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | undefined>(teamId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const teams = useQuery(api.teams.list);
    const hireAgent = useMutation(api.agents.hire);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTeamId) {
            toast.error("Please select a team");
            return;
        }

        setIsSubmitting(true);

        try {
            await hireAgent({
                name,
                role,
                teamId: selectedTeamId,
                soul,
            });

            toast.success(`${name} recruited successfully!`, {
                description: `${name} has been added to the team as ${role}.`,
            });

            // Reset form
            setName("");
            setRole("");
            setSoul("You are a helpful assistant.");
            setSelectedTeamId(teamId);

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Failed to recruit agent:", error);
            toast.error("Failed to recruit agent", {
                description: error instanceof Error ? error.message : "Name might already be taken.",
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
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <DialogTitle>Recruit New Agent</DialogTitle>
                    </div>
                    <DialogDescription>
                        Add a new agent to your team. They'll be offline until a runner connects.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Agent Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Agent Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Toby"
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
                            placeholder="e.g. HR Manager"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        />
                    </div>

                    {/* Team Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="team">Team</Label>
                        <Select
                            value={selectedTeamId}
                            onValueChange={(value) => setSelectedTeamId(value as Id<"teams">)}
                            required
                        >
                            <SelectTrigger id="team">
                                <SelectValue placeholder="Select a team" />
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
                        <Label htmlFor="soul" className="flex items-center justify-between">
                            <span>Personality (Soul)</span>
                            <span className="flex items-center gap-1 text-xs text-primary">
                                <Sparkles className="w-3 h-3" />
                                AI Prompt
                            </span>
                        </Label>
                        <Textarea
                            id="soul"
                            placeholder="Describe the agent's personality and behavior..."
                            value={soul}
                            onChange={(e) => setSoul(e.target.value)}
                            rows={4}
                            className="font-mono text-sm"
                            required
                        />
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
                            {isSubmitting ? "Recruiting..." : "Recruit Agent"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
