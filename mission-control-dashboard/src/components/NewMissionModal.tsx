import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NewMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (title: string, description: string) => void;
}

export function NewMissionModal({ isOpen, onClose, onSubmit }: NewMissionModalProps) {
    const { theme } = useTheme();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim() && description.trim()) {
            onSubmit(title, description);
            setTitle('');
            setDescription('');
            onClose();
        }
    };

    const suggestions = [
        { label: "Competitor Analysis", desc: "Analyze pricing and features for [Product Name] in the [Industry] market." },
        { label: "Tech Research", desc: "Research the latest trends in [Technology] and summarize key players." },
        { label: "Content Strategy", desc: "Draft a blog post outline about [Topic] targeting [Audience]." },
    ];

    const applySuggestion = (s: { desc: string }) => {
        setDescription(s.desc);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-2xl shadow-2xl z-50 border p-6
                            ${theme === 'dark'
                                ? 'bg-[#1e293b] border-white/10 text-white'
                                : 'bg-white border-slate-200 text-slate-800'}
                        `}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-cyan-500" />
                                New Mission
                            </h2>
                            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                                <X className="w-5 h-5 opacity-50" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider opacity-60 mb-1.5">Mission Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Market Research for Project X"
                                    className={`w-full px-3 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all
                                        ${theme === 'dark'
                                            ? 'bg-black/20 border-white/10 placeholder-white/20'
                                            : 'bg-slate-50 border-slate-200 placeholder-slate-400'}
                                    `}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">Directives</label>
                                    <span className="text-[10px] opacity-40">Be specific about the goal</span>
                                </div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detailed instructions for the agent..."
                                    rows={4}
                                    className={`w-full px-3 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none
                                        ${theme === 'dark'
                                            ? 'bg-black/20 border-white/10 placeholder-white/20'
                                            : 'bg-slate-50 border-slate-200 placeholder-slate-400'}
                                    `}
                                />
                            </div>

                            {/* Suggestions */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => applySuggestion(s)}
                                        className={`flex-none text-[10px] px-3 py-1.5 rounded-full border transition-all whitespace-nowrap
                                            ${theme === 'dark'
                                                ? 'bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400'
                                                : 'bg-slate-100 border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600'}
                                        `}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${theme === 'dark' ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}
                                    `}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!title.trim() || !description.trim()}
                                    className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-sm font-semibold text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Launch Mission
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
