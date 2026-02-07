import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, UserPlus, Sparkles } from 'lucide-react';
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTheme } from '../context/ThemeContext';

interface HireAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
}

export function HireAgentModal({ isOpen, onClose, teamId }: HireAgentModalProps) {
    const { theme } = useTheme();
    const hireAgent = useMutation(api.agents.hire);
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [soul, setSoul] = useState('You are a helpful assistant.');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await hireAgent({
                name,
                role,
                teamId: teamId as any,
                soul
            });
            onClose();
            setName('');
            setRole('');
        } catch (err) {
            console.error(err);
            alert("Failed to hire agent. Name might be taken.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border
                    ${theme === 'dark' ? 'bg-[#161b22] border-white/10' : 'bg-white border-slate-200'}
                `}
            >
                {/* Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between
                     ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50'}
                `}>
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold">Recruit New Agent</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 opacity-70" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">Agent Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Toby"
                            className={`w-full px-4 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-green-500 outline-none transition-all
                                ${theme === 'dark' ? 'border-white/10' : 'border-slate-300'}
                            `}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">Role</label>
                        <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="e.g. HR Manager"
                            className={`w-full px-4 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-green-500 outline-none transition-all
                                ${theme === 'dark' ? 'border-white/10' : 'border-slate-300'}
                            `}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-70 flex justify-between">
                            <span>Personality (Soul)</span>
                            <span className="flex items-center gap-1 text-purple-400"><Sparkles className="w-3 h-3" /> Prompt</span>
                        </label>
                        <textarea
                            value={soul}
                            onChange={(e) => setSoul(e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-green-500 outline-none transition-all font-mono text-sm
                                ${theme === 'dark' ? 'border-white/10 bg-black/20' : 'border-slate-300 bg-slate-50'}
                            `}
                            required
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'}
                            `}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-green-500/20 transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? 'Onboarding...' : 'Hire Agent'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
