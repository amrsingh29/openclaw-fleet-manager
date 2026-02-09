import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

/**
 * ORCHESTRATION SKILLS
 * These tools are used by the Fleet Orchestrator (Jarvis) to manage tasks,
 * discover agent backgrounds, and verify work results.
 */

export class OrchestrationSkills {
    private client: any;
    private orgId?: string;

    constructor(client: any, orgId?: string) {
        this.client = client;
        this.orgId = orgId;
    }

    /**
     * Discovers all agents in the organization and their capabilities.
     * Used by the Orchestrator to decide who should handle a specific sub-task.
     */
    async get_fleet_capabilities() {
        console.log("🔍 Scanning fleet capabilities...");
        const agents = await this.client.query(api.agents.list, { orgId: this.orgId });

        return agents.map((a: any) => ({
            id: a._id,
            name: a.name,
            role: a.role,
            bio: (a as any).bio || "No bio provided.",
            soul: a.soul || "Default personality.",
            status: a.status
        }));
    }

    /**
     * Creates a structured task in the database for a specific agent.
     * This moves coordination from Chat to State.
     */
    async create_task(args: {
        title: string,
        description: string,
        assigneeId: string,
        missionId: string,
        priority?: number,
        teamId?: string
    }) {
        console.log(`📝 Creating task: ${args.title} for agent: ${args.assigneeId}`);
        const taskId = await this.client.mutation(api.messages.createTaskShort, {
            title: args.title,
            description: args.description,
            status: "inbox",
            assignedTo: args.assigneeId as Id<"agents">,
            missionId: args.missionId,
            priority: args.priority || 5,
            teamId: args.teamId as any,
            orgId: this.orgId
        } as any);

        return { taskId, status: "created" };
    }

    /**
     * Evaluates the output of a completed task to ensure it's not "garbage".
     * In a real implementation LLM reasoning would sit here.
     */
    async evaluate_result(taskId: string) {
        console.log(`🧐 Evaluating result for task: ${taskId}`);
        // This would traditionally be an LLM call asking "Does this output solve the task?"
        // For now, we return a success signal.
        return { taskId, verified: true, score: 0.95 };
    }

    /**
     * TACTICAL SKILL (Marcus): Verifies infrastructure health.
     * Mock implementation for the 'Angry Customer' scenario.
     */
    async verify_infrastructure(args: { scope: string }) {
        console.log(`🛡️ Marcus verifying infrastructure: ${args.scope}`);
        const results = [
            "DB_OVERLOAD: Primary RDS instance CPU usage @ 98% due to unoptimized query from AcmeCorp dashboard.",
            "API_TIMEOUT: 504 Gateway Timeout detected on /v2/analytics endpoint.",
            "SYSTEM_HEALTH_CHECK: All other services reporting 200 OK. Infrastructure scaling fix in progress."
        ];
        return results.join("\n");
    }

    /**
     * TACTICAL SKILL (Sarah): Analyzes sentiment of a message.
     * Mock implementation for the 'Angry Customer' scenario.
     */
    async analyze_sentiment(args: { text: string }) {
        console.log(`❤️ Sarah analyzing sentiment...`);
        const isAngry = args.text.toLowerCase().includes("outage") || args.text.toLowerCase().includes("help");
        return {
            sentiment: isAngry ? "CRITICAL_ANGER" : "NEUTRAL",
            recommendation: "Use 'DEEP_APOLOGY' protocol and emphasize future prevention."
        };
    }
}
