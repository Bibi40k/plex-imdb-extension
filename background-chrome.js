/**
 * Background Service Worker
 * Enterprise-grade refactored version with:
 * - Fixed duplicate script injection
 * - Proper tab tracking
 * - Error handling
 */

// IMMEDIATE TEST - File loading check
console.log('🚀🚀🚀 BACKGROUND.JS IS LOADING 🚀🚀🚀');

// Simple logger for background context
const bgLog = {
    info: (msg, data) => console.log('[PIMDB:Background]', msg, data || ''),
    debug: (msg, data) => console.log('[PIMDB:Background]', msg, data || ''),
    warn: (msg, data) => console.warn('[PIMDB:Background]', msg, data || ''),
    error: (msg, data) => console.error('[PIMDB:Background]', msg, data || '')
};

// Track injected tabs to prevent duplicates
// CRITICAL FIX #2: Prevent duplicate script injection
let injectedTabs = new Set();

// Restore state on service worker startup
chrome.storage.local.get(['injectedTabs'], (result) => {
    if (result.injectedTabs) {
        injectedTabs = new Set(result.injectedTabs);
        bgLog.info('Restored injected tabs', { count: injectedTabs.size });
    }
});

// Persist injected tabs state
function saveInjectedTabs() {
    chrome.storage.local.set({ injectedTabs: Array.from(injectedTabs) });
}

bgLog.info('Background service worker started');

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        bgLog.info('Extension installed for the first time');
        // Open popup for initial configuration
        chrome.action.openPopup().catch(error => {
            bgLog.warn('Could not open popup automatically', { error: error.message });
        });
    } else if (details.reason === 'update') {
        const previousVersion = details.previousVersion;
        const currentVersion = chrome.runtime.getManifest().version;
        bgLog.info('Extension updated', { previousVersion, currentVersion });
    }
});

/**
 * Check if URL is a Plex page
 * @param {string} url - Page URL
 * @returns {boolean}
 */
function isPlexUrl(url) {
    if (!url) return false;

    return url.includes('app.plex.tv') ||
           url.includes(':32400/web') ||
           url.includes('plex.direct');
}

/**
 * Inject content script into tab
 * CRITICAL FIX #2: Single injection per tab with tracking
 * @param {number} tabId - Tab ID
 * @param {string} url - Tab URL
 */
async function injectContentScript(tabId, url) {
    // Skip if already injected
    if (injectedTabs.has(tabId)) {
        bgLog.debug('Content script already injected', { tabId });
        return;
    }

    // Skip if not a Plex URL
    if (!isPlexUrl(url)) {
        bgLog.debug('Not a Plex URL, skipping injection', { tabId, url });
        return;
    }

    try {
        // Inject all required files in order
        const files = [
            'config.js',
            'logger.js',
            'storage-utils.js',
            'validators.js',
            'url-utils.js',
            'cache.js',
            'rate-limiter.js',
            'api-client.js',
            'plex-api-client.js',
            'metadata-resolver.js',
            'content.js'
        ];

        for (const file of files) {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [file]
            });
        }

        injectedTabs.add(tabId);
        saveInjectedTabs();
        bgLog.info('Content script injected successfully', { tabId, url });

    } catch (error) {
        bgLog.error('Failed to inject content script', {
            error: error.message,
            tabId,
            url
        });

        // Remove from tracking if injection failed
        injectedTabs.delete(tabId);
        saveInjectedTabs();
    }
}

/**
 * Handle tab updates
 * Only inject when tab finishes loading
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only inject when page is completely loaded
    if (changeInfo.status !== 'complete') {
        return;
    }

    if (!tab.url) {
        return;
    }

    await injectContentScript(tabId, tab.url);
});

/**
 * Handle tab removal - cleanup tracking
 */
chrome.tabs.onRemoved.addListener((tabId) => {
    if (injectedTabs.has(tabId)) {
        injectedTabs.delete(tabId);
        saveInjectedTabs();
        bgLog.debug('Tab removed from tracking', { tabId });
    }
});

/**
 * Handle tab URL changes (SPA navigation handled by content script)
 * Note: We don't use webNavigation.onHistoryStateUpdated anymore
 * to avoid duplicate injections. Content script handles SPA navigation
 * with its own MutationObserver.
 */

