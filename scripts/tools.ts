// scripts/tools.ts
// This file defines the capabilities ("Hands") of the agents.
// For now, they are simulated/mocked, but in production, they would run actual shell commands.

export type Tool = {
    name: string;
    description: string;
    parameters: string[]; // Simple list of param names for now
    execute: (args: any) => Promise<string>;
};

// --- Mock Tools ---

const tools: Tool[] = [
    {
        name: "check_server_health",
        description: "Checks CPU/Memory/Disk status of a specific server.",
        parameters: ["serverId"],
        execute: async ({ serverId }) => {
            // Simulation
            const cpu = Math.floor(Math.random() * 100);
            const mem = Math.floor(Math.random() * 100);
            const status = cpu > 80 ? "CRITICAL" : "HEALTHY";
            return `[${serverId}] Status: ${status} | CPU: ${cpu}% | MEM: ${mem}% | Uptime: 14d`;
        }
    },
    {
        name: "fetch_latest_logs",
        description: "Retrieves the last 10 lines of logs from a service.",
        parameters: ["serviceName"],
        execute: async ({ serviceName }) => {
            // Simulation
            const logs = [
                `[INFO] ${serviceName} started successfully.`,
                `[INFO] Connection established to DB-1.`,
                `[WARN] Latency spike detected (102ms).`,
                `[ERROR] Connection timeout in worker-pool.`,
                `[INFO] Retrying connection... Success.`,
            ];
            return logs.join("\n");
        }
    },
    {
        name: "restart_service",
        description: "Restarts a service on the infrastructure.",
        parameters: ["serviceName"],
        execute: async ({ serviceName }) => {
            return `[SUCCESS] Service '${serviceName}' has been restarted. PID: ${Math.floor(
                Math.random() * 9999
            )}. Health check passed.`;
        }
    },
    {
        name: "scan_network",
        description: "Scans for open ports and vulnerable IPs.",
        parameters: ["targetIp"],
        execute: async ({ targetIp }) => {
            return `[SCAN] Target ${targetIp}:\n- Port 80 (Open)\n- Port 443 (Open)\n- Port 22 (SSH) - WARNING: Bruteforce attempts detected.`;
        }
    }
];

export const ToolRegistry = {
    list: () => tools,
    find: (name: string) => tools.find((t) => t.name === name),
    execute: async (name: string, args: any) => {
        const tool = tools.find((t) => t.name === name);
        if (!tool) return `Error: Tool '${name}' not found.`;
        try {
            console.log(`🛠️ Agent executing tool: ${name} with args:`, args);
            return await tool.execute(args);
        } catch (e: any) {
            return `Error executing tool: ${e.message}`;
        }
    }
};
