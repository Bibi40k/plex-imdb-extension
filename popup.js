/**
 * Popup Script - Manages extension settings
 * Enterprise-grade refactored version with:
 * - Input validation
 * - Better error handling
 * - User feedback improvements
 */

// Simple logger for popup (logger instance comes from logger.js)
// popupLogger is already defined in logger.js

// DOM elements - OMDb
let apiKeyInput, saveButton, testButton, clearButton, status, currentKeyDiv, keyValue, toggleKeyVisibility;

// DOM elements - Plex
let plexToggle, plexContent, plexTokenInput, plexUrlInput, savePlexButton, testPlexButton, clearPlexButton, plexStatus, togglePlexVisibility, quickSetupInput, quickSetupStatus;

/**
 * Sanitize HTML - only allow specific safe tags WITHOUT attributes
 * SECURITY: Prevents XSS by stripping all attributes (onclick, onload, etc.)
 * @param {string} html - HTML string to sanitize
 * @param {string[]} allowedTags - Tags to allow (without attributes)
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html, allowedTags = ['strong', 'em', 'br', 'code']) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Whitelist approach: only keep allowed tags without attributes
    const walker = document.createTreeWalker(
        temp,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
    );

    const nodesToRemove = [];
    let currentNode = walker.currentNode;

    while (currentNode) {
        const tagName = currentNode.tagName.toLowerCase();

        if (!allowedTags.includes(tagName)) {
            // Tag not allowed - remove it but keep its children
            nodesToRemove.push(currentNode);
        } else {
            // Tag allowed - but remove ALL attributes to prevent XSS
            while (currentNode.attributes.length > 0) {
                currentNode.removeAttribute(currentNode.attributes[0].name);
            }
        }

        currentNode = walker.nextNode();
    }

    // Remove disallowed tags (replace with their text content)
    nodesToRemove.forEach(node => {
        node.replaceWith(...node.childNodes);
    });

    return temp.innerHTML;
}

/**
 * Initialize i18n translations
 */
function initializeI18n() {
    // Translate all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            if (element.tagName === 'TITLE') {
                document.title = message;
            } else {
                // Check if message contains HTML tags
                if (message.includes('<strong>') || message.includes('<em>') || message.includes('<br>') || message.includes('<code>')) {
                    // Sanitize HTML - only allow safe tags
                    element.innerHTML = sanitizeHTML(message, ['strong', 'em', 'br', 'code']);
                } else {
                    // Use textContent for safety
                    element.textContent = message;
                }
            }
        }
    });

    // Translate placeholder
    if (apiKeyInput) {
        const placeholder = chrome.i18n.getMessage('placeholder');
        if (placeholder) {
            apiKeyInput.placeholder = placeholder;
        }
    }

    popupLogger.info('i18n initialized', { locale: chrome.i18n.getUILanguage() });
}

// Get DOM elements - OMDb
apiKeyInput = document.getElementById('apiKeyInput');
saveButton = document.getElementById('saveButton');
testButton = document.getElementById('testButton');
clearButton = document.getElementById('clearButton');
status = document.getElementById('status');
currentKeyDiv = document.getElementById('currentKey');
keyValue = document.getElementById('keyValue');
toggleKeyVisibility = document.getElementById('toggleKeyVisibility');

// Get DOM elements - Plex
plexToggle = document.getElementById('plexToggle');
plexContent = document.getElementById('plexContent');
quickSetupInput = document.getElementById('quickSetupInput');
quickSetupStatus = document.getElementById('quickSetupStatus');
plexTokenInput = document.getElementById('plexTokenInput');
plexUrlInput = document.getElementById('plexUrlInput');
savePlexButton = document.getElementById('savePlexButton');
testPlexButton = document.getElementById('testPlexButton');
clearPlexButton = document.getElementById('clearPlexButton');
plexStatus = document.getElementById('plexStatus');
togglePlexVisibility = document.getElementById('togglePlexVisibility');

// Initialize translations
initializeI18n();

// Toggle API key visibility
toggleKeyVisibility.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKeyVisibility.textContent = '🙈'; // Hide icon
    } else {
        apiKeyInput.type = 'password';
        toggleKeyVisibility.textContent = '👁️'; // Show icon
    }
});

// Load existing API key
// DRY REFACTOR: Using StorageUtils
(async () => {
    const result = await storageUtils.get(['omdbApiKey'], { omdbApiKey: null });
    if (result.omdbApiKey) {
        apiKeyInput.value = result.omdbApiKey;
        // Don't show "Current key" since it's already visible in input field
        popupLogger.info('Existing API key loaded');
    }
})();

