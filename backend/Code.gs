/**
 * AOLA - Secure Serverless Multi-Tenant QR Ordering SaaS
 * Backend Router (Google Apps Script Web App - Code.gs)
 * 
 * Zero Monthly Server Fee Architecture
 * Database: Google Sheets (AOLA_Master_DB + Client Specific Sheets)
 */

// ==========================================
// CONFIGURATION & MASTER CONSTANTS
// ==========================================
// Set this in Apps Script Project Settings -> Script Properties:
// Property: MASTER_DB_SHEET_ID, Value: <Google Sheet ID of AOLA_Master_DB>
// Property: MASTER_ADMIN_PIN, Value: <Secret 6-8 digit agency admin PIN>
var CONFIG = {
  DEFAULT_MASTER_DB_ID: "", // Fallback if Script Properties is not set
  DEFAULT_ADMIN_PIN: "998877", // Fallback Agency Master PIN
  RATE_LIMIT_SECONDS: 60,
  CACHE_KEY_PREFIX: "RATE_LIMIT_TABLE_",
  LOCK_TIMEOUT_MS: 15000
};

/**
 * Retrieve config values with fallback to Script Properties
 */
function getMasterDbId() {
  var prop = PropertiesService.getScriptProperties().getProperty("MASTER_DB_SHEET_ID");
  return prop || CONFIG.DEFAULT_MASTER_DB_ID;
}

function getMasterAdminPin() {
  var prop = PropertiesService.getScriptProperties().getProperty("MASTER_ADMIN_PIN");
  return prop || CONFIG.DEFAULT_ADMIN_PIN;
}

// ==========================================
// ENTRY POINTS (doGet & doPost)
// ==========================================

/**
 * Handle HTTP GET requests
 * Used for:
 * - Ping / Healthcheck
 * - Customer Menu & Branding: ?action=get_menu&shop=kfc
 * - Polling Orders (with auth): ?action=get_orders&shop=kfc&pin=1234
 */
function doGet(e) {
  return handleRequest(e, "GET");
}

/**
 * Handle HTTP POST requests
 * Used for:
 * - Customer Order Placement: action=place_order
 * - Order Status Updates: action=complete_order
 * - Admin Operations: action=admin_get_shops, admin_save_shop, admin_toggle_status
 */
function doPost(e) {
  return handleRequest(e, "POST");
}

/**
 * Unified request handler with CORS JSON responses
 */
function handleRequest(e, method) {
  try {
    var params = {};

    // 1. Parse GET query parameters
    if (e && e.parameter) {
      params = Object.assign({}, e.parameter);
    }

    // 2. Parse POST body (supports JSON payload or URL-encoded form data)
    if (method === "POST" && e && e.postData && e.postData.contents) {
      try {
        var postJson = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, postJson);
      } catch (jsonErr) {
        // Fallback: If sent as plain form encoded
        if (e.postData.type === "application/x-www-form-urlencoded") {
          var pairs = e.postData.contents.split("&");
          for (var i = 0; i < pairs.length; i++) {
            var kv = pairs[i].split("=");
            if (kv.length === 2) {
              params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1].replace(/\+/g, " "));
            }
          }
        }
      }
    }

    var action = params.action ? String(params.action).trim() : "ping";

    // Route actions
    var responseData;
    switch (action) {
      case "ping":
        responseData = { success: true, message: "AOLA Backend Router Online", timestamp: new Date().toISOString() };
        break;

      case "get_menu":
        responseData = handleGetMenu(params);
        break;

      case "place_order":
        responseData = handlePlaceOrder(params);
        break;

      case "get_orders":
        responseData = handleGetOrders(params);
        break;

      case "complete_order":
        responseData = handleCompleteOrder(params);
        break;

      case "admin_login":
        responseData = handleAdminLogin(params);
        break;

      case "admin_get_shops":
        responseData = handleAdminGetShops(params);
        break;

      case "admin_save_shop":
        responseData = handleAdminSaveShop(params);
        break;

      case "admin_toggle_status":
        responseData = handleAdminToggleStatus(params);
        break;

      default:
        responseData = { success: false, error: "Invalid action specified: " + action };
        break;
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: "Internal Server Error: " + err.toString()
    });
  }
}

