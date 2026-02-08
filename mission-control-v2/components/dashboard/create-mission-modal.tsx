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
import { ClipboardList, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CreateMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId?: Id<"teams">;
    defaultStatus?: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked";
    onSuccess?: () => void;
}

export function CreateMissionModal({
    isOpen,
    onClose,
    teamId,
    defaultStatus = "inbox",
    onSuccess,
}: CreateMissionModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
    const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | undefined>(teamId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const teams = useQuery(api.teams.list);
    const createMission = useMutation(api.tasks.create);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTeamId && !teamId) {
            toast.error("Please select a team for this mission");
            return;
        }

        setIsSubmitting(true);

        try {
            await createMission({
                title,
                description,
                status: defaultStatus,
                priority,
                teamId: selectedTeamId || teamId,
            });

            toast.success("Mission created successfully", {
                description: `"${title}" has been added to the mission board.`,
            });

            // Reset form
            setTitle("");
            setDescription("");
            setPriority("medium");
            if (!teamId) setSelectedTeamId(undefined); // Only reset if not pre-set

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Failed to create mission:", error);
            toast.error("Failed to create mission", {
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

    // Update selectedTeamId when teamId prop changes
    if (teamId && selectedTeamId !== teamId) {
        setSelectedTeamId(teamId);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <DialogTitle>Create New Mission</DialogTitle>
                    </div>
                    <DialogDescription>
                        Define a new objective for your agents to execute.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Mission Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Optimize Database Queries"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Provide detailed instructions..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Priority */}
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                                value={priority}
                                onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}
                            >
                                <SelectTrigger id="priority">
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Team Selection (only if not pre-set) */}
                        {!teamId && (
                            <div className="space-y-2">
                                <Label htmlFor="team">Team</Label>
                                <Select
                                    value={selectedTeamId}
                                    onValueChange={(value) => setSelectedTeamId(value as Id<"teams">)}
                                    required
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
                        )}
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
                            {isSubmitting ? "Initiating..." : "Create Mission"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
