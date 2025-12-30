/**
 * API Types - Communication between components
 */

import type { LinkedInProfile, SearchFilters } from './linkedin.js';

/**
 * Extension <-> Server Messages (Native Messaging)
 */

export type ExtensionToServerMessage =
  | { type: 'SCRAPED_PROFILE'; data: Partial<LinkedInProfile> }
  | { type: 'SCRAPED_SEARCH'; data: { query: string; results: Partial<LinkedInProfile>[] } }
  | { type: 'SYNC_REQUEST' }
  | { type: 'PING' };

export type ServerToExtensionMessage =
  | { type: 'NAVIGATE'; url: string }
  | { type: 'SCRAPE_PROFILE'; url: string }
  | { type: 'SYNC_COMPLETE'; count: number }
  | { type: 'PONG' };

/**
 * Server API Routes
 */

// GET /api/profiles
export interface GetProfilesRequest {
  query?: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface GetProfilesResponse {
  profiles: LinkedInProfile[];
  total: number;
  hasMore: boolean;
}

// GET /api/profiles/:id
export interface GetProfileResponse {
  profile: LinkedInProfile;
  source: 'cache' | 'fresh';
}

// POST /api/chat
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  conversationId: string;
  content: string;
  referencedProfiles?: LinkedInProfile[];
  toolsUsed?: string[];
}

// Streaming chat response
export interface ChatStreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'done';
  content?: string;
  tool?: string;
  result?: unknown;
}

// GET /api/stats
export interface StatsResponse {
  totalProfiles: number;
  totalMessages: number;
  totalSearches: number;
  lastSyncAt: string | null;
  profilesByCompany: { company: string; count: number }[];
  profilesByConnectionDegree: { degree: number; count: number }[];
}

/**
 * WebSocket Events (real-time sync)
 */

export type WSEvent =
  | { type: 'profile_synced'; profile: LinkedInProfile }
  | { type: 'sync_started' }
  | { type: 'sync_complete'; count: number }
  | { type: 'error'; message: string };

export interface AppSettings {
  openrouter_api_key: string | null;
}

export interface SettingsStatusResponse {
  configured: boolean;
  hasApiKey: boolean;
}

export interface GetSettingsResponse {
  settings: AppSettings;
}

export interface UpdateSettingsRequest {
  openrouter_api_key?: string;
}
