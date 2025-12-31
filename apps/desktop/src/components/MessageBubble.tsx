import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  User,
  Sparkles,
  Loader2,
  Wrench,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  UserCircle,
  BarChart3,
  MessageSquare,
  Users
} from 'lucide-react';
import type { ChatMessage, ToolCall } from '@claudin/shared';

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-blue-400 
                        flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Content */}
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${
            isUser
              ? 'bg-accent-primary text-white'
              : 'bg-bg-secondary border border-border-subtle'
          }
        `}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-invert prose-sm max-w-none">
            {message.content ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-bg-tertiary p-3 rounded-lg text-xs font-mono overflow-x-auto" {...props}>
                        {children}
                      </code>
                    );
                  },
                  a: ({ children, href }) => (
                    <a href={href} className="text-accent-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : isStreaming ? (
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            ) : null}

            {/* Streaming indicator */}
            {isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-text-primary animate-pulse-subtle ml-0.5" />
            )}
          </div>
        )}

        {/* Tool calls display */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallsDisplay toolCalls={message.toolCalls} />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-text-secondary" />
        </div>
      )}
    </motion.div>
  );
});

// Tool icon mapping
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  search_network: Search,
  get_profile: UserCircle,
  get_profile_details: UserCircle,
  get_profile_posts: MessageSquare,
  get_network_stats: BarChart3,
  find_people_at_company: Users,
  get_recent_posts: MessageSquare,
  get_messages_with: MessageSquare,
};

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToolCallsDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);

  // Check if any tool is still running
  const hasRunningTools = toolCalls.some((t) => t.status === 'running' || t.status === 'pending');

  return (
    <div className="mt-3 pt-3 border-t border-border-subtle">
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors w-full"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Wrench className="w-3 h-3" />
        <span className="font-medium">
          {hasRunningTools ? 'Using' : 'Used'} {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''}
        </span>
        {hasRunningTools && (
          <Loader2 className="w-3 h-3 animate-spin ml-auto" />
        )}
      </button>

      {/* Expanded tool list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {toolCalls.map((tool) => (
                <ToolCallItem key={tool.id} tool={tool} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact inline view when collapsed */}
      {!expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {toolCalls.map((tool) => {
            const Icon = TOOL_ICONS[tool.name] || Wrench;
            return (
              <div
                key={tool.id}
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium
                  ${tool.status === 'running' || tool.status === 'pending'
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : tool.status === 'success'
                    ? 'bg-green-500/10 text-green-500'
                    : tool.status === 'error'
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-bg-tertiary text-text-muted'}
                `}
              >
                {tool.status === 'running' || tool.status === 'pending' ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <Icon className="w-2.5 h-2.5" />
                )}
                {formatToolName(tool.name)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
  const [showDetails, setShowDetails] = useState(false);
  const Icon = TOOL_ICONS[tool.name] || Wrench;

  return (
    <div className="bg-bg-tertiary/50 rounded-lg p-2">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 w-full text-left"
      >
        {/* Status icon */}
        {tool.status === 'running' || tool.status === 'pending' ? (
          <Loader2 className="w-3.5 h-3.5 text-accent-primary animate-spin shrink-0" />
        ) : tool.status === 'success' ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
        ) : tool.status === 'error' ? (
          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        ) : (
          <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
        )}

        {/* Tool name */}
        <span className="text-xs font-medium text-text-secondary flex-1">
          {formatToolName(tool.name)}
        </span>

        {/* Expand indicator */}
        {(tool.input && Object.keys(tool.input).length > 0) && (
          <ChevronRight className={`w-3 h-3 text-text-muted transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        )}
      </button>

      {/* Tool input details */}
      <AnimatePresence>
        {showDetails && tool.input && Object.keys(tool.input).length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-5 text-[10px] text-text-muted font-mono space-y-0.5">
              {Object.entries(tool.input).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-text-secondary">{key}:</span>
                  <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {tool.status === 'error' && tool.error && (
        <div className="mt-1 pl-5 text-[10px] text-red-400">
          {tool.error}
        </div>
      )}
    </div>
  );
}
