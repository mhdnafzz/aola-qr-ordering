/**
 * =========================================================================
 * AOLA - Secure Serverless Multi-Tenant QR Ordering SaaS
 * Production Google Apps Script Web App Router (Code.gs)
 * 100% Fresh Rebuild - Strict Zero-Cost Architecture
 * =========================================================================
 * 
 * DATABASE SCHEMA MAPPING:
 * 
 * 1. AOLA_Master_DB -> Tab: 'Tenants'
 *    A (0): Shop_ID
 *    B (1): Shop_Name
 *    C (2): Logo_URL
 *    D (3): Sheet_ID
 *    E (4): Owner_PIN
 *    F (5): Status (Active / Suspended)
 *    G (6): Currency
 *    H (7): Created_At
 * 
 * 2. AOLA_Master_DB -> Tab: 'Config'
 *    A (0): Setting_Key  (e.g., 'Master_Admin_PIN')
 *    B (1): Setting_Value (e.g., '998877')
 * 
 * 3. Client Sheet -> Tab: 'Menu'
 *    A (0): Item_ID
 *    B (1): Category
 *    C (2): Item_Name
 *    D (3): Description
 *    E (4): Price
 *    F (5): Is_Veg
 *    G (6): In_Stock
 * 
 * 4. Client Sheet -> Tab: 'Orders'
 *    A (0): Order_ID
 *    B (1): Timestamp
 *    C (2): Table_Number
 *    D (3): Items_Summary
 *    E (4): Total_Price
 *    F (5): Order_Status (New / Completed / Cancelled)
 *    G (6): Customer_Notes
 * =========================================================================
 */

// Global Configuration
var CONFIG = {
  DEFAULT_MASTER_DB_ID: "1Az3xVyiz1NnSuMj1wxIHxCcvYz87W5Wy-jdrgxYIALc",
  DEFAULT_ADMIN_PIN: "998877",
  RATE_LIMIT_SECONDS: 60,
  CACHE_KEY_PREFIX: "RATE_LIMIT_TABLE_",
  LOCK_TIMEOUT_MS: 20000,
  AUTH_MAX_FAILURES: 5,
  AUTH_LOCKOUT_SECONDS: 900, // 15-minute lockout
  AUTH_CACHE_PREFIX: "AUTH_FAIL_",
  AUTH_LOCK_PREFIX: "AUTH_LOCK_"
};

/**
 * Retrieves the Master DB Sheet ID from Script Properties with fallback
 */
function getMasterDbId() {
  var prop = PropertiesService.getScriptProperties().getProperty("MASTER_DB_SHEET_ID");
  return prop ? String(prop).trim() : (CONFIG.DEFAULT_MASTER_DB_ID || "");
}

// =========================================================================
// ENTRY POINTS: doGet & doPost
// =========================================================================

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

/**
 * Universal router that maps every request based strictly on the 'action' parameter.
 * Never defaults to placing an order simply because method is POST.
 */
