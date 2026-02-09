# 🗺️ Project Roadmap

This document outlines the strategic direction for **OpenClaw Fleet Manager**.

## ✅ Phase 1: Foundation (Completed)
**Goal**: Build the core infrastructure for a multi-agent system.
- [x] **Mission Control Dashboard**: React UI with glassmorphic design.
- [x] **Cloud Brain**: Convex backend for atomic state management.
- [x] **Agent Runners**: Node.js processes executing autonomous loops.
- [x] **War Room**: Real-time chat interface with multi-agent support.
- [x] **Documentation**: Comprehensive Architecture and Concept guides.

## ✅ Phase 2: Agency & Identity (Completed)
**Goal**: Give agents distinct personalities and the ability to use tools.
- [x] **DevOps Squad Theme**: Established roles (Incident Commander, SRE, Watcher).
- [x] **SOUL System**: Configurable personality files (`.soul.md`).
- [x] **Tool Protocol**: JSON-based function calling between Brain and Runner.
- [x] **Mock Tools**: Implementation of `check_health`, `scan_network`, etc.

---

## 🚧 Phase 3: Real Power ("The Dangerous Path")
**Goal**: Replace simulated tools with actual system access.
- [ ] **Shell Execution**: Implement `exec_command` tool to run real terminal commands (safety sandbox required).
- [ ] **File System Access**: Implement `read_file` and `write_file` to allow coding agents.
- [ ] **Docker Control**: Allow agents to restart actual containers.

## 🧠 Phase 4: Cognitive Expansion
**Goal**: Move from "Session Memory" to "Long-Term Memory".
- [ ] **Vector Database**: Store all chat history and mission outputs in Convex Vector Search.
- [ ] **Knowledge Retrieval**: Agents query the DB for past solutions ("How did we fix this last time?").
- [ ] **Learning**: Automatic documentation of successful fixes.

## 📦 Phase 5: Production Readiness
**Goal**: Deploy Mission Control for real-world usage.
- [ ] **Voice Interface**: Integration with ElevenLabs for spoken agent replies.
- [ ] **One-Click Deploy**: Docker Compose bundle for the entire stack (Dashboard + Convex + Agents).
- [ ] **Mobile Support**: PWA optimization for monitoring on the go.
- [ ] **Auth**: Multi-user permissions (Admin vs Observer).

# 🏢 Project Vision: The AI Enterprise

**Goal**: Evolve "Mission Control" from a single-squad manager into a **Multi-Department AI Corporation**.

Ideally, you generally have:
- **DevOps Team**: Shuri, Jarvis (Tools: SSH, Docker)
- **HR Team**: Toby, Pam (Tools: Email, Calendar, LinkedIn)
- **Sales Team**: Dwight, Jim (Tools: CRM, Phone)

## 1. Architectural Shift: From "Files" to "Cloud"
Currently, Agent identities ("Souls") live in local `.md` files. This is hard to scale (you have to edit code to hire someone).

**The Solution: Database-Driven Identity**
We move `SOUL.md` content into the Convex Database.
- **The "Universal Runner"**: We create a single generic Docker container.
- **Startup**: When it boots, it asks the DB: *"Who am I?"*
- **Result**: You can click "Create Agent" in the UI, and a new container spins up and becomes that person.

## 2. Data Schema 2.0 (Proposed)
We need to group agents and restrict tools.

```typescript
// teams
{
  "_id": "team_hr",
  "name": "Human Resources",
  "mission": "Manage employee happiness",
  "allowedTools": ["send_email", "schedule_meeting"] // <--- Security Boundary
}

// agents (Updated)
{
  "name": "Toby",
  "teamId": "team_hr", // <--- The Link
  "soul": "You are Toby...", // <--- Stored in DB now
  "role": "HR Rep"
}
```

## 3. UI Expansion: The "CEO View"
The Dashboard needs to upgrade to an **Enterprise View**.

### A. Team Switcher
A sidebar or dropdown to switch contexts:
- 🔴 **Engineering** (View Tickets, Servers)
- 🔵 **HR** (View Candidates, Payroll)
- 🟢 **Sales** (View Leads, Deals)

