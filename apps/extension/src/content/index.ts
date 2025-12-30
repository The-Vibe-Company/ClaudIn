/**
 * Content Script - Runs on LinkedIn pages
 * Extracts profile data as you browse
 */

import type { LinkedInProfile, ProfileScrapeEvent, SearchScrapeEvent } from '@claudin/shared';

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

// Send scraped data to background script
function sendToBackground(event: ProfileScrapeEvent | SearchScrapeEvent) {
  chrome.runtime.sendMessage(event);
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
  }
}

// Observe URL changes (LinkedIn is a SPA)
let lastUrl = window.location.href;

const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Wait a bit for the new page to load
    setTimeout(scrapeCurrentPage, 2000);
  }
});

urlObserver.observe(document.body, { childList: true, subtree: true });

// Initial scrape after page loads
setTimeout(scrapeCurrentPage, 2000);

console.log('[ClaudIn] Content script loaded');
