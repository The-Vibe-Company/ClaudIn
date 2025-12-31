/**
 * Content Script - Runs on LinkedIn pages
 * Extracts profile data as you browse
 */

import type { LinkedInProfile, LinkedInMessage, LinkedInPost, PostType, SharedLink, ProfileScrapeEvent, SearchScrapeEvent, ScrapeEvent } from '@claudin/shared';

interface MessagesScrapeEvent extends ScrapeEvent {
  type: 'messages';
  data: { messages: LinkedInMessage[] };
}

interface FeedScrapeEvent extends ScrapeEvent {
  type: 'feed';
  data: { posts: LinkedInPost[] };
}

// Detect what type of LinkedIn page we're on
function detectPageType(): 'profile' | 'search' | 'feed' | 'messages' | 'unknown' {
  const url = window.location.href;
  
  if (url.includes('/in/')) return 'profile';
  if (url.includes('/search/')) return 'search';
  if (url.includes('/feed')) return 'feed';
  if (url.includes('/messaging')) return 'messages';
  
  return 'unknown';
}

// Extract public identifier from URL
function getPublicIdentifier(): string | null {
  const match = window.location.href.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1] : null;
}

// Wait for an element to appear
function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Extract profile data from the page
async function extractProfileData(): Promise<Partial<LinkedInProfile> | null> {
  const publicIdentifier = getPublicIdentifier();
  if (!publicIdentifier) return null;

  // Wait for main content to load
  await waitForElement('h1');

  // Basic info
  const name = document.querySelector('h1')?.textContent?.trim() || '';
  const headline = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() || '';
  const location = document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() || null;
  
  // Profile picture
  const profilePicture = document.querySelector('.pv-top-card-profile-picture__image') as HTMLImageElement;
  const profilePictureUrl = profilePicture?.src || null;

  // About section
  const aboutSection = document.querySelector('#about');
  const about = aboutSection?.closest('section')?.querySelector('.inline-show-more-text')?.textContent?.trim() || null;

  // Current position (from top card)
  const experienceButton = document.querySelector('[data-field="experience_company_logo"]');
  const currentCompany = experienceButton?.closest('li')?.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || null;
  
  // Extract headline for current title
  const [currentTitle] = headline.split(' at ');

  // Experience section
  const experience = extractExperience();

  // Education section  
  const education = extractEducation();

  // Skills (if visible)
  const skills = extractSkills();

  // Parse name
  const nameParts = name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    linkedinUrl: window.location.href.split('?')[0],
    publicIdentifier,
    firstName,
    lastName,
    fullName: name,
    headline,
    location,
    about,
    profilePictureUrl,
    currentCompany,
    currentTitle: currentTitle?.trim() || null,
    experience,
    education,
    skills,
    scrapedAt: new Date().toISOString(),
    isPartial: false,
  };
}

function extractExperience() {
  const experiences: LinkedInProfile['experience'] = [];
  
  const experienceSection = document.querySelector('#experience');
  if (!experienceSection) return experiences;

  const items = experienceSection.closest('section')?.querySelectorAll('li.artdeco-list__item');
  
  items?.forEach((item) => {
    const titleEl = item.querySelector('.t-bold span[aria-hidden="true"]');
    const companyEl = item.querySelector('.t-normal span[aria-hidden="true"]');
    const durationEl = item.querySelector('.t-black--light span[aria-hidden="true"]');
    
    if (titleEl) {
      experiences.push({
        title: titleEl.textContent?.trim() || '',
        company: companyEl?.textContent?.trim() || '',
        companyLinkedinUrl: null,
        location: null,
        startDate: null,
        endDate: null,
        duration: durationEl?.textContent?.trim() || null,
        description: null,
      });
    }
  });

  return experiences;
}

function extractEducation() {
  const education: LinkedInProfile['education'] = [];
  
  const educationSection = document.querySelector('#education');
  if (!educationSection) return education;

  const items = educationSection.closest('section')?.querySelectorAll('li.artdeco-list__item');
  
  items?.forEach((item) => {
    const schoolEl = item.querySelector('.t-bold span[aria-hidden="true"]');
    const degreeEl = item.querySelector('.t-normal span[aria-hidden="true"]');
    
    if (schoolEl) {
      education.push({
        school: schoolEl.textContent?.trim() || '',
        schoolLinkedinUrl: null,
        degree: degreeEl?.textContent?.trim() || null,
        fieldOfStudy: null,
        startYear: null,
        endYear: null,
        description: null,
      });
    }
  });

  return education;
}

