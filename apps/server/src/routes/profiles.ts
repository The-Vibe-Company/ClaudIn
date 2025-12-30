/**
 * Profiles API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { searchProfiles, getProfileById, getProfileByUrl, upsertProfile } from '../db/profiles.js';
import { getDb } from '../db/index.js';

export const profilesRouter = new Hono();

// Search profiles
const searchSchema = z.object({
  q: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
  limit: z.coerce.number().default(50),
  offset: z.coerce.number().default(0),
});

profilesRouter.get('/', zValidator('query', searchSchema), (c) => {
  const { q, company, title, location, limit, offset } = c.req.valid('query');
  
  const filters = {
    company: company || undefined,
    title: title || undefined,
    location: location || undefined,
  };

  const { profiles, total } = searchProfiles(q || '', filters, limit, offset);
  
  return c.json({
    profiles,
    total,
    hasMore: offset + profiles.length < total,
  });
});

// Get single profile
profilesRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  
  // Try by ID first, then by URL/identifier
  let profile = getProfileById(id);
  if (!profile) {
    profile = getProfileByUrl(id);
  }
  
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  
  return c.json({ profile, source: 'cache' });
});

// Upsert profile (used by sync)
profilesRouter.post('/', async (c) => {
  const body = await c.req.json();
  const profile = upsertProfile(body);
  
  if (!profile) {
    return c.json({ error: 'Failed to save profile' }, 400);
  }
  
  return c.json({ profile });
});

profilesRouter.post('/bulk', async (c) => {
  const { profiles } = await c.req.json();
  
  if (!Array.isArray(profiles)) {
    return c.json({ error: 'profiles must be an array' }, 400);
  }
  
  const saved = profiles.map(p => upsertProfile(p)).filter(Boolean);
  
  return c.json({ 
    saved: saved.length,
    total: profiles.length,
  });
});

profilesRouter.get('/crm/list', (c) => {
  const db = getDb();
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const search = c.req.query('search') || '';
  
  let whereClause = '';
  const params: (string | number)[] = [];
  
  if (search) {
    whereClause = `WHERE p.full_name LIKE ? OR p.current_company LIKE ? OR p.headline LIKE ?`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  
  const countResult = db.prepare(`SELECT COUNT(*) as count FROM profiles p ${whereClause}`).get(...params) as { count: number };
  
  const profiles = db.prepare(`
    SELECT 
      p.*,
      (SELECT content FROM messages m WHERE m.profile_id = p.id ORDER BY m.sent_at DESC LIMIT 1) as last_message_content,
      (SELECT sent_at FROM messages m WHERE m.profile_id = p.id ORDER BY m.sent_at DESC LIMIT 1) as last_message_at,
      (SELECT direction FROM messages m WHERE m.profile_id = p.id ORDER BY m.sent_at DESC LIMIT 1) as last_message_direction,
      (SELECT content FROM posts po WHERE po.author_public_identifier = p.public_identifier ORDER BY po.posted_at DESC LIMIT 1) as last_post_content,
      (SELECT posted_at FROM posts po WHERE po.author_public_identifier = p.public_identifier ORDER BY po.posted_at DESC LIMIT 1) as last_post_at
    FROM profiles p
    ${whereClause}
    ORDER BY 
      COALESCE(
        (SELECT sent_at FROM messages m WHERE m.profile_id = p.id ORDER BY m.sent_at DESC LIMIT 1),
        (SELECT posted_at FROM posts po WHERE po.author_public_identifier = p.public_identifier ORDER BY po.posted_at DESC LIMIT 1),
        p.scraped_at
      ) DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    id: string;
    public_identifier: string;
    full_name: string;
    headline: string;
    current_company: string;
    current_title: string;
    profile_picture_url: string;
    location: string;
    last_message_content: string | null;
    last_message_at: string | null;
    last_message_direction: string | null;
    last_post_content: string | null;
    last_post_at: string | null;
  }>;
  
  return c.json({
    profiles: profiles.map(p => ({
      id: p.id,
      publicIdentifier: p.public_identifier,
      fullName: p.full_name,
      headline: p.headline,
      currentCompany: p.current_company,
      currentTitle: p.current_title,
      profilePictureUrl: p.profile_picture_url,
      location: p.location,
      lastMessage: p.last_message_content ? {
        content: p.last_message_content,
        at: p.last_message_at,
        direction: p.last_message_direction
      } : null,
      lastPost: p.last_post_content ? {
        content: p.last_post_content,
        at: p.last_post_at
      } : null
    })),
    total: countResult.count,
    hasMore: offset + profiles.length < countResult.count
  });
});
