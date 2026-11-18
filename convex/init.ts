import { mutation } from "./_generated/server";
import { getOrgId } from "./utils";

/**
 * Creates the default teams and the autonomy policy set.
 *
 * Everything is stamped with the caller's orgId instead of a hardcoded mock
 * string, so the same code works for the keyless dev bypass and for a real
 * Clerk org. The policy actionTypes also match the tool names the agents
 * actually call, which the previous list did not.
 */
export const setupEnterprise = mutation({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);

        // 1. Teams
        let devOpsTeamId;
        const existingDevOps = await ctx.db
            .query("teams")
            .withIndex("by_slug", (q) => q.eq("slug", "devops"))
            .first();

        if (existingDevOps) {
            devOpsTeamId = existingDevOps._id;
            if (existingDevOps.orgId !== orgId) {
                await ctx.db.patch(devOpsTeamId, { orgId });
            }
        } else {
            devOpsTeamId = await ctx.db.insert("teams", {
                name: "Engineering (DevOps)",
                slug: "devops",
                mission: "Maintain infrastructure reliability and incident response.",
                allowedTools: ["check_server_health", "fetch_latest_logs", "scan_network", "restart_service"],
                orgId,
                createdTime: Date.now(),
            });
        }

        const existingHR = await ctx.db
            .query("teams")
            .withIndex("by_slug", (q) => q.eq("slug", "hr"))
            .first();
        if (!existingHR) {
            await ctx.db.insert("teams", {
                name: "Human Resources",
                slug: "hr",
                mission: "Ensure employee satisfaction and compliance.",
                allowedTools: [],
                orgId,
                createdTime: Date.now(),
            });
        }

        // 2. Attach unassigned agents to DevOps
        const agents = await ctx.db.query("agents").collect();
        for (const agent of agents) {
            const patch: Record<string, unknown> = {};
            if (!agent.teamId) patch.teamId = devOpsTeamId;
            if (agent.orgId !== orgId) patch.orgId = orgId;
            if (Object.keys(patch).length) await ctx.db.patch(agent._id, patch);
        }

        // 3. Policies keyed by the actionTypes the tools declare.
        //    Reads auto, writes propose_only. The catch-all is manual so a new
        //    tool added later is gated until someone deliberately allows it.
        const defaultPolicies = [
            { actionType: "read_metrics", policy: "auto" as const },
            { actionType: "read_logs", policy: "auto" as const },
            { actionType: "scan_network", policy: "auto" as const },
            { actionType: "restart_service", policy: "propose_only" as const },
            { actionType: "*", policy: "manual" as const },
        ];

        const added: string[] = [];
        for (const p of defaultPolicies) {
            const existing = await ctx.db
                .query("policies")
                .withIndex("by_org_team_action", (q) =>
                    q.eq("orgId", orgId).eq("teamId", undefined).eq("actionType", p.actionType),
                )
                .unique();

            if (!existing) {
                await ctx.db.insert("policies", {
                    orgId,
                    actionType: p.actionType,
                    policy: p.policy,
                });
                added.push(`${p.actionType}->${p.policy}`);
            }
        }

        return `Enterprise setup complete (org ${orgId}); policies added: ${added.join(", ") || "none (already present)"}`;
    },
});
