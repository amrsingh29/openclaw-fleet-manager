"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { useOrganization, OrganizationList } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const { organization, isLoaded } = useOrganization();

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="flex flex-col items-center gap-6">
                    <div className="animate-pulse flex flex-col items-center gap-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-primary/20" />
                        <p className="text-sm font-medium text-muted-foreground">Initializing Command Center...</p>
                    </div>

                    {/* Development Bypass for Initialization */}
                    {process.env.NODE_ENV === "development" && (
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-50">Stuck or Auth Failure?</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => window.location.href = "?bypass=true"}
                            >
                                Force Entry (Bypass Auth)
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const isBypassed = typeof window !== "undefined" && window.location.search.includes("bypass=true");

    if (!organization && !isBypassed) {
        return (
            <div className="flex items-center justify-center h-screen bg-background p-6">
                <div className="max-w-md w-full space-y-8 text-center">
                    <div className="space-y-4">
                        <div className="flex justify-center flex-col items-center gap-2">
                            <h1 className="text-4xl font-extrabold tracking-tight">Organization Required</h1>
                            <p className="text-muted-foreground">
                                OpenClaw is a multi-tenant platform. Please select or create an organization to manage your fleet.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <OrganizationList hidePersonal />

                        {/* Development Fallback */}
                        {process.env.NODE_ENV === "development" && (
                            <div className="p-6 border border-dashed rounded-2xl bg-muted/30 w-full">
                                <p className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest">Dev Protocol: Keyless Override</p>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        toast.info("Mocking Organization", {
                                            description: "Redirecting to your personal workspace for testing purposes. Please configure Clerk API keys for production use."
                                        });
                                        // In real usage, we'd redirect to a setup page or mock the state
                                        window.location.href = "?bypass=true";
                                    }}
                                >
                                    Proceed as Guest (Mock Org)
                                </Button>
                                <p className="text-[10px] text-muted-foreground mt-3 italic">
                                    Note: Some organization-filtered data may be empty until a real Org is created via Clerk.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background font-sans">
            {/* Command Palette */}
            <CommandPalette />

            {/* Sidebar */}
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onTeamSelect={(teamId) => console.log("Selected team:", teamId)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10 border-l border-border">
                {children}
            </div>
        </div>
    );
}
