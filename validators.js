/**
 * Input Validation Utilities
 * Centralized validation logic following DRY principles
 * Reduces 80+ lines of duplicated validation code
 */

// Prevent duplicate injection
if (typeof window.InputValidator === 'undefined') {

class InputValidator {
    /**
     * Validate value against multiple rules
     * @param {any} value - Value to validate
     * @param {Function[]} rules - Array of validation rule functions
     * @returns {{valid: boolean, error: string|null}}
     */
    static validate(value, rules) {
        for (const rule of rules) {
            const result = rule(value);
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true, error: null };
    }

    /**
     * Create required field validator
     * @param {string} errorMessage - Error message if validation fails
     * @returns {Function} Validation rule function
     */
    static required(errorMessage) {
        return (value) => {
            if (!value || value.length === 0) {
                return { valid: false, error: errorMessage };
            }
            return { valid: true };
        };
    }

    /**
     * Create regex pattern validator
     * @param {RegExp} regex - Pattern to match
     * @param {string} errorMessage - Error message if validation fails
     * @returns {Function} Validation rule function
     */
    static pattern(regex, errorMessage) {
        return (value) => {
            if (!regex.test(value)) {
                return { valid: false, error: errorMessage };
            }
            return { valid: true };
        };
    }

    /**
     * Create max length validator
     * @param {number} max - Maximum allowed length
     * @param {string} errorMessage - Error message if validation fails
     * @returns {Function} Validation rule function
     */
    static maxLength(max, errorMessage) {
        return (value) => {
            if (value.length > max) {
                return { valid: false, error: errorMessage };
            }
            return { valid: true };
        };
    }

    /**
     * Create min length validator
     * @param {number} min - Minimum required length
     * @param {string} errorMessage - Error message if validation fails
     * @returns {Function} Validation rule function
     */
    static minLength(min, errorMessage) {
        return (value) => {
            if (value.length < min) {
                return { valid: false, error: errorMessage };
            }
            return { valid: true };
        };
    }

    /**
     * Create blacklist validator
     * @param {string[]} items - Blacklisted values
     * @param {string} errorMessage - Error message if validation fails
     * @returns {Function} Validation rule function
     */
    static blacklist(items, errorMessage) {
        return (value) => {
            if (items.includes(value.toLowerCase())) {
                return { valid: false, error: errorMessage };
            }
            return { valid: true };
        };
    }

    /**
     * Create URL validator with security checks
     * @param {string} errorMessage - Error message if validation fails
     * @param {Object} options - Validation options
     * @param {string[]} options.allowedProtocols - Allowed URL protocols
     * @param {boolean} options.requireHttpsForRemote - Enforce HTTPS for non-local URLs
     * @returns {Function} Validation rule function
     */
    static url(errorMessage, options = {}) {
        return (value) => {
            try {
                const parsed = new URL(value);

                // Check allowed protocols
                if (options.allowedProtocols && !options.allowedProtocols.includes(parsed.protocol)) {
                    return {
                        valid: false,
                        error: `Protocol must be one of: ${options.allowedProtocols.join(', ')}`
                    };
                }

                // SECURITY: Enforce HTTPS for remote servers
                if (options.requireHttpsForRemote && parsed.protocol === 'http:') {
                    const isLocal = parsed.hostname === 'localhost' ||
                                  parsed.hostname === '127.0.0.1' ||
                                  parsed.hostname.startsWith('192.168.') ||
                                  parsed.hostname.startsWith('10.') ||
                                  parsed.hostname.startsWith('172.16.') ||
                                  parsed.hostname.startsWith('172.17.') ||
                                  parsed.hostname.startsWith('172.18.') ||
                                  parsed.hostname.startsWith('172.19.') ||
                                  parsed.hostname.startsWith('172.2') ||
                                  parsed.hostname.startsWith('172.30.') ||
                                  parsed.hostname.startsWith('172.31.');

                    if (!isLocal) {
                        return {
                            valid: false,
                            error: 'HTTPS required for remote servers. HTTP only allowed for localhost/LAN.'
                        };
                    }
                }

                return { valid: true };
            } catch (e) {
                return { valid: false, error: errorMessage };
            }
        };
    }

    /**
     * Create custom validator from function
     * @param {Function} validatorFn - Custom validation function (value) => boolean
     * @param {string} errorMessage - Error message if validation fails
     * @returns {Function} Validation rule function
     */
    static custom(validatorFn, errorMessage) {
        return (value) => {
            try {
                if (!validatorFn(value)) {
                    return { valid: false, error: errorMessage };
                }
                return { valid: true };
            } catch (error) {
                return { valid: false, error: errorMessage };
            }
        };
    }
}

    // Export to window
    window.InputValidator = InputValidator;
}

// Create const reference for backwards compatibility
const InputValidator = window.InputValidator;
