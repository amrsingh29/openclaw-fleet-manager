"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    Hash,
    MessageSquare,
    Bot,
    ChevronDown,
    Users,
    Activity,
    Search
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";

interface WarRoomChatProps {
    defaultChannel?: string;
}

export function WarRoomChat({ defaultChannel = "general" }: WarRoomChatProps) {
    const [selectedChannel, setSelectedChannel] = useState(defaultChannel);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch data for channels
    const teams = useQuery(api.teams.list) || [];
    const agents = useQuery(api.agents.list) || [];
    const tasks = useQuery(api.tasks.list) || [];

    // Fetch messages for the selected channel
    const messages = useQuery(api.messages.list, { channelId: selectedChannel }) || [];
    const sendMessage = useMutation(api.messages.send);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await sendMessage({
            channelId: selectedChannel,
            content: newMessage,
        });
        setNewMessage("");
    };

    // Derived channels
    const channels = [
        { id: "general", label: "general", icon: Hash, type: "system" },
        ...teams.map(t => ({
            id: `team-${t._id}`,
            label: t.slug,
            icon: Users,
            type: "department"
        })),
        ...tasks.filter(t => t.status === "in_progress" || t.status === "review").map(t => ({
            id: `task-${t._id}`,
            label: t.title.slice(0, 15) + "...",
            icon: Activity,
            type: "mission"
        }))
    ];

    const currentChannel = channels.find(c => c.id === selectedChannel);

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Channel Selector Header */}
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="flex-1 relative group">
                    <select
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-muted"
                    >
                        <optgroup label="System">
                            <option value="general"># general</option>
                        </optgroup>
                        <optgroup label="Departments">
                            {teams.map(t => (
                                <option key={t._id} value={`team-${t._id}`}># {t.slug}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Active Missions">
                            {tasks.filter(t => t.status === "in_progress" || t.status === "review").map(t => (
                                <option key={t._id} value={`task-${t._id}`}>⚡ {t.title}</option>
                            ))}
                        </optgroup>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50 pointer-events-none" />
                </div>
            </div>

            {/* Messages Display */}
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                    {messages.length === 0 && (
                        <div className="h-32 flex flex-col items-center justify-center text-center px-4">
                            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
                            <p className="text-[11px] text-muted-foreground italic">
                                Secure channel established. Awaiting signals...
                            </p>
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {[...messages].reverse().map((msg) => {
                            const isMe = !msg.fromAgentId;
                            const agent = agents.find((a: any) => a._id === msg.fromAgentId);

                            return (
                                <motion.div
                                    key={msg._id}
                                    initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                                >
                                    <div className="flex items-center gap-2 mb-1 px-1">
                                        <span className={`text-[10px] font-bold tracking-tight uppercase ${isMe ? "text-primary" : "text-muted-foreground"}`}>
                                            {isMe ? "Commander" : agent?.name || "Agent"}
                                        </span>
                                        <span className="text-[9px] opacity-40 font-mono">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className={`
                                        px-3 py-2 rounded-2xl text-[12px] leading-relaxed max-w-[90%] break-words shadow-sm
                                        ${isMe
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-muted/80 text-foreground rounded-tl-none border border-border/50"}
                                    `}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Signal #${currentChannel?.label || selectedChannel}...`}
                    className="h-9 text-xs bg-muted/30 border-border/50 focus-visible:ring-primary/30"
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={!newMessage.trim()}
                    className="h-9 w-9 shrink-0"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}