function extractSkills(): string[] {
  const skills: string[] = [];
  
  const skillsSection = document.querySelector('#skills');
  if (!skillsSection) return skills;

  const items = skillsSection.closest('section')?.querySelectorAll('li.artdeco-list__item');
  
  items?.forEach((item) => {
    const skillEl = item.querySelector('.t-bold span[aria-hidden="true"]');
    if (skillEl?.textContent) {
      skills.push(skillEl.textContent.trim());
    }
  });

  return skills;
}

// Extract search results
function extractSearchResults(): Partial<LinkedInProfile>[] {
  const results: Partial<LinkedInProfile>[] = [];
  
  const resultCards = document.querySelectorAll('.reusable-search__result-container');
  
  resultCards.forEach((card) => {
    const linkEl = card.querySelector('a.app-aware-link') as HTMLAnchorElement;
    const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
    const headlineEl = card.querySelector('.entity-result__primary-subtitle');
    const locationEl = card.querySelector('.entity-result__secondary-subtitle');
    
    const href = linkEl?.href;
    const publicIdentifier = href ? href.match(/\/in\/([^/?]+)/)?.[1] : null;
    
    if (publicIdentifier) {
      const name = nameEl?.textContent?.trim() || '';
      const nameParts = name.split(' ');
      
      results.push({
        linkedinUrl: `https://www.linkedin.com/in/${publicIdentifier}`,
        publicIdentifier,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        fullName: name,
        headline: headlineEl?.textContent?.trim() || '',
        location: locationEl?.textContent?.trim() || null,
        scrapedAt: new Date().toISOString(),
        isPartial: true, // Search results have limited data
      });
    }
  });

  return results;
}

// Get search query from URL
function getSearchQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('keywords') || '';
}

function sendToBackground(event: ProfileScrapeEvent | SearchScrapeEvent | MessagesScrapeEvent | FeedScrapeEvent) {
  try {
    if (!chrome.runtime?.id) {
      console.log('[ClaudIn] Extension context invalidated, please refresh the page');
      return;
    }
    chrome.runtime.sendMessage(event).catch(() => {
      console.log('[ClaudIn] Extension reloaded, please refresh the page');
    });
  } catch {
    console.log('[ClaudIn] Extension context invalidated, please refresh the page');
  }
}

function parseRelativeTime(timeStr: string): string {
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();
  
  if (lower.includes('just now') || lower.includes('now')) {
    return now.toISOString();
  }
  
  const match = lower.match(/(\d+)\s*(s|m|h|d|w|mo|y)/);
  if (!match) return now.toISOString();
  
  const [, num, unit] = match;
  const value = parseInt(num);
  
  switch (unit) {
    case 's': now.setSeconds(now.getSeconds() - value); break;
    case 'm': now.setMinutes(now.getMinutes() - value); break;
    case 'h': now.setHours(now.getHours() - value); break;
    case 'd': now.setDate(now.getDate() - value); break;
    case 'w': now.setDate(now.getDate() - value * 7); break;
    case 'mo': now.setMonth(now.getMonth() - value); break;
    case 'y': now.setFullYear(now.getFullYear() - value); break;
  }
  
  return now.toISOString();
}

function extractMessages(): LinkedInMessage[] {
  const messages: LinkedInMessage[] = [];
  
  const selectors = [
    '.msg-conversation-listitem',
    '.msg-conversations-container__convo-item',
    '[data-control-name="view_message"]',
    '.msg-conversation-card',
    'li[class*="msg-conversation"]'
  ];
  
  let conversationItems: NodeListOf<Element> | null = null;
  for (const selector of selectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      conversationItems = items;
      console.log(`[ClaudIn] Found ${items.length} conversations with selector: ${selector}`);
      break;
    }
  }
  
  if (!conversationItems || conversationItems.length === 0) {
    const conversationList = document.querySelector('.msg-conversations-container, .scaffold-layout__list');
    if (conversationList) {
      conversationItems = conversationList.querySelectorAll('li');
      console.log(`[ClaudIn] Found ${conversationItems.length} li items in conversation list`);
    }
  }
  
  if (!conversationItems) {
    console.log('[ClaudIn] No conversation items found. DOM classes:', 
      Array.from(document.querySelectorAll('[class*="msg-"]')).slice(0, 5).map(el => el.className));
    return messages;
  }
  
  conversationItems.forEach((item, idx) => {
    const nameEl = item.querySelector('[class*="participant-name"], [class*="title"], h3, h4');
    const previewEl = item.querySelector('[class*="message-preview"], [class*="snippet"], p');
    const timeEl = item.querySelector('[class*="time"], time, [class*="timestamp"]');
    const linkEl = item.querySelector('a[href*="/messaging/"]') as HTMLAnchorElement;
    
    const href = linkEl?.href || window.location.href;
    const conversationIdMatch = href.match(/thread\/([^/?]+)/);
    const conversationId = conversationIdMatch?.[1] || `conv_${idx}_${Date.now()}`;
    
    const profileLink = item.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
    const publicIdentifier = profileLink?.href?.match(/\/in\/([^/?]+)/)?.[1] || '';
    
    const content = previewEl?.textContent?.trim() || nameEl?.textContent?.trim() || '';
    if (!content) return;
    
    messages.push({
      id: `msg_${conversationId}_${Date.now()}_${idx}`,
      conversationId,
      profileId: publicIdentifier,
      direction: 'received',
      content,
      sentAt: parseRelativeTime(timeEl?.textContent || ''),
      isRead: true,
      scrapedAt: new Date().toISOString()
    });
  });
  
  console.log(`[ClaudIn] Extracted ${messages.length} messages`);
  return messages;
}

