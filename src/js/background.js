// Background script for the Chrome extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Digikala Price Finder extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup automatically due to default_popup in manifest
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('digikala.com/product/')) {
        // Content script should already be injected via manifest, but we can add additional logic here if needed
        chrome.tabs.sendMessage(tabId, { action: 'pageUpdated' }).catch(() => {
            // Ignore errors if content script is not ready yet
        });
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'searchPrices') {
        searchPricesAPI(request.query)
            .then(results => sendResponse({ success: true, data: results }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates we will send a response asynchronously
    } else if (request.action === 'getProductDetails') {
        getDigikalaProductDetails(request.productId)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'getProductCPC') {
        getProductCPC(request.productId)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// Function to search prices using real Digikala API
async function searchPricesAPI(query) {
    try {
        // First try autocomplete to get better search terms
        const autocompleteResponse = await fetch(`https://api.digikala.com/v1/autocomplete/?q=${encodeURIComponent(query)}`);
        const autocompleteData = await autocompleteResponse.json();
        
        // Use the first suggestion or original query
        const searchQuery = autocompleteData.data?.suggestions?.[0]?.text || query;
        
        // Search for products using general search endpoint
        const searchResponse = await fetch(`https://api.digikala.com/v1/search/?q=${encodeURIComponent(searchQuery)}&page=1`);
        const searchData = await searchResponse.json();
        
        // Extract product data and format for our needs
        const products = searchData.data?.products || [];
        
        const results = products.slice(0, 5).map(product => {
            const price = product.default_variant?.price?.selling_price || product.price?.selling_price || 0;
            const originalPrice = product.default_variant?.price?.rrp_price || product.price?.rrp_price || price;
            const seller = product.default_variant?.seller || product.seller || {};
            
            return {
                productId: product.id,
                seller: seller.title || 'دیجیکالا',
                sellerCode: seller.code || '',
                sellerRating: seller.stars || seller.rating?.total_rate || 4.0,
                sellerGrade: seller.grade?.label || seller.grade?.title || 'خوب',
                price: price,
                originalPrice: originalPrice,
                rating: product.rating?.average_rating || 4.0,
                title: product.title_fa || product.title_en || 'محصول نامشخص',
                url: `https://www.digikala.com/product/dkp-${product.id}/`,
                image: product.images?.[0]?.url?.[0] || '',
                discount: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
                isTrusted: seller.properties?.is_trusted || false,
                isOfficial: seller.properties?.is_official || false
            };
        }).sort((a, b) => a.price - b.price);
        
        return results;
        
    } catch (error) {
        console.error('Error searching prices:', error);
        // Fallback to basic search if autocomplete fails
        try {
            const searchResponse = await fetch(`https://api.digikala.com/v1/search/?q=${encodeURIComponent(query)}&page=1`);
            const searchData = await searchResponse.json();
            
            const products = searchData.data?.products || [];
            
            return products.slice(0, 5).map(product => {
                const price = product.default_variant?.price?.selling_price || product.price?.selling_price || 0;
                const seller = product.default_variant?.seller || product.seller || {};
                
                return {
                    productId: product.id,
                    seller: seller.title || 'دیجیکالا',
                    sellerCode: seller.code || '',
                    sellerRating: seller.stars || seller.rating?.total_rate || 4.0,
                    sellerGrade: seller.grade?.label || seller.grade?.title || 'خوب',
                    price: price,
                    rating: product.rating?.average_rating || 4.0,
                    title: product.title_fa || 'محصول نامشخص',
                    url: `https://www.digikala.com/product/dkp-${product.id}/`,
                    image: product.images?.[0]?.url?.[0] || '',
                    isTrusted: seller.properties?.is_trusted || false,
                    isOfficial: seller.properties?.is_official || false
                };
            }).sort((a, b) => a.price - b.price);
        } catch (fallbackError) {
            console.error('Fallback search also failed:', fallbackError);
            throw new Error('جستجو با خطا مواجه شد');
        }
    }
}

// Function to get product details from Digikala API
async function getDigikalaProductDetails(productId) {
    try {
        const response = await fetch(`https://api.digikala.com/v2/product/${productId}/`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const product = data.data?.product;
        
        if (!product) {
            throw new Error('محصول یافت نشد');
        }
        
        // Extract relevant product information
        const price = product.default_variant?.price?.selling_price || product.price?.selling_price || 0;
        const originalPrice = product.default_variant?.price?.rrp_price || product.price?.rrp_price || price;
        
        return {
            id: productId,
            title: product.title_fa || product.title_en || 'محصول نامشخص',
            price: price,
            originalPrice: originalPrice,
            discount: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
            rating: product.rating?.average_rating || 0,
            reviewCount: product.rating?.count || 0,
            brand: product.brand?.title_fa || product.brand?.title_en || '',
            category: product.category?.title_fa || product.category?.title_en || '',
            images: product.images?.list || [],
            mainImage: product.images?.main?.url?.[0] || '',
            availability: product.default_variant?.is_available || product.is_available || false,
            url: `https://www.digikala.com/product/dkp-${productId}/`,
            specifications: product.specifications || [],
            description: product.review?.description || ''
        };
        
    } catch (error) {
        console.error('Error fetching product details:', error);
        throw new Error('خطا در دریافت اطلاعات محصول');
    }
}

// Function to get same product with different sellers (variants only)
async function getProductCPC(productId) {
    try {
        // Get the main product details with all variants (different sellers)
        const productResponse = await fetch(`https://api.digikala.com/v2/product/${productId}/`);
        
        if (!productResponse.ok) {
            throw new Error(`Product API error! status: ${productResponse.status}`);
        }
        
        const productData = await productResponse.json();
        const product = productData.data?.product;
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        console.log('Product data loaded for seller comparison:', product.title_fa);
        
        // Check multiple places where seller variants might be stored
        const variants = product.variants || [];
        const variantsWithPrice = product.variants_with_price || [];
        const sellers = product.sellers || [];
        const allSellers = product.all_sellers || [];
        
        console.log('Checking different seller data sources:');
        console.log('- variants:', variants.length);
        console.log('- variants_with_price:', variantsWithPrice.length);
        console.log('- sellers:', sellers.length);
        console.log('- all_sellers:', allSellers.length);
        console.log('- default_variant:', product.default_variant ? 'exists' : 'missing');
        
        // Log available keys in product object
        console.log('Available product keys:', Object.keys(product));
        
        // Check if there's seller information in other places
        if (product.sellers_summary) {
            console.log('sellers_summary:', product.sellers_summary);
        }
        if (product.multi_seller) {
            console.log('multi_seller:', product.multi_seller);
        }
        if (product.marketplace) {
            console.log('marketplace:', product.marketplace);
        }
        
        // Try different sources for multiple sellers
        let allSellerVariants = [];
        
        // Check variants first
        if (variants.length > 1) {
            console.log('Using variants source');
            allSellerVariants = variants;
        } else if (variantsWithPrice.length > 1) {
            console.log('Using variants_with_price source');
            allSellerVariants = variantsWithPrice;
        } else if (sellers.length > 1) {
            console.log('Using sellers source');
            allSellerVariants = sellers;
        } else if (allSellers.length > 1) {
            console.log('Using all_sellers source');
            allSellerVariants = allSellers;
        }
        
        if (allSellerVariants.length > 1) {
            console.log(`Processing ${allSellerVariants.length} seller variants`);
            
            // Map the variants to our format
            const sellerResults = allSellerVariants
                .filter(variant => {
                    // Check various status fields
                    return variant.status === 'marketable' || 
                           variant.is_available === true ||
                           (!variant.status && variant.price?.selling_price > 0);
                })
                .map(variant => {
                    const price = variant.price?.selling_price || variant.selling_price || 0;
                    const originalPrice = variant.price?.rrp_price || variant.rrp_price || price;
                    const seller = variant.seller || variant || {};
                    
                    // Extract color and size information
                    const color = variant.color || variant.themes?.find(t => t.type === 'colored')?.value;
                    const size = variant.size || variant.themes?.find(t => t.type === 'text')?.value;
                    
                    console.log('Processing variant:', {
                        id: variant.id,
                        seller: seller.title || seller.name,
                        sellerCode: seller.code,
                        color: color ? (color.title || color.name || color) : null,
                        size: size ? (size.title || size.name || size) : null,
                        price: price,
                        originalPrice: originalPrice
                    });
                    
                    // Build variant description for display
                    let variantDescription = '';
                    const colorName = color ? (color.title || color.name || color) : null;
                    const sizeName = size ? (size.title || size.name || size) : null;
                    
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
                        seller: seller.title || seller.name || 'دیجیکالا',
                        sellerCode: seller.code || '',
                        sellerRating: seller.stars || seller.rating?.total_rate || seller.rating || 4.0,
                        sellerGrade: seller.grade?.label || seller.grade?.title || seller.grade || 'خوب',
                        price: price,
                        originalPrice: originalPrice,
                        rating: variant.rate || seller.rate || product.rating?.average_rating || 4.0,
                        title: product.title_fa || product.title_en || 'محصول نامشخص',
                        url: variant.url || `https://www.digikala.com/product/dkp-${product.id}/?seller-view-token=${variant.id}`,
                        image: product.images?.main?.url?.[0] || '',
                        discount: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
                        isTrusted: seller.properties?.is_trusted || seller.is_trusted || false,
                        isOfficial: seller.properties?.is_official || seller.is_official || false,
                        isIncredible: variant.price?.is_incredible || variant.is_incredible || false,
                        leadTime: variant.lead_time || 0,
                        availability: variant.is_available !== false,
                        // Add variant information
                        variantDescription: variantDescription,
                        color: colorName,
                        size: sizeName
                    };
                })
                .filter((seller, index, array) => {
                    // Remove duplicates by seller name and price
                    return seller.price > 0 && 
                           array.findIndex(s => s.seller === seller.seller && s.price === seller.price) === index;
                })
                .sort((a, b) => a.price - b.price);
                
            if (sellerResults.length > 1) {
                console.log(`Found ${sellerResults.length} different sellers for the same product`);
                console.log('Seller results:', sellerResults.map(s => ({ seller: s.seller, price: s.price })));
                return sellerResults;
            } else {
                console.log(`Only found ${sellerResults.length} valid seller(s), falling back to single seller`);
            }
        }
        
        // Fallback: Try using search API to find multiple sellers for this product
        console.log('Attempting fallback search for multiple sellers');
        try {
            const productTitle = product.title_fa || product.title_en || '';
            if (productTitle) {
                console.log(`Searching for multiple sellers using title: "${productTitle}"`);
                const searchResults = await searchPricesAPI(productTitle);
                
                // Helper function to calculate title similarity
                const calculateTitleSimilarity = (str1, str2) => {
                    const words1 = str1.split(/\s+/).filter(w => w.length > 2);
                    const words2 = str2.split(/\s+/).filter(w => w.length > 2);
                    const commonWords = words1.filter(w => words2.includes(w));
                    return commonWords.length / Math.max(words1.length, words2.length, 1);
                };
                
                // Filter search results to include similar products (lower threshold)
                const sameProductResults = searchResults.filter(result => {
                    const similarity = calculateTitleSimilarity(
                        productTitle.toLowerCase(),
                        (result.title || '').toLowerCase()
                    );
                    console.log(`Comparing "${productTitle}" vs "${result.title}" - similarity: ${similarity}`);
                    return similarity > 0.7 || result.productId === product.id;
                }).map(result => {
                    const similarity = calculateTitleSimilarity(
                        productTitle.toLowerCase(),
                        (result.title || '').toLowerCase()
                    );
                    // Only force productId/url for exact match
                    if (similarity === 1 || result.productId === product.id) {
                        return {
                            ...result,
                            productId: product.id,
                            url: result.url
                        };
                    } else {
                        // Keep original productId and url for similar products
                        return {
                            ...result
                        };
                    }
                });
                
                if (sameProductResults.length > 1) {
                    console.log(`Found ${sameProductResults.length} sellers via search API`);
                    console.log('Search-based seller results:', sameProductResults.map(s => ({ seller: s.seller, price: s.price, url: s.url })));
                    return sameProductResults.sort((a, b) => a.price - b.price);
                }
            }
        } catch (searchError) {
            console.log('Search fallback failed:', searchError);
        }
        
        // If no multiple sellers found, return the single default variant with a note
        const defaultVariant = product.default_variant;
        if (defaultVariant) {
            const price = defaultVariant.price?.selling_price || 0;
            const originalPrice = defaultVariant.price?.rrp_price || price;
            const seller = defaultVariant.seller || {};
            
            return [{
                productId: product.id,
                variantId: defaultVariant.id,
                seller: seller.title || 'دیجیکالا',
                sellerCode: seller.code || '',
                sellerRating: seller.stars || seller.rating?.total_rate || 4.0,
                sellerGrade: seller.grade?.label || seller.grade?.title || 'خوب',
                price: price,
                originalPrice: originalPrice,
                rating: defaultVariant.rate || product.rating?.average_rating || 4.0,
                title: product.title_fa || product.title_en || 'محصول نامشخص',
                url: `https://www.digikala.com/product/dkp-${product.id}/`,
                image: product.images?.main?.url?.[0] || '',
                discount: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
                isTrusted: seller.properties?.is_trusted || false,
                isOfficial: seller.properties?.is_official || false,
                isIncredible: defaultVariant.price?.is_incredible || false,
                leadTime: defaultVariant.lead_time || 0,
                note: 'این محصول تنها از یک فروشنده موجود است'
            }];
        }
        
        return [];
        
    } catch (error) {
        console.error('Error fetching product seller comparison:', error);
        return [];
    }
}

