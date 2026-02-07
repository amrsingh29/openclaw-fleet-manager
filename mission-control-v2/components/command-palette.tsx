"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { Search, Home, Users, MessageSquare, Settings, FileText } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function CommandPalette() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="overflow-hidden p-0 shadow-lg max-w-2xl">
                <CommandPrimitive className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
                    <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <CommandPrimitive.Input
                            placeholder="Type a command or search..."
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <CommandPrimitive.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                        <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </CommandPrimitive.Empty>

                        <CommandPrimitive.Group heading="Navigation">
                            <CommandPrimitive.Item
                                onSelect={() => runCommand(() => router.push("/"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <Home className="mr-2 h-4 w-4" />
                                <span>Dashboard</span>
                            </CommandPrimitive.Item>
                            <CommandPrimitive.Item
                                onSelect={() => runCommand(() => router.push("/war-room"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                <span>War Room</span>
                            </CommandPrimitive.Item>
                            <CommandPrimitive.Item
                                onSelect={() => runCommand(() => router.push("/agents"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <Users className="mr-2 h-4 w-4" />
                                <span>Agents</span>
                            </CommandPrimitive.Item>
                            <CommandPrimitive.Item
                                onSelect={() => runCommand(() => router.push("/settings"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </CommandPrimitive.Item>
                        </CommandPrimitive.Group>

                        <CommandPrimitive.Group heading="Quick Actions">
                            <CommandPrimitive.Item
                                onSelect={() => runCommand(() => console.log("Create new task"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Create New Task</span>
                            </CommandPrimitive.Item>
                        </CommandPrimitive.Group>
                    </CommandPrimitive.List>
                </CommandPrimitive>
            </DialogContent>
        </Dialog>
    );
}
