/**
 * AOLA - Kitchen Display & Owner Dashboard Controller (owner.html)
 * Includes Live KDS Tickets & Menu Management (Add, Edit, Toggle Stock, Delete)
 */

(function () {
  const state = {
    shopId: "",
    pin: "",
    orders: [],
    activeTab: "pending", // "pending" | "completed"
    currentView: "orders", // "orders" | "menu"
    menu: [],
    currency: "₹",
    menuFilterCategory: "all",
    menuSearchQuery: "",
    pollTimer: null,
    knownOrderIds: new Set(),
    isInitialLoad: true
  };

  const el = {
    // Auth & Navigation
    loginOverlay: document.getElementById("login-overlay"),
    loginShopId: document.getElementById("login-shop-id"),
    loginPin: document.getElementById("login-pin"),
    loginForm: document.getElementById("owner-login-form"),
    btnLoginSubmit: document.getElementById("btn-login-submit"),
    dashboardContainer: document.getElementById("dashboard-container"),
    ownerShopName: document.getElementById("owner-shop-name"),
    ownerShopTag: document.getElementById("owner-shop-tag"),
    pollIndicator: document.getElementById("poll-indicator"),
    lastSyncTime: document.getElementById("last-sync-time"),
    btnManualRefresh: document.getElementById("btn-manual-refresh"),
    btnLogout: document.getElementById("btn-logout"),

    // View Switcher Tabs
    viewTabOrders: document.getElementById("view-tab-orders"),
    viewTabMenu: document.getElementById("view-tab-menu"),
    menuViewActions: document.getElementById("menu-view-actions"),
    btnRefreshMenu: document.getElementById("btn-refresh-menu"),
    btnOpenAddDish: document.getElementById("btn-open-add-dish"),
    sectionOrdersView: document.getElementById("section-orders-view"),
    sectionMenuView: document.getElementById("section-menu-view"),
    countMenuItems: document.getElementById("count-menu-items"),

    // Kitchen Tickets View
    tabPending: document.getElementById("tab-pending"),
    tabCompleted: document.getElementById("tab-completed"),
    countPending: document.getElementById("count-pending"),
    countCompleted: document.getElementById("count-completed"),
    ticketGrid: document.getElementById("ticket-grid"),
    chkAudio: document.getElementById("chk-audio"),
    btnTogglePinVisibility: document.getElementById("btn-toggle-pin-visibility"),

    // Menu Management View
    ownerMenuCats: document.getElementById("owner-menu-cats"),
    ownerMenuSearch: document.getElementById("owner-menu-search"),
    ownerMenuTbody: document.getElementById("owner-menu-tbody"),

    // Add / Edit Dish Modal
    dishModal: document.getElementById("dish-modal"),
    dishModalTitle: document.getElementById("dish-modal-title"),
    btnCloseDishModal: document.getElementById("btn-close-dish-modal"),
    dishForm: document.getElementById("dish-form"),
    dishFormId: document.getElementById("dish-form-id"),
    dishFormName: document.getElementById("dish-form-name"),
    dishFormCategory: document.getElementById("dish-form-category"),
    dishFormPrice: document.getElementById("dish-form-price"),
    dishFormDesc: document.getElementById("dish-form-desc"),
    dishFormIsVeg: document.getElementById("dish-form-is-veg"),
    dishFormInStock: document.getElementById("dish-form-in-stock"),
    btnSaveDishSubmit: document.getElementById("btn-save-dish-submit"),

    // Change PIN Modal
    btnOpenChangePin: document.getElementById("btn-open-change-pin"),
    changePinModal: document.getElementById("change-pin-modal"),
    btnCloseChangePin: document.getElementById("btn-close-change-pin"),
    changePinForm: document.getElementById("change-pin-form"),
    inputCurrentPin: document.getElementById("input-current-pin"),
    inputNewPin: document.getElementById("input-new-pin"),
    inputConfirmPin: document.getElementById("input-confirm-pin"),
    btnSubmitChangePin: document.getElementById("btn-submit-change-pin"),

    // Billing & Thermal Printing System
    printableReceiptWrapper: document.getElementById("printable-receipt-wrapper"),
    printableReceipt: document.getElementById("printable-receipt"),
    billModal: document.getElementById("bill-modal"),
    btnCloseBillModal: document.getElementById("btn-close-bill-modal"),
    btnCancelBillModal: document.getElementById("btn-cancel-bill-modal"),
    btnTriggerPrint: document.getElementById("btn-trigger-print"),
    btnBillWhatsapp: document.getElementById("btn-bill-whatsapp"),
    btnBillTypeCustomer: document.getElementById("btn-bill-type-customer"),
    btnBillTypeKot: document.getElementById("btn-bill-type-kot"),
    billPaymentMode: document.getElementById("bill-payment-mode"),
    billTaxRate: document.getElementById("bill-tax-rate"),
    billDiscountAmount: document.getElementById("bill-discount-amount"),
    billPreviewCard: document.getElementById("bill-preview-card"),
    btnHeaderPrintLast: document.getElementById("btn-header-print-last")
  };

  /**
   * Sound Chime using Web Audio API (No external sound files required)
   */
  function playNewOrderSound() {
    if (!el.chkAudio || !el.chkAudio.checked) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Audio autoplay blocked or unsupported:", e);
    }
  }

  // Active Billing & Invoice State
  const billState = {
    order: null,
    isKot: false,
    paymentMode: "Paid (UPI / Online)",
    taxRate: 5,
    discountAmount: 0
  };

  /**
   * Restaurant Thermal Receipt & KOT Builder (Standard 80mm POS Format)
   */
  function buildThermalReceiptHtml(order, isKot, options = {}) {
    if (!order) return `<div style="text-align:center;padding:20px;color:#64748B;">No order selected.</div>`;

    const restaurantName = escapeHtml((state.shopName || "AOLA RESTAURANT").toUpperCase());
    const orderId = escapeHtml(order.orderId || "ORD");
    const tableNum = escapeHtml(order.tableNumber || "1");
    const formattedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const formattedTime = formatTicketTime(order.timestamp);
    const paymentMode = escapeHtml(options.paymentMode || "Paid (UPI / Online)");
    const taxRate = typeof options.taxRate === "number" ? options.taxRate : 5;
    const discountInput = typeof options.discountAmount === "number" ? options.discountAmount : 0;

    const dishList = parseOrderDishItems(order.items);
    let subtotal = 0;

    const rowsHtml = dishList.map(dish => {
      const qty = dish.qty || 1;
      let lineTotal = dish.rawPrice || 0;
      if (!lineTotal && dish.price) {
        lineTotal = parseFloat(String(dish.price).replace(/[^0-9.]/g, "")) || 0;
      }
      const unitRate = (qty > 0 && lineTotal > 0) ? (lineTotal / qty) : lineTotal;
      subtotal += lineTotal;

      return `
        <tr>
          <td style="text-align:left; padding-right:6px;">
            <strong>${escapeHtml(dish.name)}</strong>
            ${dish.note ? `<span class="receipt-item-note">Note: ${escapeHtml(dish.note)}</span>` : ""}
          </td>
          <td style="text-align:center;">${qty}</td>
          ${!isKot ? `
            <td style="text-align:right;">${unitRate > 0 ? (state.currency + unitRate.toFixed(2)) : "-"}</td>
            <td style="text-align:right; font-weight:700;">${lineTotal > 0 ? (state.currency + lineTotal.toFixed(2)) : "-"}</td>
          ` : ""}
        </tr>
      `;
    }).join("");

    if (subtotal <= 0 && order.totalPrice) {
      subtotal = parseFloat(order.totalPrice) || 0;
    }

    const discount = Math.min(subtotal, Math.max(0, discountInput));
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = (taxRate > 0) ? (taxable * (taxRate / 100)) : 0;
    const grandTotal = Math.max(0, taxable + taxAmount);
    const totalQty = dishList.reduce((sum, d) => sum + (d.qty || 1), 0);

    return `
      <div class="receipt-header">
        <div class="receipt-brand-title">${restaurantName}</div>
        <div class="receipt-subtitle">${isKot ? "*** KITCHEN ORDER TICKET (KOT) ***" : "TAX INVOICE / CASH BILL"}</div>
        <div class="receipt-tagline">${isKot ? "Kitchen Preparation Docket" : "Smart QR Self-Order &bull; Table Dining"}</div>
      </div>

      <div class="receipt-divider">------------------------------------------------</div>

      <div class="receipt-meta-grid">
        <div><strong>Bill No:</strong> #${orderId}</div>
        <div style="text-align:right;"><strong>Date:</strong> ${formattedDate}</div>
        <div><span class="receipt-table-highlight">TABLE ${tableNum}</span></div>
        <div style="text-align:right;"><strong>Time:</strong> ${formattedTime}</div>
        ${!isKot ? `
          <div><strong>Payment:</strong> ${paymentMode}</div>
          <div style="text-align:right;"><strong>Counter:</strong> POS 01</div>
        ` : `
          <div style="grid-column: 1 / -1; font-weight:700; color:#000;">DINE-IN ORDER &bull; EXPRESS KITCHEN</div>
        `}
      </div>

      <div class="receipt-divider double"></div>

      <table class="receipt-items-table">
        <thead>
          <tr>
            <th style="text-align:left; width:${isKot ? '80%' : '48%'};">ITEM</th>
            <th style="text-align:center; width:14%;">QTY</th>
            ${!isKot ? `
              <th style="text-align:right; width:18%;">RATE</th>
              <th style="text-align:right; width:20%;">TOTAL</th>
            ` : ""}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="${isKot ? 2 : 4}" style="text-align:center;">No items recorded</td></tr>`}
        </tbody>
      </table>

      <div class="receipt-divider">------------------------------------------------</div>

      ${!isKot ? `
        <div class="receipt-totals-grid">
          <div class="receipt-total-row">
            <span>Total Items: ${dishList.length} (Qty: ${totalQty})</span>
            <span>Subtotal: ${state.currency}${subtotal.toFixed(2)}</span>
          </div>
          ${discount > 0 ? `
            <div class="receipt-total-row" style="color:#DC2626;">
              <span>Special Discount:</span>
              <span>-${state.currency}${discount.toFixed(2)}</span>
            </div>
          ` : ""}
          ${taxAmount > 0 ? `
            <div class="receipt-total-row">
              <span>GST (${taxRate}%):</span>
              <span>+${state.currency}${taxAmount.toFixed(2)}</span>
            </div>
          ` : ""}
          <div class="receipt-divider double"></div>
          <div class="receipt-grand-total">
            <span>GRAND TOTAL</span>
            <span>${state.currency}${grandTotal.toFixed(2)}</span>
          </div>
          <div class="receipt-divider double"></div>
        </div>
      ` : `
        <div class="receipt-kot-summary">
          *** TOTAL DISHES: ${dishList.length} (QTY: ${totalQty}) ***
        </div>
      `}

      ${order.customerNotes ? `
        <div class="receipt-notes-box">
          <strong style="text-transform:uppercase; font-size:0.75rem;">Kitchen Instructions:</strong>
          <div style="margin-top:2px;">${escapeHtml(order.customerNotes)}</div>
        </div>
      ` : ""}

      <div class="receipt-footer">
        ${!isKot ? `
          <div>Thank you for dining with us!</div>
          <div>Please visit us again soon.</div>
          <div class="receipt-powered">Powered by AOLA Smart QR Ordering</div>
        ` : `
          <div>*** DISPATCH TO TABLE ${tableNum} WHEN READY ***</div>
        `}
      </div>
    `;
  }

  /**
   * Update the live preview card in the modal and sync to the print container
   */
  function updateBillPreview() {
    if (!billState.order) return;
    const html = buildThermalReceiptHtml(billState.order, billState.isKot, billState);
    if (el.billPreviewCard) el.billPreviewCard.innerHTML = html;
    if (el.printableReceipt) el.printableReceipt.innerHTML = html;
  }

  /**
   * Open the Billing & Invoice Modal for a specific order
   */
  function openBillModal(orderId, isKot = false) {
    const order = state.orders.find(o => String(o.orderId) === String(orderId));
    if (!order) {
      showToast("Order #" + orderId + " not found.", "error");
      return;
    }

    billState.order = order;
    billState.isKot = isKot;

    if (el.btnBillTypeCustomer) el.btnBillTypeCustomer.classList.toggle("active", !isKot);
    if (el.btnBillTypeKot) el.btnBillTypeKot.classList.toggle("active", isKot);

    updateBillPreview();
    if (el.billModal) el.billModal.classList.add("open");
  }

  function closeBillModal() {
    if (el.billModal) el.billModal.classList.remove("open");
  }

  /**
   * Triggers the browser print dialog cleanly formatted for POS receipts
   */
  function triggerPrintReceipt() {
    updateBillPreview();
    window.print();
  }

  /**
   * Instant 1-Click Print KOT for the kitchen
   */
  function quickPrintKot(orderId) {
    const order = state.orders.find(o => String(o.orderId) === String(orderId));
    if (!order) {
      showToast("Order not found.", "error");
      return;
    }
    billState.order = order;
    billState.isKot = true;
    updateBillPreview();
    window.print();
    showToast("Printing Kitchen KOT for Table " + order.tableNumber + "...", "info");
  }

  /**
   * Share the Order Bill via WhatsApp
   */
  function shareBillWhatsapp() {
    const ord = billState.order;
    if (!ord) return;
    const dishList = parseOrderDishItems(ord.items);
    const itemsText = dishList.map(d => `• ${d.qty}x ${d.name} ${d.price ? `(${d.price})` : ""}`).join("\n");
    const subtotal = ord.totalPrice || 0;
    const discount = billState.discountAmount || 0;
    const tax = (subtotal - discount) * (billState.taxRate / 100);
    const grandTotal = Math.max(0, subtotal - discount + tax);

    const text = `🧾 *${(state.shopName || "AOLA RESTAURANT").toUpperCase()}*\n` +
      `*Order Bill #${ord.orderId}*\n` +
      `🍽️ Table: ${ord.tableNumber} | ⏰ ${formatTicketTime(ord.timestamp)}\n` +
      `💳 Payment: ${billState.paymentMode}\n` +
      `--------------------------------\n` +
      `*ITEMS:*\n${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal: ${state.currency}${subtotal.toFixed(2)}\n` +
      (billState.taxRate > 0 ? `GST (${billState.taxRate}%): +${state.currency}${tax.toFixed(2)}\n` : "") +
      (discount > 0 ? `Discount: -${state.currency}${discount.toFixed(2)}\n` : "") +
      `*GRAND TOTAL: ${state.currency}${grandTotal.toFixed(2)}*\n` +
      `--------------------------------\n` +
      (ord.customerNotes ? `Note: ${ord.customerNotes}\n--------------------------------\n` : "") +
      `Thank you for dining with us! 🙏`;

    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(text), "_blank");
  }

  /**
   * View the latest order's bill
   */
  function openLatestBill() {
    if (!state.orders || state.orders.length === 0) {
      showToast("No orders available right now to bill.", "info");
      return;
    }
    openBillModal(state.orders[0].orderId, false);
  }

  /**
   * Initialize Owner Dashboard
   */
  function init() {
    const urlShop = getUrlParam("shop");
    if (urlShop) {
      el.loginShopId.value = urlShop.toLowerCase().trim();
    } else if (!el.loginShopId.value) {
      el.loginShopId.value = "bismillah";
    }

    if (el.btnTogglePinVisibility) {
      el.btnTogglePinVisibility.onclick = () => {
        const isPassword = el.loginPin.type === "password";
        el.loginPin.type = isPassword ? "text" : "password";
        el.btnTogglePinVisibility.innerHTML = isPassword
          ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i>`
          : `<i data-lucide="eye" style="width:16px;height:16px;"></i>`;
        if (window.lucide) lucide.createIcons();
      };
    }

    const savedShop = sessionStorage.getItem("AOLA_OWNER_SHOP");
    const savedPin = sessionStorage.getItem("AOLA_OWNER_PIN");

    if (savedShop && savedPin) {
      state.shopId = savedShop;
      state.pin = savedPin;
      performLogin();
    }

    setupEvents();
  }

  function setupEvents() {
    el.loginForm.onsubmit = handleLoginSubmit;
    el.btnLogout.onclick = logout;
    el.btnManualRefresh.onclick = () => {
      fetchOrders(true);
    };

    // View Switcher (Tickets vs Menu)
    if (el.viewTabOrders) {
      el.viewTabOrders.onclick = () => switchView("orders");
    }
    if (el.viewTabMenu) {
      el.viewTabMenu.onclick = () => switchView("menu");
    }

    // Menu Actions
    if (el.btnRefreshMenu) {
      el.btnRefreshMenu.onclick = () => fetchOwnerMenu(true);
    }
    if (el.btnOpenAddDish) {
      el.btnOpenAddDish.onclick = openAddDishModal;
    }
    if (el.btnCloseDishModal) {
      el.btnCloseDishModal.onclick = closeDishModal;
    }
    if (el.dishModal) {
      el.dishModal.onclick = (e) => {
        if (e.target === el.dishModal) closeDishModal();
      };
    }
    if (el.dishForm) {
      el.dishForm.onsubmit = handleSaveDishSubmit;
    }
    if (el.ownerMenuSearch) {
      el.ownerMenuSearch.oninput = (e) => {
        state.menuSearchQuery = e.target.value.toLowerCase().trim();
        renderOwnerMenu();
      };
    }

    // Change PIN Modal
    if (el.btnOpenChangePin) {
      el.btnOpenChangePin.onclick = () => {
        el.changePinForm.reset();
        el.inputCurrentPin.value = state.pin || "";
        el.changePinModal.classList.add("open");
      };
    }

    if (el.btnCloseChangePin) {
      el.btnCloseChangePin.onclick = () => {
        el.changePinModal.classList.remove("open");
      };
    }

    if (el.changePinModal) {
      el.changePinModal.onclick = (e) => {
        if (e.target === el.changePinModal) el.changePinModal.classList.remove("open");
      };
    }

    if (el.changePinForm) {
      el.changePinForm.onsubmit = handleChangePinSubmit;
    }

    // Orders Filter Tabs
    el.tabPending.onclick = () => {
      state.activeTab = "pending";
      el.tabPending.classList.add("active");
      el.tabCompleted.classList.remove("active");
      renderTickets();
    };

    el.tabCompleted.onclick = () => {
      state.activeTab = "completed";
      el.tabCompleted.classList.add("active");
      el.tabPending.classList.remove("active");
      renderTickets();
    };

    // Bill & Invoice Modal Events
    if (el.btnCloseBillModal) el.btnCloseBillModal.onclick = closeBillModal;
    if (el.btnCancelBillModal) el.btnCancelBillModal.onclick = closeBillModal;
    if (el.billModal) {
      el.billModal.onclick = (e) => {
        if (e.target === el.billModal) closeBillModal();
      };
    }
    if (el.btnTriggerPrint) el.btnTriggerPrint.onclick = triggerPrintReceipt;
    if (el.btnBillWhatsapp) el.btnBillWhatsapp.onclick = shareBillWhatsapp;
    if (el.btnHeaderPrintLast) el.btnHeaderPrintLast.onclick = openLatestBill;

    if (el.btnBillTypeCustomer) {
      el.btnBillTypeCustomer.onclick = () => {
        billState.isKot = false;
        el.btnBillTypeCustomer.classList.add("active");
        el.btnBillTypeKot.classList.remove("active");
        updateBillPreview();
      };
    }

    if (el.btnBillTypeKot) {
      el.btnBillTypeKot.onclick = () => {
        billState.isKot = true;
        el.btnBillTypeKot.classList.add("active");
        el.btnBillTypeCustomer.classList.remove("active");
        updateBillPreview();
      };
    }

    if (el.billPaymentMode) {
      el.billPaymentMode.onchange = (e) => {
        billState.paymentMode = e.target.value;
        updateBillPreview();
      };
    }

    if (el.billTaxRate) {
      el.billTaxRate.onchange = (e) => {
        billState.taxRate = parseFloat(e.target.value) || 0;
        updateBillPreview();
      };
    }

    if (el.billDiscountAmount) {
      el.billDiscountAmount.oninput = (e) => {
        billState.discountAmount = parseFloat(e.target.value) || 0;
        updateBillPreview();
      };
    }
  }

  /**
   * View Switcher: Kitchen Tickets vs Menu Manager
   */
  function switchView(viewName) {
    state.currentView = viewName;

    if (viewName === "orders") {
      if (el.viewTabOrders) el.viewTabOrders.classList.add("active");
      if (el.viewTabMenu) el.viewTabMenu.classList.remove("active");
      if (el.sectionOrdersView) el.sectionOrdersView.style.display = "block";
      if (el.sectionMenuView) el.sectionMenuView.style.display = "none";
      if (el.menuViewActions) el.menuViewActions.style.display = "none";
    } else {
      if (el.viewTabMenu) el.viewTabMenu.classList.add("active");
      if (el.viewTabOrders) el.viewTabOrders.classList.remove("active");
      if (el.sectionOrdersView) el.sectionOrdersView.style.display = "none";
      if (el.sectionMenuView) el.sectionMenuView.style.display = "block";
      if (el.menuViewActions) el.menuViewActions.style.display = "flex";

      if (state.menu.length === 0) {
        fetchOwnerMenu(false);
      } else {
        renderOwnerMenu();
      }
    }
  }

  /**
   * Login Handler
   */
  async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const shopId = el.loginShopId.value.trim().toLowerCase();
    const pin = el.loginPin.value.trim();

    if (!shopId || !pin) {
      showToast("Please enter both Shop ID and PIN.", "error");
      return;
    }

    state.shopId = shopId;
    state.pin = pin;

    el.btnLoginSubmit.disabled = true;
    el.btnLoginSubmit.innerHTML = `<span>Verifying Credentials...</span>`;

    try {
      await performLogin();
    } catch (err) {
      console.error("[Owner Login Error]:", err);
      showToast("Unexpected error logging in. Please retry.", "error");
    } finally {
      el.btnLoginSubmit.disabled = false;
      el.btnLoginSubmit.innerHTML = `<i data-lucide="unlock" style="width:17px;height:17px;"></i><span>Unlock Kitchen Display</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  async function performLogin() {
    try {
      const response = await AOLA_API.post("get_orders", {
        shop_id: state.shopId,
        pin: state.pin
      });

      if (!response.success) {
        showToast(response.error || "Authentication failed. Check your PIN.", "error");
        return;
      }

      sessionStorage.setItem("AOLA_OWNER_SHOP", state.shopId);
      sessionStorage.setItem("AOLA_OWNER_PIN", state.pin);

      el.loginOverlay.classList.remove("open");
      el.dashboardContainer.style.display = "block";
      el.ownerShopName.textContent = response.shopName || "Kitchen Display";
      el.ownerShopTag.textContent = `@${state.shopId}`;

      handleOrdersUpdate(response.orders || []);
      startPolling();

      // Background sync menu items
      fetchOwnerMenu(false);

      if (window.lucide) lucide.createIcons();
      showToast("Connected to live kitchen feed.", "success");
    } catch (err) {
      showToast("Connection error logging in. Please check backend configuration.", "error");
    }
  }

  function logout() {
    stopPolling();
    sessionStorage.removeItem("AOLA_OWNER_SHOP");
    sessionStorage.removeItem("AOLA_OWNER_PIN");
    state.shopId = "";
    state.pin = "";
    state.orders = [];
    state.menu = [];
    state.knownOrderIds.clear();
    state.isInitialLoad = true;

    switchView("orders");
    el.dashboardContainer.style.display = "none";
    el.loginOverlay.classList.add("open");
    el.loginPin.value = "";
    showToast("Logged out successfully.", "info");
  }

  /**
   * 15-Second Polling Timer for Kitchen Tickets
   */
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => {
      fetchOrders(false);
    }, AOLA_CONFIG.OWNER_POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function fetchOrders(isManual = false) {
    if (!state.shopId || !state.pin) return;

    if (isManual) {
      el.btnManualRefresh.disabled = true;
      el.btnManualRefresh.textContent = "Updating...";
    }

    try {
      const response = await AOLA_API.post("get_orders", {
        shop_id: state.shopId,
        pin: state.pin
      });

      if (response.success) {
        handleOrdersUpdate(response.orders || []);
        el.lastSyncTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      } else if (response.error && response.error.includes("Invalid PIN")) {
        logout();
        showToast("Session expired or PIN changed. Please log in again.", "error");
      }
    } catch (err) {
      console.warn("Polling error:", err);
    } finally {
      if (isManual) {
        el.btnManualRefresh.disabled = false;
        el.btnManualRefresh.innerHTML = `<i data-lucide="refresh-cw" style="width:15px;height:15px;"></i><span>Refresh</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /**
   * Process updated orders list and trigger sound alerts
   */
  function handleOrdersUpdate(newOrders) {
    state.orders = (newOrders || []).map((o, idx) => ({
      orderId: String(o.orderId || o.order_id || o.id || `ORD-${idx + 1}`).trim(),
      timestamp: String(o.timestamp || o.time || new Date().toLocaleTimeString()),
      tableNumber: String(o.tableNumber || o.table_number || o.table || "1"),
      items: String(o.items || o.itemsSummary || "Items ordered"),
      totalPrice: Number(o.totalPrice || o.total_price || o.total) || 0,
      status: String(o.status || "Pending").trim(),
      customerNotes: String(o.customerNotes || o.customer_notes || o.notes || "").trim()
    }));

    let hasNewPendingOrder = false;
    state.orders.forEach((o) => {
      const isPending = o.status.toLowerCase() === "pending" || o.status.toLowerCase() === "new";
      if (isPending) {
        if (!state.knownOrderIds.has(o.orderId)) {
          if (!state.isInitialLoad) {
            hasNewPendingOrder = true;
          }
        }
      }
      state.knownOrderIds.add(o.orderId);
    });

    state.isInitialLoad = false;

    if (hasNewPendingOrder) {
      playNewOrderSound();
      showToast("🔔 New Kitchen Order Received!", "success");
    }

    updateCounts();
    renderTickets();
  }

  function updateCounts() {
    const pendingCount = state.orders.filter((o) => {
      const s = o.status.toLowerCase();
      return s === "pending" || s === "new";
    }).length;
    const completedCount = state.orders.filter((o) => o.status.toLowerCase() === "completed").length;

    el.countPending.textContent = pendingCount;
    el.countCompleted.textContent = completedCount;
  }

  /**
   * Rush Hour Helper: Parses individual dish text into quantity, name, price, note
   */
  function parseSingleDishItem(str) {
    str = String(str || "").trim();
    let qty = 1;
    let name = str;
    let price = "";
    let note = "";

    // Extract embedded [Notes: ...] or (Note: ...)
    const noteMatch = name.match(/\[(?:Notes?|Note|Instructions?):\s*([^\]]+)\]/i);
    if (noteMatch) {
      note = noteMatch[1].trim();
      name = name.replace(noteMatch[0], "").trim();
    }

    // Extract trailing price in parentheses: e.g. "(₹440)"
    const priceMatch = name.match(/^(.*?)\s*\(([^()]+)\)$/);
    if (priceMatch) {
      name = priceMatch[1].trim();
      price = priceMatch[2].trim();
    }

    // Extract leading quantity: e.g. "2x ", "2 x ", "2× "
    const qtyMatch = name.match(/^(\d+)\s*[xX×]\s*(.*)$/);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1], 10);
      name = qtyMatch[2].trim();
    }

    return { qty, name, price, note };
  }

  /**
   * Rush Hour Helper: Breaks order item summaries into a clean array of dishes
   */
  function parseOrderDishItems(itemsRaw) {
    if (!itemsRaw) return [];
    if (Array.isArray(itemsRaw)) {
      return itemsRaw.map((item) => {
        if (typeof item === "string") return parseSingleDishItem(item);
        const q = item.quantity || item.qty || 1;
        const p = item.price ? formatCurrency(item.price * q) : "";
        return {
          qty: q,
          name: item.name || item.item_name || "Dish",
          price: p,
          note: item.note || item.notes || ""
        };
      });
    }

    const rawStr = String(itemsRaw).trim();
    let parts = [];
    if (rawStr.includes("\n")) {
      parts = rawStr.split("\n");
    } else if (rawStr.match(/\d+\s*[xX×]/)) {
      // Split by comma followed by a quantity like '2x' or '1 x'
      parts = rawStr.split(/,\s*(?=\d+\s*[xX×])/);
    } else {
      parts = rawStr.split(/,\s*/);
    }

    return parts.map((p) => p.trim()).filter(Boolean).map(parseSingleDishItem);
  }

  /**
   * Helper: Formats timestamp into clean readable time (e.g. '09:53 PM')
   */
  function formatTicketTime(rawStr) {
    if (!rawStr) return "Just now";
    const d = new Date(rawStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return String(rawStr).replace(/GMT.*$/, "").trim();
  }

  /**
   * Render Ticket Cards (Optimized with Rush-Hour Bullet Points & Check-off)
   */
  function renderTickets() {
    const filtered = state.orders.filter((o) => {
      const isPending = o.status.toLowerCase() === "pending" || o.status.toLowerCase() === "new";
      return state.activeTab === "pending" ? isPending : !isPending;
    });

    if (filtered.length === 0) {
      el.ticketGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; background:#FFFFFF; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <div class="empty-state-icon" style="color:var(--accent-emerald);">
            <i data-lucide="check-check" style="width:40px;height:40px;"></i>
          </div>
          <h3 style="color:var(--brand-navy); font-size:1.1rem;">No ${state.activeTab} orders right now</h3>
          <p style="font-size:0.86rem;color:var(--text-muted);margin-top:6px;">
            ${state.activeTab === "pending" ? "All clear! New QR orders will appear here automatically." : "No completed orders recorded yet."}
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.ticketGrid.innerHTML = "";
    filtered.forEach((ord) => {
      const isPending = ord.status.toLowerCase() === "pending" || ord.status.toLowerCase() === "new";
      const dishList = parseOrderDishItems(ord.items);
      const totalQty = dishList.reduce((sum, d) => sum + (d.qty || 1), 0);

      const card = document.createElement("article");
      card.className = `ticket-card ${isPending ? "pending" : "completed"}`;

      card.innerHTML = `
        <div class="ticket-header">
          <div>
            <span class="ticket-table-badge">TABLE ${escapeHtml(ord.tableNumber)}</span>
            <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px; font-family:monospace; font-weight:600;">ID: ${escapeHtml(ord.orderId)}</div>
          </div>
          <span class="ticket-time">
            <i data-lucide="clock" style="width:13px;height:13px;"></i>
            <span>${escapeHtml(formatTicketTime(ord.timestamp))}</span>
          </span>
        </div>

        <div class="ticket-dish-section">
          <div class="ticket-rush-meta">
            <span class="ticket-total-items-badge">
              <i data-lucide="shopping-bag" style="width:13px;height:13px;"></i>
              <span>${totalQty} ${totalQty === 1 ? "Item" : "Items"} (${dishList.length} ${dishList.length === 1 ? "dish" : "dishes"})</span>
            </span>
            ${isPending ? `<span class="ticket-rush-hint">Tap item when plated</span>` : ""}
          </div>

          <ul class="ticket-bullet-list">
            ${dishList.map((dish) => `
              <li class="ticket-bullet-item ${!isPending ? 'dish-prepared' : ''}" ${isPending ? 'onclick="this.classList.toggle(\'dish-prepared\')"' : ''} title="${isPending ? 'Tap to mark plated' : ''}">
                <div class="ticket-dish-bullet-left">
                  <span class="ticket-dish-qty-badge ${dish.qty > 1 ? 'multi-qty' : ''}">${dish.qty}×</span>
                  <div class="ticket-dish-title-wrap">
                    <span class="ticket-dish-title">${escapeHtml(dish.name)}</span>
                    ${dish.note ? `<span class="ticket-dish-inline-note">Note: ${escapeHtml(dish.note)}</span>` : ""}
                  </div>
                </div>
                ${dish.price ? `<span class="ticket-dish-price-tag">${escapeHtml(dish.price)}</span>` : ""}
              </li>
            `).join("")}
          </ul>

          ${ord.customerNotes ? `
            <div class="ticket-notes-callout">
              <div class="ticket-notes-header">
                <i data-lucide="message-square" style="width:14px;height:14px;"></i>
                <span>Special Instructions:</span>
              </div>
              <div class="ticket-notes-content">${escapeHtml(ord.customerNotes)}</div>
            </div>
          ` : ""}
        </div>

        <div class="ticket-footer">
          <div class="ticket-price">${formatCurrency(ord.totalPrice)}</div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-secondary btn-open-bill" data-id="${escapeHtml(ord.orderId)}" title="Generate Customer Bill &amp; Print" style="padding:6px 10px; display:inline-flex; align-items:center; gap:5px; font-weight:600; font-size:0.8rem; border-color:var(--border-subtle); color:var(--brand-navy);">
              <i data-lucide="receipt" style="width:14px;height:14px;color:var(--accent-emerald);"></i>
              <span>Bill</span>
            </button>
            <button class="btn-secondary btn-quick-kot" data-id="${escapeHtml(ord.orderId)}" title="Instant Print Kitchen KOT" style="padding:6px 8px; border-color:var(--border-subtle);">
              <i data-lucide="printer" style="width:14px;height:14px;"></i>
            </button>
            ${
              isPending
                ? `
                  <button class="btn-emerald btn-complete-order" data-id="${escapeHtml(ord.orderId)}" style="padding:6px 12px; font-size:0.8rem;">
                    <i data-lucide="check-circle-2" style="width:14px;height:14px;"></i>
                    <span>Complete</span>
                  </button>
                `
                : `<span class="status-badge active"><i data-lucide="check" style="width:13px;height:13px;"></i> Done</span>`
            }
          </div>
        </div>
      `;

      el.ticketGrid.appendChild(card);
    });

    el.ticketGrid.querySelectorAll(".btn-complete-order").forEach((b) => {
      b.onclick = () => completeOrder(b.dataset.id, b);
    });

    el.ticketGrid.querySelectorAll(".btn-open-bill").forEach((b) => {
      b.onclick = () => openBillModal(b.dataset.id, false);
    });

    el.ticketGrid.querySelectorAll(".btn-quick-kot").forEach((b) => {
      b.onclick = () => quickPrintKot(b.dataset.id);
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Action: Mark Order as Complete
   */
  async function completeOrder(orderId, buttonEl) {
    if (!confirm(`Mark Order #${orderId} as Completed?`)) return;

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Updating...";
    }

    try {
      const response = await AOLA_API.post("complete_order", {
        shop_id: state.shopId,
        pin: state.pin,
        order_id: orderId
      });

      if (!response.success) {
        showToast(response.error || "Failed to update order status.", "error");
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.textContent = "✓ Mark Complete";
        }
        return;
      }

      showToast(`Order #${orderId} marked as completed!`, "success");

      const ord = state.orders.find((o) => o.orderId === orderId);
      if (ord) {
        ord.status = "Completed";
      }

      updateCounts();
      renderTickets();
    } catch (err) {
      showToast("Error communicating with server.", "error");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = "✓ Mark Complete";
      }
    }
  }

  // =========================================================================
  // RESTAURANT OWNER MENU MANAGEMENT (View, Add, Edit, Stock Toggle, Delete)
  // =========================================================================

  /**
   * Fetch Menu from Restaurant Google Sheet
   */
  async function fetchOwnerMenu(isManual = false) {
    if (!state.shopId || !state.pin) return;

    if (isManual && el.btnRefreshMenu) {
      el.btnRefreshMenu.disabled = true;
      el.btnRefreshMenu.textContent = "Syncing...";
    }

    try {
      const response = await AOLA_API.post("owner_get_menu", {
        shop_id: state.shopId,
        pin: state.pin
      });

      if (response.success) {
        state.currency = response.currency || state.currency || "₹";
        state.menu = (response.menu || []).map((m, idx) => ({
          id: String(m.id || m.itemId || `dish_${idx + 1}`).trim(),
          name: String(m.name || m.item_name || "Dish").trim(),
          category: String(m.category || "General").trim(),
          price: Number(m.price) || 0,
          description: String(m.description || "").trim(),
          isVeg: m.isVeg === true || String(m.isVeg).toLowerCase() === "true",
          inStock: m.inStock !== false && String(m.inStock).toLowerCase() !== "false"
        }));

        if (el.countMenuItems) {
          el.countMenuItems.textContent = state.menu.length;
        }

        renderOwnerMenuCategories();
        renderOwnerMenu();

        if (isManual) {
          showToast(`Menu synchronized: ${state.menu.length} items loaded.`, "success");
        }
      } else {
        showToast(response.error || "Failed to load restaurant menu.", "error");
      }
    } catch (err) {
      console.error("[Owner Menu Error]:", err);
      showToast("Error loading menu from server.", "error");
    } finally {
      if (isManual && el.btnRefreshMenu) {
        el.btnRefreshMenu.disabled = false;
        el.btnRefreshMenu.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i><span>Sync Google Sheet</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /**
   * Render Category Filter Pills
   */
  function renderOwnerMenuCategories() {
    if (!el.ownerMenuCats) return;

    const categories = ["all"];
    state.menu.forEach((item) => {
      if (item.category && !categories.includes(item.category)) {
        categories.push(item.category);
      }
    });

    el.ownerMenuCats.innerHTML = categories
      .map((cat) => {
        const isActive = state.menuFilterCategory === cat;
        const label = cat === "all" ? "All Items" : escapeHtml(cat);
        return `<button class="cat-chip ${isActive ? "active" : ""}" data-category="${escapeHtml(cat)}">${label}</button>`;
      })
      .join("");

    el.ownerMenuCats.querySelectorAll(".cat-chip").forEach((btn) => {
      btn.onclick = () => {
        state.menuFilterCategory = btn.dataset.category;
        renderOwnerMenuCategories();
        renderOwnerMenu();
      };
    });
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Render Menu Items in Data Table
   */
  function renderOwnerMenu() {
    if (!el.ownerMenuTbody) return;

    let filtered = state.menu;

    // Filter by category
    if (state.menuFilterCategory !== "all") {
      filtered = filtered.filter(
        (item) => item.category.toLowerCase() === state.menuFilterCategory.toLowerCase()
      );
    }

    // Filter by search query
    if (state.menuSearchQuery) {
      const q = state.menuSearchQuery;
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      el.ownerMenuTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
            <div style="margin-bottom: 8px; color:var(--text-dim); display:flex; justify-content:center;"><i data-lucide="utensils" style="width:36px;height:36px;"></i></div>
            <div style="font-weight: 600; color: var(--brand-navy); margin-bottom: 4px; font-size:1.05rem;">No Dishes Found</div>
            <div style="font-size: 0.85rem; color:var(--text-muted);">
              ${state.menu.length === 0 ? "Your menu has no items yet. Click '+ Add New Dish' to create your first item." : "No dishes match your active search or category filter."}
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.ownerMenuTbody.innerHTML = filtered
      .map((item) => {
        const vegBadge = item.isVeg
          ? `<span class="diet-tag-veg"><span class="diet-icon"><span class="diet-dot"></span></span> Veg</span>`
          : `<span class="diet-tag-nonveg"><span class="diet-icon"><span class="diet-dot"></span></span> Non-Veg</span>`;

        const stockButton = item.inStock
          ? `<button class="btn-stock-toggle in-stock" data-id="${escapeHtml(item.id)}" data-stock="true" title="Click to Mark Out of Stock"><i data-lucide="check" style="width:13px;height:13px;"></i> In Stock</button>`
          : `<button class="btn-stock-toggle out-of-stock" data-id="${escapeHtml(item.id)}" data-stock="false" title="Click to Mark Available"><i data-lucide="x" style="width:13px;height:13px;"></i> Out of Stock</button>`;

        const descText = item.description
          ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.description)}</div>`
          : "";

        return `
          <tr>
            <td>
              <div style="font-weight: 600; color: var(--brand-navy); font-size: 0.94rem;">${escapeHtml(item.name)}</div>
              ${descText}
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">ID: <code>${escapeHtml(item.id)}</code></div>
            </td>
            <td>
              <span class="category-badge">${escapeHtml(item.category)}</span>
            </td>
            <td>${vegBadge}</td>
            <td style="font-weight: 700; color: var(--brand-navy); font-size: 0.95rem;">
              ${state.currency}${item.price.toFixed(0)}
            </td>
            <td>${stockButton}</td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px;">
                <button class="btn-secondary btn-edit-dish" data-id="${escapeHtml(item.id)}" style="padding: 5px 10px; font-size: 0.8rem;" title="Edit Dish Details">
                  <i data-lucide="edit-3" style="width:13px;height:13px;"></i> <span>Edit</span>
                </button>
                <button class="btn-danger btn-delete-dish" data-id="${escapeHtml(item.id)}" style="padding: 5px 8px; font-size: 0.8rem;" title="Delete Dish">
                  <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Attach Stock Toggle Handlers
    el.ownerMenuTbody.querySelectorAll(".btn-stock-toggle").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const currentStock = btn.dataset.stock === "true";
        toggleDishStock(id, currentStock, btn);
      };
    });

    // Attach Edit Handlers
    el.ownerMenuTbody.querySelectorAll(".btn-edit-dish").forEach((btn) => {
      btn.onclick = () => {
        openEditDishModal(btn.dataset.id);
      };
    });

    // Attach Delete Handlers
    el.ownerMenuTbody.querySelectorAll(".btn-delete-dish").forEach((btn) => {
      btn.onclick = () => {
        deleteDish(btn.dataset.id);
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * 1-Click Stock Status Toggle (In Stock vs 86'd Out of Stock)
   */
  async function toggleDishStock(itemId, currentStock, btnEl) {
    const nextStock = !currentStock;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Updating...";
    }

    try {
      const response = await AOLA_API.post("owner_toggle_stock", {
        shop_id: state.shopId,
        pin: state.pin,
        item_id: itemId,
        in_stock: nextStock
      });

      if (!response.success) {
        showToast(response.error || "Failed to update stock status.", "error");
        renderOwnerMenu();
        return;
      }

      showToast(response.message || `Dish stock updated!`, "success");

      const dish = state.menu.find((d) => d.id === itemId);
      if (dish) {
        dish.inStock = nextStock;
      }
      renderOwnerMenu();
    } catch (err) {
      showToast("Error updating stock status.", "error");
      renderOwnerMenu();
    }
  }

  /**
   * Open Add Dish Modal
   */
  function openAddDishModal() {
    if (!el.dishModal) return;
    el.dishForm.reset();
    el.dishFormId.value = "";
    el.dishModalTitle.textContent = "Add New Dish";
    el.dishFormIsVeg.value = "false";
    el.dishFormInStock.value = "true";
    el.dishModal.classList.add("open");
  }

  /**
   * Open Edit Dish Modal
   */
  function openEditDishModal(itemId) {
    const dish = state.menu.find((d) => d.id === itemId);
    if (!dish) return;

    el.dishFormId.value = dish.id;
    el.dishFormName.value = dish.name;
    el.dishFormCategory.value = dish.category;
    el.dishFormPrice.value = dish.price;
    el.dishFormDesc.value = dish.description || "";
    el.dishFormIsVeg.value = dish.isVeg ? "true" : "false";
    el.dishFormInStock.value = dish.inStock ? "true" : "false";

    el.dishModalTitle.textContent = `Edit Dish: ${dish.name}`;
    el.dishModal.classList.add("open");
  }

  function closeDishModal() {
    if (el.dishModal) {
      el.dishModal.classList.remove("open");
    }
  }

  /**
   * Save Dish Form Submit Handler (Creates or Updates)
   */
  async function handleSaveDishSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const itemId = el.dishFormId.value.trim();
    const name = el.dishFormName.value.trim();
    const category = el.dishFormCategory.value.trim();
    const price = parseFloat(el.dishFormPrice.value);
    const description = el.dishFormDesc.value.trim();
    const isVeg = el.dishFormIsVeg.value === "true";
    const inStock = el.dishFormInStock.value === "true";

    if (!name) {
      showToast("Please enter a dish name.", "error");
      return;
    }

    if (isNaN(price) || price < 0) {
      showToast("Please enter a valid price.", "error");
      return;
    }

    el.btnSaveDishSubmit.disabled = true;
    el.btnSaveDishSubmit.innerHTML = `<span>Saving to Google Sheet...</span>`;

    try {
      const response = await AOLA_API.post("owner_save_dish", {
        shop_id: state.shopId,
        pin: state.pin,
        item_id: itemId,
        name: name,
        category: category,
        price: price,
        description: description,
        is_veg: isVeg,
        in_stock: inStock
      });

      if (!response.success) {
        showToast(response.error || "Failed to save dish.", "error");
        return;
      }

      showToast(response.message || "Dish saved successfully!", "success");
      closeDishModal();

      // Refresh menu from sheet
      await fetchOwnerMenu(false);
    } catch (err) {
      console.error("[Save Dish Error]:", err);
      showToast("Error saving dish to Google Sheet.", "error");
    } finally {
      el.btnSaveDishSubmit.disabled = false;
      el.btnSaveDishSubmit.innerHTML = `<span>Save Dish</span>`;
    }
  }

  /**
   * Delete Dish Handler
   */
  async function deleteDish(itemId) {
    const dish = state.menu.find((d) => d.id === itemId);
    const dishName = dish ? dish.name : itemId;

    if (
      !confirm(
        `Are you sure you want to permanently delete "${dishName}" from your menu?\n\nThis dish will no longer appear on the customer QR ordering menu.`
      )
    ) {
      return;
    }

    try {
      const response = await AOLA_API.post("owner_delete_dish", {
        shop_id: state.shopId,
        pin: state.pin,
        item_id: itemId
      });

      if (!response.success) {
        showToast(response.error || "Failed to delete dish.", "error");
        return;
      }

      showToast(`"${dishName}" removed from menu.`, "info");
      state.menu = state.menu.filter((d) => d.id !== itemId);
      if (el.countMenuItems) {
        el.countMenuItems.textContent = state.menu.length;
      }
      renderOwnerMenuCategories();
      renderOwnerMenu();
    } catch (err) {
      showToast("Error communicating with server.", "error");
    }
  }

  /**
   * Action: Change Owner Security PIN
   */
  async function handleChangePinSubmit() {
    const currentPin = el.inputCurrentPin.value.trim();
    const newPin = el.inputNewPin.value.trim();
    const confirmPin = el.inputConfirmPin.value.trim();

    if (!currentPin || !newPin) {
      showToast("Please enter current and new PIN.", "error");
      return;
    }

    if (newPin !== confirmPin) {
      showToast("New PIN and Confirm PIN do not match.", "error");
      return;
    }

    if (newPin.length < 4) {
      showToast("New PIN must be at least 4 digits.", "error");
      return;
    }

    el.btnSubmitChangePin.disabled = true;
    el.btnSubmitChangePin.textContent = "Updating...";

    try {
      const response = await AOLA_API.post("change_pin", {
        shop_id: state.shopId,
        current_pin: currentPin,
        new_pin: newPin
      });

      if (!response.success) {
        showToast(response.error || "Failed to update PIN.", "error");
        return;
      }

      state.pin = newPin;
      sessionStorage.setItem("AOLA_OWNER_PIN", newPin);
      showToast("PIN updated successfully! Use your new PIN for future logins.", "success");
      el.changePinModal.classList.remove("open");
    } catch (err) {
      showToast("Error updating PIN. Please check connection.", "error");
    } finally {
      el.btnSubmitChangePin.disabled = false;
      el.btnSubmitChangePin.textContent = "Update PIN";
    }
  }

  // Launch on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