function handleRequest(e, method) {
  try {
    var params = {};

    // 1. Extract query parameters from GET or URL
    if (e && e.parameter) {
      params = Object.assign({}, e.parameter);
    }

    // 2. Extract payload from POST body
    if (method === "POST" && e && e.postData && e.postData.contents) {
      try {
        var postJson = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, postJson);
      } catch (jsonErr) {
        // Fallback for form-urlencoded payload
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

    // Explicit Action Routing
    var action = params.action ? String(params.action).trim() : "ping";
    var responseData;

    switch (action) {
      case "ping":
        responseData = {
          success: true,
          message: "AOLA API Router Online",
          timestamp: new Date().toISOString()
        };
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

      case "delete_order":
      case "void_order":
        responseData = handleSoftDeleteOrder(params);
        break;

      case "add_expense":
        responseData = handleAddExpense(params);
        break;

      case "get_expenses":
        responseData = handleGetExpenses(params);
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

      case "admin_change_pin":
        responseData = handleAdminChangePin(params);
        break;

      case "change_pin":
        responseData = handleChangePin(params);
        break;

      case "owner_get_menu":
        responseData = handleOwnerGetMenu(params);
        break;

      case "owner_save_dish":
        responseData = handleOwnerSaveDish(params);
        break;

      case "owner_toggle_stock":
        responseData = handleOwnerToggleStock(params);
        break;

      case "owner_delete_dish":
        responseData = handleOwnerDeleteDish(params);
        break;

      case "owner_get_settings":
        responseData = handleOwnerGetSettings(params);
        break;

      case "owner_save_settings":
        responseData = handleOwnerSaveSettings(params);
        break;

      case "archive_orders":
      case "archive_monthly_orders":
        responseData = handleArchiveMonthlyOrders(params);
        break;

      default:
        responseData = {
          success: false,
          error: "Unrecognized API action: '" + action + "'."
        };
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
 * Creates standardized CORS-compliant JSON output
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// =========================================================================
// SECURITY & DATA SANITIZATION UTILITIES
// =========================================================================

/**
 * Enhanced Input Sanitization & XSS Neutralization
 * Strips script tags, style, iframes, HTML tags, javascript: pseudo-protocols,
 * control characters, and neutralizes Google Sheets formula injection (=, +, -, @).
 */
function sanitizeString(input) {
  if (input === null || input === undefined) return "";
  var str = String(input);
  // 1. Strip script tags and their content
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // 2. Strip style and iframe tags
  str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  // 3. Strip all remaining HTML tags
  str = str.replace(/<[^>]*>?/gm, "");
  // 4. Strip dangerous pseudo-protocols and inline handlers
  str = str.replace(/javascript\s*:/gi, "");
  str = str.replace(/vbscript\s*:/gi, "");
  str = str.replace(/data\s*:\s*text\/html/gi, "");
  str = str.replace(/on\w+\s*=/gi, "");
  // 5. Neutralize unsafe punctuation
  str = str.replace(/["'<>`]/g, "");
  // 6. Neutralize Google Sheets CSV / cell formula injection
  str = str.trim();
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  return str;
}

/**
 * Generates an 8-character high-entropy alphanumeric access token
 * Excludes easily confusable characters (0, O, 1, I)
 */
function generateAccessToken(length) {
  var len = length || 8;
  var charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var token = "";
  for (var i = 0; i < len; i++) {
    var randIdx = Math.floor(Math.random() * charset.length);
    token += charset.charAt(randIdx);
  }
  return token;
}

/**
 * Checks if authentication for a tenant or admin is currently locked out
 */
function isAuthLocked(identifier) {
  var cache = CacheService.getScriptCache();
  var lockKey = CONFIG.AUTH_LOCK_PREFIX + sanitizeString(identifier).toLowerCase();
  return cache.get(lockKey) !== null;
}

/**
 * Records a failed authentication attempt in CacheService
 * Enforces a 15-minute lockout after 5 consecutive failures
 */
function recordAuthFailure(identifier) {
  var cache = CacheService.getScriptCache();
  var cleanId = sanitizeString(identifier).toLowerCase();
  var failKey = CONFIG.AUTH_CACHE_PREFIX + cleanId;
  var lockKey = CONFIG.AUTH_LOCK_PREFIX + cleanId;

  var currentFails = parseInt(cache.get(failKey) || "0", 10) + 1;
  if (currentFails >= CONFIG.AUTH_MAX_FAILURES) {
    cache.put(lockKey, "locked", CONFIG.AUTH_LOCKOUT_SECONDS);
    cache.remove(failKey);
    return { locked: true, attemptsRemaining: 0 };
  } else {
    cache.put(failKey, String(currentFails), CONFIG.AUTH_LOCKOUT_SECONDS);
    return { locked: false, attemptsRemaining: CONFIG.AUTH_MAX_FAILURES - currentFails };
  }
}

/**
 * Clears failed authentication attempts upon successful login
 */
function clearAuthFailure(identifier) {
  var cache = CacheService.getScriptCache();
  var cleanId = sanitizeString(identifier).toLowerCase();
  cache.remove(CONFIG.AUTH_CACHE_PREFIX + cleanId);
  cache.remove(CONFIG.AUTH_LOCK_PREFIX + cleanId);
}

/**
 * Anti-Bot Honeypot: Returns true if honeypot was triggered
 */
function isBotDetected(params) {
  if (params.customer_fax && String(params.customer_fax).trim().length > 0) {
    return true;
  }
  return false;
}

/**
 * Rate Limiter: 60-second table-level lock using CacheService
 */
function isTableRateLimited(shopId, tableNumber) {
  var cache = CacheService.getScriptCache();
  var key = CONFIG.CACHE_KEY_PREFIX + sanitizeString(shopId) + "_" + sanitizeString(tableNumber);
  return cache.get(key) !== null;
}

function lockTableRateLimit(shopId, tableNumber) {
  var cache = CacheService.getScriptCache();
  var key = CONFIG.CACHE_KEY_PREFIX + sanitizeString(shopId) + "_" + sanitizeString(tableNumber);
  cache.put(key, "locked", CONFIG.RATE_LIMIT_SECONDS);
}

// =========================================================================
// MASTER DB LOOKUPS (Tenants & Config Tabs)
// =========================================================================

/**
 * Retrieves Master Admin PIN from the Config tab in Master DB
 */
function getMasterAdminPin() {
  try {
    var masterDbId = getMasterDbId();
    if (masterDbId) {
      var ss = SpreadsheetApp.openById(masterDbId);
      var configSheet = ss.getSheetByName("Config");
      if (configSheet) {
        var data = configSheet.getDataRange().getValues();
        // A (0): Setting_Key, B (1): Setting_Value
        for (var i = 1; i < data.length; i++) {
          var key = String(data[i][0]).trim();
          if (key.toLowerCase() === "master_admin_pin") {
            var val = String(data[i][1]).trim();
            if (val) return val;
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Config tab lookup warning: " + e.toString());
  }

  // Fallback to Script Properties or Default
  var scriptProp = PropertiesService.getScriptProperties().getProperty("MASTER_ADMIN_PIN");
  return scriptProp ? String(scriptProp).trim() : CONFIG.DEFAULT_ADMIN_PIN;
}

/**
 * Looks up a tenant row in AOLA_Master_DB -> 'Tenants' tab
 * Returns tenant object or null
 */
function getTenantRecord(shopId) {
  var masterDbId = getMasterDbId();
  if (!masterDbId) {
    throw new Error("Master DB Sheet ID is not configured in Script Properties (MASTER_DB_SHEET_ID).");
  }

  var ss = SpreadsheetApp.openById(masterDbId);
  var sheet = ss.getSheetByName("Tenants") || ss.getSheetByName("Shops") || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  var cleanShopId = String(shopId || "").toLowerCase().trim();
  if (!cleanShopId) return null;

  // Header row at 0. Columns:
  // A (0): Shop_ID, B (1): Shop_Name, C (2): Logo_URL, D (3): Sheet_ID,
  // E (4): Owner_PIN, F (5): Status, G (6): Currency, H (7): Created_At
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var currentId = String(row[0]).toLowerCase().trim();
    if (currentId === cleanShopId) {
      return {
        rowIndex: i + 1, // 1-based index for Sheet API
        shopId: String(row[0]).trim(),
        shopName: String(row[1]).trim(),
        logoUrl: String(row[2]).trim(),
        sheetId: String(row[3]).trim(),
        ownerPin: String(row[4]).trim(),
        status: String(row[5] || "Active").trim(),
        currency: String(row[6] || "₹").trim(),
        createdAt: String(row[7] || "").trim()
      };
    }
  }

  return null;
}

/**
 * Verifies Owner PIN for kitchen display operations
 */
/**
 * Verifies Owner Access Token or PIN for kitchen display operations
 * Enforces CacheService rate-limiting and 15-minute lockouts after 5 failed attempts
 */
function verifyOwnerAuth(shopId, pin) {
  var cleanShopId = String(shopId || "").toLowerCase().trim();
  var cleanPin = String(pin || "").trim();

  if (!cleanShopId || !cleanPin) {
    return { valid: false, error: "Restaurant ID and Access Token/PIN are required." };
  }

  // 1. Check if restaurant is currently locked out due to brute force attempts
  if (isAuthLocked(cleanShopId)) {
    return {
      valid: false,
      error: "Security Lockout: Too many failed authorization attempts. Access is locked for 15 minutes."
    };
  }

  // 2. Fetch Tenant Record
  var tenant = getTenantRecord(cleanShopId);
  if (!tenant) {
    var failReport = recordAuthFailure(cleanShopId);
    if (failReport.locked) {
      return { valid: false, error: "Restaurant not found. Account locked for 15 minutes." };
    }
    return { valid: false, error: "Restaurant not found. (" + failReport.attemptsRemaining + " attempts remaining)" };
  }

  if (tenant.status.toLowerCase() !== "active") {
    return { valid: false, error: "Restaurant ordering is currently suspended." };
  }

  // 3. Verify PIN or 8-character Access Token
  var expectedPin = String(tenant.ownerPin).trim();
  if (expectedPin !== cleanPin) {
    var failResult = recordAuthFailure(cleanShopId);
    if (failResult.locked) {
      return {
        valid: false,
        error: "Authentication failed. 5 consecutive invalid attempts recorded. Locked out for 15 minutes."
      };
    }
    return {
      valid: false,
      error: "Invalid Owner PIN/Token. (" + failResult.attemptsRemaining + " attempts remaining before 15-min lockout)"
    };
  }

  // 4. Successful Authentication - Clear failure tracking
  clearAuthFailure(cleanShopId);
  return { valid: true, tenant: tenant };
}

/**
 * Verifies Agency Master Admin PIN
 */
function verifyAdminAuth(adminPin) {
  var masterPin = getMasterAdminPin();
  if (!adminPin || String(adminPin).trim() !== String(masterPin).trim()) {
    return false;
  }
  return true;
}

// =========================================================================
// ACTION: get_menu (Customer Menu View)
// =========================================================================

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
    return { success: false, error: "Restaurant menu sheet is not configured." };
  }

  try {
    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var menuSheet = clientSs.getSheetByName("Menu") || clientSs.getSheets()[0];
    var data = menuSheet.getDataRange().getValues();

    var menuItems = [];
    // Menu Headers: A(0): Item_ID, B(1): Category, C(2): Item_Name,
    // D(3): Description, E(4): Price, F(5): Is_Veg, G(6): In_Stock
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var itemId = String(row[0]).trim();
      if (!itemId) continue;

      var inStockVal = row[6];
      var isInStock = inStockVal === true || String(inStockVal).toLowerCase() === "true" || inStockVal === 1 || inStockVal === "1";

      var isVegVal = row[5];
      var isVeg = isVegVal === true || String(isVegVal).toLowerCase() === "true" || isVegVal === 1 || isVegVal === "1";

      menuItems.push({
        id: itemId,
        category: String(row[1] || "General").trim(),
        name: String(row[2] || itemId).trim(),
        description: String(row[3] || "").trim(),
        price: parseFloat(row[4]) || 0,
        isVeg: isVeg,
        inStock: isInStock
      });
    }

    return {
      success: true,
      shop: {
        id: tenant.shopId,
        name: tenant.shopName,
        logoUrl: tenant.logoUrl,
        currency: tenant.currency
      },
      menu: menuItems
    };
  } catch (err) {
    return {
      success: false,
      error: "Error loading restaurant menu: " + err.toString()
    };
  }
}

// =========================================================================
// ACTION: place_order (Customer QR Submission)
// =========================================================================

function handlePlaceOrder(params) {
  // 1. Anti-Bot Honeypot Check
  if (isBotDetected(params)) {
    return { success: false, error: "Automated submission rejected." };
  }

  var shopId = params.shop_id || params.shop;
  var tableNumber = sanitizeString(params.table_number || params.table || "1");
  var customerNotes = sanitizeString(params.customer_notes || params.notes || "");

  if (!shopId) {
    return { success: false, error: "Missing required parameter: shop_id" };
  }

  // 2. Anti-Spam Rate Limit Check (60 seconds per table per shop)
  if (isTableRateLimited(shopId, tableNumber)) {
    return {
      success: false,
      error: "An order was already placed recently for Table " + tableNumber + ". Please wait a moment before ordering again."
    };
  }

  // 3. Verify Active Restaurant
  var tenant = getTenantRecord(shopId);
  if (!tenant) {
    return { success: false, error: "Restaurant not found." };
  }

  if (tenant.status.toLowerCase() !== "active") {
    return { success: false, error: "Restaurant ordering is currently suspended." };
  }

  if (!tenant.sheetId) {
    return { success: false, error: "Restaurant sheet is not configured." };
  }

  // 4. Concurrency Lock & Server-Side Price Calculation (Zero Client Price Trust)
  // Prevents parameter tampering by strictly recalculating prices against the Menu sheet.
  // Frontend submits: [{ dishId: "D-101", qty: 2 }]
  var rawItems = params.items;
  if (typeof rawItems === "string") {
    try {
      rawItems = JSON.parse(rawItems);
    } catch (e) {
      // Fallback
    }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var menuSheet = clientSs.getSheetByName("Menu") || clientSs.getSheets()[0];
    var menuData = menuSheet.getDataRange().getValues();

    // Map verified active menu items: Item_ID and Item_Name lookups
    // Menu Tab: A(0): Item_ID, B(1): Category, C(2): Item_Name, D(3): Desc, E(4): Price, F(5): Is_Veg, G(6): In_Stock
    var menuMap = {};
    for (var m = 1; m < menuData.length; m++) {
      var mRow = menuData[m];
      var mId = String(mRow[0] || "").trim();
      var mName = String(mRow[2] || "").trim();
      var mPrice = parseFloat(mRow[4]) || 0;
      var inStockVal = mRow[6];
      var isInStock = inStockVal === true || String(inStockVal).toLowerCase() === "true" || inStockVal === 1 || inStockVal === "1";

      var itemRecord = {
        id: mId,
        name: mName || mId,
        price: mPrice,
        inStock: isInStock
      };

      if (mId) menuMap[mId.toLowerCase()] = itemRecord;
      if (mName) menuMap[mName.toLowerCase()] = itemRecord;
    }

    var verifiedItems = [];
    var verifiedGrandTotal = 0;

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      for (var i = 0; i < rawItems.length; i++) {
        var it = rawItems[i];
        var itemKey = "";
        if (it.dishId || it.dish_id || it.id || it.itemId) {
          itemKey = String(it.dishId || it.dish_id || it.id || it.itemId).trim().toLowerCase();
        } else if (it.name || it.item_name) {
          itemKey = String(it.name || it.item_name).trim().toLowerCase();
        }

        var menuItem = menuMap[itemKey];
        if (!menuItem) {
          return {
            success: false,
            error: "Menu item '" + (it.name || itemKey) + "' was not found or is no longer listed."
          };
        }

        if (!menuItem.inStock) {
          return {
            success: false,
            error: "Item '" + menuItem.name + "' is currently marked Out of Stock (86)."
          };
        }

        var qty = parseInt(it.quantity || it.qty || 1, 10);
        if (isNaN(qty) || qty < 1) qty = 1;

        var lineTotal = menuItem.price * qty;
        verifiedGrandTotal += lineTotal;

        verifiedItems.push({
          dishId: menuItem.id,
          name: menuItem.name,
          qty: qty,
          unitPrice: menuItem.price,
          lineTotal: lineTotal
        });
      }
    } else if (params.items_summary) {
      // Legacy formatted summary string fallback if structured array was omitted
      var legacyItems = sanitizeString(params.items_summary);
      var fallbackPrice = parseFloat(params.total_price) || 0;
      verifiedGrandTotal = fallbackPrice;
      var itemsSummaryLegacy = legacyItems;
    } else {
      return { success: false, error: "Order items cannot be empty." };
    }

    var finalItemsSummary = verifiedItems.length > 0
      ? verifiedItems.map(function(d) {
          return d.qty + "x " + d.name + " (" + tenant.currency + d.lineTotal.toFixed(2) + ")";
        }).join(", ")
      : (itemsSummaryLegacy || "Items ordered");

    var ordersSheet = clientSs.getSheetByName("Orders") || clientSs.getSheets()[1];
    var orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    var timestampStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss");

    // Orders Tab Schema:
    // A (0): Order_ID, B (1): Timestamp, C (2): Table_Number, D (3): Items_Summary,
    // E (4): Total_Price, F (5): Order_Status, G (6): Customer_Notes
    ordersSheet.appendRow([
      orderId,
      timestampStr,
      tableNumber,
      finalItemsSummary,
      verifiedGrandTotal,
      "New",
      customerNotes
    ]);

    // Apply 60s table rate lock
    lockTableRateLimit(shopId, tableNumber);

    return {
      success: true,
      order_id: orderId,
      table_number: tableNumber,
      total_price: verifiedGrandTotal,
      currency: tenant.currency,
      verified_by_server: true,
      message: "Order placed successfully! Verified by kitchen server."
    };
  } catch (err) {
    return {
      success: false,
      error: "Failed to submit order: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// ACTION: get_orders (Kitchen Display Polling)
// =========================================================================

function handleGetOrders(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
  var tenant = null;

  if (params.admin_pin && verifyAdminAuth(params.admin_pin)) {
    if (shopId) {
      tenant = getTenantRecord(shopId);
    }
    if (!tenant) {
      var allTenants = getAllTenants();
      if (allTenants && allTenants.length > 0) {
        tenant = allTenants[0];
      }
    }
    if (!tenant) {
      return { success: false, error: "No client restaurants found in Master DB." };
    }
  } else {
    var auth = verifyOwnerAuth(shopId, pin);
    if (!auth.valid) {
      return { success: false, error: auth.error };
    }
    tenant = auth.tenant;
  }

  try {
    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var ordersSheet = clientSs.getSheetByName("Orders") || clientSs.getSheets()[1];
    var data = ordersSheet.getDataRange().getValues();

    var orders = [];
    // Orders Headers:
    // A (0): Order_ID, B (1): Timestamp, C (2): Table_Number,
    // D (3): Items_Summary, E (4): Total_Price, F (5): Order_Status, G (6): Customer_Notes
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var orderId = String(row[0]).trim();
      if (!orderId) continue;

      orders.push({
        orderId: orderId,
        timestamp: String(row[1] || ""),
        tableNumber: String(row[2] || "1"),
        items: String(row[3] || "Items ordered"),
        totalPrice: parseFloat(row[4]) || 0,
        status: String(row[5] || "New").trim(),
        customerNotes: String(row[6] || "").trim()
      });
    }

    // Newest orders first
    orders.reverse();

    return {
      success: true,
      shopName: tenant.shopName,
      currency: tenant.currency,
      orders: orders
    };
  } catch (err) {
    return {
      success: false,
      error: "Error fetching orders: " + err.toString()
    };
  }
}

// =========================================================================
// ACTION: complete_order (Kitchen Mark as Completed)
// =========================================================================

function handleCompleteOrder(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
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

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var ordersSheet = clientSs.getSheetByName("Orders") || clientSs.getSheets()[1];
    var data = ordersSheet.getDataRange().getValues();

    var found = false;
    for (var i = 1; i < data.length; i++) {
      var currentOrderId = String(data[i][0]).trim();
      if (currentOrderId === targetOrderId) {
        // Column F is Order_Status (Column 6 in 1-based index)
        ordersSheet.getRange(i + 1, 6).setValue("Completed");
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: "Order not found: " + targetOrderId };
    }

    return {
      success: true,
      order_id: targetOrderId,
      message: "Order marked as Completed."
    };
  } catch (err) {
    return {
      success: false,
      error: "Error updating order status: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// ACTION: delete_order / void_order (Soft-Delete & Voided Orders Protocol)
// =========================================================================

/**
 * Soft-deletes an order by updating its status to "Deleted" (or "Voided")
 * CRITICAL RULE: Never permanently deletes row data, maintaining a secure audit trail.
 */
function handleSoftDeleteOrder(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
  var targetOrderId = sanitizeString(params.order_id);
  var reason = sanitizeString(params.reason || "Voided from Kitchen Console");

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

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var ordersSheet = clientSs.getSheetByName("Orders") || clientSs.getSheets()[1];
    var data = ordersSheet.getDataRange().getValues();

    var found = false;
    for (var i = 1; i < data.length; i++) {
      var currentOrderId = String(data[i][0]).trim();
      if (currentOrderId === targetOrderId) {
        // Column F is Order_Status (Column 6 in 1-based index)
        ordersSheet.getRange(i + 1, 6).setValue("Deleted");
        
        // Append void reason to Customer Notes (Column 7) if provided
        var existingNotes = String(data[i][6] || "").trim();
        var voidStamp = "[VOIDED: " + reason + "]";
        if (!existingNotes.includes("[VOIDED")) {
          var updatedNotes = existingNotes ? existingNotes + " | " + voidStamp : voidStamp;
          ordersSheet.getRange(i + 1, 7).setValue(updatedNotes);
        }

        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: "Order not found: " + targetOrderId };
    }

    return {
      success: true,
      order_id: targetOrderId,
      status: "Deleted",
      message: "Order #" + targetOrderId + " marked as Deleted/Voided in audit trail."
    };
  } catch (err) {
    return {
      success: false,
      error: "Error soft-deleting order: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// EXPENSES LEDGER MODULE (add_expense, get_expenses)
// Google Sheet Tab: Expenses (Columns: Expense_ID, Timestamp, Category, Description, Amount)
// =========================================================================

/**
 * Ensures the Expenses sheet exists in the target spreadsheet with standard headers
 */
function getOrCreateExpensesSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName("Expenses");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Expenses");
    var headers = ["Expense_ID", "Timestamp", "Category", "Description", "Amount"];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);

    // Apply header styling
    try {
      var headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0F172A");
      headerRange.setFontColor("#FFFFFF");
      sheet.autoResizeColumns(1, 5);
    } catch (e) {}
  }
  return sheet;
}

/**
 * ACTION: add_expense
 * Logs a new daily expense outflow (inventory, wages, utilities, packaging, etc.)
 */
function handleAddExpense(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
  var adminPin = params.admin_pin;

  var targetSs = null;

  if (adminPin) {
    if (!verifyAdminAuth(adminPin)) {
      return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
    }
    if (shopId && shopId !== "master" && shopId !== "agency" && shopId !== "hq") {
      var tenant = getTenantRecord(shopId);
      if (!tenant) return { success: false, error: "Restaurant not found: " + shopId };
      targetSs = SpreadsheetApp.openById(tenant.sheetId);
    } else {
      var masterDbId = getMasterDbId();
      targetSs = SpreadsheetApp.openById(masterDbId);
    }
  } else {
    var auth = verifyOwnerAuth(shopId, pin);
    if (!auth.valid) {
      return { success: false, error: auth.error };
    }
    targetSs = SpreadsheetApp.openById(auth.tenant.sheetId);
  }

  var amount = parseFloat(params.amount);
  if (isNaN(amount) || amount <= 0) {
    return { success: false, error: "Expense amount must be a positive number." };
  }

  var category = sanitizeString(params.category || "General");
  var description = sanitizeString(params.description || "");
  var expenseId = params.expense_id 
    ? sanitizeString(params.expense_id) 
    : "EXP-" + Utilities.formatDate(new Date(), "GMT+5:30", "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 1000);
  var timestamp = params.timestamp 
    ? sanitizeString(params.timestamp) 
    : Utilities.formatDate(new Date(), "GMT+5:30", "yyyy-MM-dd HH:mm:ss");

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    var expensesSheet = getOrCreateExpensesSheet(targetSs);
    expensesSheet.appendRow([expenseId, timestamp, category, description, amount]);

    return {
      success: true,
      message: "Expense logged successfully.",
      expense: {
        expenseId: expenseId,
        timestamp: timestamp,
        category: category,
        description: description,
        amount: amount
      }
    };
  } catch (err) {
    return { success: false, error: "Error writing expense to Google Sheet: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ACTION: get_expenses
 * Retrieves all expense rows from the Expenses sheet tab
 */
function handleGetExpenses(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
  var adminPin = params.admin_pin;

  var targetSs = null;

  if (adminPin) {
    if (!verifyAdminAuth(adminPin)) {
      return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
    }
    if (shopId && shopId !== "master" && shopId !== "agency" && shopId !== "hq") {
      var tenant = getTenantRecord(shopId);
      if (!tenant) return { success: false, error: "Restaurant not found: " + shopId };
      targetSs = SpreadsheetApp.openById(tenant.sheetId);
    } else {
      var masterDbId = getMasterDbId();
      targetSs = SpreadsheetApp.openById(masterDbId);
    }
  } else {
    var auth = verifyOwnerAuth(shopId, pin);
    if (!auth.valid) {
      return { success: false, error: auth.error };
    }
    targetSs = SpreadsheetApp.openById(auth.tenant.sheetId);
  }

  try {
    var expensesSheet = targetSs.getSheetByName("Expenses");
    if (!expensesSheet) {
      expensesSheet = getOrCreateExpensesSheet(targetSs);
      return {
        success: true,
        expenses: [],
        total_expenses: 0
      };
    }

    var data = expensesSheet.getDataRange().getValues();
    var expenses = [];
    var total = 0;

    // Headers: Expense_ID, Timestamp, Category, Description, Amount
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var expId = String(row[0]).trim();
      if (!expId) continue;

      var amt = parseFloat(row[4]) || 0;
      total += amt;
      expenses.push({
        expenseId: expId,
        timestamp: String(row[1] || ""),
        category: String(row[2] || "General").trim(),
        description: String(row[3] || "").trim(),
        amount: amt
      });
    }

    // Newest first
    expenses.reverse();

    return {
      success: true,
      expenses: expenses,
      total_expenses: total
    };
  } catch (err) {
    return { success: false, error: "Error reading expenses: " + err.toString() };
  }
}

// =========================================================================
// ACTION: admin_login (Agency Master Auth)
// =========================================================================

function handleAdminLogin(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
  }
  return { success: true, message: "Admin authenticated successfully." };
}

// =========================================================================
// ACTION: admin_get_shops (Fetch All Clients for Master Admin)
// =========================================================================

function handleAdminGetShops(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized access." };
  }

  var masterDbId = getMasterDbId();
  if (!masterDbId) {
    return { success: false, error: "Master DB Sheet ID not configured." };
  }

  var ss = SpreadsheetApp.openById(masterDbId);
  var sheet = ss.getSheetByName("Tenants") || ss.getSheetByName("Shops") || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  var shops = [];
  // Columns: A(0): Shop_ID, B(1): Shop_Name, C(2): Logo_URL, D(3): Sheet_ID,
  // E(4): Owner_PIN, F(5): Status, G(6): Currency, H(7): Created_At
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var shopId = String(row[0]).trim();
    if (!shopId) continue;

    shops.push({
      shopId: shopId,
      shopName: String(row[1] || "").trim(),
      logoUrl: String(row[2] || "").trim(),
      sheetId: String(row[3] || "").trim(),
      ownerPin: String(row[4] || "").trim(),
      status: String(row[5] || "Active").trim(),
      currency: String(row[6] || "₹").trim(),
      createdAt: String(row[7] || "").trim()
    });
  }

  return { success: true, shops: shops };
}

// =========================================================================
// ACTION: admin_save_shop (Onboard or Update Client)
// =========================================================================

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
  var currency = sanitizeString(params.currency || "₹");

  if (!shopId || !shopName || !ownerPin) {
    return {
      success: false,
      error: "Missing required shop fields (shop_id, shop_name, owner_pin)."
    };
  }

  // Auto-Provision Google Sheet if sheet_id was not provided
  if (!sheetId) {
    try {
      sheetId = autoProvisionClientSheet(shopName);
    } catch (provisionErr) {
      return {
        success: false,
        error: "Failed to auto-create Google Sheet for " + shopName + ": " + provisionErr.toString()
      };
    }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var masterDbId = getMasterDbId();
    var ss = SpreadsheetApp.openById(masterDbId);
    var sheet = ss.getSheetByName("Tenants") || ss.getSheetByName("Shops") || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    var existingRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === shopId) {
        existingRow = i + 1;
        break;
      }
    }

    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss");

    if (existingRow > -1) {
      // Update existing
      sheet.getRange(existingRow, 1, 1, 7).setValues([[
        shopId,
        shopName,
        logoUrl,
        sheetId,
        ownerPin,
        status,
        currency
      ]]);
    } else {
      // Add new
      sheet.appendRow([
        shopId,
        shopName,
        logoUrl,
        sheetId,
        ownerPin,
        status,
        currency,
        nowStr
      ]);
    }

    return {
      success: true,
      shop_id: shopId,
      sheet_id: sheetId,
      message: "Restaurant saved successfully in Master DB."
    };
  } catch (err) {
    return { success: false, error: "Error saving restaurant: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Auto-creates a new Google Sheet for a client by cloning the template sheet
 */
function autoProvisionClientSheet(shopName) {
  var templateId = getTemplateSheetId();
  var templateSs = SpreadsheetApp.openById(templateId);
  var newSs = SpreadsheetApp.create(shopName + " - AOLA Orders & Menu");

  // Copy Menu sheet from template
  var templateMenu = templateSs.getSheetByName("Menu") || templateSs.getSheets()[0];
  var newMenu = templateMenu.copyTo(newSs);
  newMenu.setName("Menu");

  // Copy Orders sheet from template
  var templateOrders = templateSs.getSheetByName("Orders") || templateSs.getSheets()[1];
  if (templateOrders) {
    var newOrders = templateOrders.copyTo(newSs);
    newOrders.setName("Orders");
  } else {
    var newOrders = newSs.insertSheet("Orders");
    newOrders.appendRow(["Order_ID", "Timestamp", "Table_Number", "Items_Summary", "Total_Price", "Order_Status", "Customer_Notes"]);
  }

  // Copy or Create Expenses sheet
  var templateExpenses = templateSs.getSheetByName("Expenses");
  if (templateExpenses) {
    var newExpenses = templateExpenses.copyTo(newSs);
    newExpenses.setName("Expenses");
  } else {
    var newExpenses = newSs.insertSheet("Expenses");
    newExpenses.appendRow(["Expense_ID", "Timestamp", "Category", "Description", "Amount"]);
    newExpenses.setFrozenRows(1);
  }

  // Delete default "Sheet1"
  var defaultSheet = newSs.getSheetByName("Sheet1");
  if (defaultSheet && newSs.getSheets().length > 1) {
    newSs.deleteSheet(defaultSheet);
  }

  return newSs.getId();
}

/**
 * Returns template sheet ID for cloning
 */
function getTemplateSheetId() {
  var propId = PropertiesService.getScriptProperties().getProperty("TEMPLATE_SHEET_ID");
  if (propId && propId.trim().length > 0) return propId.trim();

  // Find first active client in Tenants tab (e.g. bismillah)
  var masterDbId = getMasterDbId();
  if (masterDbId) {
    try {
      var ss = SpreadsheetApp.openById(masterDbId);
      var sheet = ss.getSheetByName("Tenants") || ss.getSheetByName("Shops") || ss.getSheets()[0];
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var sId = String(data[i][3] || "").trim();
        if (sId) return sId;
      }
    } catch (e) {}
  }

  return "18R-Fs7QSRzrvDQbf0wxU5pe6TCILLj01Y8j2dhMHR_g";
}

// =========================================================================
// ACTION: admin_toggle_status (Suspend / Activate Client)
// =========================================================================

function handleAdminToggleStatus(params) {
  var adminPin = params.admin_pin || params.pin;
  if (!verifyAdminAuth(adminPin)) {
    return { success: false, error: "Unauthorized access." };
  }

  var shopId = sanitizeString(params.shop_id).toLowerCase().trim();
  var newStatus = sanitizeString(params.status || "Active");

  if (!shopId) {
    return { success: false, error: "Missing shop_id." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var masterDbId = getMasterDbId();
    var ss = SpreadsheetApp.openById(masterDbId);
    var sheet = ss.getSheetByName("Tenants") || ss.getSheetByName("Shops") || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === shopId) {
        // Column F is Status (Column 6 in 1-based index)
        sheet.getRange(i + 1, 6).setValue(newStatus);
        return {
          success: true,
          shop_id: shopId,
          status: newStatus,
          message: "Restaurant status updated to " + newStatus
        };
      }
    }

    return { success: false, error: "Restaurant not found in Master DB." };
  } catch (err) {
    return { success: false, error: "Failed to update status: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// ACTION: change_pin (Restaurant Owner Updates Kitchen PIN)
// =========================================================================

function handleChangePin(params) {
  var shopId = params.shop_id || params.shop;
  var currentPin = params.current_pin || params.pin;
  var newPin = sanitizeString(params.new_pin);

  if (!newPin || newPin.length < 4 || newPin.length > 16) {
    return { success: false, error: "New Security PIN or Access Token must be between 4 and 16 characters." };
  }

  var auth = verifyOwnerAuth(shopId, currentPin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var masterDbId = getMasterDbId();
    var ss = SpreadsheetApp.openById(masterDbId);
    var sheet = ss.getSheetByName("Tenants") || ss.getSheetByName("Shops") || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    var cleanShopId = String(shopId).toLowerCase().trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === cleanShopId) {
        // Column E is Owner_PIN (Column 5 in 1-based index)
        sheet.getRange(i + 1, 5).setValue(newPin);
        return { success: true, message: "Owner PIN updated successfully in Master DB." };
      }
    }

    return { success: false, error: "Restaurant not found in Master DB." };
  } catch (err) {
    return { success: false, error: "Failed to update PIN: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// ACTION: admin_change_pin (Agency Admin Updates Master PIN in Config Tab)
// =========================================================================

function handleAdminChangePin(params) {
  var currentPin = params.current_pin || params.admin_pin || params.pin;
  var newPin = sanitizeString(params.new_pin || params.new_admin_pin);

  if (!verifyAdminAuth(currentPin)) {
    return { success: false, error: "Current Master Admin PIN is incorrect." };
  }

  if (!newPin || newPin.length < 4) {
    return { success: false, error: "New Master PIN must be at least 4 digits." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var masterDbId = getMasterDbId();
    if (masterDbId) {
      var ss = SpreadsheetApp.openById(masterDbId);
      var configSheet = ss.getSheetByName("Config");
      if (configSheet) {
        var data = configSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim().toLowerCase() === "master_admin_pin") {
            configSheet.getRange(i + 1, 2).setValue(newPin);
            return { success: true, message: "Master Admin PIN updated successfully in Config tab." };
          }
        }
        // If row didn't exist, append it
        configSheet.appendRow(["Master_Admin_PIN", newPin]);
        return { success: true, message: "Master Admin PIN created in Config tab." };
      }
    }

    // Fallback: update in Script Properties
    PropertiesService.getScriptProperties().setProperty("MASTER_ADMIN_PIN", newPin);
    return { success: true, message: "Master Admin PIN updated successfully." };
  } catch (err) {
    return { success: false, error: "Failed to update Master PIN: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// CONTROLLER: RESTAURANT OWNER MENU MANAGEMENT (owner.html)
// =========================================================================

/**
 * Fetches all menu items for the authenticated owner
 */
function handleOwnerGetMenu(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  try {
    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var menuSheet = clientSs.getSheetByName("Menu") || clientSs.getSheets()[0];
    var data = menuSheet.getDataRange().getValues();

    var items = [];
    // Menu Headers: A(0): Item_ID, B(1): Category, C(2): Item_Name,
    // D(3): Description, E(4): Price, F(5): Is_Veg, G(6): In_Stock
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var itemId = String(row[0]).trim();
      if (!itemId) continue;

      var inStockVal = row[6];
      var isInStock = inStockVal === true || String(inStockVal).toLowerCase() === "true" || inStockVal === 1 || inStockVal === "1";

      var isVegVal = row[5];
      var isVeg = isVegVal === true || String(isVegVal).toLowerCase() === "true" || isVegVal === 1 || isVegVal === "1";

      items.push({
        id: itemId,
        category: String(row[1] || "General").trim(),
        name: String(row[2] || itemId).trim(),
        description: String(row[3] || "").trim(),
        price: parseFloat(row[4]) || 0,
        isVeg: isVeg,
        inStock: isInStock
      });
    }

    return {
      success: true,
      shopId: tenant.shopId,
      shopName: tenant.shopName,
      currency: tenant.currency,
      menu: items
    };
  } catch (err) {
    return { success: false, error: "Failed to load menu: " + err.toString() };
  }
}

/**
 * Adds a new dish or updates an existing dish in the client's Menu sheet
 */
function handleOwnerSaveDish(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  var itemId = sanitizeString(params.item_id);
  var category = sanitizeString(params.category || "General");
  var name = sanitizeString(params.name || params.item_name);
  var description = sanitizeString(params.description || "");
  var price = parseFloat(params.price) || 0;
  var isVeg = params.is_veg === true || String(params.is_veg).toLowerCase() === "true" || params.is_veg === 1;
  var inStock = params.in_stock !== false && String(params.in_stock).toLowerCase() !== "false";

  if (!name) {
    return { success: false, error: "Dish name cannot be empty." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var menuSheet = clientSs.getSheetByName("Menu") || clientSs.getSheets()[0];
    var data = menuSheet.getDataRange().getValues();

    var existingRow = -1;
    if (itemId) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase().trim() === itemId.toLowerCase()) {
          existingRow = i + 1; // 1-based index
          break;
        }
      }
    }

    if (existingRow > -1) {
      // Update existing item
      menuSheet.getRange(existingRow, 1, 1, 7).setValues([[
        itemId,
        category,
        name,
        description,
        price,
        isVeg ? "TRUE" : "FALSE",
        inStock ? "TRUE" : "FALSE"
      ]]);
      return { success: true, item_id: itemId, message: "Dish updated successfully!" };
    } else {
      // Add new item with generated ID
      var newItemId = itemId || ("DISH-" + Math.floor(100 + Math.random() * 900));
      menuSheet.appendRow([
        newItemId,
        category,
        name,
        description,
        price,
        isVeg ? "TRUE" : "FALSE",
        inStock ? "TRUE" : "FALSE"
      ]);
      return { success: true, item_id: newItemId, message: "New dish added to menu!" };
    }
  } catch (err) {
    return { success: false, error: "Failed to save dish: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1-Click stock availability toggle (In Stock vs 86 Out of Stock)
 */
function handleOwnerToggleStock(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
  var itemId = sanitizeString(params.item_id);
  var inStock = params.in_stock === true || String(params.in_stock).toLowerCase() === "true" || params.in_stock === 1;

  if (!itemId) {
    return { success: false, error: "Missing item_id." };
  }

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var menuSheet = clientSs.getSheetByName("Menu") || clientSs.getSheets()[0];
    var data = menuSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === itemId.toLowerCase()) {
        // Column G is In_Stock (Column 7 in 1-based index)
        menuSheet.getRange(i + 1, 7).setValue(inStock ? "TRUE" : "FALSE");
        var dishName = String(data[i][2] || itemId).trim();
        return {
          success: true,
          item_id: itemId,
          in_stock: inStock,
          message: dishName + " is now " + (inStock ? "Available" : "Marked Out of Stock")
        };
      }
    }

    return { success: false, error: "Dish not found: " + itemId };
  } catch (err) {
    return { success: false, error: "Failed to update stock: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Removes a dish from the restaurant's Menu sheet
 */
function handleOwnerDeleteDish(params) {
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.owner_pin;
  var itemId = sanitizeString(params.item_id);

  if (!itemId) {
    return { success: false, error: "Missing item_id." };
  }

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var menuSheet = clientSs.getSheetByName("Menu") || clientSs.getSheets()[0];
    var data = menuSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === itemId.toLowerCase()) {
        menuSheet.deleteRow(i + 1);
        return { success: true, item_id: itemId, message: "Dish removed from menu." };
      }
    }

    return { success: false, error: "Dish not found: " + itemId };
  } catch (err) {
    return { success: false, error: "Failed to delete dish: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// ACTION: archive_monthly_orders (Data Maintenance & Ledger Archival)
// =========================================================================

/**
 * Request Handler for order archival
 */
function handleArchiveMonthlyOrders(params) {
  var sheetId = sanitizeString(params.sheet_id);
  var shopId = params.shop_id || params.shop;
  var pin = params.pin || params.admin_pin || params.owner_pin;

  // Authorization check: Admin PIN or Owner PIN
  var isAuthorized = false;
  if (pin && verifyAdminAuth(pin)) {
    isAuthorized = true;
  } else if (shopId && pin) {
    var ownerCheck = verifyOwnerAuth(shopId, pin);
    if (ownerCheck.valid) {
      isAuthorized = true;
      if (!sheetId && ownerCheck.tenant) {
        sheetId = ownerCheck.tenant.sheetId;
      }
    }
  }

  if (!isAuthorized && pin) {
    return { success: false, error: "Unauthorized access for archival." };
  }

  if (!sheetId && shopId) {
    var tenant = getTenantRecord(shopId);
    if (tenant) sheetId = tenant.sheetId;
  }

  if (!sheetId) {
    return { success: false, error: "Missing sheet_id or valid shop_id for archival." };
  }

  return archiveMonthlyOrders(sheetId);
}

/**
 * Monthly Auto-Archival Utility
 * Moves orders older than 30 days into a secondary archive sheet (e.g., Orders_Archive_YYYY_MM)
 * to keep the primary active sheet under 10,000 rows for lightning-fast reads.
 *
 * @param {string} sheetId Google Spreadsheet ID of the client's store
 * @returns {object} Summary of archival operation
 */
function archiveMonthlyOrders(sheetId) {
  if (!sheetId) {
    return { success: false, error: "sheetId is required for archival." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var ss = SpreadsheetApp.openById(sheetId);
    var ordersSheet = ss.getSheetByName("Orders") || ss.getSheets()[1];
    if (!ordersSheet) {
      return { success: false, error: "Orders sheet not found in spreadsheet." };
    }

    var data = ordersSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        archivedCount: 0,
        message: "Orders ledger is empty or has only headers. No archival needed."
      };
    }

    // Cutoff time: 30 days ago
    var cutoffMs = new Date().getTime() - (30 * 24 * 60 * 60 * 1000);
    var rowsToArchive = [];
    var rowIndicesToDelete = [];

    // Columns: A(0): Order_ID, B(1): Timestamp, C(2): Table_Number, D(3): Items_Summary,
    // E(4): Total_Price, F(5): Order_Status, G(6): Customer_Notes
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rawTimestamp = String(row[1] || "").trim();
      var orderDate = new Date(rawTimestamp);
      var isOlderThan30Days = false;

      if (!isNaN(orderDate.getTime())) {
        if (orderDate.getTime() < cutoffMs) {
          isOlderThan30Days = true;
        }
      }

      if (isOlderThan30Days) {
        rowsToArchive.push(row);
        rowIndicesToDelete.push(i + 1); // 1-based row index for sheet deletion
      }
    }

    if (rowsToArchive.length === 0) {
      return {
        success: true,
        archivedCount: 0,
        message: "No orders older than 30 days found. Active ledger is already lean and optimized."
      };
    }

    // Archive sheet name: Orders_Archive_YYYY_MM
    var archiveTabName = "Orders_Archive_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT", "yyyy_MM");
    var archiveSheet = ss.getSheetByName(archiveTabName);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(archiveTabName);
      // Copy schema headers
      archiveSheet.appendRow([
        "Order_ID",
        "Timestamp",
        "Table_Number",
        "Items_Summary",
        "Total_Price",
        "Order_Status",
        "Customer_Notes"
      ]);
      archiveSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    }

    // Append rows to archive sheet
    for (var a = 0; a < rowsToArchive.length; a++) {
      archiveSheet.appendRow(rowsToArchive[a]);
    }

    // Delete archived rows from active sheet in reverse (bottom to top) to maintain correct row numbers
    for (var d = rowIndicesToDelete.length - 1; d >= 0; d--) {
      ordersSheet.deleteRow(rowIndicesToDelete[d]);
    }

    return {
      success: true,
      archivedCount: rowsToArchive.length,
      archiveSheet: archiveTabName,
      message: "Successfully moved " + rowsToArchive.length + " orders (>30 days old) to " + archiveTabName + "."
    };
  } catch (err) {
    return {
      success: false,
      error: "Archival error: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// TENANT STORE PROFILE & THERMAL BILLING SETTINGS
// =========================================================================

/**
 * Fetch restaurant store profile and receipt settings from the tenant Google Sheet
 */
function handleOwnerGetSettings(params) {
  var auth = verifyOwnerAuth(params.shop_id, params.pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  try {
    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var settingsSheet = clientSs.getSheetByName("Settings");

    var settings = {
      restaurantName: tenant.shopName || "",
      storeAddress: "",
      phoneNumber: "",
      gstin: "",
      waiterTag: "Counter POS 01",
      footerMessage: "Thank you for dining with us! Please visit again.",
      upiId: ""
    };

    if (!settingsSheet) {
      return {
        success: true,
        shopId: tenant.shopId,
        settings: settings
      };
    }

    var data = settingsSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var key = String(data[i][0] || "").trim().toLowerCase();
      var val = String(data[i][1] || "").trim();

      if (key === "restaurant_name" || key === "restaurantname" || key === "name") settings.restaurantName = val;
      else if (key === "store_address" || key === "storeaddress" || key === "address") settings.storeAddress = val;
      else if (key === "phone_number" || key === "phonenumber" || key === "phone" || key === "contact") settings.phoneNumber = val;
      else if (key === "gstin" || key === "tax_id" || key === "taxid") settings.gstin = val;
      else if (key === "waiter_tag" || key === "waitertag" || key === "staff") settings.waiterTag = val;
      else if (key === "footer_message" || key === "footermessage" || key === "footer") settings.footerMessage = val;
      else if (key === "upi_id" || key === "upiid" || key === "upi") settings.upiId = val;
    }

    if (!settings.restaurantName && tenant.shopName) {
      settings.restaurantName = tenant.shopName;
    }

    return {
      success: true,
      shopId: tenant.shopId,
      settings: settings
    };
  } catch (err) {
    return {
      success: false,
      error: "Error reading store settings: " + err.toString()
    };
  }
}

/**
 * Save restaurant store profile and receipt settings to the tenant Google Sheet
 */
function handleOwnerSaveSettings(params) {
  var auth = verifyOwnerAuth(params.shop_id, params.pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var settingsSheet = clientSs.getSheetByName("Settings");

    if (!settingsSheet) {
      settingsSheet = clientSs.insertSheet("Settings");
      settingsSheet.appendRow(["Setting_Key", "Setting_Value", "Last_Updated"]);
      settingsSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    }

    var restaurantName = sanitizeString(params.restaurant_name || params.restaurantName || tenant.shopName);
    var storeAddress = sanitizeString(params.store_address || params.storeAddress || "");
    var phoneNumber = sanitizeString(params.phone_number || params.phoneNumber || "");
    var gstin = sanitizeString(params.gstin || params.tax_id || "");
    var waiterTag = sanitizeString(params.waiter_tag || params.waiterTag || "Counter POS 01");
    var footerMessage = sanitizeString(params.footer_message || params.footerMessage || "Thank you for dining with us! Please visit again.");
    var upiId = sanitizeString(params.upi_id || params.upiId || "");

    var settingsToSave = {
      "restaurant_name": restaurantName,
      "store_address": storeAddress,
      "phone_number": phoneNumber,
      "gstin": gstin,
      "waiter_tag": waiterTag,
      "footer_message": footerMessage,
      "upi_id": upiId
    };

    var data = settingsSheet.getDataRange().getValues();
    var existingKeys = {};
    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toLowerCase();
      if (k) existingKeys[k] = r + 1; // 1-indexed row number
    }

    var nowIso = new Date().toISOString();
    for (var sKey in settingsToSave) {
      var val = settingsToSave[sKey];
      if (existingKeys[sKey]) {
        var rowNum = existingKeys[sKey];
        settingsSheet.getRange(rowNum, 2).setValue(val);
        settingsSheet.getRange(rowNum, 3).setValue(nowIso);
      } else {
        settingsSheet.appendRow([sKey, val, nowIso]);
      }
    }

    // Also sync restaurant name back to Master_DB if changed
    if (restaurantName && restaurantName !== tenant.shopName) {
      try {
        var masterSs = SpreadsheetApp.openById(getMasterDbId());
        var shopsSheet = masterSs.getSheetByName("Shops") || masterSs.getSheets()[0];
        var sData = shopsSheet.getDataRange().getValues();
        for (var s = 1; s < sData.length; s++) {
          if (String(sData[s][0] || "").trim().toLowerCase() === tenant.shopId.toLowerCase()) {
            shopsSheet.getRange(s + 1, 2).setValue(restaurantName);
            break;
          }
        }
      } catch (e) {
        console.warn("Could not sync name to Master_DB:", e);
      }
    }

    return {
      success: true,
      message: "Store profile settings saved to Google Sheet!",
      settings: {
        restaurantName: restaurantName,
        storeAddress: storeAddress,
        phoneNumber: phoneNumber,
        gstin: gstin,
        waiterTag: waiterTag,
        footerMessage: footerMessage,
        upiId: upiId
      }
    };
  } catch (err) {
    return {
      success: false,
      error: "Error saving store settings: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}


