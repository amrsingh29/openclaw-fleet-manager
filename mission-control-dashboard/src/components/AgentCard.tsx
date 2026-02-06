import { motion } from 'framer-motion';
import { Bot, Zap, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface AgentCardProps {
    name: string;
    role: string;
    status: 'idle' | 'working' | 'active' | 'offline';
    lastHeartbeat: number;
}

export function AgentCard({ name, role, status, lastHeartbeat }: AgentCardProps) {
    const { theme } = useTheme();

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'working': return 'bg-cyan-500';
            case 'active': return 'bg-green-500';
            case 'idle': return 'bg-slate-500';
            default: return 'bg-red-500';
        }
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`p-4 rounded-xl border relative overflow-hidden transition-colors duration-300
                ${theme === 'dark'
                    ? 'bg-[#1e293b] border-white/10 shadow-lg'
                    : 'bg-white border-slate-200 shadow-sm'}
            `}
        >
            {/* Status Pulse */}
            <div className="absolute top-4 right-4 flex items-center">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} ${status === 'working' ? 'animate-ping' : ''}`} />
                <div className={`absolute w-2 h-2 rounded-full ${getStatusColor(status)}`} />
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                    ${theme === 'dark'
                        ? 'bg-white/5 text-cyan-400'
                        : 'bg-slate-100 text-slate-700'}
                `}>
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {name}
                    </h4>
                    <p className="text-xs text-slate-500">{role}</p>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-2">
                <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span className="uppercase">{status}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{Math.floor((Date.now() - lastHeartbeat) / 60000)}m ago</span>
                </div>
            </div>

            {/* Progress Bar (Mock) */}
            {status === 'working' && (
                <div className="mt-3 h-1 bg-slate-500/20 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-full bg-cyan-500"
                    />
                </div>
            )}
        </motion.div>
    );
}
