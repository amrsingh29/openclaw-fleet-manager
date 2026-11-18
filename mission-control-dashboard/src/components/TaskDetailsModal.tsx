import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Bot, Terminal, Calendar, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';

interface TaskDetailsModalProps {
    task: any | null;
    onClose: () => void;
}

/**
 * Center-docked task panel. The kanban card only has room for a preview, so the
 * full directive + agent report live here, scrollable and wide enough to read
 * tables and code blocks without horizontal hunting.
 */
export function TaskDetailsModal({ task, onClose }: TaskDetailsModalProps) {
    const { theme } = useTheme();
    const [isWide, setIsWide] = useState(true);
    const [copied, setCopied] = useState(false);

    // Escape closes; body scroll is locked while the panel is up.
    useEffect(() => {
        if (!task) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [task, onClose]);

    // Reset transient UI when a different task is opened.
    useEffect(() => {
        setCopied(false);
    }, [task?._id]);

    if (!task) return null;

    const date = new Date(task.createdTime || task._creationTime || Date.now()).toLocaleString();
    const statusStyles: Record<string, string> = {
        done: 'bg-green-500/20 text-green-500',
        review: 'bg-yellow-500/20 text-yellow-500',
        in_progress: 'bg-blue-500/20 text-blue-500',
        assigned: 'bg-purple-500/20 text-purple-500',
    };

    const copyOutput = async () => {
        const text = task.output || '';
        let ok = false;
        try {
            await navigator.clipboard.writeText(text);
            ok = true;
        } catch {
            // Async clipboard needs a secure context/permission; fall back to the
            // legacy selection trick so Copy still works over plain http.
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                ok = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch {
                ok = false;
            }
        }
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6"
            >
                {/* Panel */}
                <motion.div
                    key="panel"
                    initial={{ opacity: 0, scale: 0.97, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 16 }}
                    transition={{ duration: 0.18 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border
                        ${isWide ? 'max-w-5xl' : 'max-w-2xl'} max-h-[92vh]
                        ${theme === 'dark'
                            ? 'bg-[#1e293b] border-white/10 text-white'
                            : 'bg-white border-slate-200 text-slate-800'}
                    `}
                >
                    {/* Header */}
                    <div className={`px-5 md:px-6 py-4 border-b flex justify-between items-start gap-4 flex-none
                        ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50/70'}
                    `}>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-cyan-500 font-bold">TASK-{task._id?.slice(-4)}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider
                                    ${statusStyles[task.status] || 'bg-slate-500/20 text-slate-500'}`}>
                                    {(task.status || 'unknown').replace('_', ' ')}
                                </span>
                                {task.priority === 'high' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-red-500/20 text-red-500">
                                        high
                                    </span>
                                )}
                            </div>
                            <h2 className="text-lg md:text-xl font-bold leading-tight break-words">{task.title}</h2>
                        </div>
                        <div className="flex items-center gap-1 flex-none">
                            <button
                                onClick={() => setIsWide(!isWide)}
                                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                title={isWide ? 'Narrow panel' : 'Widen panel'}
                            >
                                {isWide ? <Minimize2 className="w-4 h-4 opacity-50" /> : <Maximize2 className="w-4 h-4 opacity-50" />}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                title="Close (Esc)"
                            >
                                <X className="w-5 h-5 opacity-50" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable body */}
                    <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-5">
                        {/* Meta */}
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs opacity-70">
                            <div className="flex items-center gap-1.5">
                                <Bot className="w-3.5 h-3.5" />
                                <span>Agent: {task.assigneeIds?.length > 0 ? 'Assigned' : 'Unassigned'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Created: {date}</span>
                            </div>
                        </div>

                        {/* Directives */}
                        <div>
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider opacity-50 mb-2 flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5" />
                                Directives
                            </h3>
                            <div className={`p-4 rounded-lg text-sm
                                ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-50'}
                            `}>
                                {task.description
                                    ? <MarkdownRenderer content={task.description} />
                                    : <span className="opacity-50 italic">No directives recorded.</span>}
                            </div>
                        </div>

                        {/* Mission result */}
                        {(task.output || task.status === 'done' || task.status === 'review') && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider opacity-50 flex items-center gap-2">
                                        <Terminal className="w-3.5 h-3.5" />
                                        Mission Result
                                    </h3>
                                    {task.output && (
                                        <button
                                            onClick={copyOutput}
                                            className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-colors
                                                ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}
                                            `}
                                            title="Copy raw markdown"
                                        >
                                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                    )}
                                </div>

                                <div className={`rounded-lg border overflow-hidden flex flex-col
                                    ${theme === 'dark' ? 'bg-[#0d1117] border-white/10' : 'bg-slate-50 border-slate-200'}
                                `}>
                                    <div className={`px-3 py-1.5 border-b text-[10px] font-mono flex justify-between
                                        ${theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}
                                    `}>
                                        <span>MARKDOWN OUT</span>
                                        <span>README.md</span>
                                    </div>
                                    <div className="p-4 md:p-5">
                                        <MarkdownRenderer
                                            content={task.output || '_No output captured yet._'}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`px-5 md:px-6 py-3 border-t flex justify-end gap-3 flex-none
                        ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}
                    `}>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
