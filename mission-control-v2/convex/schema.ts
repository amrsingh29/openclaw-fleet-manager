import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    teams: defineTable({
        name: v.string(),
        slug: v.string(), // "hr", "devops"
        mission: v.optional(v.string()),
        allowedTools: v.optional(v.array(v.string())),
        orgId: v.optional(v.string()), // <--- Multi-tenancy
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
        orgId: v.optional(v.string()), // <--- Multi-tenancy
        containerId: v.optional(v.string()), // <--- Fly.io Machine ID
        lastHeartbeat: v.optional(v.number()),
    }),
    tasks: defineTable({
        title: v.string(),
        description: v.string(),
        status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done"), v.literal("blocked")),
        teamId: v.optional(v.id("teams")),
        assigneeIds: v.optional(v.array(v.id("agents"))),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        orgId: v.optional(v.string()), // <--- Multi-tenancy
        createdTime: v.number(),
        lastUpdated: v.number(),
        output: v.optional(v.string()),
    }),
    messages: defineTable({
        channelId: v.string(), // "general", "task-<ID>"
        taskId: v.optional(v.id("tasks")), // Optional link to a specific task
        fromAgentId: v.optional(v.id("agents")), // Null if system or human admin
        content: v.string(),
        orgId: v.optional(v.string()), // <--- Multi-tenancy
        timestamp: v.number(),
        attachments: v.optional(v.array(v.string())),
    }),
    activities: defineTable({
        type: v.string(), // "task_created", "message_sent", "status_change", etc.
        agentId: v.optional(v.id("agents")),
        message: v.string(),
        orgId: v.optional(v.string()), // <--- Multi-tenancy
        timestamp: v.number(),
        metadata: v.optional(v.any()),
    }),
    documents: defineTable({
        title: v.string(),
        content: v.string(),
        type: v.string(), // "deliverable", "research", "protocol"
        taskId: v.optional(v.id("tasks")),
        authorId: v.optional(v.id("agents")),
        orgId: v.optional(v.string()), // <--- Multi-tenancy
        createdTime: v.number(),
        lastAttributes: v.optional(v.any()),
    }),
    notifications: defineTable({
        mentionedAgentId: v.id("agents"),
        content: v.string(),
        delivered: v.boolean(),
        orgId: v.optional(v.string()), // <--- Multi-tenancy
        createdTime: v.number(),
        sourceActivityId: v.optional(v.id("activities")),
    }),
    secrets: defineTable({
        orgId: v.string(),
        keyName: v.string(), // "openai_api_key", "anthropic_api_key"
        encryptedValue: v.string(),
        iv: v.string(), // Initialization vector for AES-GCM
    }).index("by_org_and_name", ["orgId", "keyName"]),

    proposals: defineTable({
        taskId: v.id("tasks"),
        agentId: v.id("agents"),
        teamId: v.optional(v.id("teams")),
        action: v.string(), // e.g. "execute_command", "read_file"
        params: v.any(),
        rationale: v.string(), // Why the agent wants to do this
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("denied"), v.literal("auto_approved")),
        orgId: v.string(),
        timestamp: v.number(),
        cost: v.optional(v.number()),
        confidence: v.optional(v.number()),
    }).index("by_org_status", ["orgId", "status"]),

    policies: defineTable({
        orgId: v.string(),
        teamId: v.optional(v.id("teams")),
        actionType: v.string(), // e.g. "read_file", "exec_command", "*" for all
        policy: v.union(v.literal("auto"), v.literal("manual"), v.literal("propose_only")),
        maxCost: v.optional(v.number()),
        minConfidence: v.optional(v.number()),
    }).index("by_org_team_action", ["orgId", "teamId", "actionType"]),
});
