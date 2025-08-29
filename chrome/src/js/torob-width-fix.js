// Torob width fix - ensures full width display when opened from extension
(function () {
  "use strict";

  // Check if this page was opened from our extension
  function isOpenedFromExtension() {
    // Check referrer or other indicators that suggest extension origin
    const referrer = document.referrer || "";
    const hasExtensionIndicator =
      window.location.href.includes("from-extension") ||
      sessionStorage.getItem("opened-from-extension") ||
      localStorage.getItem("torob-width-fix-applied");

    return (
      hasExtensionIndicator ||
      referrer.includes("moz-extension://") ||
      referrer.includes("chrome-extension://")
    );
  }

  // Apply full width styling to body and related elements
  function applyFullWidthStyling() {
    // Create and inject CSS for full width
    const style = document.createElement("style");
    style.id = "torob-extension-width-fix";
    style.textContent = `
      /* Force full width for Torob pages opened from extension */
      body {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
      }
      
      /* Fix container widths that might be constrained */
      .container,
      .main-container,
      .content-container,
      [class*="container"] {
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Ensure main content uses full width */
      main,
      .main,
      .main-content,
      #main {
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Fix any wrapper elements */
      .wrapper,
      .page-wrapper,
      .site-wrapper {
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Remove any fixed widths that might cause issues */
      [style*="width: 50%"],
      [style*="width:50%"] {
        width: 100% !important;
      }
    `;

    // Insert at the beginning of head to ensure high specificity
    document.head.insertBefore(style, document.head.firstChild);

    console.log(
      "Torob width fix applied: body and containers set to 100% width"
    );
  }

  // Apply the fix when DOM is ready
  function initializeWidthFix() {
    // Apply immediately if DOM is ready
    if (document.readyState !== "loading") {
      applyFullWidthStyling();
    } else {
      // Wait for DOM to be ready
      document.addEventListener("DOMContentLoaded", applyFullWidthStyling);
    }

    // Also apply after a short delay to handle dynamic content
    setTimeout(applyFullWidthStyling, 500);

    // Mark that fix has been applied
    localStorage.setItem("torob-width-fix-applied", "true");
  }

  // Always apply the fix on Torob pages for now
  // Later we can make this more selective based on referrer detection
  console.log("Torob width fix script loaded");
  initializeWidthFix();

  // Listen for messages from the extension popup
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "applyWidthFix") {
        applyFullWidthStyling();
        sendResponse({ success: true });
      }
    });
  }
})();
