/**
 * AOLA POS — Centralized Production Logger & Error Tracking Architecture
 * 
 * Capabilities:
 * 1. Error Tracking: Captures window.onerror & unhandledrejection in the same second with exact stack, line, and file.
 * 2. Data Sanitization: Deep recursive redaction of secrets (pin, password, token, api_key, card, cvv).
 * 3. Context Tagging: Every log tagged with shop_id, session_id, user_role, page, timestamp, user_agent.
 * 4. Moments That Matter: Explicit logging for Logins, Order Placements, Voids, Expenses, and API failures.
 * 5. Persistent Storage: Batched asynchronous telemetry to Supabase 'system_logs' table (30-day retention)
 *    and local circular buffer for instant offline debugging.
 * 6. Optional Sentry Integration: Forwarding to Sentry when SENTRY_DSN is configured.
 */

(function () {
  "use strict";

  // ── 1. SESSION & CONTEXT RESOLUTION ─────────────────────────────────────
  function getSessionId() {
    try {
      let sid = sessionStorage.getItem("AOLA_SESSION_ID");
      if (!sid) {
        sid = "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem("AOLA_SESSION_ID", sid);
      }
      return sid;
    } catch (e) {
      return "sess_volatile_" + Date.now();
    }
  }

  function getActiveShopId() {
    try {
      // 1. URL search param ?shop=...
      const urlParams = new URLSearchParams(window.location.search);
      const urlShop = urlParams.get("shop");
      if (urlShop && urlShop.trim()) return urlShop.trim().toLowerCase();

      // 2. Owner session storage
      const ownerShop = sessionStorage.getItem("AOLA_OWNER_SHOP");
      if (ownerShop && ownerShop.trim()) return ownerShop.trim().toLowerCase();

      // 3. Customer local cached shop
      const cachedShop = localStorage.getItem("AOLA_ACTIVE_SHOP");
      if (cachedShop && cachedShop.trim()) return cachedShop.trim().toLowerCase();
    } catch (e) {}
    return "system";
  }

  function getUserRole() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("admin")) return "admin";
    if (path.includes("owner") || path.includes("hq")) return "kitchen_owner";
    return "customer";
  }

  // ── 2. DATA SANITIZATION (NEVER LOG SECRETS) ───────────────────────────
  const SENSITIVE_KEY_REGEX = /^(password|pass|secret|token|auth|bearer|pin|owner_pin|admin_pin|current_pin|new_pin|api_key|apikey|card|cvv|cvc|pan|security_code|credential|access_token|refresh_token)$/i;
  const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

  function sanitizeValue(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;

    // Primitives
    if (typeof value === "string") {
      // Mask credit-card-like number sequences in strings
      return value.replace(CREDIT_CARD_REGEX, "****-****-****-****");
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    // Circular reference protection
    if (typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);

      if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, seen));
      }

      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack || ""
        };
      }

      const cleanObj = {};
      for (const key of Object.keys(value)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
          cleanObj[key] = "[REDACTED]";
        } else {
          cleanObj[key] = sanitizeValue(value[key], seen);
        }
      }
      return cleanObj;
    }

    return String(value);
  }

  // ── 3. LOCAL STORAGE CIRCULAR BUFFER ────────────────────────────────────
  const LOCAL_BUFFER_KEY = "AOLA_LOCAL_LOGS_V1";
  const MAX_LOCAL_LOGS = 100;

  function saveToLocalBuffer(logEntry) {
    try {
      const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
      let logs = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(logs)) logs = [];
      logs.push(logEntry);
      if (logs.length > MAX_LOCAL_LOGS) {
        logs = logs.slice(-MAX_LOCAL_LOGS);
      }
      localStorage.setItem(LOCAL_BUFFER_KEY, JSON.stringify(logs));
    } catch (err) {
      // Ignore quota errors
    }
  }

  // ── 4. ERROR SPIKE DETECTION (AUTOMATED ALERTING) ───────────────────────
  const errorTimestamps = [];
  const SPIKE_WINDOW_MS = 60000; // 1 minute
  const SPIKE_THRESHOLD = 6;     // 6 errors in 1 minute = alert

  function checkErrorSpike() {
    const now = Date.now();
    errorTimestamps.push(now);
    // Prune outside window
    while (errorTimestamps.length && errorTimestamps[0] < now - SPIKE_WINDOW_MS) {
      errorTimestamps.shift();
    }
    if (errorTimestamps.length >= SPIKE_THRESHOLD) {
      console.warn(`🚨 [AOLA ALERT] High error frequency detected: ${errorTimestamps.length} errors in the last 60 seconds on ${window.location.pathname}`);
      // Notify on-screen in development or kitchen dashboard if available
      if (window.showToast) {
        window.showToast("⚠️ Notice: Network or application instability detected. System telemetry logged.", "warning");
      }
    }
  }

  // ── 5. LOGGER CORE CLASS ───────────────────────────────────────────────
  class Logger {
    constructor() {
      this.sessionId = getSessionId();
      this.queue = [];
      this.isDispatching = false;
      this.flushInterval = null;
      this.initTime = new Date().toISOString();

      // Start background dispatch loop (every 3 seconds)
      this.startDispatchLoop();

      // Flush logs on page unload
      window.addEventListener("beforeunload", () => this.flushSync());
      window.addEventListener("pagehide", () => this.flushSync());
    }

    /**
     * Build standard structured log entry
     */
    buildEntry(level, action, message, meta = {}, error = null) {
      const sanitizedMeta = sanitizeValue(meta);
      let errorDetails = null;

      if (error) {
        errorDetails = {
          name: error.name || "Error",
          message: error.message || String(error),
          stack: error.stack || null,
          fileName: error.fileName || error.filename || null,
          lineNumber: error.lineNumber || error.lineno || null,
          columnNumber: error.columnNumber || error.colno || null
        };
      }

      return {
        id: "log_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7),
        created_at: new Date().toISOString(),
        shop_id: (sanitizedMeta && sanitizedMeta.shop_id) || getActiveShopId(),
        session_id: this.sessionId,
        user_role: getUserRole(),
        level: level.toUpperCase(),
        action: String(action).toUpperCase(),
        message: String(message),
        page: window.location.pathname + window.location.search,
        user_agent: navigator.userAgent || "Unknown Browser",
        meta: sanitizedMeta || {},
        error_details: errorDetails || {}
      };
    }

    /**
     * Primary log submission pipeline
     */
    log(level, action, message, meta = {}, error = null) {
      const entry = this.buildEntry(level, action, message, meta, error);

      // 1. Console Output with curated visual styles
      this.outputToConsole(entry);

      // 2. Save in local browser circular buffer
      saveToLocalBuffer(entry);

      // 3. Sentry dispatch (if configured)
      this.forwardToSentry(entry);

      // 4. Spike detection for error levels
      if (entry.level === "ERROR" || entry.level === "CRITICAL") {
        checkErrorSpike();
      }

      // 5. Enqueue for persistent Supabase storage
      this.queue.push(entry);

      // Immediate flush for critical errors
      if (entry.level === "CRITICAL" || entry.level === "ERROR") {
        this.flush();
      }
    }

    // Level aliases
    debug(action, message, meta = {}) { this.log("DEBUG", action, message, meta); }
    info(action, message, meta = {}) { this.log("INFO", action, message, meta); }
    warn(action, message, meta = {}) { this.log("WARN", action, message, meta); }
    error(action, message, meta = {}, err = null) { this.log("ERROR", action, message, meta, err); }
    critical(action, message, meta = {}, err = null) { this.log("CRITICAL", action, message, meta, err); }

    // ── MOMENTS THAT MATTER (Specific Milestones) ───────────────────────

    /**
     * Log: Owner or Admin Authentication
     */
    logLogin(success, details = {}) {
      const action = success ? "AUTH_LOGIN_SUCCESS" : "AUTH_LOGIN_FAILED";
      const level = success ? "INFO" : "WARN";
      const msg = success
        ? `Authentication successful for shop @${details.shopId || details.shop_id || 'admin'}`
        : `Authentication failed: ${details.error || 'Invalid credentials'}`;
      this.log(level, action, msg, details);
    }

    /**
     * Log: Order Placements (Customer QR or Cashier POS)
     */
    logOrderPlaced(success, details = {}) {
      const action = success ? "ORDER_PLACED_SUCCESS" : "ORDER_PLACED_FAILED";
      const level = success ? "INFO" : "ERROR";
      const msg = success
        ? `Order #${details.orderId || details.order_id} placed successfully (Total: ${details.currency || '₹'}${details.totalPrice || details.total_price || 0})`
        : `Order placement rejected: ${details.error || 'Server error'}`;
      this.log(level, action, msg, details, details.errorObject);
    }

    /**
     * Log: Order Marked as Completed
     */
    logOrderCompleted(orderId, details = {}) {
      this.log("INFO", "ORDER_COMPLETED", `Order #${orderId} marked as Completed`, { orderId, ...details });
    }

    /**
     * Log: Order Voided / Soft-Deleted (Audit Trail)
     */
    logOrderVoided(orderId, reason, details = {}) {
      this.log("WARN", "ORDER_VOIDED", `Order #${orderId} voided. Reason: "${reason}"`, { orderId, reason, ...details });
    }

    /**
     * Log: Daily Expenses
     */
    logExpense(actionType, details = {}) {
      const act = actionType === "delete" ? "EXPENSE_DELETED" : "EXPENSE_ADDED";
      const msg = actionType === "delete"
        ? `Expense #${details.expenseId} deleted`
        : `Expense of ₹${details.amount} added for ${details.category} (${details.description || 'No notes'})`;
      this.log("INFO", act, msg, details);
    }

    /**
     * Log: API Calls & Infrastructure Events
     */
    logApi(apiAction, success, details = {}) {
      const act = success ? `API_${apiAction}_SUCCESS` : `API_${apiAction}_FAILED`;
      const level = success ? "DEBUG" : "ERROR";
      const msg = success
        ? `API call '${apiAction}' completed`
        : `API call '${apiAction}' failed: ${details.error || 'Unknown error'}`;
      this.log(level, act, msg, details, details.error);
    }

    // ── CONSOLE STYLING ──────────────────────────────────────────────────
    outputToConsole(entry) {
      const colors = {
        DEBUG: "color: #64748b; font-weight: 600;",
        INFO: "color: #0284c7; font-weight: 700;",
        WARN: "color: #d97706; font-weight: 800;",
        ERROR: "color: #dc2626; font-weight: 800;",
        CRITICAL: "color: #ffffff; background: #dc2626; padding: 2px 6px; border-radius: 3px; font-weight: 800;"
      };

      const prefix = `[AOLA][${entry.level}][${entry.action}][@${entry.shop_id}]`;
      const style = colors[entry.level] || "";

      if (entry.level === "ERROR" || entry.level === "CRITICAL") {
        console.error(`%c${prefix} ${entry.message}`, style, entry.meta, entry.error_details);
      } else if (entry.level === "WARN") {
        console.warn(`%c${prefix} ${entry.message}`, style, entry.meta);
      } else {
        console.log(`%c${prefix} ${entry.message}`, style, entry.meta);
      }
    }

    // ── PERSISTENT SUPABASE TRANSPORT ───────────────────────────────────
    startDispatchLoop() {
      if (this.flushInterval) clearInterval(this.flushInterval);
      this.flushInterval = setInterval(() => {
        if (this.queue.length > 0) {
          this.flush();
        }
      }, 3000);
    }

    async flush() {
      if (this.isDispatching || this.queue.length === 0) return;
      this.isDispatching = true;

      const batch = this.queue.splice(0, 20); // Send in chunks of 20
      const sbUrl = (window.AOLA_CONFIG && window.AOLA_CONFIG.SUPABASE_URL) || "https://oalrrzifbtinuuroyvch.supabase.co";
      const sbKey = (window.AOLA_CONFIG && window.AOLA_CONFIG.SUPABASE_ANON_KEY) || "sb_publishable_Tyv6wth5cDcdvZoTZmHFTQ_MV9arf3Q";

      try {
        const payload = batch.map(b => ({
          shop_id: b.shop_id,
          session_id: b.session_id,
          user_role: b.user_role,
          level: b.level,
          action: b.action,
          message: b.message,
          page: b.page,
          user_agent: b.user_agent,
          meta: b.meta,
          error_details: b.error_details
        }));

        const response = await fetch(`${sbUrl}/rest/v1/system_logs`, {
          method: "POST",
          headers: {
            "apikey": sbKey,
            "Authorization": `Bearer ${sbKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          // If table doesn't exist yet, we don't throw to prevent loop; keep batch in memory
          if (response.status !== 404 && response.status !== 400) {
            // Re-queue items if transient failure (network drop)
            this.queue.unshift(...batch);
          }
        }
      } catch (err) {
        // Transient network failure; re-queue up to 50 items to avoid infinite memory growth
        if (this.queue.length < 50) {
          this.queue.unshift(...batch);
        }
      } finally {
        this.isDispatching = false;
      }
    }

    /**
     * Synchronous flush for page unload
     */
    flushSync() {
      if (this.queue.length === 0) return;
      const batch = this.queue.splice(0, 15);
      const sbUrl = (window.AOLA_CONFIG && window.AOLA_CONFIG.SUPABASE_URL) || "https://oalrrzifbtinuuroyvch.supabase.co";
      const sbKey = (window.AOLA_CONFIG && window.AOLA_CONFIG.SUPABASE_ANON_KEY) || "sb_publishable_Tyv6wth5cDcdvZoTZmHFTQ_MV9arf3Q";

      try {
        const payload = JSON.stringify(batch.map(b => ({
          shop_id: b.shop_id,
          session_id: b.session_id,
          user_role: b.user_role,
          level: b.level,
          action: b.action,
          message: b.message,
          page: b.page,
          user_agent: b.user_agent,
          meta: b.meta,
          error_details: b.error_details
        })));

        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon(`${sbUrl}/rest/v1/system_logs?apikey=${sbKey}`, blob);
        }
      } catch (e) {}
    }

    // ── OPTIONAL SENTRY INTEGRATION ─────────────────────────────────────
    forwardToSentry(entry) {
      try {
        if (window.Sentry && typeof window.Sentry.captureMessage === "function") {
          if (entry.level === "ERROR" || entry.level === "CRITICAL") {
            if (entry.error_details && entry.error_details.message) {
              const err = new Error(entry.error_details.message);
              err.name = entry.error_details.name;
              err.stack = entry.error_details.stack;
              window.Sentry.captureException(err, {
                tags: {
                  shop_id: entry.shop_id,
                  action: entry.action,
                  role: entry.user_role
                },
                extra: entry.meta
              });
            } else {
              window.Sentry.captureMessage(entry.message, "error");
            }
          }
        }
      } catch (e) {}
    }

    // ── UTILITY INSPECTION APIS ─────────────────────────────────────────
    getLogs() {
      try {
        const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    exportLogsJson() {
      const logs = this.getLogs();
      return JSON.stringify(logs, null, 2);
    }

    clearLogs() {
      try {
        localStorage.removeItem(LOCAL_BUFFER_KEY);
        this.queue = [];
        console.log("🧹 [AOLA] Local log buffer cleared.");
      } catch (e) {}
    }
  }

  // ── 6. INSTANTIATION & GLOBAL UNHANDLED ERROR HOOKS ─────────────────────
  const loggerInstance = new Logger();
  window.AOLA_LOGGER = loggerInstance;

  // Window error capture (exact line, column, stack)
  window.addEventListener("error", function (event) {
    loggerInstance.critical(
      "UNHANDLED_EXCEPTION",
      event.message || "Uncaught script exception",
      {
        fileName: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno
      },
      event.error || {
        name: "ScriptError",
        message: event.message,
        fileName: event.filename,
        lineNumber: event.lineno
      }
    );
  });

  // Unhandled Promise Rejections (e.g. failed async fetch, Supabase network drops)
  window.addEventListener("unhandledrejection", function (event) {
    const reason = event.reason || {};
    const message = reason.message || (typeof reason === "string" ? reason : "Unhandled Promise Rejection");

    loggerInstance.error(
      "UNHANDLED_PROMISE_REJECTION",
      message,
      { reason: typeof reason === "object" ? sanitizeValue(reason) : reason },
      reason instanceof Error ? reason : null
    );
  });

  // Log system initialization
  loggerInstance.info("SYSTEM_INIT", `AOLA Logger initialized for page: ${window.location.pathname}`, {
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`
  });
})();
