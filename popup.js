document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const feedListEl = document.getElementById('feed-list');
  const emptyStateEl = document.getElementById('empty-state');
  const siteUrlEl = document.getElementById('site-url');
  const reloadBtn = document.getElementById('reload-btn');

  async function loadFeedMenu() {
    // Reset UI state
    statusEl.classList.remove('hidden');
    
    // Ensure loader exists
    let loader = statusEl.querySelector('.loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.className = 'loader';
      statusEl.appendChild(loader);
    }
    
    // Ensure span exists
    let span = statusEl.querySelector('span');
    if (!span) {
      span = document.createElement('span');
      statusEl.appendChild(span);
    }
    span.textContent = 'Searching for feeds...';
    
    feedListEl.classList.add('hidden');
    feedListEl.innerHTML = ''; // Clear current items
    emptyStateEl.classList.add('hidden');
    reloadBtn.classList.add('loading');
    reloadBtn.disabled = true;

    try {
      // 1. Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showError("No active tab found.");
        return;
      }

      const url = new URL(tab.url);
      siteUrlEl.textContent = url.hostname || "Internal Page";

      // 1.1 Check if we can actually run on this page (skip chrome://, about:, extension:// etc)
      if (!url.protocol.startsWith('http')) {
        showError("Feed Menu cannot run on internal browser pages.");
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
        showError("Failed to communicate with the page.");
      } else if (!result.ok) {
        if (result.status === 404) {
          showEmpty();
        } else if (result.status) {
          showError(`Server error: ${result.status}`);
        } else if (result.parseError) {
          showError("The feed menu document is malformed.");
        } else if (result.fetchError === 'Timeout') {
          showError("The request timed out.");
        } else {
          showError("Could not fetch the feed menu.");
        }
      } else {
        const data = result.data;
        if (data && data.items && Array.isArray(data.items)) {
          // Check if there are any recognized items
          const hasRecognizedItems = data.items.some(isRenderableItem);
          if (!hasRecognizedItems) {
            showError("The feed menu contains no recognized feeds.");
          } else {
            if (data['feed-menu']) {
              const h1 = document.querySelector('h1');
              if (h1) h1.textContent = data['feed-menu'];
            }
            renderMenu(data.items, feedListEl, url.origin);
          }
        } else {
          showError("The feed menu is not in a recognized format.");
        }
      }
    } catch (error) {
      console.warn("Feed Menu check failed:", error);
      showError("An unexpected error occurred.");
    } finally {
      reloadBtn.classList.remove('loading');
      reloadBtn.disabled = false;
    }
  }

  // Initial load
  loadFeedMenu();

  // Reload button listener
  reloadBtn.addEventListener('click', loadFeedMenu);

  // 6. Handle Discovery Toggle
  const discoveryToggle = document.getElementById('discovery-toggle');
  const DISCOVERY_PERMS = {
    permissions: ['webNavigation'],
    origins: ['*://*/.well-known/feed-menu.json']
  };

  // Sync toggle state with actual permissions
  const hasPerms = await chrome.permissions.contains(DISCOVERY_PERMS);
  discoveryToggle.checked = hasPerms;

  discoveryToggle.addEventListener('change', async () => {
    if (discoveryToggle.checked) {
      const granted = await chrome.permissions.request(DISCOVERY_PERMS);
      if (granted) {
        // Trigger an immediate check for the current tab so it lights up now
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.runtime.sendMessage({ 
            type: 'CHECK_NOW', 
            tabId: tab.id, 
            url: tab.url 
          });
        }
      } else {
        discoveryToggle.checked = false;
      }
    } else {
      await chrome.permissions.remove(DISCOVERY_PERMS);
    }
  });

  function renderMenu(items, container, origin) {
    statusEl.classList.add('hidden');
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
    
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge hidden';
    statusBadge.textContent = 'Opening in Reader...';
    
    a.appendChild(urlDisp);
    a.appendChild(statusBadge);
    li.appendChild(a);
    container.appendChild(li);

    // Handle Click for Seamless Handoff
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.shiftKey || e.ctrlKey) return;
      e.preventDefault();
      
      statusBadge.classList.remove('hidden');
      setTimeout(() => statusBadge.classList.add('hidden'), 2000);

      const protocolUrl = absoluteUrl.replace(/^https?:\/\//, 'feed://');
      triggerHandoff(protocolUrl);
    });
  }

  function renderSubmenu(menu, container, origin) {
    const li = document.createElement('li');
    li.className = 'menu-item has-submenu';
    
    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = menu['feed-menu'];
    
    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '›';
    title.appendChild(chevron);
    
    const submenuUl = document.createElement('ul');
    submenuUl.className = 'submenu';
    
    renderMenu(menu.items, submenuUl, origin);
    
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
    emptyStateEl.classList.remove('hidden');
  }

  function showError(msg) {
    statusEl.classList.remove('hidden');
    let span = statusEl.querySelector('span');
    if (!span) {
      statusEl.innerHTML = '<span></span>';
      span = statusEl.querySelector('span');
    }
    span.textContent = msg;
    const loader = statusEl.querySelector('.loader');
    if (loader) loader.remove();
  }
});
