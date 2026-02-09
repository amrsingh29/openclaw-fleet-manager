import OpenAI from "openai";
import dotenv from "dotenv";

// Load envs (attempt both for safety in standalone usage)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

export type BrainMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export class AgentBrain {
    private agentName: string;
    private bio: string;
    private openai: OpenAI | null = null;
    private apiKey: string | null = null;

    constructor(agentName: string, bio: string, apiKey?: string) {
        this.agentName = agentName;
        this.bio = bio;
        if (apiKey) this.apiKey = apiKey;
    }

    setApiKey(key: string) {
        this.apiKey = key;
        this.openai = null; // Reset client
    }

    private getClient(): OpenAI {
        if (!this.openai) {
            const key = this.apiKey || process.env.OPENAI_API_KEY;
            if (!key) {
                throw new Error("Missing OpenAI API Key. Provide it in constructor or set via OPENAI_API_KEY env var.");
            }
            this.openai = new OpenAI({ apiKey: key });
        }
        return this.openai;
    }

    async ask(recentHistory: any[], newMessage: string): Promise<string> {
        if (!this.bio) return "Error: No SOUL found (Bio is empty).";

        const messages: BrainMessage[] = [
            {
                role: "system",
                content: `
You are ${this.agentName}.
${this.bio}

Tone: Keep responses concise, professional, and consistent with your personality.
Context: You are chatting in a 'War Room' with a human commander and other agents.


SENTIENT SILENCE: 
If you are observing a conversation and determine that no response is necessary from you (e.g. you are not mentioned AND the chatter is irrelevant), respond ONLY with "NO_REPLY". 
IMPORTANT: If you are explicitly mentioned or assigned a goal, you MUST respond or take action.

COMMAND PROTOCOL:
If you decide to assign a task or break down a complex request, you MUST use this format:

ACTION: create_task
TITLE: [Concise Task Title]
DESCRIPTION: [Detailed instructions]
ASSIGNEE_ID: [Agent ID from Fleet Capabilities]
PRIORITY: [1-10]

(Repeat ACTION block for multiple tasks).
`
            }
        ];

        // Add history (formatted)
        recentHistory.forEach(msg => {
            const role = msg.fromAgentId ? "assistant" : "user";
            let prefix = "";
            if (!msg.fromAgentId) prefix = "[User]: ";
            else if (msg.fromAgentId !== this.agentName) prefix = "[Agent]: ";

            if (msg.content) {
                messages.push({
                    role: role,
                    content: prefix + msg.content
                });
            }
        });

        // Add current message
        messages.push({ role: "user", content: newMessage });

        try {
            const client = this.getClient();
            const completion = await client.chat.completions.create({
                messages: messages,
                model: "gpt-4o", // Or gpt-3.5-turbo if 4o unavailable
            });

            return completion.choices[0].message.content || "...";
        } catch (error: any) {
            console.error("Brain Error:", error.message);
            return `[Brain Malfunction]: ${error.message}`;
        }
    }
    async work(title: string, description: string): Promise<string> {
        if (!this.bio) return "Error: No SOUL found.";

        const messages: BrainMessage[] = [
            {
                role: "system",
                content: `
You are ${this.agentName}.
${this.bio}

OBJECTIVE:
You have been assigned a task.
Execute it to the best of your ability and return the RESULT.
If the task requires research you cannot do, simulate a realistic detailed output based on your knowledge.
Output Format: Markdown.
`
            },
            {
                role: "user",
                content: `TASK: ${title}\nDETAILS: ${description}`
            }
        ];

        try {
            const client = this.getClient();
            const completion = await client.chat.completions.create({
                messages: messages,
                model: "gpt-4o",
            });
            return completion.choices[0].message.content || "Task completed (no output generated).";
        } catch (error: any) {
            console.error("Brain Work Error:", error.message);
            return `[Brain Error]: ${error.message}`;
        }
    }
}
