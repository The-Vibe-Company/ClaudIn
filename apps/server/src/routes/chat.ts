/**
 * Chat API Routes
 * Handles AI chat with OpenRouter/Claude
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getDb, generateId } from '../db/index.js';

import { runAgent } from '../agents/linkedin-agent.js';
import type { ChatMessage, ChatConversation } from '@claudin/shared';

export const chatRouter = new Hono();

// Get conversations
chatRouter.get('/conversations', (c) => {
  const db = getDb();
  
  const conversations = db.prepare(`
    SELECT 
      c.*,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as last_message_at
    FROM chat_conversations c
    LEFT JOIN chat_messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY last_message_at DESC
  `).all() as (ChatConversation & { message_count: number; last_message_at: string })[];
  
  return c.json({ conversations });
});

// Get single conversation with messages
chatRouter.get('/conversations/:id', (c) => {
  const id = c.req.param('id');
  const db = getDb();
  
  const conversation = db.prepare(
    'SELECT * FROM chat_conversations WHERE id = ?'
  ).get(id) as ChatConversation | undefined;
  
  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404);
  }
  
  const messages = db.prepare(`
    SELECT * FROM chat_messages 
    WHERE conversation_id = ? 
    ORDER BY created_at ASC
  `).all(id) as DbChatMessage[];
  
  return c.json({
    conversation,
    messages: messages.map(dbToMessage),
  });
});

// Create new conversation
chatRouter.post('/conversations', async (c) => {
  const { title } = await c.req.json();
  const db = getDb();

  const id = generateId('conv');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO chat_conversations (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, title || null, now, now);

  return c.json({
    conversation: { id, title, createdAt: now, updatedAt: now },
  });
});

// Update conversation (rename)
chatRouter.patch('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const { title } = await c.req.json();
  const db = getDb();

  const conversation = db.prepare(
    'SELECT * FROM chat_conversations WHERE id = ?'
  ).get(id);

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?
  `).run(title, now, id);

  return c.json({ success: true, title });
});

// Delete conversation
chatRouter.delete('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const conversation = db.prepare(
    'SELECT * FROM chat_conversations WHERE id = ?'
  ).get(id);

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  // Delete messages first (foreign key constraint)
  db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(id);
  // Delete conversation
  db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(id);

  return c.json({ success: true });
});

// Send message (streaming response)
chatRouter.post('/conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id');
  const { message } = await c.req.json();
  const db = getDb();
  
  // Verify conversation exists or create it
  let conversation = db.prepare(
    'SELECT * FROM chat_conversations WHERE id = ?'
  ).get(conversationId) as ChatConversation | undefined;
  
  if (!conversation) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO chat_conversations (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, null, now, now);
  }
  
  // Save user message
  const userMsgId = generateId('msg');
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO chat_messages (id, conversation_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userMsgId, conversationId, 'user', message, now);
  
  // Get conversation history
  const history = db.prepare(`
    SELECT * FROM chat_messages 
    WHERE conversation_id = ? 
    ORDER BY created_at ASC
  `).all(conversationId) as DbChatMessage[];
  
  // Run agent and stream response
  return streamSSE(c, async (stream) => {
    const assistantMsgId = generateId('msg');
    let fullResponse = '';
    const toolCalls: { name: string; input: unknown; output: unknown }[] = [];
    const referencedProfiles: string[] = [];
    
    try {
      await runAgent({
        message,
        history: history.map(dbToMessage),
        onText: async (text) => {
          fullResponse += text;
          await stream.writeSSE({
            event: 'text',
            data: JSON.stringify({ text }),
          });
        },
        onToolStart: async (name, input) => {
          await stream.writeSSE({
            event: 'tool_start',
            data: JSON.stringify({ name, input }),
          });
        },
        onToolResult: async (name, result) => {
          toolCalls.push({ name, input: {}, output: result });
          
          // Track referenced profiles
          if (result && typeof result === 'object' && 'profiles' in result) {
            const profiles = (result as { profiles: { id: string }[] }).profiles;
            profiles.forEach(p => referencedProfiles.push(p.id));
          }
          
          await stream.writeSSE({
            event: 'tool_result',
            data: JSON.stringify({ name, result }),
          });
        },
      });
      
      // Save assistant message
      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, role, content, tool_calls, referenced_profiles, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        assistantMsgId,
        conversationId,
        'assistant',
        fullResponse,
        toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
        referencedProfiles.length > 0 ? JSON.stringify(referencedProfiles) : null,
        new Date().toISOString()
      );
      
      // Update conversation
      db.prepare(`
        UPDATE chat_conversations SET updated_at = ? WHERE id = ?
      `).run(new Date().toISOString(), conversationId);
      
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ messageId: assistantMsgId }),
      });
      
    } catch (error) {
      console.error('Agent error:', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: String(error) }),
      });
    }
  });
});

// Types
interface DbChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  tool_calls: string | null;
  referenced_profiles: string | null;
  created_at: string;
}

function dbToMessage(row: DbChatMessage): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    model: row.model || undefined,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
    referencedProfiles: row.referenced_profiles ? JSON.parse(row.referenced_profiles) : undefined,
  };
}
