import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { CRMView } from './components/CRMView';
import { PostsView } from './components/PostsView';
import { ProfileDetailView } from './components/ProfileDetailView';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { MCPModal } from './components/MCPModal';
import { SetupWizard } from './components/SetupWizard';
import { useAppStore } from './store/app';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, activeView } = useAppStore();
  const [showSetup, setShowSetup] = useState<boolean | null>(null);

  useKeyboardShortcuts();

  useEffect(() => {
    async function init() {
      try {
        const isComplete = await invoke<boolean>('is_setup_complete');
        setShowSetup(!isComplete);
      } catch {
        setShowSetup(false);
      }

      try {
        const res = await fetch('http://localhost:3847/api/stats');
        if (!res.ok) throw new Error('Server not ready');
      } catch {
        console.log('Server not ready, will retry...');
      }

      try {
        const update = await check();
        if (update?.available) {
          console.log('Update available:', update.version);
        }
      } catch (e) {
        console.log('Update check failed:', e);
      }
    }
    init();
  }, []);

  if (showSetup === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showSetup) {
    return <SetupWizard onComplete={() => setShowSetup(false)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {activeView === 'chat' && <ChatView />}
        {activeView === 'crm' && <CRMView />}
        {activeView === 'posts' && <PostsView />}
        {activeView === 'profile' && <ProfileDetailView />}
      </main>

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      <SettingsModal />
      <MCPModal />
    </div>
  );
}
