/**
 * Background Script (Service Worker)
 * Stores scraped data and handles communication
 */

import type { 
  LinkedInProfile, 
  LinkedInMessage,
  LinkedInPost,
  ProfileScrapeEvent, 
  SearchScrapeEvent,
  ScrapeEvent 
} from '@claudin/shared';

interface MessagesScrapeEvent extends ScrapeEvent {
  type: 'messages';
  data: { messages: LinkedInMessage[] };
}

interface FeedScrapeEvent extends ScrapeEvent {
  type: 'feed';
  data: { posts: LinkedInPost[] };
}

const STORAGE_KEYS = {
  PROFILES: 'claudin_profiles',
  MESSAGES: 'claudin_messages',
  POSTS: 'claudin_posts',
  STATS: 'claudin_stats',
} as const;

const ALARM_NAMES = {
  AUTO_SYNC: 'claudin_auto_sync',
  FEED_REFRESH: 'claudin_feed_refresh',
  ENRICHMENT_CHECK: 'claudin_enrichment_check',
} as const;

const SYNC_INTERVAL_MINUTES = 5;
const FEED_REFRESH_INTERVAL_MINUTES = 15;
const ENRICHMENT_CHECK_INTERVAL_MINUTES = 1;

const SERVER_URL = 'http://localhost:3847/api';

const profilesCache = new Map<string, LinkedInProfile>();
const messagesCache = new Map<string, LinkedInMessage>();
const postsCache = new Map<string, LinkedInPost>();

async function initializeCache() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.PROFILES, STORAGE_KEYS.MESSAGES, STORAGE_KEYS.POSTS]);
  
  const profiles = data[STORAGE_KEYS.PROFILES] as Record<string, LinkedInProfile> | undefined;
  if (profiles) {
    Object.entries(profiles).forEach(([key, profile]) => {
      profilesCache.set(key, profile);
    });
  }
  
  const messages = data[STORAGE_KEYS.MESSAGES] as Record<string, LinkedInMessage> | undefined;
  if (messages) {
    Object.entries(messages).forEach(([key, msg]) => {
      messagesCache.set(key, msg);
    });
  }
  
  const posts = data[STORAGE_KEYS.POSTS] as Record<string, LinkedInPost> | undefined;
  if (posts) {
    Object.entries(posts).forEach(([key, post]) => {
      postsCache.set(key, post);
    });
  }
  
  console.log(`[ClaudIn] Initialized with ${profilesCache.size} profiles, ${messagesCache.size} messages, ${postsCache.size} posts`);
}

// Save profile to storage
async function saveProfile(profile: Partial<LinkedInProfile>) {
  if (!profile.publicIdentifier) return;
  
  const key = profile.publicIdentifier;
  const existing = profilesCache.get(key);
  
  // Merge with existing data (don't overwrite full data with partial)
  const merged: LinkedInProfile = {
    ...existing,
    ...profile,
    // Keep detailed fields if we have them and new data is partial
    experience: profile.isPartial && existing?.experience ? existing.experience : profile.experience || null,
    education: profile.isPartial && existing?.education ? existing.education : profile.education || null,
    skills: profile.isPartial && existing?.skills ? existing.skills : profile.skills || null,
    about: profile.isPartial && existing?.about ? existing.about : profile.about || null,
    // Always update these
    scrapedAt: profile.scrapedAt || new Date().toISOString(),
  } as LinkedInProfile;
  
  // Generate ID if needed
  if (!merged.id) {
    merged.id = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  profilesCache.set(key, merged);
  
  // Persist to storage
  const allProfiles: Record<string, LinkedInProfile> = {};
  profilesCache.forEach((p, k) => {
    allProfiles[k] = p;
  });
  
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: allProfiles });
  
  // Update stats
  await updateStats();
  
  return merged;
}

async function updateStats() {
  const stats = {
    totalProfiles: profilesCache.size,
    totalMessages: messagesCache.size,
    totalPosts: postsCache.size,
    lastSyncAt: new Date().toISOString(),
  };
  
  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
  
  chrome.action.setBadgeText({ text: stats.totalProfiles.toString() });
  chrome.action.setBadgeBackgroundColor({ color: '#0A66C2' });
}

