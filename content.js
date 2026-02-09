/**
 * Plex IMDb Enhancer - Content Script
 * Enterprise-grade refactored version with:
 * - Fixed memory leaks
 * - XSS protection
 * - Error handling
 * - Performance optimizations
 * - Proper cleanup
 */

// Prevent duplicate injection
if (window.PLEX_IMDB_INITIALIZED) {
    console.log('[PlexIMDB] Content script already initialized, skipping...');
} else {
    window.PLEX_IMDB_INITIALIZED = true;

// State management
let urlObserver = null;
let elementObserver = null;
let lastUrl = location.href;
let isProcessing = false;

// Inject CSS styles
const styles = `
    .imdb-rating-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        margin-left: 8px;
        background: linear-gradient(135deg, #f5c518 0%, #e6b800 100%);
        color: #000 !important;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        font-size: 12px;
        text-decoration: none !important;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        border: 1px solid #d4a00a;
        height: 24px;
        vertical-align: middle;
    }

    .imdb-rating-link:hover {
        background: linear-gradient(135deg, #ffd700 0%, #f5c518 100%);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .imdb-rating-link:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .imdb-logo {
        width: 32px;
        height: 16px;
        background-color: #000;
        color: #f5c518;
        font-weight: bold;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 2px;
        font-family: Arial, sans-serif;
    }

    .imdb-rating-value {
        font-size: 13px;
        font-weight: bold;
        color: #000;
    }

    .imdb-max-rating {
        font-size: 11px;
        color: #666;
        margin-left: 1px;
    }

    .imdb-loading-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        margin-left: 8px;
        height: 24px;
    }

    .imdb-error-badge {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        color: #ff4444;
        cursor: help;
        font-size: 16px;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

logger.info('Extension loaded', { url: location.href });

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Initialize URL change observer with cleanup
 * CRITICAL FIX #1: Proper MutationObserver cleanup
 */
function initializeUrlObserver() {
    // Disconnect existing observer (prevent memory leak)
    if (urlObserver) {
        urlObserver.disconnect();
        urlObserver = null;
    }

    const debouncedUrlChange = debounce(onUrlChange, CONFIG.URL_CHANGE_DEBOUNCE_MS);

    urlObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            logger.debug('URL changed', { url });
            debouncedUrlChange();
        }
    });

    urlObserver.observe(document, {
        subtree: true,
        childList: true
    });

    logger.debug('URL observer initialized');
}

/**
 * Check if current page is a movie details page
 * @returns {boolean}
 */
function isMovieDetailsPage() {
    return location.href.includes('/details') ||
           document.querySelector(CONFIG.SELECTORS.METADATA_TITLE) !== null;
}

/**
 * Wait for required elements to appear in DOM
 * CRITICAL FIX #5: Replace interval polling with MutationObserver
 * @returns {Promise<{title: Element, ratings: Element}>}
 */
function waitForElements() {
    return new Promise((resolve, reject) => {
        const endTimer = logger.time('waitForElements');

        // Check if elements already exist
        const checkElements = () => {
            const title = document.querySelector(CONFIG.SELECTORS.METADATA_TITLE);
            const ratings = document.querySelector(CONFIG.SELECTORS.METADATA_RATINGS);

            if (title && ratings) {
                return { title, ratings };
            }
            return null;
        };

        const elements = checkElements();
        if (elements) {
            endTimer();
            resolve(elements);
            return;
        }

        // Disconnect existing observer
        if (elementObserver) {
            elementObserver.disconnect();
        }

        // Watch for elements to appear
        elementObserver = new MutationObserver(() => {
            const elements = checkElements();
            if (elements) {
                elementObserver.disconnect();
                elementObserver = null;
                clearTimeout(timeoutHandle);
                endTimer();
                resolve(elements);
            }
        });

        elementObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Timeout fallback
        const timeoutHandle = setTimeout(() => {
            if (elementObserver) {
                elementObserver.disconnect();
                elementObserver = null;
            }
            endTimer();
            reject(new Error('Timeout waiting for elements'));
        }, CONFIG.DOM_POLL_TIMEOUT_MS);
    });
}

/**
 * Extract movie information from page
 * @returns {{title: string, year: string|null}|null}
 */
function extractMovieInfo() {
    const titleElement = document.querySelector(CONFIG.SELECTORS.METADATA_TITLE);

    if (!titleElement) {
        logger.warn('Title element not found');
        return null;
    }

    const title = titleElement.textContent.trim();

    // Extract year from metadata-line1 (format: "2023    1hr 54min    PG-13")
    const metadataLine1 = document.querySelector(CONFIG.SELECTORS.METADATA_LINE1);
    let year = null;

    if (metadataLine1) {
        const yearMatch = metadataLine1.textContent.match(/^(\d{4})/);
        if (yearMatch && CONFIG.PATTERNS.YEAR.test(yearMatch[1])) {
            year = yearMatch[1];
            logger.debug('Year extracted from metadata', { year });
        }
    }

    // Fallback: Try to find in URL
    if (!year) {
        const urlMatch = location.href.match(/year=(\d{4})/);
        if (urlMatch && CONFIG.PATTERNS.YEAR.test(urlMatch[1])) {
            year = urlMatch[1];
            logger.debug('Year extracted from URL', { year });
        }
    }

    return { title, year };
}

/**
 * Find IMDb ID in page metadata (structured data, meta tags)
 * HIGH FIX #10: Safe metadata search instead of full HTML regex
 * @returns {string|null}
 */
function findIMDbIdInPage() {
    // 1. Check structured data (JSON-LD)
    const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldJsonScripts) {
        try {
            const data = JSON.parse(script.textContent);
            const imdbId = extractIMDbIdFromStructuredData(data);
            if (imdbId) {
                logger.debug('IMDb ID found in structured data', { imdbId });
                return imdbId;
            }
        } catch (e) {
            // Invalid JSON, skip
        }
    }

    // 2. Check meta tags
    const metaTags = [
        'meta[property="imdb:id"]',
        'meta[name="imdb:id"]',
        'meta[property="og:url"]',
        'link[rel="canonical"]'
    ];

    for (const selector of metaTags) {
        const element = document.querySelector(selector);
        if (element) {
            const content = element.getAttribute('content') || element.getAttribute('href') || '';
            const match = content.match(CONFIG.PATTERNS.IMDB_ID);
            if (match) {
                logger.debug('IMDb ID found in meta tag', { imdbId: match[0] });
                return match[0];
            }
        }
    }

    // 3. Check visible text only (not HTML) - last resort
    const bodyText = document.body.textContent;
    const match = bodyText.match(CONFIG.PATTERNS.IMDB_ID);
    if (match) {
        logger.debug('IMDb ID found in page text', { imdbId: match[0] });
        return match[0];
    }

    return null;
}

/**
 * Extract IMDb ID from structured data (recursive)
 * @param {object} data - Structured data object
 * @returns {string|null}
 */
function extractIMDbIdFromStructuredData(data) {
    if (typeof data !== 'object' || data === null) return null;

    // Check direct IMDb ID fields
    if (data.imdbId && CONFIG.PATTERNS.IMDB_ID.test(data.imdbId)) {
        return data.imdbId;
    }

    // Check URLs
    const urlFields = ['url', 'sameAs', '@id'];
    for (const field of urlFields) {
        if (data[field]) {
            const urls = Array.isArray(data[field]) ? data[field] : [data[field]];
            for (const url of urls) {
                if (typeof url === 'string') {
                    const match = url.match(CONFIG.PATTERNS.IMDB_ID);
                    if (match) return match[0];
                }
            }
        }
    }

    // Recursively check nested objects
    for (const key in data) {
        if (typeof data[key] === 'object') {
            const result = extractIMDbIdFromStructuredData(data[key]);
            if (result) return result;
        }
    }

    return null;
}

/**
 * Find IMDb ID for movie
 * HIGH FIX #6: Uses caching via OMDBClient
 * @param {{title: string, year: string|null}} movieInfo
 * @returns {Promise<string|null>}
 */
async function findIMDbId(movieInfo) {
    // Try to find IMDb ID in page first (faster, no API call)
    const imdbIdFromPage = findIMDbIdInPage();
    if (imdbIdFromPage) {
        logger.info('IMDb ID found in page', { imdbId: imdbIdFromPage });
        return imdbIdFromPage;
    }

    // Fall back to API search
    try {
        const data = await omdbClient.searchByTitle(movieInfo.title, movieInfo.year || '');
        const imdbId = data.imdbID;

        if (imdbId) {
            logger.info('IMDb ID found via API', { imdbId, title: movieInfo.title });
            return imdbId;
        }
    } catch (error) {
        logger.error('Failed to find IMDb ID', { error: error.message, movieInfo });
    }

    return null;
}

/**
 * Get IMDb rating and votes
 * HIGH FIX #6: Uses caching via OMDBClient
 * @param {string} imdbId
 * @returns {Promise<{rating: string|null, votes: string|null}>}
 */
async function getIMDbRating(imdbId) {
    try {
        const data = await omdbClient.getByIMDbId(imdbId);

        return {
            rating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
            votes: data.imdbVotes !== 'N/A' ? data.imdbVotes : null
        };
    } catch (error) {
        logger.error('Failed to get IMDb rating', { error: error.message, imdbId });
        return { rating: null, votes: null };
    }
}

/**
 * Create sanitized IMDb link element
 * CRITICAL FIX #3: XSS protection with input validation
 * @param {string} imdbId - IMDb ID (validated format)
 * @param {string|null} rating - Rating value
 * @param {string|null} votes - Vote count
 * @returns {HTMLAnchorElement}
 */
function createIMDbLink(imdbId, rating, votes) {
    // CRITICAL: Validate IMDb ID format (XSS protection)
    if (!CONFIG.PATTERNS.IMDB_ID.test(imdbId)) {
        logger.error('Invalid IMDb ID format', { imdbId });
        throw new Error(`Invalid IMDb ID format: ${imdbId}`);
    }

    const link = document.createElement('a');
    link.className = 'imdb-rating-link';
    link.href = `https://www.imdb.com/title/${imdbId}/`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const logo = document.createElement('div');
    logo.className = 'imdb-logo';
    logo.textContent = 'IMDb';
    link.appendChild(logo);

    if (rating && rating !== 'N/A') {
        // Sanitize rating - must be numeric
        const sanitizedRating = parseFloat(rating);
        if (!isNaN(sanitizedRating) && sanitizedRating >= 0 && sanitizedRating <= 10) {
            const ratingSpan = document.createElement('span');
            ratingSpan.className = 'imdb-rating-value';
            ratingSpan.textContent = sanitizedRating.toFixed(1);
            link.appendChild(ratingSpan);

            const maxRatingSpan = document.createElement('span');
            maxRatingSpan.className = 'imdb-max-rating';
            maxRatingSpan.textContent = '/10';
            link.appendChild(maxRatingSpan);
        }
    }

    // Sanitize votes - remove HTML, only keep numbers and commas
    if (votes) {
        const sanitizedVotes = votes.replace(/[^\d,]/g, '');
        const sanitizedRating = rating && rating !== 'N/A' ? parseFloat(rating).toFixed(1) : 'N/A';
        link.title = `${sanitizedRating}/10 (${sanitizedVotes} votes)\nClick to open on IMDb`;
    } else {
        link.title = 'Click to open on IMDb';
    }

    return link;
}