### B. "Hiring" Interface (Admin Panel)
A new **Admin Page** where you can:
1.  **Create Department**: "Marketing".
2.  **Define Role**: "Social Media Manager".
3.  **Write Soul**: "You are witty and use emojis..."
4.  **Assign Tools**: Checkbox list [x] Twitter API [x] Canva.
5.  **Spawn**: Click "Hire", and the system orchestrates a new runner.

## 4. Implementation Roadmap (The Path Forward)

### Phase 3.1: Database Migration
- Add `teams` table.
- Move existing `soul` content into `agents` table.

### Phase 3.2: Universal Runner
- Rewrite `agent-runner.ts` to accept `--agentId=XYZ` instead of `--config=file.md`.
- It fetches the Soul string from Convex at startup.

### Phase 3.3: Admin UI
- Build the "Create Agent" form in React.
- Implement the "Team Switcher" navigation.

### Phase 3.4: Tool Scoping
- [ ] Update `tools.ts` to check `agent.teamId` before allowing execution.
- (e.g., HR cannot run `restart_server`).

## 🛡️ Phase 7: Advanced Communication & Safety
**Goal**: Optimize agent interactions to prevent infinite loops and reduce operational noise.
- [ ] **Loop Detection**: Implement a "Chat Depth" limit to automatically kill recursive agent conversations.
- [ ] **Sentient Silence**: Agents only "interrupt" if they have a >80% confidence match to the topic, even in Team channels.
- [ ] **Cooldown Protocol**: Force a 5-second "thinking pause" between agent-to-agent replies.
- [ ] **Adaptive Listening**: GUI toggle to switch an agent between `Mention-Only`, `Proactive`, and `Observer` modes.

---

## 🚀 Future Vision: The Hybrid-Autonomy Loop

The **Hybrid Model** works by treating **Autonomy as a Permission**, rather than a hardcoded behavior. This ensures the system remains a "Human-as-Commander" platform even as it gains fully autonomous capabilities.

### 1. The Core Primitives
- **The Proposal**: Every action (Human or Agent initiated) starts as a **Proposal**. 
- **The Policy Logic**: A central `policies` table defines the "Auto-Approve" status for each action type.
- **The Event Stream**: Agents watch for system events (e.g., `task_failed`) to proactively generate new Proposals.

### 2. Implementation: The Policy Switchboard

Agents act based on a tiered **Confidence & Policy Matrix**:

#### A. The Auto-Approve Matrix
We define which **Action Types** are safe to run and which require you.

| Action Type | Policy (HR Team) | Policy (DevOps Team) | Why? |
| :--- | :--- | :--- | :--- |
| `read_logs` | **Auto** | **Auto** | Low risk, informative. |
| `send_email` | **Manual** | **Manual** | High social/identity risk. |
| `restart_server` | **Propose Only** | **Auto** | Domain expertise boundary. |
| `web_research` | **Auto** | **Auto** | Harmless data gathering. |

#### B. The Threshold Logic (The Money Gate)
Instead of just "Yes/No," we use **Complexity/Cost Thresholds**:
- *"If the estimated cost of this mission is < $0.50, run autonomously. If > $0.50, pause for Commander approval."*

#### C. The Confidence Trigger
The agent itself can decide to be hybrid based on its own uncertainty:
- **High Confidence**: *"I am 98% sure I should fix this bug. Executing..."*
- **Low Confidence**: *"I found three ways to fix this. Commander, please select one."*

### 3. Integration with Existing Systems

The hybrid model enhances our core UI without stripping away the "Human" touch:

*   **War Room (The Narrative Layer)**: Remains the strategic hub. 
    - In **Manual Mode**, agents ask: *"I've created a Proposal for this fix. Please click Approve."*
    - In **Autonomous Mode**, agents report: *"Detected crash. Initiated auto-diagnostic mission. Stand by."*
*   **Mission Board (The Execution Layer)**: Once a Proposal is approved (by policy or human), it converts to a **Mission**.
    - The Kanban board includes a `pending_approval` column to visualize the "Fleet Brain" in action.

### 4. The Hybrid Cycle (Logic Flow)
1. **Initiation**: Agent identifies a need (via Heartbeat or Event).
2. **Evaluation**: System checks **Policy Table** for `auto_approve` status and cost thresholds.
3. **Execution/Pause**: 
    - If Approved → Start **Mission**.
    - If Manual → Create **Pending Proposal** and alert Commander in **War Room**.
4. **Conclusion**: Agent reports final **Tactical Result** back to the Dashboard.

