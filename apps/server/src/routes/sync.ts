/**
 * Sync API Routes
 * Handles data sync from Chrome extension
 */

import { Hono } from 'hono';
import { getDb } from '../db/index.js';
import { upsertProfile } from '../db/profiles.js';
import type { LinkedInProfile, LinkedInMessage, LinkedInPost } from '@claudin/shared';

function deduplicateText(text: string | null | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  const len = trimmed.length;
  if (len < 2 || len % 2 !== 0) return trimmed;
  
  const half = len / 2;
  const first = trimmed.slice(0, half);
  const second = trimmed.slice(half);
  
  if (first === second) return first;
  return trimmed;
}

export const syncRouter = new Hono();

// Receive profiles from extension
syncRouter.post('/profiles', async (c) => {
  const { profiles } = await c.req.json() as { profiles: Partial<LinkedInProfile>[] };
  
  if (!Array.isArray(profiles)) {
    return c.json({ error: 'profiles must be an array' }, 400);
  }
  
  let saved = 0;
  for (const profile of profiles) {
    const result = upsertProfile(profile);
    if (result) saved++;
  }
  
  // Log sync
  const db = getDb();
  db.prepare(`
    INSERT INTO sync_log (type, count, synced_at)
    VALUES (?, ?, ?)
  `).run('profiles', saved, new Date().toISOString());
  
  return c.json({
    success: true,
    saved,
    total: profiles.length,
  });
});

// Get sync status
syncRouter.get('/status', (c) => {
  const db = getDb();
  
  const lastSync = db.prepare(`
    SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 1
  `).get() as { type: string; count: number; synced_at: string } | undefined;
  
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  
  return c.json({
    lastSync: lastSync || null,
    totalProfiles: profileCount.count,
  });
});

// Full sync endpoint (extension sends all data)
syncRouter.post('/full', async (c) => {
  const { profiles } = await c.req.json() as { profiles: Partial<LinkedInProfile>[] };
  
  if (!Array.isArray(profiles)) {
    return c.json({ error: 'profiles must be an array' }, 400);
  }
  
  let saved = 0;
  let updated = 0;
  
  const db = getDb();
  
  for (const profile of profiles) {
    const existing = db.prepare(
      'SELECT id FROM profiles WHERE public_identifier = ?'
    ).get(profile.publicIdentifier);
    
    const result = upsertProfile(profile);
    if (result) {
      if (existing) updated++;
      else saved++;
    }
  }
  
  db.prepare(`
    INSERT INTO sync_log (type, count, synced_at)
    VALUES (?, ?, ?)
  `).run('full', saved + updated, new Date().toISOString());
  
  return c.json({
    success: true,
    new: saved,
    updated,
    total: profiles.length,
  });
});

syncRouter.post('/messages', async (c) => {
  const { messages } = await c.req.json() as { messages: LinkedInMessage[] };
  
  if (!Array.isArray(messages)) {
    return c.json({ error: 'messages must be an array' }, 400);
  }
  
  const db = getDb();
  let saved = 0;
  let profilesCreated = 0;
  
  for (const msg of messages) {
    if (msg.profileId) {
      const existing = db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(msg.profileId);
      if (!existing) {
        upsertProfile({
          publicIdentifier: msg.profileId,
          linkedinUrl: `https://www.linkedin.com/in/${msg.profileId}`,
          firstName: '',
          lastName: '',
          fullName: msg.profileId,
          headline: '',
          scrapedAt: new Date().toISOString(),
          isPartial: true,
        });
        profilesCreated++;
      }
    }
    
    try {
      const profileRow = msg.profileId 
        ? db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(msg.profileId) as { id: string } | undefined
        : undefined;
      
      db.prepare(`
        INSERT INTO messages (id, conversation_id, profile_id, direction, content, sent_at, is_read, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          is_read = excluded.is_read,
          scraped_at = excluded.scraped_at
      `).run(
        msg.id,
        msg.conversationId,
        profileRow?.id || msg.profileId,
        msg.direction,
        msg.content,
        msg.sentAt,
        msg.isRead ? 1 : 0,
        msg.scrapedAt
      );
      saved++;
    } catch (e) {
      console.error('Failed to save message:', e);
    }
  }
  
  db.prepare(`
    INSERT INTO sync_log (type, count, synced_at)
    VALUES (?, ?, ?)
  `).run('messages', saved, new Date().toISOString());
  
  return c.json({ success: true, saved, total: messages.length, profilesCreated });
});

syncRouter.post('/posts', async (c) => {
  const { posts } = await c.req.json() as { posts: LinkedInPost[] };
  
  if (!Array.isArray(posts)) {
    return c.json({ error: 'posts must be an array' }, 400);
  }
  
  const db = getDb();
  let saved = 0;
  let profilesCreated = 0;
  
  for (const post of posts) {
    const cleanName = deduplicateText(post.authorName);
    const cleanHeadline = deduplicateText(post.authorHeadline);
    
    if (post.authorPublicIdentifier) {
      const existing = db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(post.authorPublicIdentifier);
      if (!existing) {
        upsertProfile({
          publicIdentifier: post.authorPublicIdentifier,
          linkedinUrl: `https://www.linkedin.com/in/${post.authorPublicIdentifier}`,
          firstName: cleanName.split(' ')[0] || '',
          lastName: cleanName.split(' ').slice(1).join(' ') || '',
          fullName: cleanName || post.authorPublicIdentifier,
          headline: cleanHeadline,
          profilePictureUrl: post.authorProfilePictureUrl,
          scrapedAt: new Date().toISOString(),
          isPartial: true,
        });
        profilesCreated++;
      }
    }
    
    try {
      const profileRow = post.authorPublicIdentifier 
        ? db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(post.authorPublicIdentifier) as { id: string } | undefined
        : undefined;
      
      db.prepare(`
        INSERT INTO posts (id, author_profile_id, author_public_identifier, author_name, author_headline, 
          author_profile_picture_url, content, post_url, likes_count, comments_count, reposts_count,
          has_image, has_video, has_document, image_urls, posted_at, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          author_name = excluded.author_name,
          author_headline = excluded.author_headline,
          content = excluded.content,
          likes_count = excluded.likes_count,
          comments_count = excluded.comments_count,
          reposts_count = excluded.reposts_count,
          scraped_at = excluded.scraped_at
      `).run(
        post.id,
        profileRow?.id || null,
        post.authorPublicIdentifier,
        cleanName,
        cleanHeadline,
        post.authorProfilePictureUrl,
        post.content,
        post.postUrl,
        post.likesCount,
        post.commentsCount,
        post.repostsCount,
        post.hasImage ? 1 : 0,
        post.hasVideo ? 1 : 0,
        post.hasDocument ? 1 : 0,
        JSON.stringify(post.imageUrls),
        post.postedAt,
        post.scrapedAt
      );
      saved++;
    } catch (e) {
      console.error('Failed to save post:', e);
    }
  }
  
  db.prepare(`
    INSERT INTO sync_log (type, count, synced_at)
    VALUES (?, ?, ?)
  `).run('posts', saved, new Date().toISOString());
  
  return c.json({ success: true, saved, total: posts.length, profilesCreated });
});
