import { create } from 'zustand';
import type { ChatConversation, ChatMessage } from '@claudin/shared';

interface ConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
}

interface AppState {
  // UI State
  activeView: 'chat' | 'crm' | 'posts';
  setActiveView: (view: 'chat' | 'crm' | 'posts') => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Conversations
  conversations: ConversationWithMessages[];
  activeConversationId: string | null;
  setConversations: (conversations: ConversationWithMessages[]) => void;
  setActiveConversation: (id: string | null) => void;
  addConversation: (conversation: ConversationWithMessages) => void;
  updateConversation: (id: string, updates: Partial<ConversationWithMessages>) => void;

  // Messages in active conversation
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;

  // Streaming state
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamingMessageId: string | null;
  setStreamingMessageId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // UI State
  activeView: 'crm',
  setActiveView: (view) => set({ activeView: view }),
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
  
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  // Conversations
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addConversation: (conversation) =>
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: conversation.id,
    })),
  updateConversation: (id, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  // Messages
  addMessage: (conversationId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], messageCount: c.messageCount + 1 }
          : c
      ),
    })),
  updateMessage: (conversationId, messageId, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
            }
          : c
      ),
    })),

  // Streaming
  isStreaming: false,
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  streamingMessageId: null,
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
}));

// Selectors
export const useActiveConversation = () => {
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeConversationId);
  return conversations.find((c) => c.id === activeId);
};

export const useActiveMessages = () => {
  const conversation = useActiveConversation();
  return conversation?.messages ?? [];
};