function extractSharedLink(item: Element): SharedLink | null {
  const articleContainer = item.querySelector(
    '[class*="feed-shared-article"], [class*="update-components-article"], ' +
    '[class*="feed-shared-external-video"], [class*="article-content"]'
  );
  
  if (!articleContainer) return null;
  
  const linkEl = articleContainer.querySelector('a[href]') as HTMLAnchorElement;
  if (!linkEl) return null;
  
  const url = linkEl.href;
  if (!url || url.includes('linkedin.com')) return null;
  
  const titleEl = articleContainer.querySelector(
    '[class*="article__title"], [class*="mini-update__title"], ' +
    '[class*="feed-shared-article__title"], span[dir="ltr"]'
  );
  const descEl = articleContainer.querySelector(
    '[class*="article__subtitle"], [class*="article__description"], ' +
    '[class*="feed-shared-article__subtitle"]'
  );
  const imgEl = articleContainer.querySelector('img') as HTMLImageElement;
  
  let domain: string | null = null;
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {}
  
  return {
    url,
    title: titleEl?.textContent?.trim() || null,
    description: descEl?.textContent?.trim() || null,
    imageUrl: imgEl?.src || null,
    domain,
  };
}

function extractVideoUrl(item: Element): string | null {
  const videoEl = item.querySelector('video[src]') as HTMLVideoElement;
  if (videoEl?.src) return videoEl.src;
  
  const sourceEl = item.querySelector('video source[src]') as HTMLSourceElement;
  if (sourceEl?.src) return sourceEl.src;
  
  const playerEl = item.querySelector('[data-video-url]');
  if (playerEl) return playerEl.getAttribute('data-video-url');
  
  return null;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) || [];
  return [...new Set(matches.map(h => h.toLowerCase()))];
}

function extractMentions(item: Element): string[] {
  const mentionLinks = item.querySelectorAll('a[href*="/in/"]') as NodeListOf<HTMLAnchorElement>;
  const mentions: string[] = [];
  
  mentionLinks.forEach(link => {
    const match = link.href.match(/\/in\/([^/?]+)/);
    if (match && link.closest('[class*="feed-shared-text"], [class*="commentary"]')) {
      mentions.push(match[1]);
    }
  });
  
  return [...new Set(mentions)];
}

function detectPostType(item: Element, hasImage: boolean, hasVideo: boolean, hasDocument: boolean, hasLink: boolean, hasPoll: boolean, isRepost: boolean): PostType {
  if (isRepost) return 'repost';
  if (hasPoll) return 'poll';
  if (item.querySelector('[class*="job-posting"], [class*="jobs-job"]')) return 'job';
  if (item.querySelector('[class*="celebration"], [class*="work-anniversary"], [class*="hiring"]')) return 'celebration';
  if (item.querySelector('[class*="event"]')) return 'event';
  if (hasDocument) return 'document';
  if (hasVideo) return 'video';
  if (hasLink) return 'article';
  if (hasImage) return 'image';
  return 'text';
}

