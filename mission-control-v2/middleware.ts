import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk runs only when auth is enabled at build time.
 *
 * The previous version always installed clerkMiddleware and skipped protection in
 * development, which is why local runs still loaded the Clerk SDK, still needed a
 * publishableKey, and still showed the organization modal. Auth is now a build-time
 * switch: with it off, this middleware does nothing at all.
 *
 * Enabled via next.config.ts (`NEXT_PUBLIC_AUTH_ENABLED=1`), which reads AUTH_MODE
 * and the publishable key.
 */
const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "1";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const clerk = clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
        await auth.protect();
    }
});

export default function middleware(request: NextRequest, event: any) {
    if (!AUTH_ENABLED) {
        return NextResponse.next();
    }
    return (clerk as any)(request, event);
}

export const config = {
    matcher: [
        // Skip Next.js internals and static files.
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
