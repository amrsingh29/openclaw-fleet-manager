# Phase 3 Strategy: "Real Power" (The Dangerous Path)

This document outlines the architecture for giving agents actual system access.

## 1. The Core Principle: "Sandbox via Docker"
To run this safely, we **MUST NOT** run `agent-runner.ts` directly on the macOS host.
Instead, we run the agent inside a Docker container.

- **Host (Mac)**: Runs Convex, Dashboard, and the Docker Daemon.
- **Container (Agent)**: A confined Linux environment.
    - If Shuri executes `rm -rf /`, she destroys the *container*, not your Mac.
    - If Shuri needs to edit files on your Mac, we **Volume Mount** only specific safe folders (e.g., `./playground`).

## 2. Implementation Steps

### Step A: True Tool Implementation
We migrate `scripts/tools.ts` from Simulation to Execution.

**Before (Mock):**
```typescript
execute: async ({ serverId }) => "CPU is 80% (Simulated)"
```

**After (Real):**
```typescript
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

execute: async ({ command }) => {
   // DANGER: This runs actual shell commands
   const { stdout } = await execAsync(command);
   return stdout;
}
```

### Step B: The "Human-in-the-Loop" Safety Switch
We don't want an agent automatically running `nuke_database.sh` without asking.
We introduce a **Permission Layer** in `agent-runner.ts`.

1.  Brain requests: `{"tool": "exec_command", "args": {"cmd": "rm -rf /"}}`
2.  Runner intercepts: "Hold on, this is a dangerous tool."
3.  Runner sends Chat Message: "⚠️ **APPROVAL NEEDED**: I want to run `rm -rf /`. Type 'APPROVE' to proceed."
4.  User types: "DENY".
5.  Runner returns: "User denied execution."

### Step C: New "Action" Tools
We add these tools to the Registry:
1.  **`shell_execute`**: Run bash commands.
2.  **`file_read`**: Read content of a file.
3.  **`file_write`**: Write code to a file.
4.  **`git_commit`**: Commit changes.

## 3. The Deployment Architecture
We modify `docker-compose.yml` to support this.

```yaml
services:
  shuri:
    build: .
    command: ["npx", "tsx", "scripts/agent-runner.ts", "--config=agents/configs/shuri.soul.md"]
    volumes:
      - ./playground:/data  # <--- Shuri can ONLY touch this folder
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

## 4. Workflows Enabled
*   **Web Scraping**: "Vision, `curl` this website and summarize it."
*   **Refactoring**: "Shuri, read `main.py` in the playground and add comments."
*   **Testing**: "Jarvis, run `npm test` and tell me which tests failed."
