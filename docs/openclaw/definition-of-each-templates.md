These six templates (Visualized in the "Lulubot" image) are the **Standardized Brain Structure** for your fleet. In our current application, they are not just documentation—they act as the **System Prompt Context** that defines how each agent behaves and remembers.

Here is how they are practically useful in our current state:

1. **IDENTITY.md** & **SOUL.md** (The Persona)

   - **Utility**: These define the agent's "Character."
   - **Current Use**: When you run `agent-runner.ts`, it reads these files to build the LLM's system prompt.
   - **Example**: Jarvis's `IDENTITY` says he is a "Chief of Staff" with a "sharp, professional vibe." Without these files, the agent would just be a generic AI. With them, he stays "in character" as your fleet commander.

2. **USER.md** (The Commander's Dossier)

   - **Utility**: It tells the agent **who you are** and your specific preferences.
   - **Current Use**: This prevents you from repeating yourself. The agent already knows your OS (Mac), your favorite coding style, and your project paths because it reads this file at boot.
   - **Example**: If you say "Run the build," the agent knows the path to your project because it's in `USER.md`, not because you told it in the chat.

3. **TOOLS.md** (The Knowledge of Hands)

   - **Utility**: It’s the "Owner's Manual" for the agent's capabilities.
   - **Current Use**: While `scripts/tools.ts` has the actual code, the agent uses the `TOOLS.md` description to understand **when** to use a tool.
   - **Example**: If Shuri is debugging, she looks at her "Knowledge of Tools" to decide if `fetch_latest_logs` is the right action for a server crash.

4. **HEARTBEAT.md** (The Proactive Agenda)

   - **Utility**: This is the "To-Do List" that wakes the agent up.
   - **Current Use**: This is the most critical file for **Proactivity**. Our agents don't just wait for you; they check this file every 5–30 minutes.
   - **Example**: If `HEARTBEAT.md` says "Check for server alerts," the agent will proactively ping you in the War Room if it finds an error, even if you haven't spoken to it all day.

5. **MEMORY.md** (The Long-Term Cortex)

   - **Utility**: This provides **Continuity**.
   - **Current Use**: Every time a session restarts, the LLM "forgets" the chat history. `MEMORY.md` is where the agent stores the "Distilled Truths" of previous interactions.
   - **Example**: If you told the agent three days ago to "Never use Tailwind," and that fact was committed to `MEMORY.md`, the agent will remember that preference today, even in a brand new chat session.