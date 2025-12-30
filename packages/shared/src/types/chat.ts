/**
 * Chat & AI Types
 */

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  
  // Metadata
  createdAt: string;
  
  // Assistant-specific
  model?: string;
  toolCalls?: ToolCall[];
  referencedProfiles?: string[]; // Profile IDs
  
  // Streaming state (client-side only)
  isStreaming?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

/**
 * AI Agent Tools
 */

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'search_network',
    description: 'Search profiles in the local LinkedIn cache by name, title, company, or location',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        filters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            connectionDegree: { type: 'array', items: { type: 'number', enum: [1, 2, 3] } },
          },
        },
        limit: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_profile',
    description: 'Get detailed profile information. Will fetch from LinkedIn if not in cache.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Profile ID or LinkedIn URL' },
        forceRefresh: { type: 'boolean', default: false },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'get_network_stats',
    description: 'Get statistics about the synced network',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'draft_message',
    description: 'Draft a personalized message for a profile',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        intent: { type: 'string', description: 'Purpose of the message (reconnect, job inquiry, etc.)' },
        tone: { type: 'string', enum: ['casual', 'professional', 'warm'], default: 'professional' },
        context: { type: 'string', description: 'Additional context for the message' },
      },
      required: ['profileId', 'intent'],
    },
  },
  {
    name: 'find_similar_profiles',
    description: 'Find profiles similar to a given profile using semantic search',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
      required: ['profileId'],
    },
  },
];

/**
 * Config
 */

export interface LLMConfig {
  provider: 'openrouter';
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_LLM_CONFIG: Omit<LLMConfig, 'apiKey'> = {
  provider: 'openrouter',
  model: 'anthropic/claude-4.5-sonnet',
  baseUrl: 'https://openrouter.ai/api/v1',
  maxTokens: 4096,
  temperature: 0.7,
};
