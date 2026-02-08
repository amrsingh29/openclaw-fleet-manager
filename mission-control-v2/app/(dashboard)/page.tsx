"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FleetRoster } from "@/components/dashboard/fleet-roster";
import { TaskBoard } from "@/components/dashboard/task-board";
import { TaskTable } from "@/components/dashboard/task-table";
import { Button } from "@/components/ui/button";
import {
    LayoutGrid,
    List,
    Filter,
    Users,
    Plus,
} from "lucide-react";
import { CreateMissionModal } from "@/components/dashboard/create-mission-modal";
import { MissionDetailModal } from "@/components/dashboard/mission-detail-modal";
import { ProposalQueue } from "@/components/dashboard/proposal-queue";

export default function DashboardPage() {
    const agents = useQuery(api.agents.list) || [];
    const tasks = useQuery(api.tasks.list) || [];
    const proposals = useQuery(api.proposals.listPending) || [];

    const [viewMode, setViewMode] = useState<"board" | "table">("board");
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [agentFilter, setAgentFilter] = useState<"all" | "working" | "offline">(
        "all"
    );
    const [isCreateMissionModalOpen, setIsCreateMissionModalOpen] = useState(false);

    // Filter Logic
    const filteredAgents = agents.filter((a: any) => {
        if (agentFilter === "all") return true;
        if (agentFilter === "working")
            return a.status === "working" || a.status === "busy";
        if (agentFilter === "offline")
            return (
                a.status === "offline" || Date.now() - (a.lastHeartbeat || 0) > 60000
            );
        return true;
    });

    return (
        <div className="flex h-full overflow-hidden">
            {/* LEFT PANE: FLEET ROSTER */}
            <div className="w-72 flex-none flex flex-col border-r border-border bg-card/50 backdrop-blur-sm relative z-20">
                <div className="p-4 border-b border-border flex items-center justify-between flex-none">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                            Fleet
                        </h2>
                    </div>

                    <Button
                        variant={agentFilter !== "all" ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                            setAgentFilter(agentFilter === "all" ? "working" : "all")
                        }
                        title="Filter Agents"
                    >
                        <Filter className="w-3.5 h-3.5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <FleetRoster agents={filteredAgents} />
                </div>
            </div>

            {/* CENTER PANE: MISSION BOARD */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
                <div className="h-14 border-b border-border flex items-center justify-between px-6 flex-none bg-card/30 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg tracking-tight">Mission Control</h1>
                        <Button
                            size="sm"
                            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20"
                            onClick={() => setIsCreateMissionModalOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Mission
                        </Button>
                        <div className="flex items-center p-1 rounded-lg border border-border bg-secondary/50">
                            <Button
                                variant={viewMode === "board" ? "default" : "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode("board")}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={viewMode === "table" ? "default" : "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode("table")}
                            >
                                <List className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-6">
                    {viewMode === "board" ? (
                        <div className="h-full overflow-x-auto">
                            <TaskBoard
                                tasks={tasks}
                                agents={agents}
                                proposals={proposals}
                                onTaskClick={(task) => {
                                    setSelectedTask(task);
                                    setIsDetailModalOpen(true);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <TaskTable
                                tasks={tasks}
                                agents={agents}
                                onTaskClick={(task) => {
                                    setSelectedTask(task);
                                    setIsDetailModalOpen(true);
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <CreateMissionModal
                isOpen={isCreateMissionModalOpen}
                onClose={() => setIsCreateMissionModalOpen(false)}
            />
            <MissionDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTask(null);
                }}
                task={selectedTask}
                agents={agents}
            />

            {/* RIGHT PANE: ACTION QUEUE */}
            <div className="w-80 flex-none flex flex-col border-l border-border bg-card/50 backdrop-blur-sm relative z-20 overflow-y-auto p-4">
                <ProposalQueue />
            </div>
        </div>
    );
}
