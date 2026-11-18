import type { NextConfig } from "next";

/**
 * Auth mode is resolved here, at build time, and published as an env var.
 *
 * Next inlines NEXT_PUBLIC_* at build, so a runtime `process.env` read inside a
 * client component is really "whatever was set when the bundle was built". Doing
 * the decision in one place and letting the client read the answer keeps the UI
 * and the middleware from disagreeing about whether Clerk is on.
 */
const authModeRaw = (process.env.AUTH_MODE ?? process.env.NEXT_PUBLIC_AUTH_MODE ?? "none")
    .trim()
    .toLowerCase();

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const clerkEnabled = authModeRaw === "clerk" && Boolean(clerkKey);

if (authModeRaw === "clerk" && !clerkKey) {
    // Loud but non-fatal: the app still runs, just without auth.
    console.warn(
        "[auth] AUTH_MODE=clerk but NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is unset. " +
            "Auth is disabled for this build.",
    );
}

const nextConfig: NextConfig = {
    env: {
        // Read by lib/auth-config.ts and by middleware.ts.
        NEXT_PUBLIC_AUTH_ENABLED: clerkEnabled ? "1" : "0",
        NEXT_PUBLIC_AUTH_MODE_RESOLVED: clerkEnabled ? "clerk" : "none",
    },
};

export default nextConfig;
