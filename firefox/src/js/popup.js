document.addEventListener("DOMContentLoaded", async function () {
  // Firefox compatibility - use browser API if available, otherwise use chrome
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  // Helper function to safely create DOM elements with attributes and text
  function createElement(tag, attributes = {}, textContent = "") {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === "style") {
        element.style.cssText = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    if (textContent) {
      element.textContent = textContent;
    }
    return element;
  }
  // Modal for same product/seller
  function showSellerModal(sellerName) {
    let modal = document.getElementById("seller-modal");
    if (!modal) {
      modal = createElement("div", { id: "seller-modal" });

      // Create modal overlay
      const overlay = createElement("div", {
        style:
          "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.25); z-index: 9999; display: flex; align-items: center; justify-content: center;",
      });

      // Create modal content
      const content = createElement("div", {
        style:
          "background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(25,191,211,0.15); padding: 32px 24px; max-width: 340px; text-align: center; position: relative;",
      });

      // Close button
      const closeBtn = createElement(
        "button",
        {
          id: "closeSellerModal",
          style:
            "position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; color: #888; cursor: pointer;",
        },
        "×"
      );

      // Title
      const title = createElement(
        "div",
        {
          style:
            "font-size: 18px; font-weight: bold; color: #19bfd3; margin-bottom: 12px;",
        },
        "خرید از فروشنده دیگر"
      );

      // Description
      const desc = createElement("div", {
        style: "font-size: 15px; color: #424750; margin-bottom: 18px;",
      });
      desc.appendChild(document.createTextNode("شما در همین صفحه هستید."));
      desc.appendChild(createElement("br"));
      desc.appendChild(document.createTextNode("برای خرید از فروشنده "));
      const sellerSpan = createElement(
        "span",
        {
          style: "color:#e6123d;font-weight:bold;",
        },
        sellerName
      );
      desc.appendChild(sellerSpan);
      desc.appendChild(
        document.createTextNode("، باید محصول را به سبد خرید اضافه کنید.")
      );

      // Footer
      const footer = createElement(
        "div",
        {
          style: "font-size: 13px; color: #81858b;",
        },
        "در صورت نیاز، فروشنده را از لیست فروشندگان انتخاب کنید."
      );

      // Assemble modal
      content.appendChild(closeBtn);
      content.appendChild(title);
      content.appendChild(desc);
      content.appendChild(footer);
      overlay.appendChild(content);
      modal.appendChild(overlay);

      document.body.appendChild(modal);
      closeBtn.onclick = function () {
        modal.remove();
      };
    }
  }
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const currentProduct = document.getElementById("currentProduct");
  const productName = document.getElementById("productName");
  const currentPrice = document.getElementById("currentPrice");
  const findPricesBtn = document.getElementById("findPricesBtn");
  const digikalaResults = document.getElementById("digikalaResults");
  const torobResults = document.getElementById("torobResults");
  // Helper to log to background page console (Manifest V3 compatible)
  function logToBackground(...args) {
    try {
      // Also send to background script if needed for debugging
      browserAPI.runtime
        .sendMessage({
          action: "log",
          message:
            "[popup.js] " +
            args
              .map((arg) =>
                typeof arg === "object" ? JSON.stringify(arg) : String(arg)
              )
              .join(" "),
        })
        .catch(() => {
          // Ignore if background script can't receive the message
        });
    } catch (e) {
      // Silently handle logging errors
    }
  }

  let currentProductData = null;

  // Pagination state for infinite scrolling
  let searchState = {
    query: "",
    digikala: {
      page: 1,
      hasMore: true,
      loading: false,
      results: [],
    },
    torob: {
      page: 1,
      hasMore: true,
      loading: false,
      results: [],
    },
  };

  // Load persisted search results after searchState is initialized
  await loadPersistedSearchResults();

  // Check if we're on a supported product page (Digikala or Torob) or any e-commerce site
  const [tab] = await browserAPI.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (
    tab.url.includes("digikala.com/product/") ||
    tab.url.includes("torob.com/p/")
  ) {
    // Get current product info from content script
    try {
      const response = await browserAPI.tabs.sendMessage(tab.id, {
        action: "getProductInfo",
      });
      logToBackground("Product info from content script:", response);
      if (response && response.success) {
        currentProductData = response.data;

        // Get detailed info from API based on platform
        if (
          currentProductData.platform === "digikala" &&
          currentProductData.id
        ) {
          try {
            const detailResponse = await new Promise((resolve) => {
              browserAPI.runtime.sendMessage(
                {
                  action: "getProductDetails",
                  productId: currentProductData.id,
                },
                resolve
              );
            });
            logToBackground(
              "Digikala product details from API:",
              detailResponse
            );

            if (detailResponse && detailResponse.success) {
              currentProductData = {
                ...currentProductData,
                ...detailResponse.data,
                name: detailResponse.data.title || currentProductData.name,
                image:
                  detailResponse.data.mainImage || currentProductData.image,
              };
            }
          } catch (apiError) {
            logToBackground("Digikala API product details error:", apiError);
          }
        } else if (
          currentProductData.platform === "torob" &&
          currentProductData.productKey
        ) {
          try {
            const detailResponse = await new Promise((resolve) => {
              browserAPI.runtime.sendMessage(
                {
                  action: "getTorobProductDetails",
                  productKey: currentProductData.productKey,
                },
                resolve
              );
            });
            logToBackground("Torob product details from API:", detailResponse);

            if (detailResponse && detailResponse.success) {
              currentProductData = {
                ...currentProductData,
                ...detailResponse.data,
                name: detailResponse.data.title || currentProductData.name,
                image: detailResponse.data.image || currentProductData.image,
              };
            }
          } catch (apiError) {
            logToBackground("Torob API product details error:", apiError);
          }
        }

        productName.textContent =
          currentProductData.name || currentProductData.title;
        currentPrice.textContent = formatPrice(
          currentProductData.price,
          currentProductData.platform
        );

        // Display product image if available
        const productImage = document.getElementById("productImage");
        const imagePlaceholder = document.getElementById("imagePlaceholder");

        if (currentProductData.image && currentProductData.image.trim()) {
          productImage.src = currentProductData.image;
          productImage.style.display = "block";
          imagePlaceholder.style.display = "none";

          // Handle image load error
          productImage.onerror = function () {
            productImage.style.display = "none";
            imagePlaceholder.style.display = "flex";
          };
        } else {
          productImage.style.display = "none";
          imagePlaceholder.style.display = "flex";
        }

        currentProduct.style.display = "block";
      }
    } catch (error) {
      logToBackground("Product info error:", error);
    }
  } else {
    // Check for universal product detection on other e-commerce sites
    try {
      // Check stored detected products first
      const stored = await browserAPI.storage.local.get([
        "detectedProducts",
        "detectionSite",
        "detectionTime",
      ]);
      const currentTime = Date.now();

      // Use stored data if it's recent (within 5 minutes) and from current tab
      if (
        stored.detectedProducts &&
        stored.detectionTime &&
        currentTime - stored.detectionTime < 300000 &&
        stored.detectionSite &&
        tab.url.includes(stored.detectionSite.hostname)
      ) {
        showDetectedProducts(stored.detectedProducts, stored.detectionSite);
      } else {
        // Try to get fresh product detection
        const response = await browserAPI.tabs.sendMessage(tab.id, {
          action: "getAllProducts",
        });
        if (
          response &&
          response.success &&
          response.data &&
          response.data.length > 0
        ) {
          showDetectedProducts(response.data, {
            hostname: new URL(tab.url).hostname,
          });
        }
      }
    } catch (error) {
      logToBackground("Universal product detection error:", error);
    }
  }

  // Search functionality
  searchBtn.addEventListener("click", performSearch);
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      performSearch();
    }
  });

  // Find prices for current product
  findPricesBtn.addEventListener("click", async function () {
    if (currentProductData) {
      // Set search input and perform search
      searchInput.value = currentProductData.name || currentProductData.title;
      performSearch();
    }
  });

  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Reset search state for new search
    searchState = {
      query: query,
      digikala: {
        page: 1,
        hasMore: true,
        loading: false,
        results: [],
      },
      torob: {
        page: 1,
        hasMore: true,
        loading: false,
        results: [],
      },
    };

    showLoading();

    try {
      const results = await searchBothPlatforms(query);
      logToBackground("Search both platforms result:", results);

      // Store results in search state
      if (results.digikala.success) {
        searchState.digikala.results = results.digikala.data || [];
        searchState.digikala.hasMore =
          (results.digikala.data || []).length >= 5;
      }
      if (results.torob.success) {
        searchState.torob.results = results.torob.data || [];
        searchState.torob.hasMore = (results.torob.data || []).length >= 10;
      }

      displayResults(results);
      setupInfiniteScroll();

      // Persist search results
      await persistSearchResults(searchState, results);
    } catch (error) {
      showError("خطا در جستجو. لطفاً دوباره تلاش کنید.");
      console.error("Search error:", error);
      logToBackground("Search error:", error);
    }
  }

  async function searchBothPlatforms(query) {
    try {
      const response = await new Promise((resolve) => {
        browserAPI.runtime.sendMessage(
          { action: "searchBothPlatforms", query: query },
          resolve
        );
      });

      if (response && response.success) {
        return response.data;
      } else {
        throw new Error(response?.error || "خطا در جستجو");
      }
    } catch (error) {
      console.error("Error searching both platforms:", error);
      throw new Error("خطا در ارتباط با سرور");
    }
  }

  function showLoading() {
    // Create skeleton items using DOM methods
    function createSkeletonItem(index) {
      const item = createElement("div", { class: "skeleton-item" });
      const content = createElement("div", { class: "skeleton-content" });
      const image = createElement("div", { class: "skeleton-image" });
      const details = createElement("div", { class: "skeleton-details" });
      const title = createElement("div", {
        class: index % 2 === 0 ? "skeleton-title short" : "skeleton-title",
      });
      const seller = createElement("div", { class: "skeleton-seller" });
      const price = createElement("div", { class: "skeleton-price" });

      details.appendChild(title);
      details.appendChild(seller);
      details.appendChild(price);
      content.appendChild(image);
      content.appendChild(details);
      item.appendChild(content);

      return item;
    }

    // Clear and populate containers
    digikalaResults.textContent = "";
    torobResults.textContent = "";

    for (let i = 0; i < 3; i++) {
      digikalaResults.appendChild(createSkeletonItem(i));
      torobResults.appendChild(createSkeletonItem(i));
    }

    // Add loading state to search button
    searchBtn.disabled = true;
    searchBtn.textContent = "جستجو";
    const loadingDots = createElement("span", { class: "loading-dots" });
    searchBtn.appendChild(loadingDots);
  }

  function showError(message) {
    // Reset search button state
    searchBtn.disabled = false;
    searchBtn.textContent = "جستجو";

    const errorDiv = createElement("div", { class: "error-state" }, message);
    digikalaResults.textContent = "";
    torobResults.textContent = "";
    digikalaResults.appendChild(errorDiv.cloneNode(true));
    torobResults.appendChild(errorDiv);
  }

  function displayResults(data) {
    // Reset search button state
    searchBtn.disabled = false;
    searchBtn.textContent = "جستجو";

    if (!data) {
      const emptyDiv = createElement(
        "div",
        { class: "empty-state" },
        "نتیجه‌ای یافت نشد"
      );
      digikalaResults.textContent = "";
      torobResults.textContent = "";
      digikalaResults.appendChild(emptyDiv.cloneNode(true));
      torobResults.appendChild(emptyDiv);
      return;
    }

    // Display Digikala results
    if (
      data.digikala &&
      data.digikala.success &&
      data.digikala.data.length > 0
    ) {
      const digikalaElements = renderPlatformResults(
        data.digikala.data,
        "digikala"
      );
      // Clear container and add DOM elements
      digikalaResults.textContent = "";
      digikalaElements.forEach((element) => {
        digikalaResults.appendChild(element);
      });

      // Force a reflow and ensure visibility
      setTimeout(() => {
        const items = digikalaResults.querySelectorAll(".product-item");
        items.forEach((item) => {
          item.style.display = "block";
          item.style.visibility = "visible";
          item.style.opacity = "1";
        });
      }, 100);
    } else {
      const errorDiv = createElement(
        "div",
        { class: "error-state" },
        data.digikala?.error || "نتیجه‌ای در دیجیکالا یافت نشد"
      );
      digikalaResults.textContent = "";
      digikalaResults.appendChild(errorDiv);
    }

    // Display Torob results
    if (data.torob && data.torob.success && data.torob.data.length > 0) {
      const torobElements = renderPlatformResults(data.torob.data, "torob");
      // Clear container and add DOM elements
      torobResults.textContent = "";
      torobElements.forEach((element) => {
        torobResults.appendChild(element);
      });

      // Force a reflow and ensure visibility
      setTimeout(() => {
        const items = torobResults.querySelectorAll(".product-item");
        items.forEach((item) => {
          item.style.display = "block";
          item.style.visibility = "visible";
          item.style.opacity = "1";
        });
      }, 100);
    } else {
      const errorDiv = createElement(
        "div",
        { class: "error-state" },
        data.torob?.error || "نتیجه‌ای در ترب یافت نشد"
      );
      torobResults.textContent = "";
      torobResults.appendChild(errorDiv);
    }

    // Add click event listeners
    addClickHandlers();
  }

  function renderPlatformResults(items, platform) {
    if (!items || items.length === 0) {
      return [
        createElement("div", { class: "empty-state" }, "نتیجه‌ای یافت نشد"),
      ];
    }

    const elements = [];

    items.forEach((item, index) => {
      const rankBadge =
        index === 0 ? "🏆" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";

      // Create main product item
      const productItem = createElement("div", {
        class: "product-item",
        "data-url": item.url,
        "data-platform": platform,
      });

      // Create content container
      const content = createElement("div", { class: "product-item-content" });

      // Create image container
      const imageContainer = createElement("div", {
        class: "product-item-image",
      });

      if (item.image && item.image.trim()) {
        const img = createElement("img", {
          src: item.image,
          alt: "تصویر محصول",
          class: "search-result-image",
        });

        const placeholder = createElement(
          "div",
          {
            class: "search-result-image-placeholder",
            style: "display: none;",
          },
          "🖼️"
        );

        // Handle image error
        img.onerror = function () {
          this.style.display = "none";
          placeholder.style.display = "flex";
        };

        imageContainer.appendChild(img);
        imageContainer.appendChild(placeholder);
      } else {
        const placeholder = createElement(
          "div",
          {
            class: "search-result-image-placeholder",
          },
          "🖼️"
        );
        imageContainer.appendChild(placeholder);
      }

      // Create details container
      const details = createElement("div", { class: "product-item-details" });

      // Product title
      const title = createElement(
        "div",
        { class: "product-title" },
        item.title || item.name || "محصول نامشخص"
      );

      // Seller container
      const sellerContainer = createElement("div", { class: "product-seller" });

      const sellerInfo = createElement("div", {
        style: "font-size: 12px; color: #718096; margin-bottom: 8px;",
      });
      // Format seller display - add text for numbers
      // Check for both ASCII and Persian numbers
      const isNumber = /^[\d۰-۹]+$/.test(item.seller);
      const displaySeller = isNumber
        ? `تعداد فروشنده ${item.seller}` 
        : item.seller;
      sellerInfo.appendChild(document.createTextNode(displaySeller));

      if (rankBadge) {
        const badge = createElement(
          "span",
          {
            style: "margin-right: 4px;",
          },
          rankBadge
        );
        sellerInfo.appendChild(badge);
      }

      const rating = createElement(
        "div",
        {
          style: "font-size: 11px; color: #a0aec0;",
        },
        `⭐ ${(item.sellerRating || item.rating || 4.0).toFixed(1)}`
      );

      sellerContainer.appendChild(sellerInfo);
      sellerContainer.appendChild(rating);

      // Price
      const price = createElement(
        "div",
        { class: "product-price" },
        formatPrice(item.price, platform)
      );

      // Assemble the structure
      details.appendChild(title);
      details.appendChild(sellerContainer);
      details.appendChild(price);
      content.appendChild(imageContainer);
      content.appendChild(details);
      productItem.appendChild(content);

      elements.push(productItem);
    });

    return elements;
  }

  function addClickHandlers() {
    // Add click handlers to all product items (without cloning to avoid display issues)
    const productItems = document.querySelectorAll(
      ".product-item:not([data-click-handled])"
    );
    productItems.forEach((item) => {
      // Mark as handled to avoid duplicate handlers
      item.setAttribute("data-click-handled", "true");
      item.addEventListener("click", async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const url = this.getAttribute("data-url");
        const platform = this.getAttribute("data-platform");

        if (url) {
          // Clean up URL for better display (especially for Torob)
          let cleanUrl = url;
          if (platform === "torob") {
            // Remove any problematic parameters that might cause split screen
            const urlObj = new URL(url);
            // Remove utm parameters and other tracking parameters
            const paramsToRemove = [
              "utm_source",
              "utm_medium",
              "utm_campaign",
              "ref",
              "source",
            ];
            paramsToRemove.forEach((param) => {
              urlObj.searchParams.delete(param);
            });
            // Add extension indicator for width fix
            urlObj.searchParams.set("from-extension", "1");
            cleanUrl = urlObj.toString();
          }

          // Handle platform-specific URL behavior
          if (platform === "digikala") {
            // Check if it's same product, different seller for Digikala
            const urlMatch = url.match(/\/product\/dkp-(\d+)/);
            const clickedProductId = urlMatch ? urlMatch[1] : null;
            const currentProductId =
              currentProductData && currentProductData.id
                ? String(currentProductData.id)
                : null;
            const sellerViewTokenMatch = url.match(/seller-view-token=([^&]+)/);
            const sellerViewToken = sellerViewTokenMatch
              ? sellerViewTokenMatch[1]
              : null;

            if (
              clickedProductId &&
              currentProductId &&
              clickedProductId === currentProductId &&
              sellerViewToken
            ) {
              const sellerName =
                item.querySelector("strong")?.textContent || "فروشنده";
              showSellerModal(sellerName);
              return;
            }
          }

          // Open in new tab with proper configuration
          try {
            // Firefox-compatible tab creation
            const newTab = await browserAPI.tabs.create({
              url: cleanUrl,
              active: true, // Switch to the new tab immediately
            });

            // For Torob specifically, ensure proper display
            if (platform === "torob") {
              // Small delay to ensure tab is ready
              setTimeout(async () => {
                try {
                  // Make sure the tab is active and focused
                  await browserAPI.tabs.update(newTab.id, { active: true });
                  // Firefox doesn't need window maximizing for extensions

                  // Send message to apply width fix
                  setTimeout(async () => {
                    try {
                      await browserAPI.tabs.sendMessage(newTab.id, {
                        action: "applyWidthFix",
                      });
                      // Width fix message sent successfully
                    } catch (messageError) {
                      // Silently handle width fix message errors
                    }
                  }, 1000); // Wait for page to load
                } catch (focusError) {
                  // Silently handle Torob tab focus errors
                }
              }, 200);
            }

            // Close the popup after opening the tab
            setTimeout(() => {
              window.close();
            }, 300);
          } catch (error) {
            console.error("Error opening tab:", error);
            // Fallback to simple tab creation
            browserAPI.tabs.create({
              url: cleanUrl,
              active: true,
            });
            window.close();
          }
        }
      });
    });
  }

  function formatPrice(price, platform = null) {
    if (!price) {
      if (platform === "torob") {
        return "ناموجود";
      }
      return "نامشخص";
    }
    // Convert from Rial to Toman (divide by 10)
    const tomanPrice = Math.floor(price / 10);
    return tomanPrice.toLocaleString("fa-IR") + " تومان";
  }

  // Setup infinite scroll for both platform result containers
  function setupInfiniteScroll() {
    // Setup scroll listener for Digikala results
    const digikalaContainer = digikalaResults;
    digikalaContainer.addEventListener("scroll", () => {
      if (shouldLoadMoreResults(digikalaContainer, "digikala")) {
        loadMoreResults("digikala");
      }
    });

    // Setup scroll listener for Torob results
    const torobContainer = torobResults;
    torobContainer.addEventListener("scroll", () => {
      if (shouldLoadMoreResults(torobContainer, "torob")) {
        loadMoreResults("torob");
      }
    });
  }

  // Check if we should load more results based on scroll position
  function shouldLoadMoreResults(container, platform) {
    const state = searchState[platform];
    if (!state.hasMore || state.loading) {
      return false;
    }

    // Check if user has scrolled near the bottom
    const scrollPosition = container.scrollTop + container.clientHeight;
    const scrollThreshold = container.scrollHeight - 100; // 100px before bottom

    return scrollPosition >= scrollThreshold;
  }

  // Load more results for a specific platform
  async function loadMoreResults(platform) {
    const state = searchState[platform];
    if (state.loading || !state.hasMore) return;

    state.loading = true;
    const nextPage = state.page + 1;

    // Show loading indicator at bottom of results
    showLoadingMore(platform);

    try {
      const response = await new Promise((resolve) => {
        browserAPI.runtime.sendMessage(
          {
            action: "loadMoreResults",
            query: searchState.query,
            platform: platform,
            page: nextPage,
          },
          resolve
        );
      });

      if (
        response &&
        response.success &&
        response.data &&
        response.data.data.length > 0
      ) {
        // Append new results to existing results
        state.results = state.results.concat(response.data.data);
        state.page = nextPage;

        // Determine if there are more pages based on result count
        if (platform === "digikala") {
          state.hasMore = response.data.data.length >= 5;
        } else {
          state.hasMore = response.data.data.length >= 10;
        }

        // Update display with new results
        const container =
          platform === "digikala" ? digikalaResults : torobResults;
        const newResultElements = renderPlatformResults(
          response.data.data,
          platform
        );

        // Remove loading indicator and append new results
        removeLoadingMore(platform);
        appendResults(container, newResultElements);

        // Re-add click handlers for new items
        addClickHandlers();
      } else {
        state.hasMore = false;
        removeLoadingMore(platform);
      }
    } catch (error) {
      console.error(`Error loading more ${platform} results:`, error);
      removeLoadingMore(platform);
      state.hasMore = false;
    } finally {
      state.loading = false;
    }
  }

  // Show loading indicator at bottom of platform results
  function showLoadingMore(platform) {
    const container = platform === "digikala" ? digikalaResults : torobResults;

    const loadingDiv = createElement("div", {
      class: "loading-more",
      id: `${platform}LoadingMore`,
    });

    const spinner = createElement("div", {
      class: "loading-spinner",
      style: "width: 20px; height: 20px; margin: 16px auto;",
    });

    const text = createElement(
      "div",
      {
        style: "text-align: center; font-size: 12px; color: #718096;",
      },
      "در حال بارگذاری..."
    );

    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(text);
    container.appendChild(loadingDiv);
  }

  // Remove loading indicator
  function removeLoadingMore(platform) {
    const loadingEl = document.getElementById(`${platform}LoadingMore`);
    if (loadingEl) {
      loadingEl.remove();
    }
  }

  // Append new results to container
  function appendResults(container, newResultElements) {
    // Append each new result element
    newResultElements.forEach((element) => {
      container.appendChild(element);
    });
  }

  // Function to show detected products from universal detection
  function showDetectedProducts(products, site) {
    const detectedProducts = document.getElementById("detectedProducts");
    const detectedProductsList = document.getElementById(
      "detectedProductsList"
    );

    if (!products || products.length === 0) {
      detectedProducts.style.display = "none";
      return;
    }

    // Update header with site info
    const subtitle = document.querySelector(
      "#detectedProducts .platform-subtitle"
    );
    subtitle.textContent = `در ${site.hostname} محصولات زیر پیدا کردیم`;

    // Render detected products using DOM methods
    detectedProductsList.textContent = ""; // Clear existing products

    products.slice(0, 5).forEach((product) => {
      // Create main item container
      const item = createElement("div", {
        class: "detected-product-item",
        "data-product-name": product.name,
      });

      // Create content container
      const content = createElement("div", {
        class: "detected-product-content",
      });

      // Create image container
      const imageDiv = createElement("div", {
        class: "detected-product-image",
      });

      if (product.image && product.image.trim()) {
        // Create img element
        const img = createElement("img", {
          src: product.image,
          alt: "تصویر محصول",
          class: "search-result-image",
        });

        // Create placeholder that will show on error
        const placeholder = createElement(
          "div",
          {
            class: "search-result-image-placeholder",
            style: "display: none;",
          },
          "🖼️"
        );

        // Handle image load error
        img.onerror = function () {
          this.style.display = "none";
          placeholder.style.display = "flex";
        };

        imageDiv.appendChild(img);
        imageDiv.appendChild(placeholder);
      } else {
        // Just show placeholder
        const placeholder = createElement(
          "div",
          {
            class: "search-result-image-placeholder",
          },
          "🖼️"
        );
        imageDiv.appendChild(placeholder);
      }

      // Create details container
      const details = createElement("div", {
        class: "detected-product-details",
      });

      // Product name
      const name = createElement(
        "div",
        { class: "detected-product-name" },
        product.name
      );

      // Source container
      const source = createElement("div", { class: "detected-product-source" });
      const sourceText = createElement("div", {}, `از ${site.hostname}`);
      source.appendChild(sourceText);

      // Add price if available
      if (product.price) {
        const priceDiv = createElement("div", {}, formatPrice(product.price));
        source.appendChild(priceDiv);
      }

      // Assemble the structure
      details.appendChild(name);
      details.appendChild(source);
      content.appendChild(imageDiv);
      content.appendChild(details);
      item.appendChild(content);

      detectedProductsList.appendChild(item);
    });
    detectedProducts.style.display = "block";

    // Add click handlers for detected products
    const detectedItems = detectedProductsList.querySelectorAll(
      ".detected-product-item"
    );
    detectedItems.forEach((item) => {
      item.addEventListener("click", function () {
        const productName = this.getAttribute("data-product-name");
        if (productName) {
          // Set search input and perform search
          searchInput.value = productName;
          performSearch();
        }
      });
    });
  }

  // Function to persist search results
  async function persistSearchResults(searchState, results) {
    try {
      const persistData = {
        searchState: searchState,
        results: results,
        timestamp: Date.now(),
        version: "0.0.1",
      };

      await browserAPI.storage.local.set({
        persistedSearchResults: persistData,
      });
    } catch (error) {
      console.error("Failed to persist search results:", error);
      logToBackground("Persist search results error:", error);
    }
  }

  // Function to load persisted search results
  async function loadPersistedSearchResults() {
    try {
      const stored = await browserAPI.storage.local.get([
        "persistedSearchResults",
      ]);
      const persistData = stored.persistedSearchResults;

      if (!persistData || !persistData.searchState || !persistData.results) {
        return;
      }

      // Clear old cache if version doesn't match (for updates)
      if (!persistData.version || persistData.version !== "0.0.1") {
        await browserAPI.storage.local.remove(["persistedSearchResults"]);
        return;
      }

      // Check if data is recent (within 24 hours)
      const currentTime = Date.now();
      const dataAge = currentTime - persistData.timestamp;
      const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (dataAge > twentyFourHours) {
        await browserAPI.storage.local.remove(["persistedSearchResults"]);
        return;
      }

      // Restore search state
      searchState = persistData.searchState;

      // Restore search input
      if (searchState.query) {
        searchInput.value = searchState.query;
      }

      displayResults(persistData.results);
      setupInfiniteScroll();

      // Add clear button for persisted results
      addClearResultsButton();
    } catch (error) {
      console.error("Failed to load persisted search results:", error);
      logToBackground("Load persisted search results error:", error);
    }
  }

  // Function to clear persisted search results
  async function clearPersistedSearchResults() {
    try {
      await browserAPI.storage.local.remove(["persistedSearchResults"]);
    } catch (error) {
      console.error("Failed to clear persisted search results:", error);
    }
  }

  // Add a clear button to the UI (optional)
  function addClearResultsButton() {
    // Check if there are search results either in state or displayed in DOM
    const hasStateResults =
      searchState.query &&
      (searchState.digikala.results.length > 0 ||
        searchState.torob.results.length > 0);
    const hasDisplayedResults =
      searchState.query &&
      (digikalaResults.querySelectorAll(".product-item").length > 0 ||
        torobResults.querySelectorAll(".product-item").length > 0);

    if (hasStateResults || hasDisplayedResults) {
      const searchContainer = document.querySelector(".search-container");
      let clearBtn = document.getElementById("clearResultsBtn");

      if (!clearBtn) {
        clearBtn = document.createElement("button");
        clearBtn.id = "clearResultsBtn";
        clearBtn.className = "search-btn";
        clearBtn.style.marginLeft = "8px"; // Add some spacing
        clearBtn.textContent = "پاک کردن نتایج";
        clearBtn.addEventListener("click", async function () {
          await clearPersistedSearchResults();
          location.reload(); // Refresh the popup
        });
        searchContainer.appendChild(clearBtn);
      }
    }
  }

  // Call addClearResultsButton after displaying results
  const originalDisplayResults = displayResults;
  displayResults = function (data) {
    originalDisplayResults(data);
    addClearResultsButton();
  };
});
