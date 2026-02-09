OpenClaw's agentic loop and inter-agent communication are designed to be task-oriented and event-driven, which inherently reduces the risk of infinite chatting loops compared to earlier systems like AutoGPT. The system doesn't rely on hard-coded maximum steps or arbitrary cutoffs; instead, it uses intelligent, model-driven termination combined with architectural safeguards. Here's how this is handled in implementation, based on the core architecture (powered by the Pi agent framework) and related features:

### The Agentic Loop: Iterative but Goal-Bounded
OpenClaw operates on an "agentic loop" — a core cycle where the AI processes inputs, reasons, executes actions, and checks for completion. This is implemented in a minimal, while-loop structure in the underlying Pi agent code (e.g., in `pi-agent-core`):

- **Loop Mechanics**:
  - The loop starts with an incoming message or trigger (e.g., a user query, scheduled event, or inter-agent message).
  - The LLM (e.g., via OpenAI or Anthropic models) is prompted with the context, available tools/skills, and the task goal.
  - It generates a response, which may include tool calls (e.g., send a message, execute a shell command, or interact with another agent).
  - If tool calls are proposed, they are executed, results are fed back into the context, and the loop iterates.
  - If no tool calls are needed (i.e., the model determines the task is complete), the loop exits, and a final response is sent.

- **Task Completion Detection**:
  - Termination is model-driven: The LLM is explicitly prompted to reason step-by-step and only propose further actions if necessary to achieve the goal. For example, system prompts emphasize concise reasoning, goal alignment, and stopping when objectives are met (e.g., "If the task is complete, respond directly without tools").
  - This avoids "Loop of Death" issues in predecessors by making the model responsible for deciding "done" — no fixed iteration limits, but the loop "just loops until the agent says it’s done." If the model hallucinates or loops unnecessarily, stronger models (e.g., Claude Opus) or prompt refinements help.

- **Exposure for Debugging**: Unlike hidden prompt-based loops, OpenClaw exposes each step (LLM thought process, tool calls, results) in logs or the UI, allowing users to inspect and intervene if a loop emerges.

### Handling Inter-Agent Communication to Avoid Loops
Inter-agent chats (internal or external) are not real-time synchronous; they're asynchronous and message-based, which prevents tight feedback loops:

- **Internal (Same Gateway)**:
  - Agents communicate via explicit messaging tools (e.g., `sessions_send` tool), but this is disabled by default for security. When enabled via config allowlists in `openclaw.json`, messages are routed turn-by-turn.
  - Each message triggers a new loop instance in the receiving agent, processed independently. No automatic back-and-forth; the receiving agent must explicitly decide to reply based on its prompt and goal.
  - Shared resources (e.g., files like `MEMORY.md`) allow indirect coordination without chatting, reducing unnecessary exchanges.

- **External (e.g., via Moltbook or Messaging Apps)**:
  - Agents post/respond on platforms like Moltbook (agent-only social network) or shared channels (e.g., Discord groups). This is event-driven: An agent posts, another reads/polls, and responds only if relevant to its task.
  - No built-in infinite chaining; responses are goal-bound (e.g., "Complete the collaborative task and stop").

- **Loop Prevention in Communication**:
  - **Asynchronous Nature**: Chats are not live; delays from processing/network prevent rapid cycles.
  - **Economic/Reputation Controls** (especially in Moltbook): Small fees per action, reputation staking (bad actors lose bonds), and anomaly monitoring discourage spam or endless debates.
  - **Human-in-the-Loop**: For high-stakes tasks, configs can require user approval before sending messages or continuing.

### Additional Safeguards Against Endless Loops
OpenClaw includes runtime protections to handle edge cases where models might loop due to errors or complex tasks:

- **Context Management**:
  - **Compaction and Summarization**: Long histories are chunked, summarized, and reset periodically to prevent context overflow (e.g., via `compaction.ts`). This clears "stuck" states without losing key facts.
  - **Window Guards**: Blocks runs if context is too small/large; trims at natural boundaries (e.g., user messages) to avoid mid-loop breaks.
  - **Adaptive Pruning**: Tool results are shortened or cached; middle sections of large files are trimmed to keep loops efficient.

- **Resource Limits and Monitoring**:
  - Configurable budgets (e.g., compute time, API calls) in prompts or gateway halt runaway loops.
  - Logging and anomaly detection (e.g., in `openclaw-tools.ts`) flags repetitive patterns, like excessive inter-agent pings.
  - Model failover switches to a "safer" LLM if abuse/looping is detected.
  - Heartbeat mechanism (background polling) triggers loops only on events, not continuously.

- **Security and Config Best Practices**:
  - Prompt injection guards and input sanitization prevent malicious loops (e.g., via embedded commands).
  - Isolated sessions ensure one agent's loop doesn't cascade uncontrollably to others.
  - Users are advised to use strong models, review logs, and start with restricted allowlists to test multi-agent setups.

In practice, loops are rare because tasks are framed as finite goals (e.g., "Research X and report back" vs. "Chat forever"). If issues arise, users can intervene via commands like `/think` (limits reasoning depth) or session resets. This makes OpenClaw more reliable than early agents, though monitoring is key for complex multi-agent scenarios.


