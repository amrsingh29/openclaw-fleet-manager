"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle, Clock, TrendingUp, Settings, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/dashboard/agent-card";
import { RecruitAgentModal } from "@/components/dashboard/recruit-agent-modal";
import { CreateMissionModal } from "@/components/dashboard/create-mission-modal";
import { TeamChat } from "@/components/dashboard/team-chat";
import { TaskBoard } from "@/components/dashboard/task-board";
import { TaskTable } from "@/components/dashboard/task-table";
import { MissionDetailModal } from "@/components/dashboard/mission-detail-modal";
import {
    Cpu,
    Globe,
    Shield,
    Zap,
    Code,
    Terminal,
    Database,
    Cloud,
    Search,
    Brain,
    Lock,
    User,
    LayoutGrid,
    List
} from "lucide-react";
import { EditAgentModal } from "@/components/dashboard/edit-agent-modal";

export default function TeamDetailPage() {
    const params = useParams();
    const slug = params.slug as string;
    const [isRecruitModalOpen, setIsRecruitModalOpen] = useState(false);
    const [isCreateMissionModalOpen, setIsCreateMissionModalOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState("overview");
    const [viewMode, setViewMode] = useState<"board" | "table">("board");
    const [agentToEdit, setAgentToEdit] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [isChatVisible, setIsChatVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const teams = useQuery(api.teams.list);
    const team = teams?.find((t) => t.slug === slug);
    const allAgents = useQuery(api.agents.list) || [];
    const allTasks = useQuery(api.tasks.list) || [];

    // Tool icon mapping
    const getToolIcon = (tool: string) => {
        const t = tool.toLowerCase();
        if (t.includes("code") || t.includes("github")) return <Code className="w-4 h-4" />;
        if (t.includes("terminal") || t.includes("cli")) return <Terminal className="w-4 h-4" />;
        if (t.includes("db") || t.includes("sql") || t.includes("mongo")) return <Database className="w-4 h-4" />;
        if (t.includes("cloud") || t.includes("aws") || t.includes("vercel")) return <Cloud className="w-4 h-4" />;
        if (t.includes("search") || t.includes("web") || t.includes("google")) return <Search className="w-4 h-4" />;
        if (t.includes("ai") || t.includes("llm") || t.includes("gpt")) return <Brain className="w-4 h-4" />;
        if (t.includes("security") || t.includes("auth")) return <Lock className="w-4 h-4" />;
        if (t.includes("network")) return <Globe className="w-4 h-4" />;
        if (t.includes("infra")) return <Cpu className="w-4 h-4" />;
        return <Zap className="w-4 h-4" />;
    };

    if (!team) return <div className="p-8 text-center">Department not found.</div>;

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

    const stats = {
        totalAgents: teamAgents.length,
        activeAgents: activeAgents.length,
        totalTasks: teamTasks.length,
        completedTasks: teamTasks.filter((t) => t.status === "done").length,
        activeTasks: teamTasks.filter((t) => t.status === "in_progress").length,
        completionRate: teamTasks.length > 0 ? (completedTasks / teamTasks.length) * 100 : 0,
    };

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Compact Header & Metric Bar */}
            <div className="border-b bg-card/30 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-8 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-bold tracking-tight">{team.name}</h1>
                                    <Badge variant="outline" className="h-4 text-[9px] px-1 border-primary/30 text-primary">LIVE</Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest leading-none mt-1">
                                    Sector: {team.slug} • Operations Active
                                </p>
                            </div>
                        </div>

                        {/* Metric Bar */}
                        <div className="flex items-center gap-6 px-6 py-2 rounded-xl bg-background/40 border border-white/5 shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Personnel</span>
                                <span className="text-sm font-bold text-foreground">{teamAgents.length}</span>
                            </div>
                            <div className="w-px h-6 bg-border/50" />
                            <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Missions</span>
                                <span className="text-sm font-bold text-foreground">{teamTasks.length}</span>
                            </div>
                            <div className="w-px h-6 bg-border/50" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsChatVisible(!isChatVisible)}
                                className={`flex flex-col h-auto py-1 px-3 hover:bg-primary/10 transition-colors ${isChatVisible ? 'text-primary' : 'text-muted-foreground'}`}
                            >
                                <span className="text-[9px] uppercase font-bold tracking-tighter mb-0.5">Tactical Comms</span>
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={14} className={isChatVisible ? 'animate-pulse' : ''} />
                                    <span className="text-sm font-bold">{isChatVisible ? 'ONLINE' : 'HIDDEN'}</span>
                                </div>
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest border-white/10 hover:bg-white/5">
                                <Settings className="w-3.5 h-3.5 mr-2" />
                                Protocol
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
            <div className="max-w-7xl mx-auto px-8 py-6">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
                    {/* ... (TabsList content unchanged) ... */}
                    <div className="flex items-center justify-between">
                        <TabsList className="bg-muted/50 p-1">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="agents">Agents</TabsTrigger>
                            <TabsTrigger value="missions">Missions</TabsTrigger>
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <motion.div
                                className={`space-y-6 transition-all duration-500 ease-in-out ${isChatVisible ? 'lg:col-span-2' : 'lg:col-span-3'}`}
                            >
                                {/* Team Health */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Department Health</CardTitle>
                                        <CardDescription>Real-time performance and status indicators</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-3">
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agents</p>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                                        <span className="text-sm font-medium">Active</span>
                                                    </div>
                                                    <span className="text-lg font-bold">{stats.activeAgents}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                                                        <span className="text-sm font-medium">Offline</span>
                                                    </div>
                                                    <span className="text-lg font-bold">{stats.totalAgents - stats.activeAgents}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Missions</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">Completed</span>
                                                    <span className="text-lg font-bold">{stats.completedTasks}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">In Progress</span>
                                                    <span className="text-lg font-bold">{stats.activeTasks}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3 text-center md:text-right">
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Efficiency</p>
                                                <div className="text-3xl font-bold text-primary">{Math.round(stats.completionRate)}%</div>
                                                <p className="text-[10px] text-muted-foreground">{stats.completedTasks} of {stats.totalTasks} missions</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Quick Actions */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Deployment Ready</CardTitle>
                                        <CardDescription>Initiate operations and manage resources</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                onClick={() => setIsCreateMissionModalOpen(true)}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                            >
                                                <Zap className="w-4 h-4 mr-2" />
                                                Launch Mission
                                            </Button>
                                            <Button variant="outline" onClick={() => setIsRecruitModalOpen(true)}>
                                                <User className="w-4 h-4 mr-2" />
                                                Recruit Agent
                                            </Button>
                                            <Button variant="outline">
                                                <Terminal className="w-4 h-4 mr-2" />
                                                Global Link
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Capabilities */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Department Capabilities</CardTitle>
                                        <CardDescription>Specialized toolsets and protocols available</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {team.allowedTools && team.allowedTools.length > 0 ? (
                                                team.allowedTools.map((tool: string) => (
                                                    <div
                                                        key={tool}
                                                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 group hover:border-primary/50 transition-colors"
                                                    >
                                                        <div className="p-2 rounded bg-background text-primary group-hover:scale-110 transition-transform">
                                                            {getToolIcon(tool)}
                                                        </div>
                                                        <span className="text-xs font-medium uppercase tracking-tight">{tool}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="col-span-full py-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                                                    No specialized tools registered for this department.
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            <AnimatePresence>
                                {isChatVisible && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20, width: 0 }}
                                        animate={{ opacity: 1, x: 0, width: 'auto' }}
                                        exit={{ opacity: 0, x: 20, width: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="lg:col-span-1 overflow-hidden"
                                    >
                                        <div className="sticky top-[80px]">
                                            <TeamChat teamId={team._id} teamName={team.name} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
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
                            <Button onClick={() => setIsRecruitModalOpen(true)}>Recruit Agent</Button>
                        </div>

                        {/* Agent Grid */}
                        {teamAgents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teamAgents.map((agent: any) => (
                                    <AgentCard
                                        key={agent._id}
                                        agent={agent}
                                        onEdit={() => {
                                            setAgentToEdit(agent);
                                            setIsEditModalOpen(true);
                                        }}
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
                                    <Button onClick={() => setIsRecruitModalOpen(true)}>Recruit Agent</Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="missions" className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight">Mission Operations</h3>
                                <p className="text-xs text-muted-foreground">Manage and monitor department-specific missions</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
                                    <Button
                                        variant={viewMode === "board" ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 px-2 text-[10px]"
                                        onClick={() => setViewMode("board")}
                                    >
                                        <LayoutGrid className="w-3 h-3 mr-1" />
                                        Board
                                    </Button>
                                    <Button
                                        variant={viewMode === "table" ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 px-2 text-[10px]"
                                        onClick={() => setViewMode("table")}
                                    >
                                        <List className="w-3 h-3 mr-1" />
                                        Table
                                    </Button>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => setIsCreateMissionModalOpen(true)}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-8"
                                >
                                    <Zap className="w-3 h-3 mr-2" />
                                    Launch Mission
                                </Button>
                            </div>
                        </div>

                        <div className="h-[calc(100vh-420px)] min-h-[400px]">
                            {viewMode === "board" ? (
                                <TaskBoard
                                    tasks={teamTasks}
                                    agents={teamAgents}
                                    onTaskClick={(task) => {
                                        setSelectedTask(task);
                                        setIsDetailModalOpen(true);
                                    }}
                                />
                            ) : (
                                <TaskTable
                                    tasks={teamTasks}
                                    agents={teamAgents}
                                    onTaskClick={(task) => {
                                        setSelectedTask(task);
                                        setIsDetailModalOpen(true);
                                    }}
                                />
                            )}
                        </div>
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

            <RecruitAgentModal
                isOpen={isRecruitModalOpen}
                onClose={() => setIsRecruitModalOpen(false)}
                teamId={team._id}
            />

            {team && (
                <CreateMissionModal
                    isOpen={isCreateMissionModalOpen}
                    onClose={() => {
                        setIsCreateMissionModalOpen(false);
                        // Switch to missions tab after creation if we were in overview
                        if (selectedTab === "overview") {
                            setSelectedTab("missions");
                        }
                    }}
                    teamId={team._id}
                />
            )}
            {agentToEdit && (
                <EditAgentModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setAgentToEdit(null);
                    }}
                    agent={agentToEdit}
                />
            )}
            <MissionDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTask(null);
                }}
                task={selectedTask}
                agents={allAgents}
            />
        </div>
    );
}
