# OpenClaw Fleet Manager 🚀

> **Mission Control for Autonomous AI Squads.**

**OpenClaw Fleet Manager** is an agentic orchestration platform that allows you to manage a team of semi-autonomous AI agents. It features a real-time **War Room** for collaboration, a **Kanban Board** for mission management, and a **Tooling System** that gives agents "hands" to execute tasks.

![Dashboard Preview](docs/dashboard-preview.png)
*(Note: Add screenshot here if available)*

---

## 🚒 The DevOps Squad (v0.2.0)
This version comes pre-configured with a specialized Incident Response Team:

| Agent | Role | Capabilities |
| :--- | :--- | :--- |
| **Jarvis** | 👔 Incident Commander | Strategy, Coordination, Escalation. |
| **Shuri** | 🔧 Site Reliability Engineer (SRE) | `restart_service`, `check_health`, `debug_logs` |
| **Vision** | 👁️ Usage & Observability | `scan_network`, `tail_logs`, `predict_load` |

## ✨ Key Features
- **🧠 Real Intelligence**: Agents use OpenAI (GPT-4) to understand context and make decisions.
- **💬 Interactive War Room**: Mention agents (`@Shuri`) to assign tasks live in chat.
- **🛠️ Tool Execution**: Agents can decide to run tools (e.g., "Scanning network...") and report back results.
- **📋 Atomic Missions**: Task management system ensures agents don't duplicate work.
- **🏢 Multi-Agent Collaboration**: Agents can talk to *each other* to solve complex problems.

## 📚 Documentation
- [**📖 Concepts & Logic**](docs/CONCEPTS.md) - Deep dive into Agents, Souls, and the Brain.
- [**🏗 Architecture**](docs/ARCHITECTURE.md) - The Hybrid Stack (Convex + React + Node).
- [**🗺️ Roadmap**](docs/ROADMAP.md) - The path to the Multi-Team Enterprise.

---

## ⚡️ Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **OpenAI API Key** (for Agent intelligence)

### 2. Setup
```bash
# Clone & Install
git clone https://github.com/amrsingh29/openclaw-fleet-manager.git
cd openclaw-fleet-manager
npm install
cd mission-control-dashboard && npm install && cd ..

# Setup Environment
echo "OPENAI_API_KEY=sk-..." > .env
```

### 3. Run the System
You need to run the **Brain**, the **UI**, and the **Body** (Runner).

**Terminal 1: The Brain (Convex)**
```bash
npx convex dev
```

**Terminal 2: The UI (Dashboard)**
```bash
cd mission-control-dashboard
npm run dev
```

**Terminal 3: The Squad (Agents)**
```bash
# Run Jarvis (Manager)
npx tsx scripts/agent-runner.ts --config=agents/configs/jarvis.soul.md

# Run Shuri (SRE)
npx tsx scripts/agent-runner.ts --config=agents/configs/shuri.soul.md

# Run Vision (Observer)
npx tsx scripts/agent-runner.ts --config=agents/configs/vision.soul.md
```

### Option B: Run with Docker 🐳 (Recommended for Production)
If you prefer not to manage multiple terminals:

1.  Make sure you have **Docker Desktop** installed.
2.  Run the full stack:
    ```bash
    docker-compose up --build
    ```
    *(Note: This starts the Agents. You still need to run `npx convex dev` and `npm run dev` for the Dashboard locally, or update docker-compose to include them.)*
```

---

## 🔮 What's Next?
See [ROADMAP.md](docs/ROADMAP.md) for our plans to build the **Multi-Team Enterprise** version (HR, Sales, Admin UI).
