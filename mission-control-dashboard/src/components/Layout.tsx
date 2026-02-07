import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
    onTeamSelect?: (teamId: string) => void;
}

export function Layout({ children, onTeamSelect }: LayoutProps) {
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
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`w-20 md:w-64 z-10 border-r flex flex-col p-4 backdrop-blur-xl transition-colors duration-300 h-full relative
                    ${theme === 'dark'
                        ? 'border-white/10 bg-white/5'
                        : 'border-slate-200 bg-white/80'}
                `}
            >
                <div className="flex items-center gap-3 mb-8 px-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <span className="font-bold text-white">M</span>
                    </div>
                    <h1 className={`text-xl font-bold tracking-tight hidden md:block transition-colors
                        ${theme === 'dark' ? 'text-white' : 'text-slate-900'}
                    `}>
                        Mission Control
                    </h1>
                </div>

                <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                    {/* Main Nav */}
                    <div className="mb-6">
                        <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 hidden md:block">
                            Platform
                        </h3>
                        {children}
                    </div>

                    {/* Teams Section */}
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 hidden md:block">
                            Departments
                        </h3>
                        {teams.map((team: any) => (
                            <button
                                key={team._id}
                                onClick={() => onTeamSelect?.(team._id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium group
                                ${theme === 'dark'
                                        ? 'text-slate-300 hover:text-white hover:bg-white/10'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}
                            `}>
                                <div className={`w-2 h-2 rounded-full transition-colors
                                    ${theme === 'dark' ? 'bg-cyan-500' : 'bg-blue-500'}
                                `} />
                                <span className="hidden md:block truncate">{team.name}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Theme Toggle */}
                <div className="mb-4 px-2">
                    <button
                        onClick={toggleTheme}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium
                            ${theme === 'dark'
                                ? 'text-slate-400 hover:text-white hover:bg-white/10'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}
                        `}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span className="hidden md:block">
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </span>
                    </button>
                </div>

                <div className="text-xs text-slate-500 text-center md:text-left px-2">
                    v1.0.0 <span className="hidden md:inline">• Online</span>
                </div>
            </motion.aside>
        </>
    );
}
