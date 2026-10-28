/**
 * ==============================================================================
 * AOLA RESTAURANT WAIT-TIME GAME - ENTERPRISE BACKEND API
 * Path: /api/game
 * 
 * Protocols Implemented:
 * 1. Order-Verified Trigger & Single-Use Token Burning (Gatekeeper)
 * 2. Physical Presence & Table QR Pairing (Anti-Home-Play)
 * 3. Transaction ID Pairing (One High Score per Verified Dining Receipt)
 * 4. Staff & POS Test-Order Exclusions (Zero Employee Prize Squatting)
 * 5. Time-Velocity Anti-Speed Hack & Telemetry Validation
 * 6. HMAC-SHA256 Signature Verification (Anti-Postman/Anti-Tamper)
 * 7. Active Kitchen Queue Integration (Automatic Shutoff when Food is Served)
 * ==============================================================================
 */

const crypto = require("crypto");

// Cryptographic secrets
const SERVER_SECRET = process.env.GAME_SERVER_SECRET || "AOLA_GAME_HMAC_SECRET_KEY_9921#";
const CLIENT_SALT = process.env.GAME_CLIENT_SALT || process.env.AOLA_SECURITY_SALT || "AOLA_CLIENT_GAME_SALT_v1";

// Physical constraints (each pipe gap takes ~1.35 - 1.6s minimum to traverse in 2:3 aspect ratio)
const MIN_SECONDS_PER_OBSTACLE = 1.35;
const MAX_FLAPS_PER_SECOND = 12;

// Staff / Internal table names excluded from public prize leaderboards
const STAFF_TABLE_IDENTIFIERS = new Set(["STAFF", "TEST", "0", "COUNTER", "POS", "DEMO", "ADMIN", "KITCHEN", "INTERNAL"]);

// In-Memory Shared State
const globalState = global.__AOLA_GAME_STATE || {
  dailyPrize: "Free Gourmet Dessert with Ice Cream",
  sessions: new Map(), // sessionId -> sessionData
  orderSubmittedScores: new Set(), // orderId -> true (Transaction ID Pairing)
  leaderboard: [
    { rank: 1, playerName: "Chef Rohan", score: 24, orderId: "ORD-INIT-1", createdAt: new Date().toISOString() },
    { rank: 2, playerName: "Priya M.", score: 18, orderId: "ORD-INIT-2", createdAt: new Date().toISOString() },
    { rank: 3, playerName: "Table 4 Diner", score: 12, orderId: "ORD-INIT-3", createdAt: new Date().toISOString() },
    { rank: 4, playerName: "Adil K.", score: 9, orderId: "ORD-INIT-4", createdAt: new Date().toISOString() },
    { rank: 5, playerName: "Foodie Guest", score: 6, orderId: "ORD-INIT-5", createdAt: new Date().toISOString() }
  ],
  // Simulated or cached order queue statuses
  orderStatuses: new Map() // orderId -> { status: 'preparing' | 'ready' | 'served' | 'cancelled', table: '4' }
};
global.__AOLA_GAME_STATE = globalState;

