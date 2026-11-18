"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CLERK_ENABLED } from "@/lib/auth-config";
import { OrgGate } from "@/components/org-gate";

/**
 * The dashboard shell.
 *
 * When auth is off there is no org gate at all: the backend's keyless dev bypass
 * supplies the org id, and asking a user to pick a Clerk organization they cannot
 * have is what produced the blocking modal this replaces.
 *
 * When auth is on, OrgGate handles the Clerk organization requirement.
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background font-sans">
            <CommandPalette />

            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onTeamSelect={(teamId) => console.log("Selected team:", teamId)}
            />

            <div className="flex-1 flex flex-col min-w-0 relative z-10 border-l border-border">
                {CLERK_ENABLED ? <OrgGate>{children}</OrgGate> : children}
            </div>
        </div>
    );
}
