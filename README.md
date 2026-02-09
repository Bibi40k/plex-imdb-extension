# Plex IMDb Enhancer

Add clickable IMDb ratings to Plex Web.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Screenshots

### Extension in Action
![Plex with IMDb button](screenshots/plex-imdb-in-action.jpg)

### Extension Installation
![Extension settings](screenshots/plex-imdb-install.jpg)

## Features

- **IMDb button** with live ratings in movie details
- **Click to open** IMDb page in new tab
- **Bilingual support** (English/Romanian)
- **Secure API key** storage with obfuscation
- **Performance optimized** with caching and rate limiting

## Requirements

- Chrome/Edge/Brave (v88+) or Firefox (v109+)
- Free OMDb API key - [get one here](http://www.omdbapi.com/apikey.aspx)
- Plex Web account

## Installation

### 1. Get API Key

1. Visit [omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx)
2. Select **FREE** (1,000 requests/day)
3. Activate via email
4. Save your key

### 2. Install Extension

**Chrome/Edge/Brave:**
1. Download this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select `plex-imdb-extension` folder

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`

### 3. Configure

1. Click extension icon in toolbar
2. Enter API key
3. Click **Save**

## Usage

1. Open [Plex Web](https://app.plex.tv)
2. Navigate to any movie
3. IMDb button appears with ratings
4. Click to open IMDb page

## File Structure

```
plex-imdb-extension/
├── manifest.json       # Extension config
├── config.js          # Settings
├── logger.js          # Logging
├── cache.js           # Caching
├── rate-limiter.js    # Rate limiting
├── api-client.js      # OMDb API
├── content.js         # Main script
├── background.js      # Service worker
├── popup.html/js      # Settings UI
├── _locales/          # Translations
│   ├── en/
│   └── ro/
└── icons/             # Icons
```

## Technical Details

**Architecture:**
- Modular design with separate concerns
- Manifest V3 compliant
- Duplicate injection prevention
- Memory leak protection

**Performance:**
- API response caching (60min TTL)
- Rate limiting (100 req/hour)
- Optimized DOM queries
- <5MB memory footprint

**Security:**
- XSS protection
- Input validation
- CSP enforcement
- No external tracking
- API key obfuscation

## Troubleshooting

**Button doesn't appear:**
- Verify you're on a movie details page
- Reload page (Ctrl+R)
- Check API key is configured
- Open Console (F12) for errors

**API key issues:**
- Ensure key is activated via email
- Test: `http://www.omdbapi.com/?apikey=YOUR_KEY&t=Inception`
- Free limit: 1,000 requests/day

## Development

```bash
git clone https://github.com/yourusername/plex-imdb-extension
cd plex-imdb-extension
```

Load in browser as shown in Installation section.

**Debug logging:**
Set `LOG_LEVEL: 'debug'` in `config.js`

## Changelog

### v0.1.0 (2026-02-09)
- Initial release
- Bilingual support (EN/RO)
- Secure API key handling
- Caching and rate limiting
- Memory leak fixes
- XSS protection

## License

MIT License - see [LICENSE](LICENSE)

## Credits

- [OMDb API](http://www.omdbapi.com/) for IMDb data
- [Plex](https://www.plex.tv/) for the platform
