// Background service worker for Feed Menu extension

// Discovery only needs host access to fetch /.well-known/feed-menu.json from the
// background — NOT webNavigation. We drive it off chrome.tabs.onUpdated rather
// than chrome.webNavigation (see the listener block below for why).
const DISCOVERY_PERMS = {
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

// Discovery listeners must be registered SYNCHRONOUSLY at the top level of the
// service worker. MV3 background workers are non-persistent: Safari (and Chrome)
// unload them when idle and only re-wake them for an event whose listener was
// registered during the worker's *initial* evaluation.
//
// chrome.tabs.onUpdated is always available — registering it needs no
// permission — so the worker reliably wakes on navigation; we then gate the
// actual fetch on host permission inside the handler. We deliberately do NOT use
// chrome.webNavigation here: it only exists once its optional permission is
// granted, and Safari grants host access (Settings -> Websites -> Allow) WITHOUT
// it. So the old webNavigation listener never registered on Safari, the worker
// never woke, and the indicator never appeared.
chrome.tabs.onUpdated.addListener(handleTabUpdated);
chrome.tabs.onActivated.addListener(handleActivation);

// When host access is granted (Safari's Websites settings, or the Chrome/Firefox
// toggle), check the current tab right away so the indicator appears without
// waiting for the next navigation.
chrome.permissions.onAdded.addListener(async (perms) => {
  if (!perms.origins?.length) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) runSiteCheck(tab.id, tab.url);
  } catch (e) { /* no active tab to check */ }
});

// Main Discovery Logic
async function hasDiscoveryPermission() {
  try {
    return await chrome.permissions.contains(DISCOVERY_PERMS);
  } catch (e) {
    return false;
  }
}

// onUpdated fires repeatedly per navigation (loading, title, favicon, …); react
// only when the address changes or the load completes, then gate on host
// permission before fetching.
async function handleTabUpdated(tabId, changeInfo, tab) {
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  if (!(await hasDiscoveryPermission())) return;
  const url = changeInfo.url || tab?.url;
  if (url) runSiteCheck(tabId, url);
}

async function handleActivation(activeInfo) {
  if (!(await hasDiscoveryPermission())) return;
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
