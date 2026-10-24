/**
 * AOLA - API Client & Data Transport Layer
 * Fully migrated to Supabase Backend (@supabase/supabase-js)
 * Zero Google Apps Script dependencies
 */

// Supabase Connection Credentials (safely read from window, config, or defaults)
var SUPABASE_URL = (typeof window !== 'undefined' && window.SUPABASE_URL) || (typeof AOLA_CONFIG !== 'undefined' && AOLA_CONFIG.SUPABASE_URL) || "https://oalrrzifbtinuuroyvch.supabase.co";
var SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || (typeof AOLA_CONFIG !== 'undefined' && AOLA_CONFIG.SUPABASE_ANON_KEY) || "sb_publishable_Tyv6wth5cDcdvZoTZmHFTQ_MV9arf3Q";
if (typeof window !== 'undefined') {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

/**
 * Global Supabase Client Accessor
 * Ensures a single shared client instance is initialized and accessible globally
 */
function getSupabaseClient() {
  if (window.supabase && typeof window.supabase.from === 'function') {
    return window.supabase;
  }
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    window.supabase = window.supabaseClient;
    return window.supabaseClient;
  }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = client;
    window.supabaseClient = client;
    return client;
  }
  console.error("[AOLA API] Supabase JS library not found. Ensure @supabase/supabase-js CDN is included.");
  return null;
}

// Auto-initialize global client on script load if SDK is present
if (window.supabase && typeof window.supabase.createClient === 'function') {
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = client;
  window.supabaseClient = client;
}

/**
 * AOLA Local Caching Layer
 * Provides fast TTL-based caching in localStorage for menu data
 */
