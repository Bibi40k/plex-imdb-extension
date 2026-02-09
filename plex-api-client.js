/**
 * Plex API Client
 * Fetches metadata directly from Plex Media Server
 * Integrates with existing extension architecture
 */

// Prevent duplicate injection
if (typeof window.PlexAPIClient === 'undefined') {

class PlexAPIClient {
    constructor() {
        this.logger = window.logger || console;
        this.cache = window.apiCache;
        this.plexToken = null;
        this.plexUrl = null;

        // Load Plex credentials from storage
        this.loadCredentials();

        // Listen for storage changes and reload credentials
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && (changes.plexToken || changes.plexUrl)) {
                this.logger.info('🔄 [PlexAPI] Storage changed, reloading credentials');
                this.loadCredentials();
            }
        });
    }

    /**
     * Load Plex token from storage
     * MEDIUM FIX: Use StorageUtils for consistent error handling
     */
    async loadCredentials() {
        const storage = window.storageUtils || window.StorageUtils;
        if (!storage) {
            this.logger.warn('⚠️ [PlexAPI] StorageUtils not available, using fallback');
            // Fallback to direct chrome.storage
            return new Promise((resolve) => {
                chrome.storage.sync.get(['plexToken', 'plexUrl'], (result) => {
                    this.plexToken = result.plexToken || null;
                    this.plexUrl = result.plexUrl || null;
                    resolve();
                });
            });
        }

        const result = await storage.get(['plexToken', 'plexUrl'], {
            plexToken: null,
            plexUrl: null
        });

        this.plexToken = result.plexToken || null;
        this.plexUrl = result.plexUrl || null;

        this.logger.info('⚙️ [PlexAPI] Credentials loaded', {
            hasToken: !!this.plexToken,
            tokenLength: this.plexToken ? this.plexToken.length : 0,
            url: this.plexUrl || 'NOT SET'
        });

        if (this.plexToken && this.plexUrl) {
            this.logger.info('✅ [PlexAPI] Plex API client initialized and ready');
        } else {
            this.logger.debug('⏭️ [PlexAPI] Plex API not configured (missing token or URL)');
        }
    }

    /**
     * Check if Plex API is available
     * @returns {boolean}
     */
    isAvailable() {
        return !!(this.plexToken && this.plexUrl);
    }

    /**
     * Extract rating key from Plex URL
     * DRY REFACTOR: Using URLUtils for consistent URL parsing
     * @param {string} url - Current page URL
     * @returns {string|null} Rating key
     */
    extractRatingKey(url) {
        // Match patterns like:
        // /server/{serverId}/details?key=/library/metadata/{ratingKey}
        // /server/{serverId}/details?key=%2Flibrary%2Fmetadata%2F{ratingKey} (URL-encoded)
        // /library/metadata/{ratingKey}

        const patterns = [
            /[?&]key=\/library\/metadata\/(\d+)/,
            /\/library\/metadata\/(\d+)/,
            /ratingKey=(\d+)/
        ];

        const ratingKey = URLUtils.extractPattern(url, patterns, /^\d+$/);

        if (ratingKey) {
            this.logger.debug('Rating key extracted', { ratingKey });
        } else {
            this.logger.debug('Could not extract rating key from URL');
        }

        return ratingKey;
    }

    /**
     * Fetch metadata for a specific item
     * @param {string} ratingKey - Plex rating key
     * @returns {Promise<Object|null>} Metadata object
     */
    async fetchMetadata(ratingKey) {
        if (!this.isAvailable()) {
            this.logger.debug('Plex API not available');
            return null;
        }

        const cacheKey = `plex_metadata_${ratingKey}`;
        const cached = this.cache?.get(cacheKey);
        if (cached) {
            this.logger.debug('Plex metadata cache hit', { ratingKey });
            return cached;
        }

        try {
            // Build Plex API URL
            const apiUrl = `${this.plexUrl}/library/metadata/${ratingKey}`;

            this.logger.debug('Fetching Plex metadata', { ratingKey, apiUrl });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.PLEX_API_TIMEOUT_MS);

            const response = await fetch(apiUrl, {
                headers: {
                    'X-Plex-Token': this.plexToken,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.MediaContainer?.Metadata?.[0]) {
                this.logger.warn('Invalid Plex metadata response', { ratingKey });
                return null;
            }

            const metadata = data.MediaContainer.Metadata[0];

            // Cache the result
            if (this.cache) {
                this.cache.set(cacheKey, metadata);
            }

            this.logger.info('Plex metadata fetched successfully', {
                ratingKey,
                title: metadata.title,
                originalTitle: metadata.originalTitle,
                year: metadata.year
            });

            return metadata;

        } catch (error) {
            if (error.name === 'AbortError') {
                this.logger.warn('Plex API request timeout', { ratingKey });
            } else {
                this.logger.error('Failed to fetch Plex metadata', {
                    error: error.message,
                    ratingKey
                });
            }
            return null;
        }
    }

    /**
     * Extract IMDb ID from Plex metadata
     * @param {Object} metadata - Plex metadata object
     * @returns {string|null} IMDb ID (e.g., "tt1234567")
     */
    extractIMDbId(metadata) {
        if (!metadata) return null;

        // Check Guid field for IMDb ID
        // Format: "com.plexapp.agents.imdb://tt1234567" or array of guids
        const guids = metadata.Guid || [];

        for (const guid of guids) {
            const id = guid.id || guid;

            // Match IMDb pattern
            const imdbMatch = id.match(/imdb:\/\/(tt\d+)/i) ||
                            id.match(/(tt\d{7,})/i);

            if (imdbMatch) {
                const imdbId = imdbMatch[1];
                this.logger.debug('Found IMDb ID in Plex metadata', { imdbId });
                return imdbId;
            }
        }

        this.logger.debug('No IMDb ID found in Plex metadata', {
            title: metadata.title,
            guids: guids.length
        });

        return null;
    }

    /**
     * Get best title for searching
     * Returns original title if available, otherwise title
     * @param {Object} metadata - Plex metadata object
     * @returns {Object} {title, year, originalTitle}
     */
    getBestSearchTerms(metadata) {
        if (!metadata) return null;

        return {
            title: metadata.title,
            originalTitle: metadata.originalTitle || metadata.title,
            year: metadata.year || null,
            type: metadata.type // 'movie' or 'show'
        };
    }

    /**
     * Main method: Get IMDb data from current page
     * @returns {Promise<Object|null>} {imdbId, searchTerms}
     */
    async getIMDbDataFromPage() {
        const url = window.location.href;
        this.logger.info('🎬 [PlexAPI] Extracting rating key from URL', { url });

        const ratingKey = this.extractRatingKey(url);

        if (!ratingKey) {
            this.logger.warn('⚠️ [PlexAPI] No rating key found in URL', { url });
            return null;
        }

        this.logger.info('🔑 [PlexAPI] Rating key extracted', { ratingKey });

        const metadata = await this.fetchMetadata(ratingKey);
        if (!metadata) {
            this.logger.warn('⚠️ [PlexAPI] No metadata received');
            return null;
        }

        this.logger.info('📦 [PlexAPI] Metadata received', {
            title: metadata.title,
            originalTitle: metadata.originalTitle,
            year: metadata.year,
            type: metadata.type,
            guidCount: metadata.Guid?.length || 0
        });

        // Try to get IMDb ID directly
        const imdbId = this.extractIMDbId(metadata);

        // Get search terms (with original title)
        const searchTerms = this.getBestSearchTerms(metadata);

        const result = {
            imdbId,
            searchTerms,
            metadata // Full metadata for debugging
        };

        this.logger.info('✅ [PlexAPI] Returning data', {
            hasImdbId: !!imdbId,
            imdbId: imdbId || 'not found',
            searchTerms
        });

        return result;
    }
}

    // Export to window
    window.PlexAPIClient = PlexAPIClient;
    window.plexClient = new PlexAPIClient();
}

// Create const reference for backwards compatibility
const PlexAPIClient = window.PlexAPIClient;
const plexClient = window.plexClient;
