/**
 * ClaudIn Server
 * Local backend for the desktop app
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDatabase } from './db/index.js';
import { profilesRouter } from './routes/profiles.js';
import { chatRouter } from './routes/chat.js';
import { statsRouter } from './routes/stats.js';
import { syncRouter } from './routes/sync.js';
import { settingsRouter } from './routes/settings.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:1420', 'tauri://localhost'],
  credentials: true,
}));

// Health check
app.get('/', (c) => {
  return c.json({ 
    name: 'ClaudIn Server',
    version: '0.1.0',
    status: 'running',
  });
});

// API Routes
app.route('/api/profiles', profilesRouter);
app.route('/api/chat', chatRouter);
app.route('/api/stats', statsRouter);
app.route('/api/sync', syncRouter);
app.route('/api/settings', settingsRouter);

// Initialize database and start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3847;

async function main() {
  console.log('Initializing database...');
  initDatabase();
  
  console.log(`Starting server on port ${PORT}...`);
  serve({
    fetch: app.fetch,
    port: PORT,
  });
  
  console.log(`ClaudIn server running at http://localhost:${PORT}`);
}

main().catch(console.error);
