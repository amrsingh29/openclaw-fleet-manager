import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config();

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌ Missing CONVEX_URL");
    process.exit(1);
}
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
    console.log("🔍 Diagnosing Tasks...");
    const tasks = await client.query(api.tasks.list);

    if (tasks.length === 0) {
        console.log("No tasks found.");
    } else {
        tasks.forEach((t: any) => {
            console.log(`[${t.status.toUpperCase()}] ${t.title} (ID: ${t._id})`);
            console.log(`   Assignees: ${t.assigneeIds?.join(", ")}`);
            if (t.output) console.log(`   Output: ${t.output.slice(0, 50)}...`);
        });
    }
}

main().catch(console.error);
