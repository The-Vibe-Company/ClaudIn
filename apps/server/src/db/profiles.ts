/**
 * Profile Database Operations
 */

import type { LinkedInProfile, SearchFilters } from '@claudin/shared';
import { getDb, generateId } from './index.js';

export function upsertProfile(profile: Partial<LinkedInProfile>): LinkedInProfile | null {
  const db = getDb();
  
  if (!profile.publicIdentifier) {
    console.error('Cannot upsert profile without publicIdentifier');
    return null;
  }

  // Check if exists
  const existing = db.prepare(
    'SELECT * FROM profiles WHERE public_identifier = ?'
  ).get(profile.publicIdentifier) as DbProfile | undefined;

  const now = new Date().toISOString();
  const id = existing?.id || profile.id || generateId('profile');

  // If existing and new data is partial, merge carefully
  const merged = existing && profile.isPartial ? {
    ...rowToProfile(existing),
    ...profile,
    // Keep detailed fields from existing if new is partial
    experience: profile.experience || existing.experience ? JSON.parse(existing.experience || '[]') : null,
    education: profile.education || existing.education ? JSON.parse(existing.education || '[]') : null,
    skills: profile.skills || existing.skills ? JSON.parse(existing.skills || '[]') : null,
    about: profile.about || existing.about,
  } : profile;

  const stmt = db.prepare(`
    INSERT INTO profiles (
      id, linkedin_url, public_identifier,
      first_name, last_name, full_name, headline, location, about, profile_picture_url,
      current_company, current_title,
      connection_degree, connected_at,
      experience, education, skills,
      scraped_at, last_interaction, is_partial,
      updated_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?
    )
    ON CONFLICT(public_identifier) DO UPDATE SET
      first_name = COALESCE(excluded.first_name, first_name),
      last_name = COALESCE(excluded.last_name, last_name),
      full_name = COALESCE(excluded.full_name, full_name),
      headline = COALESCE(excluded.headline, headline),
      location = COALESCE(excluded.location, location),
      about = COALESCE(excluded.about, about),
      profile_picture_url = COALESCE(excluded.profile_picture_url, profile_picture_url),
      current_company = COALESCE(excluded.current_company, current_company),
      current_title = COALESCE(excluded.current_title, current_title),
      connection_degree = COALESCE(excluded.connection_degree, connection_degree),
      experience = CASE WHEN excluded.is_partial = 0 THEN excluded.experience ELSE COALESCE(experience, excluded.experience) END,
      education = CASE WHEN excluded.is_partial = 0 THEN excluded.education ELSE COALESCE(education, excluded.education) END,
      skills = CASE WHEN excluded.is_partial = 0 THEN excluded.skills ELSE COALESCE(skills, excluded.skills) END,
      scraped_at = excluded.scraped_at,
      is_partial = CASE WHEN is_partial = 1 AND excluded.is_partial = 0 THEN 0 ELSE is_partial END,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    id,
    merged.linkedinUrl,
    merged.publicIdentifier,
    merged.firstName,
    merged.lastName,
    merged.fullName,
    merged.headline,
    merged.location,
    merged.about,
    merged.profilePictureUrl,
    merged.currentCompany,
    merged.currentTitle,
    merged.connectionDegree,
    merged.connectedAt,
    merged.experience ? JSON.stringify(merged.experience) : null,
    merged.education ? JSON.stringify(merged.education) : null,
    merged.skills ? JSON.stringify(merged.skills) : null,
    merged.scrapedAt || now,
    merged.lastInteraction,
    merged.isPartial ? 1 : 0,
    now
  );

  return getProfileById(id);
}

export function getProfileById(id: string): LinkedInProfile | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as DbProfile | undefined;
  return row ? rowToProfile(row) : null;
}

export function getProfileByUrl(url: string): LinkedInProfile | null {
  const db = getDb();
  const publicIdentifier = url.match(/\/in\/([^/?]+)/)?.[1];
  if (!publicIdentifier) return null;
  
  const row = db.prepare('SELECT * FROM profiles WHERE public_identifier = ?').get(publicIdentifier) as DbProfile | undefined;
  return row ? rowToProfile(row) : null;
}

export function getProfileByPublicIdentifier(publicIdentifier: string): LinkedInProfile | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM profiles WHERE public_identifier = ?').get(publicIdentifier) as DbProfile | undefined;
  return row ? rowToProfile(row) : null;
}

export function searchProfiles(query: string, filters?: SearchFilters, limit = 50, offset = 0): { profiles: LinkedInProfile[], total: number } {
  const db = getDb();
  
  let whereClause = '1=1';
  const params: (string | number)[] = [];

  if (query) {
    whereClause += ` AND (
      full_name LIKE ? OR
      headline LIKE ? OR
      current_company LIKE ? OR
      current_title LIKE ? OR
      location LIKE ?
    )`;
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery, likeQuery, likeQuery, likeQuery);
  }

  if (filters?.company) {
    whereClause += ' AND current_company LIKE ?';
    params.push(`%${filters.company}%`);
  }

  if (filters?.title) {
    whereClause += ' AND (current_title LIKE ? OR headline LIKE ?)';
    params.push(`%${filters.title}%`, `%${filters.title}%`);
  }

  if (filters?.location) {
    whereClause += ' AND location LIKE ?';
    params.push(`%${filters.location}%`);
  }

  if (filters?.connectionDegree?.length) {
    whereClause += ` AND connection_degree IN (${filters.connectionDegree.join(',')})`;
  }

  // Get total count
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM profiles WHERE ${whereClause}`).get(...params) as { count: number };
  
  // Get paginated results
  const rows = db.prepare(`
    SELECT * FROM profiles 
    WHERE ${whereClause}
    ORDER BY scraped_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as DbProfile[];

  return {
    profiles: rows.map(rowToProfile),
    total: countRow.count,
  };
}

export function getAllProfiles(): LinkedInProfile[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM profiles ORDER BY scraped_at DESC').all() as DbProfile[];
  return rows.map(rowToProfile);
}

export function getProfileCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  return row.count;
}

// Internal types
interface DbProfile {
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
  connected_at: string | null;
  experience: string | null;
  education: string | null;
  skills: string | null;
  scraped_at: string;
  last_interaction: string | null;
  is_partial: number;
}

function rowToProfile(row: DbProfile): LinkedInProfile {
  return {
    id: row.id,
    linkedinUrl: row.linkedin_url,
    publicIdentifier: row.public_identifier,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    fullName: row.full_name || '',
    headline: row.headline || '',
    location: row.location,
    about: row.about,
    profilePictureUrl: row.profile_picture_url,
    currentCompany: row.current_company,
    currentTitle: row.current_title,
    connectionDegree: row.connection_degree as 1 | 2 | 3 | null,
    connectedAt: row.connected_at,
    experience: row.experience ? JSON.parse(row.experience) : null,
    education: row.education ? JSON.parse(row.education) : null,
    skills: row.skills ? JSON.parse(row.skills) : null,
    scrapedAt: row.scraped_at,
    lastInteraction: row.last_interaction,
    isPartial: row.is_partial === 1,
  };
}
