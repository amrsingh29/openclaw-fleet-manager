import { mutation } from "./_generated/server";

export const deduplicateAgents = mutation({
    args: {},
    handler: async (ctx) => {
        const agents = await ctx.db.query("agents").collect();
        const seen = new Set();
        let deletedCount = 0;

        // Sort by heartbeat descending to keep the most active one
        agents.sort((a, b) => (b.lastHeartbeat || 0) - (a.lastHeartbeat || 0));

        for (const agent of agents) {
            if (seen.has(agent.name)) {
                await ctx.db.delete(agent._id);
                deletedCount++;
            } else {
                seen.add(agent.name);
            }
        }
        return `Deleted ${deletedCount} duplicate agents.`;
    }
});
