import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId } from "./utils";
import { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";

/**
 * This represents the "Event Stream" logic.
 * Effectively a central hub for processing system-level events and 
 * triggering agent reactions.
 */
export const processEvent = internalMutation({
    args: {
        type: v.string(),
        orgId: v.string(),
        metadata: v.any(),
    },
    handler: async (ctx, args) => {
        if (args.type === "task_status_changed") {
            const taskId = args.metadata.taskId;
            const newStatus = args.metadata.status;

            if (newStatus === "blocked") {
                const task = await ctx.db.get(taskId as Id<"tasks">);
                if (task && task.assigneeIds && task.assigneeIds.length > 0) {
                    // Propose an investigation when blocked
                    const { proposalId, status } = await ctx.runMutation(api.proposals.createProposal, {
                        taskId,
                        agentId: task.assigneeIds[0],
                        action: "analyze_blocker",
                        params: { taskId },
                        rationale: "Task is blocked. I need to analyze why the flow has stopped.",
                        cost: 0.02,
                        confidence: 0.9
                    });

                    // Roadmap Section 3: Narrative Reporting
                    const agent = await ctx.db.get(task.assigneeIds[0]);
                    const channelId = task.teamId ? `team-${task.teamId}` : "general";

                    if (status === "auto_approved") {
                        await ctx.db.insert("messages", {
                            channelId,
                            orgId: task.orgId,
                            fromAgentId: task.assigneeIds[0],
                            content: `⚠️ Detected block in "${task.title}". Initiated auto-diagnostic mission. Stand by.`,
                            timestamp: Date.now()
                        });
                    } else {
                        await ctx.db.insert("messages", {
                            channelId,
                            orgId: task.orgId,
                            fromAgentId: task.assigneeIds[0],
                            content: `🚧 Task "${task.title}" is blocked. I've created a Proposal to analyze the root cause. Please click Approve in the Action Queue.`,
                            timestamp: Date.now()
                        });
                    }
                }
            }
        }
    }
});
