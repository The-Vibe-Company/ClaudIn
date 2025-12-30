/**
 * LinkedIn Profile Types
 */

export interface LinkedInProfile {
  id: string;
  linkedinUrl: string;
  publicIdentifier: string; // the /in/xxx part
  
  // Basic info
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  location: string | null;
  about: string | null;
  profilePictureUrl: string | null;
  
  // Current position
  currentCompany: string | null;
  currentTitle: string | null;
  
  // Connection
  connectionDegree: 1 | 2 | 3 | null;
  connectedAt: string | null; // ISO date
  
  // Detailed data (may be null if only partial scrape)
  experience: Experience[] | null;
  education: Education[] | null;
  skills: string[] | null;
  
  // Metadata
  scrapedAt: string; // ISO date
  lastInteraction: string | null; // ISO date
  isPartial: boolean; // true if only scraped from search results
}

export interface Experience {
  title: string;
  company: string;
  companyLinkedinUrl: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null; // null = present
  duration: string | null;
  description: string | null;
}

export interface Education {
  school: string;
  schoolLinkedinUrl: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  description: string | null;
}

/**
 * LinkedIn Message Types
 */

export interface LinkedInMessage {
  id: string;
  conversationId: string;
  profileId: string; // FK to profile
  
  direction: 'sent' | 'received';
  content: string;
  sentAt: string; // ISO date
  
  isRead: boolean;
  
  scrapedAt: string;
}

export interface LinkedInConversation {
  id: string;
  profileId: string;
  
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  
  scrapedAt: string;
}

/**
 * Search Types
 */

export interface LinkedInSearchResult {
  id: string;
  query: string;
  filters: SearchFilters;
  resultCount: number;
  profileUrls: string[];
  searchedAt: string;
}

export interface SearchFilters {
  keywords?: string;
  title?: string;
  company?: string;
  location?: string;
  industry?: string;
  connectionDegree?: (1 | 2 | 3)[];
}

/**
 * Scraping Events
 */

export type ScrapedPageType = 'profile' | 'search' | 'feed' | 'messages' | 'company' | 'unknown';

export interface ScrapeEvent {
  type: ScrapedPageType;
  url: string;
  timestamp: string;
  data: unknown;
}

export interface ProfileScrapeEvent extends ScrapeEvent {
  type: 'profile';
  data: Partial<LinkedInProfile>;
}

export interface SearchScrapeEvent extends ScrapeEvent {
  type: 'search';
  data: {
    query: string;
    results: Partial<LinkedInProfile>[];
  };
}
