import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className={`flex h-screen overflow-hidden font-sans selection:bg-cyan-500/30 transition-colors duration-300
            ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-900'}
        `}>
            {/* Background Gradient Mesh (Subtler in Light Mode) */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
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
                className={`w-20 md:w-64 z-10 border-r flex flex-col p-4 backdrop-blur-xl transition-colors duration-300
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

                <nav className="space-y-2 flex-1">
                    {['Dashboard', 'Agents', 'Tasks', 'Settings'].map((item) => (
                        <button key={item} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium group
                            ${theme === 'dark'
                                ? 'text-slate-300 hover:text-white hover:bg-white/10'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}
                        `}>
                            <div className={`w-5 h-5 rounded transition-colors
                                ${theme === 'dark'
                                    ? 'bg-white/20 group-hover:bg-cyan-500/50'
                                    : 'bg-slate-300 group-hover:bg-blue-500/50'}
                            `} />
                            <span className="hidden md:block">{item}</span>
                        </button>
                    ))}
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

            {/* Main Content */}
            <main className="flex-1 z-10 overflow-auto relative">
                <header className={`h-16 border-b flex items-center justify-between px-6 backdrop-blur-sm sticky top-0 transition-colors duration-300
                    ${theme === 'dark'
                        ? 'border-white/5 bg-[#0f172a]/80'
                        : 'border-slate-200 bg-white/80'}
                `}>
                    <h2 className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Overview
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-medium text-green-500">System Nominal</span>
                        </div>
                    </div>
                </header>
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
