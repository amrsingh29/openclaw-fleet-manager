import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";

export const list = query({
    args: { channelId: v.string() },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db
            .query("messages")
            .filter((q) => q.and(
                q.eq(q.field("channelId"), args.channelId),
                q.eq(q.field("orgId"), orgId)
            ))
            .order("desc")
            .take(50);
    },
});

export const listRecent = query({
    args: { channelId: v.string(), after: v.number() },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const messages = await ctx.db
            .query("messages")
            .filter((q) => q.and(
                q.eq(q.field("channelId"), args.channelId),
                orgId ? q.eq(q.field("orgId"), orgId) : true
            ))
            .order("desc")
            .take(20);

        return messages.filter(m => m.timestamp > args.after).reverse();
    },
});

export const send = mutation({
    args: {
        channelId: v.string(),
        content: v.string(),
        agentId: v.optional(v.id("agents")),
        taskId: v.optional(v.id("tasks")),
        depth: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);

        // Validation: If agent is message sender, it must exist
        if (args.agentId) {
            const agent = await ctx.db.get(args.agentId);
            if (!agent || (orgId && agent.orgId !== orgId)) throw new Error("Unauthorized agent");
            // Use agent's orgId if no user orgId
            const finalOrgId = orgId || agent.orgId;

            await ctx.db.insert("messages", {
                channelId: args.channelId,
                content: args.content,
                fromAgentId: args.agentId,
                taskId: args.taskId,
                timestamp: Date.now(),
                orgId: finalOrgId,
                depth: args.depth || 0
            });
        } else {
            // Sent by human manager
            const userOrgId = await getOrgId(ctx);
            await ctx.db.insert("messages", {
                channelId: args.channelId,
                content: args.content,
                timestamp: Date.now(),
                orgId: userOrgId,
                depth: 0 // Reset depth on human message
            });
        }
    },
});

export const createTaskShort = mutation({
    args: {
        title: v.string(),
        description: v.string(),
        status: v.string(),
        assignedTo: v.optional(v.id("agents")),
        missionId: v.optional(v.string()),
        priority: v.optional(v.number()),
        teamId: v.optional(v.id("teams")),
        orgId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const taskId = await ctx.db.insert("tasks", {
            title: args.title,
            description: args.description,
            status: args.status,
            assignedTo: args.assignedTo,
            missionId: args.missionId,
            priority: args.priority || 5,
            teamId: args.teamId,
            orgId: args.orgId,
            createdTime: Date.now(),
            lastUpdated: Date.now(),
        });

        // Log activity
        await ctx.db.insert("activities", {
            type: "task_created",
            agentId: args.assignedTo,
            message: `New task created: ${args.title}`,
            orgId: args.orgId,
            timestamp: Date.now(),
        });

        return taskId;
    },
});

export const updateTaskStatus = mutation({
    args: {
        taskId: v.id("tasks"),
        status: v.string(),
        result: v.optional(v.string()),
        heartbeat: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const task = await ctx.db.get(args.taskId);
        if (!task) throw new Error("Task not found");

        await ctx.db.patch(args.taskId, {
            status: args.status,
            result: args.result,
            heartbeat: args.heartbeat,
            lastUpdated: Date.now(),
        });

        // Log activity
        await ctx.db.insert("activities", {
            type: "status_change",
            agentId: task.assignedTo,
            message: `Task ${task.title} status changed to ${args.status}`,
            orgId: task.orgId,
            timestamp: Date.now(),
        });
    },
});
