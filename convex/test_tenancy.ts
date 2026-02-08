import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { encrypt, decrypt } from "./encryption";

/**
 * TEST ONLY: This mutation allows seeding data with a specific orgId 
 * to verify isolation without needing a full Clerk frontend login.
 */
export const seedDevData = mutation({
    args: {
        orgId: v.string(),
        agentName: v.string(),
    },
    handler: async (ctx, args) => {
        const agentId = await ctx.db.insert("agents", {
            name: args.agentName,
            orgId: args.orgId,
            role: "Tester",
            status: "idle",
            sessionKey: "test-session",
            lastHeartbeat: Date.now(),
        });

        await ctx.db.insert("tasks", {
            title: `Task for ${args.orgId}`,
            description: "Secret data",
            status: "inbox",
            orgId: args.orgId,
            createdTime: Date.now(),
            lastUpdated: Date.now(),
        });

        return agentId;
    },
});

/**
 * TEST ONLY: Verifies that a manual filter works as expected.
 */
export const listByOrgManual = query({
    args: { orgId: v.string() },
    handler: async (ctx, args) => {
        const agents = await ctx.db.query("agents")
            .filter(q => q.eq(q.field("orgId"), args.orgId))
            .collect();

        const tasks = await ctx.db.query("tasks")
            .filter(q => q.eq(q.field("orgId"), args.orgId))
            .collect();

        return { agents, tasks };
    },
});

/**
 * TEST ONLY: Verifies encryption utility.
 */
export const testEncryption = action({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        const { encryptedValue, iv } = await encrypt(args.secret);
        const decrypted = await decrypt(encryptedValue, iv);

        return {
            original: args.secret,
            encrypted: encryptedValue,
            decrypted: decrypted,
            match: args.secret === decrypted
        };
    }
});
