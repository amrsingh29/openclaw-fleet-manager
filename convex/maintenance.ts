import { mutation } from "./_generated/server";
import { getOrgId } from "./utils";

/**
 * Repairs a database created by earlier versions of the seed.
 *
 * Two migrations, both of which otherwise leave a forker staring at a dashboard
 * that looks wrong:
 *
 * 1. orgId backfill. The old seed wrote rows with no orgId; every query filters
 *    on orgId, so the fleet rendered empty.
 * 2. Duplicate agents. The old seed used session keys that did not match the soul
 *    files, so pointing a runner at a soul registered a second agent with the
 *    same name. This keeps the row a live runner is using and drops the orphan.
 *
 * Idempotent, and safe to run at any time.
 */
export const repair = mutation({
    args: {},
    handler: async (ctx) => {
        const orgId = await getOrgId(ctx);
        const report = { orgFixed: 0, duplicatesRemoved: 0, kept: [] as string[] };

        // 1. orgId backfill across the tables the UI reads.
        for (const table of ["teams", "agents", "tasks", "messages", "activities"] as const) {
            const rows = await ctx.db.query(table).collect();
            for (const row of rows as any[]) {
                if (row.orgId !== orgId) {
                    await ctx.db.patch(row._id, { orgId });
                    report.orgFixed++;
                }
            }
        }

        // 2. Collapse duplicate agents by name, keeping the most recently seen.
        const agents = await ctx.db.query("agents").collect();
        const byName = new Map<string, typeof agents>();

        for (const a of agents) {
            const key = a.name.toLowerCase();
            const list = byName.get(key) ?? [];
            list.push(a);
            byName.set(key, list);
        }

        for (const [name, group] of byName) {
            if (group.length < 2) {
                report.kept.push(group[0].name);
                continue;
            }

            // Keep the row with the newest heartbeat: that is the one a live runner
            // registered against and the one holding any task assignments.
            group.sort((a, b) => (b.lastHeartbeat ?? 0) - (a.lastHeartbeat ?? 0));
            const [keep, ...drop] = group;

            for (const dup of drop) {
                // Re-point anything referencing the duplicate before removing it,
                // so a task does not end up assigned to a deleted agent.
                const tasks = await ctx.db.query("tasks").collect();
                for (const t of tasks) {
                    if (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(dup._id)) {
                        const reassigned = t.assigneeIds.map((id) => (id === dup._id ? keep._id : id));
                        await ctx.db.patch(t._id, { assigneeIds: Array.from(new Set(reassigned)) });
                    }
                }

                const msgs = await ctx.db.query("messages").collect();
                for (const m of msgs) {
                    if (m.fromAgentId === dup._id) {
                        await ctx.db.patch(m._id, { fromAgentId: keep._id });
                    }
                }

                await ctx.db.delete(dup._id);
                report.duplicatesRemoved++;
            }
            report.kept.push(keep.name);
        }

        return {
            ...report,
            message:
                `orgId repaired on ${report.orgFixed} row(s); ` +
                `${report.duplicatesRemoved} duplicate agent(s) removed; ` +
                `agents: ${report.kept.join(", ")}`,
        };
    },
});
