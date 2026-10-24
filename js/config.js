/**
 * AOLA - Frontend Global Configuration
 * 
 * Replace APPS_SCRIPT_URL with your deployed Google Apps Script Web App URL:
 * e.g., "https://script.google.com/macros/s/AKfycb.../exec"
 */

const AOLA_CONFIG = {
  // ── Supabase Production Database ──────────────────────────────────────
  USE_SUPABASE: true,
  SUPABASE_URL: "https://oalrrzifbtinuuroyvch.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Tyv6wth5cDcdvZoTZmHFTQ_MV9arf3Q",

  // Legacy Apps Script Web App URL (Deprecated - backend migrated to Supabase)
  APPS_SCRIPT_URL: "",

  // Polling interval (Deprecated - replaced by Supabase Realtime WebSockets)
  OWNER_POLL_INTERVAL_MS: 15000,

  // Table rate-limit lock reminder (seconds)
  RATE_LIMIT_COOLDOWN_SECONDS: 60,

  // Fallback flag (false - Supabase is fully configured)
  ENABLE_MOCK_FALLBACK: false,

  // Live Production domain for customer QR codes and shareable links
  PRODUCTION_URL: "https://aola-blue.vercel.app",

  // ── Production Logging & Error Tracking ────────────────────────────────
  LOGGING: {
    ENABLED: true,
    PERSIST_TO_SUPABASE: true, // Stores errors and milestone events to Supabase system_logs
    LOG_TABLE: "system_logs",
    SENTRY_DSN: "", // Optional Sentry DSN if user configures external Sentry project
    BUFFER_SIZE: 100 // Local circular log buffer size
  }
};

/**
 * Get public base URL for customer menus & QR codes
 * Always uses the live production domain (https://aola-blue.vercel.app)
 * so generated QR codes work on customer phones outside localhost!
 */
function getAppBaseUrl() {
  if (AOLA_CONFIG.PRODUCTION_URL && AOLA_CONFIG.PRODUCTION_URL.trim().length > 0) {
    let prod = AOLA_CONFIG.PRODUCTION_URL.trim().replace(/\/+$/, "");
    return prod + "/";
  }
  let path = window.location.pathname.replace(/\/admin(\.html)?\/?$/, "/");
  if (!path.endsWith("/")) path += "/";
  return window.location.origin + path;
}

/**
 * Resolve active backend URL (prioritizes config, cleans up stale overrides)
 */
function getActiveApiUrl() {
  if (AOLA_CONFIG.APPS_SCRIPT_URL && AOLA_CONFIG.APPS_SCRIPT_URL.trim().length > 0) {
    // If a stale URL exists in localStorage, remove it
    if (localStorage.getItem("AOLA_BACKEND_URL")) {
      localStorage.removeItem("AOLA_BACKEND_URL");
    }
    return AOLA_CONFIG.APPS_SCRIPT_URL.trim();
  }

  const localUrl = localStorage.getItem("AOLA_BACKEND_URL");
  if (localUrl && localUrl.trim().length > 0) {
    return localUrl.trim();
  }
  return "";
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
