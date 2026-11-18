// npm run task -- "Title" "Description" [--priority=high] [--team=devops]
//
// Creates a mission in the inbox. Three lines instead of remembering the JSON
// shape of tasks:create, and it quotes arguments properly.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));

const title = positional[0]?.trim();
const description = positional[1]?.trim() || title;

if (!title) {
    console.error('Usage: npm run task -- "Title" "Description" [--priority=high]');
    process.exit(1);
}

const priorityArg = args.find((a) => a.startsWith("--priority="))?.split("=")[1];
const priority = ["low", "medium", "high"].includes(priorityArg ?? "") ? (priorityArg as "low" | "medium" | "high") : "medium";

const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
if (!convexUrl) {
    console.error("CONVEX_URL not set. Run `npm run setup`.");
    process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function main() {
    const id = await client.mutation(api.tasks.create, {
        title,
        description,
        status: "inbox",
        priority,
        ...(process.env.DEFAULT_TEAM_ID ? { teamId: process.env.DEFAULT_TEAM_ID as any } : {}),
    });
    console.log(`Created mission ${id}`);
    console.log(`  "${title}" (${priority}) is in the inbox; an idle agent will claim it within ~5s.`);
}

main().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
});
