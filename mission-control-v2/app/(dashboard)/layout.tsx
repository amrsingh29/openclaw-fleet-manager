"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const router = useRouter();

    const handleTeamSelect = (teamId: string) => {
        router.push(`/teams/${teamId}`);
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Background Gradient Mesh */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-purple-900/20 dark:bg-purple-900/20" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-cyan-900/20 dark:bg-cyan-900/20" />
            </div>

            {/* Sidebar */}
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onTeamSelect={handleTeamSelect}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                {children}
            </div>
        </div>
    );
}
