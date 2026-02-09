/**
 * Unified OMDb API client with caching, rate limiting, and error handling
 * Replaces scattered fetch calls throughout the codebase
 */

// Prevent duplicate injection
if (typeof window.OMDBClient === 'undefined') {

class OMDBClient {
    constructor() {
        this.baseUrl = CONFIG.OMDB_BASE_URL;
        this.cache = apiCache;
        this.rateLimiter = rateLimiter;
        this.logger = new Logger('OMDBClient');
        this.apiKey = null;

        // Load API key from storage
        this.loadApiKey();

        // Listen for storage changes and reload API key
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes.omdbApiKey) {
                this.logger.info('🔄 [OMDb] API key changed, reloading');
                this.loadApiKey();
            }
        });
    }

    /**
     * Load API key from storage
     * AUTO-RELOAD: Similar to Plex credentials
     */
    async loadApiKey() {
        const storage = window.storageUtils;
        if (!storage) {
            this.logger.warn('StorageUtils not available, using fallback');
            return new Promise((resolve) => {
                chrome.storage.sync.get(['omdbApiKey'], (result) => {
                    this.apiKey = result.omdbApiKey || null;
                    this.logger.info('⚙️ [OMDb] API key loaded', {
                        hasKey: !!this.apiKey,
                        keyLength: this.apiKey ? this.apiKey.length : 0
                    });
                    resolve();
                });
            });
        }

        const result = await storage.get(['omdbApiKey'], { omdbApiKey: null });
        this.apiKey = result.omdbApiKey;

        this.logger.info('⚙️ [OMDb] API key loaded', {
            hasKey: !!this.apiKey,
            keyLength: this.apiKey ? this.apiKey.length : 0
        });

        if (this.apiKey) {
            this.logger.info('✅ [OMDb] API client initialized and ready');
        } else {
            this.logger.debug('⏭️ [OMDb] API key not configured');
        }
    }

    /**
     * Get API key (cached)
     * @returns {Promise<string|null>}
     */
    async getApiKey() {
        // Return cached API key
        return this.apiKey;
    }

    /**
     * Make API request with caching and rate limiting
     * @param {object} params - Query parameters
     * @returns {Promise<object>}
     */
    async request(params) {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not configured');
        }

        // Build full parameters
        const fullParams = new URLSearchParams({
            apikey: apiKey,
            ...params
        });

        const cacheKey = `omdb:${fullParams.toString()}`;

        // Check cache first
        if (CONFIG.FEATURES.ENABLE_CACHE) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                this.logger.debug('Cache hit', { params });
                return cached;
            }
        }

        // Make API request with retry
        const endTimer = this.logger.time('API request');

        try {
            const response = await fetchWithRetry(`${this.baseUrl}?${fullParams}`);
            const data = await response.json();

            endTimer();

            if (data.Response !== 'True') {
                throw new Error(data.Error || 'API request failed');
            }

            // Cache successful response
            if (CONFIG.FEATURES.ENABLE_CACHE) {
                this.cache.set(cacheKey, data);
            }

            return data;

        } catch (error) {
            endTimer();
            this.logger.error('API request failed', { error: error.message, params });
            throw error;
        }
    }

    /**
     * Search movie by title and year
     * @param {string} title - Movie title
     * @param {string} year - Release year (optional)
     * @param {string} type - Media type (movie, series, episode)
     * @returns {Promise<object>}
     */
    async searchByTitle(title, year = '', type = 'movie') {
        if (!title || typeof title !== 'string') {
            throw new Error('Invalid title parameter');
        }

        const params = {
            t: title.trim(),
            type
        };

        if (year && CONFIG.PATTERNS.YEAR.test(year)) {
            params.y = year;
        }

        return this.request(params);
    }

    /**
     * Get movie data by IMDb ID
     * @param {string} imdbId - IMDb ID (format: ttNNNNNNN)
     * @returns {Promise<object>}
     */
    async getByIMDbId(imdbId) {
        // Validate IMDb ID format (XSS protection)
        if (!CONFIG.PATTERNS.IMDB_ID.test(imdbId)) {
            throw new Error(`Invalid IMDb ID format: ${imdbId}`);
        }

        return this.request({
            i: imdbId,
            plot: 'short'
        });
    }

    /**
     * Test API connection
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            await this.searchByTitle(
                CONFIG.OMDB_TEST_MOVIE,
                CONFIG.OMDB_TEST_YEAR
            );
            this.logger.info('API connection test successful');
            return true;
        } catch (error) {
            this.logger.error('API connection test failed', { error: error.message });
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Get rate limiter status
     * @returns {object}
     */
    getRateLimitStatus() {
        return this.rateLimiter.getStatus();
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Cache cleared');
    }
}

    // Export to window
    window.OMDBClient = OMDBClient;
    window.omdbClient = new OMDBClient();
}

// Create const references for backwards compatibility
const OMDBClient = window.OMDBClient;
const omdbClient = window.omdbClient;
