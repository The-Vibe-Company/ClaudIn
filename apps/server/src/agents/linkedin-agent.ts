import OpenAI from 'openai';
import { searchProfiles, getProfileById, getProfileCount } from '../db/profiles.js';
import { getDb, getSetting } from '../db/index.js';
import type { ChatMessage } from '@claudin/shared';

const MODEL = 'anthropic/claude-sonnet-4.5';

function getClient(): OpenAI {
  const apiKey = getSetting('openrouter_api_key') || process.env.OPENROUTER_API_KEY || '';
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_network',
      description: 'Search LinkedIn profiles in the local cache by name, title, company, or location.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query - name, job title, company, or location' },
          title: { type: 'string', description: 'Filter by job title' },
          company: { type: 'string', description: 'Filter by company name' },
          location: { type: 'string', description: 'Filter by location' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profile_details',
      description: 'Get full profile info including experience, education, skills, and about section. Use publicIdentifier (from URL) or profile ID.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'Profile ID or public identifier (e.g., "john-doe-123")' },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profile_posts',
      description: 'Get LinkedIn posts from a specific person. Returns their recent activity and content.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'Public identifier of the person' },
          limit: { type: 'number', description: 'Max posts to return (default 20)' },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_posts',
      description: 'Get recent posts from the LinkedIn feed (all authors).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max posts to return (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_messages_with',
      description: 'Get message history with a specific contact.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'Public identifier of the contact' },
          limit: { type: 'number', description: 'Max messages to return (default 50)' },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_people_at_company',
      description: 'Find all connections working at a specific company.',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Company name to search' },
        },
        required: ['company'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_people_with_skill',
      description: 'Find all connections with a specific skill.',
      parameters: {
        type: 'object',
        properties: {
          skill: { type: 'string', description: 'Skill to search for' },
        },
        required: ['skill'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_network_stats',
      description: 'Get statistics about the synced LinkedIn network (counts, top companies, top titles).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getDb();
  
  switch (name) {
    case 'search_network': {
      const { query, title, company, location, limit = 20 } = args as {
        query: string;
        title?: string;
        company?: string;
        location?: string;
        limit?: number;
      };

      const filters = { title, company, location };
      const { profiles, total } = searchProfiles(query, filters, limit);

      return {
        total,
        returned: profiles.length,
        profiles: profiles.map(p => ({
          id: p.id,
          publicIdentifier: p.publicIdentifier,
          name: p.fullName,
          headline: p.headline,
          company: p.currentCompany,
          title: p.currentTitle,
          location: p.location,
          linkedinUrl: p.linkedinUrl,
          isPartial: p.isPartial,
        })),
      };
    }

    case 'get_profile_details': {
      const { identifier } = args as { identifier: string };
      
      let profile = getProfileById(identifier);
      if (!profile) {
        const row = db.prepare(
          'SELECT * FROM profiles WHERE public_identifier = ?'
        ).get(identifier) as ProfileRow | undefined;
        
        if (row) {
          profile = {
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
            connectedAt: null,
            lastInteraction: null,
            experience: row.experience ? JSON.parse(row.experience) : null,
            education: row.education ? JSON.parse(row.education) : null,
            skills: row.skills ? JSON.parse(row.skills) : null,
            scrapedAt: row.scraped_at,
            isPartial: !!row.is_partial,
          };
        }
      }

      if (!profile) {
        return { error: `Profile not found: ${identifier}` };
      }

      return {
        id: profile.id,
        publicIdentifier: profile.publicIdentifier,
        name: profile.fullName,
        headline: profile.headline,
        company: profile.currentCompany,
        title: profile.currentTitle,
        location: profile.location,
        about: profile.about,
        experience: profile.experience,
        education: profile.education,
        skills: profile.skills,
        linkedinUrl: profile.linkedinUrl,
        connectionDegree: profile.connectionDegree,
        isPartial: profile.isPartial,
        note: profile.isPartial ? 'This profile has limited data. User needs to visit the full profile on LinkedIn to sync more details.' : null,
      };
    }

    case 'get_profile_posts': {
      const { identifier, limit = 20 } = args as { identifier: string; limit?: number };
      
      const posts = db.prepare(`
        SELECT * FROM posts 
        WHERE author_public_identifier = ?
        ORDER BY posted_at DESC
        LIMIT ?
      `).all(identifier, limit) as PostRow[];
      
      if (posts.length === 0) {
        return { 
          posts: [],
          message: `No posts found from ${identifier}. They may not have posted recently, or posts haven't been synced yet.`
        };
      }
      
      return {
        count: posts.length,
        posts: posts.map(p => ({
          id: p.id,
          content: p.content,
          likes: p.likes_count,
          comments: p.comments_count,
          reposts: p.reposts_count,
          hasImage: !!p.has_image,
          hasVideo: !!p.has_video,
          postedAt: p.posted_at,
          postUrl: p.post_url,
        })),
      };
    }

    case 'get_recent_posts': {
      const { limit = 20 } = args as { limit?: number };
      
      const posts = db.prepare(`
        SELECT * FROM posts 
        ORDER BY posted_at DESC
        LIMIT ?
      `).all(limit) as PostRow[];
      
      return {
        count: posts.length,
        posts: posts.map(p => ({
          id: p.id,
          author: p.author_name,
          authorIdentifier: p.author_public_identifier,
          content: p.content,
          likes: p.likes_count,
          comments: p.comments_count,
          postedAt: p.posted_at,
        })),
      };
    }

    case 'get_messages_with': {
      const { identifier, limit = 50 } = args as { identifier: string; limit?: number };
      
      const profileRow = db.prepare(
        'SELECT id FROM profiles WHERE public_identifier = ?'
      ).get(identifier) as { id: string } | undefined;
      
      if (!profileRow) {
        return { error: `Contact not found: ${identifier}` };
      }
      
      const messages = db.prepare(`
        SELECT * FROM messages 
        WHERE profile_id = ?
        ORDER BY sent_at DESC
        LIMIT ?
      `).all(profileRow.id, limit) as MessageRow[];
      
      return {
        count: messages.length,
        messages: messages.map(m => ({
          direction: m.direction,
          content: m.content,
          sentAt: m.sent_at,
        })),
      };
    }

    case 'find_people_at_company': {
      const { company } = args as { company: string };
      
      const profiles = db.prepare(`
        SELECT * FROM profiles 
        WHERE current_company LIKE ?
        ORDER BY full_name
      `).all(`%${company}%`) as ProfileRow[];
      
      if (profiles.length === 0) {
        return { message: `No connections found at "${company}"` };
      }
      
      return {
        count: profiles.length,
        company,
        people: profiles.map(p => ({
          publicIdentifier: p.public_identifier,
          name: p.full_name,
          title: p.current_title,
          headline: p.headline,
        })),
      };
    }

    case 'find_people_with_skill': {
      const { skill } = args as { skill: string };
      
      const profiles = db.prepare(`
        SELECT * FROM profiles 
        WHERE skills LIKE ?
        ORDER BY full_name
      `).all(`%${skill}%`) as ProfileRow[];
      
      if (profiles.length === 0) {
        return { message: `No connections found with skill "${skill}"` };
      }
      
      return {
        count: profiles.length,
        skill,
        people: profiles.map(p => ({
          publicIdentifier: p.public_identifier,
          name: p.full_name,
          title: p.current_title,
          company: p.current_company,
        })),
      };
    }

    case 'get_network_stats': {
      const profileCount = getProfileCount();
      const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
      const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

      const topCompanies = db.prepare(`
        SELECT current_company as company, COUNT(*) as count 
        FROM profiles 
        WHERE current_company IS NOT NULL AND current_company != ''
        GROUP BY current_company 
        ORDER BY count DESC 
        LIMIT 10
      `).all() as { company: string; count: number }[];

      const topTitles = db.prepare(`
        SELECT current_title as title, COUNT(*) as count 
        FROM profiles 
        WHERE current_title IS NOT NULL AND current_title != ''
        GROUP BY current_title 
        ORDER BY count DESC 
        LIMIT 10
      `).all() as { title: string; count: number }[];

      return {
        totalProfiles: profileCount,
        totalPosts: postCount.count,
        totalMessages: messageCount.count,
        topCompanies,
        topTitles,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

interface ProfileRow {
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

interface PostRow {
  id: string;
  author_public_identifier: string;
  author_name: string | null;
  content: string | null;
  post_url: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  has_image: number;
  has_video: number;
  posted_at: string | null;
}

interface MessageRow {
  id: string;
  direction: 'sent' | 'received';
  content: string | null;
  sent_at: string | null;
}

const SYSTEM_PROMPT = `You are ClaudIn, an AI assistant that helps users explore and interact with their LinkedIn network.

You have access to the user's synced LinkedIn data stored locally:
- **Profiles**: People they've viewed on LinkedIn (search results, profile pages)
- **Posts**: LinkedIn feed posts they've scrolled past
- **Messages**: Conversation previews from their messaging

Available tools:
- search_network: Find people by name, title, company, location
- get_profile_details: Get full profile info (experience, education, skills, about)
- get_profile_posts: See what a specific person has posted
- get_recent_posts: See recent posts from the feed
- get_messages_with: Get message history with someone
- find_people_at_company: Find all connections at a company
- find_people_with_skill: Find people with a specific skill
- get_network_stats: Network overview and statistics

Guidelines:
- Be concise and helpful
- When asked about someone, first search for them, then get their details if found
- If a profile is "partial" (isPartial=true), tell the user they need to visit the full profile on LinkedIn to sync more details
- Format results nicely with relevant info
- If asked about someone's background or posts, use the appropriate tools
- When showing education/experience, format it clearly

Remember: You only have access to data the user has already synced by browsing LinkedIn. Suggest syncing more data if needed.`;

interface AgentOptions {
  message: string;
  history: ChatMessage[];
  onText: (text: string) => Promise<void>;
  onToolStart: (name: string, input: unknown) => Promise<void>;
  onToolResult: (name: string, result: unknown) => Promise<void>;
}

export async function runAgent(options: AgentOptions): Promise<void> {
  const { message, history, onText, onToolStart, onToolResult } = options;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user', content: message },
  ];

  const client = getClient();
  let continueLoop = true;

  while (continueLoop) {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      tools,
      messages,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    if (assistantMessage.content) {
      await onText(assistantMessage.content);
    }

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || '{}');

        await onToolStart(name, args);
        const result = await executeTool(name, args);
        await onToolResult(name, result);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      continueLoop = true;
    } else {
      continueLoop = false;
    }
  }
}
