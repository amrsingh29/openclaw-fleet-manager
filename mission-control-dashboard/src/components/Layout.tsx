import { motion } from 'framer-motion';
import { Sun, Moon, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
    onTeamSelect?: (teamId: string) => void;
    isCollapsed: boolean;
    onToggle: () => void;
}

export function Layout({ children, onTeamSelect, isCollapsed, onToggle }: LayoutProps) {
    const { theme, toggleTheme } = useTheme();
    const teams = useQuery(api.teams.list) || [];

    return (
        <>
            {/* Background Gradient Mesh (Global) */}
            <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-300
                 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-50'}
            `}>
                <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-500
                    ${theme === 'dark' ? 'bg-purple-900/20' : 'bg-blue-200/40'}
                `} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-500
                    ${theme === 'dark' ? 'bg-cyan-900/20' : 'bg-indigo-200/40'}
                `} />
            </div>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? 80 : 256 }}
                className={`z-10 border-r flex flex-col p-3 backdrop-blur-xl transition-colors duration-300 h-full relative
                    ${theme === 'dark'
                        ? 'border-white/10 bg-white/5'
                        : 'border-slate-200 bg-white/80'}
                `}
            >
                {/* Header & Toggle */}
                <div className={`flex items-center mb-8 px-1 ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex flex-none items-center justify-center shadow-lg shadow-cyan-500/20">
                            <span className="font-bold text-white">M</span>
                        </div>
                        {!isCollapsed && (
                            <motion.h1
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`text-xl font-bold tracking-tight whitespace-nowrap
                                    ${theme === 'dark' ? 'text-white' : 'text-slate-900'}
                                `}>
                                Mission Control
                            </motion.h1>
                        )}
                    </div>

                    <button
                        onClick={onToggle}
                        className={`p-1.5 rounded-lg transition-colors
                            ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}
                        `}
                    >
                        {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                    </button>
                </div>

                <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar overflow-x-hidden">
                    {/* Main Nav */}
                    <div className="mb-6">
                        {!isCollapsed && (
                            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 whitespace-nowrap">
                                Platform
                            </h3>
                        )}
                        <div className="flex flex-col gap-1">
                            {/* Children (Dashboard Buttons) need to be adapted or wrapped to hide text */}
                            {/* 
                                Note: Children passed from App.tsx are raw buttons. 
                                We might need to clone them or assume they handle their own responsive text, 
                                BUT strict css hiding is easier.
                                We'll use a CSS class approach for children if possible, but here we can't easily modify children.
                                However, the children in App.tsx use `hidden md:block` logic? 
                                No, they use `span` for text. We can target them with CSS if we want, or just let them overflow/clip if we fix width.
                                Better: App.tsx content needs to respect the collapse.
                                For now, let's just render children. If they overflow, we might need a context or css fix.
                             */}
                            {children}
                        </div>
                    </div>

                    {/* Teams Section */}
                    <div>
                        {!isCollapsed && (
                            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 whitespace-nowrap">
                                Departments
                            </h3>
                        )}
                        {teams.map((team: any) => (
                            <button
                                key={team._id}
                                onClick={() => onTeamSelect?.(team._id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium group relative
                                ${theme === 'dark'
                                        ? 'text-slate-300 hover:text-white hover:bg-white/10'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}
                                ${isCollapsed ? 'justify-center' : ''}
                            `}>
                                <div className={`w-2 h-2 rounded-full transition-colors flex-none
                                    ${theme === 'dark' ? 'bg-cyan-500' : 'bg-blue-500'}
                                `} />
                                {!isCollapsed && <span className="truncate">{team.name}</span>}
                                {isCollapsed && (
                                    <div className={`absolute left-full ml-2 px-2 py-1 rounded bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50
                                        ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-900'}
                                    `}>
                                        {team.name}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Theme Toggle */}
                <div className="mb-4 px-1">
                    <button
                        onClick={toggleTheme}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium
                            ${theme === 'dark'
                                ? 'text-slate-400 hover:text-white hover:bg-white/10'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}
                             ${isCollapsed ? 'justify-center' : ''}
                        `}
                        title={isCollapsed ? (theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode') : undefined}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4 flex-none" /> : <Moon className="w-4 h-4 flex-none" />}
                        {!isCollapsed && (
                            <span>
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                        )}
                    </button>
                </div>

                {!isCollapsed && (
                    <div className="text-xs text-slate-500 text-center md:text-left px-2 whitespace-nowrap">
                        v1.0.0 • Online
                    </div>
                )}
            </motion.aside>
        </>
    );
}
