"use client";

import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
    Activity,
    MessageSquare,
    Users,
    Settings,
    Sun,
    Moon,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    onTeamSelect?: (teamId: string) => void;
}

export function Sidebar({ isCollapsed, onToggle, onTeamSelect }: SidebarProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const teams = useQuery(api.teams.list) || [];
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { href: "/", icon: Activity, label: "Dashboard" },
        { href: "/war-room", icon: MessageSquare, label: "War Room" },
        { href: "/agents", icon: Users, label: "Agents" },
        { href: "/settings", icon: Settings, label: "Settings" },
    ];

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 256 }}
            className="z-10 border-r border-border flex flex-col p-3 backdrop-blur-xl bg-card/50 h-full relative"
        >
            {/* Header & Toggle */}
            <div
                className={`flex items-center mb-8 px-1 ${isCollapsed ? "justify-center flex-col gap-4" : "justify-between"
                    }`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex flex-none items-center justify-center shadow-lg shadow-cyan-500/20">
                        <span className="font-bold text-white">M</span>
                    </div>
                    {!isCollapsed && (
                        <motion.h1
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xl font-bold tracking-tight whitespace-nowrap"
                        >
                            Mission Control
                        </motion.h1>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="h-8 w-8"
                >
                    {isCollapsed ? (
                        <PanelLeftOpen className="w-4 h-4" />
                    ) : (
                        <PanelLeftClose className="w-4 h-4" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <nav className="space-y-2 flex-1 overflow-y-auto overflow-x-hidden">
                {/* Main Nav */}
                <div className="mb-6">
                    {!isCollapsed && (
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 whitespace-nowrap">
                            Platform
                        </h3>
                    )}
                    <div className="flex flex-col gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;

                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"
                                            } ${isActive ? "bg-primary/10 text-primary" : ""}`}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <Icon className="w-4 h-4 flex-none" />
                                        {!isCollapsed && (
                                            <span className="ml-3 font-medium">{item.label}</span>
                                        )}
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Teams Section */}
                <div>
                    {!isCollapsed && (
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 whitespace-nowrap">
                            Departments
                        </h3>
                    )}
                    {teams.map((team: any) => (
                        <Button
                            key={team._id}
                            variant="ghost"
                            className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"
                                } relative group`}
                            onClick={() => onTeamSelect?.(team._id)}
                        >
                            <div className="w-2 h-2 rounded-full bg-primary flex-none" />
                            {!isCollapsed && (
                                <span className="ml-3 truncate text-sm">{team.name}</span>
                            )}
                            {isCollapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 rounded bg-popover border text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                                    {team.name}
                                </div>
                            )}
                        </Button>
                    ))}
                </div>
            </nav>

            {/* Theme Toggle */}
            <div className="mb-4 px-1">
                <Button
                    variant="ghost"
                    className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"
                        }`}
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    disabled={!mounted}
                    title={
                        isCollapsed
                            ? theme === "dark"
                                ? "Switch to Light Mode"
                                : "Switch to Dark Mode"
                            : undefined
                    }
                >
                    {mounted ? (
                        theme === "dark" ? (
                            <Sun className="w-4 h-4 flex-none" />
                        ) : (
                            <Moon className="w-4 h-4 flex-none" />
                        )
                    ) : (
                        <div className="w-4 h-4" />
                    )}
                    {!isCollapsed && (
                        <span className="ml-3">
                            {mounted
                                ? theme === "dark"
                                    ? "Light Mode"
                                    : "Dark Mode"
                                : "Theme"}
                        </span>
                    )}
                </Button>
            </div>

            {!isCollapsed && (
                <div className="text-xs text-muted-foreground text-center px-2 whitespace-nowrap">
                    v2.0.0 • Online
                </div>
            )}
        </motion.aside>
    );
}
