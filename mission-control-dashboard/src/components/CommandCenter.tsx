
import { useState } from 'react';
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTheme } from '../context/ThemeContext';
import { ActivityFeed } from './ActivityFeed';
import { TaskBoard } from './TaskBoard';
import { TaskTable } from './TaskTable';
import { FleetStatusBoard } from './FleetStatusBoard';
import { LayoutGrid, List, Filter, Activity, Users, Plus, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface CommandCenterProps {
    onTaskClick: (task: any) => void;
}

export function CommandCenter({ onTaskClick }: CommandCenterProps) {
    const { theme } = useTheme();

    // Data
    const agents = useQuery(api.agents.list) || [];
    const tasks = useQuery(api.tasks.list) || [];

    // State
    const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
    const [agentFilter, setAgentFilter] = useState<'all' | 'working' | 'offline'>('all');
    const [logFilter, setLogFilter] = useState<'all' | 'system' | 'agent-work' | 'chat'>('all');
    const [isIntelCollapsed, setIsIntelCollapsed] = useState(true);

    // Filter Logic
    const filteredAgents = agents.filter((a: any) => {
        if (agentFilter === 'all') return true;
        if (agentFilter === 'working') return a.status === 'working' || a.status === 'busy';
        if (agentFilter === 'offline') return (a.status === 'offline') || (Date.now() - (a.lastHeartbeat || 0) > 60000);
        return true;
    });

    return (
        <div className="flex h-full overflow-hidden">

            {/* LEFT PANE: FLEET COMMAND (Fixed 288px) */}
            <div className={`w-72 flex-none flex flex-col border-r relative z-20
                ${theme === 'dark' ? 'border-white/5 bg-[#0d1117]' : 'border-slate-200 bg-slate-50'}
            `}>
                <div className={`p-4 border-b flex items-center justify-between flex-none
                     ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}
                `}>
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Fleet</h2>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setAgentFilter(agentFilter === 'all' ? 'working' : 'all')}
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
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <FleetStatusBoard agents={filteredAgents} />
                </div>
            </div>

            {/* CENTER PANE: MISSION BOARD (Fluid) */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
                {/* Header */}
                <div className={`h-14 border-b flex items-center justify-between px-6 flex-none
                     ${theme === 'dark' ? 'border-white/5 bg-[#0d1117]/50 backdrop-blur' : 'border-slate-200 bg-white/50'}
                `}>
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg tracking-tight">Mission Control</h1>
                        <div className={`flex items-center p-1 rounded-lg border
                             ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'}
                        `}>
                            <button
                                onClick={() => setViewMode('board')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-cyan-500 text-white shadow' : 'opacity-50 hover:opacity-100'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-cyan-500 text-white shadow' : 'opacity-50 hover:opacity-100'}`}
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Right Pane Logic is handled in the pane itself, but maybe we want a toggle here if it disappears completely? 
                            Nah, let's keep the strip visible.
                        */}
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-hidden p-6">
                    {viewMode === 'board' ? (
                        <div className="h-full overflow-x-auto">
                            <TaskBoard tasks={tasks} agents={agents} onTaskClick={onTaskClick} />
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <TaskTable tasks={tasks} agents={agents} onTaskClick={onTaskClick} />
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANE: LIVE INTEL (Collapsible) */}
            <div className={`flex-none flex flex-col border-l relative z-20 transition-all duration-300
                ${theme === 'dark' ? 'border-white/5 bg-[#0d1117]' : 'border-slate-200 bg-slate-50'}
                ${isIntelCollapsed ? 'w-12' : 'w-80'}
            `}>
                <div className={`p-4 border-b flex items-center justify-between flex-none h-14
                    ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}
                    ${isIntelCollapsed ? 'flex-col justify-center px-0 gap-4' : ''}
                 `}>
                    {!isIntelCollapsed ? (
                        <>
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-500" />
                                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Live Intel</h2>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setLogFilter(logFilter === 'all' ? 'agent-work' : logFilter === 'agent-work' ? 'system' : 'all')}
                                    className={`p-1 rounded hover:bg-white/5 text-[10px] font-bold uppercase tracking-wider
                                        ${logFilter !== 'all' ? 'text-cyan-500' : 'text-slate-500'}
                                    `}
                                >
                                    {logFilter === 'all' ? 'All' : logFilter.replace('-', ' ')}
                                </button>
                                <button onClick={() => setIsIntelCollapsed(true)} className="p-1 hover:bg-white/10 rounded" title="Hide Live Intel">
                                    <PanelRightClose className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <button onClick={() => setIsIntelCollapsed(false)} className="p-2 hover:bg-white/10 rounded" title="Show Live Intel">
                            <PanelRightOpen className="w-5 h-5 text-cyan-500" />
                        </button>
                    )}
                </div>

                {!isIntelCollapsed && (
                    <div className="flex-1 overflow-hidden relative p-4">
                        <ActivityFeed minimal filter={logFilter} />
                    </div>
                )}
            </div>

        </div>
    );
}
