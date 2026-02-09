import { ConvexHttpClient } from "convex/browser";
import { api } from "../mission-control-v2/convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config();

const deploymentUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";
if (!deploymentUrl) {
    console.error("❌ Missing CONVEX_URL env var");
    process.exit(1);
}

const client = new ConvexHttpClient(deploymentUrl);

async function backfill() {
    console.log("🛠️ Starting task status backfill...");
    const tasks = await client.query(api.tasks.list);

    let pendingCount = 0;
    let completedCount = 0;

    for (const task of tasks) {
        if (task.status === "pending") {
            await client.mutation(api.tasks.patchTask, {
                id: task._id,
                status: "inbox"
            });
            pendingCount++;
        } else if (task.status === "completed") {
            await client.mutation(api.tasks.patchTask, {
                id: task._id,
                status: "done"
            });
            completedCount++;
        }
    }

    console.log(`✅ Backfill complete!`);
    console.log(`📦 Patched ${pendingCount} 'pending' tasks to 'inbox'`);
    console.log(`📦 Patched ${completedCount} 'completed' tasks to 'done'`);
}

backfill().catch(console.error);
