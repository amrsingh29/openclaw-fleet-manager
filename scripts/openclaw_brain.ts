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

    constructor(agentName: string, bio: string) {
        this.agentName = agentName;
        this.bio = bio;
    }

    private getClient(): OpenAI {
        if (!this.openai) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("Missing OPENAI_API_KEY in environment variables (.env or .env.local)");
            }
            this.openai = new OpenAI({ apiKey });
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
}
