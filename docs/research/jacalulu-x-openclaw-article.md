# Lulubot Takeaways: 1 week of building and using my OpenClaw

> **Source**: [Twitter/X Post](https://x.com/jacalulu/status/2019529992951198073)
> **Author**: jacalulu

We are crossing the threshold from "chatbots" to persistent, autonomous agents. Over the last week, I built and lived with my own OpenClaw, "Lulubot". It is a fully autonomous agent running on its own hardware with its own identity. The experience was messy, expensive, and technically demanding. It was also undeniably transformative.

## OpenClaw in a Clamshell

OpenClaw is an open-source framework that transforms an AI model into a proactive "digital team" capable of controlling your computer and accessing the internet.

### Key Attributes:
*   **Continuity and Memory**: Persists context across sessions.
*   **Orchestration**: Can spawn and manage multiple sub-agents.
*   **Action-Oriented**: Uses skills (code, APIs, browser automation).
*   **Proactive**: Decides when to communicate via "Heartbeats."
*   **Always Awake**: Runs on a configurable heartbeat (1-30 mins).
*   **Transparent**: You can inspect all files and know exactly what it knows.

---

## My Reference Architecture

### 1. Hardware
*   **Dedicated Mac Mini**: Credential-isolated from personal data. Troubleshooting is done directly on the agent's machine.

### 2. Identity
*   **Separate Entity**: Holds its own accounts (Gmail, GitHub, X, Solana wallet). It is not an extension of the user; it is a collaborator.

### 3. Interface
*   **Telegram**: Primary chat interface for mobile/background interaction.

### 4. Capabilities
*   **Morning Routine**: Autonomously codes a "surprise app" every morning for review.
*   **API Library**: Integrated with Google Drive and Docs.

### 5. The "Model Router" (Tiered Logic)
To balance cost vs. quality:
*   **Main Chat**: Claude 3.5 Opus (Reasoning/Strategy)
*   **Heartbeats**: Gemini 2.0 Flash (Cheap periodic checks)
*   **Subagents**: Gemini 2.0 Flash (Background tasks)
*   **Coding**: Codex / GPT-5-Codex (Building apps/debugging)
*   **Embeddings**: Gemini text-embedding-004 (Memory search)

---

## Key Observations

### 1. The "Setup Tax" is HIGH
Setting up a truly useful agent requires a dedicated machine, hours of terminal debugging, and constant technical babysitting. There is a massive gap between "available technology" and "accessible product."

### 2. Trust is Earned
Security vulnerabilities are everywhere. I supervise it closely and verify social posts before they go live. Trust is the primary barrier to mass adoption.

### 3. Identity is a Missing Primitive
The internet enforces a binary (Human vs. Script). Agents are a new category: **High-Value Proxies**. We need a "Mandate" system (e.g., "you can draft, but not send") rather than all-or-nothing credentials.

### 4. The Interface is "Always-On"
Unlike chat sessions (ChatGPT/Gemini App), Lulubot is **non-blocking**. You can fire off a task and keep thinking. It picks up where you left off across various apps.

### 5. Orchestration Economics
Running a 24/7 autonomous team is expensive (up to $400/mo). A "Master Orchestrator" model (High reasoning brain + task-specific workhorses) is the only viable path.

---

# Internal Analysis: OpenClaw Fleet Manager vs. Lulubot (jacalulu)

This article highlights the "Infrastructure & Trust" side of Agentic workflows, contrasting with the "State & Loop" focus of the previous VoxYZ article.

## 1. Feature Comparison

| Feature | OpenClaw Fleet Manager (Current) | Lulubot (jacalulu) |
| :--- | :--- | :--- |
| **Brain Architecture** | **Monolithic**: Single GPT-4o model for all tasks. | **Heterogeneous**: Tiered routing (Opus + Gemini Flash). |
| **Identity Model** | **Soul-based**: Config files within our workspace. | **Account-based**: Separate Google/X/GitHub accounts. |
| **User Interface** | **Custom Dashboard**: Centralized tactical view. | **Ambient**: Telegram/Gmail (Everywhere you already are). |
| **Hardware** | **Local/Cloud**: Runs where the dev is. | **Dedicated Hardware**: Mac Mini sandbox. |

## 2. Collaboration Models

*   **The Master Orchestrator Model**: jacalulu uses a high-reasoning model (Opus) as the "Manager" and cheap, fast models (Flash) as the "Laborers." This is significantly more cost-effective for 24/7 operations.
*   **Non-Blocking Workflow**: His approach emphasizes "Fire and Forget." The user sends a thought/screenshot and the agent handles the coordination across multiple apps in the background.
*   **Collaborative Canvas**: He mentions agents working *with* him in Google Docs—attaching comments and editing live.

## 3. Implementation Lessons for Our Project

1.  **Implement Model Routing**: We should allow different models for different tasks (e.g., Gemini Flash for the "Intel Polling" to save tokens, GPT-4o for "Tactical Reasoning").
2.  **Separate Agent Identities**: Consider the "Agent as a separate entity" model. Instead of our agents using our API keys to act as us, they could have their own scoped credentials.
3.  **Cross-App Presence**: Beyond our dashboard, we could implement a basic Telegram/Discord adapter to allow "Always-On" interaction while away from the terminal.
4.  **The "Surprise App" Concept**: A great demo feature. We could add a "Daily Briefing" or "Morning Protocol" tile to the dashboard where an agent presents its autonomous work from the night before.