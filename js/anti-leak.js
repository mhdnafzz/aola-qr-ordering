/**
 * AOLA POS — Enterprise Production Anti-Leak Protocol
 * 
 * Automatically suppresses all console outputs (log, info, warn, error, debug, table, trace)
 * when executing in the production environment.
 * 
 * Prevents database schemas, internal endpoint structures, network payloads, 
 * and sensitive stack traces from leaking to the browser DevTools console.
 * 
 * Localhost / 127.0.0.1 and sessions with ?debug=1 maintain full console output for developer DX.
 */

(function initProductionAntiLeak() {
  if (typeof window === "undefined" || !window.console) return;

  try {
    const hostname = window.location.hostname || "";
    const isLocalDev = (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname === ""
    );

    let debugAllowed = false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      debugAllowed = (
        urlParams.get("debug") === "1" ||
        sessionStorage.getItem("AOLA_DEBUG") === "1" ||
        localStorage.getItem("AOLA_DEBUG") === "1"
      );
    } catch (e) {}

    // Enforce production console blackout
    if (!isLocalDev && !debugAllowed) {
      // Store un-hijacked internal console for telemetry senders if needed
      window.__AOLA_SECURE_CONSOLE__ = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console)
      };

      const noop = function () {};

      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.warn = noop;
      console.error = noop;
      console.table = noop;
      console.trace = noop;
      console.dir = noop;
      console.group = noop;
      console.groupCollapsed = noop;
      console.groupEnd = noop;
    }
  } catch (err) {
    // Fail closed: silence any unexpected exceptions during suppression
  }
})();
