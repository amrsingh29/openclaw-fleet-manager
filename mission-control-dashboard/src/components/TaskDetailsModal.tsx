import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Bot, Terminal, Calendar } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TaskDetailsModalProps {
    task: any | null;
    onClose: () => void;
}

export function TaskDetailsModal({ task, onClose }: TaskDetailsModalProps) {
    const { theme } = useTheme();

    if (!task) return null;

    // Format Date
    const date = new Date(task.createdTime || Date.now()).toLocaleString();

    return (
        <AnimatePresence>
            {task && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                            className={`w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border
                                ${theme === 'dark'
                                    ? 'bg-[#1e293b] border-white/10 text-white'
                                    : 'bg-white border-slate-200 text-slate-800'}
                            `}
                        >
                            {/* Header */}
                            <div className={`px-6 py-4 border-b flex justify-between items-start flex-none
                                ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50/50'}
                            `}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-cyan-500 font-bold">TASK-{task._id?.slice(-4)}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider
                                            ${task.status === 'done' ? 'bg-green-500/20 text-green-500' :
                                                task.status === 'review' ? 'bg-yellow-500/20 text-yellow-500' :
                                                    task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-500' :
                                                        'bg-slate-500/20 text-slate-500'}
                                        `}>
                                            {task.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold leading-tight">{task.title}</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5 opacity-50" />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                                {/* Info Row */}
                                <div className="flex flex-wrap gap-4 text-xs opacity-70">
                                    <div className="flex items-center gap-1.5">
                                        <Bot className="w-3.5 h-3.5" />
                                        <span>Agent: {task.assigneeIds?.length > 0 ? 'Assigned' : 'Unassigned'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Created: {date}</span>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2 flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5" />
                                        Directives
                                    </h3>
                                    <div className={`p-4 rounded-lg text-sm leading-relaxed
                                        ${theme === 'dark' ? 'bg-black/20 text-slate-300' : 'bg-slate-50 text-slate-700'}
                                    `}>
                                        {task.description}
                                    </div>
                                </div>

                                {/* Output / Result */}
                                {(task.output || task.status === 'done' || task.status === 'review') && (
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2 flex items-center gap-2">
                                            <Terminal className="w-3.5 h-3.5" />
                                            Mission Result
                                        </h3>

                                        <div className={`flex-1 rounded-lg border overflow-hidden flex flex-col min-h-[200px]
                                        ${theme === 'dark' ? 'bg-[#0d1117] border-white/10' : 'bg-slate-50 border-slate-200'}
                                    `}>
                                            <div className="px-3 py-1.5 border-b text-[10px] font-mono flex justify-between
                                                ${theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}
                                            ">
                                                <span>MARKDOWN OUT</span>
                                                <span>README.md</span>
                                            </div>
                                            <div className={`p-4 overflow-x-auto custom-scrollbar prose prose-sm max-w-none 
                                                ${theme === 'dark'
                                                    ? 'prose-invert text-slate-300 prose-headings:text-cyan-400 prose-a:text-blue-400 prose-code:text-yellow-300 prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10'
                                                    : 'text-slate-700 prose-headings:text-slate-900 prose-a:text-blue-600 prose-pre:bg-slate-100 prose-pre:border-slate-200'}
                                            `}>
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                >
                                                    {task.output || "No output captured yet."}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className={`px-6 py-4 border-t flex justify-end gap-3 flex-none
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
                </>
            )}
        </AnimatePresence>
    );
}
