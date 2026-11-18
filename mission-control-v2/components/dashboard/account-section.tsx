"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Authenticated } from "convex/react";

/**
 * Clerk's user and organization widgets, isolated so that nothing imports the
 * Clerk SDK when auth is disabled. `<Authenticated>` in particular requires an
 * auth-aware Convex provider, which only exists in clerk mode.
 *
 * Rendered by sidebar.tsx only when CLERK_ENABLED is true.
 */
export function AccountSection({ isCollapsed }: { isCollapsed: boolean }) {
    return (
        <div className="mb-6 px-1 flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex items-center gap-2">
                <Authenticated>
                    <UserButton afterSignOutUrl="/" />
                    {!isCollapsed && (
                        <OrganizationSwitcher
                            appearance={{
                                elements: {
                                    organizationSwitcherTrigger:
                                        "w-full text-foreground hover:bg-muted py-1.5 px-2 rounded-md transition-colors",
                                    organizationPreviewMainIdentifier: "text-sm font-medium",
                                },
                            }}
                        />
                    )}
                </Authenticated>
            </div>
        </div>
    );
}
