async function updateStats() {
  const data = await chrome.storage.local.get(['claudin_profiles', 'claudin_messages', 'claudin_posts', 'claudin_stats']);
  
  const profiles = data.claudin_profiles as Record<string, unknown> | undefined;
  const messages = data.claudin_messages as Record<string, unknown> | undefined;
  const posts = data.claudin_posts as Record<string, unknown> | undefined;
  const stats = data.claudin_stats as { lastSyncAt?: string } | undefined;
  
  const profileCount = profiles ? Object.keys(profiles).length : 0;
  const messageCount = messages ? Object.keys(messages).length : 0;
  const postCount = posts ? Object.keys(posts).length : 0;
  
  const profileCountEl = document.getElementById('profileCount');
  const messageCountEl = document.getElementById('messageCount');
  const postCountEl = document.getElementById('postCount');
  const lastSyncEl = document.getElementById('lastSync');
  
  if (profileCountEl) profileCountEl.textContent = profileCount.toString();
  if (messageCountEl) messageCountEl.textContent = messageCount.toString();
  if (postCountEl) postCountEl.textContent = postCount.toString();
  
  if (lastSyncEl && stats?.lastSyncAt) {
    lastSyncEl.textContent = formatTimeAgo(stats.lastSyncAt);
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

async function syncToServer() {
  const syncBtn = document.getElementById('syncBtn') as HTMLButtonElement;
  const syncResult = document.getElementById('syncResult');
  
  if (!syncBtn || !syncResult) return;
  
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  syncBtn.classList.add('syncing');
  syncResult.className = 'sync-result';
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SYNC_TO_SERVER' });
    
    if (response.success) {
      const parts = [];
      if (response.profiles) parts.push(`${response.profiles} profiles`);
      if (response.messages) parts.push(`${response.messages} messages`);
      if (response.posts) parts.push(`${response.posts} posts`);
      syncResult.textContent = parts.length ? `Synced ${parts.join(', ')}` : 'Nothing to sync';
      syncResult.className = 'sync-result success';
    } else {
      syncResult.textContent = `Sync failed: ${response.error || 'Unknown error'}`;
      syncResult.className = 'sync-result error';
    }
  } catch (error) {
    syncResult.textContent = `Error: ${error}`;
    syncResult.className = 'sync-result error';
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync to Desktop App';
    syncBtn.classList.remove('syncing');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  
  const syncBtn = document.getElementById('syncBtn');
  syncBtn?.addEventListener('click', syncToServer);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.claudin_profiles || changes.claudin_messages || changes.claudin_posts || changes.claudin_stats) {
    updateStats();
  }
});
