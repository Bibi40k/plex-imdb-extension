# Changelog

All notable changes to Plex IMDb Enhancer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-09

### Added
- **Plex API Integration** - Direct metadata fetching from Plex Media Server
- **Intelligent Metadata Resolver** - Smart fallback chain (Plex → OMDb)
- **Quick Setup** - One-click token/URL extraction from Plex XML
- **Auto-reload Credentials** - Detects storage changes automatically
- **Original Title Support** - Better matching for international films
- **Test Plex Connection** - Verify server connectivity from popup
- **Dual Browser Support** - Separate optimized builds for Chrome & Firefox
  - Chrome: Service Worker (MV3 optimized)
  - Firefox: Background Scripts (MV3 compatible)
- **GitHub Actions** - Automated release workflow
- **Browser Switcher Script** - Easy development switching
- **DRY Code** - Refactored with shared utilities (validators, storage, URL parsing)

### Fixed
- **Firefox MV3 Compatibility** - Separate manifests for Chrome/Firefox
- **CSP Network Blocking** - Added `https://*.plex.direct:*` to connect-src
- **Non-structured-clonable Error** - Per-file injection error handling
- **Duplicate Injection** - Proper tab tracking without stale state
- **Memory Leaks** - Removed storage restoration for persistent scripts
- **Rate Limiter** - Fixed memory leak in cleanup
- **XSS Protection** - Sanitized i18n rendering
- **Request Timeouts** - Added proper timeout handling

### Changed
- **Architecture** - Modular design with separate concerns
- **Logging** - Unified `[PIMDB]` prefix for console filtering
- **Security** - Enhanced documentation about token storage

### Technical
- Manifest V3 compliant (Chrome & Firefox)
- Background script separation (service worker vs scripts)
- CSP enforcement with proper port handling
- ReDoS protection on regex patterns
- API key validation
- <5MB memory footprint

## [0.1.1] - 2026-02-09

### Fixed
- Rate limiter memory leak
- XSS vulnerability in i18n rendering
- Request timeout handling
- Storage operation error handling
- Cache performance optimization
- ReDoS protection

## [0.1.0] - 2026-02-09

### Added
- Initial release
- Bilingual support (English/Romanian)
- Secure API key handling
- Caching and rate limiting
- Memory leak fixes
- XSS protection
- IMDb rating buttons on Plex movie pages
- Click-to-open IMDb functionality

[0.2.0]: https://github.com/Bibi40k/plex-imdb-extension/releases/tag/v0.2.0
[0.1.1]: https://github.com/Bibi40k/plex-imdb-extension/releases/tag/v0.1.1
[0.1.0]: https://github.com/Bibi40k/plex-imdb-extension/releases/tag/v0.1.0