async function saveMessage(message: LinkedInMessage) {
  messagesCache.set(message.id, message);
  
  const allMessages: Record<string, LinkedInMessage> = {};
  messagesCache.forEach((m, k) => {
    allMessages[k] = m;
  });
  
  await chrome.storage.local.set({ [STORAGE_KEYS.MESSAGES]: allMessages });
  await updateStats();
  return message;
}

async function savePost(post: LinkedInPost) {
  postsCache.set(post.id, post);
  
  const allPosts: Record<string, LinkedInPost> = {};
  postsCache.forEach((p, k) => {
    allPosts[k] = p;
  });
  
  await chrome.storage.local.set({ [STORAGE_KEYS.POSTS]: allPosts });
  await updateStats();
  return post;
}

chrome.runtime.onMessage.addListener((message: ScrapeEvent | MessagesScrapeEvent | FeedScrapeEvent, _sender, _sendResponse) => {
  console.log('[ClaudIn] Received message:', message.type);
  
  switch (message.type) {
    case 'profile': {
      const event = message as ProfileScrapeEvent;
      saveProfile(event.data).then((saved) => {
        console.log('[ClaudIn] Saved profile:', saved?.fullName);
      });
      break;
    }
    
    case 'search': {
      const event = message as SearchScrapeEvent;
      const { results } = event.data;
      
      Promise.all(results.map(saveProfile)).then(() => {
        console.log(`[ClaudIn] Saved ${results.length} profiles from search`);
      });
      break;
    }
    
    case 'messages': {
      const event = message as MessagesScrapeEvent;
      const { messages } = event.data;
      
      Promise.all(messages.map(saveMessage)).then(() => {
        console.log(`[ClaudIn] Saved ${messages.length} messages`);
      });
      break;
    }
    
    case 'feed': {
      const event = message as FeedScrapeEvent;
      const { posts } = event.data;
      
      Promise.all(posts.map(savePost)).then(() => {
        console.log(`[ClaudIn] Saved ${posts.length} posts`);
      });
      break;
    }
  }
  
  return true;
});

// Handle messages from external sources (e.g., desktop app via native messaging)
chrome.runtime.onMessageExternal?.addListener((message, _sender, sendResponse) => {
  console.log('[ClaudIn] External message:', message);
  
  switch (message.type) {
    case 'GET_PROFILES': {
      const profiles = Array.from(profilesCache.values());
      sendResponse({ profiles });
      break;
    }
    
    case 'GET_STATS': {
      chrome.storage.local.get(STORAGE_KEYS.STATS).then((data) => {
        sendResponse(data[STORAGE_KEYS.STATS]);
      });
      return true; // Async response
    }
    
    case 'NAVIGATE': {
      // Navigate to a specific LinkedIn page
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.id) {
          chrome.tabs.update(tab.id, { url: message.url });
          sendResponse({ success: true });
        }
      });
      return true;
    }
  }
});

