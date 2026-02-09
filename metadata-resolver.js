/**
 * Metadata Resolver
 * Intelligent resolver: Plex API first, then OMDb fallback
 * Integrates with existing content.js logic
 */

// Prevent duplicate injection
if (typeof window.MetadataResolver === 'undefined') {

class MetadataResolver {
    constructor() {
        this.logger = window.logger || console;
        this.plexClient = window.plexClient;
        this.omdbClient = window.omdbClient;
        this.cache = window.apiCache;
    }

    /**
     * Main resolver: Get IMDb ID with intelligent fallback
     * @param {Object} movieInfo - {title, year} from DOM
     * @returns {Promise<string|null>} IMDb ID (e.g., "tt1234567")
     */
    async resolveIMDbId(movieInfo) {
        this.logger.info('🔍 [MetadataResolver] Starting resolution', movieInfo);

        // Strategy 1: Check if IMDb ID exists in page DOM
        this.logger.debug('🔍 [MetadataResolver] Strategy 1: Checking page DOM for IMDb ID...');
        const pageImdbId = this.findIMDbIdInPage();
        if (pageImdbId) {
            this.logger.info('✅ [MetadataResolver] IMDb ID found in page DOM', { imdbId: pageImdbId });
            return pageImdbId;
        }
        this.logger.debug('❌ [MetadataResolver] No IMDb ID in page DOM');

        // Strategy 2: Try Plex API (if configured)
        this.logger.debug('🔍 [MetadataResolver] Strategy 2: Checking Plex API...');
        const plexAvailable = this.plexClient?.isAvailable();
        this.logger.info('📊 [MetadataResolver] Plex API available?', {
            available: plexAvailable,
            hasClient: !!this.plexClient,
            token: this.plexClient?.plexToken ? '***configured***' : 'NOT SET',
            url: this.plexClient?.plexUrl || 'NOT SET'
        });

        if (plexAvailable) {
            this.logger.info('🚀 [MetadataResolver] Fetching from Plex API...');
            const plexData = await this.plexClient.getIMDbDataFromPage();

            this.logger.info('📦 [MetadataResolver] Plex API response:', {
                hasData: !!plexData,
                imdbId: plexData?.imdbId || 'not found',
                searchTerms: plexData?.searchTerms,
                metadata: plexData?.metadata ? 'present' : 'missing'
            });

            if (plexData?.imdbId) {
                this.logger.info('✅ [MetadataResolver] IMDb ID found via Plex API', {
                    imdbId: plexData.imdbId,
                    source: 'plex-metadata'
                });
                return plexData.imdbId;
            }

            // Plex has metadata but no IMDb ID
            // Use original title for better OMDb search
            if (plexData?.searchTerms) {
                this.logger.info('🔄 [MetadataResolver] Using Plex original title for OMDb search', {
                    originalTitle: plexData.searchTerms.originalTitle,
                    title: plexData.searchTerms.title,
                    year: plexData.searchTerms.year
                });

                const omdbData = await this.omdbClient.searchByTitle(
                    plexData.searchTerms.originalTitle,
                    plexData.searchTerms.year || ''
                );

                if (omdbData?.imdbID) {
                    this.logger.info('✅ [MetadataResolver] IMDb ID found via OMDb (Plex original title)', {
                        imdbId: omdbData.imdbID,
                        originalTitle: plexData.searchTerms.originalTitle
                    });
                    return omdbData.imdbID;
                }
                this.logger.warn('❌ [MetadataResolver] OMDb search failed with Plex title');
            } else {
                this.logger.warn('❌ [MetadataResolver] No search terms from Plex');
            }
        } else {
            this.logger.debug('⏭️ [MetadataResolver] Plex API not configured, skipping');
        }

        // Strategy 3: Fallback to OMDb with DOM-extracted title
        this.logger.debug('🔍 [MetadataResolver] Strategy 3: Fallback to OMDb with DOM title...');
        const omdbData = await this.omdbClient.searchByTitle(
            movieInfo.title,
            movieInfo.year || ''
        );

        if (omdbData?.imdbID) {
            this.logger.info('✅ [MetadataResolver] IMDb ID found via OMDb (DOM title)', {
                imdbId: omdbData.imdbID,
                title: movieInfo.title
            });
            return omdbData.imdbID;
        }

        // No IMDb ID found
        this.logger.warn('❌ [MetadataResolver] Could not resolve IMDb ID after all strategies', movieInfo);
        return null;
    }

    /**
     * Search for IMDb ID in page DOM
     * @returns {string|null} IMDb ID if found
     */
    findIMDbIdInPage() {
        // Look for IMDb links in page
        const imdbLinkPatterns = [
            /imdb\.com\/title\/(tt\d+)/i,
            /imdb\.com\/.*\/(tt\d+)/i,
            /"imdb_id":"(tt\d+)"/i,
            /'imdb_id':'(tt\d+)'/i
        ];

        // Search in all text content
        const bodyText = document.body.innerHTML;

        for (const pattern of imdbLinkPatterns) {
            const match = bodyText.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Get search terms from Plex or DOM
     * @param {Object} movieInfo - {title, year} from DOM
     * @returns {Promise<Object>} {title, year, originalTitle}
     */
    async getSearchTerms(movieInfo) {
        // Try to get better search terms from Plex
        if (this.plexClient?.isAvailable()) {
            const plexData = await this.plexClient.getIMDbDataFromPage();

            if (plexData?.searchTerms) {
                return plexData.searchTerms;
            }
        }

        // Fallback to DOM-extracted data
        return {
            title: movieInfo.title,
            originalTitle: movieInfo.title,
            year: movieInfo.year
        };
    }
}

    // Export to window
    window.MetadataResolver = MetadataResolver;
    window.metadataResolver = new MetadataResolver();
}

// Create const reference for backwards compatibility
const MetadataResolver = window.MetadataResolver;
const metadataResolver = window.metadataResolver;
