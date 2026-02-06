import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const setupEnterprise = mutation({
    args: {},
    handler: async (ctx) => {
        // 1. Create Teams if they don't exist
        let devOpsTeamId;
        const existingDevOps = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", "devops")).first();

        if (existingDevOps) {
            devOpsTeamId = existingDevOps._id;
        } else {
            devOpsTeamId = await ctx.db.insert("teams", {
                name: "Engineering (DevOps)",
                slug: "devops",
                mission: "Maintain infrastructure reliability and incident response.",
                allowedTools: ["check_server_health", "fetch_latest_logs", "restart_service", "scan_network"],
                createdTime: Date.now(),
            });
            console.log("✅ Created Team: Engineering");
        }

        // 2. Create HR Team (Example of Multi-Team)
        const existingHR = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", "hr")).first();
        if (!existingHR) {
            await ctx.db.insert("teams", {
                name: "Human Resources",
                slug: "hr",
                mission: "Ensure employee satisfaction and compliance.",
                allowedTools: [], // HR has no tools yet
                createdTime: Date.now(),
            });
            console.log("✅ Created Team: Human Resources");
        }

        // 3. Migrate Existing Agents
        const agents = await ctx.db.query("agents").collect();
        for (const agent of agents) {
            if (!agent.teamId) {
                // Assign everyone to DevOps for now
                await ctx.db.patch(agent._id, { teamId: devOpsTeamId });
                console.log(`Updated ${agent.name} -> Team Engineering`);
            }
        }

        return "Enterprise Setup Complete";
    },
});
