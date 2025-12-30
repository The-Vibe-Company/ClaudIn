/**
 * Profiles API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { searchProfiles, getProfileById, getProfileByUrl, upsertProfile } from '../db/profiles.js';

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

// Bulk upsert profiles
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
