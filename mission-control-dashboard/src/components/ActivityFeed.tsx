import { motion } from 'framer-motion';
import { MessageSquare, FileText, CheckCircle, Activity } from 'lucide-react';
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTheme } from '../context/ThemeContext';

interface ActivityFeedProps {
    filter?: 'all' | 'system' | 'agent-work' | 'chat';
    minimal?: boolean;
}

export function ActivityFeed({ filter = 'all', minimal = false }: ActivityFeedProps) {
    const activities = useQuery(api.activities.list) || [];
    const { theme } = useTheme();

    const icons: Record<string, JSX.Element> = {
        message_sent: <MessageSquare className="w-4 h-4 text-cyan-500" />,
        task_created: <Activity className="w-4 h-4 text-slate-400" />,
        task_assigned: <Activity className="w-4 h-4 text-yellow-500" />,
        task_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
        doc: <FileText className="w-4 h-4 text-purple-500" />,
    };

    // Filter Logic
    const filteredActivities = activities.filter((item: any) => {
        if (filter === 'all') return true;
        if (filter === 'system') return item.type === 'task_created' || item.type === 'task_assigned';
        if (filter === 'agent-work') return item.type === 'task_completed' || item.type === 'doc';
        if (filter === 'chat') return item.type === 'message_sent';
        return true;
    });

    return (
        <div className={`flex flex-col h-full bg-transparent
            ${!minimal && (theme === 'dark'
                ? 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-md'
                : 'rounded-xl border border-slate-200 bg-white shadow-sm')}
        `}>
            {!minimal && (
                <div className={`p-4 border-b sticky top-0 backdrop-blur-md z-10 transition-colors duration-300
                    ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-white/90'}
                `}>
                    <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        Live Feed
                    </h3>
                </div>
            )}

            <div className={`flex-1 overflow-auto space-y-4 ${minimal ? 'p-1' : 'p-4'}`}>
                {filteredActivities.map((item: any, i: number) => (
                    <motion.div
                        key={item._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-3 text-sm group"
                    >
                        <div className="mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            {icons[item.type] || <Activity className="w-4 h-4 text-purple-400" />}
                        </div>
                        <div className="min-w-0">
                            <p className={`leading-snug break-words ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                {item.message}
                            </p>
                            <p className="text-[10px] text-slate-500/60 mt-0.5 font-mono">
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </motion.div>
                ))}

                {filteredActivities.length === 0 && (
                    <div className="py-8 text-center">
                        <p className="text-slate-500 text-xs italic opacity-50">No activity matching filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
