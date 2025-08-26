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
    const results = document.getElementById('results');
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

    // Check if we're on a Digikala product page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url.includes('digikala.com/product/')) {
        // Get current product info from content script
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProductInfo' });
            logToBackground('Product info from content script:', response);
            if (response && response.success) {
                currentProductData = response.data;
                
                // If we have product ID, get detailed info from API
                if (currentProductData.id) {
                    try {
                        const detailResponse = await new Promise((resolve) => {
                            chrome.runtime.sendMessage(
                                { action: 'getProductDetails', productId: currentProductData.id },
                                resolve
                            );
                        });
                        logToBackground('Product details from API:', detailResponse);
                        
                        if (detailResponse && detailResponse.success) {
                            // Merge API data with scraped data
                            currentProductData = {
                                ...currentProductData,
                                ...detailResponse.data,
                                name: detailResponse.data.title || currentProductData.name
                            };
                        }
                    } catch (apiError) {
                        console.log('Could not get API product details:', apiError);
                        logToBackground('API product details error:', apiError);
                    }
                }
                
                productName.textContent = currentProductData.name || currentProductData.title;
                currentPrice.textContent = formatPrice(currentProductData.price);
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
            showLoading();
            
            // If we have a product ID, try to get CPC data first
            if (currentProductData.id) {
                try {
                    const cpcResponse = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(
                            { action: 'getProductCPC', productId: currentProductData.id },
                            resolve
                        );
                    });
                    
                    if (cpcResponse && cpcResponse.success && cpcResponse.data.length > 0) {
                        displayResults(cpcResponse.data);
                        return;
                    }
                } catch (error) {
                    console.log('CPC data not available, falling back to search');
                }
            }
            
            // Fallback to regular search
            searchInput.value = currentProductData.name || currentProductData.title;
            performSearch();
        }
    });

    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        showLoading();

        try {
            const prices = await searchPrices(query);
            logToBackground('Search prices result:', prices);
            displayResults(prices);
        } catch (error) {
            showError('خطا در جستجو. لطفاً دوباره تلاش کنید.');
            console.error('Search error:', error);
            logToBackground('Search error:', error);
        }
    }

    async function searchPrices(query) {
        try {
            // Send message to background script to search prices
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { action: 'searchPrices', query: query },
                    resolve
                );
            });

            if (response && response.success) {
                return response.data;
            } else {
                throw new Error(response?.error || 'خطا در جستجو');
            }
        } catch (error) {
            console.error('Error searching prices:', error);
            throw new Error('خطا در ارتباط با سرور');
        }
    }

    function showLoading() {
        results.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                در حال جستجو...
            </div>
        `;
    }

    function showError(message) {
        results.innerHTML = `
            <div class="error">${message}</div>
        `;
    }

    function displayResults(prices) {
        if (!prices || prices.length === 0) {
            results.innerHTML = `
                <div class="no-results" style="text-align: center; padding: 20px; color: #999;">
                    محصولی یافت نشد
                </div>
            `;
            return;
        }

        let html = '';
        
        if (prices.length === 1 && prices[0].note) {
            // Single seller case
            html += '<div style="margin-bottom: 15px; font-weight: bold; text-align: center; color: #19bfd3;">اطلاعات فروشنده:</div>';
            html += `<div style="background: #fff8e1; border: 1px solid #ffcc02; border-radius: 8px; padding: 12px; margin-bottom: 15px; text-align: center; font-size: 12px; color: #b8860b;">
                💡 ${prices[0].note}
            </div>`;
        } else {
            html += '<div style="margin-bottom: 15px; font-weight: bold; text-align: center; color: #19bfd3;">مقایسه قیمت فروشندگان:</div>';
        }
        
        prices.forEach((item, index) => {
            const rankBadge = index === 0 ? '🏆 کمترین قیمت' : index === 1 ? '🥈 دومین قیمت' : index === 2 ? '🥉 سومین قیمت' : '';
            const discountBadge = item.discount ? `${item.discount}% تخفیف` : '';
            const trustedBadge = item.isTrusted ? '✓ فروشنده معتبر' : '';
            const officialBadge = item.isOfficial ? '✓ فروشنده رسمی' : '';
            const incredibleBadge = item.isIncredible ? '⚡ پیشنهاد شگفت‌انگیز' : '';
            
            html += `
                <div class="price-item" data-url="${item.url}" style="border: 1px solid #e0e6ed; border-radius: 8px; padding: 12px; margin-bottom: 8px; background: #fff; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; margin-bottom: 6px;">
                                <div class="seller-name" style="font-weight: bold; font-size: 14px; color: #424750;">${item.seller}</div>
                                ${trustedBadge ? `<span style="color: #00a049; font-size: 10px; margin-right: 5px;">${trustedBadge}</span>` : ''}
                                ${officialBadge ? `<span style="color: #0fabc6; font-size: 10px; margin-right: 5px;">${officialBadge}</span>` : ''}
                            </div>
                            
                            ${rankBadge ? `<div style="font-size: 11px; color: #ff6b35; font-weight: bold; margin-bottom: 4px;">${rankBadge}</div>` : ''}
                            ${incredibleBadge ? `<div style="font-size: 11px; color: #e6123d; font-weight: bold; margin-bottom: 4px;">${incredibleBadge}</div>` : ''}
                            
                            <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: #81858b;">
                                <span>⭐ ${(item.sellerRating || item.rating).toFixed(1)}</span>
                                ${item.sellerGrade && item.sellerGrade !== 'undefined' ? `<span style="color: #00a049;">${item.sellerGrade}</span>` : ''}
                                ${item.leadTime ? `<span>📦 ${item.leadTime} روز</span>` : ''}
                            </div>
                            
                            ${item.variantDescription ? `<div style="font-size: 11px; color: #19bfd3; font-weight: bold; margin-top: 6px; padding: 3px 8px; background: rgba(25,191,211,0.1); border-radius: 12px; display: inline-block;">
                                🎨 ${item.variantDescription}
                            </div>` : ''}
                            
                            <div style="font-size: 11px; color: #81858b; margin-top: 4px; line-height: 1.3;">
                                ${item.title?.substring(0, 45)}...
                            </div>
                        </div>
                        
                        <div style="text-align: left; margin-right: 10px;">
                            <div class="price" style="font-size: 16px; font-weight: bold; color: #e6123d;">
                                ${formatPrice(item.price)}
                            </div>
                            ${item.originalPrice && item.originalPrice > item.price ? 
                                `<div style="font-size: 12px; text-decoration: line-through; color: #c0c2c5; margin-top: 2px;">
                                    ${formatPrice(item.originalPrice)}
                                </div>` : ''}
                            ${discountBadge ? 
                                `<div style="font-size: 11px; color: #fff; background: #e6123d; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">
                                    ${discountBadge}
                                </div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        results.innerHTML = html;

        // Add click event listeners to all price items
        const priceItems = results.querySelectorAll('.price-item');
        priceItems.forEach(item => {
            item.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                if (!url) return;

                // Extract productId and seller-view-token from url
                const urlMatch = url.match(/\/product\/dkp-(\d+)/);
                const clickedProductId = urlMatch ? urlMatch[1] : null;
                const currentProductId = currentProductData && currentProductData.id ? String(currentProductData.id) : null;
                const sellerViewTokenMatch = url.match(/seller-view-token=([^&]+)/);
                const sellerViewToken = sellerViewTokenMatch ? sellerViewTokenMatch[1] : null;

                // If productId matches and seller-view-token is present, show modal (current product, different seller)
                if (clickedProductId && currentProductId && clickedProductId === currentProductId && sellerViewToken) {
                    const sellerName = item.querySelector('.seller-name')?.textContent || 'فروشنده';
                    showSellerModal(sellerName);
                } else {
                    // Different product or no seller-view-token, redirect
                    chrome.tabs.create({ url: url });
                }
            });

            // Add hover effects
            item.addEventListener('mouseenter', function() {
                this.style.boxShadow = '0 4px 12px rgba(230, 18, 61, 0.15)';
                this.style.borderColor = '#19bfd3';
            });

            item.addEventListener('mouseleave', function() {
                this.style.boxShadow = 'none';
                this.style.borderColor = '#e0e6ed';
            });
        });
    }

    function formatPrice(price) {
        if (!price) return 'نامشخص';
        // Convert from Rial to Toman (divide by 10)
        const tomanPrice = Math.floor(price / 10);
        return tomanPrice.toLocaleString('fa-IR') + ' تومان';
    }
});