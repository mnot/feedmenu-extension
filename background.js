// Background service worker for Feed Menu extension

const DISCOVERY_PERMS = {
  permissions: ['webNavigation'],
  origins: ['*://*/.well-known/feed-menu.json']
};

// Safari renders the toolbar icon as a template image: it discards the PNG's
// colors and tints the shape with the system highlight color (blue). That
// erases the active/default *color* swap we use to signal feed-availability on
// Chrome and Firefox — both states look identical there. A badge is not
// template-tinted, so it's the reliable "this site has feeds" signal on Safari.
// We add it on Safari only; the other browsers already convey state through the
// icon color and a badge would just clutter the quiet button.
const IS_SAFARI = (() => {
  try {
    if ((navigator.vendor || '').indexOf('Apple') !== -1) return true;
    const ua = navigator.userAgent || '';
    return /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  } catch (e) {
    return false;
  }
})();

const FEED_BADGE_COLOR = '#EE802F'; // feed orange, distinct from Safari's blue tint

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
  console.log("Feed Menu extension installed.");
});

// Listener Management for Optional Permissions
// Listener Management for Optional Permissions
let isDiscoveryInitialized = false;

async function initializeDiscovery() {
  if (isDiscoveryInitialized) return;

  const hasPerms = await chrome.permissions.contains(DISCOVERY_PERMS);
  if (!hasPerms) {
    return;
  }

  // Register navigation listeners
  if (chrome.webNavigation) {
    // onCommitted fires earlier than onCompleted
    chrome.webNavigation.onCommitted.addListener(handleNavigation);
    // Also listen for activation to ensure icon sync
    chrome.tabs.onActivated.addListener(handleActivation);
    
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
      chrome.webNavigation.onCommitted.removeListener(handleNavigation);
      chrome.tabs.onActivated.removeListener(handleActivation);
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

async function handleActivation(activeInfo) {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) {
    runSiteCheck(tab.id, tab.url);
  }
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
      setToolbarIcon(tabId, cachedEntry.hasFeed ? 'active' : 'default');
      return;
    }

    // 2. Fetch and Discovery
    const hasFeed = await performDiscovery(feedMenuUrl);
    
    // 3. Update Cache (Atomic-ish)
    // Re-get to minimize race conditions during the fetch
    const freshStorage = await chrome.storage.local.get(['discoveryCache']);
    const freshCache = freshStorage.discoveryCache || {};
    
    freshCache[hostname] = {
      hasFeed: hasFeed,
      timestamp: Date.now()
    };
    
    // Prune cache if it gets too large (> 500 domains)
    const keys = Object.keys(freshCache);
    if (keys.length > 500) {
      delete freshCache[keys[0]];
    }
    
    await chrome.storage.local.set({ discoveryCache: freshCache });

    // 4. Update Icon
    setToolbarIcon(tabId, hasFeed ? 'active' : 'default');

  } catch (e) {
    // Fail silently but log for debug
    console.warn("Discovery failed for", tabUrl, e);
  }
}

async function performDiscovery(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for background check

    const response = await fetch(url, { 
      signal: controller.signal,
      cache: 'no-cache'
    });
    clearTimeout(timeoutId);
    
    return response.ok;
  } catch (e) {
    return false;
  }
}

function setToolbarIcon(tabId, type) {
  // Ensure we provide a consistent set of resolutions
  const path = type === 'active' 
    ? {
        "16": "icons/icon16.png",
        "19": "icons/icon32.png", // Use 32 for 19 if missing
        "32": "icons/icon32.png",
        "38": "icons/icon48.png", // Use 48 for 38 if missing
        "48": "icons/icon48.png"
      }
    : {
        "16": "icons/toolbar16.png",
        "19": "icons/toolbar19.png",
        "32": "icons/toolbar32.png",
        "38": "icons/toolbar38.png",
        "48": "icons/icon48.png"
      };

  chrome.action.setIcon({
    tabId: tabId,
    path: path
  }).catch(() => {
    // Ignore errors if tab is already closed
  });

  setFeedBadge(tabId, type === 'active');
}

// On Safari, mark the button with a small badge when the site has feeds (and
// clear it otherwise), since the icon color swap above is invisible there.
// No-op on other browsers, which signal via the icon color instead.
function setFeedBadge(tabId, hasFeed) {
  if (!IS_SAFARI || !chrome.action || !chrome.action.setBadgeText) return;

  Promise.resolve(
    chrome.action.setBadgeText({ tabId: tabId, text: hasFeed ? '•' : '' })
  ).catch(() => {});

  if (hasFeed && chrome.action.setBadgeBackgroundColor) {
    Promise.resolve(
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: FEED_BADGE_COLOR })
    ).catch(() => {});
  }
}