/**
 * Handle messages from content script or popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    bgLog.debug('Message received', { message, sender: sender.tab?.id });

    switch (message.type) {
        case 'getCacheStats':
            // This would be handled by content script
            sendResponse({ success: true });
            break;

        case 'clearCache':
            // Forward to all tabs to clear their caches
            chrome.tabs.query({ url: ['https://app.plex.tv/*', 'http://*:32400/*'] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'clearCache' }).catch(() => {
                        // Tab might not have content script, ignore
                    });
                });
            });
            sendResponse({ success: true });
            break;

        case 'reloadExtension':
            // Reload all Plex tabs
            chrome.tabs.query({ url: ['https://app.plex.tv/*', 'http://*:32400/*'] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.reload(tab.id);
                    injectedTabs.delete(tab.id);
                });
            });
            sendResponse({ success: true });
            break;

        case 'testPlexConnection':
            // Test Plex API connection (bypasses CORS in popup)
            // Firefox: Uses XMLHttpRequest due to fetch restrictions in background scripts
            (async () => {
                try {
                    const { plexToken, plexUrl } = message;

                    bgLog.info('🧪 Testing Plex connection', {
                        url: plexUrl,
                        tokenLength: plexToken?.length,
                        browser: typeof browser !== 'undefined' ? 'Firefox' : 'Chrome'
                    });

                    const testUrl = `${plexUrl}/identity`;
                    bgLog.info('🌐 Fetching:', testUrl);

                    // Firefox workaround: Use XMLHttpRequest instead of fetch
                    const isFirefox = typeof browser !== 'undefined';

                    let response;
                    if (isFirefox) {
                        bgLog.info('🦊 Using XMLHttpRequest for Firefox');
                        response = await new Promise((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open('GET', testUrl);
                            xhr.setRequestHeader('X-Plex-Token', plexToken);
                            xhr.setRequestHeader('Accept', 'application/json');
                            xhr.timeout = 10000;

                            xhr.onload = () => {
                                resolve({
                                    ok: xhr.status >= 200 && xhr.status < 300,
                                    status: xhr.status,
                                    statusText: xhr.statusText,
                                    text: () => Promise.resolve(xhr.responseText),
                                    json: () => Promise.resolve(JSON.parse(xhr.responseText))
                                });
                            };

                            xhr.onerror = () => reject(new Error('Network error'));
                            xhr.ontimeout = () => reject(new Error('Timeout'));
                            xhr.send();
                        });
                    } else {
                        response = await fetch(testUrl, {
                            headers: {
                                'X-Plex-Token': plexToken,
                                'Accept': 'application/json'
                            },
                            signal: AbortSignal.timeout(10000)
                        });
                    }

                    bgLog.info('📡 Response received', {
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok
                    });

                    if (!response.ok) {
                        const errorText = await response.text().catch(() => 'No error text');
                        bgLog.error('❌ HTTP error', {
                            status: response.status,
                            statusText: response.statusText,
                            body: errorText.substring(0, 200)
                        });

                        sendResponse({
                            success: false,
                            error: `HTTP ${response.status}: ${response.statusText}`
                        });
                        return;
                    }

                    const data = await response.json();
                    bgLog.info('📦 Data received', data);

                    if (data.MediaContainer?.machineIdentifier) {
                        bgLog.info('✅ Plex connection successful', {
                            server: data.MediaContainer.friendlyName,
                            version: data.MediaContainer.version
                        });

                        sendResponse({
                            success: true,
                            serverName: data.MediaContainer.friendlyName || 'Plex Server',
                            version: data.MediaContainer.version
                        });
                    } else {
                        bgLog.error('❌ Invalid response structure', data);
                        sendResponse({
                            success: false,
                            error: 'Invalid response from server'
                        });
                    }

                } catch (error) {
                    bgLog.error('❌ Plex connection test failed', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack?.substring(0, 200)
                    });

                    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                        sendResponse({
                            success: false,
                            error: 'Timeout (10s) - server might be slow or unreachable'
                        });
                    } else if (error.message.includes('Failed to fetch')) {
                        sendResponse({
                            success: false,
                            error: 'Network error - check URL format and connectivity'
                        });
                    } else {
                        sendResponse({
                            success: false,
                            error: `${error.name}: ${error.message}`
                        });
                    }
                }
            })();
            return true; // Keep channel open for async response

        default:
            bgLog.warn('Unknown message type', { type: message.type });
            sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true; // Keep message channel open for async response
});

/**
 * Handle background script errors
 * Compatible with both service workers (Chrome) and scripts (Firefox)
 */
if (typeof self !== 'undefined' && self.addEventListener) {
    // Service worker context (Chrome)
    self.addEventListener('error', (event) => {
        bgLog.error('Service worker error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno
        });
    });

    self.addEventListener('unhandledrejection', (event) => {
        bgLog.error('Unhandled promise rejection', {
            reason: event.reason
        });
    });
}

bgLog.info('Background script initialized successfully');
