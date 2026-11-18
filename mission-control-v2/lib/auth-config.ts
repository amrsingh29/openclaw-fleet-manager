// Whether this build uses Clerk, decided in next.config.ts and read here.
//
// Default is OFF. That matters: a half-configured Clerk drops a blocking
// "Organizations feature required" modal over the dashboard, which reads as a
// broken app rather than a missing setting. A fresh clone should open and work.
//
// Enable it in mission-control-v2/.env.local:
//
//   AUTH_MODE=clerk
//   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
//
// A typo or an unset key falls back to no auth rather than locking anyone out.

export type AuthMode = "none" | "clerk";

/**
 * Build-time constant. `NEXT_PUBLIC_AUTH_ENABLED` is written by next.config.ts, so
 * this is inlined into the client bundle and cannot drift from the middleware.
 */
export const CLERK_ENABLED: boolean = process.env.NEXT_PUBLIC_AUTH_ENABLED === "1";

export const AUTH_MODE: AuthMode = CLERK_ENABLED ? "clerk" : "none";

export const AUTH_STATUS = {
    mode: AUTH_MODE,
    enabled: CLERK_ENABLED,
    reason: CLERK_ENABLED
        ? "Auth is enabled via Clerk."
        : "Auth is disabled (default). Set AUTH_MODE=clerk and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable.",
} as const;
