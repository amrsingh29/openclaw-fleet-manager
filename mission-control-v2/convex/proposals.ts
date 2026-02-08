import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId } from "./utils";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Creates a new proposal for an action that requires human approval.
 * Now includes "Gatekeeper" logic to auto-approve based on policy.
 */
export const createProposal = mutation({
    args: {
        taskId: v.id("tasks"),
        agentId: v.id("agents"),
        action: v.string(),
        params: v.any(),
        rationale: v.string(),
        cost: v.optional(v.number()),
        confidence: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);

        // 1. Get agent's team
        const agent = await ctx.db.get(args.agentId);
        const teamId = agent?.teamId;

        // 2. Evaluate Policy (The Gatekeeper)
        const status = (await ctx.runQuery(internal.policies.evaluateAction, {
            orgId,
            teamId,
            actionType: args.action,
            cost: args.cost,
            confidence: args.confidence,
        })) as "pending" | "approved" | "denied" | "auto_approved";

        // 3. Insert Proposal
        const proposalId = (await ctx.db.insert("proposals", {
            ...args,
            orgId,
            teamId,
            status,
            timestamp: Date.now(),
        })) as Id<"proposals">;

        // 4. If Auto-Approved, Convert to Mission immediately
        let missionId: Id<"tasks"> | undefined;
        if (status === "auto_approved") {
            missionId = await ctx.db.insert("tasks", {
                title: `${args.action.replace(/_/g, ' ').toUpperCase()}: Autonomous Protocol`,
                description: `[AUTO-EXECUTED VIA POLICY]\nRationale: ${args.rationale}\nParameters: ${JSON.stringify(args.params)}`,
                status: "assigned",
                teamId: teamId,
                assigneeIds: [args.agentId],
                orgId,
                createdTime: Date.now(),
                lastUpdated: Date.now(),
            });
        }

        // 5. Log activity
        const activityId = await ctx.db.insert("activities", {
            type: status === "auto_approved" ? "action_auto_executed" : "proposal_created",
            agentId: args.agentId,
            orgId,
            timestamp: Date.now(),
            message: status === "auto_approved"
                ? `Agent automatically executed ${args.action} (Policy Approved). Mission: ${missionId}`
                : `Agent proposed action: ${args.action} (Awaiting Commander)`,
            metadata: { proposalId, taskId: missionId || args.taskId },
        });

        // Trigger event stream processing (Internal)
        await ctx.scheduler.runAfter(0, internal.events.processEvent, {
            type: status === "auto_approved" ? "action_auto_executed" : "proposal_created",
            orgId,
            metadata: { proposalId, taskId: missionId || args.taskId, action: args.action }
        });

        return { proposalId, status, missionId };
    },
});

/**
 * Lists all pending proposals for the organization.
 */
export const listPending = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db
            .query("proposals")
            .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
            .collect();
    },
});

/**
 * Approves a proposal.
 */
export const approve = mutation({
    args: { proposalId: v.id("proposals") },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const proposal = await ctx.db.get(args.proposalId);

        if (!proposal || proposal.orgId !== orgId) {
            throw new Error("Proposal not found or access denied");
        }

        await ctx.db.patch(args.proposalId, { status: "approved" });

        // 5. Convert Proposal to Mission (Task)
        const missionId = await ctx.db.insert("tasks", {
            title: `${proposal.action.replace(/_/g, ' ').toUpperCase()}: Active Protocol`,
            description: `[AUTO-GENERATED FROM PROPOSAL]\nRationale: ${proposal.rationale}\nParameters: ${JSON.stringify(proposal.params)}`,
            status: "assigned",
            teamId: proposal.teamId,
            assigneeIds: [proposal.agentId],
            orgId,
            createdTime: Date.now(),
            lastUpdated: Date.now(),
        });

        await ctx.db.insert("activities", {
            type: "proposal_approved",
            agentId: proposal.agentId,
            orgId,
            timestamp: Date.now(),
            message: `Commander approved action: ${proposal.action}. Initiated Mission: ${missionId}`,
            metadata: { proposalId: args.proposalId, taskId: missionId },
        });

        // Trigger Event Stream for the new Mission
        await ctx.scheduler.runAfter(0, internal.events.processEvent, {
            type: "task_status_changed",
            orgId,
            metadata: { taskId: missionId, status: "assigned" }
        });

        return missionId;
    },
});

/**
 * Denies a proposal.
 */
export const deny = mutation({
    args: { proposalId: v.id("proposals"), reason: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const proposal = await ctx.db.get(args.proposalId);

        if (!proposal || proposal.orgId !== orgId) {
            throw new Error("Proposal not found or access denied");
        }

        await ctx.db.patch(args.proposalId, { status: "denied" });

        await ctx.db.insert("activities", {
            type: "proposal_denied",
            agentId: proposal.agentId,
            orgId,
            timestamp: Date.now(),
            message: `Commander denied action: ${proposal.action}${args.reason ? `. Reason: ${args.reason}` : ""}`,
            metadata: { proposalId: args.proposalId, taskId: proposal.taskId },
        });
    },
});
