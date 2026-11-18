"use client";

import { useOrganization, OrganizationList } from "@clerk/nextjs";

/**
 * The Clerk organization requirement, isolated in its own module.
 *
 * Only mounted when CLERK_ENABLED is true, so nothing here runs (and the Clerk SDK
 * is not exercised) in the default no-auth build.
 */
export function OrgGate({ children }: { children: React.ReactNode }) {
    const { organization, isLoaded } = useOrganization();

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/20" />
                    <p className="text-sm font-medium text-muted-foreground">Initializing Command Center...</p>
                </div>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <div className="max-w-md w-full space-y-8 text-center">
                    <div className="space-y-4">
                        <h1 className="text-4xl font-extrabold tracking-tight">Organization Required</h1>
                        <p className="text-muted-foreground">
                            OpenClaw is multi-tenant. Select or create an organization to manage your fleet.
                        </p>
                    </div>
                    <div className="flex flex-col items-center gap-6">
                        <OrganizationList hidePersonal />
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
