
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import {
    Bot, Zap, Clock, AlertCircle, Cpu, User, Wrench, Microscope,
    PenTool, Flame, Smartphone, Search, BarChart, Palette, Clipboard
} from 'lucide-react';

interface FleetStatusBoardProps {
    agents: any[];
}

export function FleetStatusBoard({ agents }: FleetStatusBoardProps) {
    const { theme } = useTheme();

    // Helper: Get Icon based on Name/Role
    const getAgentIcon = (role: string = '', name: string = '') => {
        const r = role.toLowerCase();
        const n = name.toLowerCase();
        if (r.includes('founder') || r.includes('lead')) return User;
        if (r.includes('developer') || r.includes('engineer')) return Wrench;
        if (r.includes('research')) return Microscope;
        if (n.includes('jarvis') || r.includes('squad')) return Bot;
        if (r.includes('writer') || r.includes('content')) return PenTool;
        if (r.includes('marketing') || r.includes('email')) return Flame;
        if (r.includes('social') || r.includes('media')) return Smartphone;
        if (r.includes('product') || r.includes('analyst')) return Search;
        if (r.includes('seo') || r.includes('data')) return BarChart;
        if (r.includes('design')) return Palette;
        if (r.includes('document')) return Clipboard;
        return Bot; // Default
    };

    // Helper: Get Badge (LEAD, INT, SPC)
    const getBadge = (role: string = '') => {
        const r = role.toLowerCase();
        if (r.includes('lead') || r.includes('founder') || r.includes('manager')) return 'LEAD';
        if (r.includes('developer') || r.includes('engineer') || r.includes('architect') || r.includes('int')) return 'INT';
        return 'SPC'; // Specialist / Default
    };

    // Helper: Badge Style
    const getBadgeStyle = (label: string) => {
        // Using colors from the image (Tan/Orange/Beige)
        // Since we don't have exact hex, we'll approximate with Tailwind classes
        switch (label) {
            case 'LEAD': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'INT': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'SPC': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header: AGENTS [Count] */}
            <div className="flex items-center justify-between mb-4 flex-none px-1">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-green-500' : 'bg-green-600'}`} />
                    <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">AGENTS</h3>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-bold opacity-60
                    ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}
                `}>
                    {agents.length}
                </div>
            </div>

            {/* List */}
            <div className="flex flex-col gap-0 overflow-y-auto pr-1 pb-4">
                {agents.map((agent, i) => {
                    const Icon = getAgentIcon(agent.role, agent.name);
                    const badgeLabel = getBadge(agent.role);
                    const isOffline = agent.status === 'offline' || (Date.now() - (agent.lastHeartbeat || 0) > 60000);
                    const isWorking = agent.status === 'working' || agent.status === 'busy' || !isOffline; // Assume working if online for this design? 
                    // Actually, let's use real status. The image shows all "WORKING". 
                    // I will map real status to "WORKING" (Green), "IDLE" (Yellow/Grey?), "OFFLINE" (Red/Gray).

                    let statusColor = 'green';
                    let statusText = 'WORKING';
                    if (isOffline) {
                        statusColor = 'slate';
                        statusText = 'OFFLINE';
                    } else if (agent.status === 'idle') {
                        statusColor = 'emerald'; // Idle is technically ready to work, often shown as Green/Working in this mockup context?
                        statusText = 'READY'; // Or just map everything online to "WORKING" as per mockup request?
                        // The user said "look like this", and the image shows "WORKING".
                        // I'll stick to real status but style it like the image.
                        statusText = 'ONLINE';
                    } else if (agent.status === 'working' || agent.status === 'busy') {
                        statusColor = 'green';
                        statusText = 'WORKING';
                    }

                    // For the sake of the visual "Working" requested:
                    // If online, use Green + WORKING/ONLINE.
                    const dotColor = isOffline ? 'bg-slate-400' : 'bg-green-500';
                    const textColor = isOffline ? 'text-slate-500' : 'text-green-600';

                    return (
                        <div key={agent._id} className={`group flex items-center justify-between py-3 border-b border-dashed last:border-0 relative
                             ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}
                        `}>
                            <div className="flex items-center gap-3">
                                {/* Large Avatar Icon */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm
                                    ${theme === 'dark'
                                        ? 'bg-white/5 border-white/10 text-slate-300'
                                        : 'bg-orange-50/50 border-orange-100 text-slate-600'}
                                `}>
                                    <Icon className="w-5 h-5 opacity-80" />
                                </div>

                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                            {agent.name}
                                        </span>
                                        {/* Role Badge */}
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${getBadgeStyle(badgeLabel)}`}>
                                            {badgeLabel}
                                        </span>
                                    </div>
                                    <span className={`text-xs truncate max-w-[120px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                                        {agent.role}
                                    </span>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${dotColor} ${!isOffline && 'animate-pulse'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
                                    {statusText}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
