import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("tasks").order("desc").collect();
    },
});

export const create = mutation({
    args: {
        title: v.string(),
        description: v.string(),
        status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done"), v.literal("blocked")),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        teamId: v.optional(v.id("teams")) // Add this
    },
    handler: async (ctx, args) => {
        const taskId = await ctx.db.insert("tasks", {
            title: args.title,
            description: args.description,
            status: args.status,
            priority: args.priority,
            teamId: args.teamId, // Add this
            createdTime: Date.now(),
            lastUpdated: Date.now(),
        });
        // Log activity
        await ctx.db.insert("activities", {
            type: "task_created",
            message: `Task created: ${args.title}`,
            timestamp: Date.now(),
            metadata: { taskId }
        });
        return taskId;
    },
});

export const updateStatus = mutation({
    args: { id: v.id("tasks"), status: v.string() },
    handler: async (ctx, args) => {
        // @ts-ignore
        await ctx.db.patch(args.id, { status: args.status, lastUpdated: Date.now() });
    },
});



export const claim = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents") },
    handler: async (ctx, args) => {
        const task = await ctx.db.get(args.taskId);
        // Atomic check: Is it still in inbox?
        if (!task || task.status !== 'inbox') {
            return false; // Already taken
        }

        // Claim it
        await ctx.db.patch(args.taskId, {
            status: 'in_progress',
            assigneeIds: [args.agentId],
            lastUpdated: Date.now()
        });

        // Log assignment
        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            message: `Agent claimed task: ${task.title}`,
            timestamp: Date.now(),
            metadata: { taskId: args.taskId }
        });

        return true;
    }
});

export const assign = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents") },
    handler: async (ctx, args) => {
        const task = await ctx.db.get(args.taskId);
        if (!task) throw new Error("Task not found");

        await ctx.db.patch(args.taskId, {
            status: 'assigned',
            assigneeIds: [args.agentId],
            lastUpdated: Date.now()
        });

        // Log assignment
        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            message: `Manager assigned task: ${task.title}`,
            timestamp: Date.now(),
            metadata: { taskId: args.taskId }
        });

        return true;
    }
});

export const complete = mutation({
    args: { taskId: v.id("tasks"), agentId: v.id("agents"), output: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.taskId, {
            status: 'done',
            output: args.output,
            lastUpdated: Date.now()
        });

        // Log completion
        await ctx.db.insert("activities", {
            type: "task_completed",
            agentId: args.agentId,
            message: `Agent completed task`,
            timestamp: Date.now(),
            metadata: { taskId: args.taskId, output: args.output }
        });
    }
});
// ... existing code ...

export const clearAll = mutation({
    args: {},
    handler: async (ctx) => {
        const tasks = await ctx.db.query("tasks").collect();
        for (const task of tasks) {
            await ctx.db.delete(task._id);
        }
    }
});
