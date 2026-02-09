/**
 * URL Utilities
 * Centralized URL parsing and extraction logic
 * Reduces duplication and improves security with consistent validation
 */

// Prevent duplicate injection
if (typeof window.URLUtils === 'undefined') {

class URLUtils {
    /**
     * Safe URL decoding with length limits to prevent ReDoS
     * @param {string} url - URL to decode
     * @param {number} maxLength - Maximum allowed length before truncation
     * @returns {string} Decoded URL (or original if decode fails)
     */
    static safeDecode(url, maxLength = 2000) {
        // SECURITY: Limit URL length to prevent ReDoS attacks
        if (url.length > maxLength) {
            console.warn(`[URLUtils] URL too long (${url.length}), truncating to ${maxLength}`);
            url = url.substring(0, maxLength);
        }

        try {
            const decoded = decodeURIComponent(url);

            // SECURITY: Validate decoded result isn't suspiciously long (prevent exponential expansion)
            if (decoded.length > maxLength * 2.5) {
                console.warn(`[URLUtils] Decoded URL suspiciously long, using original`);
                return url;
            }

            return decoded;
        } catch (e) {
            // If decode fails, return original URL
            console.debug(`[URLUtils] Failed to decode URL:`, e.message);
            return url;
        }
    }

    /**
     * Extract query parameter from URL with optional validation
     * @param {string} url - URL to parse
     * @param {string} paramName - Parameter name to extract
     * @param {RegExp} validator - Optional regex validator
     * @returns {string|null} Parameter value or null if not found/invalid
     */
    static extractParam(url, paramName, validator = null) {
        try {
            // Try to parse as URL first
            const urlObj = new URL(url);
            const value = urlObj.searchParams.get(paramName);

            if (value && validator && !validator.test(value)) {
                return null;
            }

            return value;
        } catch (e) {
            // Fallback to regex if URL parsing fails
            const pattern = new RegExp(`[?&]${paramName}=([^&]+)`);
            const match = url.match(pattern);

            if (match) {
                try {
                    const value = decodeURIComponent(match[1]);
                    if (validator && !validator.test(value)) {
                        return null;
                    }
                    return value;
                } catch (e) {
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Extract pattern from URL with multiple fallback patterns
     * Tries decoded URL first, then original URL
     * @param {string} url - URL to parse
     * @param {RegExp[]} patterns - Array of regex patterns to try
     * @param {RegExp} validator - Optional validator for extracted value
     * @returns {string|null} Extracted value or null
     */
    static extractPattern(url, patterns, validator = null) {
        const decoded = this.safeDecode(url);

        // Try each pattern on decoded URL first
        for (const pattern of patterns) {
            const match = decoded.match(pattern);
            if (match && match[1]) {
                const value = match[1];
                if (validator && !validator.test(value)) {
                    continue;
                }
                return value;
            }
        }

        // Try original URL if decoded didn't work
        if (decoded !== url) {
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    const value = match[1];
                    if (validator && !validator.test(value)) {
                        continue;
                    }
                    return value;
                }
            }
        }

        return null;
    }

    /**
     * Extract multiple parameters from URL
     * @param {string} url - URL to parse
     * @param {string[]} paramNames - Array of parameter names
     * @returns {Object} Object with parameter values (null if not found)
     */
    static extractParams(url, paramNames) {
        const result = {};

        for (const paramName of paramNames) {
            result[paramName] = this.extractParam(url, paramName);
        }

        return result;
    }

    /**
     * Build URL with query parameters
     * @param {string} baseUrl - Base URL
     * @param {Object} params - Query parameters
     * @returns {string} Full URL with parameters
     */
    static buildUrl(baseUrl, params) {
        const url = new URL(baseUrl);

        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        }

        return url.toString();
    }

    /**
     * Validate URL format and protocol
     * @param {string} url - URL to validate
     * @param {Object} options - Validation options
     * @returns {boolean} True if valid
     */
    static isValid(url, options = {}) {
        const {
            allowedProtocols = ['http:', 'https:'],
            requireHttpsForRemote = false
        } = options;

        try {
            const parsed = new URL(url);

            // Check protocol
            if (!allowedProtocols.includes(parsed.protocol)) {
                return false;
            }

            // Check HTTPS requirement for remote servers
            if (requireHttpsForRemote && parsed.protocol === 'http:') {
                const isLocal = parsed.hostname === 'localhost' ||
                              parsed.hostname === '127.0.0.1' ||
                              parsed.hostname.startsWith('192.168.') ||
                              parsed.hostname.startsWith('10.');

                if (!isLocal) {
                    return false;
                }
            }

            return true;
        } catch (e) {
            return false;
        }
    }
}

    // Export to window
    window.URLUtils = URLUtils;
}

// Create const reference for backwards compatibility
const URLUtils = window.URLUtils;