# OpenClaw Agent Loop Document
# Agent Loop

An **agentic loop** is the full “real” run of an agent:  
**intake → context assembly → model inference → tool execution → streaming replies → persistence**.

It’s the authoritative path that turns a message into actions and a final reply, while keeping session state consistent.

In **OpenClaw**, a loop is a single, serialized run per session that emits lifecycle and stream events as the model thinks, calls tools, and streams output. This document explains how that authentic loop is wired end-to-end.

## Entry Points

- **Gateway RPC**: `agent` and `agent.wait`
- **CLI**: `agent` command

## How It Works (High-Level)

1. **`agent` RPC**
   - Validates parameters
   - Resolves session (`sessionKey` / `sessionId`)
   - Persists session metadata
   - Immediately returns `{ runId, acceptedAt }`

2. **`agentCommand`**
   - Resolves model + thinking/verbose defaults
   - Loads skills snapshot
   - Calls `runEmbeddedPiAgent` (pi-agent-core runtime)
   - Emits lifecycle `end` / `error` if the embedded loop does not emit one

3. **`runEmbeddedPiAgent`**
   - Serializes runs via per-session + global queues
   - Resolves model + auth profile and builds the pi session
   - Subscribes to pi events and streams assistant/tool deltas
   - Enforces timeout → aborts run if exceeded
   - Returns payloads + usage metadata

4. **`subscribeEmbeddedPiSession`**
   - Bridges pi-agent-core events to OpenClaw agent stream:
     - tool events → stream: `"tool"`
     - assistant deltas → stream: `"assistant"`
     - lifecycle events → stream: `"lifecycle"` (`phase: "start" | "end" | "error"`)

5. **`agent.wait`**
   - Uses `waitForAgentJob`
   - Waits for lifecycle `end` / `error` for given `runId`
   - Returns `{ status: ok|error|timeout, startedAt, endedAt, error? }`

## Queueing + Concurrency

- Runs are **serialized per session key** (session lane) and optionally through a **global lane**
- Prevents tool/session races and keeps session history consistent
- Messaging channels can choose queue modes (`collect` / `steer` / `followup`) that feed this lane system  
  → See **Command Queue**

## Session + Workspace Preparation

- Workspace is resolved and created; sandboxed runs may redirect to a sandbox workspace root
- Skills are loaded (or reused from snapshot) and injected into env and prompt
- Bootstrap/context files are resolved and injected into the system prompt report
- A **session write lock** is acquired
- `SessionManager` is opened and prepared before streaming

## Prompt Assembly + System Prompt

- System prompt is built from:
  - OpenClaw’s base prompt
  - Skills prompt
  - Bootstrap context
  - Per-run overrides
- Model-specific limits and compaction reserve tokens are enforced
- See **System prompt** for what the model actually sees

## Hook Points (Where You Can Intercept)

OpenClaw has two hook systems:

### Internal Hooks (Gateway Hooks)

- `agent:bootstrap` — runs while building bootstrap files (before system prompt is finalized)  
  → Use to add/remove bootstrap context files
- Command hooks: `/new`, `/reset`, `/stop`, and other command events  
  → See **Hooks** doc

### Plugin Hooks (Agent + Gateway Lifecycle)

These run inside the agent loop or gateway pipeline:

- `before_agent_start` — inject context or override system prompt before run starts
- `agent_end` — inspect final message list and run metadata after completion
- `before_compaction` / `after_compaction` — observe or annotate compaction cycles
- `before_tool_call` / `after_tool_call` — intercept tool params/results
- `tool_result_persist` — synchronously transform tool results before writing to transcript
- `message_received` / `message_sending` / `message_sent` — inbound + outbound message hooks
- `session_start` / `session_end` — session lifecycle boundaries
- `gateway_start` / `gateway_stop` — gateway lifecycle events

→ See **Plugins** for hook API and registration details

## Streaming + Partial Replies

- Assistant deltas are streamed from pi-agent-core → emitted as `assistant` events
- Block streaming can emit partial replies on `text_end` or `message_end`
- Reasoning streaming can be emitted as separate stream or as block replies
- See **Streaming** for chunking and block reply behavior

## Tool Execution + Messaging Tools

- Tool `start` / `update` / `end` events emitted on `tool` stream
- Tool results are sanitized (size + image payloads) before logging/emitting
- Messaging tool sends are tracked to suppress duplicate assistant confirmations

## Reply Shaping + Suppression

Final payloads are assembled from:

- Assistant text (and optional reasoning)
- Inline tool summaries (when verbose + allowed)
- Assistant error text (when model errors)

Special handling:

- `NO_REPLY` is treated as silent token and filtered from outgoing payloads
- Messaging tool duplicates removed from final payload list
- If no renderable payloads remain **and** a tool errored → fallback tool error reply is emitted  
  (unless a messaging tool already sent a user-visible reply)

## Compaction + Retries

- Auto-compaction emits compaction stream events and can trigger retry
- On retry: in-memory buffers and tool summaries are reset to avoid duplicate output
- See **Compaction** for the compaction pipeline

