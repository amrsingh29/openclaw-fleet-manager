"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    DndContext,
    closestCorners,
    useSensor,
    useSensors,
    PointerSensor,
    DragEndEvent,
    useDroppable,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { UserCheck } from "lucide-react";
import { useState } from "react";
import { AssignTaskModal } from "./assign-task-modal";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface TaskBoardProps {
    tasks: any[];
    onTaskClick?: (task: any) => void;
    agents: any[];
}

export function TaskBoard({ tasks, onTaskClick, agents }: TaskBoardProps) {
    const updateTaskStatus = useMutation(api.tasks.updateStatus);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [targetTask, setTargetTask] = useState<any>(null);

    // Add activation constraint so clicks work without conflicting with drag
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const columns = [
        { id: "inbox", title: "Inbox" },
        { id: "assigned", title: "Assigned" },
        { id: "in_progress", title: "In Progress" },
        { id: "review", title: "Review" },
        { id: "done", title: "Done" },
    ];

    // Helper to get tasks for a column
    const getTasks = (status: string) =>
        tasks.filter((t: any) => t.status === status);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id as string;

        // The over.id could be either a column ID or a task ID
        // If it's a task ID, we need to find which column that task is in
        let newStatus = over.id as string;

        // Check if over.id is a task ID by seeing if it exists in our tasks
        const targetTask = tasks.find((t) => t._id === newStatus);
        if (targetTask) {
            // If we're hovering over a task, use that task's status as the new status
            newStatus = targetTask.status;
        }

        // Find the task and update its status
        const task = tasks.find((t) => t._id === taskId);
        if (task && task.status !== newStatus) {
            updateTaskStatus({ id: taskId as Id<"tasks">, status: newStatus });
        }
    };

    return (
        <div className="h-full px-1">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragEnd={handleDragEnd}
            >
                <div className="flex h-full gap-2 min-w-[640px] pb-2 overflow-x-auto snap-x">
                    {columns.map((col) => (
                        <DroppableColumn
                            key={col.id}
                            id={col.id}
                            title={col.title}
                            tasks={getTasks(col.id)}
                            agents={agents}
                            onTaskClick={onTaskClick}
                            onAssignClick={(task) => {
                                setTargetTask(task);
                                setIsAssignModalOpen(true);
                            }}
                        />
                    ))}
                </div>
            </DndContext>

            {targetTask && (
                <AssignTaskModal
                    isOpen={isAssignModalOpen}
                    onClose={() => {
                        setIsAssignModalOpen(false);
                        setTargetTask(null);
                    }}
                    task={targetTask}
                />
            )}
        </div>
    );
}

function TaskCard({
    task,
    agents,
    onClick,
    onAssignClick,
}: {
    task: any;
    agents: any[];
    onClick?: () => void;
    onAssignClick?: (task: any) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: task._id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Find assigned agent
    const assigneeId = task.assigneeIds?.[0];
    const agent = assigneeId ? agents.find((a) => a._id === assigneeId) : null;

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            layoutId={task._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg border border-border bg-card shadow-sm cursor-grab active:cursor-grabbing group hover:shadow-md hover:border-primary/50 transition-all duration-200"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-mono text-primary truncate">
                    TASK-{task._id.slice(-4)}
                </span>
                {task.priority === "high" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] flex-none" />
                )}
            </div>
            <h5 className="text-xs font-medium mb-2 line-clamp-2">{task.title}</h5>

            <div className="flex items-center gap-2 mt-2">
                {/* Agent Avatar / Name */}
                {agent ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-semibold border border-primary/20 bg-primary/10 text-primary">
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        {agent.name}
                    </div>
                ) : assigneeId ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-semibold border border-dashed border-red-500/20 bg-red-500/10 text-red-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        Ghost
                    </div>
                ) : (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-secondary text-secondary-foreground">
                        -
                    </div>
                )}

                {task.status === "inbox" && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="w-6 h-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onAssignClick?.(task);
                                    }}
                                >
                                    <UserCheck className="w-3 h-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-[10px]">Assign Agent</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {/* Display Output if available */}
            {task.output && (
                <div className="mt-3 pt-2 border-t border-border">
                    <p className="text-[10px] font-semibold opacity-70 mb-1">Result:</p>
                    <div className="text-[10px] font-mono p-1.5 rounded bg-secondary/50 overflow-hidden text-ellipsis text-muted-foreground">
                        {task.output.slice(0, 150)}
                        {task.output.length > 150 ? "..." : ""}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function DroppableColumn({
    id,
    title,
    tasks,
    agents,
    onTaskClick,
    onAssignClick,
}: {
    id: string;
    title: string;
    tasks: any[];
    agents: any[];
    onTaskClick?: (task: any) => void;
    onAssignClick?: (task: any) => void;
}) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex-1 flex flex-col min-w-[128px] snap-start">
            <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    {title}
                </h4>
                <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full flex-none">
                    {tasks.length}
                </span>
            </div>

            <div
                ref={setNodeRef}
                className="flex-1 rounded-xl p-2 border border-border bg-card/50 backdrop-blur-sm transition-colors duration-300 flex flex-col gap-2 overflow-y-auto"
            >
                <div className="flex-1 space-y-2">
                    {tasks.map((task: any) => (
                        <TaskCard
                            key={task._id}
                            task={task}
                            agents={agents}
                            onClick={() => onTaskClick?.(task)}
                            onAssignClick={onAssignClick}
                        />
                    ))}
                    {tasks.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground text-center px-2">
                                No tasks
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
