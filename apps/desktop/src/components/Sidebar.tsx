import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  Sparkles, 
  Users, 
  Newspaper, 
  ChevronDown, 
  ChevronRight,
  Activity
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { fetchConversations, fetchStats } from '../lib/api';
import type { ChatConversation } from '@claudin/shared';

export function Sidebar() {
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversation,
    setSettingsOpen,
    activeView,
    setActiveView,
  } = useAppStore();

  const [isChatsExpanded, setIsChatsExpanded] = useState(true);

  const { data: conversationData } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });

  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (conversationData?.conversations) {
      setConversations(
        conversationData.conversations.map((c: ChatConversation) => ({
          ...c,
          messages: [],
        }))
      );
    }
  }, [conversationData, setConversations]);

  const handleNewChat = () => {
    setActiveConversation(null);
    setActiveView('chat');
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setActiveView('chat');
  };

  return (
    <aside className="w-64 bg-bg-secondary border-r border-border-subtle flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-border-subtle drag-region">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-accent-primary/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-text-primary to-text-secondary">
            ClaudIn
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden py-4 px-3 space-y-6">
        <div className="space-y-1">
          <button
            onClick={() => setActiveView('crm')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${activeView === 'crm'
                ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }
            `}
          >
            <Users className={`w-4 h-4 ${activeView === 'crm' ? 'text-accent-primary' : 'text-text-muted'}`} />
            Network CRM
          </button>

          <button
            onClick={() => setActiveView('posts')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${activeView === 'posts'
                ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }
            `}
          >
            <Newspaper className={`w-4 h-4 ${activeView === 'posts' ? 'text-accent-primary' : 'text-text-muted'}`} />
            Posts Feed
          </button>
        </div>

        <div className="bg-bg-tertiary/50 rounded-xl p-4 border border-border-subtle">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
            <Activity className="w-3 h-3" />
            Overview
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg-primary rounded-lg p-2 border border-border-subtle">
              <div className="text-xl font-bold text-text-primary">
                {statsData?.profiles?.total ?? 0}
              </div>
              <div className="text-[10px] text-text-muted font-medium">Profiles</div>
            </div>
            <div className="bg-bg-primary rounded-lg p-2 border border-border-subtle">
              <div className="text-xl font-bold text-text-primary">
                {statsData?.chat?.messages ?? 0}
              </div>
              <div className="text-[10px] text-text-muted font-medium">Messages</div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => setIsChatsExpanded(!isChatsExpanded)}
            className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-3 h-3" />
              Assistant
            </span>
            {isChatsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <AnimatePresence initial={false}>
            {isChatsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-1 pt-1"
              >
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors group"
                >
                  <div className="w-6 h-6 rounded-md bg-bg-tertiary group-hover:bg-bg-elevated flex items-center justify-center border border-border-subtle transition-colors">
                    <Plus className="w-3 h-3" />
                  </div>
                  New Conversation
                </button>

                <div className="mt-2 space-y-0.5">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors
                        ${activeView === 'chat' && activeConversationId === conversation.id
                          ? 'bg-bg-elevated text-text-primary border border-border-subtle/50'
                          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                        }
                      `}
                    >
                      <span className="truncate flex-1 text-xs">
                        {conversation.title || 'New Chat'}
                      </span>
                      {activeView === 'chat' && activeConversationId === conversation.id && (
                        <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                      )}
                    </button>
                  ))}
                  
                  {conversations.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-text-muted">No history yet</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 border-t border-border-subtle">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary 
                     hover:bg-bg-tertiary hover:text-text-primary transition-all text-sm group"
        >
          <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
          Settings
        </button>
      </div>
    </aside>
  );
}
