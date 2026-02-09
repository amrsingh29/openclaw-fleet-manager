"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    Hash,
    MessageSquare,
    Users,
    Activity,
    ChevronDown,
    Search,
    Menu,
    X,
    Sparkles,
    Circle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ClipboardList, Target, ShieldCheck } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { StrategicDirective } from "./strategic-directive";

interface WarRoomChatProps {
    defaultChannel?: string;
    embedded?: boolean; // If true, use the "small box" style, otherwise full hub
}

export function WarRoomChat({ defaultChannel = "general", embedded = false }: WarRoomChatProps) {
    const [selectedChannel, setSelectedChannel] = useState(defaultChannel);
    const [newMessage, setNewMessage] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(!embedded);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch data
    const teams = useQuery(api.teams.list) || [];
    const agents = useQuery(api.agents.list, {}) || [];
    const tasks = useQuery(api.tasks.list, {}) || [];
    const messages = useQuery(api.messages.list, { channelId: selectedChannel }) || [];
    const proposals = useQuery(api.proposals.listPending) || [];
    const sendMessage = useMutation(api.messages.send);
    const approveProposal = useMutation(api.proposals.approve);
    const denyProposal = useMutation(api.proposals.deny);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await sendMessage({ channelId: selectedChannel, content: newMessage });
        setNewMessage("");
    };

    // Derived channels
    const channels = {
        system: [{ id: "general", label: "general", icon: Hash }],
        departments: teams.map(t => ({ id: `team-${t._id}`, label: t.slug, icon: Users })),
        missions: tasks.filter(t => t.status === "in_progress" || t.status === "review").map(t => ({
            id: `task-${t._id}`,
            label: t.title,
            icon: Activity
        }))
    };

    const currentChannel = [...channels.system, ...channels.departments, ...channels.missions].find(c => c.id === selectedChannel);

    // Agent Color Helper
    const getAgentColor = (id: string) => {
        const hash = id.split("").reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        return `hsl(${hash % 360}, 70%, 50%)`;
    };

    if (embedded) {
        // ... (Keep existing simplified version)
    }

    return (
        <div className="flex h-full w-full bg-background/50 overflow-hidden font-sans">
            {/* Sidebar (Full Hub Mode) */}
            <AnimatePresence mode="wait">
                {isSidebarOpen && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="flex-none border-r border-border bg-card/30 backdrop-blur-md flex flex-col overflow-hidden"
                    >
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-cyan-500" />
                                <h2 className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                    Channels
                                </h2>
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-6 pb-4">
                                {/* System */}
                                <div>
                                    <h3 className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">System</h3>
                                    {channels.system.map(ch => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setSelectedChannel(ch.id)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${selectedChannel === ch.id ? "bg-primary/20 text-primary font-bold shadow-lg shadow-primary/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                        >
                                            <ch.icon size={14} className={selectedChannel === ch.id ? "text-primary" : "opacity-50"} />
                                            <span>{ch.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Departments */}
                                <div>
                                    <h3 className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Departments</h3>
                                    {channels.departments.map(ch => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setSelectedChannel(ch.id)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${selectedChannel === ch.id ? "bg-primary/20 text-primary font-bold shadow-lg shadow-primary/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                        >
                                            <ch.icon size={14} className={selectedChannel === ch.id ? "text-primary" : "opacity-50"} />
                                            <span>#{ch.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Missions */}
                                <div>
                                    <h3 className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Missions</h3>
                                    {channels.missions.map(ch => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setSelectedChannel(ch.id)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${selectedChannel === ch.id ? "bg-primary/20 text-primary font-bold shadow-lg shadow-primary/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                        >
                                            <Activity size={14} className={selectedChannel === ch.id ? "text-primary" : "opacity-50"} />
                                            <span className="truncate">{ch.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden">
                {/* Header */}
                <div className="h-14 border-b border-border flex items-center justify-between px-6 flex-none bg-card/20 backdrop-blur-sm shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        >
                            {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
                        </Button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold tracking-tight text-foreground">
                                    {currentChannel ? `#${currentChannel.label}` : "Select Channel"}
                                </span>
                                <Badge variant="outline" className="h-4 text-[9px] px-1 border-primary/30 text-primary animate-pulse">LIVE</Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground">Global Comms Hub Protocol v2.4</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {agents.filter(a => a.status !== 'offline').slice(0, 3).map(a => (
                                <div key={a._id} className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden shadow-sm" title={a.name}>
                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold bg-primary/20 text-primary">
                                        {a.name[0]}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                            {agents.filter(a => a.status !== 'offline').length} ACTIVE AGENTS
                        </span>
                    </div>
                </div>

                {/* Messages Feed */}
                <ScrollArea className="flex-1 min-h-0 px-4 md:px-10 lg:px-20">
                    <div className="max-w-5xl mx-auto space-y-6 py-8">
                        {messages.length === 0 && (
                            <div className="h-[50vh] flex flex-col items-center justify-center text-center px-4">
                                <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 animate-pulse">
                                    <MessageSquare className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Awaiting Signals</h3>
                                <p className="text-xs text-muted-foreground max-w-[240px] mt-2">
                                    This channel is secure. Send a message to initiate protocol.
                                </p>
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {/* Merge messages and proposals for this channel */}
                            {[...messages].reverse().map((msg, idx, array) => {
                                const isMe = !msg.fromAgentId;
                                const agent = agents.find((a: any) => a._id === msg.fromAgentId);
                                const color = msg.fromAgentId ? getAgentColor(msg.fromAgentId) : "var(--primary)";

                                // Grouping logic
                                const prevMsg = array[idx - 1];
                                const isGrouped = prevMsg && prevMsg.fromAgentId === msg.fromAgentId &&
                                    (msg.timestamp - prevMsg.timestamp < 300000);

                                return (
                                    <motion.div
                                        key={msg._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex gap-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                                    >
                                        {!isGrouped && (
                                            <div className="flex-none pt-1">
                                                <div
                                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold border border-white/10 shadow-lg"
                                                    style={{ backgroundColor: isMe ? "var(--primary)" : color, color: "#fff" }}
                                                >
                                                    {isMe ? "C" : agent?.name?.[0] || "A"}
                                                </div>
                                            </div>
                                        )}
                                        {isGrouped && <div className="w-8 flex-none" />}

                                        <div className={`flex flex-col max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
                                            {!isGrouped && (
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <span className="text-[11px] font-bold text-foreground/90">
                                                        {isMe ? "Commander" : agent?.name}
                                                    </span>
                                                    {(msg as any).depth !== undefined && (msg as any).depth > 0 && (
                                                        <Badge variant="outline" className="h-3 text-[8px] px-1 border-orange-500/30 text-orange-500 font-mono">
                                                            DEPTH: {(msg as any).depth}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[9px] text-muted-foreground/50 font-mono">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}

                                            {msg.content.includes("ACTION: create_task") ? (
                                                <StrategicDirective content={msg.content} agents={agents} />
                                            ) : (
                                                <div className={`
                                                    relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xl border
                                                    ${isMe
                                                        ? "bg-primary text-primary-foreground border-primary/20 rounded-tr-none"
                                                        : "glass-morphism bg-card/40 border-white/5 rounded-tl-none"}
                                                `}>
                                                    <MarkdownRenderer content={msg.content} className={isMe ? "text-primary-foreground" : "text-foreground/90"} />
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Proposal Alerts for this channel */}
                        {/* ... (Existing proposal code) */}

                        <div ref={messagesEndRef} className="h-px w-full" />
                    </div>
                </ScrollArea>

                {/* Command Bar */}
                <div className="flex-none p-6 md:px-10 lg:px-20 bg-gradient-to-t from-background via-background/80 to-transparent pt-10">
                    <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-2xl opacity-0 group-focus-within:opacity-30 transition-opacity duration-500" />
                        <div className="relative glass-morphism border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl bg-muted/30">
                            <div className="pl-3 text-muted-foreground">
                                <Hash size={16} />
                            </div>
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={`Signal ${currentChannel ? `#${currentChannel.label}` : "channel"}...`}
                                className="border-none bg-transparent focus-visible:ring-0 text-sm h-12 shadow-none placeholder:text-muted-foreground/50"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!newMessage.trim()}
                                className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg transition-all active:scale-95"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-4 mt-3 px-2">
                            <div className="flex items-center gap-1.5">
                                <Circle className="w-2 h-2 text-primary" fill="currentColor" />
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Secure Protocol</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">{agents.length} fleet members watching</span>
                            </div>
                        </div>
                    </form>
                </div>
            </div >
        </div >
    );
}

