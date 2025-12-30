import { z } from 'zod';
import { getDb, ProfileRow, PostRow, MessageRow } from './db.js';

export const toolSchemas = {
  search_network: z.object({
    query: z.string().describe('Search query (name, company, title, or skill)'),
    limit: z.number().optional().default(20).describe('Max results to return'),
  }),
  
  get_profile_details: z.object({
    identifier: z.string().describe('LinkedIn public identifier (e.g., "john-doe-123")'),
  }),
  
  get_network_stats: z.object({}),
  
  get_posts: z.object({
    author: z.string().optional().describe('Filter by author public identifier'),
    limit: z.number().optional().default(20).describe('Max posts to return'),
  }),
  
  get_messages: z.object({
    contact: z.string().describe('Contact public identifier'),
    limit: z.number().optional().default(50).describe('Max messages to return'),
  }),
  
  find_people_at_company: z.object({
    company: z.string().describe('Company name to search'),
  }),
  
  find_people_with_skill: z.object({
    skill: z.string().describe('Skill to search for'),
  }),
};

export type ToolName = keyof typeof toolSchemas;

function formatProfile(row: ProfileRow): string {
  const parts = [
    `**${row.full_name || 'Unknown'}** (@${row.public_identifier})`,
    row.headline ? `*${row.headline}*` : null,
    row.location ? `📍 ${row.location}` : null,
    row.current_company ? `🏢 ${row.current_company}` : null,
    row.current_title ? `💼 ${row.current_title}` : null,
  ].filter(Boolean);
  
  if (row.about) {
    parts.push(`\nAbout: ${row.about.slice(0, 200)}${row.about.length > 200 ? '...' : ''}`);
  }
  
  return parts.join('\n');
}

function formatProfileFull(row: ProfileRow): string {
  const parts = [
    `# ${row.full_name || 'Unknown'}`,
    `**LinkedIn**: ${row.linkedin_url}`,
    `**Identifier**: ${row.public_identifier}`,
    '',
    row.headline ? `**Headline**: ${row.headline}` : null,
    row.location ? `**Location**: ${row.location}` : null,
    row.current_company ? `**Company**: ${row.current_company}` : null,
    row.current_title ? `**Title**: ${row.current_title}` : null,
  ].filter(Boolean);
  
  if (row.about) {
    parts.push('', '## About', row.about);
  }
  
  if (row.experience) {
    try {
      const exp = JSON.parse(row.experience);
      if (Array.isArray(exp) && exp.length > 0) {
        parts.push('', '## Experience');
        exp.forEach((e: { title?: string; company?: string; duration?: string }) => {
          parts.push(`- **${e.title || 'Role'}** at ${e.company || 'Company'}${e.duration ? ` (${e.duration})` : ''}`);
        });
      }
    } catch {}
  }
  
  if (row.education) {
    try {
      const edu = JSON.parse(row.education);
      if (Array.isArray(edu) && edu.length > 0) {
        parts.push('', '## Education');
        edu.forEach((e: { school?: string; degree?: string }) => {
          parts.push(`- **${e.school || 'School'}**${e.degree ? ` - ${e.degree}` : ''}`);
        });
      }
    } catch {}
  }
  
  if (row.skills) {
    try {
      const skills = JSON.parse(row.skills);
      if (Array.isArray(skills) && skills.length > 0) {
        parts.push('', '## Skills', skills.join(', '));
      }
    } catch {}
  }
  
  return parts.join('\n');
}

function formatPost(row: PostRow): string {
  const parts = [
    `**${row.author_name || row.author_public_identifier}**`,
    row.author_headline ? `*${row.author_headline}*` : null,
    '',
    row.content || '[No text content]',
    '',
    `👍 ${row.likes_count} | 💬 ${row.comments_count} | 🔄 ${row.reposts_count}`,
    row.posted_at ? `Posted: ${row.posted_at}` : null,
  ].filter(Boolean);
  
  return parts.join('\n');
}

