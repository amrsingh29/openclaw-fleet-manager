import { DndContext, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { markdownToPlainText } from '../lib/text';

interface TaskBoardProps {
    tasks: any[];
    onTaskClick?: (task: any) => void;
    agents: any[];
}

export function TaskBoard({ tasks, onTaskClick, agents }: TaskBoardProps) {
    const { theme } = useTheme();

    // Fix: Add activation constraint so clicks work without conflicting with drag
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const columns = [
        { id: 'inbox', title: 'Inbox' },
        { id: 'assigned', title: 'Assigned' },
        { id: 'in_progress', title: 'In Progress' },
        { id: 'review', title: 'Review' },
        { id: 'done', title: 'Done' }
    ];

    // Helper to get tasks for a column
    const getTasks = (status: string) => tasks.filter((t: any) => t.status === status);

    return (
        <div className="h-full px-1">
            <DndContext sensors={sensors} collisionDetection={closestCorners}>
                {/* 
                   Changed to GRID layout. 
                   grid-cols-5 forces 5 equal columns regardless of screen width. 
                   min-w-[760px] ensures it fits on laptop screens + sidebar + intel panel without scroll.
                */}
                {/* 
                   Fit-to-Screen Optimization: 128px columns x 5 = 640px total. Fits in 1280px screen (Center Pane).
                */}
                <div className="flex h-full gap-2 min-w-[640px] pb-2 overflow-x-auto no-scrollbar snap-x">
                    {columns.map(col => (
                        <div key={col.id} className="flex-1 flex flex-col min-w-[128px] snap-start">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{col.title}</h4>
                                <span className="text-[10px] text-slate-600 bg-slate-500/10 px-1.5 py-0.5 rounded-full flex-none">
                                    {getTasks(col.id).length}
                                </span>
                            </div>

                            <div className={`flex-1 rounded-xl p-2 border transition-colors duration-300 flex flex-col gap-2 overflow-y-auto
                                ${theme === 'dark'
                                    ? 'bg-white/5 border-white/5'
                                    : 'bg-slate-100/50 border-slate-200'}
                            `}>
                                <div className="flex-1 space-y-2">
                                    {getTasks(col.id).map((task: any) => (
                                        <TaskCard key={task._id} task={task} agents={agents} onClick={() => onTaskClick?.(task)} />
                                    ))}
                                    {getTasks(col.id).length === 0 && (
                                        <div className="h-24 border-2 border-dashed border-slate-500/10 rounded-lg flex items-center justify-center">
                                            <span className="text-[10px] text-slate-500 text-center px-2">No tasks</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </DndContext>
        </div>
    );
}

function TaskCard({ task, agents, onClick }: { task: any, agents: any[], onClick?: () => void }) {
    const { theme } = useTheme();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task._id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    // Find assigned agent
    const assigneeId = task.assigneeIds?.[0];
    const agent = assigneeId ? agents.find(a => a._id === assigneeId) : null;

    const preview = task.output ? markdownToPlainText(task.output) : '';
    const hasMore = preview.length > 180;

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }}
            layoutId={task._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            title={preview || task.title}
            className={`p-3 rounded-lg border shadow-sm cursor-pointer active:cursor-grabbing group hover:shadow-md transition-all duration-200
                ${theme === 'dark'
                    ? 'bg-[#1e293b] border-white/10 hover:border-cyan-500/50'
                    : 'bg-white border-slate-200 hover:border-blue-400'}
            `}
        >
            <div className="flex justify-between items-start mb-2 gap-1">
                <span className="text-[9px] font-mono text-cyan-500 truncate">TASK-{task._id.slice(-4)}</span>
                <div className="flex items-center gap-1 flex-none">
                    {task.priority === 'high' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            // Keep the expand affordance from starting a drag.
                            e.stopPropagation();
                            onClick?.();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded
                            ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}
                        `}
                        title="Open full task"
                        aria-label="Open full task"
                    >
                        <Maximize2 className="w-3 h-3" />
                    </button>
                </div>
            </div>
            <h5 className={`text-xs font-medium mb-2 line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                {task.title}
            </h5>

            <div className="flex items-center gap-2 mt-2">
                {/* Agent Avatar / Name */}
                {agent ? (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-semibold border
                        ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}
                    `}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        {agent.name}
                    </div>
                ) : assigneeId ? (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-semibold border border-dashed
                        ${theme === 'dark' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200'}
                    `}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        Ghost
                    </div>
                ) : (
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold
                       ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}
                   `}>
                        -
                    </div>
                )}
            </div>

            {/* Result preview — plain text, click the card to read the full report */}
            {preview && (
                <div className={`mt-3 pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                    <p className="text-[10px] font-semibold opacity-70 mb-1">Result:</p>
                    <div className={`text-[10px] leading-snug p-1.5 rounded overflow-hidden
                        ${theme === 'dark' ? 'bg-black/20 text-slate-300' : 'text-slate-600 bg-slate-50'}
                    `}>
                        <p className="line-clamp-4 whitespace-pre-wrap break-words">{preview}</p>
                        {hasMore && (
                            <span className={`mt-1 flex items-center gap-1 text-[9px] font-semibold
                                ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}
                            `}>
                                <Maximize2 className="w-2.5 h-2.5" />
                                Open full report
                            </span>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
