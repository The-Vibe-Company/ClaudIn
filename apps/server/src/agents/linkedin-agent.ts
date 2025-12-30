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
      description: 'Get detailed information about a specific profile by ID.',
      parameters: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'The profile ID' },
        },
        required: ['profileId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_network_stats',
      description: 'Get statistics about the user\'s synced LinkedIn network.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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
          name: p.fullName,
          headline: p.headline,
          company: p.currentCompany,
          title: p.currentTitle,
          location: p.location,
          linkedinUrl: p.linkedinUrl,
        })),
      };
    }

    case 'get_profile_details': {
      const { profileId } = args as { profileId: string };
      const profile = getProfileById(profileId);

      if (!profile) {
        return { error: 'Profile not found' };
      }

      return {
        id: profile.id,
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
      };
    }

    case 'get_network_stats': {
      const db = getDb();
      const profileCount = getProfileCount();

      const topCompanies = db.prepare(`
        SELECT current_company as company, COUNT(*) as count 
        FROM profiles 
        WHERE current_company IS NOT NULL AND current_company != ''
        GROUP BY current_company 
        ORDER BY count DESC 
        LIMIT 5
      `).all() as { company: string; count: number }[];

      const topTitles = db.prepare(`
        SELECT current_title as title, COUNT(*) as count 
        FROM profiles 
        WHERE current_title IS NOT NULL AND current_title != ''
        GROUP BY current_title 
        ORDER BY count DESC 
        LIMIT 5
      `).all() as { title: string; count: number }[];

      return {
        totalProfiles: profileCount,
        topCompanies,
        topTitles,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT = `You are ClaudIn, an AI assistant that helps users explore and interact with their LinkedIn network.

You have access to the user's synced LinkedIn connections stored locally. You can:
- Search for people by name, title, company, or location
- Get detailed profile information
- Provide insights about their network

Guidelines:
- Be concise and helpful
- When showing search results, format them nicely with names, titles, and companies
- If asked about someone specific, search for them first
- Proactively offer relevant insights when appropriate
- When the user asks about "my network" or "my connections", use the search_network tool
- If no results are found, let the user know and suggest they sync more data

Remember: You only have access to profiles the user has already viewed on LinkedIn. If they haven't synced many profiles, results may be limited.`;

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
