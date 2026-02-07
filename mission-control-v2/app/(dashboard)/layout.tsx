"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Command Palette */}
            <CommandPalette />

            {/* Sidebar */}
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onTeamSelect={(teamId) => console.log("Selected team:", teamId)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                {children}
            </div>
        </div>
    );
}
