import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { encrypt, decrypt } from "./encryption";
import { getOrgId } from "./utils";

/**
 * Action: Encrypts and stores a secret for an organization.
 */
export const setSecret = action({
    args: {
        keyName: v.string(), // e.g. "openai_api_key"
        value: v.string(),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const { encryptedValue, iv } = await encrypt(args.value);

        await ctx.runMutation(api.secrets.upsertSecret, {
            orgId,
            keyName: args.keyName,
            encryptedValue,
            iv,
        });
    },
});

/**
 * Action: Decrypts and returns a secret.
 * @internal
 */
export const getSecret = action({
    args: {
        orgId: v.string(),
        keyName: v.string(),
    },
    handler: async (ctx, args): Promise<string | null> => {
        const secret = await ctx.runQuery(api.secrets.getInternal, {
            orgId: args.orgId,
            keyName: args.keyName,
        });

        if (!secret) return null;

        return await decrypt(secret.encryptedValue, secret.iv);
    },
});

/**
 * Mutation: Internal helper to store encrypted data.
 * @internal
 */
export const upsertSecret = mutation({
    args: {
        orgId: v.string(),
        keyName: v.string(),
        encryptedValue: v.string(),
        iv: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("secrets")
            .withIndex("by_org_and_name", (q) => q.eq("orgId", args.orgId).eq("keyName", args.keyName))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                encryptedValue: args.encryptedValue,
                iv: args.iv,
            });
        } else {
            await ctx.db.insert("secrets", {
                orgId: args.orgId,
                keyName: args.keyName,
                encryptedValue: args.encryptedValue,
                iv: args.iv,
            });
        }
    },
});

/**
 * Query: Internal helper to get encrypted data.
 * @internal
 */
export const getInternal = query({
    args: { orgId: v.string(), keyName: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("secrets")
            .withIndex("by_org_and_name", (q) => q.eq("orgId", args.orgId).eq("keyName", args.keyName))
            .unique();
    },
});

export const listSecrets = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const secrets = await ctx.db
            .query("secrets")
            .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId))
            .collect();
        return secrets.map(s => s.keyName);
    },
});

/**
 * Mutation: Removes a secret.
 */
export const removeSecret = mutation({
    args: { keyName: v.string() },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const existing = await ctx.db
            .query("secrets")
            .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId).eq("keyName", args.keyName))
            .unique();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});
