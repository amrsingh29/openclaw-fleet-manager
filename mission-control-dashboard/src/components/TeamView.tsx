import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api"; // Note: Might need to point to correct relative path
import { AgentCard } from "./AgentCard";
import { Wrench, UserPlus } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { HireAgentModal } from "./HireAgentModal";

interface TeamViewProps {
    teamId: string;
    onTaskClick?: (task: any) => void;
}

export function TeamView({ teamId, onTaskClick }: TeamViewProps) {
    const { theme } = useTheme();
    const [isHireModalOpen, setIsHireModalOpen] = useState(false);
    const team = useQuery(api.teams.get, { id: teamId as any });
    const allAgents = useQuery(api.agents.list) || [];
    const teamAgents = allAgents.filter((a: any) => a.teamId === teamId);

    // Mission Creation Logic
    const createMission = useMutation(api.tasks.create);
    const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);

    const handleCreateMission = async (title: string, description: string, teamIdVal?: string) => {
        await createMission({
            title,
            description,
            status: "inbox",
            priority: "high",
            teamId: teamIdVal as any
        });
    };

    if (!team) return <div className="p-8 text-center opacity-50">Loading Department...</div>;

    return (
        <div className="max-w-[1600px] mx-auto p-6 xl:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className={`relative overflow-hidden p-8 rounded-3xl border shadow-sm
                ${theme === 'dark' ? 'bg-[#161b22] border-white/10' : 'bg-white border-slate-200'}
            `}>
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2`} />

                <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-4 max-w-2xl">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border
                                    ${theme === 'dark' ? 'border-white/20 text-slate-400' : 'border-slate-300 text-slate-500'}
                                `}>
                                    {team.slug}
                                </span>
                            </div>
                            <p className="text-lg opacity-70 leading-relaxed">{team.mission}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsHireModalOpen(true)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all hover:scale-105 active:scale-95
                            ${theme === 'dark'
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'
                                : 'bg-green-500 hover:bg-green-400 text-white shadow-green-500/20'}
                        `}
                    >
                        <UserPlus className="w-4 h-4" />
                        Recruit Agent
                    </button>
                </div>
            </div>

            {/* Roster Section */}
            <div>
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-sm font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                        Active Roster
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}>
                            {teamAgents.length}
                        </span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {teamAgents.map((agent: any) => (
                        <AgentCard
                            key={agent._id}
                            name={agent.name}
                            role={agent.role}
                            status={agent.status}
                            lastHeartbeat={agent.lastHeartbeat || Date.now()}
                        />
                    ))}
                    {teamAgents.length === 0 && (
                        <div className={`col-span-full p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4
                            ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'}
                        `}>
                            <p className="opacity-50 font-medium">No agents assigned to this department.</p>
                            <button
                                onClick={() => setIsHireModalOpen(true)}
                                className="text-cyan-500 hover:text-cyan-400 text-sm font-bold flex items-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Hire the first agent
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tools Column (1/3) */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider opacity-60 flex items-center gap-2 px-1">
                        <Wrench className="w-4 h-4" />
                        Authorizations
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                        {team.allowedTools?.map((tool: string) => (
                            <div key={tool} className={`p-3 rounded-xl border text-sm font-mono flex items-center gap-3 transition-colors group
                                ${theme === 'dark'
                                    ? 'bg-[#161b22] border-white/5 hover:border-white/10'
                                    : 'bg-white border-slate-200 hover:border-slate-300'}
                            `}>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{tool}</span>
                            </div>
                        ))}
                        {(!team.allowedTools || team.allowedTools.length === 0) && (
                            <div className="p-4 rounded-xl border border-dashed opacity-50 text-sm italic text-center">
                                No tools authorized.
                            </div>
                        )}
                    </div>
                </div>

                {/* Missions Column (2/3) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                            Active Missions
                        </h2>
                        <button
                            onClick={() => setIsMissionModalOpen(true)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border
                                ${theme === 'dark'
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20'
                                    : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}
                            `}
                        >
                            <UserPlus className="w-3 h-3" /> {/* Reusing icon for now or use Plus */}
                            New Mission
                        </button>
                    </div>

                    <div className={`rounded-2xl border overflow-hidden min-h-[300px] flex flex-col
                        ${theme === 'dark' ? 'bg-[#161b22] border-white/5' : 'bg-slate-50/50 border-slate-200'}
                    `}>
                        <TeamTaskBoard teamId={teamId} agents={teamAgents} allAgents={allAgents} onTaskClick={onTaskClick} />
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

// Wrapper to fetch filtered tasks for this team
// Optimization: Should use a backend query 'api.tasks.listByTeam' but filtering client side for now.
import { TaskBoard } from "./TaskBoard";
import { NewMissionModal } from "./NewMissionModal"; // Add import
function TeamTaskBoard({ teamId, agents, allAgents, onTaskClick }: { teamId: string, agents: any[], allAgents: any[], onTaskClick?: (task: any) => void }) {
    const allTasks = useQuery(api.tasks.list) || [];
    const teamTasks = allTasks.filter((t: any) => t.teamId === teamId);

    return <TaskBoard tasks={teamTasks} agents={allAgents} onTaskClick={onTaskClick} />;
}
