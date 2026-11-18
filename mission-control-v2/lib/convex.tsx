"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { CLERK_ENABLED } from "./auth-config";
import { ClerkGate } from "./clerk-gate";

/**
 * Convex provider, with or without Clerk.
 *
 * With auth off we mount the plain ConvexProvider: no Clerk script loads, no modal
 * appears, and the backend's keyless dev bypass in convex/utils.ts supplies the org
 * id. That is the default path for a fresh clone.
 */
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    if (!CLERK_ENABLED) {
        return <ConvexProvider client={convex}>{children}</ConvexProvider>;
    }
    return <ClerkGate client={convex}>{children}</ClerkGate>;
}