/**
 * Validate API key format
 * DRY REFACTOR: Using InputValidator utility (reduces duplication)
 * @param {string} apiKey - API key to validate
 * @returns {{valid: boolean, error: string|null}}
 */
function validateApiKey(apiKey) {
    return InputValidator.validate(apiKey, [
        InputValidator.required(chrome.i18n.getMessage('errorNoApiKey')),
        InputValidator.pattern(
            CONFIG.PATTERNS.API_KEY,
            chrome.i18n.getMessage('errorInvalidFormat')
        ),
        InputValidator.blacklist(
            ['test1234', '12345678', 'abcdefgh', 'aaaaaaaa', '00000000', 'ffffffff'],
            chrome.i18n.getMessage('errorPlaceholder')
        )
    ]);
}

/**
 * Test API key by making a test request
 * @param {string} apiKey - API key to test
 * @returns {Promise<boolean>}
 */
async function testApiKey(apiKey) {
    try {
        const params = new URLSearchParams({
            apikey: apiKey,
            t: CONFIG.OMDB_TEST_MOVIE,
            y: CONFIG.OMDB_TEST_YEAR
        });

        const response = await fetch(`${CONFIG.OMDB_BASE_URL}?${params}`, {
            cache: 'no-store',
            credentials: 'omit'
        });

        const data = await response.json();

        if (data.Response === 'True') {
            popupLogger.info('API key test successful');
            return true;
        } else {
            popupLogger.warn('API key test failed', { error: data.Error });
            return false;
        }
    } catch (error) {
        popupLogger.error('API key test error', { error: error.message });
        return false;
    }
}

/**
 * Show status message to user
 * DRY REFACTOR: Unified function for both OMDb and Plex status messages
 * @param {string} message - Status message
 * @param {string} type - Message type (success, error)
 * @param {HTMLElement} statusElement - Optional status element (defaults to main status)
 */
function showStatus(message, type, statusElement = status) {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
        statusElement.style.display = 'none';
    }, CONFIG.STATUS_DISPLAY_DURATION_MS);
}

/**
 * Show current API key
 * @param {string} key - API key to display
 */
function showCurrentKey(key) {
    if (key) {
        // Show only first 4 and last 2 characters for security
        const masked = `${key.substring(0, 4)}••${key.substring(6)}`;
        keyValue.textContent = masked;
        keyValue.title = 'Click to reveal full key';
        keyValue.style.cursor = 'pointer';

        // Toggle full key on click
        keyValue.onclick = () => {
            if (keyValue.textContent === masked) {
                keyValue.textContent = key;
            } else {
                keyValue.textContent = masked;
            }
        };

        currentKeyDiv.style.display = 'block';
    }
}

/**
 * Set button state
 * @param {HTMLButtonElement} button - Button element
 * @param {string} text - Button text
 * @param {boolean} disabled - Disabled state
 */
function setButtonState(button, text, disabled) {
    button.textContent = text;
    button.disabled = disabled;
}

/**
 * Save API key
 */
saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    // Validate format
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
        showStatus(validation.error, 'error');
        apiKeyInput.classList.add('error');
        popupLogger.warn('Invalid API key format', { apiKey: apiKey.substring(0, 4) + '...' });
        return;
    }

    setButtonState(saveButton, chrome.i18n.getMessage('buttonVerifying'), true);

    // Test API key
    const isValid = await testApiKey(apiKey);

    if (isValid) {
        // Save to storage - DRY REFACTOR: Using StorageUtils
        const saved = await storageUtils.set({ omdbApiKey: apiKey });

        if (saved) {
            setButtonState(saveButton, chrome.i18n.getMessage('buttonSaved'), false);
            apiKeyInput.classList.remove('error');
            apiKeyInput.classList.add('success');
            showStatus(chrome.i18n.getMessage('successSaved'), 'success');

            popupLogger.info('API key saved successfully');

            setTimeout(() => {
                setButtonState(saveButton, chrome.i18n.getMessage('saveButton'), false);
                apiKeyInput.classList.remove('success');
            }, CONFIG.BUTTON_RESET_DELAY_MS);
        } else {
            setButtonState(saveButton, chrome.i18n.getMessage('buttonInvalidKey'), false);
            showStatus('Failed to save API key', 'error');
        }
    } else {
        setButtonState(saveButton, chrome.i18n.getMessage('buttonInvalidKey'), false);
        apiKeyInput.classList.add('error');
        showStatus(chrome.i18n.getMessage('errorInvalidKey'), 'error');

        popupLogger.warn('API key validation failed');

        setTimeout(() => {
            setButtonState(saveButton, chrome.i18n.getMessage('saveButton'), false);
        }, CONFIG.BUTTON_RESET_DELAY_MS);
    }
});

