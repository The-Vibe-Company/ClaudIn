import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function useKeyboardShortcuts() {
  const { toggleCommandPalette, setActiveConversation, setSettingsOpen, conversations } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+K - Command palette
      if (isMod && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }

      // Cmd+N - New conversation
      if (isMod && e.key === 'n') {
        e.preventDefault();
        setActiveConversation(null);
      }

      // Cmd+, - Settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }

      // Cmd+[ / ] - Navigate conversations
      if (isMod && e.key === '[') {
        e.preventDefault();
        navigateConversations(-1);
      }
      if (isMod && e.key === ']') {
        e.preventDefault();
        navigateConversations(1);
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        // Let cmdk handle its own escape
      }
    };

    const navigateConversations = (direction: number) => {
      const { activeConversationId, conversations, setActiveConversation } =
        useAppStore.getState();

      if (conversations.length === 0) return;

      const currentIndex = conversations.findIndex(
        (c) => c.id === activeConversationId
      );
      const newIndex = Math.max(
        0,
        Math.min(conversations.length - 1, currentIndex + direction)
      );
      setActiveConversation(conversations[newIndex].id);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette, setActiveConversation, setSettingsOpen, conversations]);
}
