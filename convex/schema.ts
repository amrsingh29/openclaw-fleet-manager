import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    teams: defineTable({
        name: v.string(),
        slug: v.string(), // "hr", "devops"
        mission: v.optional(v.string()),
        allowedTools: v.optional(v.array(v.string())),
        createdTime: v.number(),
    }).index("by_slug", ["slug"]),

    agents: defineTable({
        name: v.string(),
        role: v.string(),
        teamId: v.optional(v.id("teams")), // Link to department
        soul: v.optional(v.string()), // The prompt/personality
        status: v.union(v.literal("idle"), v.literal("active"), v.literal("working"), v.literal("blocked"), v.literal("offline")),
        currentTaskId: v.optional(v.id("tasks")),
        sessionKey: v.string(),
        lastHeartbeat: v.optional(v.number()),
    }),
    tasks: defineTable({
        title: v.string(),
        description: v.string(),
        status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done"), v.literal("blocked")),
        teamId: v.optional(v.id("teams")),
        assigneeIds: v.optional(v.array(v.id("agents"))),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        createdTime: v.number(),
        lastUpdated: v.number(),
        output: v.optional(v.string()),
    }),
    messages: defineTable({
        channelId: v.string(), // "general", "task-<ID>"
        taskId: v.optional(v.id("tasks")), // Optional link to a specific task
        fromAgentId: v.optional(v.id("agents")), // Null if system or human admin
        content: v.string(),
        timestamp: v.number(),
        attachments: v.optional(v.array(v.string())),
    }),
    activities: defineTable({
        type: v.string(), // "task_created", "message_sent", "status_change", etc.
        agentId: v.optional(v.id("agents")),
        message: v.string(),
        timestamp: v.number(),
        metadata: v.optional(v.any()),
    }),
    documents: defineTable({
        title: v.string(),
        content: v.string(),
        type: v.string(), // "deliverable", "research", "protocol"
        taskId: v.optional(v.id("tasks")),
        authorId: v.optional(v.id("agents")),
        createdTime: v.number(),
        lastAttributes: v.optional(v.any()),
    }),
    notifications: defineTable({
        mentionedAgentId: v.id("agents"),
        content: v.string(),
        delivered: v.boolean(),
        createdTime: v.number(),
        sourceActivityId: v.optional(v.id("activities")),
    }),
});
