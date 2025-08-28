// Content script that runs on Digikala and Torob product pages
(function () {
  "use strict";

  const currentSite = detectCurrentSite();

  // Detect current site
  function detectCurrentSite() {
    const url = window.location.href;
    if (url.includes("digikala.com")) {
      return "digikala";
    } else if (url.includes("torob.com")) {
      return "torob";
    }
    return "unknown";
  }

  // Listen for messages from popup (Firefox compatible)
  const runtimeAPI = typeof browser !== "undefined" ? browser : chrome;

  runtimeAPI.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ success: true, message: "pong" });
      return true;
    }

    if (request.action === "getProductInfo") {
      const productInfo = extractProductInfo();
      sendResponse({ success: true, data: productInfo });
      return true;
    }

    return true;
  });

  // Extract product information from the page
  function extractProductInfo() {
    try {
      if (currentSite === "digikala") {
        return extractDigikalaProductInfo();
      } else if (currentSite === "torob") {
        return extractTorobProductInfo();
      }
      return null;
    } catch (error) {
      console.error("Error extracting product info:", error);
      return null;
    }
  }

  // Extract product information from Digikala
  function extractDigikalaProductInfo() {
    // Extract product ID from URL
    const urlMatch = window.location.href.match(/\/product\/dkp-(\d+)\//);
    const productId = urlMatch ? urlMatch[1] : null;

    // Try different selectors for product name
    const nameSelectors = [
      'h1[data-testid="pdp-product-title"]',
      "h1.product-title",
      ".product-title h1",
      ".styles_ProductTitle__content__4nE_l h1",
      ".c-product__title h1",
      'h1[class*="ProductTitle"]',
      "h1",
    ];

    let productName = "";
    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        productName = element.textContent.trim();
        break;
      }
    }

    // Try different selectors for price - updated with more current Digikala selectors
    const priceSelectors = [
      '[data-testid="price-current"]',
      '[data-testid="price-discount"]',
      ".c-product-price__selling",
      ".c-product-price__current",
      ".styles_Price__discounted__MhNIJ",
      ".js-price-value",
      ".price-current",
      ".product-price .price",
      ".discount-price",
      ".price",
    ];

    let price = null;
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent.replace(/[^\d]/g, "");
        if (priceText) {
          price = parseInt(priceText);
          break;
        }
      }
    }

    // Get product image with updated selectors - try multiple approaches
    const imageSelectors = [
      // New Digikala selectors (2024+)
      '[data-testid="pdp-gallery-image"] img',
      '[data-testid="gallery-image"] img',
      ".swiper-slide-active img",
      ".swiper-slide:first-child img",
      // Gallery selectors
      ".c-gallery__item img",
      ".gallery-image img",
      ".js-gallery-image",
      ".product-image img",
      ".product-gallery img",
      // Fallback selectors
      'img[alt*="تصویر"]',
      'img[alt*="محصول"]',
      'img[alt*="عکس"]',
      ".swiper-slide img",
      // Generic product image selectors
      'img[src*="dkstatics"]',
      'img[src*="digikala"]',
      "main img",
      ".product img",
    ];

    let imageUrl = "";
    for (const selector of imageSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element && element.src && element.src.startsWith("http")) {
          // Skip if it's a tiny image (likely icon or placeholder)
          if (element.naturalWidth > 100 && element.naturalHeight > 100) {
            imageUrl = element.src;
            break;
          } else if (element.width > 100 && element.height > 100) {
            imageUrl = element.src;
            break;
          }
        }
      }
      if (imageUrl) break;
    }

    // If still no image found, try data attributes and lazy loading images
    if (!imageUrl) {
      const lazyImageSelectors = [
        "img[data-src]",
        "img[data-lazy-src]",
        "img[data-original]",
        '[data-testid*="gallery"] img[data-src]',
        ".swiper-slide img[data-src]",
      ];

      for (const selector of lazyImageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const dataSrc =
            element.getAttribute("data-src") ||
            element.getAttribute("data-lazy-src") ||
            element.getAttribute("data-original");
          if (dataSrc && dataSrc.startsWith("http")) {
            imageUrl = dataSrc;
            break;
          }
        }
      }
    }

    return {
      id: productId,
      name: productName || "محصول نامشخص",
      price: price,
      image: imageUrl,
      url: window.location.href,
      platform: "digikala",
    };
  }

  // Extract product information from Torob
  function extractTorobProductInfo() {
    // Extract product key from URL (/p/{product-key}/)
    const urlMatch = window.location.pathname.match(/\/p\/([^\/]+)\//);
    const productKey = urlMatch ? urlMatch[1] : null;

    // Try different selectors for product name on Torob
    const nameSelectors = [
      'h1[data-cy="pdp-product-title"]',
      "h1.product-title",
      ".product-name h1",
      "h1",
      ".breadcrumb-item:last-child",
      '[data-testid="product-title"]',
    ];

    let productName = "";
    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        productName = element.textContent.trim();
        break;
      }
    }

    // Try different selectors for price on Torob (in Toman)
    const priceSelectors = [
      '[data-cy="product-price"]',
      ".price-value",
      ".product-price",
      ".price",
      '[class*="price"]',
    ];

    let price = null;
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Convert Persian numbers to English and extract price
        let priceText = element.textContent;
        priceText = priceText.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
        priceText = priceText.replace(/[^\d]/g, "");
        if (priceText) {
          price = parseInt(priceText) * 10; // Convert Toman to Rial
          break;
        }
      }
    }

    // Get product image from Torob - enhanced detection
    const imageSelectors = [
      // Torob specific selectors
      '[data-cy="product-image"] img',
      ".product-image img",
      ".product-gallery img",
      ".gallery img",
      ".main-image img",
      // Generic selectors
      'img[alt*="تصویر"]',
      'img[alt*="محصول"]',
      'img[alt*="عکس"]',
      // Domain specific
      'img[src*="image.torob.com"]',
      'img[src*="torob"]',
      // Fallback selectors
      "main img",
      ".product img",
      'img[width="300"]', // Common product image size on Torob
      'img[width="400"]',
    ];

    let imageUrl = "";
    for (const selector of imageSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element && element.src && element.src.startsWith("http")) {
          // Skip if it's a tiny image (likely icon or placeholder)
          if (element.naturalWidth > 100 && element.naturalHeight > 100) {
            imageUrl = element.src;
            break;
          } else if (element.width > 100 && element.height > 100) {
            imageUrl = element.src;
            break;
          }
        }
      }
      if (imageUrl) break;
    }

    // Try lazy loading images if no image found
    if (!imageUrl) {
      const lazySelectors = [
        "img[data-src]",
        "img[data-lazy-src]",
        "img[data-original]",
        '[data-cy*="image"] img[data-src]',
      ];

      for (const selector of lazySelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const dataSrc =
            element.getAttribute("data-src") ||
            element.getAttribute("data-lazy-src") ||
            element.getAttribute("data-original");
          if (dataSrc && dataSrc.startsWith("http")) {
            imageUrl = dataSrc;
            break;
          }
        }
      }
    }

    return {
      id: productKey,
      productKey: productKey,
      name: productName || "محصول نامشخص",
      price: price,
      image: imageUrl,
      url: window.location.href,
      platform: "torob",
    };
  }
})();
