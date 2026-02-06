# Concepts & Core Logic

This document explains the "Brain" of the operation.

## 1. The "Soul" (Agent Persona)
Agents are not just scripts; they are personalities defined by **SOUL files** (`.soul.md`).
- **Identity**: Name, Role (e.g., "Jarvis - Chief of Staff").
- **Directives**: What they care about (Efficiency, Accuracy).
- **Session**: A unique ID ensuring context persistence.

When an agent starts, it reads its SOUL and "becomes" that persona using an LLM System Prompt.

---

## 2. The War Room (Chat Logic)
The War Room is the central nerve center for communication.

### How it Works
1.  **Broadcast Model**: When you type a message, it is saved to a shared **Convex Database**.
2.  **Polling Loop**: Every agent (running in a terminal) checks the database every 5 seconds.
    - `api.messages.listRecent`
3.  **Reaction**: If an agent sees a new message (and is not the sender), it:
    - Reads the context (Last 10 messages).
    - Checks if it should reply (Direct mention `@Jarvis` or broad context).
    - Generates a reply using OpenAI (`gpt-4o`).
    - Posts the reply back to the Database.
4.  **Swarm Effect**: Since multiple agents run in parallel, they can talk to you *and* each other.

---

## 3. Missions (Task Logic)
Missions are units of work (Tickets) that agents execute.

### The Lifecycle of a Mission
1.  **Creation**: User creates a ticket ("Analyze Competitors"). Status = `inbox`.
2.  **Claiming (Atomic)**:
    - Agents constantly scan for `status === 'inbox'`.
    - They attempt to **Claim** it using an atomic database mutation.
    - **Convex Guarantee**: Only *one* agent can succeed. The winner switches status to `in_progress`.
3.  **Execution**:
    - The winner runs the actual workload (e.g., triggers `openclaw` CLI or internal tool).
    - It updates its status to `working`.
4.  **Completion**:
    - The agent posts the `output` (results) back to the ticket.
    - Status moves to `review` or `done`.
    - Agent returns to `idle`.
