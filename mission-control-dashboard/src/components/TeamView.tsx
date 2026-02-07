import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Wrench, UserPlus, Filter } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { HireAgentModal } from "./HireAgentModal";
import { TaskBoard } from "./TaskBoard";
import { NewMissionModal } from "./NewMissionModal";

interface TeamViewProps {
    teamId: string;
    onTaskClick?: (task: any) => void;
    onEditAgent?: (agent: any) => void;
}

export function TeamView({ teamId, onTaskClick, onEditAgent }: TeamViewProps) {
    const { theme } = useTheme();
    const [isHireModalOpen, setIsHireModalOpen] = useState(false);
    const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
    const [agentFilter, setAgentFilter] = useState<'all' | 'online' | 'offline'>('all');

    const team = useQuery(api.teams.get, { id: teamId as any });
    const allAgents = useQuery(api.agents.list) || [];
    const allTasks = useQuery(api.tasks.list) || [];

    const teamAgents = allAgents.filter((a: any) => a.teamId === teamId);
    const teamTasks = allTasks.filter((t: any) => t.teamId === teamId);

    // Mission Creation Logic
    const createMission = useMutation(api.tasks.create);

    const handleCreateMission = async (title: string, description: string, teamIdVal?: string) => {
        await createMission({
            title,
            description,
            status: "inbox",
            priority: "high",
            teamId: teamIdVal as any
        });
    };

    // Filter agents
    const filteredAgents = teamAgents.filter((a: any) => {
        if (agentFilter === 'all') return true;
        const isOffline = a.status === 'offline' || (Date.now() - (a.lastHeartbeat || 0) > 60000);
        if (agentFilter === 'offline') return isOffline;
        if (agentFilter === 'online') return !isOffline;
        return true;
    });

    if (!team) return <div className="p-8 text-center opacity-50">Loading Department...</div>;

    return (
        <div className="flex h-full overflow-hidden">
            {/* LEFT SIDEBAR: FLEET */}
            <div className={`w-64 flex-none flex flex-col border-r relative z-20
                ${theme === 'dark' ? 'border-white/5 bg-[#0d1117]' : 'border-slate-200 bg-slate-50'}
            `}>
                {/* Sidebar Header */}
                <div className={`p-4 border-b flex items-center justify-between flex-none
                     ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}
                `}>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-purple-500' : 'bg-purple-600'}`} />
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">FLEET</h2>
                    </div>
                    <button
                        onClick={() => setAgentFilter(agentFilter === 'all' ? 'online' : 'all')}
                        className={`p-1.5 rounded-lg border transition-colors
                            ${agentFilter !== 'all'
                                ? 'bg-purple-500 text-white border-purple-400'
                                : (theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-100')}
                        `}
                        title="Filter Agents"
                    >
                        <Filter className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Agents Section */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between flex-none">
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-green-500' : 'bg-green-600'}`} />
                            AGENTS
                            <span className={`px-2 py-0.5 rounded text-xs font-bold opacity-60
                                ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}
                            `}>
                                {filteredAgents.length}
                            </span>
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4">
                        {filteredAgents.length > 0 ? (
                            <div className="flex flex-col gap-0 py-2">
                                {filteredAgents.map((agent: any) => {
                                    const isOffline = agent.status === 'offline' || (Date.now() - (agent.lastHeartbeat || 0) > 60000);

                                    // Get badge based on role
                                    const role = agent.role?.toLowerCase() || '';
                                    let badgeLabel = 'SPC';
                                    if (role.includes('lead') || role.includes('founder') || role.includes('manager')) {
                                        badgeLabel = 'LEAD';
                                    } else if (role.includes('developer') || role.includes('engineer') || role.includes('architect')) {
                                        badgeLabel = 'INT';
                                    }

                                    const getBadgeStyle = (label: string) => {
                                        switch (label) {
                                            case 'LEAD': return 'bg-orange-100 text-orange-700 border-orange-200';
                                            case 'INT': return 'bg-amber-100 text-amber-700 border-amber-200';
                                            case 'SPC': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
                                            default: return 'bg-slate-100 text-slate-600';
                                        }
                                    };

                                    // Get icon based on role
                                    const getIcon = () => {
                                        const r = role;
                                        if (r.includes('founder') || r.includes('lead')) return '👤';
                                        if (r.includes('developer') || r.includes('engineer')) return '🔧';
                                        if (r.includes('research')) return '🔬';
                                        if (r.includes('writer') || r.includes('content')) return '✍️';
                                        if (r.includes('marketing') || r.includes('email')) return '🔥';
                                        if (r.includes('social') || r.includes('media')) return '📱';
                                        if (r.includes('product') || r.includes('analyst')) return '🔍';
                                        if (r.includes('seo') || r.includes('data')) return '📊';
                                        if (r.includes('design')) return '🎨';
                                        if (r.includes('hr') || r.includes('human')) return '👥';
                                        return '🤖';
                                    };

                                    return (
                                        <div
                                            key={agent._id}
                                            className={`group flex items-center gap-3 py-3 border-b border-dashed last:border-0 cursor-pointer hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors
                                                ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}
                                            `}
                                            onClick={() => onEditAgent?.(agent)}
                                        >
                                            {/* Icon Avatar */}
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm text-base flex-none
                                                ${theme === 'dark'
                                                    ? 'bg-white/5 border-white/10'
                                                    : 'bg-orange-50/50 border-orange-100'}
                                            `}>
                                                {getIcon()}
                                            </div>

                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`font-bold text-xs truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                                        {agent.name}
                                                    </span>
                                                    <span className={`text-[8px] px-1 py-0.5 rounded border font-bold uppercase tracking-wider flex-none ${getBadgeStyle(badgeLabel)}`}>
                                                        {badgeLabel}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                                                    {agent.role}
                                                </span>
                                            </div>

                                            {/* Status Dot */}
                                            <div className={`w-2 h-2 rounded-full flex-none ${isOffline ? 'bg-slate-400' : 'bg-green-500 animate-pulse'}`} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 text-center">
                                <p className="text-xs opacity-50 mb-3">No agents</p>
                                <button
                                    onClick={() => setIsHireModalOpen(true)}
                                    className="text-cyan-500 hover:text-cyan-400 text-xs font-bold flex items-center gap-2 mx-auto"
                                >
                                    <UserPlus className="w-3 h-3" />
                                    Hire Agent
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tools Section */}
                <div className={`border-t p-4 flex-none
                    ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}
                `}>
                    <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2 mb-3">
                        <Wrench className="w-3 h-3" />
                        AUTHORIZATIONS
                    </h3>
                    <div className="flex flex-col gap-0">
                        {team.allowedTools?.slice(0, 3).map((tool: string) => (
                            <div key={tool} className={`flex items-center gap-2 py-2 border-b border-dashed last:border-0
                                ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}
                            `}>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className={`text-[10px] font-mono truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{tool}</span>
                            </div>
                        ))}
                        {(!team.allowedTools || team.allowedTools.length === 0) && (
                            <div className="text-[10px] opacity-50 italic text-center py-2">
                                No tools
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT: MISSION CONTROL */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent">
                {/* Header */}
                <div className={`h-14 border-b flex items-center justify-between px-6 flex-none
                     ${theme === 'dark' ? 'border-white/5 bg-[#0d1117]/50 backdrop-blur' : 'border-slate-200 bg-white/50'}
                `}>
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg tracking-tight">{team.name}</h1>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border
                            ${theme === 'dark' ? 'border-white/20 text-slate-400' : 'border-slate-300 text-slate-500'}
                        `}>
                            {team.slug}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMissionModalOpen(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95
                                ${theme === 'dark'
                                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-white'}
                            `}
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            New Mission
                        </button>
                        <button
                            onClick={() => setIsHireModalOpen(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95
                                ${theme === 'dark'
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-green-500 hover:bg-green-400 text-white'}
                            `}
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Recruit Agent
                        </button>
                    </div>
                </div>

                {/* Mission Board */}
                <div className="flex-1 overflow-hidden p-6">
                    <div className="h-full overflow-x-auto">
                        <TaskBoard tasks={teamTasks} agents={allAgents} onTaskClick={onTaskClick} />
                    </div>
                </div>
            </div>

            <HireAgentModal
                isOpen={isHireModalOpen}
                onClose={() => setIsHireModalOpen(false)}
                teamId={teamId}
            />

            <NewMissionModal
                isOpen={isMissionModalOpen}
                onClose={() => setIsMissionModalOpen(false)}
                onSubmit={handleCreateMission}
                teamId={teamId}
            />
        </div>
    );
}