## Event Streams (Today)

- `lifecycle` — emitted by `subscribeEmbeddedPiSession` (fallback by `agentCommand`)
- `assistant` — streamed deltas from pi-agent-core
- `tool` — streamed tool events from pi-agent-core

## Chat Channel Handling

- Assistant deltas buffered into chat delta messages
- Chat `final` emitted on lifecycle `end` / `error`

## Timeouts

- `agent.wait` default: **30s** (just the wait); `timeoutMs` param overrides
- Agent runtime: `agents.defaults.timeoutSeconds` default **600s**  
  → enforced in `runEmbeddedPiAgent` abort timer

## Where Things Can End Early

- Agent timeout (abort)
- `AbortSignal` (cancel)
- Gateway disconnect or RPC timeout
- `agent.wait` timeout (wait-only — does **not** stop agent)

Sure, I'll walk you through a concrete example of how OpenClaw's agent loop works in practice, based on the provided document and its architecture. This will illustrate how a task is processed end-to-end, how inter-agent communication (if involved) is handled without creating infinite loops, and how the system ensures completion by bounding the run to a single, serialized execution. I'll use a simple scenario: a user asks an agent to "Research the weather in Singapore and email a summary to my work colleague." Assume this involves two agents—one primary ("personal") and one secondary ("work")—communicating internally for collaboration.

### Step-by-Step Example Breakdown
Imagine you're running OpenClaw on your local server with two agents configured in the same Gateway: 
- **Personal Agent**: Handles general tasks, with access to web browsing skills.
- **Work Agent**: Specialized for email and professional comms, allowlisted to receive messages from the personal agent.

The user sends the query via a connected channel (e.g., Telegram). Here's how the loop unfolds:

1. **Entry Point and Intake**:
   - The message arrives via Gateway RPC (`agent` endpoint). OpenClaw validates params, resolves the session (e.g., based on `sessionKey` for the personal agent), and persists metadata.
   - It queues the run in the per-session lane (serialized to avoid overlaps). If global queueing is enabled, it waits if other runs are active.
   - RPC returns a quick ack `{ runId, acceptedAt }`, and the loop kicks off asynchronously in `agentCommand`.

   *Why no loop risk here?* Everything is event-triggered (by the incoming message), not continuous. No automatic polling for chats—only explicit triggers start a run.

2. **Session and Workspace Preparation**:
   - The system acquires a session write lock to prevent races.
   - It loads the workspace (e.g., local files like `MEMORY.md` for context), skills snapshot (e.g., web browsing and email tools), and bootstrap files (e.g., user preferences: "Prefer concise summaries").
   - Hooks fire: `before_agent_start` could inject custom context (e.g., current time from user info: February 09, 2026, 09:12 AM +08 in Singapore), but in this case, it's straightforward.

