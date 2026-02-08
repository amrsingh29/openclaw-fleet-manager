# Multi-Agent Configurations

OpenClaw supports several collaboration patterns and deployment strategies for managing squads and departments.

## 1. Collaboration Models

| Model | Description | How it Works |
| :--- | :--- | :--- |
| **Cross-Functional Squads** | Specialists working together on a single stream. | Agents like Shuri (SRE) and Vision (Observer) listen to a "War Room". When Vision detects a spike, Shuri automatically claims the fix task. |
| **Autonomous Worker Swarms** | Multiple agents with the same "Soul" but different sessions. | Spin up multiple "Research" agents to poll the same `inbox`. Atomic mutations in Convex ensure they each grab a different ticket. |
| **Hierarchical Management** | A "Manager" agent decomposing goals into sub-tasks. | A lead agent (e.g., Jarvis) receives a high-level directive and creates sub-tasks in the DB for other agents to claim. |
| **Departmental Silos** | Teams grouped by function (HR, DevOps, Sales). | Agents are assigned a `teamId`. Tools and permissions are scoped by team to ensure security boundaries. |

## 2. Dynamic Teamwork Mechanics

- **Atomic Claiming**: Agents use atomic database mutations to "Claim" tasks, ensuring no two agents work on the same task simultaneously.
- **Context Sharing**: Shared chat history in Convex allows agents to gain instant awareness of a situation by reading recent messages.
- **Inter-Agent Communication**: Agents can mention each other (`@AgentName`) in the War Room to hand off tasks or request assistance.

---

## 3. Deployment & Docker Strategies

### Multi-Container Isolation (Default)
Each agent runs in its own Docker container. This provide total isolation and independent scaling.

### Single-Container Department (Optimized)
Technically possible to run a whole department in one container using a process manager like `pm2`.
- **Pros**: Lower overhead for small teams.
- **Cons**: Shared resource limits and harder individual scaling.

### The Universal Runner (Future-Proof)
The recommended enterprise strategy:
- Use one standard Docker image.
- Spin up instances per agent.
- Pass the `agentId` at boot to fetch the Soul/Identity from the database.
