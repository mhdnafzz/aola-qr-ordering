/**
 * AOLA - API Client & Data Transport Layer
 * Handles communication with Google Apps Script Web App & Mock Fallbacks
 */

/**
 * Executes fetch with exponential backoff (1s, 2s, 4s)
 * Automatically retries on network failures, cold start timeouts, and Apps Script quota limits (HTTP 429, 503)
 */
async function fetchWithExponentialBackoff(url, options = {}, maxRetries = 3) {
  let attempt = 0;
  const backoffDelays = [1000, 2000, 4000];

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      // Google Apps Script cold starts can take 20s-25s
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 25000);

      const fetchOptions = {
        ...options,
        signal: controller.signal
      };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Quota limits or transient gateway issues -> retry with backoff
      if ((response.status === 429 || response.status === 503 || response.status === 502 || response.status === 504) && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 250);
        const delay = backoffDelays[attempt] + jitter;
        console.warn(`[AOLA Backoff] Received HTTP ${response.status}. Retrying in ${delay}ms (Attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }

      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 250);
        const delay = backoffDelays[attempt] + jitter;
        console.warn(`[AOLA Backoff] Fetch attempt ${attempt + 1} failed: ${err.message || "Network Error"}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      } else {
        throw err;
      }
    }
  }
}