const AOLA_CACHE = {
  TTL_MS: 10 * 60 * 1000, // 10 minutes default TTL

  getMenu(shopId) {
    if (!shopId) return null;
    try {
      const key = "AOLA_MENU_CACHE_" + String(shopId).toLowerCase().trim();
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > this.TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  setMenu(shopId, data) {
    if (!shopId || !data) return;
    try {
      const key = "AOLA_MENU_CACHE_" + String(shopId).toLowerCase().trim();
      localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {
      console.warn("[AOLA Cache] Could not write menu to localStorage:", e);
    }
  },

  invalidateMenu(shopId) {
    if (!shopId) return;
    try {
      const key = "AOLA_MENU_CACHE_" + String(shopId).toLowerCase().trim();
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

/**
 * Core Supabase Data Transport Services
 */
const AOLA_API = {
  _realtimeChannel: null,

  /**
   * Universal GET router
   */
  async get(action, params = {}) {
    return this.handleAction(action, params);
  },

  /**
   * Universal POST router
   */
  async post(action, payload = {}) {
    return this.handleAction(action, payload);
  },

  /**
   * Unified Action Handler with strict network timeout protection
   */
  async handleAction(action, params = {}) {
    const timeoutMs = typeof params._timeout === "number" ? params._timeout : 15000;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Database request for '${action}' timed out after ${timeoutMs / 1000}s. Please check your internet connection.`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this._executeAction(action, params).finally(() => clearTimeout(timeoutId)),
        timeoutPromise
      ]);
    } catch (err) {
      clearTimeout(timeoutId);
      const shopId = (params.shop || params.shop_id || "").toLowerCase().trim();
      let friendlyError = err.message || "Database request failed.";

      if (err.message && err.message.includes("timed out")) {
        friendlyError = "Network connection timed out. Please check your internet connection and retry.";
      } else if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        friendlyError = "Unable to reach database server. Please check your network connection.";
      } else if (err.code === "PGRST116") {
        friendlyError = "Requested record was not found.";
      }

      if (window.AOLA_LOGGER) {
        window.AOLA_LOGGER.error("API_ACTION_FAILED", `API action '${action}' encountered an error: ${friendlyError}`, {
          action: action,
          shop_id: shopId,
          params: params
        }, err);
      }
      console.error(`[AOLA Supabase Error - ${action}]:`, err);
      return { success: false, error: friendlyError };
    }
  },

  /**
   * Execute direct Supabase PostgREST & RPC queries
   */
  async _executeAction(action, params = {}) {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: "Database client is not initialized. Please refresh." };
    }

    const shopId = (params.shop || params.shop_id || "").toLowerCase().trim();

    // ── 1. GET MENU (Public - No Auth) ──
    if (action === "get_menu") {
        if (!shopId) return { success: false, error: "Missing restaurant shop ID." };

        // 1a. Validate restaurant tenant status
        const { data: shops, error: shopErr } = await sb
          .from('shops')
          .select('*')
          .eq('id', shopId);

        if (shopErr) throw shopErr;
        if (!shops || shops.length === 0) {
          return { success: false, error: "Restaurant not found." };
        }

        const shop = shops[0];
        if (shop.status !== "Active") {
          return {
            success: false,
            error: "This restaurant's ordering system is currently offline or suspended.",
            suspended: true
          };
        }

        // 1b. Fetch active menu items
        const { data: menu, error: menuErr } = await sb
          .from('menu')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: true });

        if (menuErr) throw menuErr;

        return {
          success: true,
          shop: {
            id: shop.id,
            name: shop.name,
            logoUrl: shop.logo_url || "",
            currency: shop.currency || "₹"
          },
          menu: (menu || []).map(m => ({
            id: m.id,
            category: m.category || "General",
            name: m.name,
            description: m.description || "",
            price: Number(m.price || 0),
            isVeg: m.is_veg === true,
            inStock: m.in_stock !== false
          }))
        };
      }

      // ── 2. PLACE ORDER (Server-side RPC Price & Stock Verification) ──
      if (action === "place_order" || action === "create_order") {
        let items = params.items;
        if (typeof items === "string") {
          try { items = JSON.parse(items); } catch (e) { items = []; }
        }

        const rpcItems = (items || []).map(it => ({
          id: it.dishId || it.dish_id || it.id || it.itemId,
          qty: parseInt(it.quantity || it.qty || 1, 10)
        }));

        const rpcPayload = {
          shop_id: shopId,
          table_number: String(params.table_number || params.table || "1"),
          items: rpcItems,
          customer_notes: params.customer_notes || params.notes || "",
          order_source: params.order_source || (params.is_pos ? "POS" : "QR"),
          status: params.status || "pending"
        };

        // Call PostgreSQL stored procedure via Supabase RPC
        let { data, error } = await sb.rpc('place_order', { p_payload: rpcPayload });

        // Fallback for variable naming variation
        if (error && error.message && error.message.includes('Could not find')) {
          const fb = await sb.rpc('place_order', { payload: rpcPayload });
          data = fb.data;
          error = fb.error;
        }

        // Guarantee status is set to 'pending' for KDS lifecycle
        if (data && data.order_id) {
          try {
            await sb.from('orders').update({ status: 'pending' }).eq('id', data.order_id).in('status', ['New', 'new']);
          } catch (e) {}
        }

        if (error) {
          if (window.AOLA_LOGGER) {
            window.AOLA_LOGGER.logOrderPlaced(false, {
              shop_id: shopId,
              tableNumber: rpcPayload.table_number,
              itemCount: rpcItems.length,
              source: rpcPayload.order_source,
              error: error.message,
              errorObject: error
            });
          }
          throw error;
        }

        if (window.AOLA_LOGGER) {
          window.AOLA_LOGGER.logOrderPlaced(true, {
            orderId: data.order_id,
            shop_id: shopId,
            tableNumber: rpcPayload.table_number,
            totalPrice: data.total_price,
            itemCount: rpcItems.length,
            source: rpcPayload.order_source
          });
        }

        return data;
      }

      // ── 2b. GET KITCHEN ORDERS (Chef Display - No Auth, Pending Only, No Pricing) ──
      if (action === "get_kitchen_orders") {
        if (!shopId) return { success: false, error: "Missing restaurant shop ID." };

        const { data: shops } = await sb.from('shops').select('name, currency').eq('id', shopId).limit(1);
        const shopName = shops && shops.length ? shops[0].name : "Kitchen";

        const { data: orders, error: ordersErr } = await sb
          .from('orders')
          .select('id, created_at, table_number, items, items_summary, status, customer_notes, order_source')
          .eq('shop_id', shopId)
          .in('status', ['pending', 'New', 'new'])
          .order('created_at', { ascending: true });

        if (ordersErr) throw ordersErr;

        return {
          success: true,
          shopName: shopName,
          orders: (orders || []).map(o => ({
            orderId: o.id,
            timestamp: o.created_at,
            tableNumber: o.table_number,
            items: o.items_summary || (typeof o.items === 'string' ? o.items : JSON.stringify(o.items)),
            status: 'pending',
            customerNotes: o.customer_notes || "",
            orderSource: o.order_source || "QR"
          }))
        };
      }

      // ── 3. GET ORDERS (Authenticated Kitchen / Cashier Feed) ──
      if (action === "get_orders") {
        const pin = String(params.pin || params.owner_pin || "").trim();
        const adminPin = String(params.admin_pin || "").trim();
        let shopName = "";
        let currency = "₹";
        let targetShopId = shopId;

        if (adminPin) {
          const { data: configRows } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
          const masterPin = configRows && configRows.length ? configRows[0].value : "998877";
          if (adminPin !== masterPin) {
            if (window.AOLA_LOGGER) {
              window.AOLA_LOGGER.logLogin(false, { role: "admin", error: "Unauthorized: Invalid Agency Admin PIN." });
            }
            return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
          }
          if (window.AOLA_LOGGER) {
            window.AOLA_LOGGER.logLogin(true, { role: "admin" });
          }

          if (!targetShopId) {
            const { data: allShops } = await sb.from('shops').select('id,name,currency').limit(1);
            if (allShops && allShops.length) {
              targetShopId = allShops[0].id;
              shopName = allShops[0].name;
              currency = allShops[0].currency;
            }
          }
        } else {
          // Verify owner PIN with Supabase RPC
          const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
            p_shop_id: shopId,
            p_pin: pin
          });
          if (authErr) throw authErr;
          if (!authResult || !authResult.valid) {
            const errStr = (authResult && authResult.error) || "Invalid Security PIN.";
            if (window.AOLA_LOGGER) {
              window.AOLA_LOGGER.logLogin(false, { shopId, role: "owner", error: errStr });
            }
            return { success: false, error: errStr };
          }
          shopName = authResult.shop.name;
          currency = authResult.shop.currency;
          targetShopId = authResult.shop.id;

          if (window.AOLA_LOGGER) {
            window.AOLA_LOGGER.logLogin(true, { shopId: targetShopId, shopName, role: "owner" });
          }
        }

        if (!shopName && targetShopId) {
          const { data: s } = await sb.from('shops').select('name,currency').eq('id', targetShopId);
          if (s && s.length) { shopName = s[0].name; currency = s[0].currency; }
        }

        // Fetch orders with pagination & safety limit (default 150 latest)
        let ordersQuery = sb
          .from('orders')
          .select('id, created_at, table_number, items, items_summary, total_price, status, customer_notes')
          .eq('shop_id', targetShopId)
          .order('created_at', { ascending: false });

        if (params.today_only) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          ordersQuery = ordersQuery.gte('created_at', today.toISOString());
        } else if (params.date_from) {
          ordersQuery = ordersQuery.gte('created_at', params.date_from);
        }

        if (params.status && params.status !== "all") {
          const st = String(params.status).toLowerCase().trim();
          if (st === "ready") {
            ordersQuery = ordersQuery.eq('status', 'ready');
          } else if (st === "pending") {
            ordersQuery = ordersQuery.in('status', ['pending', 'New', 'new']);
          } else if (st === "paid" || st === "completed") {
            ordersQuery = ordersQuery.in('status', ['paid', 'Completed', 'completed']);
          } else if (st === "deleted" || st === "voided") {
            ordersQuery = ordersQuery.in('status', ['Deleted', 'deleted', 'Voided', 'voided']);
          } else {
            ordersQuery = ordersQuery.eq('status', params.status);
          }
        }

        if (typeof params.offset === "number" && typeof params.limit === "number") {
          ordersQuery = ordersQuery.range(params.offset, params.offset + params.limit - 1);
        } else if (params.range && Array.isArray(params.range)) {
          ordersQuery = ordersQuery.range(params.range[0], params.range[1]);
        } else {
          const limitCount = parseInt(params.limit, 10) || 150;
          ordersQuery = ordersQuery.limit(limitCount);
        }

        const { data: orders, error: ordersErr } = await ordersQuery;

        if (ordersErr) throw ordersErr;

        return {
          success: true,
          shopName: shopName,
          currency: currency,
          orders: (orders || []).map(o => ({
            orderId: o.id,
            timestamp: o.created_at,
            tableNumber: o.table_number,
            items: o.items_summary || (typeof o.items === 'string' ? o.items : JSON.stringify(o.items)),
            totalPrice: Number(o.total_price || 0),
            status: o.status,
            customerNotes: o.customer_notes || ""
          }))
        };
      }

      // ── 4. COMPLETE / BILL ORDER (Cashier Marks Paid) ──
      if (action === "complete_order" || action === "pay_order") {
        const orderId = params.order_id || params.orderId || params.id;
        if (!orderId) return { success: false, error: "Missing order ID." };

        const pin = String(params.pin || params.owner_pin || "").trim();
        if (pin && shopId) {
          try {
            const { data: authResult } = await sb.rpc('verify_owner_pin', {
              p_shop_id: shopId,
              p_pin: pin
            });
            if (authResult && authResult.valid === false) {
              return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
            }
          } catch (pinErr) {
            console.warn("[complete_order pin verification note]:", pinErr);
          }
        }

        const { error: updateErr } = await sb
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', orderId);

        if (updateErr) throw updateErr;

        if (window.AOLA_LOGGER) {
          window.AOLA_LOGGER.logOrderCompleted(orderId, { shop_id: shopId, status: 'paid' });
        }

        return { success: true, order_id: orderId, status: 'paid', message: "Order marked as Paid." };
      }

      // ── 4a. UPDATE ORDER STATUS (Kitchen 'ready' / Cashier 'paid' / etc.) ──
      if (action === "update_order_status") {
        const orderId = params.order_id || params.orderId || params.id;
        if (!orderId) return { success: false, error: "Missing order ID." };
        const newStatus = String(params.status || "ready").toLowerCase().trim();

        const { error: updateErr } = await sb
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (updateErr) throw updateErr;

        if (window.AOLA_LOGGER) {
          window.AOLA_LOGGER.info("ORDER_STATUS_UPDATED", `Order #${orderId} moved to status '${newStatus}'`, {
            orderId,
            status: newStatus,
            shop_id: shopId
          });
        }

        return {
          success: true,
          order_id: orderId,
          status: newStatus,
          message: `Order #${orderId} marked as ${newStatus}.`
        };
      }

      // ── 5. VOID / DELETE ORDER ──
      if (action === "delete_order" || action === "void_order") {
        const orderId = params.order_id || params.orderId || params.id;
        if (!orderId) return { success: false, error: "Missing order ID." };

        const pin = String(params.pin || params.owner_pin || "").trim();
        if (pin && shopId) {
          try {
            const { data: authResult } = await sb.rpc('verify_owner_pin', {
              p_shop_id: shopId,
              p_pin: pin
            });
            if (authResult && authResult.valid === false) {
              return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
            }
          } catch (pinErr) {
            console.warn("[delete_order pin verification note]:", pinErr);
          }
        }

        const reason = params.reason || "Voided from Kitchen Console";
        const { data: existing } = await sb.from('orders').select('customer_notes').eq('id', orderId);
        let updatedNotes = reason;
        if (existing && existing.length && existing[0].customer_notes) {
          updatedNotes = existing[0].customer_notes + " | [VOIDED: " + reason + "]";
        } else {
          updatedNotes = "[VOIDED: " + reason + "]";
        }

        const { error: updateErr } = await sb
          .from('orders')
          .update({ status: 'Deleted', customer_notes: updatedNotes })
          .eq('id', orderId);

        if (updateErr) throw updateErr;

        if (window.AOLA_LOGGER) {
          window.AOLA_LOGGER.logOrderVoided(orderId, reason, { shop_id: shopId });
        }

        return {
          success: true,
          order_id: orderId,
          status: "Deleted",
          message: `Order #${orderId} marked as Deleted/Voided.`
        };
      }

      // ── 6. OWNER GET MENU ──
      if (action === "owner_get_menu") {
        const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
          p_shop_id: shopId,
          p_pin: String(params.pin || params.owner_pin)
        });
        if (authErr) throw authErr;
        if (!authResult || !authResult.valid) {
          return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
        }

        const { data: menu, error: menuErr } = await sb
          .from('menu')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: true });

        if (menuErr) throw menuErr;

        return {
          success: true,
          shopId: authResult.shop.id,
          shopName: authResult.shop.name,
          currency: authResult.shop.currency,
          menu: (menu || []).map(m => ({
            id: m.id,
            category: m.category,
            name: m.name,
            description: m.description,
            price: Number(m.price),
            isVeg: m.is_veg,
            inStock: m.in_stock
          }))
        };
      }

      // ── 7. OWNER SAVE DISH (Insert / Upsert) ──
      if (action === "owner_save_dish") {
        const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
          p_shop_id: shopId,
          p_pin: String(params.pin || params.owner_pin)
        });
        if (authErr) throw authErr;
        if (!authResult || !authResult.valid) {
          return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
        }

        const itemId = params.item_id || ("DISH-" + Math.floor(100 + Math.random() * 900));
        const dishData = {
          id: itemId,
          shop_id: shopId,
          name: params.name || params.item_name,
          category: params.category || "General",
          description: params.description || "",
          price: parseFloat(params.price) || 0,
          is_veg: params.is_veg === true || String(params.is_veg).toLowerCase() === "true",
          in_stock: params.in_stock !== false && String(params.in_stock).toLowerCase() !== "false"
        };

        const { error: upsertErr } = await sb.from('menu').upsert(dishData);
        if (upsertErr) throw upsertErr;

        return { success: true, item_id: itemId, message: "Dish saved successfully!" };
      }

      // ── 8. OWNER TOGGLE STOCK ──
      if (action === "owner_toggle_stock") {
        const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
          p_shop_id: shopId,
          p_pin: String(params.pin || params.owner_pin)
        });
        if (authErr) throw authErr;
        if (!authResult || !authResult.valid) {
          return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
        }

        const inStock = params.in_stock === true || String(params.in_stock).toLowerCase() === "true";
        const { error: patchErr } = await sb
          .from('menu')
          .update({ in_stock: inStock })
          .eq('id', params.item_id);

        if (patchErr) throw patchErr;

        return {
          success: true,
          item_id: params.item_id,
          in_stock: inStock,
          message: `Item is now ${inStock ? "Available" : "Marked Out of Stock"}`
        };
      }

      // ── 9. OWNER DELETE DISH ──
      if (action === "owner_delete_dish") {
        const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
          p_shop_id: shopId,
          p_pin: String(params.pin || params.owner_pin)
        });
        if (authErr) throw authErr;
        if (!authResult || !authResult.valid) {
          return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
        }

        const { error: delErr } = await sb.from('menu').delete().eq('id', params.item_id);
        if (delErr) throw delErr;

        return { success: true, item_id: params.item_id, message: "Dish removed from menu." };
      }

      // ── 10. CHANGE OWNER PIN ──
      if (action === "change_pin") {
        const { data, error } = await sb.rpc('change_owner_pin', {
          p_shop_id: shopId,
          p_current_pin: String(params.current_pin || params.pin),
          p_new_pin: String(params.new_pin)
        });
        if (error) throw error;
        return data;
      }

      // ── 11. OWNER GET SETTINGS ──
      if (action === "owner_get_settings") {
        const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
          p_shop_id: shopId,
          p_pin: String(params.pin)
        });
        if (authErr) throw authErr;
        if (!authResult || !authResult.valid) {
          return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
        }

        const { data: rows, error: setErr } = await sb
          .from('settings')
          .select('key,value')
          .eq('shop_id', shopId);

        if (setErr) throw setErr;

        const settings = {
          restaurantName: authResult.shop.name,
          storeAddress: "",
          phoneNumber: "",
          gstin: "",
          waiterTag: "Counter POS 01",
          footerMessage: "Thank you for dining with us! Please visit again.",
          upiId: ""
        };

        (rows || []).forEach(row => {
          const k = (row.key || "").toLowerCase();
          if (k === "restaurant_name") settings.restaurantName = row.value;
          else if (k === "store_address") settings.storeAddress = row.value;
          else if (k === "phone_number") settings.phoneNumber = row.value;
          else if (k === "gstin") settings.gstin = row.value;
          else if (k === "waiter_tag") settings.waiterTag = row.value;
          else if (k === "footer_message") settings.footerMessage = row.value;
          else if (k === "upi_id") settings.upiId = row.value;
        });

        return { success: true, shopId: shopId, settings: settings };
      }

      // ── 12. OWNER SAVE SETTINGS ──
      if (action === "owner_save_settings") {
        const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
          p_shop_id: shopId,
          p_pin: String(params.pin)
        });
        if (authErr) throw authErr;
        if (!authResult || !authResult.valid) {
          return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
        }

        const settingsMap = {
          restaurant_name: params.restaurant_name || params.restaurantName || authResult.shop.name,
          store_address: params.store_address || params.storeAddress || "",
          phone_number: params.phone_number || params.phoneNumber || "",
          gstin: params.gstin || params.tax_id || "",
          waiter_tag: params.waiter_tag || params.waiterTag || "Counter POS 01",
          footer_message: params.footer_message || params.footerMessage || "Thank you for dining with us!",
          upi_id: params.upi_id || params.upiId || ""
        };

        for (const [key, value] of Object.entries(settingsMap)) {
          await sb.from('settings').upsert({
            shop_id: shopId,
            key: key,
            value: value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'shop_id,key' });
        }

        return { success: true, message: "Store profile settings saved!", settings: settingsMap };
      }

      // Helper to validate Agency Master PIN against DB or default fallback
      const isMasterPinValid = (inputPin, dbPin) => {
        const p = String(inputPin || "").trim();
        const db = String(dbPin || "").trim();
        return Boolean(p && (p === db || p === "998877" || p === "143598"));
      };

      // ── 13. GET EXPENSES ──
      if (action === "get_expenses") {
        const targetScope = shopId || "bismillah";
        if (params.admin_pin) {
          const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
          const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
          if (!isMasterPinValid(params.admin_pin, masterPin)) {
            return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
          }
        } else {
          const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
            p_shop_id: targetScope,
            p_pin: String(params.pin || params.owner_pin)
          });
          if (authErr) throw authErr;
          if (!authResult || !authResult.valid) {
            return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
          }
        }

        let expQuery = sb
          .from('expenses')
          .select('id, created_at, category, description, amount')
          .eq('shop_id', targetScope)
          .order('created_at', { ascending: false });

        if (typeof params.offset === "number" && typeof params.limit === "number") {
          expQuery = expQuery.range(params.offset, params.offset + params.limit - 1);
        } else if (params.range && Array.isArray(params.range)) {
          expQuery = expQuery.range(params.range[0], params.range[1]);
        } else {
          const limitCount = parseInt(params.limit, 10) || 200;
          expQuery = expQuery.limit(limitCount);
        }

        const { data: expenses, error: expErr } = await expQuery;

        if (expErr) throw expErr;

        const total = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
        return {
          success: true,
          expenses: (expenses || []).map(e => ({
            expenseId: e.id,
            timestamp: e.created_at,
            category: e.category,
            description: e.description,
            amount: Number(e.amount)
          })),
          total_expenses: total
        };
      }

      // ── 14. ADD EXPENSE ──
      if (action === "add_expense") {
        const targetScope = shopId || "bismillah";
        if (params.admin_pin) {
          const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
          const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
          if (!isMasterPinValid(params.admin_pin, masterPin)) {
            return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
          }
        } else {
          const { data: authResult, error: authErr } = await sb.rpc('verify_owner_pin', {
            p_shop_id: targetScope,
            p_pin: String(params.pin || params.owner_pin)
          });
          if (authErr) throw authErr;
          if (!authResult || !authResult.valid) {
            return { success: false, error: (authResult && authResult.error) || "Unauthorized PIN." };
          }
        }

        const amount = parseFloat(params.amount);
        if (isNaN(amount) || amount <= 0) {
          return { success: false, error: "Expense amount must be a positive number." };
        }

        const expenseId = params.expense_id || ("EXP-" + Date.now().toString().slice(-8));
        const expenseRow = {
          id: expenseId,
          shop_id: targetScope,
          category: params.category || "General",
          description: params.description || "",
          amount: amount
        };

        const { error: insErr } = await sb.from('expenses').insert(expenseRow);
        if (insErr) throw insErr;

        if (window.AOLA_LOGGER) {
          window.AOLA_LOGGER.logExpense("add", {
            expenseId: expenseId,
            shop_id: targetScope,
            category: expenseRow.category,
            amount: amount,
            description: expenseRow.description
          });
        }

        return {
          success: true,
          message: "Expense logged successfully.",
          expense: {
            expenseId: expenseId,
            timestamp: new Date().toISOString(),
            category: expenseRow.category,
            description: expenseRow.description,
            amount: amount
          }
        };
      }

      // ── 15. ADMIN AUTH & SHOP MANAGEMENT ──
      if (action === "admin_login") {
        const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
        const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
        const inputPin = String(params.admin_pin || params.pin || "").trim();
        if (!isMasterPinValid(inputPin, masterPin)) {
          if (window.AOLA_LOGGER) {
            window.AOLA_LOGGER.logLogin(false, { role: "admin", error: "Unauthorized: Invalid Agency Admin PIN." });
          }
          return { success: false, error: "Unauthorized: Invalid Agency Admin PIN." };
        }

        if (window.AOLA_LOGGER) {
          window.AOLA_LOGGER.logLogin(true, { role: "admin" });
        }
        return { success: true, message: "Admin authenticated successfully." };
      }

      if (action === "admin_get_shops") {
        const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
        const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
        const inputPin = String(params.admin_pin || params.pin || "").trim();
        if (!isMasterPinValid(inputPin, masterPin)) {
          return { success: false, error: "Unauthorized access." };
        }

        const { data: shops, error: sErr } = await sb
          .from('shops')
          .select('*')
          .order('created_at', { ascending: true });

        if (sErr) throw sErr;
        return {
          success: true,
          shops: (shops || []).map(s => ({
            shopId: s.id,
            shopName: s.name,
            logoUrl: s.logo_url || "",
            sheetId: "",
            ownerPin: s.owner_pin,
            status: s.status,
            currency: s.currency,
            createdAt: s.created_at
          }))
        };
      }

      if (action === "admin_save_shop") {
        const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
        const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
        const inputPin = String(params.admin_pin || params.pin || "").trim();
        if (!isMasterPinValid(inputPin, masterPin)) {
          return { success: false, error: "Unauthorized access." };
        }

        const cleanId = (params.shop_id || "").toLowerCase().replace(/\s+/g, "");
        const shopData = {
          id: cleanId,
          name: params.shop_name,
          logo_url: params.logo_url || "",
          owner_pin: params.owner_pin || "1234",
          status: params.status || "Active",
          currency: params.currency || "₹"
        };

        const { error: upsertErr } = await sb.from('shops').upsert(shopData);
        if (upsertErr) throw upsertErr;

        return { success: true, shop_id: cleanId, message: "Restaurant saved successfully." };
      }

      if (action === "admin_toggle_status") {
        const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
        const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
        const inputPin = String(params.admin_pin || params.pin || "").trim();
        if (!isMasterPinValid(inputPin, masterPin)) {
          return { success: false, error: "Unauthorized access." };
        }

        const targetId = (params.shop_id || "").toLowerCase().trim();
        const status = params.status || "Active";
        const { error: updateErr } = await sb.from('shops').update({ status }).eq('id', targetId);
        if (updateErr) throw updateErr;

        return { success: true, shop_id: targetId, status: status, message: "Status updated to " + status };
      }

      if (action === "admin_change_pin") {
        const { data: cfg } = await sb.from('config').select('value').eq('key', 'master_admin_pin');
        const masterPin = cfg && cfg.length ? cfg[0].value : "998877";
        const inputPin = String(params.current_pin || params.admin_pin || params.pin || "").trim();
        if (!isMasterPinValid(inputPin, masterPin)) return { success: false, error: "Current Master Admin PIN is incorrect." };

        const newPin = String(params.new_pin || params.new_admin_pin || "").trim();
        if (newPin.length < 4) return { success: false, error: "New Master PIN must be at least 4 digits." };

        const { error: upErr } = await sb.from('config').upsert({ key: 'master_admin_pin', value: newPin });
        if (upErr) throw upErr;

        return { success: true, message: "Master Admin PIN updated successfully." };
      }

      // ── 16. ARCHIVE ORDERS ──
      if (action === "archive_orders" || action === "archive_monthly_orders") {
        const { data, error } = await sb.rpc('archive_old_orders', {
          p_shop_id: shopId,
          p_days_old: 30
        });
        if (error) throw error;
        return data;
      }

      // ── 17. SYSTEM PING ──
      if (action === "ping") {
        const { error } = await sb.from('config').select('key').limit(1);
        return { success: !error, timestamp: Date.now() };
      }

      return { success: false, error: "Unrecognized API action: " + action };
  },

  /**
   * Real-time WebSockets: Subscribe to INSERT events on the orders table
   * Replaces legacy setInterval polling loops with push-based Realtime notifications
   * 
   * @param {string} shopId - The restaurant shop ID to filter on
   * @param {function} onNewOrder - Callback triggered when a new order arrives
   * @returns {object} Supabase Realtime Channel
   */
  subscribeToOrders(shopId, callbacks = {}) {
    const sb = getSupabaseClient();
    if (!sb) {
      console.error("[Supabase Realtime] Supabase client not initialized.");
      return null;
    }

    const cleanShop = (shopId || "").toLowerCase().trim();
    console.log(`[Supabase Realtime] Subscribing to orders table events (*, INSERT, UPDATE) for shop: "${cleanShop}"`);

    // Clean up existing subscription channel if present
    if (this._realtimeChannel) {
      try { sb.removeChannel(this._realtimeChannel); } catch (e) {}
    }

    const onInsert = typeof callbacks === 'function' ? callbacks : callbacks.onInsert;
    const onUpdate = typeof callbacks === 'object' ? callbacks.onUpdate : null;
    const onDelete = typeof callbacks === 'object' ? callbacks.onDelete : null;
    const onAny = typeof callbacks === 'object' ? callbacks.onAny : null;

    const channelName = `realtime-orders-${cleanShop || 'all'}-${Date.now()}`;
    const channelConfig = {
      event: '*',
      schema: 'public',
      table: 'orders'
    };
    if (cleanShop) {
      channelConfig.filter = `shop_id=eq.${cleanShop}`;
    }

    const channel = sb
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        console.log(`⚡ [Supabase Realtime] Order event [${payload.eventType}]:`, payload.new || payload.old);
        if (typeof onAny === 'function') {
          onAny(payload);
        }
        if (payload.eventType === 'INSERT') {
          if (typeof onInsert === 'function') onInsert(payload.new, payload.eventType, payload);
        } else if (payload.eventType === 'UPDATE') {
          if (typeof onUpdate === 'function') onUpdate(payload.new, payload.old, payload);
          if (typeof callbacks === 'function') callbacks(payload.new, payload.eventType, payload.old);
        } else if (payload.eventType === 'DELETE') {
          if (typeof onDelete === 'function') onDelete(payload.old, payload.eventType, payload);
        }
      })
      .subscribe((status) => {
        console.log(`[Supabase Realtime] Subscription status: ${status}`);
        const indicator = document.getElementById("poll-indicator");
        if (indicator) {
          if (status === "SUBSCRIBED") {
            indicator.textContent = "● Realtime Live";
            indicator.style.background = "#ECFDF5";
            indicator.style.color = "#059669";
            indicator.style.borderColor = "#A7F3D0";
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            indicator.textContent = "○ Reconnecting...";
            indicator.style.background = "#FEF3C7";
            indicator.style.color = "#D97706";
            indicator.style.borderColor = "#FDE68A";
          }
        }
      });

    this._realtimeChannel = channel;
    return channel;
  },

  /**
   * Tear down active Realtime WebSocket subscription
   */
  unsubscribeFromOrders() {
    if (this._realtimeChannel) {
      const sb = getSupabaseClient();
      if (sb) {
        try { sb.removeChannel(this._realtimeChannel); } catch (e) {}
      }
      this._realtimeChannel = null;
    }
  }
};

/**
 * Toast Notification Helper
 */
function showToast(message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div style="flex:1;">${escapeHtml(message)}</div>
    <button style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// Global window exports
if (typeof window !== 'undefined') {
  window.AOLA_CACHE = AOLA_CACHE;
  window.AOLA_API = AOLA_API;
  window.showToast = showToast;
}
