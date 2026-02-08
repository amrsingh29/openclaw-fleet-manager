import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Reaper runs every 5 minutes
crons.interval(
    "reap-inactive-agents",
    { minutes: 5 },
    api.orchestrator.reapInactiveAgents
);

export default crons;
