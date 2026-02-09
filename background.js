/**
 * Background Service Worker
 * Enterprise-grade refactored version with:
 * - Fixed duplicate script injection
 * - Proper tab tracking
 * - Error handling
 */

// Simple logger for background context
const bgLog = {
    info: (msg, data) => console.log('[Background]', msg, data || ''),
    debug: (msg, data) => console.log('[Background]', msg, data || ''),
    warn: (msg, data) => console.warn('[Background]', msg, data || ''),
    error: (msg, data) => console.error('[Background]', msg, data || '')
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
            'cache.js',
            'rate-limiter.js',
            'api-client.js',
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

        default:
            bgLog.warn('Unknown message type', { type: message.type });
            sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true; // Keep message channel open for async response
});

/**
 * Handle service worker errors
 */
self.addEventListener('error', (event) => {
    bgLog.error('Service worker error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno
    });
});

/**
 * Handle unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event) => {
    bgLog.error('Unhandled promise rejection', {
        reason: event.reason
    });
});

bgLog.info('Background service worker initialized successfully');
