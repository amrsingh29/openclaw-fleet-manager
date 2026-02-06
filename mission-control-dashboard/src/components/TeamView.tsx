import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api"; // Note: Might need to point to correct relative path
import { AgentCard } from "./AgentCard";
import { Shield, Wrench } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface TeamViewProps {
    teamId: string; // We use string because Convex IDs are strings at runtime usually, or Id<"teams">
}

export function TeamView({ teamId }: TeamViewProps) {
    const { theme } = useTheme();
    // Fetch specific team
    const team = useQuery(api.teams.get, { id: teamId as any });
    // Fetch all agents (we filter client side for now, optimally should be a scoped query)
    const allAgents = useQuery(api.agents.list) || [];
    const teamAgents = allAgents.filter((a: any) => a.teamId === teamId);

    if (!team) return <div className="p-8 text-center opacity-50">Loading Department...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className={`p-8 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
                        <p className="text-lg opacity-70 max-w-2xl">{team.mission}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-100 text-blue-600'}`}>
                        <Shield className="w-8 h-8" />
                    </div>
                </div>

                <div className="mt-8 flex gap-2">
                    <span className="text-xs font-mono opacity-50 uppercase tracking-widest">Department ID: {team.slug}</span>
                </div>
            </div>

            {/* Roster */}
            <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="opacity-70">Active Roster</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}>
                        {teamAgents.length}
                    </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <div className="col-span-4 p-8 border border-dashed rounded-xl flex flex-col items-center justify-center opacity-50">
                            <p>No agents assigned to this department.</p>
                            <button className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-400">
                                Hire Agent
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tools */}
            <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    <span>Allowed Tools</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {team.allowedTools?.map((tool: string) => (
                        <div key={tool} className={`p-3 rounded-lg border text-sm font-mono flex items-center gap-2
                             ${theme === 'dark' ? 'bg-[#0d1117] border-white/10' : 'bg-slate-50 border-slate-200'}
                        `}>
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            {tool}
                        </div>
                    ))}
                    {(!team.allowedTools || team.allowedTools.length === 0) && (
                        <div className="text-sm opacity-50 italic">No tools authorized for this department.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
