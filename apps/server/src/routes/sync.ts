/**
 * Sync API Routes
 * Handles data sync from Chrome extension
 */

import { Hono } from 'hono';
import { getDb, withTransaction } from '../db/index.js';
import { upsertProfile } from '../db/profiles.js';
import type { LinkedInProfile, LinkedInMessage, LinkedInPost } from '@claudin/shared';

interface SyncResult<T = string> {
  saved: number;
  failed: Array<{ id: T; error: string }>;
  syncedIds: T[];
}

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

syncRouter.post('/profiles', async (c) => {
  const { profiles } = await c.req.json() as { profiles: Partial<LinkedInProfile>[] };

  if (!Array.isArray(profiles)) {
    return c.json({ error: 'profiles must be an array' }, 400);
  }

  // Process all profiles within a transaction for atomicity
  const result = withTransaction((): SyncResult => {
    const syncResult: SyncResult = { saved: 0, failed: [], syncedIds: [] };

    for (const profile of profiles) {
      if (!profile.publicIdentifier) {
        syncResult.failed.push({ id: 'unknown', error: 'Missing publicIdentifier' });
        continue;
      }

      try {
        const saved = upsertProfile(profile);
        if (saved) {
          syncResult.saved++;
          syncResult.syncedIds.push(profile.publicIdentifier);
        }
      } catch (e) {
        syncResult.failed.push({
          id: profile.publicIdentifier,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Log sync operation
    const db = getDb();
    db.prepare(`
      INSERT INTO sync_log (type, count, synced_at)
      VALUES (?, ?, ?)
    `).run('profiles', syncResult.saved, new Date().toISOString());

    return syncResult;
  });

  return c.json({
    success: true,
    saved: result.saved,
    total: profiles.length,
    syncedIds: result.syncedIds,
    failed: result.failed.length > 0 ? result.failed : undefined,
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

  // Process all messages within a transaction for atomicity
  const result = withTransaction(() => {
    const db = getDb();
    const syncResult: SyncResult & { profilesCreated: number } = {
      saved: 0,
      failed: [],
      syncedIds: [],
      profilesCreated: 0,
    };

    for (const msg of messages) {
      // Create stub profile if needed
      if (msg.profileId) {
        const existing = db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(msg.profileId);
        if (!existing) {
          try {
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
            syncResult.profilesCreated++;
          } catch (e) {
            console.error(`Failed to create stub profile for ${msg.profileId}:`, e);
          }
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
        syncResult.saved++;
        syncResult.syncedIds.push(msg.id);
      } catch (e) {
        console.error('Failed to save message:', e);
        syncResult.failed.push({
          id: msg.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Log sync operation
    db.prepare(`
      INSERT INTO sync_log (type, count, synced_at)
      VALUES (?, ?, ?)
    `).run('messages', syncResult.saved, new Date().toISOString());

    return syncResult;
  });

  return c.json({
    success: true,
    saved: result.saved,
    total: messages.length,
    profilesCreated: result.profilesCreated,
    syncedIds: result.syncedIds,
    failed: result.failed.length > 0 ? result.failed : undefined,
  });
});

syncRouter.post('/posts', async (c) => {
  const { posts } = await c.req.json() as { posts: LinkedInPost[] };

  if (!Array.isArray(posts)) {
    return c.json({ error: 'posts must be an array' }, 400);
  }

  // Process all posts within a transaction for atomicity
  const result = withTransaction(() => {
    const db = getDb();
    const syncResult: SyncResult & { profilesCreated: number } = {
      saved: 0,
      failed: [],
      syncedIds: [],
      profilesCreated: 0,
    };

    for (const post of posts) {
      const cleanName = deduplicateText(post.authorName);
      const cleanHeadline = deduplicateText(post.authorHeadline);

      // Create stub profile if needed
      if (post.authorPublicIdentifier) {
        const existing = db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(post.authorPublicIdentifier);
        if (!existing) {
          try {
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
            syncResult.profilesCreated++;
          } catch (e) {
            console.error(`Failed to create stub profile for ${post.authorPublicIdentifier}:`, e);
          }
        }
      }

      try {
        const profileRow = post.authorPublicIdentifier
          ? db.prepare('SELECT id FROM profiles WHERE public_identifier = ?').get(post.authorPublicIdentifier) as { id: string } | undefined
          : undefined;

        db.prepare(`
          INSERT INTO posts (
            id, author_profile_id, author_public_identifier, author_name, author_headline,
            author_profile_picture_url, content, post_url, post_type,
            likes_count, comments_count, reposts_count,
            has_image, has_video, has_document, has_link, has_poll,
            image_urls, video_url, shared_link,
            is_repost, original_author_name, original_author_identifier,
            hashtags, mentions, posted_at, scraped_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            author_name = excluded.author_name,
            author_headline = excluded.author_headline,
            content = excluded.content,
            post_type = excluded.post_type,
            likes_count = excluded.likes_count,
            comments_count = excluded.comments_count,
            reposts_count = excluded.reposts_count,
            has_link = excluded.has_link,
            has_poll = excluded.has_poll,
            video_url = excluded.video_url,
            shared_link = excluded.shared_link,
            hashtags = excluded.hashtags,
            mentions = excluded.mentions,
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
          post.postType || 'text',
          post.likesCount,
          post.commentsCount,
          post.repostsCount,
          post.hasImage ? 1 : 0,
          post.hasVideo ? 1 : 0,
          post.hasDocument ? 1 : 0,
          post.hasLink ? 1 : 0,
          post.hasPoll ? 1 : 0,
          JSON.stringify(post.imageUrls || []),
          post.videoUrl || null,
          post.sharedLink ? JSON.stringify(post.sharedLink) : null,
          post.isRepost ? 1 : 0,
          post.originalAuthorName || null,
          post.originalAuthorIdentifier || null,
          JSON.stringify(post.hashtags || []),
          JSON.stringify(post.mentions || []),
          post.postedAt,
          post.scrapedAt
        );
        syncResult.saved++;
        syncResult.syncedIds.push(post.id);
      } catch (e) {
        console.error('Failed to save post:', e);
        syncResult.failed.push({
          id: post.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Log sync operation
    db.prepare(`
      INSERT INTO sync_log (type, count, synced_at)
      VALUES (?, ?, ?)
    `).run('posts', syncResult.saved, new Date().toISOString());

    return syncResult;
  });

  return c.json({
    success: true,
    saved: result.saved,
    total: posts.length,
    profilesCreated: result.profilesCreated,
    syncedIds: result.syncedIds,
    failed: result.failed.length > 0 ? result.failed : undefined,
  });
});
