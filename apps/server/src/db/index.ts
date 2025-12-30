/**
 * Database Layer
 * SQLite with better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
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

    -- Posts table (LinkedIn feed)
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      author_profile_id TEXT REFERENCES profiles(id),
      author_public_identifier TEXT NOT NULL,
      author_name TEXT,
      author_headline TEXT,
      author_profile_picture_url TEXT,
      
      content TEXT,
      post_url TEXT,
      
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      reposts_count INTEGER DEFAULT 0,
      
      has_image INTEGER DEFAULT 0,
      has_video INTEGER DEFAULT 0,
      has_document INTEGER DEFAULT 0,
      image_urls TEXT,
      
      posted_at TEXT,
      scraped_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Enrichment queue (profiles to visit and scrape)
    CREATE TABLE IF NOT EXISTS enrichment_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_identifier TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      attempts INTEGER DEFAULT 0,
      queued_at TEXT DEFAULT CURRENT_TIMESTAMP,
      started_at TEXT,
      completed_at TEXT,
      error TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(current_company);
    CREATE INDEX IF NOT EXISTS idx_profiles_title ON profiles(current_title);
    CREATE INDEX IF NOT EXISTS idx_profiles_scraped ON profiles(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(full_name);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_profile ON messages(profile_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages(sent_at);
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_public_identifier);
    CREATE INDEX IF NOT EXISTS idx_posts_posted ON posts(posted_at);
    CREATE INDEX IF NOT EXISTS idx_enrichment_status ON enrichment_queue(status);
  `);

  cleanupDuplicatedText();
  
  console.log('Database initialized');
  return db;
}

function cleanupDuplicatedText() {
  const posts = db.prepare('SELECT id, author_name, author_headline FROM posts').all() as Array<{
    id: string;
    author_name: string | null;
    author_headline: string | null;
  }>;
  
  let fixed = 0;
  for (const post of posts) {
    const cleanName = deduplicateString(post.author_name);
    const cleanHeadline = deduplicateString(post.author_headline);
    
    if (cleanName !== post.author_name || cleanHeadline !== post.author_headline) {
      db.prepare('UPDATE posts SET author_name = ?, author_headline = ? WHERE id = ?')
        .run(cleanName, cleanHeadline, post.id);
      fixed++;
    }
  }
  
  const profiles = db.prepare('SELECT id, full_name, headline FROM profiles').all() as Array<{
    id: string;
    full_name: string | null;
    headline: string | null;
  }>;
  
  for (const profile of profiles) {
    const cleanName = deduplicateString(profile.full_name);
    const cleanHeadline = deduplicateString(profile.headline);
    
    if (cleanName !== profile.full_name || cleanHeadline !== profile.headline) {
      const nameParts = cleanName.split(' ');
      db.prepare('UPDATE profiles SET full_name = ?, first_name = ?, last_name = ?, headline = ? WHERE id = ?')
        .run(cleanName, nameParts[0] || '', nameParts.slice(1).join(' ') || '', cleanHeadline, profile.id);
      fixed++;
    }
  }
  
  if (fixed > 0) {
    console.log(`Cleaned ${fixed} records with duplicated text`);
  }
}

function deduplicateString(text: string | null): string {
  if (!text) return '';
  const trimmed = text.trim();
  const len = trimmed.length;
  if (len < 2 || len % 2 !== 0) return trimmed;
  
  const half = len / 2;
  const first = trimmed.slice(0, half);
  const second = trimmed.slice(half);
  
  return first === second ? first : trimmed;
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