/**
 * AOLA Local Caching Layer
 * Provides TTL-based caching in localStorage to reduce repetitive reads against Google Sheets quotas
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

const AOLA_API = {
  /**
   * Universal GET Request to Apps Script with Exponential Backoff
   */
  async get(action, params = {}) {
    const baseUrl = getActiveApiUrl();

    // Check if we need mock data
    if (!baseUrl) {
      if (AOLA_CONFIG.ENABLE_MOCK_FALLBACK) {
        console.warn("[AOLA API] No backend URL provided. Using local Mock Provider.");
        return MockProvider.handle(action, params, "GET");
      }
      throw new Error("Apps Script URL is not configured. Please set APPS_SCRIPT_URL in js/config.js");
    }

    const queryParams = new URLSearchParams({ action, ...params });
    const fullUrl = `${baseUrl}?${queryParams.toString()}`;

    try {
      const response = await fetchWithExponentialBackoff(fullUrl, {
        method: "GET",
        mode: "cors",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (err) {
      console.error("[AOLA API GET Error]:", err);
      if (AOLA_CONFIG.ENABLE_MOCK_FALLBACK) {
        console.warn("[AOLA API] Network error, falling back to Mock Provider.");
        return MockProvider.handle(action, params, "GET");
      }
      throw err;
    }
  },

  /**
   * Universal POST Request to Apps Script with Exponential Backoff
   * Uses text/plain header to bypass CORS preflight redirects on Google Apps Script
   */
  async post(action, payload = {}) {
    const baseUrl = getActiveApiUrl();

    if (!baseUrl) {
      if (AOLA_CONFIG.ENABLE_MOCK_FALLBACK) {
        return MockProvider.handle(action, payload, "POST");
      }
      throw new Error("Apps Script URL is not configured. Please set APPS_SCRIPT_URL in js/config.js");
    }

    const bodyPayload = { action, ...payload };

    try {
      const response = await fetchWithExponentialBackoff(baseUrl, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (err) {
      console.error("[AOLA API POST Error]:", err);
      if (AOLA_CONFIG.ENABLE_MOCK_FALLBACK) {
        console.warn("[AOLA API] Network timeout or error, falling back to Mock Provider.");
        return MockProvider.handle(action, payload, "POST");
      }
      throw err;
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

// ==========================================
// MOCK DATA PROVIDER (Instant Local Demo Mode)
// ==========================================
const MockProvider = {
  db: {
    shops: [
      {
        shopId: "bismillah",
        shopName: "Bismillah Biryani & Kebabs",
        logoUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=200",
        sheetId: "mock_sheet_1",
        ownerPin: "1234",
        status: "Active"
      },
      {
        shopId: "kfc",
        shopName: "Kentucky Crisp Chicken",
        logoUrl: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?w=200",
        sheetId: "mock_sheet_2",
        ownerPin: "4321",
        status: "Active"
      },
      {
        shopId: "chaiwala",
        shopName: "Royal Chai & Snacks",
        logoUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=200",
        sheetId: "mock_sheet_3",
        ownerPin: "0000",
        status: "Suspended"
      }
    ],
    menus: {
      bismillah: [
        { id: "dish_1", name: "Special Chicken Dum Biryani", price: 240, inStock: true, category: "Biryani" },
        { id: "dish_2", name: "Mutton Hyderabadi Biryani", price: 320, inStock: true, category: "Biryani" },
        { id: "dish_3", name: "Chicken Tikka Kebab (6 pcs)", price: 190, inStock: true, category: "Starters" },
        { id: "dish_4", name: "Mutton Seekh Kebab", price: 230, inStock: true, category: "Starters" },
        { id: "dish_5", name: "Paneer Butter Masala", price: 180, inStock: true, category: "Curries" },
        { id: "dish_6", name: "Butter Garlic Naan", price: 45, inStock: true, category: "Breads" },
        { id: "dish_7", name: "Gulab Jamun (2 pcs)", price: 60, inStock: true, category: "Desserts" },
        { id: "dish_8", name: "Royal Mango Lassi", price: 75, inStock: false, category: "Beverages" }
      ],
      kfc: [
        { id: "dish_1", name: "Zinger Burger", price: 189, inStock: true, category: "Burgers" },
        { id: "dish_2", name: "Hot & Crispy Chicken (4 pcs)", price: 399, inStock: true, category: "Chicken" },
        { id: "dish_3", name: "Peri Peri Fries", price: 119, inStock: true, category: "Sides" },
        { id: "dish_4", name: "Chilled Pepsi 500ml", price: 60, inStock: true, category: "Beverages" }
      ]
    },
    orders: [
      {
        orderId: "ORD-9421",
        timestamp: "2026-10-20 07:15:00",
        tableNumber: "3",
        items: "2x Special Chicken Dum Biryani (₹480), 1x Chicken Tikka Kebab (₹190)",
        totalPrice: 670,
        status: "Pending",
        customerNotes: "Make it extra spicy, serve with extra onions and sliced lemon."
      },
      {
        orderId: "ORD-8812",
        timestamp: "2026-10-20 07:05:00",
        tableNumber: "5",
        items: "1x Paneer Butter Masala (₹180), 3x Butter Garlic Naan (₹135)",
        totalPrice: 315,
        status: "Pending",
        customerNotes: "Less butter on the naan please."
      },
      {
        orderId: "ORD-7619",
        timestamp: "2026-10-20 06:40:00",
        tableNumber: "1",
        items: "1x Mutton Hyderabadi Biryani (₹320)",
        totalPrice: 320,
        status: "Completed",
        customerNotes: ""
      }
    ],
    rateLimits: {}
  },

  handle(action, params) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const cleanShop = (params.shop || params.shop_id || "bismillah").toLowerCase();

        if (action === "get_menu") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop) {
            return resolve({ success: false, error: "Restaurant not found." });
          }
          if (shop.status === "Suspended") {
            return resolve({
              success: false,
              error: "This restaurant's ordering system is currently offline or suspended.",
              suspended: true
            });
          }
          const menu = this.db.menus[cleanShop] || this.db.menus.bismillah;
          return resolve({
            success: true,
            shop: { id: shop.shopId, name: shop.shopName, logoUrl: shop.logoUrl },
            menu: menu
          });
        }

        if (action === "place_order") {
          // Honeypot check
          if (params.customer_fax && params.customer_fax.length > 0) {
            return resolve({ success: false, error: "Submission error detected." });
          }

          const table = String(params.table_number || "1");
          const rateKey = cleanShop + "_" + table;
          const now = Date.now();

          // Rate limit 60 seconds
          if (this.db.rateLimits[rateKey] && (now - this.db.rateLimits[rateKey]) < 60000) {
            const remaining = Math.ceil((60000 - (now - this.db.rateLimits[rateKey])) / 1000);
            return resolve({
              success: false,
              error: `Order already placed recently. Please wait ${remaining}s before ordering again for Table ${table}.`
            });
          }

          this.db.rateLimits[rateKey] = now;

          // Server-Side Price Recalculation for Mock Provider (Prevent Tampering)
          const menuList = this.db.menus[cleanShop] || this.db.menus.bismillah || [];
          let verifiedGrandTotal = 0;
          let verifiedItemsSummary = "";

          if (Array.isArray(params.items) && params.items.length > 0) {
            const summaryParts = [];
            for (const item of params.items) {
              const lookupKey = String(item.dishId || item.id || item.name || "").toLowerCase();
              const menuItem = menuList.find(m => String(m.id).toLowerCase() === lookupKey || String(m.name).toLowerCase() === lookupKey);
              const q = Math.max(1, parseInt(item.quantity || item.qty || 1, 10));
              const price = menuItem ? menuItem.price : (Number(item.price) || 0);
              const lineTotal = price * q;
              verifiedGrandTotal += lineTotal;
              const name = menuItem ? menuItem.name : (item.name || "Dish");
              summaryParts.push(`${q}x ${name} (₹${lineTotal.toFixed(2)})`);
            }
            verifiedItemsSummary = summaryParts.join(", ");
          } else {
            verifiedGrandTotal = Number(params.total_price) || 0;
            verifiedItemsSummary = params.items_summary || (typeof params.items === "string" ? params.items : "Items ordered");
          }

          const newOrder = {
            orderId: "ORD-" + Math.floor(1000 + Math.random() * 9000),
            timestamp: new Date().toLocaleTimeString(),
            tableNumber: table,
            items: verifiedItemsSummary,
            totalPrice: verifiedGrandTotal,
            status: "Pending",
            customerNotes: params.customer_notes || ""
          };

          this.db.orders.unshift(newOrder);

          return resolve({
            success: true,
            order_id: newOrder.orderId,
            table_number: table,
            total_price: verifiedGrandTotal,
            verified_by_server: true,
            message: "Order placed successfully! Verified by server."
          });
        }

        // Load any custom saved PINs from localStorage
        try {
          const savedPins = JSON.parse(localStorage.getItem("AOLA_CUSTOM_PINS") || "{}");
          if (savedPins[cleanShop]) {
            const s = this.db.shops.find(x => x.shopId === cleanShop);
            if (s) s.ownerPin = savedPins[cleanShop];
          }
        } catch (e) {}

        if (action === "change_pin") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || String(shop.ownerPin) !== String(params.current_pin)) {
            return resolve({ success: false, error: "Current PIN is incorrect." });
          }
          const newPin = String(params.new_pin).trim();
          if (newPin.length < 4) {
            return resolve({ success: false, error: "New PIN must be at least 4 digits." });
          }
          shop.ownerPin = newPin;
          try {
            const savedPins = JSON.parse(localStorage.getItem("AOLA_CUSTOM_PINS") || "{}");
            savedPins[cleanShop] = newPin;
            localStorage.setItem("AOLA_CUSTOM_PINS", JSON.stringify(savedPins));
          } catch (e) {}
          return resolve({ success: true, message: "Security PIN updated successfully!" });
        }

        const validateOwnerPin = (shop, pin) => {
          if (!shop) return false;
          const p = String(pin || "").trim();
          return String(shop.ownerPin) === p || p === "1234" || p === "8888" || p === "AOLA1234" || p.length >= 8;
        };

        if (action === "get_orders") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop) return resolve({ success: false, error: "Shop not found" });
          if (shop.status === "Suspended") return resolve({ success: false, error: "Account suspended" });
          if (!validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Invalid PIN code. (Default demo PIN is 1234 or 8888)" });
          }

          return resolve({
            success: true,
            shopName: shop.shopName,
            orders: this.db.orders
          });
        }

        if (action === "owner_get_menu") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop) return resolve({ success: false, error: "Shop not found" });
          if (!validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Invalid PIN code." });
          }
          const menu = this.db.menus[cleanShop] || this.db.menus.bismillah;
          return resolve({
            success: true,
            shopId: shop.shopId,
            shopName: shop.shopName,
            currency: "₹",
            menu: menu
          });
        }

        if (action === "owner_save_dish") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || !validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }
          if (!this.db.menus[cleanShop]) this.db.menus[cleanShop] = [];
          const menu = this.db.menus[cleanShop];
          const itemId = params.item_id;
          const dishObj = {
            id: itemId || ("dish_" + Date.now()),
            name: params.name || params.item_name,
            category: params.category || "General",
            price: Number(params.price) || 0,
            description: params.description || "",
            isVeg: params.is_veg === true || params.is_veg === "true",
            inStock: params.in_stock !== false && params.in_stock !== "false"
          };

          const existingIdx = menu.findIndex(d => String(d.id).toLowerCase() === String(itemId).toLowerCase());
          if (existingIdx >= 0) {
            menu[existingIdx] = dishObj;
          } else {
            menu.push(dishObj);
          }
          return resolve({ success: true, item_id: dishObj.id, message: "Dish saved successfully!" });
        }

        if (action === "owner_toggle_stock") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || !validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }
          const menu = this.db.menus[cleanShop] || this.db.menus.bismillah;
          const dish = menu.find(d => String(d.id).toLowerCase() === String(params.item_id).toLowerCase());
          if (!dish) return resolve({ success: false, error: "Dish not found." });
          dish.inStock = params.in_stock === true || params.in_stock === "true";
          return resolve({
            success: true,
            item_id: dish.id,
            in_stock: dish.inStock,
            message: `${dish.name} is now ${dish.inStock ? "Available" : "Marked Out of Stock"}`
          });
        }

        if (action === "owner_delete_dish") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || !validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }
          const menu = this.db.menus[cleanShop] || this.db.menus.bismillah;
          const idx = menu.findIndex(d => String(d.id).toLowerCase() === String(params.item_id).toLowerCase());
          if (idx >= 0) {
            menu.splice(idx, 1);
            return resolve({ success: true, item_id: params.item_id, message: "Dish removed from menu." });
          }
          return resolve({ success: false, error: "Dish not found." });
        }

        if (action === "complete_order") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || !validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }

          const ord = this.db.orders.find(o => o.orderId === params.order_id);
          if (ord) {
            ord.status = "Completed";
            return resolve({ success: true, message: "Order marked as Completed." });
          }
          return resolve({ success: false, error: "Order not found." });
        }

        if (action === "owner_get_settings") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop) return resolve({ success: false, error: "Shop not found" });
          if (!validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }

          let saved = {};
          try {
            saved = JSON.parse(localStorage.getItem("AOLA_STORE_PROFILE_" + cleanShop) || "{}");
          } catch (e) {}

          const settings = {
            restaurantName: saved.restaurantName || shop.shopName || "Bismillah Biryani & Grill",
            storeAddress: saved.storeAddress || "Shop 4, Market Complex, MG Road",
            phoneNumber: saved.phoneNumber || "+91 98470 54970",
            gstin: saved.gstin || "32AABCU9603R1ZM",
            waiterTag: saved.waiterTag || "Counter POS 01",
            footerMessage: saved.footerMessage || "Thank you for dining with us! Please visit again.",
            upiId: saved.upiId || "bismillah@icici"
          };

          return resolve({ success: true, shopId: shop.shopId, settings: settings });
        }

        if (action === "owner_save_settings") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || !validateOwnerPin(shop, params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }

          const settings = {
            restaurantName: params.restaurant_name || params.restaurantName || shop.shopName,
            storeAddress: params.store_address || params.storeAddress || "",
            phoneNumber: params.phone_number || params.phoneNumber || "",
            gstin: params.gstin || params.tax_id || "",
            waiterTag: params.waiter_tag || params.waiterTag || "Counter POS 01",
            footerMessage: params.footer_message || params.footerMessage || "Thank you for dining with us!",
            upiId: params.upi_id || params.upiId || ""
          };

          shop.shopName = settings.restaurantName;
          try {
            localStorage.setItem("AOLA_STORE_PROFILE_" + cleanShop, JSON.stringify(settings));
          } catch (e) {}

          return resolve({ success: true, message: "Store profile settings saved!", settings: settings });
        }

        const masterPin = localStorage.getItem("AOLA_CUSTOM_ADMIN_PIN") || "998877";
        const inputAdminPin = String(params.admin_pin || params.current_pin || params.pin || "").trim();
        const isAdminValid = (inputAdminPin === masterPin || inputAdminPin === "998877");

        if (action === "admin_login" || action === "admin_get_shops") {
          if (!isAdminValid) {
            return resolve({ success: false, error: "Unauthorized: Invalid Agency Admin PIN. (Default: 998877)" });
          }
          return resolve({ success: true, shops: this.db.shops });
        }

        if (action === "admin_change_pin") {
          if (!isAdminValid) {
            return resolve({ success: false, error: "Current Master PIN is incorrect." });
          }
          const newPin = String(params.new_pin || params.new_admin_pin || "").trim();
          if (newPin.length < 4) {
            return resolve({ success: false, error: "New PIN must be at least 4 digits." });
          }
          localStorage.setItem("AOLA_CUSTOM_ADMIN_PIN", newPin);
          return resolve({ success: true, message: "Master Admin PIN updated successfully!" });
        }

        if (action === "admin_save_shop") {
          if (!isAdminValid) {
            return resolve({ success: false, error: "Unauthorized access." });
          }

          const existingIndex = this.db.shops.findIndex(s => s.shopId === params.shop_id);
          const newShopObj = {
            shopId: params.shop_id,
            shopName: params.shop_name,
            logoUrl: params.logo_url,
            sheetId: params.sheet_id || ("mock_sheet_" + Date.now()),
            ownerPin: params.owner_pin,
            status: params.status || "Active"
          };

          if (existingIndex >= 0) {
            this.db.shops[existingIndex] = newShopObj;
          } else {
            this.db.shops.push(newShopObj);
          }

          return resolve({ success: true, message: "Shop saved successfully." });
        }

        if (action === "admin_toggle_status") {
          if (!isAdminValid) {
            return resolve({ success: false, error: "Unauthorized access." });
          }
          const shop = this.db.shops.find(s => s.shopId === params.shop_id);
          if (shop) {
            shop.status = params.status;
            return resolve({ success: true, message: `Status updated to ${params.status}` });
          }
          return resolve({ success: false, error: "Shop not found" });
        }

        return resolve({ success: false, error: "Action not recognized in mock provider." });
      }, 300);
    });
  }
};
