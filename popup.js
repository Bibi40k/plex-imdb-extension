/**
 * Popup Script - Manages extension settings
 * Enterprise-grade refactored version with:
 * - Input validation
 * - Better error handling
 * - User feedback improvements
 */

// Simple logger for popup (logger instance comes from logger.js)
// popupLogger is already defined in logger.js

// DOM elements
let apiKeyInput, saveButton, testButton, clearButton, status, currentKeyDiv, keyValue, toggleKeyVisibility;

/**
 * Sanitize HTML - only allow specific safe tags
 * @param {string} html - HTML string to sanitize
 * @param {string[]} allowedTags - Tags to allow
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html, allowedTags = ['strong', 'em', 'br']) {
    const temp = document.createElement('div');
    temp.textContent = html; // First escape everything
    let result = temp.innerHTML;

    // Only restore explicitly allowed tags
    allowedTags.forEach(tag => {
        const openRegex = new RegExp(`&lt;${tag}&gt;`, 'gi');
        const closeRegex = new RegExp(`&lt;/${tag}&gt;`, 'gi');
        result = result.replace(openRegex, `<${tag}>`);
        result = result.replace(closeRegex, `</${tag}>`);
    });

    return result;
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
                if (message.includes('<strong>') || message.includes('<em>') || message.includes('<br>')) {
                    // Sanitize HTML - only allow safe tags
                    element.innerHTML = sanitizeHTML(message, ['strong', 'em', 'br']);
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

// Get DOM elements
apiKeyInput = document.getElementById('apiKeyInput');
saveButton = document.getElementById('saveButton');
testButton = document.getElementById('testButton');
clearButton = document.getElementById('clearButton');
status = document.getElementById('status');
currentKeyDiv = document.getElementById('currentKey');
keyValue = document.getElementById('keyValue');
toggleKeyVisibility = document.getElementById('toggleKeyVisibility');

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
chrome.storage.sync.get(['omdbApiKey'], (result) => {
    if (result.omdbApiKey) {
        apiKeyInput.value = result.omdbApiKey;
        // Don't show "Current key" since it's already visible in input field
        popupLogger.info('Existing API key loaded');
    }
});

/**
 * Validate API key format
 * MEDIUM FIX #12: Input validation
 * @param {string} apiKey - API key to validate
 * @returns {{valid: boolean, error: string|null}}
 */
function validateApiKey(apiKey) {
    if (!apiKey) {
        return { valid: false, error: chrome.i18n.getMessage('errorNoApiKey') };
    }

    // OMDB API keys are 8 character hexadecimal
    if (!CONFIG.PATTERNS.API_KEY.test(apiKey)) {
        return {
            valid: false,
            error: chrome.i18n.getMessage('errorInvalidFormat')
        };
    }

    // Check for common test/placeholder keys
    const invalidKeys = [
        'test1234',
        '12345678',
        'abcdefgh',
        'aaaaaaaa',
        '00000000',
        'ffffffff'
    ];

    if (invalidKeys.includes(apiKey.toLowerCase())) {
        return {
            valid: false,
            error: chrome.i18n.getMessage('errorPlaceholder')
        };
    }

    return { valid: true, error: null };
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
 * @param {string} message - Status message
 * @param {string} type - Message type (success, error)
 */
function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
        status.style.display = 'none';
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
        // Save to storage
        chrome.storage.sync.set({ omdbApiKey: apiKey }, () => {
            setButtonState(saveButton, chrome.i18n.getMessage('buttonSaved'), false);
            apiKeyInput.classList.remove('error');
            apiKeyInput.classList.add('success');
            showStatus(chrome.i18n.getMessage('successSaved'), 'success');

            popupLogger.info('API key saved successfully');

            setTimeout(() => {
                setButtonState(saveButton, chrome.i18n.getMessage('saveButton'), false);
                apiKeyInput.classList.remove('success');
            }, CONFIG.BUTTON_RESET_DELAY_MS);
        });
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
 */
clearButton.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        chrome.storage.sync.remove(['omdbApiKey'], () => {
            apiKeyInput.value = '';
            apiKeyInput.classList.remove('error', 'success');
            currentKeyDiv.style.display = 'none';
            showStatus(chrome.i18n.getMessage('successDeleted'), 'success');

            popupLogger.info('API key cleared');
        });
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

popupLogger.info('Popup initialized successfully');
