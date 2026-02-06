import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Hash, Users, Bot, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function WarRoom() {
    const { theme } = useTheme();
    const [selectedChannel, setSelectedChannel] = useState<string>('general');
    const [newMessage, setNewMessage] = useState('');

    // Fetch messages for the selected channel
    // We assume backend has a list query that takes channelId
    const messages = useQuery(api.messages.list, { channelId: selectedChannel }) || [];
    const sendMessage = useMutation(api.messages.send);

    // Fetch active tasks to create channels
    const tasks = useQuery(api.tasks.list) || [];
    const activeTasks = tasks.filter((t: any) => t.status !== 'done' && t.status !== 'inbox');

    // Fetch agents to resolve names
    const agents = useQuery(api.agents.list) || [];

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await sendMessage({
            channelId: selectedChannel,
            content: newMessage,
            // fromAgentId is null for "User" (System Admin)
        });
        setNewMessage('');
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left Sidebar: Channels */}
            <div className={`w-64 border-r flex flex-col
                ${theme === 'dark' ? 'border-white/10' : 'border-slate-200 bg-slate-50/50'}
            `}>
                <div className="p-4 border-b border-white/5 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-cyan-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider opacity-70">Comms Channels</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {/* General Channel */}
                    <button
                        onClick={() => setSelectedChannel('general')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                            ${selectedChannel === 'general'
                                ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600')
                                : 'opacity-60 hover:opacity-100 hover:bg-white/5'}
                        `}
                    >
                        <Hash className="w-4 h-4" />
                        <span className="font-medium">general</span>
                    </button>

                    {/* Active Mission Channels */}
                    {activeTasks.length > 0 && (
                        <>
                            <div className="mt-4 mb-2 px-3 text-[10px] uppercase font-bold opacity-40">Active Missions</div>
                            {activeTasks.map((task: any) => (
                                <button
                                    key={task._id}
                                    onClick={() => setSelectedChannel(task._id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                        ${selectedChannel === task._id
                                            ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600')
                                            : 'opacity-60 hover:opacity-100 hover:bg-white/5'}
                                    `}
                                >
                                    <Bot className="w-3.5 h-3.5" />
                                    <span className="truncate text-xs">{task.title}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className={`h-14 border-b flex items-center px-6 justify-between
                    ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}
                `}>
                    <div className="flex items-center gap-2">
                        <Hash className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-sm">
                            {selectedChannel === 'general' ? 'general' : tasks.find((t: any) => t._id === selectedChannel)?.title || 'Unknown Mission'}
                        </span>
                    </div>
                    {/* Online Agents count could go here */}
                </div>

                {/* Messages Stream */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col-reverse">
                    <div className="flex-1" /> {/* Spacer to push messages down */}

                    {messages.map((msg: any) => {
                        const isMe = !msg.fromAgentId;
                        // Find the agent by ID. This assumes 'agents' has an '_id' field and 'name' field.
                        const agentName = !isMe && agents.find((a: any) => a._id === msg.fromAgentId)?.name || 'Agent';

                        return (
                            <motion.div
                                key={msg._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-3 max-w-3xl ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                            >
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-none text-xs font-bold
                                    ${isMe
                                        ? 'bg-cyan-500 text-white'
                                        : (theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}
                                `}>
                                    {isMe ? 'U' : agentName.charAt(0)}
                                </div>

                                {/* Bubble */}
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold opacity-50">
                                            {isMe ? 'User' : agentName}
                                        </span>
                                        <span className="text-[10px] opacity-30">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed
                                        ${isMe
                                            ? 'bg-cyan-600 text-white rounded-tr-none'
                                            : (theme === 'dark' ? 'bg-white/10 text-slate-200 rounded-tl-none' : 'bg-slate-100 text-slate-800 rounded-tl-none')}
                                    `}>
                                        {msg.content}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Input Area */}
                <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
                    <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={`Message #${selectedChannel === 'general' ? 'general' : 'mission'}...`}
                            className={`w-full pl-5 pr-12 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all
                                ${theme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-white/20'
                                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'}
                            `}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="absolute right-2 top-2 p-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
