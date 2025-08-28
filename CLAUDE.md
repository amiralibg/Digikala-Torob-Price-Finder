# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension project for price comparison on Iranian e-commerce platforms (Digikala and Torob). The project supports both Chrome and Firefox with separate build directories but shared functionality.

## Project Structure

- **`chrome/`** - Chrome extension (Manifest V3)
- **`firefox/`** - Firefox extension (WebExtensions)
- **Shared Components**:
  - `src/js/content.js` - Main content script for product detection and widget display
  - `src/js/background.js` - Service worker for API calls and message passing
  - `src/js/popup.js` - Popup interface logic
  - `src/js/torob-width-fix.js` - Torob-specific styling fixes
  - `src/js/universal-product-detector.js` - Universal product detection across sites
  - `src/css/content.css` - Floating widget styles with RTL support
  - `src/html/popup.html` - Extension popup interface

## Development Commands

### Loading Extensions for Testing
- **Chrome**: Navigate to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select `chrome/` directory
- **Firefox**: Navigate to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `firefox/manifest.json`

### Testing URLs
- **Digikala product page**: `https://www.digikala.com/product/dkp-11022424/`
- **Torob product page**: `https://torob.com/p/[product-id]/`

## Architecture

### Content Script Strategy
The extension uses multiple content scripts with different injection strategies:
1. **Product-specific** (`content.js`) - Injected on Digikala and Torob product pages
2. **Site-specific fixes** (`torob-width-fix.js`) - Runs at document_start for Torob styling
3. **Universal detector** (`universal-product-detector.js`) - Runs on all pages for broad product detection

### API Integration
The extension integrates with official APIs:
- **Digikala API endpoints**:
  - Product Details: `https://api.digikala.com/v2/product/{id}/`
  - Search: `https://api.digikala.com/v1/search/?q={query}`
  - Autocomplete: `https://api.digikala.com/v1/autocomplete/?q={query}`
- **Torob API**: `https://api.torob.com/*`

### Key Functions
- **`extractProductInfo()`** in `content.js:28` - Main product data extraction
- **`extractDigikalaProductInfo()`** in `content.js:43` - Digikala-specific extraction
- **`getProductCPC()`** in `background.js` - Same product, different sellers comparison
- **`searchPricesAPI()`** in `background.js` - Related products search

### Message Passing Architecture
- Content scripts communicate with popup via `chrome.runtime.onMessage`
- Background service worker handles API calls and cross-script communication
- Product info extraction triggered by popup requests

## Browser-Specific Considerations

### Chrome (Manifest V3)
- Uses service worker instead of background page
- Requires explicit permissions for each API endpoint
- Content Security Policy restrictions apply

### Firefox (WebExtensions)
- Manifest V2 compatibility
- Different permission model
- May require manifest adaptations for newer Firefox versions

## Security Notes

- Extension permissions are scoped to specific e-commerce domains
- Uses only official API endpoints
- No sensitive data storage or transmission
- Safe product data extraction with error handling
- Rate limiting should be implemented for API calls

## Language Support

- Primary language: Persian/Farsi with RTL support
- Uses Vazirmatn font family (included in assets)
- CSS styling optimized for Persian text rendering
- Price formatting in Toman currency