3. **Prompt Assembly and Model Inference**:
   - System prompt is built: Base OpenClaw prompt + skills descriptions (e.g., "Use 'browse_web' for research, 'send_email' for comms") + bootstrap context (e.g., "Goal: Research weather and email summary").
   - The LLM (e.g., Claude) is called via `runEmbeddedPiAgent`. It reasons step-by-step: "Task: Get Singapore weather. Action 1: Call 'browse_web' on a weather site. Then summarize and hand off to work agent for email."
   - Inference outputs: Tool calls (e.g., browse https://weather.com for Singapore data) and initial thinking streamed as `assistant` events.

   *Streaming in action*: Partial replies like "Starting research..." are emitted via `assistant` deltas, keeping the user updated without waiting for full completion.

4. **Tool Execution and Iteration**:
   - Tools run: `browse_web` fetches weather data (e.g., "Sunny, 30°C, rain later"). Results are sanitized (trimmed for size) and fed back into the context.
   - The loop iterates internally in pi-agent-core: LLM sees results and decides next: "Summary: Today in Singapore—sunny with highs of 30°C. Now, send to work agent via 'sessions_send' tool."
   - If inter-agent chat: The personal agent uses a messaging tool to forward the summary to the work agent (allowlisted in config). This sends a message, triggering a *new, separate loop* in the work agent's session.
     - Work agent's loop: Receives the message, assembles its own prompt (e.g., "Email this summary to colleague@work.com"), executes `send_email` tool, and completes with "Email sent."
   - Back in personal agent's loop: Tool result (e.g., "Message sent to work agent") is processed. LLM reasons: "Task complete—no further actions needed."

   *Loop prevention*: Each iteration is bounded by the LLM's decision (only propose tools if goal unmet). Inter-agent is asynchronous—one agent's run ends before the next fully processes. No synchronous ping-pong; if the work agent needs clarification, it would explicitly message back, but only if its prompt deems it necessary (rare, as goals are finite).

5. **Compaction and Retries (If Needed)**:
   - If context grows too large (e.g., long weather data), auto-compaction triggers: History is summarized, events emitted, and the run retries with a cleaner context.
   - In our example, no need—context is small, so no retry loop.

6. **Reply Shaping and Completion**:
   - Final payloads assembled: Assistant text ("Weather summary emailed successfully") + any inline tool summaries (if verbose mode).
   - Suppressions apply: If the email tool already sent a visible reply, duplicates are filtered (e.g., no echo of "Email sent").
   - Lifecycle `end` emitted. If no reply needed, `NO_REPLY` token silences output.
   - Run ends: `agent.wait` (if called) returns `{ status: ok, startedAt, endedAt }`. Persistence saves the session state.

   *Early end scenarios*: If timeout hits (default 600s), it aborts. Or if user cancels via `AbortSignal`.

### How This Ensures No Infinite Chatting Loops
- **Bounded by Goal**: The LLM is prompted to stop when done (e.g., no tools if task complete). In our example, after email, the personal agent doesn't auto-reply—it exits.
- **Serialization and Asynchronicity**: Chats between agents are one-way messages triggering separate runs. No real-time loop; delays from queueing/processing break cycles.
- **Safeguards**: Timeouts, compaction, and hooks prevent edge cases. If the work agent hallucinates a need for endless clarification, its own loop bounds it (model decides "enough"), and logs expose it for user fix.
- **Outcome**: User gets "Weather researched and emailed." Total runs: Two finite loops (one per agent), no more chatting.

This setup makes OpenClaw efficient for real tasks—proactive yet controlled. For a real code dive, check the GitHub repo (e.g., pi-agent-core's loop in TypeScript), but this example captures the essence from the doc! If you want a variation (e.g., with Moltbook external comms), let me know.

Here's a detailed explanation of how this "Angry Enterprise Client" scenario could work in OpenClaw, using the multi-agent system you've planned (based on the attached table). I'll assume we're setting this up in a single OpenClaw Gateway instance for simplicity, with the four agents running side-by-side. Each agent would have its own isolated workspace, personality (defined in files like `SOUL.md`), and skills (e.g., web browsing for verification, email/messaging for responses). The Orchestrator acts as the central coordinator, delegating tasks via internal messaging or shared resources to avoid silos.

This setup leverages OpenClaw's agentic loops, inter-agent communication (e.g., via allowlisted messaging tools or shared files), and tools like web browsing or API integrations (e.g., for checking logs or Twitter). The goal is to handle the task efficiently: verify the outage, draft an RCA, and respond diplomatically—while preventing infinite loops through goal-bounded runs and asynchronous interactions. I'll break it down step-by-step, including how loops and communications flow.

### Setup Assumptions in OpenClaw
- **Agents Configuration** (in `openclaw.json`):
  - **Orchestrator**: Bound to inbound triggers (e.g., Twitter mentions via X integration or support ticket APIs). Personality: Strict, deadline-focused. Skills: Task delegation, progress tracking.
  - **Sarah**: Handles client-facing empathy. Personality: Apologetic, relationship-oriented. Skills: Email drafting, sentiment analysis.
  - **Marcus**: Technical verifier. Personality: Blunt, log-focused. Skills: API calls to monitoring tools (e.g., logs, uptime checks), RCA drafting.
  - **Priya**: Comms reviewer. Personality: Brand-protective, concise. Skills: Content polishing, PR guidelines enforcement.
  - Inter-agent messaging enabled via config allowlist (e.g., Orchestrator can message all; others reply only to Orchestrator).
- **Triggers**: The system monitors for events (e.g., via a skill polling Twitter for mentions or integrating with a ticketing system like Zendesk).
- **Shared Resources**: A common file like `INCIDENT.md` for collaborative updates (e.g., outage details, RCA draft).
- **Tools/Skills**: Pre-installed for web search (verify outage), shell commands (check logs), and messaging (respond to client).
- **Security**: Agents run in sandboxes; sensitive access (e.g., logs) granted only to Marcus.

### Step-by-Step Flow in the Scenario
The scenario starts with an event: The client posts angrily on Twitter about a data outage (e.g., "@YourCompany Help! Critical outage on our enterprise dashboard—data inaccessible since 8 AM!") and opens a P0 ticket. OpenClaw detects this via a background skill (e.g., X Semantic Search polling for company mentions). Here's how it unfolds:

1. **Trigger and Intake by Orchestrator**:
   - An inbound message/event arrives (e.g., from X integration or ticket API) routed to the Orchestrator via bindings in `openclaw.json` (e.g., match on "P0" keyword or client ID).
   - Orchestrator's agentic loop starts (via `agent` RPC): It assembles context (e.g., from `MEMORY.md`: "Client X is high-value; prioritize P0s"), builds the system prompt ("Strictly organize: Verify outage, draft RCA, respond by 10 AM deadline"), and infers via LLM.
   - LLM reasons: "Step 1: Delegate verification to Marcus. Step 2: Await RCA, then hand to Sarah for response draft, Priya for review."
   - Tools called: `sessions_send` (internal messaging) to Marcus: "Verify outage for Client X—check logs/uptime. Deadline: 15 min. Report back in INCIDENT.md."
   - Loop iterates: No further actions needed yet, so it emits lifecycle `end` and waits asynchronously (e.g., via a scheduled follow-up skill).

   *Loop Handling*: This run is serialized per session—finite, as the LLM stops after delegation (goal: "Initiate process"). No chatting loop; message to Marcus triggers a separate run.

2. **Verification by Marcus (DevOps Engineer)**:
   - Marcus receives the message (routed via Gateway bindings), starting its own isolated loop.
   - Context assembly: Loads technical skills (e.g., API to logs), personality ("Be blunt, focus on facts").
   - LLM infers: "Task: Verify outage. Action: Call tool to query logs/uptime."
   - Tools executed: E.g., web browse or shell command to check infrastructure (assuming integration with tools like Datadog or AWS). Results: "Outage confirmed—root cause: Database overload at 8:05 AM due to unoptimized query. Uptime dropped to 95%."
   - LLM drafts RCA: A factual summary (e.g., "Issue: DB overload. Impact: Data access blocked. Resolution: Scale DB shards. ETA: 30 min.").
   - Action: Updates shared `INCIDENT.md` with RCA, then messages back to Orchestrator: "Verification complete. RCA attached—blunt version, no fluff."
   - Loop ends: Model determines "Task done—no more tools," emitting `end`.

   *Loop Prevention*: Technical focus keeps it concise; compaction trims log data if verbose. Timeout (e.g., 600s) aborts if query hangs.

3. **Coordination and Handoff by Orchestrator**:
   - Orchestrator's follow-up loop triggers (e.g., via heartbeat polling `INCIDENT.md` or direct reply message).
   - LLM reviews: "Marcus done. Now delegate response: Sarah for empathy, then Priya for polish. Deadline: Respond within 1 hour."
   - Tools: `sessions_send` to Sarah: "Draft diplomatic response to Client X based on RCA in INCIDENT.md. Be apologetic, focus on retention."
   - Loop ends after delegation, persisting state.

   *Inter-Agent Comms*: Asynchronous—Orchestrator doesn't wait synchronously; it exits and relies on events/replies. This breaks potential cycles.

4. **Diplomatic Draft by Sarah (Client Success Manager)**:
   - Sarah's loop starts on message receipt.
   - Personality-driven prompt: "Empathetic, non-technical—prioritize relationship."
   - LLM reasons: "Soften RCA: Apologize, assure quick fix."
   - Draft: "Dear Client, We're deeply sorry for the inconvenience this outage caused. Our team has identified the issue (database overload) and is implementing a fix ETA 30 min. Your success is our priority—let's hop on a call?"
   - Action: Appends draft to `INCIDENT.md`, messages Orchestrator: "Empathetic draft ready for review."
   - Loop ends: Goal met.

   *Alignment with Persona*: Non-technical tone avoids jargon, fitting Sarah's role.

5. **PR Review by Priya (Comms Specialist)**:
   - Orchestrator delegates via message: "Review Sarah's draft—ensure brand-safe, concise."
   - Priya's loop: Loads PR skills (e.g., tone checker).
   - LLM: "Protect image: Make professional, remove over-apology if risky."
   - Revised draft: Concise version, e.g., "We apologize for the disruption. Root cause: Database issue, fix underway. Committed to your uptime."
   - Action: Finalizes in `INCIDENT.md`, messages Orchestrator: "Approved response—professional and brand-aligned."
   - Loop ends.

6. **Final Response and Completion**:
   - Orchestrator's final loop: Pulls everything together.
   - LLM: "All deliverables met. Send response."
   - Tools: Messaging skill to reply on Twitter/ticket (e.g., "We've resolved the outage—details in ticket. Apologies for the impact!").
   - Loop ends: Emits `end`, persists full incident log. Notifies user (you) if configured.

   *Overall Safeguards*: Total runs: ~5-6 finite loops (one per delegation/response). No infinite chatting—each is goal-bound (e.g., "Draft only, then stop"). If delays occur (e.g., Marcus needs clarification), it would message back, but Orchestrator's strict deadlines could timeout/abort via hooks. Compaction handles growing `INCIDENT.md`.

### Benefits and Considerations in OpenClaw
- **Efficiency**: Orchestrator ensures deadlines (e.g., full resolution in <1 hour, fitting your Singapore time zone—starting at 09:21 AM +08).
- **Scalability**: For external comms (e.g., Twitter), integrate with Moltbook or Discord for agent debates if needed, but keep it internal here.
- **Customization**: Tune personalities in `SOUL.md` for better alignment (e.g., make Marcus even more log-focused).
- **Risks**: Monitor for hallucinations (use strong LLMs like Claude). Test with allowlists to prevent unauthorized chats.
- **Extension**: If the outage isn't verified, Orchestrator could loop back to Marcus once, but prompts emphasize "Escalate only if critical" to bound it.

This turns OpenClaw into a proactive support team—autonomous yet controlled. If you provide more details (e.g., specific skills or configs), I can refine the example!

### Single Agent Architecture in OpenClaw

OpenClaw's architecture is designed as a lightweight, gateway-centric system that turns large language models (LLMs) into proactive, always-on AI agents running locally on your hardware (e.g., PC, Mac, or VPS). At its core, it's built on Node.js and leverages the "Pi" agent framework (pi-agent-core) for minimalism and reliability. The focus is on separating concerns into clean layers: the gateway as the control plane, the agent runner for execution, and extensible tools/skills for actions. This avoids monolithic designs, making it more controllable than many AI agent systems.

#### Key Components
- **Gateway**: The central "brain" – a Node.js service that handles inbound/outbound messaging, routing, and orchestration. It acts as the entry point for triggers (e.g., messages from WhatsApp, Telegram, Discord, or APIs) and manages the agent's lifecycle. The gateway uses a configuration file (`openclaw.json`) to define behaviors, auth profiles, and bindings (rules for routing messages to the agent based on channel, sender, etc.). It ensures serialized execution to prevent races.
  
- **Session Management**: Each agent maintains persistent state via sessions (identified by keys like user/channel combos). Sessions store history, context, and memory (e.g., in files like `MEMORY.md` or `SOUL.md` for personality/rules). The gateway resolves sessions, acquires write locks for consistency, and handles compaction (summarizing long histories to fit token limits).

- **Agentic Loop (Execution Engine)**: Powered by pi-agent-core, this is the core runtime – a serialized loop that processes tasks: intake (e.g., message), context assembly (prompt building with skills and bootstrap files), LLM inference (e.g., via OpenAI/Anthropic), tool execution (e.g., shell commands, web browsing), streaming replies, and persistence. The loop is event-driven and model-bounded: the LLM decides when to stop (no more tools needed), avoiding infinite iterations. It uses lane-based serialization (per-session queues) for safe concurrency.

- **Skills and Tools**: Modular extensions (Markdown-based instructions) loaded into the agent's environment. Over 100 prebuilt skills for tasks like file I/O, browser automation (semantic snapshots for navigation), or API calls. Skills are snapshotted per run for consistency and can be self-written by the agent for adaptability.

- **Workspace and Sandboxing**: A local directory for files, with optional sandboxing to isolate risky operations (e.g., redirecting to a temp root). This gives the agent real system access while managing security.

#### How It Works for a Single Agent
1. **Trigger**: An event (e.g., user message) hits the gateway.
2. **Routing**: Bindings direct it to the agent's session.
3. **Loop Execution**: Prompt assembled, LLM reasons and calls tools iteratively until done.
4. **Output**: Replies streamed back via the channel; state persisted.
This makes a single agent "always-on" – it runs in the background, triggered by events, without needing constant user input. The simplicity (e.g., no complex orchestration) comes from Pi's minimal design, focusing on reliable tool loops and context management.

### Multi-Agent Architecture in OpenClaw

OpenClaw scales seamlessly from one agent to multiple by running them side-by-side in the same gateway, with built-in isolation and communication primitives. This creates a collaborative system without needing external orchestration tools – agents can delegate tasks, share context, and coordinate for complex workflows (e.g., your "Angry Enterprise Client" scenario with Orchestrator, Sarah, Marcus, and Priya). The architecture emphasizes declarative setup, security isolation, and asynchronous interactions to prevent issues like infinite loops or races.

#### Key Extensions for Multi-Agent
- **Declarative Definition**: Agents are defined in the config (`openclaw.json`) – each with unique workspaces, sessions, personalities (`SOUL.md`), and skill sets. For example, one agent for technical analysis (like Marcus), another for comms (Priya). They share the same gateway for efficient resource use but remain isolated to avoid credential leaks or conflicts.

- **Routing and Bindings**: Enhanced for multi-agent: Inbound messages are routed based on rules (e.g., channel type, sender ID, keywords like "P0" for support). This allows specialization – e.g., a work-related tweet goes to the Orchestrator, which delegates.

- **Communication Mechanisms**:
  - **Internal Messaging**: Enabled via allowlists in config (disabled by default for security). Agents use tools like `sessions_send` to message each other directly (e.g., Orchestrator to Marcus: "Verify outage"). This is asynchronous – each message triggers a separate agentic loop in the receiver, keeping interactions bounded.
  - **Shared Resources**: Indirect collab via files (e.g., `INCIDENT.md` for RCA drafts) or global skills directories. Agents read/write these without direct chatting, reducing overhead.
  - **External Platforms**: For distributed agents (across devices), integrate with messaging apps (e.g., shared Discord groups) or Moltbook (AI-only social network) for posting/debating. This adds scalability but keeps core internal.

- **Concurrency and Isolation**: Per-session lanes serialize runs within an agent; global queues handle cross-agent coordination. Workspaces are separate, with optional sandboxing. This prevents cascades – e.g., one agent's error doesn't loop others indefinitely.

- **Orchestration**: No built-in complex coordinator; instead, designate one agent (e.g., Orchestrator) to delegate via prompts/tools. Pi enables simple multi-agent by allowing one to prompt another, ideal for experimentation.

#### How Multi-Agent Collaboration Works
1. **Trigger**: Event routed to lead agent (e.g., Orchestrator).
2. **Delegation**: Its loop reasons and messages subordinates (e.g., to Marcus for verification).
3. **Parallel/Sequential Execution**: Sub-agents run independent loops, updating shared files or replying.
4. **Aggregation**: Lead agent polls/receives replies, assembles final output.
This elastic scaling (e.g., on DigitalOcean) supports growth from single to fleet without re-architecting. Loops remain finite and goal-driven, with safeguards like timeouts ensuring no endless chatting.

Great question — this is one of the most important practical aspects when moving from a single agent to a multi-agent system.

In OpenClaw, **parallel execution of multiple agents is naturally supported**, but it is **not automatic** in the sense that the framework itself decides when to run agents in parallel. Instead, **parallelism emerges from how you design the workflow and how the Orchestrator (or any coordinating agent) behaves**.

Let me explain clearly how this works in practice — using your Angry Enterprise Client scenario as the example.

### Two main patterns in multi-agent workflows

| Pattern                  | When agents run                     | Typical use case in your scenario                          | How it is triggered in OpenClaw                          |
|--------------------------|--------------------------------------|-------------------------------------------------------------------|------------------------------------------------------------|
| Sequential / dependent   | One after another                    | Sarah needs Marcus’s RCA before she can write the response       | Orchestrator sends message → Marcus runs → replies → Orchestrator sees reply → sends to Sarah |
| Parallel / independent   | Multiple agents at the same time     | Verify outage (Marcus) + Check recent client tickets (Sarah) + Draft holding tweet (Priya) | Orchestrator sends messages to several agents in one loop |

### How parallel execution actually happens in OpenClaw

OpenClaw does **not** have a built-in parallel executor or task graph like some other frameworks (LangGraph, CrewAI, AutoGen, etc.).

Instead, parallelism is achieved through these mechanisms:

1. **Asynchronous message sending from the coordinator**
   - In one agentic loop, the Orchestrator can call the `sessions_send` tool **multiple times** in a single reasoning step.
   - Example:

     ```text
     Thought: I need three things done quickly:
     1. Technical verification → Marcus
     2. Check recent support interactions with this client → Sarah
     3. Prepare a short public holding message → Priya

     Actions:
     - Send message to Marcus: "Verify outage for Client X, check logs, draft RCA, 10 min deadline"
     - Send message to Sarah: "Look up last 30 days of tickets/interactions for Client X, summarize sentiment & history"
     - Send message to Priya: "Draft 1-sentence public holding tweet for outage mention, brand-safe, no technical details"
     ```

   When the Orchestrator finishes that loop and sends those three messages:

   - Three separate agent sessions receive a message **almost simultaneously**.
   - Each of them starts its own independent agentic loop **in parallel** (because they are different session keys / different agents).
   - The gateway processes them concurrently (subject to global queue limits and hardware resources).

2. **Independent agent loops**
   - Each agent has its own session lane.
   - Marcus, Sarah, and Priya each run their own full agentic loop (prompt → reasoning → tools → reply) completely independently.
   - They do **not** wait for each other unless you explicitly tell them to.

3. **Waiting / synchronization happens later**
   The Orchestrator is usually the one that waits and combines results. There are several common ways to do this:

   | Synchronization style       | How Orchestrator waits / collects                                 | Pros                              | Cons                                   |
   |-----------------------------|---------------------------------------------------------------------|-----------------------------------|----------------------------------------|
   | Reply-based (most common)   | Agents reply directly to Orchestrator when done                     | Simple, explicit                  | Orchestrator must stay alive           |
   | Shared file polling         | Agents write results to `INCIDENT.md` or `STATUS.json`             | Loose coupling                    | Needs polling / scheduled check        |
   | Event / message queue       | Agents send “done” message to a shared channel or inbox            | Clean                             | Slightly more setup                    |
   | Timeout + best-effort       | Orchestrator gives deadline, takes whatever is ready after X min   | Fast under pressure               | May use incomplete information         |

   Example reply-based flow:

   ```
   Orchestrator loop #1
   ↓ sends 3 messages in parallel
   ├─→ Marcus starts loop
   ├─→ Sarah starts loop
   └─→ Priya starts loop

   (some time passes)

   Marcus finishes → sends reply to Orchestrator
   Sarah finishes → sends reply to Orchestrator
   Priya finishes → sends reply to Orchestrator

   Orchestrator loop #2 (triggered by incoming messages or scheduled check)
   → reads all three replies
   → decides next step (e.g. give everything to Sarah for final response)
   ```

### Summary — how parallel vs sequential is controlled

Who decides whether agents run in parallel or sequentially?

**The reasoning of the Orchestrator (or whoever is coordinating)**

- If the Orchestrator sends messages to multiple agents **in one reasoning step** → **parallel execution**
- If the Orchestrator sends to one agent, waits for reply, then sends to the next → **sequential execution**

Most real-world workflows are a **mix**:

```
Parallel phase
├── Marcus: technical verification & RCA
├── Sarah: client history & sentiment
└── Priya: draft short public statement

→ all finish (roughly at same time)

Sequential merge phase
→ Orchestrator receives all three
→ hands RCA + history + holding statement to Sarah
→ Sarah writes final empathetic customer response
→ Priya reviews final response
→ Orchestrator sends to customer
```

### Quick reference table for your Angry Customer scenario

Task                                    | Likely execution style | Which agent(s) run in parallel?          | Who waits / merges?
---------------------------------------|------------------------|-------------------------------------------|-------------------------------
Verify outage & write RCA              | Sequential            | —                                         | Orchestrator
Check client history & sentiment       | Can be parallel       | Marcus + Sarah                            | Orchestrator
Draft public holding message           | Can be parallel       | Marcus + Sarah + Priya                    | Orchestrator
Write empathetic customer response     | Sequential            | Sarah (after receiving RCA & history)     | Sarah → Priya → Orchestrator
Review & polish final message          | Sequential            | Priya                                     | Orchestrator
Send final response to client & Twitter| Sequential            | Orchestrator                              | —

So the most common pattern you’ll see is:

**One parallel burst at the beginning** (gather information quickly)  
**followed by a mostly sequential refinement & approval chain** (write → review → send)

Does this match how you imagined it, or would you like to see a more detailed example of what the Orchestrator’s prompt or reasoning trace might look like to achieve parallel + sequential behavior?

Yes — **exactly**.

In OpenClaw, whether agents run **in parallel** or **sequentially** is **almost entirely controlled by the reasoning and tool-calling decisions of the Orchestrator** (or whichever agent is playing the coordinating role).

The framework itself gives you:

- **Parallel capability** — because multiple agents can receive messages and start their loops at roughly the same time
- **Concurrency safety** — via per-session serialization and queue lanes
- **No built-in parallel executor or task graph**

So the actual parallelism (or lack of it) comes down to **what the Orchestrator decides to do in its reasoning step**.

### Quick recap of the two main patterns the Orchestrator can choose

| Pattern the Orchestrator chooses          | What it does in one reasoning step                              | Resulting execution style | Typical use-case example in Angry Client scenario |
|-------------------------------------------|------------------------------------------------------------------|----------------------------|----------------------------------------------------|
| **Send to many agents at once**           | Calls `sessions_send` (or equivalent) multiple times            | **Parallel**               | “Verify outage” + “Check client history” + “Draft holding tweet” |
| **Send to one agent, wait for reply**     | Sends to one → finishes loop → waits for reply → next loop sends to next | **Sequential**             | After getting RCA from Marcus → only then send to Sarah |
| **Hybrid (most common in practice)**      | First send to several → later merge results and do sequential steps | **Parallel burst + sequential refinement** | Parallel info gathering → sequential drafting & approval |

### How the Orchestrator controls this in practice

The Orchestrator’s system prompt + personality + current context determine which style it picks.

Example prompt styles that produce different behaviors:

**Style A — Encourages parallelism**  
“You are a strict project manager. When multiple independent pieces of information are needed, delegate them **simultaneously** to the appropriate specialists so we move as fast as possible. Only sequence tasks when one clearly depends on the output of another.”

→ This almost always creates a **parallel burst** at the beginning.

**Style B — Forces mostly sequential**  
“You are extremely cautious. Never send tasks to multiple people at the same time unless it is 100% certain they are independent. Always wait for confirmation and results before moving to the next step.”

→ This creates a very linear, step-by-step chain.

**Style C — Hybrid (most realistic)**  
“You are a strict, deadline-oriented project manager.  
- Maximize speed: delegate independent tasks in parallel whenever possible.  
- Maintain quality: only hand off dependent work after receiving necessary inputs.  
- Always track deadlines and follow up if someone is late.”

→ This usually produces:  
parallel early (gather facts fast) → sequential later (draft → review → approve → send)

### Concrete example from the Angry Client scenario

Orchestrator’s first reasoning step (parallel choice):

```
Thought: We have a P0 incident. To respond quickly and correctly we need:

1. Technical root cause & timeline (Marcus)  
2. Client relationship history & previous incidents (Sarah)  
3. A safe short public statement we can post quickly if needed (Priya)

These three are independent — we should start them now.

Actions:
- Message Marcus: "P0 outage Client X. Immediately verify in logs, determine root cause, draft concise RCA. Deadline: 12 minutes."
- Message Sarah: "High-value client X angry on Twitter. Pull last 60 days of tickets, calls, sentiment. Summarize key context for response."
- Message Priya: "Prepare 1-sentence public holding statement for Twitter. Brand-safe, no admission of fault yet, empathetic tone."
```

→ **Result**: Three agents start **in parallel** within seconds.

Later Orchestrator loop (sequential choice after receiving results):

```
Thought: Marcus sent RCA, Sarah sent client history.  
Priya's holding tweet is ready but not urgent anymore since we have facts.

Next step is clear: Sarah must write the actual customer response using the RCA + history.

Actions:
- Message Sarah: "Use the attached RCA from Marcus and client history you already have. Write full empathetic email + ticket reply. Be apologetic but factual. Draft ready in 8 minutes."
```

→ **Result**: Now only Sarah is activated → sequential.

### Key takeaways

- OpenClaw **enables** parallel execution, but **does not force it**.
- The **Orchestrator’s prompt, personality, and reasoning** are what actually decide parallel vs sequential.
- You control the behavior mostly by:
  - How you write the Orchestrator’s `SOUL.md` / system prompt
  - What examples / few-shot instructions you give it
  - Whether you allow it to use parallel delegation explicitly

If you want mostly parallel → make the Orchestrator aggressive about delegating independent work.  
If you want safe & linear → make it cautious and sequential by design.
