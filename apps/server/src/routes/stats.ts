/**
 * Stats API Routes
 */

import { Hono } from 'hono';
import { getDb } from '../db/index.js';

export const statsRouter = new Hono();

statsRouter.get('/', (c) => {
  const db = getDb();
  
  // Profile stats
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  const partialCount = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE is_partial = 1').get() as { count: number };
  
  // Top companies
  const topCompanies = db.prepare(`
    SELECT current_company as company, COUNT(*) as count 
    FROM profiles 
    WHERE current_company IS NOT NULL AND current_company != ''
    GROUP BY current_company 
    ORDER BY count DESC 
    LIMIT 10
  `).all() as { company: string; count: number }[];
  
  // Connection degrees
  const byDegree = db.prepare(`
    SELECT connection_degree as degree, COUNT(*) as count 
    FROM profiles 
    WHERE connection_degree IS NOT NULL
    GROUP BY connection_degree
  `).all() as { degree: number; count: number }[];
  
  // Recent activity
  const lastSync = db.prepare(`
    SELECT synced_at FROM sync_log ORDER BY synced_at DESC LIMIT 1
  `).get() as { synced_at: string } | undefined;
  
  const recentProfiles = db.prepare(`
    SELECT scraped_at FROM profiles ORDER BY scraped_at DESC LIMIT 1
  `).get() as { scraped_at: string } | undefined;
  
  // Chat stats
  const conversationCount = db.prepare('SELECT COUNT(*) as count FROM chat_conversations').get() as { count: number };
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number };
  
  return c.json({
    profiles: {
      total: profileCount.count,
      partial: partialCount.count,
      complete: profileCount.count - partialCount.count,
    },
    topCompanies,
    byConnectionDegree: byDegree,
    chat: {
      conversations: conversationCount.count,
      messages: messageCount.count,
    },
    lastSyncAt: lastSync?.synced_at || null,
    lastProfileAt: recentProfiles?.scraped_at || null,
  });
});
