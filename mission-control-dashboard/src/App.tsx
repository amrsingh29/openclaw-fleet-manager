import { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Layout } from './components/Layout';
import { AgentCard } from './components/AgentCard';
import { ActivityFeed } from './components/ActivityFeed';
import { TaskBoard } from './components/TaskBoard';
import { NewMissionModal } from './components/NewMissionModal';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { Plus, Activity, MessageSquare, Users, Settings } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AnimatePresence } from 'framer-motion';

import { WarRoom } from './components/WarRoom';
import { TeamView } from './components/TeamView';

function AppContent() {
  const agents = useQuery(api.agents.list) || [];
  const tasks = useQuery(api.tasks.list) || [];
  const createMission = useMutation(api.tasks.create);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'warroom' | 'team'>('dashboard');
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const { theme } = useTheme();

  const handleCreateMission = async (title: string, description: string) => {
    await createMission({
      title,
      description,
      status: "inbox",
      priority: "high"
    });
  };

  return (
    <div className={`flex h-screen overflow-hidden text-sm ${theme === 'dark' ? 'bg-[#0d1117] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>

      {/* Sidebar */}
      <Layout onTeamSelect={(teamId) => {
        setCurrentTeamId(teamId);
        setCurrentView('team');
      }}>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                ${currentView === 'dashboard'
                ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600')
                : 'hover:bg-white/5 opacity-70 hover:opacity-100'}
            `}
          >
            <Activity className="w-4 h-4" />
            <span className="font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentView('warroom')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                ${currentView === 'warroom'
                ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600')
                : 'hover:bg-white/5 opacity-70 hover:opacity-100'}
            `}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">War Room</span>
          </button>

          <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left opacity-70 hover:opacity-100">
            <Users className="w-4 h-4" />
            <span className="font-medium">Agents</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left opacity-70 hover:opacity-100">
            <Settings className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </Layout>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {/* Background Grid - Only visible in Dashboard perhaps, or global? Global is fine */}
        {theme === 'dark' && (
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        )}

        {/* View Switcher */}
        {currentView === 'warroom' ? (
          <WarRoom />
        ) : currentView === 'team' && currentTeamId ? (
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <TeamView teamId={currentTeamId} onTaskClick={setSelectedTask} />
          </div>
        ) : (
          <>
            {/* Header */}
            <header className={`h-14 border-b flex items-center justify-between px-6 flex-none z-10 backdrop-blur-md sticky top-0
                    ${theme === 'dark' ? 'border-white/5 bg-[#0d1117]/80' : 'border-slate-200 bg-white/80'}
                 `}>
              {/* ... (Existing Header Content: Title + New Mission Button) ... */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                  <span className="font-mono text-xs font-bold tracking-widest uppercase opacity-80">System Online</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Theme Toggle... */}
                {/* New Mission Button */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Mission
                </button>
              </div>
            </header>

            {/* Dashboard Grid */}
            <main className="flex-1 overflow-y-auto p-6 gap-6 grid grid-cols-12 min-h-0 relative z-0">

              {/* Activity Feed (Left) */}
              <div className="col-span-3 flex flex-col min-h-0 h-[calc(100vh-8rem)] sticky top-0">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex-none">Live Intl</h3>
                <div className="flex-1 min-h-0 rounded-2xl border overflow-hidden relative group">
                  <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-black/50 pointer-events-none ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
                  <ActivityFeed />
                </div>
              </div>

              {/* Mission Queue (Center/Right) - Enhanced Width when Intel is closed? For now fixed */}
              <div className="col-span-9 flex flex-col min-w-0 space-y-6">
                <div className="flex-none">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Agents</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                    {agents.map((agent: any) => (
                      <AgentCard
                        key={agent._id}
                        name={agent.name}
                        role={agent.role}
                        status={agent.status}
                        lastHeartbeat={agent.lastHeartbeat || Date.now()}
                      />
                    ))}
                    {agents.length === 0 && (
                      <div className="text-xs opacity-50 italic py-2">No agents online. Run agent-runner script.</div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex-none">Mission Queue</h3>
                  <div className="flex-1 min-h-[500px] overflow-x-auto overflow-y-hidden">
                    <TaskBoard tasks={tasks} onTaskClick={setSelectedTask} agents={agents} />
                  </div>
                </div>
              </div>
            </main>
          </>
        )}

        {/* Task Modal (Always available) */}
        <AnimatePresence>
          {isModalOpen && (
            <NewMissionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateMission} />
          )}
        </AnimatePresence>

        {/* Details Modal */}
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />

      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
