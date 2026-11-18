import { mutation } from "./_generated/server";
import { getOrgId } from "./utils";

/**
 * Seeds the default squad.
 *
 * Two first-run bugs are fixed here rather than worked around:
 *
 * 1. orgId is written explicitly. The old version omitted it, and because every
 *    query filters on orgId, a freshly seeded database rendered as an empty
 *    fleet with no explanation.
 * 2. Session keys now match the soul files in agents/configs/. The old keys
 *    (agent:main:main) did not, so a runner would register a second agent with
 *    the same name instead of picking up the seeded row.
 */
export const populate = mutation({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);

        const agents = [
            { name: "Jarvis", role: "Incident Commander", sessionKey: "agent:jarvis:main" },
            { name: "Shuri", role: "Site Reliability Engineer", sessionKey: "agent:shuri:main" },
            { name: "Fury", role: "Researcher", sessionKey: "agent:fury:main" },
            { name: "Vision", role: "Observability Specialist", sessionKey: "agent:vision:main" },
            { name: "Friday", role: "Developer", sessionKey: "agent:friday:main" },
        ];

        const created: string[] = [];

        for (const a of agents) {
            const existing = await ctx.db
                .query("agents")
                .filter((q) => q.eq(q.field("sessionKey"), a.sessionKey))
                .first();

            if (existing) {
                // Repair rows written by the old seed so an existing dev database
                // fixes itself on the next run instead of needing a wipe.
                if (existing.orgId !== orgId) {
                    await ctx.db.patch(existing._id, { orgId });
                }
                continue;
            }

            await ctx.db.insert("agents", {
                name: a.name,
                role: a.role,
                sessionKey: a.sessionKey,
                status: "idle",
                orgId,
                lastHeartbeat: Date.now(),
            });
            created.push(a.name);
        }

        return created.length
            ? `Agents populated: ${created.join(", ")}`
            : "Agents already present, orgId verified";
    },
});
