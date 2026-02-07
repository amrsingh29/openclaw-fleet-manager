import { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Layout } from './components/Layout';
import { NewMissionModal } from './components/NewMissionModal';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { Activity, MessageSquare, Users, Settings } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AnimatePresence } from 'framer-motion';

import { WarRoom } from './components/WarRoom';
import { TeamView } from './components/TeamView';
import { EditAgentModal } from './components/EditAgentModal';
import { CommandCenter } from './components/CommandCenter';

function AppContent() {
  const createMission = useMutation(api.tasks.create);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingAgent, setEditingAgent] = useState<any>(null);
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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`flex h-screen overflow-hidden text-sm ${theme === 'dark' ? 'bg-[#0d1117] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>

      {/* Sidebar */}
      <Layout
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onTeamSelect={(teamId) => {
          setCurrentTeamId(teamId);
          setCurrentView('team');
        }}
      >
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                ${currentView === 'dashboard'
                ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600')
                : 'hover:bg-white/5 opacity-70 hover:opacity-100'}
                 ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
            title={isSidebarCollapsed ? "Dashboard" : undefined}
          >
            <Activity className="w-4 h-4 flex-none" />
            {!isSidebarCollapsed && <span className="font-medium">Dashboard</span>}
          </button>

          <button
            onClick={() => setCurrentView('warroom')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                ${currentView === 'warroom'
                ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-50 text-blue-600')
                : 'hover:bg-white/5 opacity-70 hover:opacity-100'}
                ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
            title={isSidebarCollapsed ? "War Room" : undefined}
          >
            <MessageSquare className="w-4 h-4 flex-none" />
            {!isSidebarCollapsed && <span className="font-medium">War Room</span>}
          </button>

          <button
            className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left opacity-70 hover:opacity-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? "Agents" : undefined}
          >
            <Users className="w-4 h-4 flex-none" />
            {!isSidebarCollapsed && <span className="font-medium">Agents</span>}
          </button>
          <button
            className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left opacity-70 hover:opacity-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? "Settings" : undefined}
          >
            <Settings className="w-4 h-4 flex-none" />
            {!isSidebarCollapsed && <span className="font-medium">Settings</span>}
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
            <TeamView
              teamId={currentTeamId}
              onTaskClick={setSelectedTask}
              onEditAgent={setEditingAgent} // Pass this down so team view can trigger edit
            />
          </div>
        ) : (
          <CommandCenter
            onTaskClick={setSelectedTask}
            onNewMission={() => setIsModalOpen(true)}
          />
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

        {/* Edit Agent Modal */}
        <EditAgentModal
          isOpen={!!editingAgent}
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
        />
      </div>
    </div >
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
