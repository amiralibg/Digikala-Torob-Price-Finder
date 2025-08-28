// Universal Product Detector - Works on any e-commerce website
(function () {
  "use strict";

  // Skip if we're on supported sites (they have their own content script)
  if (window.location.href.includes("digikala.com/product/") || 
      window.location.href.includes("torob.com/p/")) {
    return;
  }

  const currentSite = detectCurrentSite();
  let detectedProducts = [];

  // Detect current site and check if it's an e-commerce site
  function detectCurrentSite() {
    const url = window.location.href;
    const hostname = window.location.hostname.toLowerCase();
    
    // Known e-commerce patterns
    const ecommercePatterns = [
      // Iranian sites
      "basalam.com", "okala.com", "snapp.market", "emalls.ir", "kalamarket.com",
      "modiseh.com", "bamilo.com", "eitaa.com", "technolife.ir", "technolife.com", "zanbil.ir",
      // International sites
      "amazon.", "ebay.", "aliexpress.", "walmart.", "target.",
      "bestbuy.", "newegg.", "etsy.", "shopify.", "bigcommerce."
    ];
    
    // Check if current site matches e-commerce patterns
    const isEcommerce = ecommercePatterns.some(pattern => hostname.includes(pattern));
    
    // Also check for common e-commerce indicators in the page
    const hasShoppingIndicators = checkShoppingIndicators();
    
    if (isEcommerce || hasShoppingIndicators) {
      return {
        type: "ecommerce",
        hostname: hostname,
        url: url
      };
    }
    
    return {
      type: "unknown",
      hostname: hostname,
      url: url
    };
  }

  // Check for common e-commerce indicators on the page
  function checkShoppingIndicators() {
    const indicators = [
      // Shopping cart indicators
      'button[class*="cart"]', 'button[class*="basket"]', 'a[href*="cart"]',
      'div[class*="cart"]', 'span[class*="cart"]',
      // Price indicators  
      '[class*="price"]', '[id*="price"]', 'span[class*="cost"]',
      // Add to cart buttons
      'button[class*="add"]', 'button[class*="buy"]', 'input[value*="cart"]',
      // Product indicators
      '[class*="product"]', '[id*="product"]',
      // Shopping specific
      '[class*="shop"]', '[class*="store"]', '[class*="purchase"]'
    ];
    
    let indicatorCount = 0;
    indicators.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        indicatorCount++;
      }
    });
    
    return indicatorCount >= 3; // Need at least 3 shopping indicators
  }

  // Universal product detection function
  function detectProducts() {
    if (currentSite.type !== "ecommerce") {
      return [];
    }

    const products = [];
    const detectedElements = new Set();

    // Check if we're on a single product page vs listing page
    const isProductPage = isCurrentPageProductPage();
    
    if (isProductPage) {
      console.log('Detected single product page, prioritizing main product');
      // 1. First, try to detect the main product on this page
      const mainProduct = detectMainProduct();
      if (mainProduct) {
        products.push(mainProduct);
        console.log('Found main product:', mainProduct.name);
      }
      
      // 2. Then detect related/recommended products with lower priority
      const relatedProducts = detectRelatedProducts(detectedElements);
      products.push(...relatedProducts);
    } else {
      console.log('Detected listing page, using standard detection');
      // Standard detection for listing pages
      
      // 1. Try product links first (most accurate for listing pages)
      const productLinks = document.querySelectorAll('a[href*="/product"], a[href*="/p/"], a[href*="/item"]');
      productLinks.forEach((link, index) => {
        if (detectedElements.has(link)) return;
        detectedElements.add(link);
        
        // Use the link's parent container or the link itself
        const container = link.closest('[class*="product"], [class*="item"], [class*="card"], article') || link;
        const product = extractProductFromContainer(container, index);
        if (product && product.name && product.name.length > 5) {
          products.push(product);
        }
      });
      
      // 2. If we don't have enough products, try broader container detection
      if (products.length < 3) {
        const productContainerSelectors = [
          // Generic product containers
          '[class*="product"]', '[id*="product"]',
          '[class*="item"]', '[data-product]', '[data-item]',
          // Shopping specific containers
          '[class*="listing"]', '[class*="grid"]', '[class*="card"]',
          '[class*="tile"]', '[class*="box"]',
          // Technolife specific patterns
          'article', '.search-result-item', '.product-list-item',
          // Additional patterns for listing pages
          '.result', '.search-item', '.catalog-item'
        ];

        productContainerSelectors.forEach(selector => {
          try {
            const containers = document.querySelectorAll(selector);
            
            containers.forEach((container, index) => {
              // Skip if already processed or too small
              if (detectedElements.has(container) || container.offsetHeight < 50) return;
              detectedElements.add(container);
              
              const product = extractProductFromContainer(container, products.length + index);
              if (product && product.name && product.name.length > 5) {
                products.push(product);
              }
            });
          } catch (e) {
            console.log('Error processing selector:', selector, e);
          }
        });
      }
    }

    // Remove duplicates and limit results
    const uniqueProducts = products
      .filter((product, index, arr) => {
        // More sophisticated duplicate detection
        return arr.findIndex(p => {
          const nameSimilarity = calculateSimilarity(p.name, product.name);
          return nameSimilarity > 0.8; // 80% similarity threshold
        }) === index;
      })
      .slice(0, 10);

    return uniqueProducts;
  }
  
  // Calculate text similarity for better duplicate detection
  function calculateSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length, 1);
  }

  // Check if current page is a product page vs listing page
  function isCurrentPageProductPage() {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    // URL patterns that indicate product pages
    const productPagePatterns = [
      '/product/', '/p/', '/item/', 
      '/products/', '/goods/', '/detail/', '/view/'
    ];
    
    const isProductUrl = productPagePatterns.some(pattern => pathname.includes(pattern));
    
    // Check for single product indicators on the page
    const hasMainProductTitle = document.querySelector('h1');
    const hasAddToCartButton = document.querySelector('[class*="cart"], [class*="buy"], button[class*="add"]');
    const hasProductPrice = document.querySelector('[class*="price"]');
    const hasProductGallery = document.querySelector('[class*="gallery"], [class*="image-main"]');
    
    const hasProductPageElements = [hasMainProductTitle, hasAddToCartButton, hasProductPrice].filter(Boolean).length >= 2;
    
    // Few product links suggests single product page, many suggests listing
    const productLinksCount = document.querySelectorAll('a[href*="/product"], a[href*="/p/"]').length;
    const suggestsProductPage = productLinksCount < 5; // Threshold for single vs listing
    
    return isProductUrl || (hasProductPageElements && suggestsProductPage);
  }

  // Detect the main product on a product page
  function detectMainProduct() {
    try {
      // Main product is usually in the main content area with prominent display
      const mainProductSelectors = [
        // Main content areas
        'main', '[role="main"]', '.main-content', '.product-detail', '.product-page',
        // Common product detail containers
        '[class*="product-detail"]', '[class*="product-info"]', '[class*="product-main"]',
        // Fallback to body if no main content found
        'body'
      ];
      
      let mainContainer = null;
      for (const selector of mainProductSelectors) {
        mainContainer = document.querySelector(selector);
        if (mainContainer) break;
      }
      
      if (!mainContainer) return null;
      
      // Extract product information from the main container
      const name = extractMainProductName(mainContainer);
      const price = extractPrice(mainContainer);
      const image = extractMainProductImage(mainContainer);
      const url = window.location.href;
      
      if (name && name.length > 5) {
        return {
          id: `main-product-${Date.now()}`,
          name: name,
          price: price,
          image: image,
          url: url,
          platform: currentSite.hostname,
          isMainProduct: true // Mark as main product
        };
      }
      
    } catch (error) {
      console.log('Error detecting main product:', error);
    }
    
    return null;
  }

  // Extract main product name with higher priority selectors
  function extractMainProductName(container) {
    const mainProductNameSelectors = [
      // Primary title selectors
      'h1',
      '[class*="product-title"] h1',
      '[class*="product-name"] h1',
      '.title h1',
      // Secondary title selectors
      'h2[class*="title"]',
      'h2[class*="name"]',
      '[class*="product-title"]',
      '[class*="product-name"]',
      '.product-title',
      '.title'
    ];

    for (const selector of mainProductNameSelectors) {
      try {
        const element = container.querySelector(selector);
        if (element) {
          let text = element.textContent.trim();
          
          if (text && text.length > 5 && text.length < 500) {
            // Clean up common noise
            text = text.replace(/^\s*[-•]\s*/, ''); // Remove leading dashes/bullets
            text = text.replace(/\s+/g, ' '); // Normalize whitespace
            
            // Validate it's a product name
            if (text.match(/[a-zA-Z\u0600-\u06FF]/) && !text.match(/^(قیمت|خرید|تومان|ریال|cart|buy)$/i)) {
              return text;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  // Extract main product image
  function extractMainProductImage(container) {
    const mainImageSelectors = [
      // Main product image selectors
      '[class*="product-image"] img',
      '[class*="main-image"] img', 
      '[class*="gallery-main"] img',
      '.gallery img:first-child',
      '.product-gallery img:first-child',
      // Gallery and slider images
      '.swiper-slide img:first-child',
      '.slider img:first-child',
      // Generic large images
      'img[width="400"], img[width="500"], img[height="400"], img[height="500"]',
      // Fallback to any reasonable sized image
      'img'
    ];

    for (const selector of mainImageSelectors) {
      try {
        const element = container.querySelector(selector);
        if (element && element.src) {
          // Check if it's a reasonable sized image
          if ((element.naturalWidth > 200 && element.naturalHeight > 200) || 
              (element.width > 200 && element.height > 200)) {
            return element.src;
          }
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }

  // Detect related/recommended products (lower priority)
  function detectRelatedProducts(detectedElements) {
    const relatedProducts = [];
    
    // Look for related/recommended sections
    const relatedSelectors = [
      '[class*="related"]', '[class*="recommend"]', '[class*="similar"]',
      '[class*="also-viewed"]', '[class*="you-may-like"]'
    ];
    
    relatedSelectors.forEach(selector => {
      try {
        const sections = document.querySelectorAll(selector);
        sections.forEach(section => {
          const products = section.querySelectorAll('a[href*="/product"], a[href*="/p/"], [class*="product"]');
          products.forEach((element, index) => {
            if (detectedElements.has(element)) return;
            detectedElements.add(element);
            
            const container = element.closest('[class*="product"], [class*="item"]') || element;
            const product = extractProductFromContainer(container, relatedProducts.length + index);
            if (product && product.name && product.name.length > 5) {
              product.isRelated = true; // Mark as related product
              relatedProducts.push(product);
            }
          });
        });
      } catch (e) {
        console.log('Error detecting related products:', e);
      }
    });
    
    return relatedProducts.slice(0, 5); // Limit related products
  }

  // Extract product information from a container element
  function extractProductFromContainer(container, index) {
    try {
      // Extract product name
      const name = extractProductName(container);
      if (!name || name.length < 3) return null;

      // Extract price
      const price = extractPrice(container);

      // Extract image
      const image = extractImage(container);

      // Extract URL
      const url = extractProductUrl(container);

      return {
        id: `universal-${index}-${Date.now()}`,
        name: name,
        price: price,
        image: image,
        url: url || window.location.href,
        platform: currentSite.hostname,
        container: container
      };
    } catch (error) {
      console.log('Error extracting product from container:', error);
      return null;
    }
  }

  // Extract product name using various selectors
  function extractProductName(container) {
    const nameSelectors = [
      // Title elements
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Product specific classes
      '[class*="title"]', '[class*="name"]', '[class*="product-name"]',
      '.title', '.name', '.product-title',
      // Link text (for listing pages)
      'a[href*="/product"]', 'a[href*="/p/"]', 'a[href*="/item"]',
      // Data attributes
      '[data-title]', '[data-name]', 'a[title]',
      // Text containers
      '.text', '.content', '.info',
      // Fallbacks - but more specific
      'p strong', 'span strong', '.description'
    ];

    for (const selector of nameSelectors) {
      try {
        const elements = container.querySelectorAll(selector);
        
        for (const element of elements) {
          if (element) {
            let text = element.textContent || element.title || element.alt || '';
            text = text.trim();
            
            // Enhanced filtering
            const skipTexts = [
              'cart', 'buy', 'add', 'shop', 'menu', 'login', 'register', 'home', 'contact',
              'search', 'filter', 'sort', 'view', 'more', 'less', 'show', 'hide',
              'تومان', 'ریال', 'قیمت', 'خرید', 'سبد', 'افزودن', 'مشاهده', 'جزئیات'
            ];
            
            const isProductText = !skipTexts.some(skip => text.toLowerCase().includes(skip.toLowerCase())) && 
                                 text.length > 5 && text.length < 300 &&
                                 text.match(/[a-zA-Z\u0600-\u06FF]/) && // Contains letters (English or Persian)
                                 !text.match(/^\d+$/); // Not just numbers
            
            if (isProductText) {
              return text;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  // Extract price using various selectors
  function extractPrice(container) {
    const priceSelectors = [
      '[class*="price"]', '[id*="price"]', '[class*="cost"]',
      '[class*="amount"]', '[data-price]', '.currency'
    ];

    for (const selector of priceSelectors) {
      try {
        const element = container.querySelector(selector);
        if (element) {
          const text = element.textContent || '';
          // Extract numbers from price text
          const priceMatch = text.match(/[\d,۰-۹]+/g);
          if (priceMatch) {
            let price = priceMatch.join('').replace(/[^\d۰-۹]/g, '');
            // Convert Persian numbers to English
            price = price.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
            const numPrice = parseInt(price);
            if (numPrice > 0) {
              // Assume it's Toman if < 100000, otherwise Rial
              return numPrice < 100000 ? numPrice * 10 : numPrice;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  // Extract product image
  function extractImage(container) {
    const imageSelectors = [
      'img', '[style*="background-image"]', 'picture source', 'figure img'
    ];

    for (const selector of imageSelectors) {
      try {
        const element = container.querySelector(selector);
        if (element) {
          const src = element.src || element.dataset.src || 
                     element.getAttribute('data-lazy-src') ||
                     getBackgroundImageUrl(element);
          
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('default')) {
            return src;
          }
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }

  // Extract product URL
  function extractProductUrl(container) {
    // Try multiple approaches to find product URLs
    const urlSelectors = [
      'a[href*="/product"]',
      'a[href*="/p/"]', 
      'a[href*="/item"]',
      'a',
      '[href]'
    ];
    
    for (const selector of urlSelectors) {
      const link = container.querySelector(selector);
      if (link && link.href && 
          (link.href.includes('/product') || link.href.includes('/p/') || link.href.includes('/item'))) {
        return link.href;
      }
    }
    
    // If container itself is a link
    if (container.tagName === 'A' && container.href) {
      return container.href;
    }
    
    // Check if container is inside a link
    const parentLink = container.closest('a');
    if (parentLink && parentLink.href) {
      return parentLink.href;
    }
    
    return window.location.href; // Fallback to current page
  }

  // Helper to extract background image URL
  function getBackgroundImageUrl(element) {
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    const match = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    return match ? match[1] : null;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "getProductInfo") {
      // For universal detection, return the first detected product or null
      const products = detectProducts();
      if (products.length > 0) {
        sendResponse({ success: true, data: products[0] });
      } else {
        sendResponse({ success: false, data: null });
      }
    } else if (request.action === "getAllProducts") {
      // Return all detected products
      const products = detectProducts();
      sendResponse({ success: true, data: products });
    }
    return true;
  });

  // Auto-detect products when page loads
  function initializeProductDetection() {
    if (currentSite.type === "ecommerce") {
      console.log(`Universal Product Detector: Initializing detection on ${currentSite.hostname}`);
      
      // Wait for page to fully load
      setTimeout(() => {
        detectedProducts = detectProducts();
        console.log(`Universal Product Detector: Found ${detectedProducts.length} products on ${currentSite.hostname}`);
        
        if (detectedProducts.length > 0) {
          console.log('Detected products:', detectedProducts.map(p => p.name));
          // Store detected products for popup to access
          chrome.storage.local.set({
            detectedProducts: detectedProducts,
            detectionSite: currentSite,
            detectionTime: Date.now()
          });
        } else {
          console.log('No products detected. Site indicators:', {
            productLinks: document.querySelectorAll('a[href*="/product"], a[href*="/p/"], a[href*="/item"]').length,
            articles: document.querySelectorAll('article').length,
            productClasses: document.querySelectorAll('[class*="product"]').length,
            itemClasses: document.querySelectorAll('[class*="item"]').length
          });
        }
      }, 2000); // Increased timeout for better page loading
    }
  }

  // Initialize detection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProductDetection);
  } else {
    initializeProductDetection();
  }

})();