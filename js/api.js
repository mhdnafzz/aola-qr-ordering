/**
 * AOLA - API Client & Data Transport Layer
 * Handles communication with Google Apps Script Web App & Mock Fallbacks
 */

const AOLA_API = {
  /**
   * Universal GET Request to Apps Script
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for Apps Script cold starts

      const response = await fetch(fullUrl, {
        method: "GET",
        mode: "cors",
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

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
   * Universal POST Request to Apps Script
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for Apps Script cold starts

      const response = await fetch(baseUrl, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(bodyPayload)
      });
      clearTimeout(timeoutId);

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
        items: "2x Special Chicken Dum Biryani (₹240), 1x Chicken Tikka Kebab (₹190) [Notes: Spicy]",
        totalPrice: 670,
        status: "Pending"
      },
      {
        orderId: "ORD-8812",
        timestamp: "2026-10-20 07:05:00",
        tableNumber: "5",
        items: "1x Paneer Butter Masala (₹180), 3x Butter Garlic Naan (₹45)",
        totalPrice: 315,
        status: "Pending"
      },
      {
        orderId: "ORD-7619",
        timestamp: "2026-10-20 06:40:00",
        tableNumber: "1",
        items: "1x Mutton Hyderabadi Biryani (₹320)",
        totalPrice: 320,
        status: "Completed"
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

          const newOrder = {
            orderId: "ORD-" + Math.floor(1000 + Math.random() * 9000),
            timestamp: new Date().toLocaleString(),
            tableNumber: table,
            items: params.itemsSummary || (typeof params.items === "string" ? params.items : "Items ordered"),
            totalPrice: Number(params.total_price) || 0,
            status: "Pending"
          };

          this.db.orders.unshift(newOrder);

          return resolve({
            success: true,
            order_id: newOrder.orderId,
            table_number: table,
            total_price: newOrder.totalPrice,
            message: "Order placed successfully!"
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

        if (action === "get_orders") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop) return resolve({ success: false, error: "Shop not found" });
          if (shop.status === "Suspended") return resolve({ success: false, error: "Account suspended" });
          if (String(shop.ownerPin) !== String(params.pin)) {
            return resolve({ success: false, error: "Invalid PIN code. (Default demo PIN is 1234)" });
          }

          return resolve({
            success: true,
            shopName: shop.shopName,
            orders: this.db.orders
          });
        }

        if (action === "complete_order") {
          const shop = this.db.shops.find(s => s.shopId === cleanShop);
          if (!shop || String(shop.ownerPin) !== String(params.pin)) {
            return resolve({ success: false, error: "Unauthorized PIN." });
          }

          const ord = this.db.orders.find(o => o.orderId === params.order_id);
          if (ord) {
            ord.status = "Completed";
            return resolve({ success: true, message: "Order marked as Completed." });
          }
          return resolve({ success: false, error: "Order not found." });
        }

        const masterPin = localStorage.getItem("AOLA_CUSTOM_ADMIN_PIN") || "998877";
        const inputAdminPin = String(params.admin_pin || params.pin || "").trim();
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
          const newPin = String(params.new_pin).trim();
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
            sheetId: params.sheet_id,
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
