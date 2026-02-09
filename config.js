/**
 * Configuration constants for Plex IMDb Enhancer
 * Centralized configuration to avoid magic numbers
 */

// Prevent duplicate injection - use window.CONFIG to avoid redeclaration errors
if (typeof window.CONFIG === 'undefined') {
    window.CONFIG = {
    // Polling intervals
    DOM_POLL_INTERVAL_MS: 500,
    DOM_POLL_TIMEOUT_MS: 10000,
    URL_CHANGE_DEBOUNCE_MS: 300,
    INIT_RETRY_DELAY_MS: 100, // Delay before retrying initialization if dependencies missing

    // UI feedback delays
    BUTTON_RESET_DELAY_MS: 2000,
    STATUS_DISPLAY_DURATION_MS: 5000,

    // Cache settings
    CACHE_MAX_SIZE: 100,
    CACHE_TTL_MINUTES: 60,

    // Rate limiting
    MAX_REQUESTS_PER_HOUR: 100,
    RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,

    // Retry logic
    MAX_RETRY_ATTEMPTS: 3,
    INITIAL_RETRY_DELAY_MS: 1000,
    MAX_RETRY_DELAY_MS: 10000,
    FETCH_TIMEOUT_MS: 10000,

    // API configuration
    OMDB_BASE_URL: 'https://www.omdbapi.com/',
    OMDB_TEST_MOVIE: 'Inception',
    OMDB_TEST_YEAR: '2010',

    // Plex API configuration
    PLEX_API_TIMEOUT_MS: 5000, // Faster timeout for local server
    PLEX_DEFAULT_URL: '', // Empty by default - user must configure

    // Selectors - using data-testid for stability
    SELECTORS: {
        METADATA_TITLE: '[data-testid="metadata-title"]',
        METADATA_RATINGS: '[data-testid="metadata-ratings"]',
        METADATA_LINE1: '[data-testid="metadata-line1"]',
        METADATA_LINE2: '[data-testid="metadata-line2"]',
        IMDB_LINK: '.imdb-rating-link',
        IMDB_LOADING: '.imdb-loading-badge',
        IMDB_ERROR: '.imdb-error-badge'
    },

    // Validation patterns
    PATTERNS: {
        IMDB_ID: /^tt\d{7,8}$/,
        API_KEY: /^[a-f0-9]{8}$/i,
        YEAR: /^(19|20)\d{2}$/
    },

    // Logging
    LOG_LEVEL: 'info', // debug, info, warn, error
    MAX_ERROR_LOG_SIZE: 100,

    // Feature flags (default values)
    FEATURES: {
        ENABLE_CACHE: true,
        ENABLE_RATE_LIMITING: true,
        ENABLE_TELEMETRY: false,
        ENABLE_LOADING_INDICATOR: true,
        ENABLE_ERROR_REPORTING: true,
        ENABLE_OFFLINE_FALLBACK: true
    }
};

    // Make config immutable
    Object.freeze(window.CONFIG);
    Object.freeze(window.CONFIG.SELECTORS);
    Object.freeze(window.CONFIG.PATTERNS);
    Object.freeze(window.CONFIG.FEATURES);
}

// Create const reference for backwards compatibility
const CONFIG = window.CONFIG;
