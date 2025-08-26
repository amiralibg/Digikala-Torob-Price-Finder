// Content script that runs on Digikala product pages
(function() {
    'use strict';

    let priceWidget = null;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getProductInfo') {
            const productInfo = extractProductInfo();
            sendResponse({ success: true, data: productInfo });
        }
        return true;
    });

    // Extract product information from the page
    function extractProductInfo() {
        try {
            // Extract product ID from URL
            const urlMatch = window.location.href.match(/\/product\/dkp-(\d+)\//);
            const productId = urlMatch ? urlMatch[1] : null;

            // Try different selectors for product name
            const nameSelectors = [
                'h1[data-testid="pdp-product-title"]',
                'h1.product-title',
                '.product-title h1',
                '.styles_ProductTitle__content__4nE_l h1',
                '.c-product__title h1',
                'h1[class*="ProductTitle"]',
                'h1'
            ];

            let productName = '';
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
                '.c-product-price__selling',
                '.c-product-price__current',
                '.styles_Price__discounted__MhNIJ',
                '.js-price-value',
                '.price-current',
                '.product-price .price',
                '.discount-price',
                '.price'
            ];

            let price = null;
            for (const selector of priceSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const priceText = element.textContent.replace(/[^\d]/g, '');
                    if (priceText) {
                        price = parseInt(priceText);
                        break;
                    }
                }
            }

            // Get product image with updated selectors
            const imageSelectors = [
                '[data-testid="pdp-gallery-image"] img',
                '.c-gallery__item img',
                '.js-gallery-image',
                '.product-image img',
                '.gallery-image img',
                'img[alt*="تصویر"]',
                '.swiper-slide img'
            ];

            let imageUrl = '';
            for (const selector of imageSelectors) {
                const element = document.querySelector(selector);
                if (element && element.src) {
                    imageUrl = element.src;
                    break;
                }
            }

            return {
                id: productId,
                name: productName || 'محصول نامشخص',
                price: price,
                image: imageUrl,
                url: window.location.href
            };
        } catch (error) {
            console.error('Error extracting product info:', error);
            return null;
        }
    }

    // Create floating price comparison widget
    function createPriceWidget() {
        if (priceWidget) return;

        priceWidget = document.createElement('div');
        priceWidget.id = 'digikala-price-widget';
        priceWidget.innerHTML = `
            <div class="price-widget-content">
                <div class="widget-header">
                    <span>🛒 مقایسه قیمت</span>
                    <button class="close-btn">×</button>
                </div>
                <div class="widget-body">
                    <button class="compare-btn">یافتن بهترین قیمت‌ها</button>
                    <div class="widget-results"></div>
                </div>
            </div>
        `;

        document.body.appendChild(priceWidget);

        // Add event listeners
        priceWidget.querySelector('.close-btn').addEventListener('click', () => {
            priceWidget.style.display = 'none';
        });

        priceWidget.querySelector('.compare-btn').addEventListener('click', async () => {
            const productInfo = extractProductInfo();
            if (productInfo) {
                showWidgetLoading();
                try {
                    let prices = [];
                    
                    // If we have product ID, try CPC first
                    if (productInfo.id) {
                        try {
                            const cpcResponse = await new Promise((resolve) => {
                                chrome.runtime.sendMessage(
                                    { action: 'getProductCPC', productId: productInfo.id },
                                    resolve
                                );
                            });
                            
                            if (cpcResponse && cpcResponse.success && cpcResponse.data.length > 0) {
                                prices = cpcResponse.data;
                            }
                        } catch (error) {
                            console.log('CPC data not available, falling back to search');
                        }
                    }
                    
                    // Fallback to regular search if no CPC data
                    if (prices.length === 0) {
                        prices = await searchPricesForWidget(productInfo.name);
                    }
                    
                    displayWidgetResults(prices);
                } catch (error) {
                    showWidgetError();
                }
            }
        });
    }

    async function searchPricesForWidget(productName) {
        try {
            // Send message to background script to search prices
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { action: 'searchPrices', query: productName },
                    resolve
                );
            });

            if (response && response.success) {
                return response.data;
            } else {
                throw new Error(response?.error || 'خطا در جستجو');
            }
        } catch (error) {
            console.error('Error searching prices in widget:', error);
            throw error;
        }
    }

    function showWidgetLoading() {
        const results = priceWidget.querySelector('.widget-results');
        results.innerHTML = `
            <div class="widget-loading">
                <div class="widget-spinner"></div>
                در حال جستجو...
            </div>
        `;
    }

    function showWidgetError() {
        const results = priceWidget.querySelector('.widget-results');
        results.innerHTML = `
            <div class="widget-error">خطا در جستجو</div>
        `;
    }

    function displayWidgetResults(prices) {
        const results = priceWidget.querySelector('.widget-results');
        let html = '';
        
        if (prices.length === 1 && prices[0].note) {
            // Single seller case
            html += '<div class="widget-results-title" style="font-weight: bold; margin-bottom: 10px; color: #19bfd3;">اطلاعات فروشنده:</div>';
            html += `<div style="background: #fff8e1; border-radius: 6px; padding: 8px; margin-bottom: 10px; text-align: center; font-size: 10px; color: #b8860b;">
                💡 ${prices[0].note}
            </div>`;
        } else {
            html += '<div class="widget-results-title" style="font-weight: bold; margin-bottom: 10px; color: #19bfd3;">مقایسه فروشندگان:</div>';
        }
        
        prices.slice(0, 4).forEach((item, index) => {
            const rankBadge = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            const discountBadge = item.discount ? `${item.discount}%` : '';
            const trustedBadge = item.isTrusted ? '✓' : '';
            
            html += `
                <div class="widget-price-item" data-url="${item.url}" style="background: #f8f9fa; border-radius: 6px; padding: 8px; margin-bottom: 6px; border-right: 3px solid ${index === 0 ? '#e6123d' : '#19bfd3'}; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                                <strong style="font-size: 12px; color: #424750;">${item.seller}</strong>
                                ${rankBadge ? `<span style="margin-right: 4px;">${rankBadge}</span>` : ''}
                                ${trustedBadge ? `<span style="color: #00a049; font-size: 10px; margin-right: 4px;">${trustedBadge}</span>` : ''}
                            </div>
                            <div style="font-size: 10px; color: #81858b;">
                                <span>⭐ ${(item.sellerRating || item.rating).toFixed(1)}</span>
                                ${item.sellerGrade && item.sellerGrade !== 'undefined' ? `<span style="margin-right: 8px; color: #00a049;">${item.sellerGrade}</span>` : ''}
                            </div>
                            ${item.variantDescription ? `<div style="font-size: 9px; color: #19bfd3; font-weight: bold; margin-top: 4px; padding: 2px 5px; background: rgba(25,191,211,0.15); border-radius: 8px; display: inline-block;">
                                🎨 ${item.variantDescription}
                            </div>` : ''}
                            <div style="font-size: 9px; color: #81858b; margin-top: 3px;">${item.title?.substring(0, 25)}...</div>
                        </div>
                        <div style="text-align: left; margin-right: 8px;">
                            <div class="widget-price" style="font-size: 13px; font-weight: bold; color: #e6123d;">
                                ${formatPrice(item.price)}
                            </div>
                            ${item.originalPrice && item.originalPrice > item.price ? 
                                `<div style="font-size: 10px; text-decoration: line-through; color: #c0c2c5;">${formatPrice(item.originalPrice)}</div>` : ''}
                            ${discountBadge ? `<div style="font-size: 9px; color: #e6123d; font-weight: bold;">${discountBadge} تخفیف</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        results.innerHTML = html;
        
        // Add click event listeners to all widget price items
        const widgetItems = results.querySelectorAll('.widget-price-item');
        widgetItems.forEach(item => {
            item.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                if (url) {
                    window.open(url, '_blank');
                }
            });
            
            // Add hover effects
            item.addEventListener('mouseenter', function() {
                this.style.background = '#e6f7ff';
                this.style.transform = 'translateY(-1px)';
            });
            
            item.addEventListener('mouseleave', function() {
                this.style.background = '#f8f9fa';
                this.style.transform = 'translateY(0)';
            });
        });
    }

    function formatPrice(price) {
        if (!price) return 'نامشخص';
        // Convert from Rial to Toman (divide by 10)
        const tomanPrice = Math.floor(price / 10);
        return tomanPrice.toLocaleString('fa-IR') + ' تومان';
    }

    // Initialize when page is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPriceWidget);
    } else {
        createPriceWidget();
    }

    // Show widget when user scrolls to price section
    let hasShownWidget = false;
    window.addEventListener('scroll', () => {
        if (!hasShownWidget && window.scrollY > 50) {
            if (priceWidget) {
                priceWidget.style.display = 'block';
                hasShownWidget = true;
            }
        }
    });

})();