import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Settings, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/app';
import { fetchConversations } from '../lib/api';
import type { ChatConversation } from '@claudin/shared';

export function Sidebar() {
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversation,
    setSettingsOpen,
  } = useAppStore();

  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });

  useEffect(() => {
    if (data?.conversations) {
      setConversations(
        data.conversations.map((c: ChatConversation) => ({
          ...c,
          messages: [],
        }))
      );
    }
  }, [data, setConversations]);

  const handleNewChat = () => {
    setActiveConversation(null);
  };

  return (
    <aside className="w-64 bg-bg-secondary border-r border-border-subtle flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-border-subtle drag-region">
        <div className="flex items-center gap-2 no-drag">
          <Sparkles className="w-5 h-5 text-accent-primary" />
          <span className="font-semibold text-sm">ClaudIn</span>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary 
                     hover:bg-bg-elevated transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
          <span className="ml-auto text-text-muted text-xs kbd">⌘N</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden px-2">
        <AnimatePresence>
          {conversations.map((conversation) => (
            <motion.button
              key={conversation.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={() => setActiveConversation(conversation.id)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm
                transition-colors mb-1
                ${
                  activeConversationId === conversation.id
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }
              `}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1">
                {conversation.title || 'New Chat'}
              </span>
              <span className="text-text-muted text-xs">
                {conversation.messageCount || 0}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>

        {conversations.length === 0 && (
          <div className="text-center py-8 text-text-muted text-sm">
            No conversations yet
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border-subtle">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary
                     hover:bg-bg-tertiary hover:text-text-primary transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          Settings
          <span className="ml-auto text-text-muted text-xs kbd">⌘,</span>
        </button>
      </div>
    </aside>
  );
}