/**
 * Create loading indicator
 * LOW FIX #17: User feedback during loading
 * @returns {HTMLSpanElement}
 */
function createLoadingBadge() {
    const badge = document.createElement('span');
    badge.className = 'imdb-loading-badge';

    const logo = document.createElement('span');
    logo.className = 'imdb-logo';
    logo.textContent = 'IMDb';
    badge.appendChild(logo);

    const loadingText = document.createElement('span');
    loadingText.style.cssText = 'font-size: 11px; color: #888;';
    loadingText.textContent = 'Loading...';
    badge.appendChild(loadingText);

    return badge;
}

/**
 * Create error badge
 * HIGH FIX #7: User feedback for errors
 * @param {string} message - Error message
 * @returns {HTMLSpanElement}
 */
function createErrorBadge(message) {
    const badge = document.createElement('span');
    badge.className = 'imdb-error-badge';
    badge.textContent = '⚠️';
    badge.title = message;
    return badge;
}

/**
 * Add IMDb link to page
 * HIGH FIX #7: Comprehensive error handling
 */
async function addIMDbLink() {
    // Prevent concurrent processing
    if (isProcessing) {
        logger.debug('Already processing, skipping');
        return;
    }

    isProcessing = true;
    const endTimer = logger.time('addIMDbLink');

    try {
        // Check if link already exists
        const ratingContainer = document.querySelector(CONFIG.SELECTORS.METADATA_RATINGS);
        if (!ratingContainer) {
            logger.debug('Rating container not found');
            return;
        }

        if (ratingContainer.querySelector(CONFIG.SELECTORS.IMDB_LINK)) {
            logger.debug('IMDb link already exists');
            return;
        }

        // Show loading indicator
        let loadingBadge = null;
        if (CONFIG.FEATURES.ENABLE_LOADING_INDICATOR) {
            loadingBadge = createLoadingBadge();
            ratingContainer.appendChild(loadingBadge);
        }

        // Extract movie info
        const movieInfo = extractMovieInfo();
        if (!movieInfo) {
            logger.warn('Could not extract movie info');
            loadingBadge?.remove();
            ratingContainer.appendChild(createErrorBadge('Movie info not found'));
            return;
        }

        logger.info('Movie info extracted', movieInfo);

        // Find IMDb ID
        const imdbId = await findIMDbId(movieInfo);
        if (!imdbId) {
            logger.warn('IMDb ID not found', { movieInfo });
            loadingBadge?.remove();
            ratingContainer.appendChild(createErrorBadge('IMDb ID not found'));
            return;
        }

        logger.info('IMDb ID found', { imdbId });

        // Get IMDb rating
        const imdbData = await getIMDbRating(imdbId);

        // Replace loading badge with actual link
        loadingBadge?.remove();

        const imdbLink = createIMDbLink(imdbId, imdbData.rating, imdbData.votes);
        ratingContainer.appendChild(imdbLink);

        logger.info('IMDb link added successfully', {
            imdbId,
            rating: imdbData.rating,
            title: movieInfo.title
        });

    } catch (error) {
        logger.error('Error in addIMDbLink', {
            error: error.message,
            stack: error.stack
        });

        // Clean up loading badge
        document.querySelector(CONFIG.SELECTORS.IMDB_LOADING)?.remove();

        // Show error badge
        const ratingContainer = document.querySelector(CONFIG.SELECTORS.METADATA_RATINGS);
        if (ratingContainer && !ratingContainer.querySelector(CONFIG.SELECTORS.IMDB_ERROR)) {
            ratingContainer.appendChild(createErrorBadge('Error loading IMDb data'));
        }
    } finally {
        isProcessing = false;
        endTimer();
    }
}

/**
 * Handle URL change
 */
async function onUrlChange() {
    logger.debug('URL change handler triggered');

    if (isMovieDetailsPage()) {
        logger.info('Movie details page detected');

        try {
            await waitForElements();
            await addIMDbLink();
        } catch (error) {
            logger.error('Error handling URL change', {
                error: error.message,
                url: location.href
            });
        }
    } else {
        logger.debug('Not a movie details page');
    }
}

/**
 * Cleanup function for page unload
 * CRITICAL FIX #1: Proper cleanup to prevent memory leaks
 */
function cleanup() {
    logger.info('Cleaning up extension');

    if (urlObserver) {
        urlObserver.disconnect();
        urlObserver = null;
    }

    if (elementObserver) {
        elementObserver.disconnect();
        elementObserver = null;
    }

    isProcessing = false;
}

// Register cleanup handler
window.addEventListener('unload', cleanup);

// Initialize
initializeUrlObserver();

// Check if we're already on a movie page
if (isMovieDetailsPage()) {
    logger.info('Initial load on movie details page');
    onUrlChange();
}

logger.info('Content script initialized successfully');

} // End of duplicate injection check
