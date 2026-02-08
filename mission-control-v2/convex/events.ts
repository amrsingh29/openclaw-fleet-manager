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
                    await ctx.runMutation(api.proposals.createProposal, {
                        taskId,
                        agentId: task.assigneeIds[0],
                        action: "analyze_blocker",
                        params: { taskId },
                        rationale: "Task is blocked. I need to analyze why the flow has stopped.",
                        cost: 0.02,
                        confidence: 0.9
                    });
                }
            }
        }
    }
});
