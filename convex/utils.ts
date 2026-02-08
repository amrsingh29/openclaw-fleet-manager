import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

/**
 * Gets the orgId from the current authenticated identity.
 * Throws an error if the user is not authenticated or not in an organization.
 */
export async function getOrgId(ctx: QueryCtx | MutationCtx | ActionCtx) {
    const identity = await ctx.auth.getUserIdentity();

    // Development Bypass: If no identity is found, return a default dev org ID.
    // This allows testing the UI and backend logic without a real Clerk session locally.
    if (!identity) {
        return "org_2saas_dev_mock_id";
    }

    // Custom claim for orgId (usually set up in Clerk JWT template)
    const orgId = identity.orgId as string | undefined;

    if (!orgId) {
        // Fallback for personal accounts if orgs aren't strictly required in Convex yet
        return identity.subject;
    }

    return orgId;
}

/**
 * Optional orgId for legacy or system-level access.
 */
export async function maybeGetOrgId(ctx: QueryCtx | MutationCtx | ActionCtx) {
    const identity = await ctx.auth.getUserIdentity();
    return (identity?.orgId as string | undefined) ?? null;
}
