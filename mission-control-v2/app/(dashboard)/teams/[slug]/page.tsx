"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Users, CheckCircle, Clock, TrendingUp, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/dashboard/agent-card";

export default function TeamDetailPage() {
    const params = useParams();
    const slug = params.slug as string;

    const teams = useQuery(api.teams.list);
    const team = teams?.find((t) => t.slug === slug);
    const allAgents = useQuery(api.agents.list) || [];
    const allTasks = useQuery(api.tasks.list) || [];

    if (!team) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Team not found</h2>
                    <p className="text-muted-foreground">The team "{slug}" does not exist.</p>
                </div>
            </div>
        );
    }

    const teamAgents = allAgents.filter((a) => a.teamId === team._id);
    const teamTasks = allTasks.filter((t) => t.teamId === team._id);

    // Calculate stats
    const activeAgents = teamAgents.filter((a) => {
        const isOffline = a.status === "offline" || (Date.now() - (a.lastHeartbeat || 0) > 60000);
        return !isOffline;
    });
    const activeRate = teamAgents.length > 0 ? Math.round((activeAgents.length / teamAgents.length) * 100) : 0;
    const completedTasks = teamTasks.filter((t) => t.status === "done").length;
    const avgCompletionTime = "2.3h"; // TODO: Calculate from actual data

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Hero Section */}
            <div className="border-b bg-card">
                <div className="max-w-7xl mx-auto px-8 py-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold">{team.name}</h1>
                                <Badge variant="outline" className="font-mono text-xs">
                                    {team.slug}
                                </Badge>
                            </div>
                            {team.mission && (
                                <p className="text-muted-foreground max-w-2xl">{team.mission}</p>
                            )}
                        </div>
                        <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </Button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Agents</p>
                                            <p className="text-3xl font-bold">{teamAgents.length}</p>
                                        </div>
                                        <Users className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Tasks</p>
                                            <p className="text-3xl font-bold">{teamTasks.length}</p>
                                        </div>
                                        <CheckCircle className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Active</p>
                                            <p className="text-3xl font-bold">{activeRate}%</p>
                                        </div>
                                        <TrendingUp className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Avg Time</p>
                                            <p className="text-3xl font-bold">{avgCompletionTime}</p>
                                        </div>
                                        <Clock className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
            <div className="max-w-7xl mx-auto px-8 py-6">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="mb-6">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="agents">Agents</TabsTrigger>
                        <TabsTrigger value="missions">Missions</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        {/* Team Health */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Team Health</CardTitle>
                                <CardDescription>Current status and performance indicators</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Agent Status</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                    Active
                                                </span>
                                                <span className="text-sm font-bold">{activeAgents.length}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                    Offline
                                                </span>
                                                <span className="text-sm font-bold">{teamAgents.length - activeAgents.length}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Task Progress</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">Completed</span>
                                                <span className="text-sm font-bold">{completedTasks}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">In Progress</span>
                                                <span className="text-sm font-bold">
                                                    {teamTasks.filter((t) => t.status === "in_progress").length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Completion Rate</p>
                                        <div className="text-4xl font-bold text-primary">
                                            {teamTasks.length > 0 ? Math.round((completedTasks / teamTasks.length) * 100) : 0}%
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {completedTasks} of {teamTasks.length} tasks
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                                <CardDescription>Common team operations</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-3">
                                    <Button>Create Mission</Button>
                                    <Button variant="outline">Recruit Agent</Button>
                                    <Button variant="outline">Configure Tools</Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Placeholder for other tabs */}
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">
                                    More features coming soon: Recent Activity Timeline, Performance Charts
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="agents" className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Team Agents</h3>
                                <p className="text-sm text-muted-foreground">
                                    {teamAgents.length} agent{teamAgents.length !== 1 ? "s" : ""} in this team
                                </p>
                            </div>
                            <Button>Recruit Agent</Button>
                        </div>

                        {/* Agent Grid */}
                        {teamAgents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teamAgents.map((agent: any) => (
                                    <AgentCard
                                        key={agent._id}
                                        agent={agent}
                                        onEdit={() => console.log("Edit agent:", agent._id)}
                                        onViewDetails={() => console.log("View agent:", agent._id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="pt-12 pb-12 text-center">
                                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Get started by recruiting your first agent
                                    </p>
                                    <Button>Recruit Agent</Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="missions">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">Missions tab - Coming soon</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="analytics">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">Analytics tab - Coming soon</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="settings">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">Settings tab - Coming soon</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
