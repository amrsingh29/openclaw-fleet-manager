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
- Update `tools.ts` to check `agent.teamId` before allowing execution.
- (e.g., HR cannot run `restart_server`).
