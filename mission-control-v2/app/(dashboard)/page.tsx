"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Rocket } from "lucide-react";

export default function DashboardPage() {
    const teams = useQuery(api.teams.list);
    const agents = useQuery(api.agents.list);
    const tasks = useQuery(api.tasks.list);

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Rocket className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Command Center</h1>
                        <p className="text-muted-foreground">Mission Control Dashboard</p>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Teams</CardTitle>
                            <CardDescription>Active departments</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-primary">
                                {teams === undefined ? "..." : teams.length}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Agents</CardTitle>
                            <CardDescription>Fleet roster</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-primary">
                                {agents === undefined ? "..." : agents.length}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Missions</CardTitle>
                            <CardDescription>Active tasks</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-primary">
                                {tasks === undefined ? "..." : tasks.length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Placeholder for Command Center Components */}
                <Card>
                    <CardHeader>
                        <CardTitle>🚧 Command Center - Coming Soon</CardTitle>
                        <CardDescription>
                            3-pane layout with Fleet Roster, Mission Board, and Live Intel
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>• Fleet Roster - Agent cards with status indicators</p>
                        <p>• Mission Board - Kanban board with drag-and-drop</p>
                        <p>• Live Intel - Real-time activity feed</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
