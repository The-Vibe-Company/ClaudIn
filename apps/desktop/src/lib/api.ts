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
