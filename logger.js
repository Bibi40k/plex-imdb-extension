/**
 * Structured logging framework with level support
 * Replaces scattered console.log statements
 */

// Prevent duplicate injection
if (typeof window.Logger === 'undefined') {

class Logger {
    constructor(namespace, minLevel = CONFIG.LOG_LEVEL) {
        this.namespace = namespace;
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        this.minLevel = this.levels[minLevel] || this.levels.info;
    }

    /**
     * Internal logging method with level filtering
     */
    _log(level, message, ...args) {
        if (this.levels[level] < this.minLevel) return;

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${this.namespace}] [${level.toUpperCase()}]`;

        const method = level === 'error' ? console.error :
                      level === 'warn' ? console.warn :
                      console.log;

        method(prefix, message, ...args);

        // Report errors to storage for debugging
        if (level === 'error' && CONFIG.FEATURES.ENABLE_ERROR_REPORTING) {
            this.reportError(message, args);
        }
    }

    debug(message, ...args) {
        this._log('debug', message, ...args);
    }

    info(message, ...args) {
        this._log('info', message, ...args);
    }

    warn(message, ...args) {
        this._log('warn', message, ...args);
    }

    error(message, ...args) {
        this._log('error', message, ...args);
    }

    /**
     * Report error to local storage for debugging
     */
    reportError(message, details) {
        try {
            chrome.storage.local.get(['errorLog'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to read error log:', chrome.runtime.lastError);
                    return;
                }

                const errorLog = result.errorLog || [];
                errorLog.push({
                    timestamp: Date.now(),
                    namespace: this.namespace,
                    message,
                    details: this.sanitizeForStorage(details)
                });

                // Keep last N errors only
                if (errorLog.length > CONFIG.MAX_ERROR_LOG_SIZE) {
                    errorLog.shift();
                }

                chrome.storage.local.set({ errorLog }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to save error log:', chrome.runtime.lastError);
                    }
                });
            });
        } catch (e) {
            console.error('Failed to report error:', e);
        }
    }

    /**
     * Sanitize data for storage (remove circular references, limit size)
     */
    sanitizeForStorage(data) {
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return String(data);
        }
    }

    /**
     * Performance timing utility
     */
    time(label) {
        const start = performance.now();
        return () => {
            const duration = performance.now() - start;
            this.debug(`${label} took ${duration.toFixed(2)}ms`);
            return duration;
        };
    }
}

    // Export to window to make globally accessible
    window.Logger = Logger;
    window.logger = new Logger('PlexIMDB');
    window.backgroundLogger = new Logger('Background');
    window.popupLogger = new Logger('Popup');
}

// Create const references for backwards compatibility
const Logger = window.Logger;
const logger = window.logger;
const backgroundLogger = window.backgroundLogger;
const popupLogger = window.popupLogger;
