/**
 * LRU Cache with TTL support
 * Prevents excessive API calls by caching responses
 */

// Prevent duplicate injection
if (typeof window.LRUCache === 'undefined') {

class LRUCache {
    constructor(maxSize = CONFIG.CACHE_MAX_SIZE, ttlMinutes = CONFIG.CACHE_TTL_MINUTES) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttlMinutes * 60 * 1000;
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*|null} Cached value or null if expired/not found
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            this.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        // LRU: Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, item);
        this.hits++;

        return item.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
        // Remove oldest entry if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expiry: Date.now() + this.ttl,
            timestamp: Date.now()
        });
    }

    /**
     * Check if key exists and is not expired
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete specific key
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get cache statistics
     * @returns {{size: number, hits: number, misses: number, hitRate: string}}
     */
    getStats() {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) : '0.00';

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * Get all cache keys
     * @returns {string[]}
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size in bytes (approximate, optimized with sampling)
     * @returns {number}
     */
    getSizeBytes() {
        // Cache the result for 1 minute to avoid expensive recalculation
        if (this._cachedSize && this._cacheSizeTimestamp > Date.now() - 60000) {
            return this._cachedSize;
        }

        let size = 0;
        let count = 0;
        const maxSampleSize = 10; // Sample for estimation

        for (const [key, item] of this.cache.entries()) {
            if (count < maxSampleSize) {
                size += key.length * 2; // UTF-16
                try {
                    size += JSON.stringify(item.value).length * 2;
                } catch (e) {
                    size += 1000; // Estimate for circular refs
                }
                count++;
            } else {
                // Estimate remaining based on average
                const avgSize = size / count;
                size += avgSize * (this.cache.size - count);
                break;
            }
        }

        this._cachedSize = Math.round(size);
        this._cacheSizeTimestamp = Date.now();
        return this._cachedSize;
    }
}

    // Export to window
    window.LRUCache = LRUCache;
    window.apiCache = new LRUCache(
        CONFIG.CACHE_MAX_SIZE,
        CONFIG.CACHE_TTL_MINUTES
    );
}

// Create const references for backwards compatibility
const LRUCache = window.LRUCache;
const apiCache = window.apiCache;