/**
 * Test API key without saving
 */
testButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    // Validate format
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
        showStatus(validation.error, 'error');
        popupLogger.warn('Invalid API key format for testing');
        return;
    }

    setButtonState(testButton, chrome.i18n.getMessage('buttonTesting'), true);

    const isValid = await testApiKey(apiKey);

    if (isValid) {
        setButtonState(testButton, chrome.i18n.getMessage('buttonValid'), false);
        showStatus(chrome.i18n.getMessage('successTestValid'), 'success');
        apiKeyInput.classList.remove('error');
        apiKeyInput.classList.add('success');

        popupLogger.info('API key test passed');
    } else {
        setButtonState(testButton, chrome.i18n.getMessage('buttonInvalid'), false);
        showStatus(chrome.i18n.getMessage('errorTestInvalid'), 'error');
        apiKeyInput.classList.add('error');

        popupLogger.warn('API key test failed');
    }

    setTimeout(() => {
        setButtonState(testButton, chrome.i18n.getMessage('testButton'), false);
        apiKeyInput.classList.remove('success');
    }, CONFIG.BUTTON_RESET_DELAY_MS);
});

/**
 * Clear API key
 * DRY REFACTOR: Using StorageUtils
 */
clearButton.addEventListener('click', async () => {
    if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        const removed = await storageUtils.remove(['omdbApiKey']);

        if (removed) {
            apiKeyInput.value = '';
            apiKeyInput.classList.remove('error', 'success');
            currentKeyDiv.style.display = 'none';
            showStatus(chrome.i18n.getMessage('successDeleted'), 'success');

            popupLogger.info('API key cleared');
        } else {
            showStatus('Failed to clear API key', 'error');
        }
    }
});

/**
 * Save on Enter key
 */
apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveButton.click();
    }
});

/**
 * Remove error state on input
 */
apiKeyInput.addEventListener('input', () => {
    apiKeyInput.classList.remove('error', 'success');
});

// ============================================================================
// PLEX CONFIGURATION HANDLERS
// ============================================================================

/**
 * Show Plex status message
 * DRY REFACTOR: Now uses unified showStatus() function
 */
function showPlexStatus(message, type) {
    showStatus(message, type, plexStatus);
}

/**
 * Validate Plex token format and length
 * DRY REFACTOR: Using InputValidator utility (reduces duplication)
 * @param {string} token - Plex token to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validatePlexToken(token) {
    return InputValidator.validate(token, [
        InputValidator.required('Plex token is required'),
        InputValidator.maxLength(100, 'Plex token too long (max 100 characters)'),
        InputValidator.pattern(
            /^[a-zA-Z0-9_-]+$/,
            'Invalid token format (alphanumeric, hyphens, underscores only)'
        )
    ]);
}

/**
 * Validate Plex server URL format and length
 * DRY REFACTOR: Using InputValidator utility (reduces duplication)
 * @param {string} url - Plex server URL to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validatePlexUrl(url) {
    return InputValidator.validate(url, [
        InputValidator.required('Plex server URL is required'),
        InputValidator.maxLength(300, 'URL too long (max 300 characters)'),
        InputValidator.url('Invalid URL format', {
            allowedProtocols: ['http:', 'https:'],
            requireHttpsForRemote: true
        })
    ]);
}

/**
 * Collapsible toggle for advanced settings
 */
plexToggle.addEventListener('click', () => {
    plexContent.classList.toggle('open');
    popupLogger.debug('Advanced settings toggled');
});

/**
 * Quick Setup - Extract token and URL from pasted XML URL
 */
