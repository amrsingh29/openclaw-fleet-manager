"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

/**
 * The Clerk wrapper, isolated in its own module so nothing imports the Clerk SDK
 * unless auth is actually enabled. See lib/convex.tsx for the switch.
 */
export function ClerkGate({
    client,
    children,
}: {
    client: ConvexReactClient;
    children: ReactNode;
}) {
    return (
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
            <ConvexProviderWithClerk client={client} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
}
