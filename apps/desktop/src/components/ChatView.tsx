import { useRef, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useAppStore, useActiveConversation, useActiveMessages } from '../store/app';
import { fetchConversation, createConversation, sendMessage } from '../lib/api';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '@claudin/shared';

export function ChatView() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    activeConversationId,
    addConversation,
    addMessage,
    updateMessage,
    isStreaming,
    setIsStreaming,
    setStreamingMessageId,
  } = useAppStore();

  const conversation = useActiveConversation();
  const messages = useActiveMessages();

  // Fetch full conversation when selected
  const { data: fullConversation } = useQuery({
    queryKey: ['conversation', activeConversationId],
    queryFn: () => fetchConversation(activeConversationId!),
    enabled: !!activeConversationId && (!conversation || conversation.messages.length === 0),
  });

  // Update messages when fetched
  useEffect(() => {
    if (fullConversation?.messages && activeConversationId) {
      const { updateConversation } = useAppStore.getState();
      updateConversation(activeConversationId, {
        messages: fullConversation.messages,
      });
    }
  }, [fullConversation, activeConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversationId]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput('');
    setIsStreaming(true);

    try {
      let convId: string;

      // Create new conversation if needed
      if (!activeConversationId) {
        const { conversation: newConv } = await createConversation();
        convId = newConv.id;
        addConversation({
          ...newConv,
          messageCount: 0,
          messages: [],
        });
      } else {
        convId = activeConversationId;
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversationId: convId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      addMessage(convId, userMessage);

      // Add placeholder for assistant message
      const assistantMsgId = `temp-assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        conversationId: convId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(convId, assistantMessage);
      setStreamingMessageId(assistantMsgId);

      // Stream response
      let accumulatedText = '';
      
      await sendMessage(convId, text, {
        onText: (chunk) => {
          accumulatedText += chunk;
          updateMessage(convId, assistantMsgId, { content: accumulatedText });
        },
        onToolStart: (name, toolInput) => {
          console.log('Tool started:', name, toolInput);
        },
        onToolResult: (name, result) => {
          console.log('Tool result:', name, result);
        },
        onDone: (messageId) => {
          updateMessage(convId, assistantMsgId, {
            id: messageId,
            isStreaming: false,
          });
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
        onError: (error) => {
          console.error('Stream error:', error);
          updateMessage(convId, assistantMsgId, {
            content: `Error: ${error}`,
            isStreaming: false,
          });
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  }, [input, isStreaming, activeConversationId, addConversation, addMessage, updateMessage, setIsStreaming, setStreamingMessageId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Empty state
  if (!activeConversationId && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-blue-400 
                          flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Chat with your network</h1>
          <p className="text-text-secondary mb-8">
            Ask questions about your LinkedIn connections, find the right people, 
            or draft messages to reconnect.
          </p>
          
          <div className="grid gap-3 text-left">
            {[
              'Who do I know at Google?',
              'Find product managers in SF',
              'Draft a reconnect message for John',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="px-4 py-3 rounded-lg bg-bg-secondary border border-border-subtle
                           hover:border-accent-primary/50 hover:bg-bg-tertiary transition-all
                           text-sm text-text-secondary hover:text-text-primary text-left"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Input at bottom of empty state */}
        <div className="w-full max-w-2xl mt-8">
          <ChatInput
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hidden">
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border-subtle p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isStreaming: boolean;
}

const ChatInput = ({
  ref,
  value,
  onChange,
  onSubmit,
  onKeyDown,
  isStreaming,
}: ChatInputProps & { ref: React.RefObject<HTMLTextAreaElement | null> }) => (
  <div className="relative">
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Ask about your network..."
      rows={1}
      disabled={isStreaming}
      className="w-full resize-none rounded-xl bg-bg-secondary border border-border-subtle
                 px-4 py-3 pr-12 text-sm placeholder:text-text-muted
                 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-transparent
                 disabled:opacity-50 disabled:cursor-not-allowed
                 min-h-[48px] max-h-[200px]"
      style={{
        height: 'auto',
        minHeight: '48px',
      }}
      onInput={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
      }}
    />
    <button
      onClick={onSubmit}
      disabled={!value.trim() || isStreaming}
      className="absolute right-2 bottom-2 p-2 rounded-lg bg-accent-primary text-white
                 hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isStreaming ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
    </button>
  </div>
);
