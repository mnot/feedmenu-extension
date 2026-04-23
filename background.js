// Background service worker for Feed Menu extension

const DISCOVERY_PERMS = {
  permissions: ['webNavigation'],
  origins: ['*://*/.well-known/feed-menu.json']
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
  console.log("Feed Menu extension installed.");
});

// Listener Management for Optional Permissions
let isDiscoveryInitialized = false;

async function initializeDiscovery() {
  if (isDiscoveryInitialized) return;

  const hasPerms = await chrome.permissions.contains(DISCOVERY_PERMS);
  if (!hasPerms) {
    console.log("Discovery permissions not granted. Auto-Discovery disabled.");
    return;
  }

  // Register navigation listener
  if (chrome.webNavigation) {
    chrome.webNavigation.onCompleted.addListener(handleNavigation);
    isDiscoveryInitialized = true;
    console.log("Auto-Discovery initialized.");
  }
}

// Re-check on startup or when permissions change
initializeDiscovery();

chrome.permissions.onAdded.addListener((perms) => {
  if (perms.permissions?.includes('webNavigation')) {
    initializeDiscovery();
  }
});

chrome.permissions.onRemoved.addListener((perms) => {
  if (perms.permissions?.includes('webNavigation')) {
    if (chrome.webNavigation && isDiscoveryInitialized) {
      chrome.webNavigation.onCompleted.removeListener(handleNavigation);
      isDiscoveryInitialized = false;
      console.log("Auto-Discovery disabled.");
    }
  }
});

// Main Discovery Logic
async function handleNavigation(details) {
  // Only handle top-level frame navigation
  if (details.frameId !== 0) return;
  runSiteCheck(details.tabId, details.url);
}

// Public API for Popup to trigger immediate checks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_NOW' && message.tabId) {
    runSiteCheck(message.tabId, message.url);
  }
});

async function runSiteCheck(tabId, tabUrl) {
  try {
    const url = new URL(tabUrl);
    if (!url.protocol.startsWith('http')) return;

    const hostname = url.hostname;
    const feedMenuUrl = `${url.origin}/.well-known/feed-menu.json`;

    // 1. Check Cache
    const storage = await chrome.storage.local.get(['discoveryCache']);
    const cache = storage.discoveryCache || {};
    const cachedEntry = cache[hostname];

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
      if (cachedEntry.hasFeed) {
        setToolbarIcon(tabId, 'active');
      } else {
        setToolbarIcon(tabId, 'default');
      }
      return;
    }

    // 2. Fetch and Discovery (using GET for robustness)
    const hasFeed = await performDiscovery(feedMenuUrl);
    
    // 3. Update Cache
    cache[hostname] = {
      hasFeed: hasFeed,
      timestamp: Date.now()
    };
    
    // Prune cache if it gets too large (> 500 domains)
    const keys = Object.keys(cache);
    if (keys.length > 500) {
      delete cache[keys[0]];
    }
    
    await chrome.storage.local.set({ discoveryCache: cache });

    // 4. Update Icon
    if (hasFeed) {
      setToolbarIcon(tabId, 'active');
    } else {
      setToolbarIcon(tabId, 'default');
    }

  } catch (e) {
    console.warn("Discovery failed:", e);
  }
}

async function performDiscovery(url) {
  try {
    const response = await fetch(url); // Default to GET
    return response.ok;
  } catch (e) {
    return false;
  }
}

function setToolbarIcon(tabId, type) {
  const iconPaths = type === 'active' 
    ? {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png"
      }
    : {
        "16": "icons/toolbar16.png",
        "19": "icons/toolbar19.png",
        "32": "icons/toolbar32.png",
        "38": "icons/toolbar38.png"
      };

  chrome.action.setIcon({
    tabId: tabId,
    path: iconPaths
  });
}
