/**
 * Background Script (Service Worker)
 * Stores scraped data and handles communication
 */

import type { 
  LinkedInProfile, 
  ProfileScrapeEvent, 
  SearchScrapeEvent,
  ScrapeEvent 
} from '@claudin/shared';

const STORAGE_KEYS = {
  PROFILES: 'claudin_profiles',
  STATS: 'claudin_stats',
} as const;

const SERVER_URL = 'http://localhost:3847/api';

// In-memory cache for quick access
const profilesCache = new Map<string, LinkedInProfile>();

// Initialize from storage
async function initializeCache() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
  const profiles = data[STORAGE_KEYS.PROFILES] as Record<string, LinkedInProfile> | undefined;
  
  if (profiles) {
    Object.entries(profiles).forEach(([key, profile]) => {
      profilesCache.set(key, profile);
    });
  }
  
  console.log(`[ClaudIn] Initialized with ${profilesCache.size} cached profiles`);
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

// Update stats
async function updateStats() {
  const stats = {
    totalProfiles: profilesCache.size,
    lastSyncAt: new Date().toISOString(),
  };
  
  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
  
  // Update badge
  chrome.action.setBadgeText({ text: stats.totalProfiles.toString() });
  chrome.action.setBadgeBackgroundColor({ color: '#0A66C2' }); // LinkedIn blue
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message: ScrapeEvent, _sender, _sendResponse) => {
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
      
      // Save all profiles from search results
      Promise.all(results.map(saveProfile)).then(() => {
        console.log(`[ClaudIn] Saved ${results.length} profiles from search`);
      });
      break;
    }
  }
  
  return true; // Keep channel open for async response
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

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ClaudIn] Extension installed/updated');
  initializeCache();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[ClaudIn] Extension started');
  initializeCache();
});

async function syncToServer(): Promise<{ success: boolean; saved?: number; error?: string }> {
  try {
    const profiles = Array.from(profilesCache.values());
    
    if (profiles.length === 0) {
      return { success: true, saved: 0 };
    }
    
    const response = await fetch(`${SERVER_URL}/sync/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles }),
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`[ClaudIn] Synced ${result.saved} profiles to server`);
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATS]: {
        totalProfiles: profilesCache.size,
        lastSyncAt: new Date().toISOString(),
        lastServerSync: new Date().toISOString(),
      }
    });
    
    return { success: true, saved: result.saved };
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
