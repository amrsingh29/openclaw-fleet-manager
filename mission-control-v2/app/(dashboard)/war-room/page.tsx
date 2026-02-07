"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FleetRoster } from "@/components/dashboard/fleet-roster";
import { TaskBoard } from "@/components/dashboard/task-board";
import { TaskTable } from "@/components/dashboard/task-table";
import { LiveIntel } from "@/components/dashboard/live-intel";
import { Button } from "@/components/ui/button";
import {
    LayoutGrid,
    List,
    Filter,
    Activity,
    Users,
    PanelRightClose,
    PanelRightOpen,
} from "lucide-react";

export default function WarRoomPage() {
    const agents = useQuery(api.agents.list) || [];
    const tasks = useQuery(api.tasks.list) || [];

    const [viewMode, setViewMode] = useState<"board" | "table">("board");
    const [agentFilter, setAgentFilter] = useState<"all" | "working" | "offline">(
        "all"
    );
    const [isIntelCollapsed, setIsIntelCollapsed] = useState(true);

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
            {/* LEFT PANE: FLEET ROSTER (Fixed 288px) */}
            <div className="w-72 flex-none flex flex-col border-r border-border bg-card/50 backdrop-blur-sm relative z-20">
                <div className="p-4 border-b border-border flex items-center justify-between flex-none">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                            Fleet
                        </h2>
                    </div>

                    {/* Filter */}
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

            {/* CENTER PANE: MISSION BOARD (Fluid) */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
                {/* Header */}
                <div className="h-14 border-b border-border flex items-center justify-between px-6 flex-none bg-card/30 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg tracking-tight">Mission Control</h1>
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

                {/* Canvas */}
                <div className="flex-1 overflow-hidden p-6">
                    {viewMode === "board" ? (
                        <div className="h-full overflow-x-auto">
                            <TaskBoard tasks={tasks} agents={agents} onTaskClick={(task) => console.log("Task clicked:", task)} />
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <TaskTable tasks={tasks} agents={agents} onTaskClick={(task) => console.log("Task clicked:", task)} />
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANE: LIVE INTEL (Collapsible) */}
            <div
                className={`flex-none flex flex-col border-l border-border bg-card/50 backdrop-blur-sm relative z-20 transition-all duration-300 ${isIntelCollapsed ? "w-12" : "w-80"
                    }`}
            >
                <div
                    className={`p-4 border-b border-border flex items-center justify-between flex-none h-14 ${isIntelCollapsed ? "flex-col justify-center px-0 gap-4" : ""
                        }`}
                >
                    {!isIntelCollapsed ? (
                        <>
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-500" />
                                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                    Live Intel
                                </h2>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setIsIntelCollapsed(true)}
                                title="Hide Live Intel"
                            >
                                <PanelRightClose className="w-4 h-4" />
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => setIsIntelCollapsed(false)}
                            title="Show Live Intel"
                        >
                            <PanelRightOpen className="w-5 h-5 text-cyan-500" />
                        </Button>
                    )}
                </div>

                {!isIntelCollapsed && (
                    <div className="flex-1 overflow-hidden p-4">
                        <LiveIntel minimal />
                    </div>
                )}            </div>
        </div>
    );
}
