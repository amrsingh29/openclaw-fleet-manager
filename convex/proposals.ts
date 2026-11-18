import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOrgId, maybeGetOrgId } from "./utils";
import { internal } from "./_generated/api";

/**
 * A proposal is the record of an action the policy would not let an agent take
 * on its own. It carries the validated tool arguments, so approving it can replay
 * exactly what was asked for rather than trusting the model to ask again.
 *
 * Lifecycle: pending -> approved | denied, then approved -> executed | failed.
 */
export const createProposal = mutation({
    args: {
        // Optional: chat-initiated proposals have no mission behind them.
        taskId: v.optional(v.id("tasks")),
        agentId: v.id("agents"),
        action: v.string(),
        params: v.any(),
        rationale: v.string(),
        cost: v.optional(v.number()),
        confidence: v.optional(v.number()),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{ proposalId: any; status: "pending" | "auto_approved" }> => {
        const orgId = await getOrgId(ctx);
        const agent = await ctx.db.get(args.agentId);
        const teamId = agent?.teamId;

        // Dedupe: an agent that retries a refused action in the same mission
        // should not fill the queue with identical proposals.
        const existing = await ctx.db
            .query("proposals")
            .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
            .collect();
        const duplicate = existing.find(
            (p) =>
                p.agentId === args.agentId &&
                p.action === args.action &&
                JSON.stringify(p.params) === JSON.stringify(args.params) &&
                (p.taskId ?? null) === (args.taskId ?? null),
        );
        if (duplicate) {
            return { proposalId: duplicate._id, status: "pending" };
        }

        const status = (await ctx.runQuery(internal.policies.evaluateAction, {
            orgId,
            teamId,
            actionType: args.action,
            cost: args.cost,
            confidence: args.confidence,
        })) as "pending" | "auto_approved";

        const proposalId = await ctx.db.insert("proposals", {
            ...args,
            orgId,
            status,
            timestamp: Date.now(),
        });

        await ctx.db.insert("activities", {
            type: status === "auto_approved" ? "action_auto_executed" : "proposal_created",
            agentId: args.agentId,
            orgId,
            timestamp: Date.now(),
            taskId: args.taskId,
            message:
                status === "auto_approved"
                    ? `Agent may execute ${args.action} (policy auto)`
                    : `Agent needs approval for ${args.action}`,
            metadata: { proposalId, action: args.action, decision: status },
        });

        return { proposalId, status };
    },
});

/** Everything awaiting a human, for the dashboard panel. */
export const listPending = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const proposals = await ctx.db
            .query("proposals")
            .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
            .collect();

        // Join agent names so the UI does not have to.
        return await Promise.all(
            proposals.map(async (p) => {
                const agent = await ctx.db.get(p.agentId);
                return {
                    ...p,
                    agentName: agent?.name ?? "Unknown agent",
                    agentRole: agent?.role ?? "",
                };
            }),
        );
    },
});

/** Recent decided proposals, so the panel can show history rather than forgetting. */
export const listRecent = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const all = await ctx.db
            .query("proposals")
            .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
            .collect();

        const decided = all
            .filter((p) => p.status !== "pending")
            .sort((a, b) => (b.decidedAt ?? b.timestamp) - (a.decidedAt ?? a.timestamp))
            .slice(0, 20);

        return await Promise.all(
            decided.map(async (p) => {
                const agent = await ctx.db.get(p.agentId);
                return { ...p, agentName: agent?.name ?? "Unknown agent" };
            }),
        );
    },
});

/**
 * The runner's queue: proposals a human approved that have not run yet.
 * Scoped to one agent so a runner only ever executes its own approvals.
 */
export const listApprovedForAgent = query({
    args: { agentId: v.id("agents") },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        return await ctx.db
            .query("proposals")
            .withIndex("by_org_agent_status", (q) =>
                q.eq("orgId", orgId).eq("agentId", args.agentId).eq("status", "approved"),
            )
            .collect();
    },
});

