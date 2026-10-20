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
  LOCK_TIMEOUT_MS: 15000
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

      case "change_pin":
        responseData = handleChangePin(params);
        break;

      case "admin_change_pin":
        responseData = handleAdminChangePin(params);
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

function sanitizeString(input) {
  if (input === null || input === undefined) return "";
  var str = String(input);
  str = str.replace(/<[^>]*>?/gm, "");
  str = str.replace(/["'<>`]/g, "");
  return str.trim();
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
function verifyOwnerAuth(shopId, pin) {
  if (!shopId || !pin) {
    return { valid: false, error: "Shop ID and Owner PIN are required." };
  }

  var tenant = getTenantRecord(shopId);
  if (!tenant) {
    return { valid: false, error: "Restaurant not found." };
  }

  if (tenant.status.toLowerCase() !== "active") {
    return { valid: false, error: "Restaurant ordering is currently suspended." };
  }

  if (String(tenant.ownerPin).trim() !== String(pin).trim()) {
    return { valid: false, error: "Invalid Owner PIN." };
  }

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
  var totalPrice = parseFloat(params.total_price) || 0;

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

  // 4. Parse Items Summary
  var itemsSummary = "";
  if (params.items_summary) {
    itemsSummary = sanitizeString(params.items_summary);
  } else if (params.items && Array.isArray(params.items)) {
    itemsSummary = params.items.map(function(item) {
      var qty = item.quantity || item.qty || 1;
      var name = item.name || item.item_name || "Item";
      var price = item.price || 0;
      return qty + "x " + name + " (" + tenant.currency + (price * qty) + ")";
    }).join(", ");
  } else if (typeof params.items === "string") {
    itemsSummary = sanitizeString(params.items);
  }

  if (!itemsSummary) {
    return { success: false, error: "Order items cannot be empty." };
  }

  // 5. Append Order with Script Lock
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    var clientSs = SpreadsheetApp.openById(tenant.sheetId);
    var ordersSheet = clientSs.getSheetByName("Orders") || clientSs.getSheets()[1];

    var orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    var timestampStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss");

    // Orders Tab Schema:
    // A (0): Order_ID
    // B (1): Timestamp
    // C (2): Table_Number
    // D (3): Items_Summary
    // E (4): Total_Price
    // F (5): Order_Status (Set to 'New')
    // G (6): Customer_Notes
    ordersSheet.appendRow([
      orderId,
      timestampStr,
      tableNumber,
      itemsSummary,
      totalPrice,
      "New",
      customerNotes
    ]);

    // Apply 60s table rate lock
    lockTableRateLimit(shopId, tableNumber);

    return {
      success: true,
      order_id: orderId,
      table_number: tableNumber,
      total_price: totalPrice,
      message: "Order placed successfully!"
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

  var auth = verifyOwnerAuth(shopId, pin);
  if (!auth.valid) {
    return { success: false, error: auth.error };
  }

  var tenant = auth.tenant;

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

  if (!shopId || !shopName || !sheetId || !ownerPin) {
    return {
      success: false,
      error: "Missing required shop fields (shop_id, shop_name, sheet_id, owner_pin)."
    };
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
      message: "Restaurant saved successfully in Master DB."
    };
  } catch (err) {
    return { success: false, error: "Error saving restaurant: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
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

  if (!newPin || newPin.length < 4) {
    return { success: false, error: "New PIN must be at least 4 digits." };
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
  var newPin = sanitizeString(params.new_pin);

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
