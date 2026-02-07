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
    const scrollRef = useRef<HTMLDivElement>(null);

    const channelId = `team-${teamId}`;
    const messages = useQuery(api.messages.list, { channelId }) || [];
    const sendMessage = useMutation(api.messages.send);
    const agents = useQuery(api.agents.list) || [];

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
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

    return (
        <div className="flex flex-col h-[500px] rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">{teamName} Communications</h3>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Secure Channel</span>
                </div>
            </div>

            {/* Message Area */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="space-y-4">
                    <AnimatePresence initial={false}>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-center opacity-50">
                                <MessageSquare className="w-8 h-8 mb-2" />
                                <p className="text-xs">No personnel communications found in this sector.</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isAgent = !!msg.fromAgentId;
                                const agent = isAgent ? agents.find(a => a._id === msg.fromAgentId) : null;

                                return (
                                    <motion.div
                                        key={msg._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex gap-3 ${!isAgent ? 'flex-row-reverse' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${isAgent
                                                ? 'bg-primary/10 border-primary/20 text-primary'
                                                : 'bg-secondary border-border text-secondary-foreground'
                                            }`}>
                                            {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                        </div>
                                        <div className={`flex flex-col max-w-[80%] ${!isAgent ? 'items-end' : ''}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold tracking-tight uppercase">
                                                    {agent ? agent.name : (isAgent ? "Unknown Agent" : "Commander")}
                                                </span>
                                                <span className="text-[9px] opacity-40">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${isAgent
                                                    ? 'bg-muted border border-border rounded-tl-none'
                                                    : 'bg-primary text-primary-foreground rounded-tr-none'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }).reverse() // Reversed because list query returns desc
                        )}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 border-t border-border bg-muted/20">
                <div className="relative">
                    <Input
                        placeholder="Broadcast message to department..."
                        className="pr-12 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button
                        size="icon"
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-1 top-1 w-8 h-8 rounded-lg"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </form>
        </div>
    );
}