function extractFeedPosts(): LinkedInPost[] {
  const posts: LinkedInPost[] = [];
  
  const postSelectors = [
    '.feed-shared-update-v2',
    '[data-urn*="activity"]',
    '.occludable-update',
    'div[data-id*="urn:li:activity"]'
  ];
  
  let feedItems: NodeListOf<Element> | null = null;
  for (const selector of postSelectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      feedItems = items;
      break;
    }
  }
  
  if (!feedItems || feedItems.length === 0) {
    console.log('[ClaudIn] No feed items found');
    return posts;
  }
  
  feedItems.forEach((item, idx) => {
    const actorContainer = item.querySelector('[class*="update-components-actor"], [class*="feed-shared-actor"]');
    if (!actorContainer) return;
    
    const authorLink = actorContainer.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
    const publicIdentifier = authorLink?.href?.match(/\/in\/([^/?]+)/)?.[1] || '';
    if (!publicIdentifier) return;
    
    const nameContainer = actorContainer.querySelector('[class*="actor__name"], [class*="actor__title"]');
    const nameSpan = nameContainer?.querySelector(':scope > span[aria-hidden="true"] > span[aria-hidden="true"]') 
      || nameContainer?.querySelector(':scope > span[aria-hidden="true"]');
    const authorName = nameSpan?.textContent?.trim() || '';
    
    const headlineContainer = actorContainer.querySelector('[class*="actor__description"], [class*="actor__subtitle"]');
    const headlineSpan = headlineContainer?.querySelector(':scope > span[aria-hidden="true"] > span[aria-hidden="true"]')
      || headlineContainer?.querySelector(':scope > span[aria-hidden="true"]');
    const authorHeadline = headlineSpan?.textContent?.trim() || null;
    
    const authorImgEl = actorContainer.querySelector('img[class*="presence-entity"], img[class*="actor__avatar-image"], img[alt]') as HTMLImageElement;
    const contentEl = item.querySelector('[class*="feed-shared-text"] span[dir="ltr"], [class*="update-components-text"] span[dir="ltr"], [class*="commentary"] span[dir="ltr"]');
    const timeSpans = actorContainer.querySelectorAll('[class*="actor__sub-description"] span[aria-hidden="true"]');
    const timeEl = timeSpans[0];
    
    const likesEl = item.querySelector('[class*="reaction-count"], [class*="social-counts__reactions"]');
    const commentsEl = item.querySelector('[class*="social-counts__comments"], button[aria-label*="comment"]');
    const repostsEl = item.querySelector('[class*="social-counts__reposts"], button[aria-label*="repost"]');
    
    const hasImage = !!item.querySelector('[class*="feed-shared-image"], img[class*="feed"], [class*="update-components-image"]');
    const hasVideo = !!item.querySelector('video, [class*="video-player"], [class*="feed-shared-video"]');
    const hasDocument = !!item.querySelector('[class*="document"], [class*="feed-shared-document"]');
    const hasPoll = !!item.querySelector('[class*="poll"], [class*="feed-shared-poll"]');
    
    const sharedLink = extractSharedLink(item);
    const hasLink = sharedLink !== null;
    
    const videoUrl = extractVideoUrl(item);
    
    const isRepostContainer = item.querySelector('[class*="feed-shared-update-v2__content"] [class*="update-components-actor"]');
    const isRepost = !!isRepostContainer;
    
    let originalAuthorName: string | null = null;
    let originalAuthorIdentifier: string | null = null;
    
    if (isRepost && isRepostContainer) {
      const origLink = isRepostContainer.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
      originalAuthorIdentifier = origLink?.href?.match(/\/in\/([^/?]+)/)?.[1] || null;
      const origNameEl = isRepostContainer.querySelector('[class*="actor__name"] span[aria-hidden="true"]');
      originalAuthorName = origNameEl?.textContent?.trim() || null;
    }
    
    const contentArea = item.querySelector('[class*="feed-shared-update-v2__content"], [class*="update-components-content"]') || item;
    const imageEls = contentArea.querySelectorAll('img[src*="media"], img[src*="dms.licdn"]') as NodeListOf<HTMLImageElement>;
    const imageUrls = Array.from(imageEls)
      .map(img => img.src)
      .filter(src => src && !src.includes('profile-displayphoto') && !src.includes('shrink_100') && !src.includes('ghost'))
      .slice(0, 10);
    
    const urn = item.getAttribute('data-urn') || item.getAttribute('data-id') || '';
    const urnMatch = urn.match(/activity:(\d+)/);
    const postId = urnMatch?.[1] || `post_${Date.now()}_${idx}`;
    
    const content = contentEl?.textContent?.trim() || '';
    
    const postType = detectPostType(item, hasImage, hasVideo, hasDocument, hasLink, hasPoll, isRepost);
    
    if (!content && !hasImage && !hasVideo && !hasDocument && !hasLink && !hasPoll) return;
    
    const hashtags = extractHashtags(content);
    const mentions = extractMentions(item);
    
    posts.push({
      id: postId,
      authorProfileId: '',
      authorPublicIdentifier: publicIdentifier,
      authorName: authorName || '',
      authorHeadline,
      authorProfilePictureUrl: authorImgEl?.src || null,
      content,
      postUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${postId}`,
      postType,
      likesCount: parseInt(likesEl?.textContent?.replace(/\D/g, '') || '0'),
      commentsCount: parseInt(commentsEl?.textContent?.replace(/\D/g, '') || '0'),
      repostsCount: parseInt(repostsEl?.textContent?.replace(/\D/g, '') || '0'),
      hasImage,
      hasVideo,
      hasDocument,
      hasLink,
      hasPoll,
      imageUrls,
      videoUrl,
      sharedLink,
      isRepost,
      originalAuthorName,
      originalAuthorIdentifier,
      hashtags,
      mentions,
      postedAt: parseRelativeTime(timeEl?.textContent || ''),
      scrapedAt: new Date().toISOString()
    });
  });
  
  console.log(`[ClaudIn] Extracted ${posts.length} posts`);
  return posts;
}

// Main scraping function
async function scrapeCurrentPage() {
  const pageType = detectPageType();
  
  console.log(`[ClaudIn] Detected page type: ${pageType}`);

  switch (pageType) {
    case 'profile': {
      const profileData = await extractProfileData();
      if (profileData) {
        console.log('[ClaudIn] Scraped profile:', profileData.fullName);
        sendToBackground({
          type: 'profile',
          url: window.location.href,
          timestamp: new Date().toISOString(),
          data: profileData,
        });
      }
      break;
    }
    
    case 'search': {
      const results = extractSearchResults();
      const query = getSearchQuery();
      console.log(`[ClaudIn] Scraped ${results.length} search results for: ${query}`);
      sendToBackground({
        type: 'search',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        data: { query, results },
      });
      break;
    }
    
    case 'messages': {
      const messages = extractMessages();
      console.log(`[ClaudIn] Scraped ${messages.length} message threads`);
      sendToBackground({
        type: 'messages',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        data: { messages },
      });
      break;
    }
    
    case 'feed': {
      const posts = extractFeedPosts();
      console.log(`[ClaudIn] Scraped ${posts.length} feed posts`);
      sendToBackground({
        type: 'feed',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        data: { posts },
      });
      break;
    }
  }
}

let lastUrl = window.location.href;
let lastScrapedPostIds = new Set<string>();
let lastScrapedMessageIds = new Set<string>();

const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    lastScrapedPostIds.clear();
    lastScrapedMessageIds.clear();
    setTimeout(scrapeCurrentPage, 2000);
  }
});

urlObserver.observe(document.body, { childList: true, subtree: true });

function scrapeNewContent() {
  const pageType = detectPageType();
  
  if (pageType === 'feed') {
    const posts = extractFeedPosts();
    const newPosts = posts.filter(p => !lastScrapedPostIds.has(p.id));
    if (newPosts.length > 0) {
      newPosts.forEach(p => lastScrapedPostIds.add(p.id));
      console.log(`[ClaudIn] Found ${newPosts.length} new posts (total: ${lastScrapedPostIds.size})`);
      sendToBackground({
        type: 'feed',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        data: { posts: newPosts },
      });
    }
  }
  
  if (pageType === 'messages') {
    const messages = extractMessages();
    const newMessages = messages.filter(m => !lastScrapedMessageIds.has(m.id));
    if (newMessages.length > 0) {
      newMessages.forEach(m => lastScrapedMessageIds.add(m.id));
      console.log(`[ClaudIn] Found ${newMessages.length} new messages (total: ${lastScrapedMessageIds.size})`);
      sendToBackground({
        type: 'messages',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        data: { messages: newMessages },
      });
    }
  }
}

let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('scroll', () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(scrapeNewContent, 1000);
}, { passive: true });

const contentObserver = new MutationObserver(() => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(scrapeNewContent, 1500);
});

contentObserver.observe(document.body, { childList: true, subtree: true });

setTimeout(scrapeCurrentPage, 2000);

try {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'FORCE_SCRAPE') {
      console.log('[ClaudIn] Force scrape requested');
      scrapeCurrentPage().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }
  });
} catch {
  console.log('[ClaudIn] Could not add message listener');
}

console.log('[ClaudIn] Content script loaded');
