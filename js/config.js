/**
 * AOLA - Frontend Global Configuration
 * 
 * Replace APPS_SCRIPT_URL with your deployed Google Apps Script Web App URL:
 * e.g., "https://script.google.com/macros/s/AKfycb.../exec"
 */

const AOLA_CONFIG = {
  // Set your deployed Web App URL here, or leave empty to use localStorage / mock fallback
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwjswoNvRV4guVN1ChdjpoWUDCCH-1JuGhD2XQJF-GpCMYXB0sviHoJnnRJ-kxJy_8/exec",

  // Polling interval for Owner Kitchen Dashboard (in milliseconds)
  OWNER_POLL_INTERVAL_MS: 15000,

  // Table rate-limit lock reminder (seconds)
  RATE_LIMIT_COOLDOWN_SECONDS: 60,

  // Enable Mock Mode if Apps Script URL is empty or unreachable during local development
  ENABLE_MOCK_FALLBACK: true
};

/**
 * Resolve active backend URL (prioritizes localStorage override, then config, then prompt)
 */
function getActiveApiUrl() {
  const localUrl = localStorage.getItem("AOLA_BACKEND_URL");
  if (localUrl && localUrl.trim().length > 0) {
    return localUrl.trim();
  }
  return AOLA_CONFIG.APPS_SCRIPT_URL || "";
}

/**
 * Save custom backend URL to localStorage
 */
function saveActiveApiUrl(url) {
  if (url) {
    localStorage.setItem("AOLA_BACKEND_URL", url.trim());
  } else {
    localStorage.removeItem("AOLA_BACKEND_URL");
  }
}

/**
 * Helper to parse URL query parameters
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Currency formatter (Defaults to INR ₹)
 */
function formatCurrency(amount) {
  return "₹" + Number(amount || 0).toFixed(0);
}

/**
 * Anti-XSS Sanitizer for client-rendered HTML strings
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
