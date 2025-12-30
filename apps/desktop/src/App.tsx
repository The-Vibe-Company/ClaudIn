import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { CRMView } from './components/CRMView';
import { PostsView } from './components/PostsView';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { useAppStore } from './store/app';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, activeView } = useAppStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Check server health on mount
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('http://localhost:3847/api/stats');
        if (!res.ok) throw new Error('Server not ready');
      } catch {
        console.log('Server not ready, will retry...');
      }
    };
    checkServer();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {activeView === 'chat' && <ChatView />}
        {activeView === 'crm' && <CRMView />}
        {activeView === 'posts' && <PostsView />}
      </main>

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      <SettingsModal />
    </div>
  );
}
