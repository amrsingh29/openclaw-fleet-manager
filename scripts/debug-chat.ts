import { api } from "../convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
    console.log("🔍 Checking recent messages in #general...");

    // @ts-ignore
    const messages = await client.query(api.messages.list, { channelId: 'general' });

    console.log(`Found ${messages.length} messages.`);
    messages.slice(0, 5).forEach((m: any) => {
        console.log(`[${new Date(m.timestamp).toISOString()}] ${m.fromAgentId ? '🤖 Agent' : '👤 User'}: ${m.content}`);
    });
}

main().catch(console.error);
