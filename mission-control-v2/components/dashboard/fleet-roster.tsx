"use client";

import { motion } from "framer-motion";
import {
    Bot,
    User,
    Wrench,
    Microscope,
    PenTool,
    Flame,
    Smartphone,
    Search,
    BarChart,
    Palette,
    Clipboard,
} from "lucide-react";

interface FleetRosterProps {
    agents: any[];
}

export function FleetRoster({ agents }: FleetRosterProps) {
    // Helper: Get Icon based on Name/Role
    const getAgentIcon = (role: string = "", name: string = "") => {
        const r = role.toLowerCase();
        const n = name.toLowerCase();
        if (r.includes("founder") || r.includes("lead")) return User;
        if (r.includes("developer") || r.includes("engineer")) return Wrench;
        if (r.includes("research")) return Microscope;
        if (n.includes("jarvis") || r.includes("squad")) return Bot;
        if (r.includes("writer") || r.includes("content")) return PenTool;
        if (r.includes("marketing") || r.includes("email")) return Flame;
        if (r.includes("social") || r.includes("media")) return Smartphone;
        if (r.includes("product") || r.includes("analyst")) return Search;
        if (r.includes("seo") || r.includes("data")) return BarChart;
        if (r.includes("design")) return Palette;
        if (r.includes("document")) return Clipboard;
        return Bot; // Default
    };

    // Helper: Get Badge (LEAD, INT, SPC)
    const getBadge = (role: string = "") => {
        const r = role.toLowerCase();
        if (r.includes("lead") || r.includes("founder") || r.includes("manager"))
            return "LEAD";
        if (
            r.includes("developer") ||
            r.includes("engineer") ||
            r.includes("architect") ||
            r.includes("int")
        )
            return "INT";
        return "SPC"; // Specialist / Default
    };

    // Helper: Badge Style
    const getBadgeStyle = (label: string) => {
        switch (label) {
            case "LEAD":
                return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
            case "INT":
                return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
            case "SPC":
                return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
            default:
                return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-none px-1">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        AGENTS
                    </h3>
                </div>
                <div className="px-2 py-0.5 rounded text-xs font-bold bg-secondary text-secondary-foreground">
                    {agents.length}
                </div>
            </div>

            {/* List */}
            <div className="flex flex-col gap-0 overflow-y-auto pr-1 pb-4">
                {agents.map((agent) => {
                    const Icon = getAgentIcon(agent.role, agent.name);
                    const badgeLabel = getBadge(agent.role);
                    const isOffline =
                        agent.status === "offline" ||
                        Date.now() - (agent.lastHeartbeat || 0) > 60000;

                    let statusText = "WORKING";
                    let dotColor = "bg-green-500";
                    let textColor = "text-green-600 dark:text-green-400";

                    if (isOffline) {
                        statusText = "OFFLINE";
                        dotColor = "bg-slate-400";
                        textColor = "text-slate-500";
                    } else if (agent.status === "idle") {
                        statusText = "ONLINE";
                        dotColor = "bg-emerald-500";
                        textColor = "text-emerald-600 dark:text-emerald-400";
                    }

                    return (
                        <motion.div
                            key={agent._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group flex items-center justify-between py-3 border-b border-dashed border-border last:border-0"
                        >
                            <div className="flex items-center gap-3">
                                {/* Avatar Icon */}
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-card shadow-sm">
                                    <Icon className="w-5 h-5 opacity-80" />
                                </div>

                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{agent.name}</span>
                                        {/* Role Badge */}
                                        <span
                                            className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${getBadgeStyle(
                                                badgeLabel
                                            )}`}
                                        >
                                            {badgeLabel}
                                        </span>
                                    </div>
                                    <span className="text-xs truncate max-w-[120px] text-muted-foreground">
                                        {agent.role}
                                    </span>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-2 h-2 rounded-full ${dotColor} ${!isOffline && "animate-pulse"
                                        }`}
                                />
                                <span
                                    className={`text-[10px] font-bold uppercase tracking-wider ${textColor}`}
                                >
                                    {statusText}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