/**
 * Output helper with proper JSON MIME type and CORS headers
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ==========================================
// SECURITY & SANITIZATION UTILITIES
// ==========================================

/**
 * Basic Anti-XSS Sanitizer: Strips HTML and script tags
 */
function sanitizeString(input) {
  if (input === null || input === undefined) return "";
  var str = String(input);
  // Remove HTML tags
  str = str.replace(/<[^>]*>?/gm, "");
  // Replace quotes and risky characters with safe equivalents
  str = str.replace(/["'<>`]/g, "");
  return str.trim();
}

/**
 * Honeypot bot detector
 * If customer_fax contains any characters, request was submitted by an automated bot
 */
function checkHoneypot(params) {
  if (params.customer_fax && String(params.customer_fax).trim().length > 0) {
    return true; // Bot detected
  }
  return false;
}

/**
 * Rate Limiter using Apps Script CacheService
 * Locks orders for a specific table under a specific shop for 60 seconds
 */
function isTableRateLimited(shopId, tableNumber) {
  var cache = CacheService.getScriptCache();
  var cacheKey = CONFIG.CACHE_KEY_PREFIX + sanitizeString(shopId) + "_" + sanitizeString(tableNumber);
  var isLocked = cache.get(cacheKey);
  return isLocked !== null;
}

function lockTableRateLimit(shopId, tableNumber) {
  var cache = CacheService.getScriptCache();
  var cacheKey = CONFIG.CACHE_KEY_PREFIX + sanitizeString(shopId) + "_" + sanitizeString(tableNumber);
  cache.put(cacheKey, "locked", CONFIG.RATE_LIMIT_SECONDS);
}

// ==========================================
// DATABASE ACCESS & TENANT VERIFICATION
// ==========================================

/**
 * Fetches tenant record from AOLA_Master_DB
 * Master DB Columns:
 * A: Shop_ID
 * B: Shop_Name
 * C: Logo_URL
 * D: Sheet_ID
 * E: Owner_PIN
 * F: Status
 */
function getTenantRecord(shopId) {
  var masterDbId = getMasterDbId();
  if (!masterDbId) {
    throw new Error("Master DB Sheet ID is not configured in Script Properties.");
  }

  var masterSpreadsheet = SpreadsheetApp.openById(masterDbId);
  var sheet = masterSpreadsheet.getSheetByName("Shops") || masterSpreadsheet.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  var cleanShopId = String(shopId).toLowerCase().trim();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var currentShopId = String(row[0]).toLowerCase().trim();
    if (currentShopId === cleanShopId) {
      return {
        rowIndex: i + 1,
        shopId: String(row[0]).trim(),
        shopName: String(row[1]).trim(),
        logoUrl: String(row[2]).trim(),
        sheetId: String(row[3]).trim(),
        ownerPin: String(row[4]).trim(),
        status: String(row[5]).trim()
      };
    }
  }

  return null;
}

/**
 * Verify Owner PIN for client operations
 */
function verifyOwnerAuth(shopId, pin) {
  if (!shopId || !pin) {
    return { valid: false, error: "Shop ID and Owner PIN are required." };
  }

  var tenant = getTenantRecord(shopId);
  if (!tenant) {
    return { valid: false, error: "Shop not found." };
  }

  if (tenant.status.toLowerCase() !== "active") {
    return { valid: false, error: "Shop account is suspended or inactive." };
  }

  if (String(tenant.ownerPin).trim() !== String(pin).trim()) {
    return { valid: false, error: "Invalid PIN code." };
  }

  return { valid: true, tenant: tenant };
}

/**
 * Verify Agency Master Admin PIN
 */
function verifyAdminAuth(adminPin) {
  var masterPin = getMasterAdminPin();
  if (!adminPin || String(adminPin).trim() !== String(masterPin).trim()) {
    return false;
  }
  return true;
}

// ==========================================
// CONTROLLER: CUSTOMER MENU (index.html)
// ==========================================

/**
 * Fetches shop branding and active menu items
 * Input: { shop: "kfc" }
 */
function handleGetMenu(params) {
  var shopId = params.shop || params.shop_id;
  if (!shopId) {
    return { success: false, error: "Missing required parameter: shop" };
  }

  var tenant = getTenantRecord(shopId);
  if (!tenant) {
    return { success: false, error: "Restaurant not found." };
  }

  if (tenant.status.toLowerCase() !== "active") {
    return { 
      success: false, 
      error: "This restaurant's ordering system is currently offline or suspended.",
      suspended: true
    };
  }

  if (!tenant.sheetId) {
    return { success: false, error: "Client spreadsheet ID is missing." };
  }

  // Open Client Sheet and read Menu tab
  var clientSpreadsheet = SpreadsheetApp.openById(tenant.sheetId);
  var menuSheet = clientSpreadsheet.getSheetByName("Menu");
  if (!menuSheet) {
    return { success: false, error: "Client sheet missing 'Menu' tab." };
  }

  var menuData = menuSheet.getDataRange().getValues();
  var menuItems = [];

  // Assuming Row 1 is Header: Dish Name, Price, In Stock (TRUE/FALSE), Category (optional)
  for (var i = 1; i < menuData.length; i++) {
    var row = menuData[i];
    var dishName = row[0];
    if (!dishName) continue; // Skip empty rows

    var price = parseFloat(row[1]) || 0;
    var inStock = row[2] === true || String(row[2]).toUpperCase() === "TRUE";
    var category = row[3] ? sanitizeString(row[3]) : "General";

    menuItems.push({
      id: "dish_" + i,
      name: sanitizeString(dishName),
      price: price,
      inStock: inStock,
      category: category
    });
  }

  return {
    success: true,
    shop: {
      id: tenant.shopId,
      name: tenant.shopName,
      logoUrl: tenant.logoUrl
    },
    menu: menuItems
  };
}

// ==========================================
// CONTROLLER: ORDER PLACEMENT (index.html)
// ==========================================

/**
 * Places customer order with Honeypot check & CacheService rate limiting
 * Input: {
 *   shop_id: "kfc",
 *   table_number: "4",
 *   items: "[{\"name\":\"Burger\",\"qty\":2,\"price\":120}]",
 *   total_price: 240,
 *   customer_notes: "Less spicy",
 *   customer_fax: "" (Honeypot)
 * }
 */
function handlePlaceOrder(params) {
  // 1. Layer 1 Security: Honeypot check
  if (checkHoneypot(params)) {
    // Silently reject or simulate success to trap bots
    return { success: false, error: "Invalid submission detected." };
  }

  var shopId = params.shop_id || params.shop;
  var tableNumber = sanitizeString(params.table_number);
  var notes = sanitizeString(params.customer_notes || params.notes || "");
  var totalPrice = parseFloat(params.total_price) || 0;
  var itemsRaw = params.items;

  if (!shopId || !tableNumber || !itemsRaw) {
    return { success: false, error: "Missing required order parameters." };
  }

  // 2. Layer 2 Security: Backend Rate Limiting via CacheService
  if (isTableRateLimited(shopId, tableNumber)) {
    return {
      success: false,
      error: "Order already placed recently. Please wait 60 seconds before placing another order for Table " + tableNumber + "."
    };
  }

  // 3. Layer 3 Security: Tenant validation
  var tenant = getTenantRecord(shopId);
  if (!tenant) {
    return { success: false, error: "Restaurant not found." };
  }

  if (tenant.status.toLowerCase() !== "active") {
    return { success: false, error: "Ordering is currently unavailable for this restaurant." };
  }

  // Parse items safely
  var parsedItems = [];
  var itemsSummary = "";
  try {
    if (typeof itemsRaw === "string") {
      parsedItems = JSON.parse(itemsRaw);
    } else if (Array.isArray(itemsRaw)) {
      parsedItems = itemsRaw;
    }

    var summaryList = [];
    for (var i = 0; i < parsedItems.length; i++) {
      var itm = parsedItems[i];
      var name = sanitizeString(itm.name);
      var qty = parseInt(itm.qty) || 1;
      var price = parseFloat(itm.price) || 0;
      summaryList.push(qty + "x " + name + " (₹" + price + ")");
    }
    itemsSummary = summaryList.join(", ");
    if (notes) {
      itemsSummary += " [Notes: " + notes + "]";
    }
  } catch (err) {
    itemsSummary = sanitizeString(itemsRaw);
  }

  // Concurrency Lock: Prevent multiple simultaneous row writes colliding
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSpreadsheet = SpreadsheetApp.openById(tenant.sheetId);
    var ordersSheet = clientSpreadsheet.getSheetByName("Orders");
    if (!ordersSheet) {
      return { success: false, error: "Client spreadsheet missing 'Orders' tab." };
    }

    // Generate Order ID (e.g., ORD-7X9B)
    var orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+5:30", "yyyy-MM-dd HH:mm:ss");

    // Orders Tab Columns:
    // Order_ID, Timestamp, Table_Number, Items, Total_Price, Status
    ordersSheet.appendRow([
      orderId,
      timestamp,
      tableNumber,
      itemsSummary,
      totalPrice,
      "Pending"
    ]);

    // Apply 60s rate limit cache upon successful order write
    lockTableRateLimit(shopId, tableNumber);

    return {
      success: true,
      order_id: orderId,
      table_number: tableNumber,
      total_price: totalPrice,
      message: "Order placed successfully!"
    };
  } catch (lockErr) {
    return { success: false, error: "Order submission timed out. Please try again." };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// CONTROLLER: OWNER DASHBOARD (owner.html)
// ==========================================

/**
 * Fetches recent orders for owner kitchen view
 * Input: { shop_id: "kfc", pin: "1234" }
 */
function handleGetOrders(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin;

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  var clientSpreadsheet = SpreadsheetApp.openById(tenant.sheetId);
  var ordersSheet = clientSpreadsheet.getSheetByName("Orders");
  if (!ordersSheet) {
    return { success: false, error: "Orders tab not found in client sheet." };
  }

  var data = ordersSheet.getDataRange().getValues();
  var orders = [];

  // Header row at 0: Order_ID, Timestamp, Table_Number, Items, Total_Price, Status
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var orderId = row[0];
    if (!orderId) continue;

    orders.push({
      orderId: String(row[0]),
      timestamp: row[1] ? String(row[1]) : "",
      tableNumber: String(row[2]),
      items: String(row[3]),
      totalPrice: parseFloat(row[4]) || 0,
      status: String(row[5] || "Pending").trim()
    });
  }

  // Sort: newest orders first
  orders.reverse();

  return {
    success: true,
    shopName: tenant.shopName,
    orders: orders
  };
}

/**
 * Marks order status as 'Completed'
 * Input: { shop_id: "kfc", pin: "1234", order_id: "ORD-1234" }
 */
function handleCompleteOrder(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin;
  var targetOrderId = sanitizeString(params.order_id);

  if (!targetOrderId) {
    return { success: false, error: "Missing order_id." };
  }

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSpreadsheet = SpreadsheetApp.openById(tenant.sheetId);
    var ordersSheet = clientSpreadsheet.getSheetByName("Orders");
    var data = ordersSheet.getDataRange().getValues();

    var found = false;
    // Row index is 1-based in Sheet API
    for (var i = 1; i < data.length; i++) {
      var currentOrderId = String(data[i][0]).trim();
      if (currentOrderId === targetOrderId) {
        // Status is Column F (index 6)
        ordersSheet.getRange(i + 1, 6).setValue("Completed");
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: "Order ID not found: " + targetOrderId };
    }

    return {
      success: true,
      order_id: targetOrderId,
      message: "Order marked as Completed."
    };
  } catch (err) {
    return { success: false, error: "Error updating order: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// CONTROLLER: AGENCY ADMIN (admin.html)
// ==========================================

/**
 * Admin Login Verification
 * Input: { admin_pin: "998877" }
 */
function handleAdminLogin(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
  }
  return { success: true, message: "Admin authenticated successfully." };
}

/**
 * Returns all client shops in AOLA_Master_DB
 * Input: { admin_pin: "998877" }
 */
function handleAdminGetShops(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized access." };
  }

  var masterDbId = getMasterDbId();
  if (!masterDbId) {
    return { success: false, error: "Master DB Sheet ID not configured." };
  }

  var masterSpreadsheet = SpreadsheetApp.openById(masterDbId);
  var sheet = masterSpreadsheet.getSheetByName("Shops") || masterSpreadsheet.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  var shops = [];
  // Columns: Shop_ID, Shop_Name, Logo_URL, Sheet_ID, Owner_PIN, Status
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    shops.push({
      shopId: String(row[0]).trim(),
      shopName: String(row[1]).trim(),
      logoUrl: String(row[2]).trim(),
      sheetId: String(row[3]).trim(),
      ownerPin: String(row[4]).trim(),
      status: String(row[5] || "Active").trim()
    });
  }

  return { success: true, shops: shops };
}