quickSetupInput.addEventListener('paste', (e) => {
    // Let the paste happen first
    setTimeout(() => {
        const pastedUrl = quickSetupInput.value.trim();

        popupLogger.info('Quick setup - processing pasted URL', {
            urlLength: pastedUrl.length,
            hasToken: pastedUrl.includes('X-Plex-Token')
        });

        // Extract token: X-Plex-Token=abc123
        const tokenMatch = pastedUrl.match(/X-Plex-Token=([^&\s]+)/);
        const token = tokenMatch ? tokenMatch[1] : null;

        // Extract server URL: https://...plex.direct:32400 (everything before /library or first path)
        const serverMatch = pastedUrl.match(/(https?:\/\/[^\/\s]+)/);
        const serverUrl = serverMatch ? serverMatch[1] : null;

        popupLogger.info('Quick setup - extraction result', {
            hasToken: !!token,
            hasServerUrl: !!serverUrl,
            tokenLength: token?.length,
            serverUrl
        });

        // Validate and populate
        if (token && serverUrl) {
            // Success! Populate fields
            plexTokenInput.value = token;
            plexUrlInput.value = serverUrl;

            // AUTO-SAVE to storage immediately! - DRY REFACTOR: Using StorageUtils
            (async () => {
                const saved = await storageUtils.set({ plexToken: token, plexUrl: serverUrl });

                if (!saved) {
                    quickSetupStatus.className = 'error';
                    quickSetupStatus.textContent = '❌ ' + (chrome.i18n.getMessage('errorSaveFailed') ||
                        'Failed to save settings');
                    popupLogger.error('Quick setup - save failed');
                    return;
                }

                // Show success message
                quickSetupStatus.className = 'success';
                quickSetupStatus.innerHTML = '✅ ' + (chrome.i18n.getMessage('quickSetupSuccess') ||
                    `Extracted & saved!<br>Token: ${token.substring(0, 8)}...<br>Server: ${serverUrl}`);

                popupLogger.info('Quick setup successful - saved to storage');

                // Clear quick setup input
                setTimeout(() => {
                    quickSetupInput.value = '';
                }, 500);

                // Hide status after delay
                setTimeout(() => {
                    quickSetupStatus.style.display = 'none';
                }, 5000);
            })();

        } else if (!pastedUrl.includes('X-Plex-Token')) {
            // Not a Plex XML URL
            quickSetupStatus.className = 'error';
            quickSetupStatus.textContent = '❌ ' + (chrome.i18n.getMessage('quickSetupInvalid') ||
                'Invalid URL. Please paste the full URL from "View XML" (must contain X-Plex-Token)');

            setTimeout(() => {
                quickSetupStatus.style.display = 'none';
            }, 5000);

            popupLogger.warn('Quick setup failed - not a Plex XML URL');

        } else {
            // Has token but couldn't extract properly
            quickSetupStatus.className = 'error';
            quickSetupStatus.textContent = '❌ ' + (chrome.i18n.getMessage('quickSetupExtractionFailed') ||
                'Could not extract token/URL. Please check the URL format.');

            setTimeout(() => {
                quickSetupStatus.style.display = 'none';
            }, 5000);

            popupLogger.warn('Quick setup failed - extraction error', {
                hasToken: !!token,
                hasServerUrl: !!serverUrl
            });
        }
    }, 10);
});

/**
 * Toggle Plex token visibility
 */
togglePlexVisibility.addEventListener('click', () => {
    if (plexTokenInput.type === 'password') {
        plexTokenInput.type = 'text';
        togglePlexVisibility.textContent = '🙈';
    } else {
        plexTokenInput.type = 'password';
        togglePlexVisibility.textContent = '👁️';
    }
});

/**
 * Load existing Plex settings
 * DRY REFACTOR: Using StorageUtils
 */
(async () => {
    const result = await storageUtils.get(['plexToken', 'plexUrl'], {
        plexToken: null,
        plexUrl: null
    });

    if (result.plexToken) {
        plexTokenInput.value = result.plexToken;
        popupLogger.info('Plex token loaded');
    }

    if (result.plexUrl) {
        plexUrlInput.value = result.plexUrl;
        popupLogger.info('Plex URL loaded');
    }
    // Note: No default URL - user must configure from XML URL
})();

/**
 * Test Plex connection via background service worker (bypasses CORS)
 * @param {string} plexToken - Plex token
 * @param {string} plexUrl - Plex server URL
 * @returns {Promise<{success: boolean, serverName?: string, error?: string}>}
 */
async function testPlexConnection(plexToken, plexUrl) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            {
                type: 'testPlexConnection',
                plexToken,
                plexUrl
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    resolve(response);
                }
            }
        );
    });
}

/**
 * Test Plex connection button
 */
