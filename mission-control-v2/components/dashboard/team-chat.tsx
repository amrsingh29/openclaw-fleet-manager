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
    const agents = useQuery(api.agents.list) || [];

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
        <div className="flex flex-col h-[calc(100vh-160px)] min-h-[500px] bg-transparent overflow-hidden">
            {/* Minimal Header */}
            <div className="flex-none px-1 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                        <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-tight">{teamName} Comms</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Live Uplink</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Feed */}
            <ScrollArea className="flex-1 min-h-0 pr-4">
                <div className="space-y-6">
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
                                const agent = isAgent ? agents.find(a => a._id === msg.fromAgentId) : null;
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

                                        <div className={`flex flex-col max-w-[85%] ${!isAgent ? 'items-end' : 'items-start'}`}>
                                            {!isGrouped && (
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <span className="text-[10px] font-bold text-foreground/90 uppercase tracking-tighter text-muted-foreground">
                                                        {agent ? agent.name : (!isAgent ? "Commander" : "Agent")}
                                                    </span>
                                                    <span className="text-[9px] opacity-30 font-mono">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`
                                                px-3 py-2 rounded-2xl text-[12px] leading-relaxed shadow-lg border backdrop-blur-sm
                                                ${!isAgent
                                                    ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-none'
                                                    : 'bg-card/40 border-white/5 rounded-tl-none glass-morphism'}
                                            `}>
                                                {msg.content}
                                            </div>
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

            {/* Premium Integrated Input */}
            <form onSubmit={handleSend} className="flex-none pt-6">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/0 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                    <div className="relative">
                        <Input
                            placeholder="Signal to sector..."
                            className="h-11 bg-background/40 border-white/5 group-focus-within:border-primary/50 transition-all rounded-xl pr-12 text-sm placeholder:text-muted-foreground/30 focus-visible:ring-0"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <Button
                            size="icon"
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="absolute right-1.5 top-1.5 w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all shadow-lg"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-4 mt-3 px-1 text-[9px] text-muted-foreground/40 font-mono">
                    <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-primary/40" /> ENCRYPTION: AES-256</span>
                    <span className="ml-auto">SECTOR_LOCKED</span>
                </div>
            </form>
        </div>
    );
}
