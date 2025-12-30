import { getDb, ProfileRow, PostRow } from './db.js';

export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export function listResources(): Resource[] {
  const db = getDb();
  
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
  
  return [
    {
      uri: 'linkedin://profiles',
      name: 'All Profiles',
      description: `Your LinkedIn network (${profileCount.count} profiles)`,
      mimeType: 'application/json',
    },
    {
      uri: 'linkedin://posts',
      name: 'Recent Posts',
      description: `LinkedIn feed posts (${postCount.count} posts)`,
      mimeType: 'application/json',
    },
  ];
}

export function readResource(uri: string): { contents: string; mimeType: string } | null {
  const db = getDb();
  
  if (uri === 'linkedin://profiles') {
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY scraped_at DESC').all() as ProfileRow[];
    
    const formatted = profiles.map(p => ({
      identifier: p.public_identifier,
      name: p.full_name,
      headline: p.headline,
      company: p.current_company,
      title: p.current_title,
      location: p.location,
      linkedinUrl: p.linkedin_url,
    }));
    
    return {
      contents: JSON.stringify(formatted, null, 2),
      mimeType: 'application/json',
    };
  }
  
  if (uri.startsWith('linkedin://profiles/')) {
    const identifier = uri.replace('linkedin://profiles/', '');
    const profile = db.prepare('SELECT * FROM profiles WHERE public_identifier = ?').get(identifier) as ProfileRow | undefined;
    
    if (!profile) return null;
    
    const formatted = {
      identifier: profile.public_identifier,
      name: profile.full_name,
      firstName: profile.first_name,
      lastName: profile.last_name,
      headline: profile.headline,
      company: profile.current_company,
      title: profile.current_title,
      location: profile.location,
      about: profile.about,
      linkedinUrl: profile.linkedin_url,
      profilePictureUrl: profile.profile_picture_url,
      experience: profile.experience ? JSON.parse(profile.experience) : null,
      education: profile.education ? JSON.parse(profile.education) : null,
      skills: profile.skills ? JSON.parse(profile.skills) : null,
      scrapedAt: profile.scraped_at,
    };
    
    return {
      contents: JSON.stringify(formatted, null, 2),
      mimeType: 'application/json',
    };
  }
  
  if (uri === 'linkedin://posts') {
    const posts = db.prepare('SELECT * FROM posts ORDER BY posted_at DESC LIMIT 100').all() as PostRow[];
    
    const formatted = posts.map(p => ({
      id: p.id,
      author: {
        identifier: p.author_public_identifier,
        name: p.author_name,
        headline: p.author_headline,
      },
      content: p.content,
      engagement: {
        likes: p.likes_count,
        comments: p.comments_count,
        reposts: p.reposts_count,
      },
      hasMedia: {
        image: !!p.has_image,
        video: !!p.has_video,
        document: !!p.has_document,
      },
      postedAt: p.posted_at,
      postUrl: p.post_url,
    }));
    
    return {
      contents: JSON.stringify(formatted, null, 2),
      mimeType: 'application/json',
    };
  }
  
  if (uri.startsWith('linkedin://posts/by/')) {
    const author = uri.replace('linkedin://posts/by/', '');
    const posts = db.prepare(
      'SELECT * FROM posts WHERE author_public_identifier = ? ORDER BY posted_at DESC'
    ).all(author) as PostRow[];
    
    const formatted = posts.map(p => ({
      id: p.id,
      content: p.content,
      engagement: {
        likes: p.likes_count,
        comments: p.comments_count,
        reposts: p.reposts_count,
      },
      postedAt: p.posted_at,
      postUrl: p.post_url,
    }));
    
    return {
      contents: JSON.stringify(formatted, null, 2),
      mimeType: 'application/json',
    };
  }
  
  return null;
}

export function listResourceTemplates() {
  return [
    {
      uriTemplate: 'linkedin://profiles/{identifier}',
      name: 'Profile by Identifier',
      description: 'Get a specific LinkedIn profile by public identifier',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'linkedin://posts/by/{author}',
      name: 'Posts by Author',
      description: 'Get posts from a specific author',
      mimeType: 'application/json',
    },
  ];
}
