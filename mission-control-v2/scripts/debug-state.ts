
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config();

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);

async function main() {
    const tasks = await client.query(api.tasks.list);
    const agents = await client.query(api.agents.list);

    const task = tasks.find((t: any) => t._id.endsWith("m4yy") || t._id === "m4yy");
    const shuri = agents.find((a: any) => a.name === "Shuri" || a.name === "Suri");

    console.log("=== TASK DEBUG ===");
    console.log(task ? JSON.stringify(task, null, 2) : "Task not found");

    console.log("\n=== AGENT DEBUG ===");
    console.log(shuri ? JSON.stringify(shuri, null, 2) : "Agent not found");
    const teams = await client.query(api.teams.list);

    const taskTeam = teams.find(t => t._id === task.teamId);
    const shuriTeam = teams.find(t => t._id === shuri.teamId);

    console.log(`\n=== TEAM CHECK ===`);
    console.log(`Task Team: ${taskTeam?.slug} (${task.teamId})`);
    console.log(`Shuri Team: ${shuriTeam?.slug} (${shuri.teamId})`);
    console.log(`MATCH? ${task.teamId === shuri.teamId}`);
}

main().catch(console.error);
