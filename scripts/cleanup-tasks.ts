import { api } from "../convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
    console.log("🧹 Cleaning up ALL tasks...");

    // @ts-ignore
    await client.mutation(api.tasks.clearAll);
    console.log("✅ All tasks deleted.");
}

main().catch(console.error);