export function executeTool(name: ToolName, args: Record<string, unknown>): string {
  const db = getDb();
  
  switch (name) {
    case 'search_network': {
      const { query, limit } = toolSchemas.search_network.parse(args);
      const searchPattern = `%${query}%`;
      
      const profiles = db.prepare(`
        SELECT * FROM profiles 
        WHERE full_name LIKE ? 
           OR headline LIKE ? 
           OR current_company LIKE ? 
           OR current_title LIKE ?
           OR skills LIKE ?
        ORDER BY scraped_at DESC
        LIMIT ?
      `).all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit) as ProfileRow[];
      
      if (profiles.length === 0) {
        return `No profiles found matching "${query}"`;
      }
      
      return `Found ${profiles.length} profiles:\n\n${profiles.map(formatProfile).join('\n\n---\n\n')}`;
    }
    
    case 'get_profile_details': {
      const { identifier } = toolSchemas.get_profile_details.parse(args);
      
      const profile = db.prepare(
        'SELECT * FROM profiles WHERE public_identifier = ?'
      ).get(identifier) as ProfileRow | undefined;
      
      if (!profile) {
        return `Profile not found: ${identifier}`;
      }
      
      return formatProfileFull(profile);
    }
    
    case 'get_network_stats': {
      const totalProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
      const totalPosts = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
      const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
      
      const topCompanies = db.prepare(`
        SELECT current_company, COUNT(*) as count 
        FROM profiles 
        WHERE current_company IS NOT NULL AND current_company != ''
        GROUP BY current_company 
        ORDER BY count DESC 
        LIMIT 10
      `).all() as Array<{ current_company: string; count: number }>;
      
      const topTitles = db.prepare(`
        SELECT current_title, COUNT(*) as count 
        FROM profiles 
        WHERE current_title IS NOT NULL AND current_title != ''
        GROUP BY current_title 
        ORDER BY count DESC 
        LIMIT 10
      `).all() as Array<{ current_title: string; count: number }>;
      
      const parts = [
        '# Network Statistics',
        '',
        `**Total Profiles**: ${totalProfiles.count}`,
        `**Total Posts**: ${totalPosts.count}`,
        `**Total Messages**: ${totalMessages.count}`,
        '',
        '## Top Companies',
        ...topCompanies.map(c => `- ${c.current_company}: ${c.count}`),
        '',
        '## Top Titles',
        ...topTitles.map(t => `- ${t.current_title}: ${t.count}`),
      ];
      
      return parts.join('\n');
    }
    
    case 'get_posts': {
      const { author, limit } = toolSchemas.get_posts.parse(args);
      
      let posts: PostRow[];
      if (author) {
        posts = db.prepare(`
          SELECT * FROM posts 
          WHERE author_public_identifier = ?
          ORDER BY posted_at DESC
          LIMIT ?
        `).all(author, limit) as PostRow[];
      } else {
        posts = db.prepare(`
          SELECT * FROM posts 
          ORDER BY posted_at DESC
          LIMIT ?
        `).all(limit) as PostRow[];
      }
      
      if (posts.length === 0) {
        return author ? `No posts found from ${author}` : 'No posts found';
      }
      
      return `Found ${posts.length} posts:\n\n${posts.map(formatPost).join('\n\n---\n\n')}`;
    }
    
    case 'get_messages': {
      const { contact, limit } = toolSchemas.get_messages.parse(args);
      
      const profile = db.prepare(
        'SELECT id FROM profiles WHERE public_identifier = ?'
      ).get(contact) as { id: string } | undefined;
      
      if (!profile) {
        return `Contact not found: ${contact}`;
      }
      
      const messages = db.prepare(`
        SELECT * FROM messages 
        WHERE profile_id = ?
        ORDER BY sent_at DESC
        LIMIT ?
      `).all(profile.id, limit) as MessageRow[];
      
      if (messages.length === 0) {
        return `No messages found with ${contact}`;
      }
      
      const formatted = messages.map(m => {
        const direction = m.direction === 'sent' ? '→' : '←';
        return `${direction} ${m.content || '[empty]'}\n   ${m.sent_at || 'Unknown time'}`;
      });
      
      return `Messages with ${contact}:\n\n${formatted.join('\n\n')}`;
    }
    
    case 'find_people_at_company': {
      const { company } = toolSchemas.find_people_at_company.parse(args);
      
      const profiles = db.prepare(`
        SELECT * FROM profiles 
        WHERE current_company LIKE ?
        ORDER BY full_name
      `).all(`%${company}%`) as ProfileRow[];
      
      if (profiles.length === 0) {
        return `No connections found at "${company}"`;
      }
      
      return `Found ${profiles.length} people at "${company}":\n\n${profiles.map(formatProfile).join('\n\n---\n\n')}`;
    }
    
    case 'find_people_with_skill': {
      const { skill } = toolSchemas.find_people_with_skill.parse(args);
      
      const profiles = db.prepare(`
        SELECT * FROM profiles 
        WHERE skills LIKE ?
        ORDER BY full_name
      `).all(`%${skill}%`) as ProfileRow[];
      
      if (profiles.length === 0) {
        return `No connections found with skill "${skill}"`;
      }
      
      return `Found ${profiles.length} people with "${skill}":\n\n${profiles.map(formatProfile).join('\n\n---\n\n')}`;
    }
    
    default:
      return `Unknown tool: ${name}`;
  }
}

export const toolDefinitions = Object.entries(toolSchemas).map(([name, schema]) => ({
  name,
  description: getToolDescription(name as ToolName),
  inputSchema: {
    type: 'object' as const,
    properties: Object.fromEntries(
      Object.entries(schema.shape).map(([key, value]) => [
        key,
        {
          type: getZodType(value),
          description: (value as z.ZodTypeAny).description,
        },
      ])
    ),
    required: Object.entries(schema.shape)
      .filter(([, value]) => !(value instanceof z.ZodOptional))
      .map(([key]) => key),
  },
}));

function getToolDescription(name: ToolName): string {
  const descriptions: Record<ToolName, string> = {
    search_network: 'Search your LinkedIn network by name, company, title, or skill',
    get_profile_details: 'Get detailed information about a specific LinkedIn profile',
    get_network_stats: 'Get statistics about your LinkedIn network',
    get_posts: 'Get LinkedIn posts, optionally filtered by author',
    get_messages: 'Get message history with a specific contact',
    find_people_at_company: 'Find all connections at a specific company',
    find_people_with_skill: 'Find all connections with a specific skill',
  };
  return descriptions[name];
}

function getZodType(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodOptional) return getZodType(schema.unwrap());
  if (schema instanceof z.ZodDefault) return getZodType(schema._def.innerType);
  return 'string';
}