testPlexButton.addEventListener('click', async () => {
    const plexToken = plexTokenInput.value.trim();
    const plexUrl = plexUrlInput.value.trim();

    // Validate token
    const tokenValidation = validatePlexToken(plexToken);
    if (!tokenValidation.valid) {
        showPlexStatus(tokenValidation.error, 'error');
        plexTokenInput.classList.add('error');
        return;
    }

    // Validate URL
    const urlValidation = validatePlexUrl(plexUrl);
    if (!urlValidation.valid) {
        showPlexStatus(urlValidation.error, 'error');
        plexUrlInput.classList.add('error');
        return;
    }

    setButtonState(testPlexButton, chrome.i18n.getMessage('buttonTesting') || '⏳ Testing...', true);

    const result = await testPlexConnection(plexToken, plexUrl);

    if (result.success) {
        setButtonState(testPlexButton, chrome.i18n.getMessage('buttonValid') || '✅ Valid!', false);
        showPlexStatus(
            (chrome.i18n.getMessage('successPlexTest') || '✅ Connected to: {SERVER}').replace('{SERVER}', result.serverName),
            'success'
        );
        plexTokenInput.classList.remove('error');
        plexUrlInput.classList.remove('error');
        plexTokenInput.classList.add('success');
        plexUrlInput.classList.add('success');

        popupLogger.info('Plex connection test passed', result);
    } else {
        setButtonState(testPlexButton, chrome.i18n.getMessage('buttonInvalid') || '❌ Invalid!', false);
        showPlexStatus(
            (chrome.i18n.getMessage('errorPlexTest') || '❌ Connection failed: {ERROR}').replace('{ERROR}', result.error),
            'error'
        );
        plexTokenInput.classList.add('error');
        plexUrlInput.classList.add('error');

        popupLogger.warn('Plex connection test failed', result);
    }

    setTimeout(() => {
        setButtonState(testPlexButton, chrome.i18n.getMessage('testPlexButton') || '🧪 Test Plex Connection', false);
        plexTokenInput.classList.remove('success');
        plexUrlInput.classList.remove('success');
    }, CONFIG.BUTTON_RESET_DELAY_MS);
});

/**
 * Save Plex settings
 * DRY REFACTOR: Now async to use StorageUtils
 */
savePlexButton.addEventListener('click', async () => {
    const plexToken = plexTokenInput.value.trim();
    const plexUrl = plexUrlInput.value.trim();

    // Both token and URL are optional
    // If user provides one, they should provide both
    if ((plexToken && !plexUrl) || (!plexToken && plexUrl)) {
        showPlexStatus(
            chrome.i18n.getMessage('errorPlexIncomplete') || 'Please provide both Plex token and URL, or leave both empty',
            'error'
        );
        return;
    }

    // Validate token if provided
    if (plexToken) {
        const tokenValidation = validatePlexToken(plexToken);
        if (!tokenValidation.valid) {
            showPlexStatus(tokenValidation.error, 'error');
            plexTokenInput.classList.add('error');
            return;
        }
    }

    // Validate URL if provided
    if (plexUrl) {
        const urlValidation = validatePlexUrl(plexUrl);
        if (!urlValidation.valid) {
            showPlexStatus(urlValidation.error, 'error');
            plexUrlInput.classList.add('error');
            return;
        }
    }

    // Save to storage - DRY REFACTOR: Using StorageUtils
    const saved = await storageUtils.set({ plexToken, plexUrl });

    if (!saved) {
        showPlexStatus(
            chrome.i18n.getMessage('errorSaveFailed') || 'Failed to save Plex settings',
            'error'
        );
        popupLogger.error('Failed to save Plex settings');
        return;
    }

    setButtonState(savePlexButton, chrome.i18n.getMessage('buttonSaved') || '✅ Saved', false);
    showPlexStatus(
        chrome.i18n.getMessage('successPlexSaved') || '✅ Plex settings saved! Reload Plex page to apply.',
        'success'
    );

    popupLogger.info('Plex settings saved successfully');

    setTimeout(() => {
        setButtonState(savePlexButton, chrome.i18n.getMessage('savePlexButton') || '💾 Save Plex Settings', false);
    }, CONFIG.BUTTON_RESET_DELAY_MS);
});

/**
 * Clear Plex settings
 * DRY REFACTOR: Using StorageUtils
 */
clearPlexButton.addEventListener('click', async () => {
    if (confirm(chrome.i18n.getMessage('confirmDeletePlex') || 'Are you sure you want to clear Plex settings?')) {
        const removed = await storageUtils.remove(['plexToken', 'plexUrl']);

        if (removed) {
            plexTokenInput.value = '';
            plexUrlInput.value = '';
            showPlexStatus(
                chrome.i18n.getMessage('successPlexDeleted') || '🗑️ Plex settings cleared',
                'success'
            );

            popupLogger.info('Plex settings cleared');
        } else {
            showPlexStatus('Failed to clear Plex settings', 'error');
        }
    }
});

/**
 * Remove error state on Plex input
 */
plexTokenInput.addEventListener('input', () => {
    plexTokenInput.classList.remove('error', 'success');
});

plexUrlInput.addEventListener('input', () => {
    plexUrlInput.classList.remove('error', 'success');
});

popupLogger.info('Popup initialized successfully');
