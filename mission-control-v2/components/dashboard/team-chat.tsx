"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, User, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { StrategicDirective } from "./strategic-directive";
import { Badge } from "@/components/ui/badge";

interface TeamChatProps {
    teamId: Id<"teams">;
    teamName: string;
}

export function TeamChat({ teamId, teamName }: TeamChatProps) {
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const channelId = `team-${teamId}`;
    const messages = useQuery(api.messages.list, { channelId }) || [];
    const sendMessage = useMutation(api.messages.send);
    const agents = useQuery(api.agents.list, {}) || [];

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await sendMessage({
                channelId,
                content: newMessage.trim(),
            });
            setNewMessage("");
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    // Agent HSL coloring logic (shared with War Room)
    const getAgentColor = (id: string) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${hash % 360}, 70%, 60%)`;
    };

    return (
        <div className="flex flex-col h-full bg-background/50 overflow-hidden font-sans">
            {/* Standard Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-6 flex-none bg-card/20 backdrop-blur-sm shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                        <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tracking-tight text-foreground uppercase">
                                #{teamName} Channel
                            </span>
                            <Badge variant="outline" className="h-4 text-[9px] px-1 border-primary/30 text-primary animate-pulse uppercase">LIVE</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase opacity-50">Sector Uplink Protocol</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-[9px] font-mono px-2 py-0.5 rounded bg-primary/5 text-primary/50 border border-primary/10">AGENT_SYNC_ENABLED</div>
                </div>
            </div>

            {/* Message Feed */}
            <ScrollArea className="flex-1 min-h-0 px-4 md:px-10 lg:px-20">
                <div className="max-w-5xl mx-auto space-y-6 py-8">
                    <AnimatePresence initial={false}>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[300px] text-center opacity-40">
                                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <p className="text-[10px] font-mono tracking-widest uppercase">Protocol Awaiting Input</p>
                            </div>
                        ) : (
                            [...messages].reverse().map((msg, idx, array) => {
                                const isAgent = !!msg.fromAgentId;
                                const agent = isAgent ? agents.find((a: any) => a._id === msg.fromAgentId) : null;
                                const color = msg.fromAgentId ? getAgentColor(msg.fromAgentId) : "var(--primary)";

                                // Grouping
                                const prevMsg = array[idx - 1];
                                const isGrouped = prevMsg && prevMsg.fromAgentId === msg.fromAgentId &&
                                    (msg.timestamp - prevMsg.timestamp < 300000);

                                return (
                                    <motion.div
                                        key={msg._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex gap-4 ${!isAgent ? 'flex-row-reverse' : 'flex-row'}`}
                                    >
                                        {!isGrouped && (
                                            <div className="flex-none pt-1">
                                                <div
                                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold border border-white/10 shadow-lg"
                                                    style={{ backgroundColor: !isAgent ? "var(--primary)" : color, color: "#fff" }}
                                                >
                                                    {!isAgent ? "C" : agent?.name?.[0] || "A"}
                                                </div>
                                            </div>
                                        )}
                                        {isGrouped && <div className="w-8 flex-none" />}

                                        <div className={`flex flex-col min-w-0 max-w-[85%] ${!isAgent ? 'items-end' : 'items-start'}`}>
                                            {!isGrouped && (
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <span className="text-[10px] font-bold text-foreground/90 uppercase tracking-tighter text-muted-foreground">
                                                        {agent ? agent.name : (!isAgent ? "Commander" : "Agent")}
                                                    </span>
                                                    {(msg as any).depth !== undefined && (msg as any).depth > 0 && (
                                                        <Badge variant="outline" className="h-3 text-[8px] px-1 border-orange-500/30 text-orange-500 font-mono scale-75 origin-left">
                                                            DEPTH: {(msg as any).depth}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[9px] opacity-30 font-mono">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}

                                            {msg.content.includes("ACTION: create_task") ? (
                                                <StrategicDirective content={msg.content} agents={agents} />
                                            ) : (
                                                <div className={`
                                                    relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xl border
                                                    overflow-hidden break-words w-fit max-w-[85%] md:max-w-2xl
                                                    ${!isAgent
                                                        ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-none'
                                                        : 'glass-morphism bg-muted dark:bg-black/40 border-border/50 dark:border-white/5 rounded-tl-none'}
                                                `}>
                                                    <MarkdownRenderer content={msg.content} className={!isAgent ? "text-primary-foreground" : "text-foreground/90"} />
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} className="h-px w-full" />
                </div>
            </ScrollArea>

            {/* Command Bar */}
            <div className="flex-none p-6 md:px-10 lg:px-20 bg-gradient-to-t from-background via-background/80 to-transparent pt-10">
                <form onSubmit={handleSend} className="max-w-5xl mx-auto relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-2xl opacity-0 group-focus-within:opacity-30 transition-opacity duration-500" />
                    <div className="relative glass-morphism border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl bg-muted/30">
                        <Input
                            placeholder={`Signal to #${teamName}...`}
                            className="border-none bg-transparent focus-visible:ring-0 text-sm h-12 shadow-none placeholder:text-muted-foreground/50"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <Button
                            size="icon"
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
