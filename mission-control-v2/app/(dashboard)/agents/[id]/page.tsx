"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
    Activity,
    CheckCircle2,
    Settings2,
    FileText,
    Edit,
    Send,
    Clock,
    Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AgentDetailPage() {
    const params = useParams();
    const agentId = params.id as string;

    const agents = useQuery(api.agents.list);
    const agent = agents?.find((a) => a._id === agentId);
    const teams = useQuery(api.teams.list);
    const tasks = useQuery(api.tasks.list) || [];
    const activities = useQuery(api.activities.list) || [];

    if (!agent) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Agent not found</h2>
                    <p className="text-muted-foreground">The agent with ID "{agentId}" does not exist.</p>
                </div>
            </div>
        );
    }

    const team = teams?.find((t) => t._id === agent.teamId);
    const agentTasks = tasks.filter((t) => t.assigneeIds?.includes(agentId as any));
    const agentActivities = activities.filter((a) => a.agentId === agentId).slice(0, 20);

    const isOffline = agent.status === "offline" || (Date.now() - (agent.lastHeartbeat || 0) > 60000);
    const displayStatus = isOffline ? "offline" : agent.status;

    const getStatusColor = (status: string) => {
        switch (status) {
            case "working": return "bg-cyan-500";
            case "active": return "bg-green-500";
            case "idle": return "bg-yellow-500";
            case "offline": return "bg-slate-500";
            case "blocked": return "bg-red-500";
            default: return "bg-slate-400";
        }
    };

    const getIcon = () => {
        const role = agent.role?.toLowerCase() || "";
        if (role.includes("founder") || role.includes("lead")) return "👤";
        if (role.includes("developer") || role.includes("engineer")) return "🔧";
        if (role.includes("research")) return "🔬";
        if (role.includes("writer") || role.includes("content")) return "✍️";
        if (role.includes("marketing") || role.includes("email")) return "🔥";
        if (role.includes("social") || role.includes("media")) return "📱";
        if (role.includes("product") || role.includes("analyst")) return "🔍";
        if (role.includes("seo") || role.includes("data")) return "📊";
        if (role.includes("design")) return "🎨";
        if (role.includes("hr") || role.includes("human")) return "👥";
        return "🤖";
    };

    const completedTasks = agentTasks.filter((t) => t.status === "done").length;
    const activeTasks = agentTasks.filter((t) => t.status === "in_progress" || t.status === "assigned").length;
    const completionRate = agentTasks.length > 0 ? Math.round((completedTasks / agentTasks.length) * 100) : 0;

    return (
        <div className="flex-1 overflow-hidden flex">
            {/* Left Sidebar - Sticky Agent Card */}
            <div className="w-80 border-r bg-card/50 p-6 overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                >
                    {/* Agent Avatar */}
                    <div className="flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-5xl border-2 border-primary/20 mb-4">
                            {getIcon()}
                        </div>
                        <h1 className="text-2xl font-bold mb-1">{agent.name}</h1>
                        <p className="text-sm text-muted-foreground mb-3">{agent.role}</p>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(displayStatus)} ${displayStatus === "working" ? "animate-pulse" : ""}`} />
                            <span className="text-sm font-medium capitalize">{displayStatus}</span>
                        </div>

                        {/* Team Badge */}
                        {team && (
                            <Badge variant="outline" className="mb-4">
                                {team.name}
                            </Badge>
                        )}
                    </div>

                    {/* Quick Stats */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Quick Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <span className="text-sm font-medium capitalize">{displayStatus}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Team</span>
                                <span className="text-sm font-medium">{team?.name || "None"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Last Active</span>
                                <span className="text-sm font-medium">
                                    {agent.lastHeartbeat ? `${Math.floor((Date.now() - agent.lastHeartbeat) / 60000)}m ago` : "Never"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Session</span>
                                <span className="text-sm font-mono truncate max-w-[120px]">{agent.sessionKey.slice(0, 8)}...</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <Card>
                            <CardContent className="pt-4 pb-4 text-center">
                                <div className="text-2xl font-bold text-primary">{completedTasks}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">Done</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-4 text-center">
                                <div className="text-2xl font-bold text-cyan-500">{activeTasks}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">Active</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-4 text-center">
                                <div className="text-2xl font-bold text-green-500">{completionRate}%</div>
                                <div className="text-[10px] text-muted-foreground uppercase">Rate</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <Button className="w-full" variant="default">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Agent
                        </Button>
                        <Button className="w-full" variant="outline">
                            <Send className="w-4 h-4 mr-2" />
                            Assign Task
                        </Button>
                    </div>
                </motion.div>
            </div>

            {/* Right Content Area - Tabs */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8">
                    <Tabs defaultValue="activity" className="w-full">
                        <TabsList className="mb-6">
                            <TabsTrigger value="activity">
                                <Activity className="w-4 h-4 mr-2" />
                                Activity
                            </TabsTrigger>
                            <TabsTrigger value="tasks">
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Tasks
                            </TabsTrigger>
                            <TabsTrigger value="config">
                                <Settings2 className="w-4 h-4 mr-2" />
                                Configuration
                            </TabsTrigger>
                            <TabsTrigger value="logs">
                                <FileText className="w-4 h-4 mr-2" />
                                System Logs
                            </TabsTrigger>
                        </TabsList>

                        {/* Activity Tab */}
                        <TabsContent value="activity" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Activity Timeline</CardTitle>
                                    <CardDescription>Recent actions and events</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {agentActivities.length > 0 ? (
                                        <div className="space-y-4">
                                            {agentActivities.map((activity: any) => (
                                                <div key={activity._id} className="flex gap-4 pb-4 border-b last:border-0">
                                                    <div className="flex-none">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <Activity className="w-4 h-4 text-primary" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm">{activity.message}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {new Date(activity.timestamp).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">No recent activity</p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tasks Tab */}
                        <TabsContent value="tasks" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Assigned Tasks</CardTitle>
                                    <CardDescription>{agentTasks.length} total tasks</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {agentTasks.length > 0 ? (
                                        <div className="space-y-3">
                                            {agentTasks.map((task: any) => (
                                                <div key={task._id} className="p-4 border rounded-lg">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h4 className="font-medium">{task.title}</h4>
                                                        <Badge variant={task.status === "done" ? "default" : "secondary"}>
                                                            {task.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{task.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">No tasks assigned</p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Configuration Tab */}
                        <TabsContent value="config" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Agent Configuration</CardTitle>
                                    <CardDescription>Personality and settings</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Personality (Soul)</label>
                                        <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                                            {agent.soul || "No personality configured"}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Role</label>
                                            <p className="text-sm text-muted-foreground">{agent.role}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Session Key</label>
                                            <p className="text-sm font-mono text-muted-foreground">{agent.sessionKey}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* System Logs Tab */}
                        <TabsContent value="logs" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>System Logs</CardTitle>
                                    <CardDescription>Real-time agent logs</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-slate-950 text-green-400 p-4 rounded-lg font-mono text-xs h-96 overflow-y-auto">
                                        <p>[{new Date().toISOString()}] Agent initialized</p>
                                        <p>[{new Date().toISOString()}] Status: {displayStatus}</p>
                                        <p>[{new Date().toISOString()}] Session: {agent.sessionKey}</p>
                                        <p className="text-slate-500 mt-4">// System logs will appear here in real-time</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
