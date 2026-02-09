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
     * Get cache size in bytes (approximate)
     * @returns {number}
     */
    getSizeBytes() {
        let size = 0;
        for (const [key, item] of this.cache.entries()) {
            size += key.length * 2; // UTF-16
            size += JSON.stringify(item.value).length * 2;
        }
        return size;
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
