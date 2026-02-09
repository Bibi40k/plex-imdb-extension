/**
 * Storage utilities with error boundaries
 * Provides centralized error handling for chrome.storage operations
 */

// Prevent duplicate injection
if (typeof window.StorageUtils === 'undefined') {

class StorageUtils {
    constructor() {
        this.logger = window.logger || console;
    }

    /**
     * Get values from storage with error handling
     * @param {string|string[]|Object} keys - Keys to retrieve
     * @param {Object} defaults - Default values if keys don't exist
     * @returns {Promise<Object>} Retrieved values or defaults
     */
    async get(keys, defaults = {}) {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        this.logger.error('Storage get error', {
                            error: chrome.runtime.lastError.message,
                            keys
                        });
                        // Return defaults on error
                        resolve(defaults);
                        return;
                    }

                    // Merge with defaults for missing keys
                    const merged = { ...defaults, ...result };
                    this.logger.debug('Storage get success', { keys, hasValues: Object.keys(result).length });
                    resolve(merged);
                });
            } catch (error) {
                this.logger.error('Storage get exception', {
                    error: error.message,
                    keys
                });
                resolve(defaults);
            }
        });
    }

    /**
     * Set values in storage with error handling
     * @param {Object} items - Key-value pairs to store
     * @param {Function} validator - Optional validation function
     * @returns {Promise<boolean>} Success status
     */
    async set(items, validator = null) {
        return new Promise((resolve) => {
            try {
                // Optional validation before saving
                if (validator) {
                    const validation = validator(items);
                    if (!validation.valid) {
                        this.logger.warn('Storage validation failed', {
                            error: validation.error,
                            items: Object.keys(items)
                        });
                        resolve(false);
                        return;
                    }
                }

                chrome.storage.sync.set(items, () => {
                    if (chrome.runtime.lastError) {
                        this.logger.error('Storage set error', {
                            error: chrome.runtime.lastError.message,
                            items: Object.keys(items)
                        });
                        resolve(false);
                        return;
                    }

                    this.logger.debug('Storage set success', { items: Object.keys(items) });
                    resolve(true);
                });
            } catch (error) {
                this.logger.error('Storage set exception', {
                    error: error.message,
                    items: Object.keys(items)
                });
                resolve(false);
            }
        });
    }

    /**
     * Remove keys from storage with error handling
     * @param {string|string[]} keys - Keys to remove
     * @returns {Promise<boolean>} Success status
     */
    async remove(keys) {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        this.logger.error('Storage remove error', {
                            error: chrome.runtime.lastError.message,
                            keys
                        });
                        resolve(false);
                        return;
                    }

                    this.logger.debug('Storage remove success', { keys });
                    resolve(true);
                });
            } catch (error) {
                this.logger.error('Storage remove exception', {
                    error: error.message,
                    keys
                });
                resolve(false);
            }
        });
    }

    /**
     * Clear all storage with error handling
     * @returns {Promise<boolean>} Success status
     */
    async clear() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.clear(() => {
                    if (chrome.runtime.lastError) {
                        this.logger.error('Storage clear error', {
                            error: chrome.runtime.lastError.message
                        });
                        resolve(false);
                        return;
                    }

                    this.logger.info('Storage cleared successfully');
                    resolve(true);
                });
            } catch (error) {
                this.logger.error('Storage clear exception', {
                    error: error.message
                });
                resolve(false);
            }
        });
    }

    /**
     * Listen for storage changes with error handling
     * @param {Function} callback - Called when storage changes
     * @returns {Function} Unsubscribe function
     */
    onChanged(callback) {
        const listener = (changes, areaName) => {
            try {
                if (areaName === 'sync') {
                    callback(changes);
                }
            } catch (error) {
                this.logger.error('Storage change listener error', {
                    error: error.message
                });
            }
        };

        chrome.storage.onChanged.addListener(listener);

        // Return unsubscribe function
        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }
}

    // Export to window
    window.StorageUtils = StorageUtils;
    window.storageUtils = new StorageUtils();
}

// Create const references for backwards compatibility
const StorageUtils = window.StorageUtils;
const storageUtils = window.storageUtils;
