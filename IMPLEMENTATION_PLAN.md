# Mission Control Implementation Plan

This plan is based on the guide "The Complete Guide to Building Mission Control: How We Built an AI Agent Squad". The goal is to build a system where multiple AI agents (OpenClaw instances) collaborate via a shared Convex database and are managed through a React dashboard.

## User Review Required
> [!IMPORTANT]
> **OpenClaw/Clawdbot Availability**: The guide mentions using "Clawdbot (now OpenClaw)". We need to verify if an npm package `clawdbot` or `openclaw` is available or if we need to clone a repo. For this plan, I assume we will use the `clawdbot` CLI as described in the guide or build a compatible agent runner if the specific package isn't strictly available in the public registry under that name (the guide says `npm install -g clawdbot`).

> [!NOTE]
> **API Keys**: Implementing this will require API keys for LLMs (Anthropic/OpenAI) and Convex.

## Architecture
- **Agents**: Multiple isolated processes/sessions running "OpenClaw" (managed via `openclaw` CLI).
- **Shared State**: Convex (Database for Tasks, Messages, Activities, Documents, Agents).
- **Frontend**: React + Vite (Mission Control Dashboard).
- **Communication**: Agents read/write to Convex; Daemon delivers notifications.

## Design Requirements (Modern AI Aesthetic)
- **Theme**: Dark mode default ("Cyberpunk"/"Future" aesthetic).
- **Styling**: TailwindCSS.
- **Visuals**: Glassmorphism (blur effects), Neon accents (Cyan/Purple), Smooth gradients.
- **Interactions**: `framer-motion` for smooth layout transitions and micro-interactions.
- **Typography**: Clean, tech-focused sans-serif (e.g., Inter, JetBrains Mono for data).

## Proposed Changes

### Phase 1: Project Initialization & Infrastructure
#### [NEW] [Project Structure]
- `/mission-control-dashboard`: React frontend.
- `/convex`: Convex backend functions and schema.
- `/agents`: Configuration and "SOUL" files for each agent.
- `/scripts`: Helper scripts for orchestration.

### Phase 2: Shared Brain (Convex)
#### [NEW] [convex/schema.ts]
Define tables: `agents`, `tasks`, `messages`, `activities`, `documents`, `notifications`.

#### [NEW] [convex/agents.ts], [convex/tasks.ts], etc.
API functions for agents to interact with the DB (e.g., `messages:create`, `tasks:update`).

### Phase 3: Agent Configuration (The Squad)
Create a directory structure for agents.
#### [NEW] [agents/configs]
- `SOUL.md` for each agent (Jarvis, Shuri, Fury, etc.).
- `AGENTS.md` (Operating manual).
- `HEARTBEAT.md` (Wakeup instructions).

### Phase 4: The Dashboard (React)
#### [NEW] [mission-control-dashboard]
- **Tech Stack**: React, Vite, TailwindCSS, Framer Motion.
- **Components**:
    - `Layout`: Glassmorphic sidebar and header.
    - `ActivityFeed`: Real-time stream with animated updates.
    - `TaskBoard`: Kanban headers with drag-and-drop (dnd-kit).
    - `AgentCard`: Status of agents with "breathing" status indicators.

### Phase 5: Orchestration
#### [NEW] [Orchestrator Script]
A script (or using `pm2` as suggested) to simpler manage the cron/heartbeats if actual system cron isn't desired for dev.

## Verification Plan

### Automated Tests
- Convex tests to verify schema and functions.

### Manual Verification
1.  **Initialize Convex**: Verify tables are created.
2.  **Dashboard**: Verify the UI loads and displays empty state.
3.  **Agent Logic**: Manually simulation an agent "heartbeat" by running a script that reads `WORKING.md` (simulated) and posts a message to Convex.
