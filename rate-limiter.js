/**
 * Rate limiter with sliding window algorithm
 * Prevents API quota exhaustion
 */

// Prevent duplicate injection
if (typeof window.RateLimiter === 'undefined') {

class RateLimiter {
    constructor(maxRequests = CONFIG.MAX_REQUESTS_PER_HOUR, windowMs = CONFIG.RATE_LIMIT_WINDOW_MS) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }

    /**
     * Cleanup expired requests (internal helper)
     * DRY REFACTOR: Extracted to avoid duplication
     * @private
     * @returns {number} Current timestamp
     */
    _cleanupExpired() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        return now;
    }

    /**
     * Cleanup old requests and cap array size
     */
    cleanup() {
        this._cleanupExpired();

        // Hard cap to prevent unbounded growth in long sessions
        if (this.requests.length > this.maxRequests * 10) {
            this.requests = this.requests.slice(-this.maxRequests);
            logger.warn('Rate limiter array capped', {
                original: this.requests.length,
                capped: this.maxRequests
            });
        }
    }

    /**
     * Acquire a rate limit slot (waits if necessary)
     * @param {number} depth - Recursion depth (internal use)
     * @returns {Promise<void>}
     */
    async acquire(depth = 0) {
        // SECURITY: Prevent infinite recursion / stack overflow DoS
        const MAX_RECURSION_DEPTH = 10;
        if (depth >= MAX_RECURSION_DEPTH) {
            logger.error('Rate limiter max recursion depth exceeded', { depth });
            throw new Error('Rate limiter recursion limit exceeded - possible DoS attempt or timing issue');
        }

        if (!CONFIG.FEATURES.ENABLE_RATE_LIMITING) {
            return; // Rate limiting disabled
        }

        this.cleanup();

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (Date.now() - oldestRequest);

            logger.warn(`Rate limit reached (${this.requests.length}/${this.maxRequests}), waiting ${waitTime}ms`);

            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.acquire(depth + 1); // Retry after waiting with incremented depth
        }

        this.requests.push(Date.now());
    }

    /**
     * Check if we can make a request without waiting
     * DRY REFACTOR: Uses _cleanupExpired()
     * @returns {boolean}
     */
    canRequest() {
        this._cleanupExpired();
        return this.requests.length < this.maxRequests;
    }

    /**
     * Get current rate limit status
     * DRY REFACTOR: Uses _cleanupExpired()
     * @returns {{remaining: number, total: number, resetIn: number}}
     */
    getStatus() {
        const now = this._cleanupExpired();

        const remaining = Math.max(0, this.maxRequests - this.requests.length);
        const resetIn = this.requests.length > 0
            ? this.windowMs - (now - this.requests[0])
            : 0;

        return {
            remaining,
            total: this.maxRequests,
            resetIn,
            window: this.windowMs
        };
    }

    /**
     * Reset rate limiter
     */
    reset() {
        this.requests = [];
    }
}

/**
 * Fetch with automatic retry and exponential backoff
 * HIGH FIX #7: Ensure all code paths properly handle promise rejections
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = CONFIG.MAX_RETRY_ATTEMPTS) {
    // Acquire rate limit slot
    await rateLimiter.acquire();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                cache: 'no-store', // Prevent API key caching
                credentials: 'omit',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Handle rate limiting from server
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 60;
                const waitTime = parseInt(retryAfter) * 1000;

                logger.warn(`API rate limited (429), retrying after ${waitTime}ms`, { attempt, url });

                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // Handle server errors with retry
            if (response.status >= 500) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                lastError = error;

                if (attempt === maxRetries - 1) {
                    throw error;
                }

                const backoff = Math.min(
                    CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
                    CONFIG.MAX_RETRY_DELAY_MS
                );

                logger.warn(`Server error (${response.status}), retrying in ${backoff}ms`, { attempt, url });

                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }

            // Client errors (4xx) - don't retry
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;

        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;

            // Handle timeout specifically
            if (error.name === 'AbortError') {
                logger.warn('Request timeout', { url, attempt, timeout: CONFIG.FETCH_TIMEOUT_MS });
            }

            if (attempt === maxRetries - 1) {
                logger.error('Fetch failed after retries', { error: error.message, url, attempts: maxRetries });
                throw error;
            }

            const backoff = Math.min(
                CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
                CONFIG.MAX_RETRY_DELAY_MS
            );

            logger.warn(`Request failed, retrying in ${backoff}ms`, { attempt, error: error.message, url });

            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }

    // SAFETY: Ensure we never exit without returning or throwing
    // If we somehow reach here, throw the last error or a generic error
    throw lastError || new Error('Fetch failed after all retries with unknown error');
}

    // Export to window
    window.RateLimiter = RateLimiter;
    window.fetchWithRetry = fetchWithRetry;
    window.rateLimiter = new RateLimiter(
        CONFIG.MAX_REQUESTS_PER_HOUR,
        CONFIG.RATE_LIMIT_WINDOW_MS
    );
}

// Create const references for backwards compatibility
const RateLimiter = window.RateLimiter;
const fetchWithRetry = window.fetchWithRetry;
const rateLimiter = window.rateLimiter;