async function setupAlarms() {
  await chrome.alarms.create(ALARM_NAMES.AUTO_SYNC, {
    delayInMinutes: 1,
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  
  await chrome.alarms.create(ALARM_NAMES.FEED_REFRESH, {
    delayInMinutes: 2,
    periodInMinutes: FEED_REFRESH_INTERVAL_MINUTES,
  });
  
  await chrome.alarms.create(ALARM_NAMES.ENRICHMENT_CHECK, {
    delayInMinutes: 0.5,
    periodInMinutes: ENRICHMENT_CHECK_INTERVAL_MINUTES,
  });
  
  console.log(`[ClaudIn] Alarms set: sync every ${SYNC_INTERVAL_MINUTES}min, feed refresh every ${FEED_REFRESH_INTERVAL_MINUTES}min, enrichment check every ${ENRICHMENT_CHECK_INTERVAL_MINUTES}min`);
}

async function refreshLinkedInFeed() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/feed/*' });
    
    if (tabs.length === 0) {
      console.log('[ClaudIn] No LinkedIn feed tab found, skipping refresh');
      return { refreshed: false, reason: 'no_feed_tab' };
    }
    
    const feedTab = tabs[0];
    if (feedTab.id) {
      await chrome.tabs.reload(feedTab.id);
      console.log('[ClaudIn] Refreshed LinkedIn feed tab');
      return { refreshed: true, tabId: feedTab.id };
    }
    
    return { refreshed: false, reason: 'no_tab_id' };
  } catch (error) {
    console.error('[ClaudIn] Feed refresh failed:', error);
    return { refreshed: false, reason: String(error) };
  }
}

let isEnrichmentRunning = false;

async function processEnrichmentQueue() {
  if (isEnrichmentRunning) {
    console.log('[ClaudIn] Enrichment already running, skipping');
    return;
  }
  
  try {
    isEnrichmentRunning = true;
    
    const res = await fetch(`${SERVER_URL}/enrich/next`);
    if (!res.ok) {
      console.log('[ClaudIn] Failed to fetch enrichment task');
      return;
    }
    
    const { item } = await res.json();
    if (!item) {
      return;
    }
    
    console.log(`[ClaudIn] Processing enrichment: ${item.publicIdentifier}`);
    
    const tab = await chrome.tabs.create({ 
      url: item.url, 
      active: false,
    });
    
    if (!tab.id) {
      await markEnrichmentComplete(item.publicIdentifier, false, 'Failed to create tab');
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SCRAPE' });
    } catch (e) {
      console.log('[ClaudIn] Could not send scrape message, page may still be loading');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await syncToServer();
    
    try {
      await chrome.tabs.remove(tab.id);
    } catch {}
    
    await markEnrichmentComplete(item.publicIdentifier, true);
    console.log(`[ClaudIn] Enrichment completed: ${item.publicIdentifier}`);
    
  } catch (error) {
    console.error('[ClaudIn] Enrichment error:', error);
  } finally {
    isEnrichmentRunning = false;
  }
}

async function markEnrichmentComplete(publicIdentifier: string, success: boolean, error?: string) {
  try {
    await fetch(`${SERVER_URL}/enrich/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicIdentifier, success, error }),
    });
  } catch (e) {
    console.error('[ClaudIn] Failed to mark enrichment complete:', e);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[ClaudIn] Alarm triggered: ${alarm.name}`);
  
  switch (alarm.name) {
    case ALARM_NAMES.AUTO_SYNC: {
      const result = await syncToServer();
      console.log('[ClaudIn] Auto-sync result:', result);
      break;
    }
    
    case ALARM_NAMES.FEED_REFRESH: {
      const result = await refreshLinkedInFeed();
      console.log('[ClaudIn] Feed refresh result:', result);
      break;
    }
    
    case ALARM_NAMES.ENRICHMENT_CHECK: {
      await processEnrichmentQueue();
      break;
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ClaudIn] Extension installed/updated');
  initializeCache();
  setupAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[ClaudIn] Extension started');
  initializeCache();
  setupAlarms();
});

async function syncToServer(): Promise<{ success: boolean; profiles?: number; messages?: number; posts?: number; error?: string }> {
  try {
    const profiles = Array.from(profilesCache.values());
    const messages = Array.from(messagesCache.values());
    const posts = Array.from(postsCache.values());
    
    let profilesSaved = 0;
    let messagesSaved = 0;
    let postsSaved = 0;
    
    if (profiles.length > 0) {
      const res = await fetch(`${SERVER_URL}/sync/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles }),
      });
      if (res.ok) {
        const result = await res.json();
        profilesSaved = result.saved;
      }
    }
    
    if (messages.length > 0) {
      const res = await fetch(`${SERVER_URL}/sync/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const result = await res.json();
        messagesSaved = result.saved;
      }
    }
    
    if (posts.length > 0) {
      const res = await fetch(`${SERVER_URL}/sync/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts }),
      });
      if (res.ok) {
        const result = await res.json();
        postsSaved = result.saved;
      }
    }
    
    console.log(`[ClaudIn] Synced ${profilesSaved} profiles, ${messagesSaved} messages, ${postsSaved} posts`);
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATS]: {
        totalProfiles: profilesCache.size,
        totalMessages: messagesCache.size,
        totalPosts: postsCache.size,
        lastSyncAt: new Date().toISOString(),
        lastServerSync: new Date().toISOString(),
      }
    });
    
    return { success: true, profiles: profilesSaved, messages: messagesSaved, posts: postsSaved };
  } catch (error) {
    console.error('[ClaudIn] Sync failed:', error);
    return { success: false, error: String(error) };
  }
}

initializeCache();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNC_TO_SERVER') {
    syncToServer().then(sendResponse);
    return true;
  }
});

console.log('[ClaudIn] Background script loaded');
