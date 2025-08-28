# Digikala Price Finder Chrome Extension

## Overview

A Chrome extension that helps users find and compare the best prices for products on Digikala, Iran's largest e-commerce platform. The extension provides both a popup interface for manual searches and an automatic floating widget that appears on Digikala product pages.

## Features

### 🛒 **Automatic Product Detection**
- Automatically detects when you're on a Digikala product page
- Extracts product name and current price from the page
- Shows current product info in the extension popup

### 💰 **Price Comparison**
- Compare prices across multiple sellers on Digikala
- Sort results by price (lowest to highest)
- Display seller ratings and grades for informed decision making
- Real-time API integration with Digikala's official endpoints
- Shows exact same product with different sellers when available

### 🎨 **Floating Widget**
- Beautiful floating widget appears on product pages
- Slides in automatically after scrolling
- Non-intrusive design with easy close functionality
- Real-time price comparison results

### 🔍 **Search Functionality**
- Manual product search through popup interface
- Persian/Farsi language support (RTL)
- Responsive design optimized for extension popup

## Installation

### Step 1: Prepare the Files
1. Clone or download this repository
2. Ensure all files are in the project directory:
   - `manifest.json` - Extension configuration
   - `popup.html` - Extension popup interface
   - `popup.js` - Popup functionality
   - `content.js` - Script that runs on Digikala pages
   - `content.css` - Styles for the floating widget
   - `background.js` - Background service worker

### Step 2: Create Extension Icons
Create icons for your extension in the following sizes and save them in the project directory:
- `icon16.png` (16x16 pixels)
- `icon32.png` (32x32 pixels) 
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create simple shopping cart icons or use any design tool to create these.

### Step 3: Install in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by clicking the toggle in the top right corner
3. Click "Load unpacked" button
4. Select the project directory
5. The extension should now appear in your extensions list

### Step 4: Test the Extension
1. Visit a Digikala product page like: `https://www.digikala.com/product/dkp-11022424/`
2. You should see a floating widget appear on the right side after scrolling
3. Click the extension icon in Chrome's toolbar to open the popup
4. Try searching for products or comparing prices for the current product

## Technical Architecture

### Components

- **Background Service Worker** (`background.js`) - Handles extension lifecycle, API calls, and message passing
- **Content Script** (`content.js`) - Injected into Digikala pages to extract product data and show floating widget
- **Popup Interface** (`popup.html` + `popup.js`) - Extension popup for manual searches and price comparisons
- **Styling** (`content.css`) - CSS for the floating widget with Persian/Farsi support

### Key Permissions
- `activeTab` - Access to current active tab
- `storage` - Local data storage for preferences
- `scripting` - Script injection capabilities
- Host permissions for `digikala.com` and `api.digikala.com`

### Content Script Integration
- Automatically injected on product pages (`https://www.digikala.com/product/*`)
- Extracts product information using multiple CSS selector strategies
- Creates and manages floating price comparison widget
- Handles communication with popup and background scripts

## Development Notes

### Current Implementation Status
- ✅ Complete UI/UX implementation
- ✅ Product data extraction from Digikala pages
- ✅ Floating widget with animations
- ✅ Popup interface with search functionality
- ✅ Real API integration with Digikala endpoints
- ✅ Price comparison showing same product with different sellers
- ✅ Clickable price cards for easy navigation
- ✅ Proper price formatting (Toman conversion)
- ✅ Seller ratings and grade display

### API Integration 
The extension uses real Digikala API endpoints:

1. **Product Details API** - `https://api.digikala.com/v2/product/{id}/` - Get detailed product information and variants
2. **Search API** - `https://api.digikala.com/v1/search/?q={query}` - Search for related products
3. **Autocomplete API** - `https://api.digikala.com/v1/autocomplete/?q={query}` - Get search suggestions

#### Key Functions:
- **`getProductCPC()`** - Shows same product with different sellers using product variants
- **`searchPricesAPI()`** - Searches for related products using search API  
- **`getDigikalaProductDetails()`** - Gets detailed product information

#### How It Works:
- **Same Product, Different Sellers**: Uses `product.variants` from the Product API to show different sellers for the exact same product
- **Related Products**: Uses Search API to show similar/related products when searching manually

### Security Considerations
- Extension permissions are scoped to Digikala domains only
- Uses official Digikala API endpoints only
- Content Security Policy compliant
- Safe product data extraction with error handling
- No sensitive data storage or transmission

## Browser Compatibility

- **Chrome/Chromium**: Full support (Manifest V3)
- **Edge**: Compatible with Chromium-based Edge
- **Firefox**: Requires manifest conversion for WebExtensions
- **Safari**: Requires additional adaptation for Safari Web Extensions

## Future Enhancements

- Historical price tracking and charts
- Price drop notifications and alerts
- Wishlist functionality with price monitoring
- Support for other Iranian e-commerce platforms
- Performance optimizations and caching
- Enhanced seller comparison features
- Product availability notifications

## Contributing

This extension is designed for educational and legitimate price comparison purposes. When contributing:

1. Maintain focus on defensive security practices
2. Respect website terms of service
3. Implement rate limiting for API calls
4. Follow Chrome extension best practices

## License

This project is created for educational purposes. Please ensure compliance with Digikala's terms of service and applicable laws when using or modifying this extension.
