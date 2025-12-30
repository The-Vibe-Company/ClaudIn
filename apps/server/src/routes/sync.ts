/**
 * Sync API Routes
 * Handles data sync from Chrome extension
 */

import { Hono } from 'hono';
import { getDb, generateId } from '../db/index.js';
import { upsertProfile } from '../db/profiles.js';
import type { LinkedInProfile } from '@claudin/shared';

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
    // Check if exists
    const existing = db.prepare(
      'SELECT id FROM profiles WHERE public_identifier = ?'
    ).get(profile.publicIdentifier);
    
    const result = upsertProfile(profile);
    if (result) {
      if (existing) updated++;
      else saved++;
    }
  }
  
  // Log sync
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
