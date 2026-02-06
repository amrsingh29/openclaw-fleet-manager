# Implementation Guide

This document maps the concepts to the actual code files.

## 📂 Directory Structure

```text
/convex                # The Cloud Brain
  ├── schema.ts        # Database definitions (Tables)
  ├── messages.ts      # Chat API (list, send)
  ├── tasks.ts         # Mission API (claim, complete)
  └── agents.ts        # Agent API (heartbeat, register)

/mission-control-dashboard  # The UI
  ├── src/App.tsx           # Main Router & Layout
  ├── src/components/
  │   ├── WarRoom.tsx       # The Chat Interface (Multi-Agent View)
  │   ├── TaskBoard.tsx     # The Kanban Board (Mission Control)
  │   └── NewMissionModal.tsx # Task Creation UI

/scripts               # The Agent Bodies
  ├── agent-runner.ts       # The MAIN LOOP (Heartbeat, Polling)
  └── openclaw_brain.ts     # The LLM Interface (OpenAI Wrapper)

/agents/configs        # The Agent Souls
  ├── jarvis.soul.md        # Configuration for Jarvis
  └── shuri.soul.md         # Configuration for Shuri
```

## 🛠 Critical Implementation Details

### 1. The Agent Loop (`agent-runner.ts`)
This is the most important file for agent behavior.
- **`processChat()`**: Polls `api.messages.listRecent`. If a message is found:
    - It creates an `AgentBrain`.
    - It calls `brain.ask()`.
    - It sends the reply back.
- **`processTasks()`**: Polls for `status === 'inbox'`.
    - Uses `api.tasks.claim` to try to lock a task.
    - If successful, it runs the task code.

### 2. The UI (`WarRoom.tsx`)
- Displays the chat feed.
- **Identity Logic**: It maps `msg.fromAgentId` -> `agents` table to display the correct name ("Jarvis") instead of a raw ID.
- **Real-time**: Uses `useQuery` so you see agent replies immediately without refreshing.

### 3. The Brain (`openclaw_brain.ts`)
- A simple wrapper class around the `openai` SDK.
- **Lazy Loading**: Initializes the API Key only when needed to prevent startup crashes.
- **System Prompt**: Injects the `SOUL.md` content (Bio, Personality) into every request.
