import { mutation } from "./_generated/server";

export const populate = mutation({
    args: {},
    handler: async (ctx) => {
        const agents = [
            { name: 'Jarvis', role: 'Squad Lead', sessionKey: 'agent:main:main' },
            { name: 'Shuri', role: 'Product Analyst', sessionKey: 'agent:product-analyst:main' },
            { name: 'Fury', role: 'Researcher', sessionKey: 'agent:customer-researcher:main' },
            { name: 'Vision', role: 'SEO Analyst', sessionKey: 'agent:seo-analyst:main' },
            { name: 'Friday', role: 'Developer', sessionKey: 'agent:developer:main' },
        ];

        for (const a of agents) {
            const existing = await ctx.db.query("agents").filter(q => q.eq(q.field("sessionKey"), a.sessionKey)).first();
            if (!existing) {
                await ctx.db.insert("agents", {
                    name: a.name,
                    role: a.role,
                    sessionKey: a.sessionKey,
                    status: "idle",
                    lastHeartbeat: Date.now()
                });
            }
        }
        return "Agents populated!";
    }
});