export const approve = mutation({
    args: { proposalId: v.id("proposals"), decidedBy: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const proposal = await ctx.db.get(args.proposalId);

        if (!proposal || proposal.orgId !== orgId) {
            throw new Error("Proposal not found or access denied");
        }
        if (proposal.status !== "pending") {
            // Approving twice would re-run a restart, so refuse rather than no-op.
            throw new Error(`Proposal is already ${proposal.status}.`);
        }

        await ctx.db.patch(args.proposalId, {
            status: "approved",
            decidedAt: Date.now(),
            decidedBy: args.decidedBy ?? "commander",
        });

        await ctx.db.insert("activities", {
            type: "proposal_approved",
            agentId: proposal.agentId,
            orgId,
            timestamp: Date.now(),
            taskId: proposal.taskId,
            message: `Commander approved ${proposal.action}`,
            metadata: {
                proposalId: args.proposalId,
                action: proposal.action,
                // How long the human took. The funnel metric nobody can fake.
                waitMs: Date.now() - proposal.timestamp,
            },
        });
    },
});

export const deny = mutation({
    args: { proposalId: v.id("proposals"), reason: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const orgId = await getOrgId(ctx);
        const proposal = await ctx.db.get(args.proposalId);

        if (!proposal || proposal.orgId !== orgId) {
            throw new Error("Proposal not found or access denied");
        }
        if (proposal.status !== "pending") {
            throw new Error(`Proposal is already ${proposal.status}.`);
        }

        await ctx.db.patch(args.proposalId, {
            status: "denied",
            decidedAt: Date.now(),
            result: args.reason,
        });

        await ctx.db.insert("activities", {
            type: "proposal_denied",
            agentId: proposal.agentId,
            orgId,
            timestamp: Date.now(),
            taskId: proposal.taskId,
            message: `Commander denied ${proposal.action}${args.reason ? `. Reason: ${args.reason}` : ""}`,
            metadata: {
                proposalId: args.proposalId,
                action: proposal.action,
                waitMs: Date.now() - proposal.timestamp,
                reason: args.reason,
            },
        });
    },
});

/**
 * Records the outcome of executing an approved proposal. Called by the runner.
 * Uses maybeGetOrgId because the runner is unauthenticated in local dev.
 */
export const markResult = mutation({
    args: {
        proposalId: v.id("proposals"),
        ok: v.boolean(),
        result: v.string(),
    },
    handler: async (ctx, args) => {
        const orgId = await maybeGetOrgId(ctx);
        const proposal = await ctx.db.get(args.proposalId);
        if (!proposal || (orgId && proposal.orgId !== orgId)) {
            throw new Error("Proposal not found or access denied");
        }

        const now = Date.now();
        await ctx.db.patch(args.proposalId, {
            // "executed" even on failure: the point is that it will not be retried
            // forever. A failed restart is something a human should look at, not
            // something the runner should keep trying.
            status: args.ok ? "executed" : "failed",
            result: args.result.slice(0, 2000),
            // Approval-to-execution lag: measures the loop, not the wait for a
            // human, so keep it separate from the decision latency above.
            executedAt: now,
        });

        await ctx.db.insert("activities", {
            type: args.ok ? "proposal_executed" : "proposal_failed",
            agentId: proposal.agentId,
            orgId: proposal.orgId,
            timestamp: now,
            taskId: proposal.taskId,
            message: args.ok
                ? `Executed approved action: ${proposal.action}`
                : `Approved action failed: ${proposal.action}`,
            metadata: {
                proposalId: args.proposalId,
                action: proposal.action,
                ok: args.ok,
                result: args.result.slice(0, 500),
                ...(proposal.decidedAt ? { execLagMs: now - proposal.decidedAt } : {}),
            },
        });
    },
});

/** Count for the dashboard badge, without fetching full rows. */
export const pendingCount = query({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const rows = await ctx.db
            .query("proposals")
            .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
            .collect();
        return rows.length;
    },
});
