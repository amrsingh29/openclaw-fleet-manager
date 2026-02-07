"use client";

import { motion } from "framer-motion";
import { Clock, AlertCircle, CheckCircle, Circle, User } from "lucide-react";

interface TaskTableProps {
    tasks: any[];
    onTaskClick?: (task: any) => void;
    agents: any[];
}

export function TaskTable({ tasks, onTaskClick, agents }: TaskTableProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case "done":
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case "in_progress":
                return <Circle className="w-4 h-4 text-cyan-500 animate-pulse" />;
            case "review":
                return <AlertCircle className="w-4 h-4 text-purple-500" />;
            default:
                return <Circle className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getAgentName = (id?: string) => {
        if (!id) return "-";
        const agent = agents.find((a) => a._id === id);
        return agent ? agent.name : "Unknown";
    };

    return (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Task</th>
                            <th className="px-4 py-3 font-medium">Priority</th>
                            <th className="px-4 py-3 font-medium">Agent</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {tasks.map((task) => (
                            <motion.tr
                                key={task._id}
                                layoutId={task._id}
                                onClick={() => onTaskClick?.(task)}
                                className="cursor-pointer transition-colors hover:bg-accent"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(task.status)}
                                        <span className="capitalize opacity-80">
                                            {task.status.replace("_", " ")}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium max-w-xs truncate" title={task.title}>
                                        {task.title}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {task.priority === "high" ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                            HIGH
                                        </span>
                                    ) : (
                                        <span className="opacity-50 text-xs">Normal</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3 h-3 opacity-50" />
                                        <span>{getAgentName(task.assigneeIds?.[0])}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 opacity-50 font-mono text-xs">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(task._creationTime).toLocaleDateString()}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {tasks.length === 0 && (
                <div className="p-8 text-center opacity-50 text-xs italic">
                    No tasks found.
                </div>
            )}
        </div>
    );
}
