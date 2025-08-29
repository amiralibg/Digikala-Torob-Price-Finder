// Background script for the Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed successfully
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup automatically due to default_popup in manifest
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.includes("digikala.com/product/") ||
      tab.url.includes("torob.com/p/"))
  ) {
    // Content script should already be injected via manifest, but we can add additional logic here if needed
    chrome.tabs.sendMessage(tabId, { action: "pageUpdated" }).catch(() => {
      // Ignore errors if content script is not ready yet
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "searchPrices") {
    searchPricesAPI(request.query)
      .then((results) => sendResponse({ success: true, data: results }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "searchBothPlatforms") {
    searchBothPlatforms(
      request.query,
      request.digikalaPage || 1,
      request.torobPage || 1
    )
      .then((results) => sendResponse({ success: true, data: results }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "loadMoreResults") {
    loadMoreResults(request.query, request.platform, request.page)
      .then((results) => sendResponse({ success: true, data: results }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "searchTorob") {
    searchTorobAPI(request.query, request.page || 1)
      .then((results) => sendResponse({ success: true, data: results }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "getProductDetails") {
    getDigikalaProductDetails(request.productId)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "getTorobProductDetails") {
    getTorobProductDetails(request.productKey)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "getProductCPC") {
    getProductCPC(request.productId)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "log") {
    // Handle log messages from popup
    // Log messages silently handled
    return false; // No response needed
  }
});

// Function to search prices using real Digikala API
async function searchPricesAPI(query, page = 1) {
  try {
    // Search for products directly using Digikala API
    const searchUrl = `https://api.digikala.com/v1/search/?q=${encodeURIComponent(
      query
    )}&page=${page}`;

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      throw new Error(`Search API returned status ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    // Extract product data and format for our needs
    const products = searchData.data?.products || [];

    const results = products
      .map((product) => {
        const price =
          product.default_variant?.price?.selling_price ||
          product.price?.selling_price ||
          0;
        const originalPrice =
          product.default_variant?.price?.rrp_price ||
          product.price?.rrp_price ||
          price;
        const seller = product.default_variant?.seller || product.seller || {};

        return {
          productId: product.id,
          seller: seller.title || "دیجیکالا",
          sellerCode: seller.code || "",
          sellerRating: seller.stars || seller.rating?.total_rate || 4.0,
          sellerGrade: seller.grade?.label || seller.grade?.title || "خوب",
          price: price,
          originalPrice: originalPrice,
          rating: product.rating?.average_rating || 4.0,
          title: product.title_fa || product.title_en || "محصول نامشخص",
          url: `https://www.digikala.com/product/dkp-${product.id}/`,
          image: getProductImage(product),
          discount:
            originalPrice > price
              ? Math.round(((originalPrice - price) / originalPrice) * 100)
              : 0,
          isTrusted: seller.properties?.is_trusted || false,
          isOfficial: seller.properties?.is_official || false,
        };
      })
      .sort((a, b) => {
        // Put products with price 0 at bottom
        if (a.price === 0 && b.price === 0) return 0;
        if (a.price === 0) return 1;
        if (b.price === 0) return -1;
        return a.price - b.price;
      })
      .slice(0, 5);

    return results;
  } catch (error) {
    // Fallback to basic search if main search fails
    try {
      const fallbackUrl = `https://api.digikala.com/v1/search/?q=${encodeURIComponent(
        query
      )}&page=${page}`;

      const searchResponse = await fetch(fallbackUrl);

      if (!searchResponse.ok) {
        throw new Error(
          `Fallback search API returned status ${searchResponse.status}`
        );
      }

      const searchData = await searchResponse.json();

      const products = searchData.data?.products || [];

      return products
        .map((product) => {
          const price =
            product.default_variant?.price?.selling_price ||
            product.price?.selling_price ||
            0;
          const seller =
            product.default_variant?.seller || product.seller || {};

          return {
            productId: product.id,
            seller: seller.title || "دیجیکالا",
            sellerCode: seller.code || "",
            sellerRating: seller.stars || seller.rating?.total_rate || 4.0,
            sellerGrade: seller.grade?.label || seller.grade?.title || "خوب",
            price: price,
            rating: product.rating?.average_rating || 4.0,
            title: product.title_fa || "محصول نامشخص",
            url: `https://www.digikala.com/product/dkp-${product.id}/`,
            image: getProductImage(product),
            isTrusted: seller.properties?.is_trusted || false,
            isOfficial: seller.properties?.is_official || false,
          };
        })
        .sort((a, b) => {
          // Put products with price 0 at bottom
          if (a.price === 0 && b.price === 0) return 0;
          if (a.price === 0) return 1;
          if (b.price === 0) return -1;
          return a.price - b.price;
        })
        .slice(0, 5);
    } catch (fallbackError) {
      throw new Error("جستجو با خطا مواجه شد");
    }
  }
}

// Function to get product details from Digikala API
async function getDigikalaProductDetails(productId) {
  try {
    const response = await fetch(
      `https://api.digikala.com/v2/product/${productId}/`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const product = data.data?.product;

    if (!product) {
      throw new Error("محصول یافت نشد");
    }

    // Extract relevant product information
    const price =
      product.default_variant?.price?.selling_price ||
      product.price?.selling_price ||
      0;
    const originalPrice =
      product.default_variant?.price?.rrp_price ||
      product.price?.rrp_price ||
      price;

    return {
      id: productId,
      title: product.title_fa || product.title_en || "محصول نامشخص",
      price: price,
      originalPrice: originalPrice,
      discount:
        originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0,
      rating: product.rating?.average_rating || 0,
      reviewCount: product.rating?.count || 0,
      brand: product.brand?.title_fa || product.brand?.title_en || "",
      category: product.category?.title_fa || product.category?.title_en || "",
      images: product.images?.list || [],
      mainImage: getProductImage(product),
      availability:
        product.default_variant?.is_available || product.is_available || false,
      url: `https://www.digikala.com/product/dkp-${productId}/`,
      specifications: product.specifications || [],
      description: product.review?.description || "",
    };
  } catch (error) {
    throw new Error("خطا در دریافت اطلاعات محصول");
  }
}

// Function to get same product with different sellers (variants only)
async function getProductCPC(productId) {
  try {
    // Get the main product details with all variants (different sellers)
    const productResponse = await fetch(
      `https://api.digikala.com/v2/product/${productId}/`
    );

    if (!productResponse.ok) {
      throw new Error(`Product API error! status: ${productResponse.status}`);
    }

    const productData = await productResponse.json();
    const product = productData.data?.product;

    if (!product) {
      throw new Error("Product not found");
    }

    // Check multiple places where seller variants might be stored
    const variants = product.variants || [];
    const variantsWithPrice = product.variants_with_price || [];
    const sellers = product.sellers || [];
    const allSellers = product.all_sellers || [];

    // Check different seller data sources and available product keys

    // Try different sources for multiple sellers
    let allSellerVariants = [];

    // Check variants first, then try other sources
    if (variants.length > 1) {
      allSellerVariants = variants;
    } else if (variantsWithPrice.length > 1) {
      allSellerVariants = variantsWithPrice;
    } else if (sellers.length > 1) {
      allSellerVariants = sellers;
    } else if (allSellers.length > 1) {
      allSellerVariants = allSellers;
    }

    if (allSellerVariants.length > 1) {
      // Process multiple seller variants

      // Map the variants to our format
      const sellerResults = allSellerVariants
        .filter((variant) => {
          // Check various status fields
          return (
            variant.status === "marketable" ||
            variant.is_available === true ||
            (!variant.status && variant.price?.selling_price > 0)
          );
        })
        .map((variant) => {
          const price =
            variant.price?.selling_price || variant.selling_price || 0;
          const originalPrice =
            variant.price?.rrp_price || variant.rrp_price || price;
          const seller = variant.seller || variant || {};

          // Extract color and size information
          const color =
            variant.color ||
            variant.themes?.find((t) => t.type === "colored")?.value;
          const size =
            variant.size ||
            variant.themes?.find((t) => t.type === "text")?.value;

          // Extract variant information for processing

          // Build variant description for display
          let variantDescription = "";
          const colorName = color ? color.title || color.name || color : null;
          const sizeName = size ? size.title || size.name || size : null;

          if (colorName && sizeName) {
            variantDescription = `${colorName} - ${sizeName}`;
          } else if (colorName) {
            variantDescription = colorName;
          } else if (sizeName) {
            variantDescription = sizeName;
          }

          return {
            productId: product.id,
            variantId: variant.id,
            seller: seller.title || seller.name || "دیجیکالا",
            sellerCode: seller.code || "",
            sellerRating:
              seller.stars || seller.rating?.total_rate || seller.rating || 4.0,
            sellerGrade:
              seller.grade?.label ||
              seller.grade?.title ||
              seller.grade ||
              "خوب",
            price: price,
            originalPrice: originalPrice,
            rating:
              variant.rate ||
              seller.rate ||
              product.rating?.average_rating ||
              4.0,
            title: product.title_fa || product.title_en || "محصول نامشخص",
            url:
              variant.url ||
              `https://www.digikala.com/product/dkp-${product.id}/?seller-view-token=${variant.id}`,
            image: getProductImage(product),
            discount:
              originalPrice > price
                ? Math.round(((originalPrice - price) / originalPrice) * 100)
                : 0,
            isTrusted:
              seller.properties?.is_trusted || seller.is_trusted || false,
            isOfficial:
              seller.properties?.is_official || seller.is_official || false,
            isIncredible:
              variant.price?.is_incredible || variant.is_incredible || false,
            leadTime: variant.lead_time || 0,
            availability: variant.is_available !== false,
            // Add variant information
            variantDescription: variantDescription,
            color: colorName,
            size: sizeName,
          };
        })
        .filter((seller, index, array) => {
          // Remove duplicates by seller name and price
          return (
            seller.price > 0 &&
            array.findIndex(
              (s) => s.seller === seller.seller && s.price === seller.price
            ) === index
          );
        })
        .sort((a, b) => {
          // Put products with price 0 at bottom
          if (a.price === 0 && b.price === 0) return 0;
          if (a.price === 0) return 1;
          if (b.price === 0) return -1;
          return a.price - b.price;
        });

      if (sellerResults.length > 1) {
        return sellerResults;
      }
    }

    // Fallback: Try using search API to find multiple sellers for this product
    try {
      const productTitle = product.title_fa || product.title_en || "";
      if (productTitle) {
        const searchResults = await searchPricesAPI(productTitle);

        // Helper function to calculate title similarity
        const calculateTitleSimilarity = (str1, str2) => {
          const words1 = str1.split(/\s+/).filter((w) => w.length > 2);
          const words2 = str2.split(/\s+/).filter((w) => w.length > 2);
          const commonWords = words1.filter((w) => words2.includes(w));
          return commonWords.length / Math.max(words1.length, words2.length, 1);
        };

        // Filter search results to include similar products (lower threshold)
        const sameProductResults = searchResults
          .filter((result) => {
            const similarity = calculateTitleSimilarity(
              productTitle.toLowerCase(),
              (result.title || "").toLowerCase()
            );
            // Compare product titles for similarity
            return similarity > 0.7 || result.productId === product.id;
          })
          .map((result) => {
            const similarity = calculateTitleSimilarity(
              productTitle.toLowerCase(),
              (result.title || "").toLowerCase()
            );
            // Only force productId/url for exact match
            if (similarity === 1 || result.productId === product.id) {
              return {
                ...result,
                productId: product.id,
                url: result.url,
              };
            } else {
              // Keep original productId and url for similar products
              return {
                ...result,
              };
            }
          });

        if (sameProductResults.length > 1) {
          return sameProductResults.sort((a, b) => {
            // Put products with price 0 at bottom
            if (a.price === 0 && b.price === 0) return 0;
            if (a.price === 0) return 1;
            if (b.price === 0) return -1;
            return a.price - b.price;
          });
        }
      }
    } catch (searchError) {
      // Search fallback failed, continue to default variant
    }

    // If no multiple sellers found, return the single default variant with a note
    const defaultVariant = product.default_variant;
    if (defaultVariant) {
      const price = defaultVariant.price?.selling_price || 0;
      const originalPrice = defaultVariant.price?.rrp_price || price;
      const seller = defaultVariant.seller || {};

      return [
        {
          productId: product.id,
          variantId: defaultVariant.id,
          seller: seller.title || "دیجیکالا",
          sellerCode: seller.code || "",
          sellerRating: seller.stars || seller.rating?.total_rate || 4.0,
          sellerGrade: seller.grade?.label || seller.grade?.title || "خوب",
          price: price,
          originalPrice: originalPrice,
          rating: defaultVariant.rate || product.rating?.average_rating || 4.0,
          title: product.title_fa || product.title_en || "محصول نامشخص",
          url: `https://www.digikala.com/product/dkp-${product.id}/`,
          image: getProductImage(product),
          discount:
            originalPrice > price
              ? Math.round(((originalPrice - price) / originalPrice) * 100)
              : 0,
          isTrusted: seller.properties?.is_trusted || false,
          isOfficial: seller.properties?.is_official || false,
          isIncredible: defaultVariant.price?.is_incredible || false,
          leadTime: defaultVariant.lead_time || 0,
          note: "این محصول تنها از یک فروشنده موجود است",
        },
      ];
    }

    return [];
  } catch (error) {
    return [];
  }
}

// Function to search both platforms simultaneously
async function searchBothPlatforms(query, digikalaPage = 1, torobPage = 1) {
  try {
    const [digikalaResults, torobResults] = await Promise.allSettled([
      searchPricesAPI(query, digikalaPage),
      searchTorobAPI(query, torobPage),
    ]);

    return {
      digikala: {
        success: digikalaResults.status === "fulfilled",
        data:
          digikalaResults.status === "fulfilled" ? digikalaResults.value : [],
        error:
          digikalaResults.status === "rejected"
            ? digikalaResults.reason.message
            : null,
      },
      torob: {
        success: torobResults.status === "fulfilled",
        data: torobResults.status === "fulfilled" ? torobResults.value : [],
        error:
          torobResults.status === "rejected"
            ? torobResults.reason.message
            : null,
      },
    };
  } catch (error) {
    throw new Error("خطا در جستجو در هر دو پلتفرم");
  }
}

// Function to search prices using Torob API
async function searchTorobAPI(query, page = 1) {
  try {
    // Generate a random suid (session user ID)
    const suid = generateRandomId();

    // First, try to get suggestions to improve search query
    const suggestionUrl = `https://api.torob.com/suggestion2/?q=${encodeURIComponent(
      query
    )}&source=next_desktop`;

    let searchQuery = query;
    try {
      const suggestionResponse = await fetch(suggestionUrl);
      const suggestions = await suggestionResponse.json();
      if (suggestions && suggestions.length > 0) {
        searchQuery = suggestions[0].text || query;
      }
    } catch (suggestError) {
      // Suggestion API failed, use original query
    }

    // Search for products
    const searchUrl = `https://api.torob.com/v4/base-product/search/?page=${page}&sort=popularity&size=24&query=${encodeURIComponent(
      searchQuery
    )}&q=${encodeURIComponent(searchQuery)}&source=next_desktop&rank_offset=${
      (page - 1) * 24
    }&suid=${suid}`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const products = data.results || [];

    const results = products
      .map((product) => {
        const price = product.price || 0;
        const shop_text = product.shop_text || "";

        return {
          productId: product.random_key,
          productKey: product.random_key,
          seller: (() => {
            const cleanedSeller = shop_text
              .replace("در ", "")
              .replace(" فروشگاه", "")
              .replace("فروشگاه", "")
              .trim() || "نامشخص";
            // If seller is just a number, add descriptive text
            if (/^\d+$/.test(cleanedSeller)) {
              return `${cleanedSeller} عدد فروشنده`;
            }
            return cleanedSeller;
          })(),
          sellerCount: shop_text.match(/\d+/)
            ? parseInt(shop_text.match(/\d+/)[0])
            : 1,
          sellerRating: 4.0, // Torob doesn't provide detailed seller ratings
          price: price * 10, // Convert Toman to Rial for consistency
          originalPrice: price * 10,
          rating: 4.0,
          title: product.name1 || product.name2 || "محصول نامشخص",
          url: `https://torob.com${product.web_client_absolute_url}`,
          image: product.image_url || "",
          discount: 0,
          platform: "torob",
          stock_status: product.stock_status || "",
          estimated_sell: product.estimated_sell || "",
          shop_text: shop_text,
        };
      })
      .sort((a, b) => {
        // Put products with price 0 at bottom
        if (a.price === 0 && b.price === 0) return 0;
        if (a.price === 0) return 1;
        if (b.price === 0) return -1;
        return a.price - b.price;
      })
      .slice(0, 10);

    return results;
  } catch (error) {
    throw new Error("خطا در جستجوی ترب");
  }
}

// Function to get Torob product details
async function getTorobProductDetails(productKey) {
  try {
    const suid = generateRandomId();
    const detailsUrl = `https://api.torob.com/v4/base-product/details/?source=next_desktop&discover_method=search&suid=${suid}&prk=${productKey}&max_seller_count=30`;

    const response = await fetch(detailsUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data) {
      throw new Error("محصول یافت نشد");
    }

    const price = data.price || 0;
    const shops = data.products_info?.result || [];

    // Process sellers information
    const sellers = shops
      .map((shop, index) => ({
        productId: productKey,
        seller: shop.shop_name || "نامشخص",
        sellerCode: shop.shop_id?.toString() || "",
        sellerRating: shop.shop_score || 4.0,
        sellerGrade: shop.shop_votes_count > 0 ? "خوب" : "جدید",
        price: shop.price * 10, // Convert to Rial
        originalPrice: shop.price * 10,
        rating: 4.0,
        title: data.name1 || data.name2 || "محصول نامشخص",
        url:
          shop.page_url || `https://torob.com${data.web_client_absolute_url}`,
        image: data.image_url || "",
        platform: "torob",
        availability: shop.availability !== false,
        is_price_unreliable: shop.is_price_unreliable || false,
        rank: index + 1,
      }))
      .filter((seller) => !seller.is_price_unreliable && seller.availability)
      .sort((a, b) => {
        // Put products with price 0 at bottom
        if (a.price === 0 && b.price === 0) return 0;
        if (a.price === 0) return 1;
        if (b.price === 0) return -1;
        return a.price - b.price;
      });

    return {
      id: productKey,
      title: data.name1 || data.name2 || "محصول نامشخص",
      price: price * 10,
      rating: 4.0,
      image: data.image_url || "",
      url: `https://torob.com${data.web_client_absolute_url}`,
      platform: "torob",
      sellers: sellers,
      description: data.seo_description || "",
      min_price: data.min_price ? data.min_price * 10 : 0,
      max_price: data.max_price ? data.max_price * 10 : 0,
      availability: data.availability !== false,
    };
  } catch (error) {
    throw new Error("خطا در دریافت اطلاعات محصول از ترب");
  }
}

// Function to load more results for a specific platform
async function loadMoreResults(query, platform, page) {
  try {
    let results;

    if (platform === "digikala") {
      results = await searchPricesAPI(query, page);
    } else if (platform === "torob") {
      results = await searchTorobAPI(query, page);
    } else {
      throw new Error("Invalid platform specified");
    }

    return {
      platform: platform,
      page: page,
      data: results || [],
    };
  } catch (error) {
    throw error;
  }
}

// Helper function to extract the best product image from API response
function getProductImage(product) {
  // Try different image sources in order of preference
  const imageSources = [
    product.images?.main?.url?.[0],
    product.images?.main?.url?.[1],
    product.images?.list?.[0]?.image?.url?.[0],
    product.images?.list?.[0]?.image?.url?.[1],
    product.images?.list?.[0]?.url?.[0],
    product.images?.list?.[1]?.image?.url?.[0],
    product.default_variant?.images?.main?.url?.[0],
    product.default_variant?.images?.list?.[0]?.image?.url?.[0],
  ];

  // Return the first valid image URL
  for (const imageUrl of imageSources) {
    if (
      imageUrl &&
      typeof imageUrl === "string" &&
      imageUrl.startsWith("http")
    ) {
      return imageUrl;
    }
  }

  return "";
}

// Helper function to generate random ID for API calls
function generateRandomId() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
