#!/bin/bash

# Plex IMDb Extension - Browser Manifest Switcher
# Usage: ./switch-browser.sh [chrome|firefox]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_usage() {
    echo -e "${BLUE}Usage:${NC}"
    echo "  ./switch-browser.sh chrome   # Switch to Chrome/Edge manifest"
    echo "  ./switch-browser.sh firefox  # Switch to Firefox manifest"
    echo ""
    echo -e "${BLUE}Current manifest:${NC}"
    if [ -f "manifest.json" ]; then
        if grep -q '"service_worker"' manifest.json; then
            echo -e "  ${GREEN}✓${NC} Chrome/Edge (service_worker)"
        elif grep -q '"scripts"' manifest.json; then
            echo -e "  ${GREEN}✓${NC} Firefox (scripts)"
        else
            echo -e "  ${YELLOW}?${NC} Unknown"
        fi
    else
        echo -e "  ${RED}✗${NC} manifest.json not found"
    fi
}

switch_to_chrome() {
    echo -e "${BLUE}🔄 Switching to Chrome/Edge manifest...${NC}"

    if [ ! -f "manifest-chrome.json" ]; then
        echo -e "${RED}✗ manifest-chrome.json not found!${NC}"
        exit 1
    fi

    cp manifest-chrome.json manifest.json
    echo -e "${GREEN}✅ Switched to Chrome/Edge manifest (service_worker)${NC}"
    echo -e "${YELLOW}ℹ️  Reload extension in chrome://extensions/${NC}"
}

switch_to_firefox() {
    echo -e "${BLUE}🔄 Switching to Firefox manifest...${NC}"

    if [ ! -f "manifest-firefox.json" ]; then
        echo -e "${YELLOW}⚠️  manifest-firefox.json not found, creating from manifest-chrome.json...${NC}"

        if [ ! -f "manifest-chrome.json" ]; then
            echo -e "${RED}✗ manifest-chrome.json not found!${NC}"
            exit 1
        fi

        # Create Firefox manifest from Chrome manifest
        cat manifest-chrome.json | \
            sed 's/"service_worker": "background.js"/"scripts": ["background.js"]/' | \
            sed '/"browser_specific_settings"/d' | \
            sed '/"gecko"/d' | \
            sed '/"id":/d' | \
            sed '/"strict_min_version":/d' | \
            jq '. + {"browser_specific_settings": {"gecko": {"id": "plex-imdb-enhancer@anthropic.com", "strict_min_version": "109.0"}}}' \
            > manifest-firefox.json

        echo -e "${GREEN}✓ Created manifest-firefox.json${NC}"
    fi

    cp manifest-firefox.json manifest.json
    echo -e "${GREEN}✅ Switched to Firefox manifest (scripts)${NC}"
    echo -e "${YELLOW}ℹ️  Reload extension in about:debugging${NC}"
}

# Main logic
case "$1" in
    chrome|c)
        switch_to_chrome
        ;;
    firefox|f)
        switch_to_firefox
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
