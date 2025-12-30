import { Hono } from 'hono';
import { getSetting, setSetting } from '../db/index.js';

export const settingsRouter = new Hono();

const SETTINGS_KEYS = ['openrouter_api_key'] as const;
type SettingKey = typeof SETTINGS_KEYS[number];

settingsRouter.get('/', (c) => {
  const settings: Record<string, string | null> = {};
  
  for (const key of SETTINGS_KEYS) {
    const value = getSetting(key);
    settings[key] = key.includes('api_key') && value 
      ? maskApiKey(value)
      : value;
  }
  
  return c.json({ settings });
});

settingsRouter.get('/status', (c) => {
  const apiKey = getSetting('openrouter_api_key');
  return c.json({ 
    configured: !!apiKey,
    hasApiKey: !!apiKey,
  });
});

settingsRouter.put('/', async (c) => {
  const body = await c.req.json() as Record<string, string>;
  
  for (const [key, value] of Object.entries(body)) {
    if (SETTINGS_KEYS.includes(key as SettingKey)) {
      setSetting(key, value);
    }
  }
  
  return c.json({ success: true });
});

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
