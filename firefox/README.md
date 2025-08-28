# Digikala & Torob Price Finder - Firefox Extension

## Overview

A Firefox extension that helps users find and compare the best prices for products on Digikala and Torob, as well as other Iranian e-commerce platforms. The extension provides both a popup interface for manual searches and automatic product detection on supported sites.

## Features

### 🛒 **Automatic Product Detection**
- Automatically detects when you're on a Digikala or Torob product page
- Universal detection works on other Iranian e-commerce sites (Technolife, Basalam, etc.)
- Enhanced Firefox-compatible product extraction
- Shows current product info in the extension popup

### 💰 **Price Comparison**
- Compare prices across multiple sellers on Digikala and Torob
- Sort results by price (lowest to highest)
- Display seller ratings and grades for informed decision making
- Real-time API integration with Digikala and Torob official endpoints
- Shows exact same product with different sellers when available
- Cross-platform price comparison between Digikala and Torob

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

### Step 3: Install in Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" button
3. Navigate to the **firefox** directory (not the root directory)
4. Select the `manifest.json` file
5. The extension should now appear in your extensions list

### Step 4: Test the Extension
1. Visit a Digikala product page like: `https://www.digikala.com/product/dkp-11022424/`
2. Or visit a Torob product page like: `https://torob.com/p/f2f7a778-a65f-480b-8d5e-9ffd5e03deef/...`
3. Or test universal detection on other sites like: `https://www.technolife.com/product-69647/...`
4. You should see automatic product detection in the popup
5. Click the extension icon in Firefox's toolbar to open the popup
6. Try searching for products or comparing prices for the current product

## Technical Architecture

### Components

- **Background Script** (`background.js`) - Handles extension lifecycle, API calls, and message passing (Manifest V2 compatible)
- **Content Script** (`content.js`) - Injected into Digikala pages to extract product data and show floating widget
- **Popup Interface** (`popup.html` + `popup.js`) - Extension popup for manual searches and price comparisons
- **Styling** (`content.css`) - CSS for the floating widget with Persian/Farsi support

### Key Permissions
- `activeTab` - Access to current active tab
- `storage` - Local data storage for preferences
- `tabs` - Tab management and programmatic script injection
- Host permissions for `digikala.com`, `api.digikala.com`, `torob.com`, and `api.torob.com`
- Universal permissions for broad e-commerce site detection

### Content Script Integration
- **Main Content Script**: Automatically injected on Digikala (`https://www.digikala.com/product/*`) and Torob (`https://torob.com/p/*`) pages
- **Universal Detector**: Runs on all pages to detect e-commerce sites and products
- **Torob Width Fix**: Special styling fixes for Torob pages
- **Firefox Compatibility**: Enhanced browser API detection and fallback script injection
- Extracts product information using multiple CSS selector strategies
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
The extension uses real API endpoints from multiple platforms:

**Digikala APIs:**
1. **Product Details API** - `https://api.digikala.com/v2/product/{id}/` - Get detailed product information and variants
2. **Search API** - `https://api.digikala.com/v1/search/?q={query}` - Search for related products
3. **Autocomplete API** - `https://api.digikala.com/v1/autocomplete/?q={query}` - Get search suggestions

**Torob APIs:**
- **Torob API** - `https://api.torob.com/*` - Product and price comparison data

#### Key Functions:
- **`getProductCPC()`** - Shows same product with different sellers using product variants
- **`searchPricesAPI()`** - Searches for related products using search API  
- **`getDigikalaProductDetails()`** - Gets detailed product information

#### How It Works:
- **Same Product, Different Sellers**: Uses `product.variants` from the Product API to show different sellers for the exact same product
- **Related Products**: Uses Search API to show similar/related products when searching manually

### Security Considerations
- Extension permissions are scoped to specific e-commerce domains (Digikala, Torob, etc.)
- Uses only official API endpoints from trusted sources
- Firefox WebExtensions compliant (Manifest V2)
- Safe product data extraction with comprehensive error handling
- No sensitive data storage or transmission
- Enhanced Firefox-specific security measures and API compatibility

## Browser Compatibility

- **Firefox**: ✅ Full support (Manifest V2 WebExtensions)
- **Chrome/Chromium**: ⚠️ See separate Chrome version in `/chrome` directory
- **Edge**: ⚠️ Use Chrome version for Chromium-based Edge
- **Safari**: ❌ Requires additional adaptation for Safari Web Extensions

## Firefox-Specific Features

- **Enhanced Compatibility**: Uses Firefox `browser` API with Chrome fallback
- **Programmatic Injection**: Fallback script injection when manifest declaration fails
- **Debug Logging**: Comprehensive logging for troubleshooting
- **DOM Element Handling**: Fixed DataCloneError issues with message passing
- **Universal Detection**: Works reliably across different Iranian e-commerce sites

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
4. Follow Firefox WebExtensions best practices

## License

This project is created for educational purposes. Please ensure compliance with Digikala's terms of service and applicable laws when using or modifying this extension.
