const API_BASE = 'http://localhost:3847/api';

export interface SendMessageCallbacks {
  onText: (text: string) => void;
  onToolStart?: (name: string, input: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
}

export async function fetchConversations() {
  const res = await fetch(`${API_BASE}/chat/conversations`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function fetchConversation(id: string) {
  const res = await fetch(`${API_BASE}/chat/conversations/${id}`);
  if (!res.ok) throw new Error('Failed to fetch conversation');
  return res.json();
}

export async function createConversation(title?: string) {
  const res = await fetch(`${API_BASE}/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

export async function sendMessage(
  conversationId: string,
  message: string,
  callbacks: SendMessageCallbacks
) {
  const res = await fetch(
    `${API_BASE}/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.ok) {
    callbacks.onError('Failed to send message');
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const event = line.slice(7);
        const dataLine = lines[lines.indexOf(line) + 1];
        if (dataLine?.startsWith('data: ')) {
          const data = JSON.parse(dataLine.slice(6));
          
          switch (event) {
            case 'text':
              callbacks.onText(data.text);
              break;
            case 'tool_start':
              callbacks.onToolStart?.(data.name, data.input);
              break;
            case 'tool_result':
              callbacks.onToolResult?.(data.name, data.result);
              break;
            case 'done':
              callbacks.onDone(data.messageId);
              break;
            case 'error':
              callbacks.onError(data.error);
              break;
          }
        }
      }
    }
  }
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function searchProfiles(query: string, filters?: Record<string, unknown>) {
  const params = new URLSearchParams({ q: query });
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
  }
  const res = await fetch(`${API_BASE}/profiles/search?${params}`);
  if (!res.ok) throw new Error('Failed to search profiles');
  return res.json();
}

export async function fetchSettingsStatus(): Promise<{ configured: boolean; hasApiKey: boolean }> {
  const res = await fetch(`${API_BASE}/settings/status`);
  if (!res.ok) throw new Error('Failed to fetch settings status');
  return res.json();
}

export async function updateSettings(settings: { openrouter_api_key?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
}

export interface CRMProfile {
  id: string;
  publicIdentifier: string;
  fullName: string;
  headline: string;
  currentCompany: string;
  currentTitle: string;
  profilePictureUrl: string | null;
  location: string;
  isPartial: boolean;
  lastMessage: { content: string; at: string; direction: 'sent' | 'received' } | null;
  lastPost: { content: string; at: string } | null;
}

export interface CRMResponse {
  profiles: CRMProfile[];
  total: number;
  hasMore: boolean;
}

export async function fetchCRMProfiles(params: { search?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  const res = await fetch(`${API_BASE}/profiles/crm/list?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch CRM profiles');
  return res.json() as Promise<CRMResponse>;
}

export interface Post {
  id: string;
  authorPublicIdentifier: string;
  authorName: string;
  authorHeadline: string;
  authorProfilePictureUrl: string | null;
  content: string;
  postUrl: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  hasImage: boolean;
  hasVideo: boolean;
  hasDocument: boolean;
  imageUrls: string[];
  postedAt: string;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  hasMore: boolean;
}

export async function fetchPosts(params: { search?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  const res = await fetch(`${API_BASE}/profiles/posts/list?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json() as Promise<PostsResponse>;
}

export async function queueProfileEnrichment(publicIdentifier: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/enrich/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicIdentifier }),
  });
  if (!res.ok) throw new Error('Failed to queue enrichment');
  return res.json();
}

export async function queueBulkEnrichment(identifiers: string[]): Promise<{ queued: number }> {
  const res = await fetch(`${API_BASE}/enrich/queue/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
  });
  if (!res.ok) throw new Error('Failed to queue enrichment');
  return res.json();
}

export interface EnrichmentStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export async function fetchEnrichmentStatus(): Promise<EnrichmentStatus> {
  const res = await fetch(`${API_BASE}/enrich/status`);
  if (!res.ok) throw new Error('Failed to fetch enrichment status');
  return res.json();
}

export interface EnrichmentQueueItem {
  id: number;
  publicIdentifier: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  error: string | null;
  profile: {
    fullName: string;
    headline: string | null;
    profilePictureUrl: string | null;
  } | null;
}

export async function fetchEnrichmentQueue(status?: string, limit?: number): Promise<{ items: EnrichmentQueueItem[] }> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (limit) params.append('limit', String(limit));
  
  const res = await fetch(`${API_BASE}/enrich/queue/list?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch enrichment queue');
  return res.json();
}

export async function clearEnrichmentQueue(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/enrich/queue`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear enrichment queue');
  return res.json();
}
