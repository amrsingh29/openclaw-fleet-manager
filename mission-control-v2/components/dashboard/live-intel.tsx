"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
    MessageSquare,
    FileText,
    CheckCircle,
    Activity,
    UserPlus,
    Clock,
} from "lucide-react";

interface LiveIntelProps {
    filter?: "all" | "system" | "agent-work" | "chat";
    minimal?: boolean;
}

export function LiveIntel({ filter = "all", minimal = false }: LiveIntelProps) {
    const activities = useQuery(api.activities.list) || [];

    const icons: Record<string, React.ReactElement> = {
        message_sent: <MessageSquare className="w-4 h-4 text-cyan-500" />,
        task_created: <Activity className="w-4 h-4 text-slate-400" />,
        task_assigned: <UserPlus className="w-4 h-4 text-yellow-500" />,
        task_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
        doc: <FileText className="w-4 h-4 text-purple-500" />,
    };

    // Filter Logic
    const filteredActivities = activities.filter((item: any) => {
        if (filter === "all") return true;
        if (filter === "system")
            return item.type === "task_created" || item.type === "task_assigned";
        if (filter === "agent-work")
            return item.type === "task_completed" || item.type === "doc";
        if (filter === "chat") return item.type === "message_sent";
        return true;
    });

    return (
        <div
            className={`flex flex-col h-full ${!minimal
                ? "rounded-xl border border-border bg-card/50 backdrop-blur-md"
                : "bg-transparent"
                }`}
        >
            {!minimal && (
                <div className="p-4 border-b border-border sticky top-0 backdrop-blur-md z-10">
                    <h3 className="text-sm font-semibold">Live Feed</h3>
                </div>
            )}

            <div className={`flex-1 overflow-auto space-y-4 ${minimal ? "p-1" : "p-4"}`}>
                {filteredActivities.map((item: any, i: number) => (
                    <motion.div
                        key={item._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-3 text-sm group"
                    >
                        <div className="mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            {icons[item.type] || (
                                <Activity className="w-4 h-4 text-purple-400" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="leading-snug break-words text-foreground/80">
                                {item.message}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 font-mono">
                                <Clock className="w-3 h-3" />
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </motion.div>
                ))}

                {filteredActivities.length === 0 && (
                    <div className="py-8 text-center">
                        <Activity className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-xs italic">
                            No activity yet
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
