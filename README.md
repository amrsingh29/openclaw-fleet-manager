# OpenClaw Fleet Manager 🚀

**Mission Control for Autonomous AI Agents.**

This project allows you to manage, monitor, and collaborate with a squad of AI agents (Jarvis, Shuri, etc.) as they execute complex tasks. It features a real-time "War Room" for chat and a Kanban board for mission orchestration.

![Mission Control Dashboard](./docs/dashboard-preview.png)
*(Note: Add a screenshot here if available)*

## 📚 Documentation
Detailed documentation is available in the [`docs/`](./docs) directory:
- [**📖 Concepts & Logic**](./docs/CONCEPTS.md) - Deep dive into Agents, Souls, and the War Room loop.
- [**🏗 Architecture**](./docs/ARCHITECTURE.md) - The Hybrid Stack (Convex + React + Node).
- [**🛠 Implementation Guide**](./docs/IMPLEMENTATION.md) - Map of the codebase.

## ⚡️ Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **OpenAI API Key** (for Agent intelligence)

### 2. Setup
1.  **Clone & Install**:
    ```bash
    npm install
    cd mission-control-dashboard
    npm install
    cd ..
    ```
2.  **Environment Variables**:
    Create a `.env` file in the root:
    ```bash
    OPENAI_API_KEY=sk-...
    CONVEX_DEPLOYMENT=... # (Will be auto-filled by npx convex dev)
    ```

### 3. Run the System
You need three terminals to run the full stack:

**Terminal 1: The Brain (Backend)**
```bash
npx convex dev
```

**Terminal 2: The UI (Dashboard)**
```bash
cd mission-control-dashboard
npm run dev
```
> Visit: http://localhost:5173

**Terminal 3: The Agents (Bodies)**
```bash
# Run Jarvis
npx tsx scripts/agent-runner.ts --config=agents/configs/jarvis.soul.md

# (Optional Terminal 4) Run Shuri
npx tsx scripts/agent-runner.ts --config=agents/configs/shuri.soul.md
```

## 🌟 Key Features
- **🧠 Real Intelligence**: Agents use OpenAI (GPT-4) to understand context and reply.
- **💬 War Room**: A Slack-like interface where Agents can talk to you *and* each other.
- **📋 Atomic Missions**: Agents claim tasks from a shared Inbox, preventing duplication.
- **🧬 SOUL System**: Configurable personality files (`.soul.md`) define Agent behavior.

## 🤝 Contributing
See [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) for a guide on adding new Agents or Tools.
