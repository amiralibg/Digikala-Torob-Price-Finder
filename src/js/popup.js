document.addEventListener('DOMContentLoaded', async function() {
    // Modal for same product/seller
    function showSellerModal(sellerName) {
        let modal = document.getElementById('seller-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'seller-modal';
            modal.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.25); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                  <div style="background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(25,191,211,0.15); padding: 32px 24px; max-width: 340px; text-align: center; position: relative;">
                    <button id="closeSellerModal" style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; color: #888; cursor: pointer;">×</button>
                    <div style="font-size: 18px; font-weight: bold; color: #19bfd3; margin-bottom: 12px;">خرید از فروشنده دیگر</div>
                    <div style="font-size: 15px; color: #424750; margin-bottom: 18px;">شما در همین صفحه هستید.<br>برای خرید از فروشنده <span style='color:#e6123d;font-weight:bold;'>${sellerName}</span>، باید محصول را به سبد خرید اضافه کنید.</div>
                    <div style="font-size: 13px; color: #81858b;">در صورت نیاز، فروشنده را از لیست فروشندگان انتخاب کنید.</div>
                  </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#closeSellerModal').onclick = function() {
                modal.remove();
            };
        }
    }
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const currentProduct = document.getElementById('currentProduct');
    const productName = document.getElementById('productName');
    const currentPrice = document.getElementById('currentPrice');
    const findPricesBtn = document.getElementById('findPricesBtn');
    const digikalaResults = document.getElementById('digikalaResults');
    const torobResults = document.getElementById('torobResults');
    // Helper to log to background page console
    function logToBackground(...args) {
        try {
            var bkg = chrome.extension.getBackgroundPage();
            bkg.console.log('[popup.js]', ...args);
        } catch (e) {
            console.log('Could not log to background page:', e);
        }
    }

    let currentProductData = null;
    
    // Pagination state for infinite scrolling
    let searchState = {
        query: '',
        digikala: {
            page: 1,
            hasMore: true,
            loading: false,
            results: []
        },
        torob: {
            page: 1,
            hasMore: true,
            loading: false,
            results: []
        }
    };

    // Check if we're on a supported product page (Digikala or Torob)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url.includes('digikala.com/product/') || tab.url.includes('torob.com/p/')) {
        // Get current product info from content script
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProductInfo' });
            logToBackground('Product info from content script:', response);
            if (response && response.success) {
                currentProductData = response.data;
                
                // Get detailed info from API based on platform
                if (currentProductData.platform === 'digikala' && currentProductData.id) {
                    try {
                        const detailResponse = await new Promise((resolve) => {
                            chrome.runtime.sendMessage(
                                { action: 'getProductDetails', productId: currentProductData.id },
                                resolve
                            );
                        });
                        logToBackground('Digikala product details from API:', detailResponse);
                        
                        if (detailResponse && detailResponse.success) {
                            currentProductData = {
                                ...currentProductData,
                                ...detailResponse.data,
                                name: detailResponse.data.title || currentProductData.name
                            };
                        }
                    } catch (apiError) {
                        console.log('Could not get Digikala API product details:', apiError);
                        logToBackground('Digikala API product details error:', apiError);
                    }
                } else if (currentProductData.platform === 'torob' && currentProductData.productKey) {
                    try {
                        const detailResponse = await new Promise((resolve) => {
                            chrome.runtime.sendMessage(
                                { action: 'getTorobProductDetails', productKey: currentProductData.productKey },
                                resolve
                            );
                        });
                        logToBackground('Torob product details from API:', detailResponse);
                        
                        if (detailResponse && detailResponse.success) {
                            currentProductData = {
                                ...currentProductData,
                                ...detailResponse.data,
                                name: detailResponse.data.title || currentProductData.name
                            };
                        }
                    } catch (apiError) {
                        console.log('Could not get Torob API product details:', apiError);
                        logToBackground('Torob API product details error:', apiError);
                    }
                }
                
                productName.textContent = currentProductData.name || currentProductData.title;
                currentPrice.textContent = formatPrice(currentProductData.price);
                
                // Display product image if available
                const productImage = document.getElementById('productImage');
                const imagePlaceholder = document.getElementById('imagePlaceholder');
                
                if (currentProductData.image && currentProductData.image.trim()) {
                    productImage.src = currentProductData.image;
                    productImage.style.display = 'block';
                    imagePlaceholder.style.display = 'none';
                    
                    // Handle image load error
                    productImage.onerror = function() {
                        productImage.style.display = 'none';
                        imagePlaceholder.style.display = 'flex';
                    };
                } else {
                    productImage.style.display = 'none';
                    imagePlaceholder.style.display = 'flex';
                }
                
                currentProduct.style.display = 'block';
            }
        } catch (error) {
            console.log('Could not get product info:', error);
            logToBackground('Product info error:', error);
        }
    }

    // Search functionality
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Find prices for current product
    findPricesBtn.addEventListener('click', async function() {
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
                results: []
            },
            torob: {
                page: 1,
                hasMore: true,
                loading: false,
                results: []
            }
        };

        showLoading();

        try {
            const results = await searchBothPlatforms(query);
            logToBackground('Search both platforms result:', results);
            
            // Store results in search state
            if (results.digikala.success) {
                searchState.digikala.results = results.digikala.data || [];
                searchState.digikala.hasMore = (results.digikala.data || []).length >= 5;
            }
            if (results.torob.success) {
                searchState.torob.results = results.torob.data || [];
                searchState.torob.hasMore = (results.torob.data || []).length >= 10;
            }
            
            displayResults(results);
            setupInfiniteScroll();
        } catch (error) {
            showError('خطا در جستجو. لطفاً دوباره تلاش کنید.');
            console.error('Search error:', error);
            logToBackground('Search error:', error);
        }
    }

    async function searchBothPlatforms(query) {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { action: 'searchBothPlatforms', query: query },
                    resolve
                );
            });

            if (response && response.success) {
                return response.data;
            } else {
                throw new Error(response?.error || 'خطا در جستجو');
            }
        } catch (error) {
            console.error('Error searching both platforms:', error);
            throw new Error('خطا در ارتباط با سرور');
        }
    }

    function showLoading() {
        const skeletonItems = Array.from({length: 3}, (_, i) => `
            <div class="skeleton-item">
                <div class="skeleton-content">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-details">
                        <div class="skeleton-title ${i % 2 === 0 ? 'short' : ''}"></div>
                        <div class="skeleton-seller"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
            </div>
        `).join('');
        
        digikalaResults.innerHTML = skeletonItems;
        torobResults.innerHTML = skeletonItems;
        
        // Add loading state to search button
        searchBtn.disabled = true;
        searchBtn.innerHTML = 'جستجو<span class="loading-dots"></span>';
    }

    function showError(message) {
        // Reset search button state
        searchBtn.disabled = false;
        searchBtn.innerHTML = 'جستجو';
        
        const errorHtml = `<div class="error-state">${message}</div>`;
        digikalaResults.innerHTML = errorHtml;
        torobResults.innerHTML = errorHtml;
    }

    function displayResults(data) {
        // Reset search button state
        searchBtn.disabled = false;
        searchBtn.innerHTML = 'جستجو';
        
        if (!data) {
            const emptyHtml = '<div class="empty-state">نتیجه‌ای یافت نشد</div>';
            digikalaResults.innerHTML = emptyHtml;
            torobResults.innerHTML = emptyHtml;
            return;
        }

        // Display Digikala results with fade-in animation
        if (data.digikala && data.digikala.success && data.digikala.data.length > 0) {
            digikalaResults.innerHTML = renderPlatformResults(data.digikala.data, 'digikala');
            animateResults(digikalaResults);
        } else {
            digikalaResults.innerHTML = `<div class="error-state">
                ${data.digikala?.error || 'نتیجه‌ای در دیجیکالا یافت نشد'}
            </div>`;
        }

        // Display Torob results with fade-in animation
        if (data.torob && data.torob.success && data.torob.data.length > 0) {
            torobResults.innerHTML = renderPlatformResults(data.torob.data, 'torob');
            animateResults(torobResults);
        } else {
            torobResults.innerHTML = `<div class="error-state">
                ${data.torob?.error || 'نتیجه‌ای در ترب یافت نشد'}
            </div>`;
        }

        // Add click event listeners
        addClickHandlers();
    }
    
    function animateResults(container) {
        const items = container.querySelectorAll('.product-item');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    function renderPlatformResults(items, platform) {
        if (!items || items.length === 0) {
            return '<div class="empty-state">نتیجه‌ای یافت نشد</div>';
        }

        let html = '';

        items.forEach((item, index) => {
            const rankBadge = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

            html += `
                <div class="product-item" data-url="${item.url}" data-platform="${platform}">
                    <div class="product-item-content">
                        <div class="product-item-image">
                            ${item.image && item.image.trim() ? 
                                `<img src="${item.image}" alt="تصویر محصول" class="search-result-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                 <div class="search-result-image-placeholder" style="display: none;">🖼️</div>` : 
                                '<div class="search-result-image-placeholder">🖼️</div>'
                            }
                        </div>
                        <div class="product-item-details">
                            <div class="product-title">${item.title || item.name || 'محصول نامشخص'}</div>
                            <div class="product-seller">
                                <div style="font-size: 12px; color: #718096; margin-bottom: 8px;">
                                    ${item.seller}
                                    ${rankBadge ? `<span style="margin-right: 4px;">${rankBadge}</span>` : ''}
                                </div>
                                <div style="font-size: 11px; color: #a0aec0;">⭐ ${(item.sellerRating || item.rating || 4.0).toFixed(1)}</div>
                            </div>
                            <div class="product-price">
                                ${formatPrice(item.price, platform)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        return html;
    }

    function addClickHandlers() {
        const productItems = document.querySelectorAll('.product-item');
        productItems.forEach(item => {
            item.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                const platform = this.getAttribute('data-platform');
                
                if (url) {
                    // Handle platform-specific URL behavior
                    if (platform === 'digikala') {
                        // Check if it's same product, different seller for Digikala
                        const urlMatch = url.match(/\/product\/dkp-(\d+)/);
                        const clickedProductId = urlMatch ? urlMatch[1] : null;
                        const currentProductId = currentProductData && currentProductData.id ? String(currentProductData.id) : null;
                        const sellerViewTokenMatch = url.match(/seller-view-token=([^&]+)/);
                        const sellerViewToken = sellerViewTokenMatch ? sellerViewTokenMatch[1] : null;

                        if (clickedProductId && currentProductId && clickedProductId === currentProductId && sellerViewToken) {
                            const sellerName = item.querySelector('strong')?.textContent || 'فروشنده';
                            showSellerModal(sellerName);
                            return;
                        }
                    }
                    
                    // Open in new tab
                    chrome.tabs.create({ url: url });
                }
            });
        });
    }

    function formatPrice(price, platform = null) {
        if (!price) {
            if (platform === 'torob') {
                return 'ناموجود';
            }
            return 'نامشخص';
        }
        // Convert from Rial to Toman (divide by 10)
        const tomanPrice = Math.floor(price / 10);
        return tomanPrice.toLocaleString('fa-IR') + ' تومان';
    }
    
    // Setup infinite scroll for both platform result containers
    function setupInfiniteScroll() {
        // Setup scroll listener for Digikala results
        const digikalaContainer = digikalaResults;
        digikalaContainer.addEventListener('scroll', () => {
            if (shouldLoadMoreResults(digikalaContainer, 'digikala')) {
                loadMoreResults('digikala');
            }
        });
        
        // Setup scroll listener for Torob results  
        const torobContainer = torobResults;
        torobContainer.addEventListener('scroll', () => {
            if (shouldLoadMoreResults(torobContainer, 'torob')) {
                loadMoreResults('torob');
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
                chrome.runtime.sendMessage({
                    action: 'loadMoreResults',
                    query: searchState.query,
                    platform: platform,
                    page: nextPage
                }, resolve);
            });
            
            if (response && response.success && response.data && response.data.data.length > 0) {
                // Append new results to existing results
                state.results = state.results.concat(response.data.data);
                state.page = nextPage;
                
                // Determine if there are more pages based on result count
                if (platform === 'digikala') {
                    state.hasMore = response.data.data.length >= 5;
                } else {
                    state.hasMore = response.data.data.length >= 10;
                }
                
                // Update display with new results
                const container = platform === 'digikala' ? digikalaResults : torobResults;
                const newResults = renderPlatformResults(response.data.data, platform);
                
                // Remove loading indicator and append new results
                removeLoadingMore(platform);
                appendResults(container, newResults);
                
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
        const container = platform === 'digikala' ? digikalaResults : torobResults;
        const loadingHtml = `
            <div class="loading-more" id="${platform}LoadingMore">
                <div class="loading-spinner" style="width: 20px; height: 20px; margin: 16px auto;"></div>
                <div style="text-align: center; font-size: 12px; color: #718096;">در حال بارگذاری...</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', loadingHtml);
    }
    
    // Remove loading indicator
    function removeLoadingMore(platform) {
        const loadingEl = document.getElementById(`${platform}LoadingMore`);
        if (loadingEl) {
            loadingEl.remove();
        }
    }
    
    // Append new results to container
    function appendResults(container, newResultsHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newResultsHtml;
        
        // Append each new result item
        while (tempDiv.firstChild) {
            container.appendChild(tempDiv.firstChild);
        }
    }
});