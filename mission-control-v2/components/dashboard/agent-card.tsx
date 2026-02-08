"use client";

import { motion } from "framer-motion";
import { Bot, Zap, Settings2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AgentCardProps {
    agent: {
        _id: string;
        name: string;
        role: string;
        status: "idle" | "active" | "working" | "blocked" | "offline";
        lastHeartbeat?: number;
        currentTaskId?: string;
    };
    onEdit?: () => void;
    onViewDetails?: () => void;
}

export function AgentCard({ agent, onEdit, onViewDetails }: AgentCardProps) {
    const isOffline =
        agent.status === "offline" ||
        (Date.now() - (agent.lastHeartbeat || 0) > 60000);
    const displayStatus = isOffline ? "offline" : agent.status;

    const getStatusColor = (status: string) => {
        switch (status) {
            case "working":
                return "bg-cyan-500";
            case "active":
                return "bg-green-500";
            case "idle":
                return "bg-yellow-500";
            case "offline":
                return "bg-slate-500";
            case "blocked":
                return "bg-red-500";
            default:
                return "bg-slate-400";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "working":
                return "Working";
            case "active":
                return "Active";
            case "idle":
                return "Idle";
            case "offline":
                return "Offline";
            case "blocked":
                return "Blocked";
            default:
                return "Unknown";
        }
    };

    // Get icon based on role
    const getIcon = () => {
        const role = agent.role?.toLowerCase() || "";
        if (role.includes("founder") || role.includes("lead")) return "👤";
        if (role.includes("developer") || role.includes("engineer")) return "🔧";
        if (role.includes("research")) return "🔬";
        if (role.includes("writer") || role.includes("content")) return "✍️";
        if (role.includes("marketing") || role.includes("email")) return "🔥";
        if (role.includes("social") || role.includes("media")) return "📱";
        if (role.includes("product") || role.includes("analyst")) return "🔍";
        if (role.includes("seo") || role.includes("data")) return "📊";
        if (role.includes("design")) return "🎨";
        if (role.includes("hr") || role.includes("human")) return "👥";
        return "🤖";
    };

    // Get badge based on role
    const getBadge = () => {
        const role = agent.role?.toLowerCase() || "";
        if (role.includes("lead") || role.includes("founder") || role.includes("manager")) {
            return { label: "LEAD", variant: "default" as const };
        }
        if (role.includes("developer") || role.includes("engineer") || role.includes("architect")) {
            return { label: "INT", variant: "secondary" as const };
        }
        return { label: "SPC", variant: "outline" as const };
    };

    const badge = getBadge();

    return (
        <Link href={`/agents/${agent._id}`}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
            >
                <Card className="relative overflow-hidden group cursor-pointer">
                    {/* Status indicator bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${getStatusColor(displayStatus)}`} />

                    <CardContent className="pt-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl border border-primary/20">
                                    {getIcon()}
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-sm">{agent.name}</h4>
                                        <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
                                            {badge.label}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-1">{agent.role}</p>
                                </div>
                            </div>

                            {/* Edit button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEdit?.();
                                }}
                            >
                                <Settings2 className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(displayStatus)} ${displayStatus === "working" ? "animate-pulse" : ""}`} />
                                <span className="text-xs font-medium">{getStatusLabel(displayStatus)}</span>
                            </div>

                            {agent.currentTaskId && (
                                <Badge variant="secondary" className="text-[10px]">
                                    On Task
                                </Badge>
                            )}
                        </div>

                        {/* Last seen */}
                        {agent.lastHeartbeat && (
                            <p className="text-[10px] text-muted-foreground mt-2">
                                Last seen {Math.floor((Date.now() - agent.lastHeartbeat) / 60000)}m ago
                            </p>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </Link>
    );
}
