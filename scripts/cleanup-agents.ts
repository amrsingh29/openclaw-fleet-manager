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
    console.log("🧹 specific agent cleanup...");
    // @ts-ignore
    const count = await client.mutation(api.agents.clearAll);
    console.log(`✅ Deleted ${count} agents.`);
}

main().catch(console.error);
