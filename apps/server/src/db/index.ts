/**
 * Database Layer
 * SQLite with better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Store DB in user's data directory
const DATA_DIR = join(homedir(), '.claudin');
const DB_PATH = join(DATA_DIR, 'claudin.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): Database.Database {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log(`Database path: ${DB_PATH}`);
  
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Better performance
  
  // Create tables
  db.exec(`
    -- Profiles table
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      linkedin_url TEXT UNIQUE NOT NULL,
      public_identifier TEXT UNIQUE NOT NULL,
      
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      headline TEXT,
      location TEXT,
      about TEXT,
      profile_picture_url TEXT,
      
      current_company TEXT,
      current_title TEXT,
      
      connection_degree INTEGER,
      connected_at TEXT,
      
      experience TEXT, -- JSON
      education TEXT,  -- JSON
      skills TEXT,     -- JSON
      
      scraped_at TEXT NOT NULL,
      last_interaction TEXT,
      is_partial INTEGER DEFAULT 0,
      
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      profile_id TEXT REFERENCES profiles(id),
      
      direction TEXT CHECK(direction IN ('sent', 'received')),
      content TEXT,
      sent_at TEXT,
      is_read INTEGER DEFAULT 0,
      
      scraped_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Searches table
    CREATE TABLE IF NOT EXISTS searches (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      filters TEXT, -- JSON
      result_count INTEGER,
      profile_urls TEXT, -- JSON array
      searched_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Chat conversations table
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Chat messages table
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES chat_conversations(id),
      role TEXT CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model TEXT,
      tool_calls TEXT, -- JSON
      referenced_profiles TEXT, -- JSON array of profile IDs
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Sync log table
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      count INTEGER,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings table (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(current_company);
    CREATE INDEX IF NOT EXISTS idx_profiles_title ON profiles(current_title);
    CREATE INDEX IF NOT EXISTS idx_profiles_scraped ON profiles(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(full_name);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
  `);

  console.log('Database initialized');
  return db;
}

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}
