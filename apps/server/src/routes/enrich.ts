import { Hono } from 'hono';
import { getDb } from '../db/index.js';

export const enrichRouter = new Hono();

enrichRouter.post('/queue', async (c) => {
  const { publicIdentifier } = await c.req.json() as { publicIdentifier: string };
  
  if (!publicIdentifier) {
    return c.json({ error: 'publicIdentifier required' }, 400);
  }
  
  const db = getDb();
  const url = `https://www.linkedin.com/in/${publicIdentifier}/`;
  
  try {
    db.prepare(`
      INSERT INTO enrichment_queue (public_identifier, url, status, queued_at)
      VALUES (?, ?, 'pending', datetime('now'))
      ON CONFLICT(public_identifier) DO UPDATE SET
        status = CASE WHEN status = 'completed' OR status = 'failed' THEN 'pending' ELSE status END,
        queued_at = datetime('now'),
        attempts = 0,
        error = NULL
    `).run(publicIdentifier, url);
    
    return c.json({ success: true, publicIdentifier, url });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

enrichRouter.post('/queue/bulk', async (c) => {
  const { identifiers } = await c.req.json() as { identifiers: string[] };
  
  if (!Array.isArray(identifiers)) {
    return c.json({ error: 'identifiers must be an array' }, 400);
  }
  
  const db = getDb();
  let queued = 0;
  
  const stmt = db.prepare(`
    INSERT INTO enrichment_queue (public_identifier, url, status, queued_at)
    VALUES (?, ?, 'pending', datetime('now'))
    ON CONFLICT(public_identifier) DO UPDATE SET
      status = CASE WHEN status = 'completed' OR status = 'failed' THEN 'pending' ELSE status END,
      queued_at = datetime('now'),
      attempts = 0,
      error = NULL
  `);
  
  for (const id of identifiers) {
    try {
      stmt.run(id, `https://www.linkedin.com/in/${id}/`);
      queued++;
    } catch {}
  }
  
  return c.json({ success: true, queued, total: identifiers.length });
});

enrichRouter.get('/next', (c) => {
  const db = getDb();
  
  const item = db.prepare(`
    SELECT * FROM enrichment_queue 
    WHERE status = 'pending' AND attempts < 3
    ORDER BY queued_at ASC
    LIMIT 1
  `).get() as { id: number; public_identifier: string; url: string; attempts: number } | undefined;
  
  if (!item) {
    return c.json({ item: null });
  }
  
  db.prepare(`
    UPDATE enrichment_queue 
    SET status = 'processing', started_at = datetime('now'), attempts = attempts + 1
    WHERE id = ?
  `).run(item.id);
  
  return c.json({ 
    item: {
      id: item.id,
      publicIdentifier: item.public_identifier,
      url: item.url,
    }
  });
});

enrichRouter.post('/complete', async (c) => {
  const { publicIdentifier, success, error } = await c.req.json() as { 
    publicIdentifier: string; 
    success: boolean;
    error?: string;
  };
  
  const db = getDb();
  
  if (success) {
    db.prepare(`
      UPDATE enrichment_queue 
      SET status = 'completed', completed_at = datetime('now'), error = NULL
      WHERE public_identifier = ?
    `).run(publicIdentifier);
    
    db.prepare(`
      UPDATE profiles SET is_partial = 0 WHERE public_identifier = ?
    `).run(publicIdentifier);
  } else {
    db.prepare(`
      UPDATE enrichment_queue 
      SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
          error = ?
      WHERE public_identifier = ?
    `).run(error || 'Unknown error', publicIdentifier);
  }
  
  return c.json({ success: true });
});

enrichRouter.get('/status', (c) => {
  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM enrichment_queue
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>;
  
  const pending = stats.find(s => s.status === 'pending')?.count || 0;
  const processing = stats.find(s => s.status === 'processing')?.count || 0;
  const completed = stats.find(s => s.status === 'completed')?.count || 0;
  const failed = stats.find(s => s.status === 'failed')?.count || 0;
  
  return c.json({ pending, processing, completed, failed, total: pending + processing + completed + failed });
});

enrichRouter.delete('/queue', (c) => {
  const db = getDb();
  db.prepare(`DELETE FROM enrichment_queue WHERE status IN ('completed', 'failed')`).run();
  return c.json({ success: true });
});

enrichRouter.get('/queue/list', (c) => {
  const db = getDb();
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  
  let query = `
    SELECT 
      eq.id,
      eq.public_identifier,
      eq.url,
      eq.status,
      eq.queued_at,
      eq.started_at,
      eq.completed_at,
      eq.attempts,
      eq.error,
      p.full_name,
      p.headline,
      p.profile_picture_url
    FROM enrichment_queue eq
    LEFT JOIN profiles p ON eq.public_identifier = p.public_identifier
  `;
  
  const params: (string | number)[] = [];
  
  if (status) {
    query += ` WHERE eq.status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY eq.queued_at DESC LIMIT ?`;
  params.push(limit);
  
  const items = db.prepare(query).all(...params) as Array<{
    id: number;
    public_identifier: string;
    url: string;
    status: string;
    queued_at: string;
    started_at: string | null;
    completed_at: string | null;
    attempts: number;
    error: string | null;
    full_name: string | null;
    headline: string | null;
    profile_picture_url: string | null;
  }>;
  
  return c.json({
    items: items.map(item => ({
      id: item.id,
      publicIdentifier: item.public_identifier,
      url: item.url,
      status: item.status,
      queuedAt: item.queued_at,
      startedAt: item.started_at,
      completedAt: item.completed_at,
      attempts: item.attempts,
      error: item.error,
      profile: item.full_name ? {
        fullName: item.full_name,
        headline: item.headline,
        profilePictureUrl: item.profile_picture_url,
      } : null,
    })),
  });
});