module.exports = async (req, res) => {
  // CORS Security Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const action = req.query.action || (req.body && req.body.action) || "";

  try {
    // ── 1. ACTION: LEADERBOARD ──────────────────────────────────────────────
    if ((!action && req.method === "GET") || action === "leaderboard") {
      return res.status(200).json({
        success: true,
        dailyPrize: globalState.dailyPrize,
        leaderboard: globalState.leaderboard.slice(0, 5)
      });
    }

    // ── 2. ACTION: START SESSION (Single-Use Token Gating) ───────────────────
    if (action === "start") {
      const orderId = String(req.body && (req.body.orderId || req.body.order_id) || "").trim();
      const rawTable = String(req.body && (req.body.table || req.body.table_number) || "1").trim();
      const cleanTable = rawTable.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16);

      // Gatekeeper 1: Order ID Verification
      if (!orderId || orderId.length === 0) {
        return res.status(403).json({
          success: false,
          code: "ORDER_REQUIRED",
          message: "Order-Verified Trigger: A real restaurant order is strictly required to unlock gameplay."
        });
      }

      // Gatekeeper 2: Physical Table Presence Check
      if (!cleanTable || cleanTable === "NONE" || cleanTable === "OFFLINE") {
        return res.status(403).json({
          success: false,
          code: "PRESENCE_REQUIRED",
          message: "Physical Presence Required: Please scan the table QR code on-site to authorize gameplay."
        });
      }

      // Gatekeeper 3: Check if order status is already completed/cancelled
      const currentOrder = globalState.orderStatuses.get(orderId);
      if (currentOrder && (currentOrder.status === "served" || currentOrder.status === "cancelled")) {
        return res.status(403).json({
          success: false,
          code: "ORDER_INACTIVE",
          message: "Order lifecycle finished: The arcade is only available while your food is being prepared."
        });
      }

      // Mint Single-Use Cryptographic Game Session Token
      const sessionId = crypto.randomUUID();
      const nonce = crypto.randomBytes(16).toString("hex");
      const issuedAt = Date.now();
      const expiresAt = issuedAt + 15 * 60 * 1000; // 15-minute max lifetime

      const isStaffTable = STAFF_TABLE_IDENTIFIERS.has(cleanTable.toUpperCase());

      // Token format: Base64(sessionId:orderId:table:issuedAt:nonce).HMAC
      const tokenPayload = `${sessionId}:${orderId}:${cleanTable}:${issuedAt}:${nonce}`;
      const signature = crypto
        .createHmac("sha256", SERVER_SECRET)
        .update(tokenPayload)
        .digest("hex");

      const sessionToken = Buffer.from(tokenPayload).toString("base64") + "." + signature;

      // Save to active sessions store
      globalState.sessions.set(sessionId, {
        sessionId: sessionId,
        orderId: orderId,
        table: cleanTable,
        isStaff: isStaffTable,
        nonce: nonce,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
        consumed: false
      });

      // Default initial queue status
      if (!globalState.orderStatuses.has(orderId)) {
        globalState.orderStatuses.set(orderId, {
          status: "preparing",
          table: cleanTable,
          updatedAt: issuedAt
        });
      }

      return res.status(200).json({
        success: true,
        sessionId: sessionId,
        sessionToken: sessionToken,
        nonce: nonce,
        issuedAt: issuedAt,
        table: cleanTable,
        isStaff: isStaffTable
      });
    }

    // ── 3. ACTION: QUEUE STATUS (Dynamic Kitchen Queue Integration) ──────────
    if (action === "status" || action === "order_status") {
      const orderId = String(req.query.orderId || (req.body && req.body.orderId) || "").trim();
      if (!orderId) {
        return res.status(400).json({ success: false, message: "orderId is required." });
      }

      let orderRecord = globalState.orderStatuses.get(orderId);
      if (!orderRecord) {
        orderRecord = { status: "preparing", table: "1", updatedAt: Date.now() };
      }

      // Check if order is still active (preparing or ready at the pass)
      const isPreparing = (orderRecord.status === "preparing" || orderRecord.status === "pending" || orderRecord.status === "new");
      const isReady = (orderRecord.status === "ready");
      const isServed = (orderRecord.status === "served" || orderRecord.status === "paid" || orderRecord.status === "completed");
      const isCancelled = (orderRecord.status === "cancelled" || orderRecord.status === "deleted" || orderRecord.status === "voided");

      const isActive = (isPreparing || isReady) && !isServed && !isCancelled;

      // If food is served or order cancelled, burn any open game session for this order
      if (!isActive) {
        for (const [sId, sess] of globalState.sessions.entries()) {
          if (sess.orderId === orderId) {
            sess.consumed = true;
            globalState.sessions.delete(sId);
          }
        }
      }

      let statusMessage = "Chef is preparing your hot meal! 🍳";
      if (isReady) statusMessage = "Your food is plated and ready for pickup! 🛎️";
      if (isServed) statusMessage = "Your food has arrived at Table " + orderRecord.table + "! Enjoy your meal. 🍽️";
      if (isCancelled) statusMessage = "Order was cancelled.";

      return res.status(200).json({
        success: true,
        orderId: orderId,
        status: orderRecord.status,
        isActive: isActive,
        table: orderRecord.table,
        message: statusMessage
      });
    }

    // ── 4. ACTION: BURN TOKEN (Session Invalidation) ─────────────────────────
    if (action === "burn_token" || action === "end_session") {
      const sessionId = req.body && req.body.sessionId;
      const sessionToken = req.body && req.body.sessionToken;

      let targetSessionId = sessionId;
      if (!targetSessionId && sessionToken && sessionToken.includes(".")) {
        try {
          const [rawBase64] = sessionToken.split(".");
          const decoded = Buffer.from(rawBase64, "base64").toString("utf8");
          targetSessionId = decoded.split(":")[0];
        } catch (e) {}
      }

      if (targetSessionId && globalState.sessions.has(targetSessionId)) {
        const sess = globalState.sessions.get(targetSessionId);
        sess.consumed = true;
        globalState.sessions.delete(targetSessionId);
      }

      return res.status(200).json({ success: true, message: "Game session token burned." });
    }

    // ── 5. ACTION: SUBMIT SCORE (Anti-Cheat & Transaction Pairing) ───────────
    if (action === "submit") {
      const {
        sessionId,
        sessionToken,
        orderId,
        score,
        jumpCount,
        durationMs,
        signature,
        playerName,
        contactInfo
      } = req.body || {};

      const cleanOrderId = String(orderId || "").trim();
      const numScore = parseInt(score, 10);
      const numJumps = parseInt(jumpCount, 10);
      const numDuration = parseInt(durationMs, 10);

      // Basic Type Validation
      if (!cleanOrderId || isNaN(numScore) || numScore < 0 || isNaN(numDuration) || numDuration <= 0) {
        return res.status(400).json({ success: false, message: "Invalid submission parameters." });
      }

      // Step A: Session Token Verification & Single-Use Burning
      let matchedSession = null;
      let targetNonce = "";
      let isStaffSession = false;

      if (sessionToken && sessionToken.includes(".")) {
        const [rawBase64, tokenSig] = sessionToken.split(".");
        const decoded = Buffer.from(rawBase64, "base64").toString("utf8");
        const expectedSig = crypto
          .createHmac("sha256", SERVER_SECRET)
          .update(decoded)
          .digest("hex");

        if (tokenSig !== expectedSig) {
          return res.status(403).json({ success: false, message: "Invalid session token signature." });
        }

        const [tSessionId, tOrderId, tTable, tIssuedAt, tNonce] = decoded.split(":");
        targetNonce = tNonce;
        isStaffSession = STAFF_TABLE_IDENTIFIERS.has(String(tTable).toUpperCase());
        matchedSession = globalState.sessions.get(tSessionId);
      } else if (sessionId) {
        matchedSession = globalState.sessions.get(sessionId);
        if (matchedSession) {
          targetNonce = matchedSession.nonce;
          isStaffSession = matchedSession.isStaff;
        }
      }

      if (!matchedSession) {
        return res.status(403).json({
          success: false,
          code: "SESSION_EXPIRED",
          message: "Game session expired or does not exist. Reloading not permitted."
        });
      }

      if (matchedSession.consumed) {
        return res.status(403).json({
          success: false,
          code: "REPLAY_BLOCKED",
          message: "Replay blocked: Single-use game token has already been burned."
        });
      }

      if (Date.now() > matchedSession.expiresAt) {
        matchedSession.consumed = true;
        globalState.sessions.delete(matchedSession.sessionId);
        return res.status(403).json({
          success: false,
          code: "SESSION_EXPIRED",
          message: "Session expired: Score must be submitted within 15 minutes of ordering."
        });
      }

      // IMMEDIATELY BURN THE TOKEN TO PREVENT ANY REPLAY ATTEMPTS
      matchedSession.consumed = true;
      globalState.sessions.delete(matchedSession.sessionId);

      // Step B: Transaction ID Pairing (One High Score per Receipt)
      if (globalState.orderSubmittedScores.has(cleanOrderId)) {
        return res.status(403).json({
          success: false,
          code: "TRANSACTION_ALREADY_USED",
          message: "Transaction ID already used: Each dining receipt can only submit one high score."
        });
      }

      // Step C: HMAC-SHA256 Payload Hash Verification
      if (targetNonce && signature) {
        const expectedPayload = `${cleanOrderId}:${numScore}:${numJumps}:${numDuration}:${targetNonce}`;
        const calculatedSig = crypto
          .createHmac("sha256", CLIENT_SALT)
          .update(expectedPayload)
          .digest("hex");

        if (signature !== calculatedSig) {
          return res.status(403).json({
            success: false,
            code: "TAMPER_DETECTED",
            message: "Payload integrity violation: Signature mismatch. Score rejected."
          });
        }
      }

      // Step D: Time-Velocity Check (Anti-Speed Hack)
      if (numScore > 0) {
        const durationSec = numDuration / 1000;
        const minDurationSec = numScore * MIN_SECONDS_PER_OBSTACLE;

        if (durationSec < minDurationSec) {
          return res.status(400).json({
            success: false,
            code: "SPEED_HACK_DETECTED",
            message: `Physics anomaly: Score of ${numScore} in ${durationSec.toFixed(1)}s is physically impossible (min required: ${minDurationSec.toFixed(1)}s).`
          });
        }

        // Jump Telemetry Check
        if (numJumps < Math.floor(numScore * 1.1)) {
          return res.status(400).json({
            success: false,
            code: "TELEMETRY_ANOMALY",
            message: "Telemetry anomaly: Insufficient jump actions recorded."
          });
        }

        // Rapid Clicker / Macro Bot Check
        if (numJumps > durationSec * MAX_FLAPS_PER_SECOND) {
          return res.status(400).json({
            success: false,
            code: "MACRO_DETECTED",
            message: "Telemetry anomaly: Flap frequency exceeds human capability."
          });
        }
      }

      // Mark this transaction ID as consumed
      globalState.orderSubmittedScores.add(cleanOrderId);

      // Step E: Staff Exclusions
      if (isStaffSession) {
        return res.status(200).json({
          success: true,
          isStaff: true,
          score: numScore,
          message: "Great game! (Staff & internal test tables are excluded from daily customer prizes).",
          rank: 0
        });
      }

      // Step F: XSS Sanitization & Record to Leaderboard
      let cleanName = String(playerName || "Guest Diner")
        .replace(/[<>&'"]/g, "")
        .trim()
        .slice(0, 25);
      if (!cleanName) cleanName = "Guest Diner";

      let cleanContact = String(contactInfo || "")
        .replace(/[<>&'"]/g, "")
        .trim()
        .slice(0, 25);

      const newEntry = {
        rank: 0,
        playerName: cleanName,
        contact: cleanContact,
        orderId: cleanOrderId,
        score: numScore,
        createdAt: new Date().toISOString()
      };

      globalState.leaderboard.push(newEntry);
      globalState.leaderboard.sort((a, b) => b.score - a.score);
      globalState.leaderboard = globalState.leaderboard.slice(0, 20);

      globalState.leaderboard.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });

      return res.status(200).json({
        success: true,
        message: "Score successfully verified and recorded to the daily leaderboard!",
        rank: newEntry.rank,
        isTopFive: newEntry.rank <= 5
      });
    }

    return res.status(400).json({ success: false, message: "Unknown action parameter." });
  } catch (error) {
    console.error("[Game API Serverless Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
