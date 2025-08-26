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

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "getProductInfo") {
      const productInfo = extractProductInfo();
      sendResponse({ success: true, data: productInfo });
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

    // Get product image with updated selectors
    const imageSelectors = [
      '[data-testid="pdp-gallery-image"] img',
      ".c-gallery__item img",
      ".js-gallery-image",
      ".product-image img",
      ".gallery-image img",
      'img[alt*="تصویر"]',
      ".swiper-slide img",
    ];

    let imageUrl = "";
    for (const selector of imageSelectors) {
      const element = document.querySelector(selector);
      if (element && element.src) {
        imageUrl = element.src;
        break;
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

    // Get product image from Torob
    const imageSelectors = [
      '[data-cy="product-image"] img',
      ".product-image img",
      ".gallery img",
      'img[alt*="تصویر"]',
      'img[src*="image.torob.com"]',
    ];

    let imageUrl = "";
    for (const selector of imageSelectors) {
      const element = document.querySelector(selector);
      if (element && element.src) {
        imageUrl = element.src;
        break;
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
