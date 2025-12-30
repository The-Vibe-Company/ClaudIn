import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const DATA_DIR = join(homedir(), '.claudin');
const DB_PATH = join(DATA_DIR, 'claudin.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface ProfileRow {
  id: string;
  linkedin_url: string;
  public_identifier: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  about: string | null;
  profile_picture_url: string | null;
  current_company: string | null;
  current_title: string | null;
  connection_degree: number | null;
  experience: string | null;
  education: string | null;
  skills: string | null;
  scraped_at: string;
  is_partial: number;
}

export interface PostRow {
  id: string;
  author_profile_id: string | null;
  author_public_identifier: string;
  author_name: string | null;
  author_headline: string | null;
  author_profile_picture_url: string | null;
  content: string | null;
  post_url: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  has_image: number;
  has_video: number;
  has_document: number;
  image_urls: string | null;
  posted_at: string | null;
  scraped_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  profile_id: string | null;
  direction: 'sent' | 'received';
  content: string | null;
  sent_at: string | null;
  is_read: number;
  scraped_at: string;
}
