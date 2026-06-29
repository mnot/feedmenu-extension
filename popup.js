document.addEventListener('DOMContentLoaded', async () => {
  const titleEl = document.querySelector('h1');
  const statusEl = document.getElementById('status');
  const errorStateEl = document.getElementById('error-state');
  const errorTextEl = errorStateEl.querySelector('.error-text');
  const retryBtn = document.getElementById('retry-btn');
  const feedListEl = document.getElementById('feed-list');
  const emptyStateEl = document.getElementById('empty-state');
  const siteUrlEl = document.getElementById('site-url');
  const reloadBtn = document.getElementById('reload-btn');

  let submenuCounter = 0; // declared up front so rendering never hits its TDZ

  async function loadFeedMenu() {
    // Reset UI to the loading state
    titleEl.textContent = 'Feed Menu'; // reset; renderMenu may rename it on success
    statusEl.classList.remove('hidden');
    errorStateEl.classList.add('hidden');
    feedListEl.classList.add('hidden');
    feedListEl.innerHTML = ''; // Clear current items
    emptyStateEl.classList.add('hidden');
    reloadBtn.classList.add('loading');
    reloadBtn.disabled = true;

    try {
      // 1. Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showError("We couldn't find an active tab to check.");
        return;
      }

      const url = new URL(tab.url);
      siteUrlEl.textContent = url.hostname || "Internal Page";

      // 1.1 Check if we can actually run on this page (skip chrome://, about:, extension:// etc)
      if (!url.protocol.startsWith('http')) {
        showError("Feed Menu doesn't work on browser pages like this one. Open a website and try again.");
        return;
      }

      // 2. Derive the /.well-known path
      const feedMenuUrl = `${url.origin}/.well-known/feed-menu.json`;

      // 3. Get user's preferred languages (for localization)
      const languages = await new Promise((resolve) => {
        chrome.i18n.getAcceptLanguages((langs) => {
          resolve(langs || []);
        });
      });

      // 4. Fetch via Script Injection (to bypass CORS on sites like mnot.net)
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (fetchUrl, langs) => {
          try {
            const headers = { 'Accept': 'application/json' };
            if (langs && langs.length > 0) {
              headers['Accept-Language'] = langs.join(', ');
            }
            
            // Add a timeout to the fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(fetchUrl, { 
              headers, 
              cache: 'no-cache',
              signal: controller.signal 
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              return { ok: false, status: response.status };
            }
            const text = await response.text();
            try {
              const json = JSON.parse(text);
              return { ok: true, data: json };
            } catch (e) {
              return { ok: false, parseError: true };
            }
          } catch (e) {
            return { ok: false, fetchError: e.name === 'AbortError' ? 'Timeout' : e.message };
          }
        },
        args: [feedMenuUrl, languages]
      });

      const result = injectionResults?.[0]?.result;

      // 5. Render the feeds
      if (!result) {
        showError("We couldn't read this page. Reload the page, then try again.");
      } else if (!result.ok) {
        if (result.status === 404) {
          showEmpty();
        } else if (result.status) {
          showError(`This site's server had a problem (error ${result.status}). Try again in a moment.`);
        } else if (result.parseError) {
          showError("This site's feed list looks broken, so we can't show it.");
        } else if (result.fetchError === 'Timeout') {
          showError("The site took too long to respond. Check your connection and try again.");
        } else {
          showError("We couldn't reach this site. Check your connection and try again.");
        }
      } else {
        const data = result.data;
        if (data && data.items && Array.isArray(data.items)) {
          // Check if there are any recognized items
          const hasRecognizedItems = data.items.some(isRenderableItem);
          if (!hasRecognizedItems) {
            showError("This site has a feed menu, but there are no feeds in it yet.");
          } else {
            if (data['feed-menu']) {
              titleEl.textContent = data['feed-menu'];
            }
            renderMenu(data.items, feedListEl, url.origin);
          }
        } else {
          showError("We found a feed menu, but it's in a format Feed Menu doesn't support.");
        }
      }
    } catch (error) {
      console.warn("Feed Menu check failed:", error);
      showError("Something went wrong. Try again.");
    } finally {
      reloadBtn.classList.remove('loading');
      reloadBtn.disabled = false;
    }
  }

  // Initial load
  loadFeedMenu();

  // Reload + in-context retry
  reloadBtn.addEventListener('click', loadFeedMenu);
  retryBtn.addEventListener('click', loadFeedMenu);

  // 6. Settings: the gear panel, the auto-discover toggle, and the one-time
  //    first-run offer. Auto-discover is an optional permission, so it lives
  //    quietly behind the gear once the user has made a choice about it.
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const discoveryToggle = document.getElementById('discovery-toggle');
  const discoveryRow = document.getElementById('discovery-row');
  const discoveryHelp = document.getElementById('discovery-help');
  const guidanceOff = document.getElementById('discovery-guidance-off');
  const guidanceOn = document.getElementById('discovery-guidance-on');
  const offerEl = document.getElementById('discovery-offer');
  const offerEnableBtn = document.getElementById('offer-enable');
  const offerDismissBtn = document.getElementById('offer-dismiss');

  // Safari doesn't honor the Chrome optional-permission flow: permissions
  // .request() surfaces no working prompt for host access, so the toggle and
  // the first-run offer can't actually grant anything there. On Safari we drop
  // both and point the user at Safari's own controls instead.
  const isSafari = document.documentElement.dataset.platform === 'safari';

  const DISCOVERY_PERMS = {
    permissions: ['webNavigation'],
    origins: ['*://*/.well-known/feed-menu.json']
  };
  const OFFER_DISMISSED_KEY = 'discoveryOfferDismissed';

  // Keep the toggle and the gear's status dot in lockstep with the real
  // permission state — the dot is the only at-a-glance signal once the panel
  // is closed.
  function syncDiscoveryState(enabled) {
    discoveryToggle.checked = enabled;
    settingsBtn.classList.toggle('discovery-on', enabled);
  }

  let hasPerms = false;
  try {
    hasPerms = await chrome.permissions.contains(DISCOVERY_PERMS);
  } catch (e) {
    hasPerms = false;
  }
  syncDiscoveryState(hasPerms);

  // On Safari, swap the toggle for guidance and never show the first-run
  // offer — there's nothing a JS gesture can grant. The guidance tracks the
  // real permission state so it reads "how to turn on" vs. "it's on".
  if (isSafari) {
    discoveryRow.classList.add('hidden');
    discoveryHelp.classList.add('hidden');
    guidanceOff.classList.toggle('hidden', hasPerms);
    guidanceOn.classList.toggle('hidden', !hasPerms);
  }

  // The offer appears only when discovery is off and the user hasn't yet
  // chosen — enabling or dismissing it retires the offer for good. Skipped on
  // Safari, where its "Turn on" button can't deliver the permission.
  if (!isSafari && !hasPerms) {
    let dismissed = false;
    try {
      const stored = await chrome.storage.local.get(OFFER_DISMISSED_KEY);
      dismissed = Boolean(stored && stored[OFFER_DISMISSED_KEY]);
    } catch (e) {
      dismissed = false;
    }
    if (!dismissed) offerEl.classList.remove('hidden');
  }

  function retireOffer() {
    offerEl.classList.add('hidden');
    Promise.resolve(chrome.storage.local.set({ [OFFER_DISMISSED_KEY]: true })).catch(() => {});
  }

  // Granting the permission needs a user gesture; the offer button and the
  // panel toggle both route through here. Returns whether it was granted.
  async function enableDiscovery() {
    let granted = false;
    try {
      granted = await chrome.permissions.request(DISCOVERY_PERMS);
    } catch (e) {
      granted = false;
    }
    if (granted) {
      syncDiscoveryState(true);
      // Check the current tab right away so the icon lights up now, not on
      // the next navigation.
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.runtime.sendMessage({ type: 'CHECK_NOW', tabId: tab.id, url: tab.url });
      }
    }
    return granted;
  }

  async function disableDiscovery() {
    try {
      await chrome.permissions.remove(DISCOVERY_PERMS);
    } catch (e) { /* keep the current state if removal fails */ }
    syncDiscoveryState(false);
  }

  function setPanelOpen(open) {
    settingsPanel.classList.toggle('hidden', !open);
    settingsBtn.setAttribute('aria-expanded', String(open));
    // The panel is auto-discover's permanent home; don't stack it under the
    // first-run offer for the same control.
    if (open) offerEl.classList.add('hidden');
  }

  settingsBtn.addEventListener('click', () => {
    setPanelOpen(settingsPanel.classList.contains('hidden'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) {
      setPanelOpen(false);
      settingsBtn.focus();
    }
  });

  // First-run offer: either button is a decision, so the offer doesn't return.
  offerEnableBtn.addEventListener('click', async () => {
    await enableDiscovery();
    retireOffer();
  });
  offerDismissBtn.addEventListener('click', retireOffer);

  // Panel toggle: revert the optimistic check if the user denies the prompt.
  discoveryToggle.addEventListener('change', async () => {
    if (discoveryToggle.checked) {
      const granted = await enableDiscovery();
      if (!granted) syncDiscoveryState(false);
      retireOffer();
    } else {
      await disableDiscovery();
    }
  });

  function renderMenu(items, container, origin) {
    statusEl.classList.add('hidden');
    errorStateEl.classList.add('hidden');
    feedListEl.classList.remove('hidden');
    
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      if (item['feed-title']) {
        // It's a feed object
        renderFeedItem(item, container, origin);
      } else if (item['feed-menu'] && Array.isArray(item.items)) {
        // It's a menu object
        renderSubmenu(item, container, origin);
      }
    });
  }

  function isRenderableItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (item['feed-title'] && (item.rss || item.atom)) return true;
    return Boolean(item['feed-menu'] && Array.isArray(item.items) && item.items.some(isRenderableItem));
  }

  function renderFeedItem(feed, container, origin) {
    // Resolve relative URLs - prefer RSS then Atom
    const feedUrl = feed.rss || feed.atom;
    if (!feedUrl) return;

    let absoluteUrl;
    try {
      absoluteUrl = feedUrl.startsWith('http') 
        ? feedUrl 
        : new URL(feedUrl, origin).href;
    } catch (e) {
      absoluteUrl = feedUrl;
    }

    const li = document.createElement('li');
    li.className = 'feed-item';

    const a = document.createElement('a');
    a.href = absoluteUrl;
    a.className = 'feed-link';

    const title = document.createElement('span');
    title.className = 'feed-title';
    title.textContent = feed['feed-title'] || "Untitled Feed";
    a.appendChild(title);

    if (feed.description) {
      const desc = document.createElement('span');
      desc.className = 'feed-description';
      desc.textContent = feed.description;
      a.appendChild(desc);
    }

    const urlDisp = document.createElement('span');
    urlDisp.className = 'feed-url';
    urlDisp.textContent = absoluteUrl;

    // Live region so screen readers announce the handoff / copy result.
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge hidden';
    statusBadge.setAttribute('role', 'status');
    statusBadge.setAttribute('aria-live', 'polite');

    a.appendChild(urlDisp);
    a.appendChild(statusBadge);

    // Always-available fallback: copy the feed URL. The handoff below needs a
    // feed reader installed; copying gives users a path even without one.
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-btn';
    copyBtn.setAttribute('aria-label', `Copy URL for ${feed['feed-title'] || 'feed'}`);
    copyBtn.title = 'Copy feed URL';
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

    li.appendChild(a);
    li.appendChild(copyBtn);
    container.appendChild(li);

    let badgeTimer;
    function flashBadge(text) {
      statusBadge.textContent = text;
      statusBadge.classList.remove('hidden');
      clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => statusBadge.classList.add('hidden'), 2000);
    }

    // Handle Click for Seamless Handoff to a feed reader.
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.shiftKey || e.ctrlKey) return;
      e.preventDefault();

      flashBadge('Opening in your feed reader…');
      const protocolUrl = absoluteUrl.replace(/^https?:\/\//, 'feed://');
      triggerHandoff(protocolUrl);
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        flashBadge('Link copied');
      } catch (err) {
        flashBadge('Copy failed — select the URL to copy it');
      }
    });
  }

  function renderSubmenu(menu, container, origin) {
    const li = document.createElement('li');
    li.className = 'menu-item has-submenu';

    const submenuId = `submenu-${submenuCounter++}`;

    // A real <button> so the submenu opens via mouse, keyboard, and touch alike
    // (the previous hover-only expansion was unreachable by keyboard).
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'menu-title';
    title.setAttribute('aria-expanded', 'false');
    title.setAttribute('aria-controls', submenuId);

    const label = document.createElement('span');
    label.className = 'menu-label';
    label.textContent = menu['feed-menu'];
    title.appendChild(label);

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';
    title.appendChild(chevron);

    const submenuUl = document.createElement('ul');
    submenuUl.className = 'submenu';
    submenuUl.id = submenuId;

    renderMenu(menu.items, submenuUl, origin);

    title.addEventListener('click', () => {
      const isOpen = li.classList.toggle('open');
      title.setAttribute('aria-expanded', String(isOpen));
    });

    li.appendChild(title);
    li.appendChild(submenuUl);
    container.appendChild(li);
  }

  function triggerHandoff(url) {
    // Use chrome.tabs.update to trigger the protocol handler in the current tab.
    // This is more reliable in Safari than hidden iframes.
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.update(tab.id, { url: url });
      }
    });
  }

  function showEmpty() {
    statusEl.classList.add('hidden');
    errorStateEl.classList.add('hidden');
    feedListEl.classList.add('hidden');
    emptyStateEl.classList.remove('hidden');
  }

  function showError(msg) {
    statusEl.classList.add('hidden');
    feedListEl.classList.add('hidden');
    emptyStateEl.classList.add('hidden');
    errorTextEl.textContent = msg;
    errorStateEl.classList.remove('hidden');
  }
});
