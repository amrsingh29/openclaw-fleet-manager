# System Architecture

Mission Control uses a **Hybrid Architecture**: A centralized Cloud Brain (Convex) coupled with Local Execution Units (Agents).

## 📊 High-Level Diagram
```mermaid
graph TD
    User[User / Commander] <--> Frontend[React Dashboard (Vite)]
    Frontend <--> Cloud[Convex Cloud (Database + API)]
    
    subgraph "Local Machine / Docker"
        Agent1[Jarvis (Node Process)] <--> Cloud
        Agent2[Shuri (Node Process)] <--> Cloud
        Agent3[Fury (Node Process)] <--> Cloud
    end
```

## 1. The Backend: Convex
We do not use a traditional SQL server. We use **Convex**, a reactive backend-as-a-service.
- **Real-time**: The Frontend subscribes to data. When data changes, the UI updates *instantly*.
- **API**: Defined in `convex/schema.ts` and `convex/*.ts`.
- **Tables**:
    - `messages`: Chat logs.
    - `tasks`: Mission tickets.
    - `agents`: Heartbeats and status.

## 2. The Frontend: Mission Control
Built with **React**, **Vite**, and **TailwindCSS**.
- **Visuals**: orbital/sci-fi theme using `framer-motion` for animations.
- **Routing**: Simple state-based routing (`App.tsx` switches between Dashboard & WarRoom).
- **Communication**: Uses `useQuery` hooks to stay in sync with Convex.

## 3. The Agents: Node.js Runners
Agents are **Node.js scripts** (`scripts/agent-runner.ts`).
- **Why Node?**: Agents need access to the OS (File system, Terminal) to execute real work.
- **Brain**: They use `openclaw_brain.ts` to connect to OpenAI via API.
- **Loop**:
    1.  **Heartbeat**: "I am alive" (every 30s).
    2.  **Poll Chat**: "Any new messages?" (every 5s).
    3.  **Poll Tasks**: "Any work in inbox?" (every 5s).