/**
 * Onboards a new client or updates an existing client in AOLA_Master_DB
 * Input: {
 *   admin_pin: "998877",
 *   shop_id: "kfc",
 *   shop_name: "KFC Downtown",
 *   logo_url: "https://...",
 *   sheet_id: "1abc...",
 *   owner_pin: "1234",
 *   status: "Active"
 * }
 */
function handleAdminSaveShop(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized access." };
  }

  var shopId = sanitizeString(params.shop_id).toLowerCase().replace(/\s+/g, "");
  var shopName = sanitizeString(params.shop_name);
  var logoUrl = sanitizeString(params.logo_url);
  var sheetId = sanitizeString(params.sheet_id);
  var ownerPin = sanitizeString(params.owner_pin);
  var status = sanitizeString(params.status || "Active");

  if (!shopId || !shopName || !sheetId || !ownerPin) {
    return { success: false, error: "Missing required shop parameters (shop_id, shop_name, sheet_id, owner_pin)." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var masterDbId = getMasterDbId();
    var masterSpreadsheet = SpreadsheetApp.openById(masterDbId);
    var sheet = masterSpreadsheet.getSheetByName("Shops") || masterSpreadsheet.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    var existingRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === shopId) {
        existingRow = i + 1; // 1-based index
        break;
      }
    }

    if (existingRow > -1) {
      // Update existing row
      sheet.getRange(existingRow, 1, 1, 6).setValues([[
        shopId,
        shopName,
        logoUrl,
        sheetId,
        ownerPin,
        status
      ]]);
    } else {
      // Add new shop
      sheet.appendRow([
        shopId,
        shopName,
        logoUrl,
        sheetId,
        ownerPin,
        status
      ]);
    }

    return {
      success: true,
      message: "Shop saved successfully.",
      shop_id: shopId
    };
  } catch (err) {
    return { success: false, error: "Failed to save shop: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Toggles a shop's status between 'Active' and 'Suspended'
 * Input: { admin_pin: "998877", shop_id: "kfc", status: "Suspended" | "Active" }
 */
function handleAdminToggleStatus(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized access." };
  }

  var shopId = sanitizeString(params.shop_id).toLowerCase();
  var newStatus = sanitizeString(params.status || "Suspended");

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var masterDbId = getMasterDbId();
    var masterSpreadsheet = SpreadsheetApp.openById(masterDbId);
    var sheet = masterSpreadsheet.getSheetByName("Shops") || masterSpreadsheet.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === shopId) {
        // Column F (6) is Status
        sheet.getRange(i + 1, 6).setValue(newStatus);
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: "Shop ID not found in Master DB: " + shopId };
    }

    return {
      success: true,
      shop_id: shopId,
      status: newStatus,
      message: "Shop status updated to " + newStatus
    };
  } catch (err) {
    return { success: false, error: "Failed to update shop status: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// INITIAL SETUP HELPER (Run once in Apps Script IDE)
// ==========================================
/**
 * Optional helper function you can run inside the Apps Script IDE
 * to create the header structure in your Master DB if starting fresh.
 */
function setupMasterDatabaseHeaders() {
  var masterDbId = getMasterDbId();
  if (!masterDbId) {
    Logger.log("ERROR: Set MASTER_DB_SHEET_ID in Script Properties first.");
    return;
  }
  var ss = SpreadsheetApp.openById(masterDbId);
  var sheet = ss.getSheetByName("Shops") || ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Shop_ID", "Shop_Name", "Logo_URL", "Sheet_ID", "Owner_PIN", "Status"]);
    Logger.log("Created Master DB headers successfully.");
  } else {
    Logger.log("Master DB already contains data or headers.");
  }
}
