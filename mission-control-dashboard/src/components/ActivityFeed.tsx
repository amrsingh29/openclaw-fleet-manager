import { motion } from 'framer-motion';
import { MessageSquare, FileText, CheckCircle, Activity } from 'lucide-react';
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTheme } from '../context/ThemeContext';

export function ActivityFeed() {
    const activities = useQuery(api.activities.list) || [];
    const { theme } = useTheme();

    const icons: Record<string, JSX.Element> = {
        message_sent: <MessageSquare className="w-4 h-4 text-cyan-500" />,
        task_created: <Activity className="w-4 h-4 text-slate-400" />,
        task_assigned: <Activity className="w-4 h-4 text-yellow-500" />,
        task_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
        doc: <FileText className="w-4 h-4 text-purple-500" />,
    };

    return (
        <div className={`rounded-xl border flex flex-col h-full opacity-90 transition-colors duration-300
            ${theme === 'dark'
                ? 'border-white/10 bg-white/5 backdrop-blur-md'
                : 'border-slate-200 bg-white shadow-sm'}
        `}>
            <div className={`p-4 border-b sticky top-0 backdrop-blur-md z-10 transition-colors duration-300
                ${theme === 'dark'
                    ? 'border-white/10 bg-white/5'
                    : 'border-slate-100 bg-white/90'}
            `}>
                <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    Live Feed
                </h3>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {activities.map((item: any, i: number) => (
                    <motion.div
                        key={item._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex gap-3 text-sm"
                    >
                        <div className="mt-1 opacity-80">{icons[item.type] || <Activity className="w-4 h-4 text-purple-400" />}</div>
                        <div>
                            <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>
                                {item.message}
                            </p>
                            <p className="text-xs text-slate-500/80 mt-1 font-mono">
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </motion.div>
                ))}
                {/* Placeholder for empty state */}
                {activities.length === 0 && (
                    <div className="py-8 text-center">
                        <p className="text-slate-500 text-xs">No recent activity</p>
                    </div>
                )}
            </div>
        </div>
    );
}
