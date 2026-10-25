/**
 * AOLA - Kitchen Display & Owner Dashboard Controller (owner.html)
 * Includes Live KDS Tickets & Menu Management (Add, Edit, Toggle Stock, Delete)
 */

(function () {
  const state = {
    shopId: "",
    pin: "",
    orders: [],
    expenses: [],
    totalExpenses: 0,
    activeTab: "ready", // "ready" (ready for billing) | "pending" (in kitchen prep)
    currentView: "orders", // "orders" | "history" | "menu" | "expenses" | "trends"
    historySubtab: "all", // "all" | "completed" | "voided"
    trendTimeframe: "daily", // "daily" | "weekly" | "monthly" | "yearly"
    trendSelectedDate: "",
    trendsChartInstance: null,
    breakdownChartInstance: null,
    menu: [],
    currency: "₹",
    menuFilterCategory: "all",
    menuSearchQuery: "",
    pollTimer: null,
    knownOrderIds: new Set(),
    isInitialLoad: true,
    paperWidth: localStorage.getItem("AOLA_THERMAL_PAPER_WIDTH") || "58mm", // 58mm default or 80mm
    storeProfile: {
      restaurantName: "",
      storeAddress: "",
      phoneNumber: "",
      gstin: "",
      waiterTag: "Counter POS 01",
      footerMessage: "Thank you for dining with us! Please visit again.",
      upiId: ""
    },
    historyFilter: {
      dateRange: "today",
      startDate: "",
      endDate: "",
      status: "all",
      search: ""
    },
    // Manual POS Cashier Terminal State
    cashierCart: [],
    posOrderSource: "Dine-In",
    posSelectedTable: "1",
    posCategoryFilter: "all",
    posSearchQuery: ""
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
    btnOpenSettings: document.getElementById("btn-open-settings"),
    btnSidebarSettings: document.getElementById("btn-sidebar-settings"),
    btnLogout: document.getElementById("btn-logout"),

    // Manual POS Terminal Elements
    btnHeaderPos: document.getElementById("btn-header-pos"),
    viewTabPos: document.getElementById("view-tab-pos"),
    posModal: document.getElementById("pos-modal"),
    btnClosePos: document.getElementById("btn-close-pos"),
    btnPosCancel: document.getElementById("btn-pos-cancel"),
    btnPosQuickClear: document.getElementById("btn-pos-quick-clear"),
    btnPosClearItems: document.getElementById("btn-pos-clear-items"),
    posDishSearch: document.getElementById("pos-dish-search"),
    btnPosClearSearch: document.getElementById("btn-pos-clear-search"),
    posCategoryChips: document.getElementById("pos-category-chips"),
    posMenuGrid: document.getElementById("pos-menu-grid"),
    posMenuEmpty: document.getElementById("pos-menu-empty"),
    btnPosResetFilters: document.getElementById("btn-pos-reset-filters"),
    posSourceSelector: document.getElementById("pos-source-selector"),
    posSourceIndicator: document.getElementById("pos-source-indicator"),
    posOrderRef: document.getElementById("pos-order-ref"),
    posOrderRefLabel: document.getElementById("pos-order-ref-label"),
    posQuickTables: document.getElementById("pos-quick-tables"),
    posOrderNotes: document.getElementById("pos-order-notes"),
    posCartCount: document.getElementById("pos-cart-count"),
    posCartList: document.getElementById("pos-cart-list"),
    posCartEmpty: document.getElementById("pos-cart-empty"),
    posSubtotal: document.getElementById("pos-subtotal"),
    posGrandTotal: document.getElementById("pos-grand-total"),
    btnPosSubmitOrder: document.getElementById("btn-pos-submit-order"),
    posSubmitText: document.getElementById("pos-submit-text"),

    // View Switcher Tabs
    viewTabOrders: document.getElementById("view-tab-orders"),
    viewTabHistory: document.getElementById("view-tab-history"),
    viewTabMenu: document.getElementById("view-tab-menu"),
    viewTabExpenses: document.getElementById("view-tab-expenses"),
    viewTabTrends: document.getElementById("view-tab-trends"),
    countExpensesBadge: document.getElementById("count-expenses-badge"),
    menuViewActions: document.getElementById("menu-view-actions"),
    btnRefreshMenu: document.getElementById("btn-refresh-menu"),
    btnOpenAddDish: document.getElementById("btn-open-add-dish"),
    sectionOrdersView: document.getElementById("section-orders-view"),
    sectionHistoryView: document.getElementById("section-history-view"),
    sectionMenuView: document.getElementById("section-menu-view"),
    sectionExpensesView: document.getElementById("section-expenses-view"),
    sectionTrendsView: document.getElementById("section-trends-view"),
    countMenuItems: document.getElementById("count-menu-items"),

    // Kitchen Tickets View & KDS Billing Queue
    tabPending: document.getElementById("tab-pending"),
    tabCompleted: document.getElementById("tab-completed"),
    countPending: document.getElementById("count-pending"),
    countCompleted: document.getElementById("count-completed"),
    ticketGrid: document.getElementById("ticket-grid"),
    chkAudio: document.getElementById("chk-audio"),
    btnTogglePinVisibility: document.getElementById("btn-toggle-pin-visibility"),
    billingQueueHeading: document.getElementById("billing-queue-heading"),
    billingQueueSubtitle: document.getElementById("billing-queue-subtitle"),
    badgeReadyCount: document.getElementById("badge-ready-count"),
    paidOrdersSection: document.getElementById("paid-orders-section"),
    paidOrdersTable: document.getElementById("paid-orders-table"),
    paidOrdersTbody: document.getElementById("paid-orders-tbody"),
    paidOrdersEmpty: document.getElementById("paid-orders-empty"),
    paidOrdersCountBadge: document.getElementById("paid-orders-count-badge"),
    btnQuickToHistory: document.getElementById("btn-quick-to-history"),

    // Historical Reconciliation View & Metrics
    metricTotalRevenue: document.getElementById("metric-total-revenue"),
    metricHistoryExpenses: document.getElementById("metric-history-expenses"),
    metricHistoryNetProfit: document.getElementById("metric-history-net-profit"),
    badgeHistoryProfit: document.getElementById("badge-history-profit"),
    metricAov: document.getElementById("metric-aov"),
    metricOrdersServed: document.getElementById("metric-orders-served"),
    metricOrdersCancelled: document.getElementById("metric-orders-cancelled"),
    btnSubtabAllOrders: document.getElementById("btn-subtab-all-orders"),
    btnSubtabCompletedOrders: document.getElementById("btn-subtab-completed-orders"),
    btnSubtabVoidedOrders: document.getElementById("btn-subtab-voided-orders"),
    subtabCountAll: document.getElementById("subtab-count-all"),
    subtabCountCompleted: document.getElementById("subtab-count-completed"),
    subtabCountVoided: document.getElementById("subtab-count-voided"),
    voidedAuditBanner: document.getElementById("voided-audit-banner"),
    historyDatePills: document.getElementById("history-date-pills"),
    customDateContainer: document.getElementById("custom-date-container"),
    historyStartDate: document.getElementById("history-start-date"),
    historyEndDate: document.getElementById("history-end-date"),
    historyStatusFilter: document.getElementById("history-status-filter"),
    historySearchInput: document.getElementById("history-search-input"),
    btnExportCsv: document.getElementById("btn-export-csv"),
    historyTbody: document.getElementById("history-tbody"),

    // Daily Expenses View Elements
    metricExpRevenue: document.getElementById("metric-exp-revenue"),
    metricExpTotal: document.getElementById("metric-exp-total"),
    metricExpNetProfit: document.getElementById("metric-exp-net-profit"),
    metricExpCount: document.getElementById("metric-exp-count"),
    badgeNetProfit: document.getElementById("badge-net-profit"),
    ownerExpenseForm: document.getElementById("owner-expense-form"),
    expenseCategory: document.getElementById("expense-category"),
    expenseAmount: document.getElementById("expense-amount"),
    expenseDesc: document.getElementById("expense-desc"),
    expenseDate: document.getElementById("expense-date"),
    btnSubmitExpense: document.getElementById("btn-submit-expense"),
    btnRefreshExpenses: document.getElementById("btn-refresh-expenses"),
    btnExportExpensesCsv: document.getElementById("btn-export-expenses-csv"),
    filterExpenseCategory: document.getElementById("filter-expense-category"),
    expenseSearchInput: document.getElementById("expense-search-input"),
    expensesTbody: document.getElementById("expenses-tbody"),

    // Sales Trends View Elements (Chart.js)
    btnTrendDaily: document.getElementById("btn-trend-daily"),
    btnTrendWeekly: document.getElementById("btn-trend-weekly"),
    btnTrendMonthly: document.getElementById("btn-trend-monthly"),
    btnTrendYearly: document.getElementById("btn-trend-yearly"),
    trendDateToolbar: document.getElementById("trend-date-toolbar"),
    trendDateInput: document.getElementById("trend-date-input"),
    trendBtnPrevDay: document.getElementById("trend-btn-prev-day"),
    trendBtnNextDay: document.getElementById("trend-btn-next-day"),
    trendBtnToday: document.getElementById("trend-btn-today"),
    trendBtnYesterday: document.getElementById("trend-btn-yesterday"),
    trendSelectedDayText: document.getElementById("trend-selected-day-text"),
    trendDayOrderCountBadge: document.getElementById("trend-day-order-count-badge"),
    trendMetricRevenue: document.getElementById("trend-metric-revenue"),
    trendMetricPeak: document.getElementById("trend-metric-peak"),
    trendMetricOrders: document.getElementById("trend-metric-orders"),
    trendMetricAov: document.getElementById("trend-metric-aov"),
    trendChartMainTitle: document.getElementById("trend-chart-main-title"),
    trendChartMainSubtitle: document.getElementById("trend-chart-main-subtitle"),
    trendChartTag: document.getElementById("trend-chart-tag"),
    ownerTrendsChart: document.getElementById("ownerTrendsChart"),
    ownerBreakdownChart: document.getElementById("ownerBreakdownChart"),

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

    // Store Profile & Settings Modal
    settingsModal: document.getElementById("settings-modal"),
    btnCloseSettings: document.getElementById("btn-close-settings"),
    btnCancelSettings: document.getElementById("btn-cancel-settings"),
    settingsForm: document.getElementById("settings-form"),
    settingsRestaurantName: document.getElementById("settings-restaurant-name"),
    settingsStoreAddress: document.getElementById("settings-store-address"),
    settingsPhoneNumber: document.getElementById("settings-phone-number"),
    settingsGstin: document.getElementById("settings-gstin"),
    settingsWaiterTag: document.getElementById("settings-waiter-tag"),
    settingsUpiId: document.getElementById("settings-upi-id"),
    settingsFooterMessage: document.getElementById("settings-footer-message"),
    btnSaveSettings: document.getElementById("btn-save-settings"),

    // Void Order Modal
    voidOrderModal: document.getElementById("void-order-modal"),
    voidOrderModalId: document.getElementById("void-order-modal-id"),
    voidOrderReasonInput: document.getElementById("void-order-reason-input"),
    btnCloseVoidModal: document.getElementById("btn-close-void-modal"),
    btnCancelVoidModal: document.getElementById("btn-cancel-void-modal"),
    btnConfirmVoidModal: document.getElementById("btn-confirm-void-modal"),

    // System Logs & Health Telemetry Modal
    btnSidebarLogs: document.getElementById("btn-sidebar-logs"),
    systemLogsModal: document.getElementById("system-logs-modal"),
    btnCloseLogsModal: document.getElementById("btn-close-logs-modal"),
    systemLogsContainer: document.getElementById("system-logs-container"),
    btnExportLogs: document.getElementById("btn-export-logs"),
    btnClearLocalLogs: document.getElementById("btn-clear-local-logs"),
    btnFilterLogAll: document.getElementById("btn-filter-log-all"),
    btnFilterLogError: document.getElementById("btn-filter-log-error"),
    btnFilterLogWarn: document.getElementById("btn-filter-log-warn"),
    btnFilterLogInfo: document.getElementById("btn-filter-log-info"),
    logCountAll: document.getElementById("log-count-all"),
    logCountError: document.getElementById("log-count-error"),
    logCountWarn: document.getElementById("log-count-warn"),
    logCountInfo: document.getElementById("log-count-info"),

    // Billing & Thermal Printing System
    printableReceiptWrapper: document.getElementById("printable-receipt-wrapper"),
    printableReceipt: document.getElementById("printable-receipt"),
    isolatedPrintFrame: document.getElementById("isolated-print-frame"),
    billModal: document.getElementById("bill-modal"),
    btnCloseBillModal: document.getElementById("btn-close-bill-modal"),
    btnCancelBillModal: document.getElementById("btn-cancel-bill-modal"),
    btnTriggerPrint: document.getElementById("btn-trigger-print"),
    btnBillWhatsapp: document.getElementById("btn-bill-whatsapp"),
    btnBillDownloadPdf: document.getElementById("btn-bill-download-pdf"),
    btnBillBluetooth: document.getElementById("btn-bill-bluetooth"),
    btnBillUsb: document.getElementById("btn-bill-usb"),
    btnPaper58mm: document.getElementById("btn-paper-58mm"),
    btnPaper80mm: document.getElementById("btn-paper-80mm"),
    btnBillTypeCustomer: document.getElementById("btn-bill-type-customer"),
    btnBillTypeKot: document.getElementById("btn-bill-type-kot"),
    billPaymentMode: document.getElementById("bill-payment-mode"),
    billTaxRate: document.getElementById("bill-tax-rate"),
    billDiscountAmount: document.getElementById("bill-discount-amount"),
    billPreviewCard: document.getElementById("bill-preview-card"),
    btnHeaderPrintLast: document.getElementById("btn-header-print-last"),

    // Customer WhatsApp DPDP Consent Modal
    whatsappConsentModal: document.getElementById("whatsapp-consent-modal"),
    btnCloseWaConsent: document.getElementById("btn-close-wa-consent"),
    btnCancelWaConsent: document.getElementById("btn-cancel-wa-consent"),
    waConsentForm: document.getElementById("wa-consent-form"),
    waCustomerPhone: document.getElementById("wa-customer-phone"),
    chkDpdpConsent: document.getElementById("chk-dpdp-consent"),
    btnConfirmWaSend: document.getElementById("btn-confirm-wa-send")
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
  /**
   * Restaurant Thermal Receipt & KOT Builder (Formatted strictly for 58mm & 80mm roll paper)
   */
  function buildThermalReceiptHtml(order, isKot, options = {}) {
    if (!order) return `<div style="text-align:center;padding:20px;color:#64748B;">No order selected.</div>`;

    const prof = state.storeProfile || {};
    const is58mm = (state.paperWidth || "58mm") === "58mm";
    const restaurantName = escapeHtml((prof.restaurantName || state.shopName || "RESTAURANT").toUpperCase());
    const orderId = escapeHtml(order.orderId || "ORD");
    const tableNum = escapeHtml(order.tableNumber || "1");
    const formattedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const formattedTime = formatTicketTime(order.timestamp);
    const paymentMode = escapeHtml(options.paymentMode || "Paid (UPI / Online)");
    const taxRate = typeof options.taxRate === "number" ? options.taxRate : 5;
    const discountInput = typeof options.discountAmount === "number" ? options.discountAmount : 0;
    const waiterTag = escapeHtml(prof.waiterTag || "Counter POS 01");
    const outletAddress = escapeHtml(prof.storeAddress || "");
    const outletContact = escapeHtml(prof.phoneNumber || "");
    const gstin = escapeHtml(prof.gstin || "");
    const footerMsg = escapeHtml(prof.footerMessage || "Thank you for dining with us! Please visit again.");

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
          <td style="text-align:left; padding-right:4px;">
            <strong>${escapeHtml(dish.name)}</strong>
            ${dish.note ? `<span class="receipt-item-note">* ${escapeHtml(dish.note)}</span>` : ""}
          </td>
          <td style="text-align:center;">${qty}</td>
          ${!isKot ? `
            <td style="text-align:right;">${unitRate > 0 ? (state.currency + unitRate.toFixed(0)) : "-"}</td>
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
        ${!isKot ? `
          ${(outletAddress || outletContact) ? `
            <div class="receipt-tagline">
              ${outletAddress ? `${outletAddress}` : ""}
              ${(outletAddress && outletContact) ? ` &bull; ` : ""}
              ${outletContact ? `Ph: ${outletContact}` : ""}
            </div>
          ` : `<div class="receipt-tagline" style="font-style:italic;color:#94a3b8;font-size:0.68rem;">(Set address in Store Profile)</div>`}
          ${gstin ? `<div style="font-size:0.7rem; font-weight:600; color:#334155; margin-top:1px;">GSTIN: ${gstin}</div>` : ""}
        ` : `
          <div class="receipt-tagline">Live Preparation Docket</div>
        `}
      </div>

      <div class="receipt-divider">------------------------------------------------</div>

      <div class="receipt-meta-grid" style="font-size:${is58mm ? '10px' : '11px'};">
        <div><strong>Bill No:</strong> #${orderId}</div>
        <div style="text-align:right;"><strong>Date:</strong> ${formattedDate}</div>
        <div><span class="receipt-table-highlight">TABLE ${tableNum}</span></div>
        <div style="text-align:right;"><strong>Time:</strong> ${formattedTime}</div>
        ${!isKot ? `
          <div><strong>Staff:</strong> ${waiterTag}</div>
          <div style="text-align:right;"><strong>Mode:</strong> ${paymentMode.replace("Paid ", "")}</div>
        ` : `
          <div style="grid-column: 1 / -1; font-weight:700; color:#000;">DINE-IN KOT &bull; DISPATCH DESK</div>
        `}
      </div>

      <div class="receipt-divider double"></div>

      <table class="receipt-items-table" style="font-size:${is58mm ? '10px' : '11px'};">
        <thead>
          <tr>
            <th style="text-align:left; width:${isKot ? '82%' : '44%'};">ITEM</th>
            <th style="text-align:center; width:14%;">QTY</th>
            ${!isKot ? `
              <th style="text-align:right; width:18%;">RATE</th>
              <th style="text-align:right; width:24%;">TOTAL</th>
            ` : ""}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="${isKot ? 2 : 4}" style="text-align:center;">No items recorded</td></tr>`}
        </tbody>
      </table>

      <div class="receipt-divider">------------------------------------------------</div>

      ${!isKot ? `
        <div class="receipt-totals-grid" style="font-size:${is58mm ? '10px' : '11px'};">
          <div class="receipt-total-row">
            <span>Items Count: ${dishList.length} (Qty: ${totalQty})</span>
            <span>Subtotal: ${state.currency}${subtotal.toFixed(2)}</span>
          </div>
          ${discount > 0 ? `
            <div class="receipt-total-row" style="color:#DC2626;">
              <span>Discount Applied:</span>
              <span>-${state.currency}${discount.toFixed(2)}</span>
            </div>
          ` : ""}
          ${taxAmount > 0 ? (
            taxRate === 5 ? `
              <div class="receipt-total-row">
                <span>CGST (2.5%):</span>
                <span>+${state.currency}${(taxAmount / 2).toFixed(2)}</span>
              </div>
              <div class="receipt-total-row">
                <span>SGST (2.5%):</span>
                <span>+${state.currency}${(taxAmount / 2).toFixed(2)}</span>
              </div>
            ` : `
              <div class="receipt-total-row">
                <span>GST (${taxRate}%):</span>
                <span>+${state.currency}${taxAmount.toFixed(2)}</span>
              </div>
            `
          ) : ""}
          <div class="receipt-divider double"></div>
          <div class="receipt-grand-total" style="font-size:${is58mm ? '1.05rem' : '1.18rem'};">
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
          <strong style="text-transform:uppercase; font-size:0.72rem;">Customer / Prep Instructions:</strong>
          <div style="margin-top:2px;">${escapeHtml(order.customerNotes)}</div>
        </div>
      ` : ""}

      <div class="receipt-footer">
        ${!isKot ? `
          <div style="font-weight:600; white-space:pre-line;">${footerMsg}</div>

          <!-- Crisp UPI Quick-Pay / Verification QR Code Container -->
          <div class="receipt-qr-wrap">
            <div class="receipt-qr-code" id="receipt-qr-box"></div>
            <span class="receipt-qr-caption">Scan to Pay UPI / Digital Bill</span>
          </div>

          <div class="receipt-powered">Powered by AOLA Smart QR Ordering</div>
        ` : `
          <div>*** DISPATCH TO TABLE ${tableNum} WHEN PREPARED ***</div>
        `}
      </div>
    `;
  }

  /**
   * Update the live preview card in the modal and sync to the print container
   */
  function updateBillPreview() {
    if (!billState.order) return;
    const is58mm = (state.paperWidth || "58mm") === "58mm";

    // Set paper width format class
    if (el.billPreviewCard) {
      el.billPreviewCard.classList.toggle("paper-58mm", is58mm);
      el.billPreviewCard.classList.toggle("paper-80mm", !is58mm);
    }
    if (el.printableReceipt) {
      el.printableReceipt.classList.toggle("paper-58mm", is58mm);
      el.printableReceipt.classList.toggle("paper-80mm", !is58mm);
    }

    if (el.btnPaper58mm) el.btnPaper58mm.classList.toggle("active", is58mm);
    if (el.btnPaper80mm) el.btnPaper80mm.classList.toggle("active", !is58mm);

    const html = buildThermalReceiptHtml(billState.order, billState.isKot, billState);
    if (el.billPreviewCard) el.billPreviewCard.innerHTML = html;
    if (el.printableReceipt) el.printableReceipt.innerHTML = html;

    // Render crisp QR code inside preview card
    if (!billState.isKot) {
      renderReceiptQrCode();
    }
  }

  /**
   * Generates a crisp QR code for UPI Quick-Pay & Digital Receipt verification
   */
  function renderReceiptQrCode() {
    const qrBox = document.getElementById("receipt-qr-box");
    if (!qrBox || !billState.order) return;

    qrBox.innerHTML = "";
    const ord = billState.order;
    const subtotal = ord.totalPrice || 0;
    const discount = billState.discountAmount || 0;
    const tax = (subtotal - discount) * (billState.taxRate / 100);
    const grandTotal = Math.max(0, subtotal - discount + tax);

    const prof = state.storeProfile || {};
    const upiPayee = prof.upiId || "aola.pay@icici";
    const upiName = prof.restaurantName || state.shopName || "Restaurant";

    // Standard NPCI UPI Intent URI for instantaneous counter payments
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiPayee)}&pn=${encodeURIComponent(upiName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Order " + ord.orderId)}`;

    if (typeof QRCode !== "undefined") {
      try {
        new QRCode(qrBox, {
          text: upiUri,
          width: 82,
          height: 82,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
        return;
      } catch (e) {
        console.warn("[QRCode Render Error]:", e);
      }
    }

    // High-resolution inline SVG fallback if external library is blocked or offline
    qrBox.innerHTML = `
      <svg viewBox="0 0 100 100" width="82" height="82" shape-rendering="crispEdges">
        <rect width="100" height="100" fill="#ffffff"/>
        <!-- Corner Finder Patterns -->
        <rect x="8" y="8" width="28" height="28" fill="#000000"/>
        <rect x="14" y="14" width="16" height="16" fill="#ffffff"/>
        <rect x="18" y="18" width="8" height="8" fill="#000000"/>
        
        <rect x="64" y="8" width="28" height="28" fill="#000000"/>
        <rect x="70" y="14" width="16" height="16" fill="#ffffff"/>
        <rect x="74" y="18" width="8" height="8" fill="#000000"/>
        
        <rect x="8" y="64" width="28" height="28" fill="#000000"/>
        <rect x="14" y="70" width="16" height="16" fill="#ffffff"/>
        <rect x="18" y="74" width="8" height="8" fill="#000000"/>
        
        <!-- Synthetic QR Data Modules -->
        <rect x="44" y="12" width="12" height="12" fill="#000000"/>
        <rect x="42" y="42" width="16" height="16" fill="#000000"/>
        <rect x="12" y="44" width="10" height="10" fill="#000000"/>
        <rect x="78" y="44" width="10" height="10" fill="#000000"/>
        <rect x="44" y="76" width="12" height="12" fill="#000000"/>
        <rect x="68" y="68" width="8" height="8" fill="#000000"/>
        <rect x="80" y="80" width="8" height="8" fill="#000000"/>
      </svg>
    `;
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
   * Dedicated Isolated Iframe Print Pipeline with Strict Zero Page Margins (@page { margin: 0; })
   */
  function triggerPrintReceipt() {
    updateBillPreview();
    const is58mm = (state.paperWidth || "58mm") === "58mm";
    const receiptHtml = buildThermalReceiptHtml(billState.order, billState.isKot, billState);

    try {
      let frame = el.isolatedPrintFrame || document.getElementById("isolated-print-frame");
      if (!frame) {
        frame = document.createElement("iframe");
        frame.id = "isolated-print-frame";
        frame.style.cssText = "position:fixed; left:0; top:0; width:1px; height:1px; opacity:0.01; pointer-events:none; border:none;";
        document.body.appendChild(frame);
      }

      if (frame && frame.contentWindow) {
        const doc = frame.contentWindow.document;
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>AOLA Receipt #${billState.order ? billState.order.orderId : ''}</title>
            <style>
              @page {
                margin: 0 !important;
                size: ${is58mm ? '58mm' : '80mm'} auto;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #FFFFFF !important;
                color: #000000 !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: ${is58mm ? '10px' : '11.5px'} !important;
                line-height: 1.35 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-container {
                width: ${is58mm ? '48mm' : '72mm'};
                max-width: ${is58mm ? '52mm' : '76mm'};
                margin: 0 auto;
                padding: 1mm 2mm;
                box-sizing: border-box;
              }
              .receipt-header { text-align: center; margin-bottom: 6px; }
              .receipt-brand-title { font-size: 1.15rem; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
              .receipt-subtitle { font-size: 0.8rem; font-weight: 700; margin-bottom: 2px; }
              .receipt-tagline { font-size: 0.7rem; color: #444; }
              .receipt-divider { border-top: 1px dashed #000; margin: 6px 0; }
              .receipt-divider.double { border-top: 2px solid #000; }
              .receipt-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; font-size: 0.78rem; margin: 6px 0; }
              .receipt-table-highlight { font-size: 0.95rem; font-weight: 800; }
              .receipt-items-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10.5px; }
              .receipt-items-table th { padding: 3px 0; border-bottom: 1px dashed #000; font-weight: 700; text-align: left; }
              .receipt-items-table td { padding: 3px 0; vertical-align: top; }
              .receipt-item-note { font-size: 0.7rem; font-style: italic; display: block; }
              .receipt-totals-grid { margin: 6px 0; }
              .receipt-total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 0.78rem; }
              .receipt-grand-total { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 1.1rem; font-weight: 800; }
              .receipt-kot-summary { text-align: center; padding: 6px 0; font-size: 0.9rem; font-weight: 800; }
              .receipt-notes-box { border-left: 2px solid #000; padding: 4px 6px; margin: 6px 0; font-size: 0.75rem; }
              .receipt-footer { text-align: center; margin-top: 8px; font-size: 0.74rem; line-height: 1.35; }
              .receipt-powered { margin-top: 4px; font-size: 0.68rem; text-transform: uppercase; }
              .receipt-qr-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px 0; }
              .receipt-qr-code { width: 80px; height: 80px; padding: 2px; }
              .receipt-qr-caption { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; margin-top: 3px; }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${receiptHtml}
            </div>
          </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch (pe) {
            console.warn("[iframe print error]:", pe);
            window.print();
          }
        }, 200);
        return;
      }
    } catch (err) {
      console.warn("[Isolated iframe print warning, falling back]:", err);
    }

    // Default window.print fallback
    window.print();
  }

  /**
   * ESC/POS Binary Command Stream Encoder for Web Bluetooth & WebUSB
   * Handles 58mm (32 cols) and 80mm (48 cols) continuous roll paper
   */
  function buildEscPosCommandStream(order, isKot, options = {}) {
    const is58mm = (state.paperWidth || "58mm") === "58mm";
    const lineWidth = is58mm ? 32 : 48;
    const encoder = new TextEncoder();
    const buffer = [];

    function pushBytes(...bytes) {
      for (const b of bytes) buffer.push(b);
    }

    function pushText(text) {
      const encoded = encoder.encode(text);
      for (let i = 0; i < encoded.length; i++) buffer.push(encoded[i]);
    }

    function pushLine(text = "") {
      pushText(text + "\n");
    }

    function pushDivider(char = "-") {
      pushLine(char.repeat(lineWidth));
    }

    function pushTwoColumns(left, right) {
      left = String(left || "");
      right = String(right || "");
      const spaces = Math.max(1, lineWidth - left.length - right.length);
      pushLine(left + " ".repeat(spaces) + right);
    }

    const prof = state.storeProfile || {};

    // 1. Initialize Printer (ESC @)
    pushBytes(0x1B, 0x40);

    // 2. Center Align for Header (ESC a 1)
    pushBytes(0x1B, 0x61, 0x01);

    // Double Height & Width for Restaurant Name
    pushBytes(0x1B, 0x21, 0x30);
    pushLine((prof.restaurantName || state.shopName || "RESTAURANT").toUpperCase());

    // Reset Font
    pushBytes(0x1B, 0x21, 0x00);
    if (!isKot) {
      pushLine("TAX INVOICE / CASH BILL");
      if (prof.storeAddress) pushLine(prof.storeAddress);
      if (prof.phoneNumber) pushLine("Ph: " + prof.phoneNumber);
      if (prof.gstin) pushLine("GSTIN: " + prof.gstin);
    } else {
      pushLine("*** KITCHEN ORDER TICKET (KOT) ***");
      pushLine("Preparation Docket");
    }

    // 3. Left Align for Meta
    pushBytes(0x1B, 0x61, 0x00);
    pushDivider("-");

    const formattedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const formattedTime = formatTicketTime(order.timestamp);
    pushTwoColumns("Bill: #" + (order.orderId || "ORD"), "Date: " + formattedDate);
    pushTwoColumns("Table: TABLE " + (order.tableNumber || "1"), "Time: " + formattedTime);
    pushTwoColumns("Staff: " + (prof.waiterTag || "Counter POS 01"), options.paymentMode ? options.paymentMode.replace("Paid ", "") : "UPI");

    pushDivider("=");

    // 4. Line Items Table
    const dishList = parseOrderDishItems(order.items);
    let subtotal = 0;

    if (is58mm) {
      pushLine("ITEM                 QTY  TOTAL");
      pushDivider("-");
      dishList.forEach(dish => {
        const qty = dish.qty || 1;
        let lineTotal = dish.rawPrice || 0;
        if (!lineTotal && dish.price) {
          lineTotal = parseFloat(String(dish.price).replace(/[^0-9.]/g, "")) || 0;
        }
        subtotal += lineTotal;
        const name = dish.name.substring(0, 19).padEnd(20, " ");
        const q = String(qty).padStart(3, " ");
        const totalStr = (state.currency + lineTotal.toFixed(0)).padStart(8, " ");
        pushLine(name + q + totalStr);
        if (dish.note) pushLine("  *Note: " + dish.note.substring(0, 24));
      });
    } else {
      pushLine("ITEM                          QTY    RATE   TOTAL");
      pushDivider("-");
      dishList.forEach(dish => {
        const qty = dish.qty || 1;
        let lineTotal = dish.rawPrice || 0;
        if (!lineTotal && dish.price) {
          lineTotal = parseFloat(String(dish.price).replace(/[^0-9.]/g, "")) || 0;
        }
        const unitRate = qty > 0 ? (lineTotal / qty) : lineTotal;
        subtotal += lineTotal;
        const name = dish.name.substring(0, 27).padEnd(28, " ");
        const q = String(qty).padStart(4, " ");
        const r = (state.currency + unitRate.toFixed(0)).padStart(7, " ");
        const t = (state.currency + lineTotal.toFixed(0)).padStart(8, " ");
        pushLine(name + q + r + t);
        if (dish.note) pushLine("  *Note: " + dish.note.substring(0, 40));
      });
    }

    if (subtotal <= 0 && order.totalPrice) {
      subtotal = parseFloat(order.totalPrice) || 0;
    }

    pushDivider("-");

    // 5. Summary & Totals
    if (!isKot) {
      const discount = Math.min(subtotal, Math.max(0, options.discountAmount || 0));
      const taxable = Math.max(0, subtotal - discount);
      const taxRate = typeof options.taxRate === "number" ? options.taxRate : 5;
      const taxAmount = (taxRate > 0) ? (taxable * (taxRate / 100)) : 0;
      const grandTotal = Math.max(0, taxable + taxAmount);

      pushTwoColumns("Subtotal:", state.currency + subtotal.toFixed(2));
      if (discount > 0) {
        pushTwoColumns("Discount:", "-" + state.currency + discount.toFixed(2));
      }
      if (taxAmount > 0) {
        if (taxRate === 5) {
          pushTwoColumns("CGST (2.5%):", "+" + state.currency + (taxAmount / 2).toFixed(2));
          pushTwoColumns("SGST (2.5%):", "+" + state.currency + (taxAmount / 2).toFixed(2));
        } else {
          pushTwoColumns(`GST (${taxRate}%):`, "+" + state.currency + taxAmount.toFixed(2));
        }
      }
      pushDivider("=");

      // Bold Grand Total
      pushBytes(0x1B, 0x45, 0x01);
      pushTwoColumns("GRAND TOTAL:", state.currency + grandTotal.toFixed(2));
      pushBytes(0x1B, 0x45, 0x00);
      pushDivider("=");
    } else {
      pushBytes(0x1B, 0x61, 0x01);
      pushBytes(0x1B, 0x45, 0x01);
      pushLine("*** TOTAL ITEMS: " + dishList.length + " ***");
      pushBytes(0x1B, 0x45, 0x00);
    }

    if (order.customerNotes) {
      pushLine("KITCHEN NOTE: " + order.customerNotes);
      pushDivider("-");
    }

    // 6. Footer (Center)
    pushBytes(0x1B, 0x61, 0x01);
    if (!isKot) {
      if (prof.footerMessage) {
        pushLine(prof.footerMessage);
      } else {
        pushLine("Thank you for dining with us!");
        pushLine("Please visit us again soon.");
      }
      pushLine("Powered by AOLA Smart QR");
    } else {
      pushLine("*** READY FOR DISPATCH TO TABLE " + (order.tableNumber || "1") + " ***");
    }

    // Feed lines & Paper Cut (GS V A 0)
    pushBytes(0x1B, 0x64, 0x04);
    pushBytes(0x1D, 0x56, 0x41, 0x00);

    return new Uint8Array(buffer);
  }

  /**
   * Pre-configured Web Bluetooth ESC/POS Raw Command Stream Pipeline
   */
  async function printViaWebBluetooth() {
    if (!navigator.bluetooth) {
      showToast("Web Bluetooth is not supported on this device/browser. Please use Chrome/Edge or Browser Print.", "error", 6000);
      return;
    }

    if (!billState.order) {
      showToast("No order selected to print.", "error");
      return;
    }

    try {
      showToast("Requesting Bluetooth Thermal Printer...", "info");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "49535343-fe7d-4ae5-8fa9-9fafd205e455",
          0xffe0,
          0xfff0
        ]
      });

      const server = await device.gatt.connect();
      showToast(`Connected to ${device.name || "Thermal Printer"}. Streaming ESC/POS...`, "info");

      let printChar = null;
      const services = await server.getPrimaryServices();
      for (const s of services) {
        const chars = await s.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            printChar = c;
            break;
          }
        }
        if (printChar) break;
      }

      if (!printChar) {
        throw new Error("No writable ESC/POS characteristic found on this printer.");
      }

      const escPosBytes = buildEscPosCommandStream(billState.order, billState.isKot, billState);

      // Transmit in 128-byte chunks
      const chunkSize = 128;
      for (let i = 0; i < escPosBytes.length; i += chunkSize) {
        const chunk = escPosBytes.slice(i, i + chunkSize);
        if (printChar.properties.writeWithoutResponse) {
          await printChar.writeValueWithoutResponse(chunk);
        } else {
          await printChar.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 20));
      }

      showToast("✅ Bluetooth ESC/POS Print Job Sent!", "success");
    } catch (err) {
      if (err.name !== "NotFoundError") {
        console.error("[Web Bluetooth Print Error]:", err);
        showToast("Bluetooth Print Failed: " + (err.message || err), "error", 5000);
      }
    }
  }

  /**
   * Pre-configured WebUSB ESC/POS Raw Command Stream Pipeline
   */
  async function printViaWebUsb() {
    if (!navigator.usb) {
      showToast("WebUSB is not supported on this browser. Please use Chrome/Edge or Browser Print.", "error", 6000);
      return;
    }

    if (!billState.order) {
      showToast("No order selected to print.", "error");
      return;
    }

    try {
      showToast("Select USB POS Thermal Printer...", "info");
      const device = await navigator.usb.requestDevice({
        filters: [{ classCode: 7 }] // USB Printer Class
      });

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);

      const endpoint = device.configuration.interfaces[0].alternate.endpoints.find(
        e => e.direction === "out"
      );

      if (!endpoint) {
        throw new Error("No bulk OUT endpoint found on USB printer device.");
      }

      const escPosBytes = buildEscPosCommandStream(billState.order, billState.isKot, billState);
      await device.transferOut(endpoint.endpointNumber, escPosBytes);

      showToast("✅ USB Thermal Print Job Sent!", "success");
      await device.close();
    } catch (err) {
      if (err.name !== "NotFoundError") {
        console.error("[WebUSB Print Error]:", err);
        showToast("USB Print Failed: " + (err.message || err), "error", 5000);
      }
    }
  }

  /**
   * Client-Side Branded PDF Invoice Generator (html2pdf.js)
   */
  function generateAndDownloadPdf() {
    if (!billState.order) {
      showToast("No order selected for invoice generation.", "error");
      return;
    }

    if (typeof html2pdf === "undefined") {
      showToast("PDF generator library is still loading. Please retry in a few moments.", "info");
      return;
    }

    showToast("Generating PDF invoice...", "info");
    const is58mm = (state.paperWidth || "58mm") === "58mm";
    const element = el.billPreviewCard;
    const orderId = billState.order.orderId || "Bill";

    const opt = {
      margin: is58mm ? [2, 2, 2, 2] : [4, 4, 4, 4],
      filename: `Invoice_${orderId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true },
      jsPDF: {
        unit: "mm",
        format: is58mm ? [58, 220] : [80, 260],
        orientation: "portrait"
      }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      showToast("✅ PDF Invoice downloaded successfully!", "success");
    }).catch(err => {
      console.error("[html2pdf error]:", err);
      showToast("Failed to generate PDF: " + err.message, "error");
    });
  }

  /**
   * DPDP Consent Modal Open / Close Handlers
   */
  function openWhatsAppConsentModal() {
    if (!billState.order) {
      showToast("No order selected to send.", "error");
      return;
    }
    if (el.waCustomerPhone) el.waCustomerPhone.value = "";
    if (el.chkDpdpConsent) el.chkDpdpConsent.checked = true;
    if (el.whatsappConsentModal) el.whatsappConsentModal.classList.add("open");
    if (el.waCustomerPhone) el.waCustomerPhone.focus();
  }

  function closeWhatsAppConsentModal() {
    if (el.whatsappConsentModal) el.whatsappConsentModal.classList.remove("open");
  }

  /**
   * Formats and Dispatches Digital Invoice via WhatsApp with DPDP Compliance Tag
   */
  function handleWhatsAppDispatch() {
    const ord = billState.order;
    if (!ord) return;

    if (!el.chkDpdpConsent || !el.chkDpdpConsent.checked) {
      showToast("DPDP consent is required by law to dispatch digital invoices via WhatsApp.", "error");
      return;
    }

    let phone = (el.waCustomerPhone ? el.waCustomerPhone.value : "").replace(/[^0-9]/g, "");
    if (!phone || phone.length < 10) {
      showToast("Please enter a valid 10-digit customer mobile number.", "error");
      if (el.waCustomerPhone) el.waCustomerPhone.focus();
      return;
    }

    if (phone.length === 10) {
      phone = "91" + phone;
    }

    const dishList = parseOrderDishItems(ord.items);
    const itemsText = dishList.map(d => `• ${d.qty}x ${d.name} ${d.price ? `(${d.price})` : ""}`).join("\n");
    const subtotal = ord.totalPrice || 0;
    const discount = billState.discountAmount || 0;
    const tax = (subtotal - discount) * (billState.taxRate / 100);
    const grandTotal = Math.max(0, subtotal - discount + tax);

    const prof = state.storeProfile || {};
    const restaurantName = (prof.restaurantName || state.shopName || "RESTAURANT").toUpperCase();
    const footerMsg = prof.footerMessage || "Thank you for dining with us! 🙏";

    const digitalBillUrl = `${window.location.origin}${window.location.pathname.replace("owner.html", "index.html")}?shop=${encodeURIComponent(state.shopId)}&bill=${encodeURIComponent(ord.orderId)}`;

    const text = `🧾 *${restaurantName}*\n` +
      `*TAX INVOICE / DINING BILL #${ord.orderId}*\n` +
      `🍽️ Table: ${ord.tableNumber} | ⏰ ${formatTicketTime(ord.timestamp)}\n` +
      `💳 Payment: ${billState.paymentMode}\n` +
      `--------------------------------\n` +
      `*ITEMS ORDERED:*\n${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal: ${state.currency}${subtotal.toFixed(2)}\n` +
      (billState.taxRate > 0 ? `GST (${billState.taxRate}%): +${state.currency}${tax.toFixed(2)}\n` : "") +
      (discount > 0 ? `Discount: -${state.currency}${discount.toFixed(2)}\n` : "") +
      `*GRAND TOTAL: ${state.currency}${grandTotal.toFixed(2)}*\n` +
      `--------------------------------\n` +
      `📄 *View / Download Your Digital Bill Online:*\n${digitalBillUrl}\n` +
      `--------------------------------\n` +
      `_Customer consented to receive receipt via WhatsApp (DPDP Tag: DPDP-AOLA-${ord.orderId})_\n\n` +
      `${footerMsg}`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");

    closeWhatsAppConsentModal();
    showToast("✅ WhatsApp invoice dispatched! (DPDP consent recorded)", "success");
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
    openBillModal(orderId, true);
    triggerPrintReceipt();
    showToast("Kitchen KOT ready for Table " + order.tableNumber, "info");
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
   * Load store profile details from localStorage for fast offline rendering
   */
  function loadStoreProfileFromStorage() {
    try {
      const tenantKey = state.shopId ? `AOLA_STORE_PROFILE_${state.shopId}` : "AOLA_STORE_PROFILE_default";
      const localData = localStorage.getItem(tenantKey) || localStorage.getItem("AOLA_STORE_PROFILE");
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed && typeof parsed === "object") {
          state.storeProfile = { ...state.storeProfile, ...parsed };
        }
      }
      if (!state.storeProfile.restaurantName && el.ownerShopName && el.ownerShopName.textContent) {
        state.storeProfile.restaurantName = el.ownerShopName.textContent;
      }
    } catch (err) {
      console.warn("Could not parse storeProfile from localStorage:", err);
    }
  }

  /**
   * Fetch saved store profile from backend / Google Sheets (Settings tab)
   */
  async function fetchStoreProfileFromBackend() {
    if (!state.shopId || !state.pin) return;
    try {
      const res = await AOLA_API.post("owner_get_settings", {
        shop_id: state.shopId,
        pin: state.pin
      });
      if (res && res.success && res.settings) {
        state.storeProfile = {
          ...state.storeProfile,
          ...res.settings
        };
        // Persist to localStorage
        const tenantKey = `AOLA_STORE_PROFILE_${state.shopId}`;
        localStorage.setItem(tenantKey, JSON.stringify(state.storeProfile));
        localStorage.setItem("AOLA_STORE_PROFILE", JSON.stringify(state.storeProfile));

        if (state.storeProfile.restaurantName && el.ownerShopName) {
          el.ownerShopName.textContent = state.storeProfile.restaurantName;
        }

        // If receipt preview is currently open, re-render it with new settings
        if (billState.order) {
          updateBillPreview();
        }
      }
    } catch (err) {
      console.warn("Error fetching store profile from cloud:", err);
    }
  }

  /**
   * Open the Store Profile & Settings Modal
   */
  function openSettingsModal() {
    loadStoreProfileFromStorage();
    if (el.settingsRestaurantName) {
      el.settingsRestaurantName.value = state.storeProfile.restaurantName || (el.ownerShopName ? el.ownerShopName.textContent : "") || "";
    }
    if (el.settingsStoreAddress) {
      el.settingsStoreAddress.value = state.storeProfile.storeAddress || "";
    }
    if (el.settingsPhoneNumber) {
      el.settingsPhoneNumber.value = state.storeProfile.phoneNumber || "";
    }
    if (el.settingsGstin) {
      el.settingsGstin.value = state.storeProfile.gstin || "";
    }
    if (el.settingsWaiterTag) {
      el.settingsWaiterTag.value = state.storeProfile.waiterTag || "Counter POS 01";
    }
    if (el.settingsUpiId) {
      el.settingsUpiId.value = state.storeProfile.upiId || "";
    }
    if (el.settingsFooterMessage) {
      el.settingsFooterMessage.value = state.storeProfile.footerMessage || "Thank you for dining with us! Please visit again.";
    }

    if (el.settingsModal) {
      el.settingsModal.classList.add("open");
      if (el.settingsRestaurantName) el.settingsRestaurantName.focus();
    }
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Close the Store Profile & Settings Modal
   */
  function closeSettingsModal() {
    if (el.settingsModal) {
      el.settingsModal.classList.remove("open");
    }
  }

  /**
   * Handle Settings form submission
   */
  async function handleSaveSettingsSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const newProfile = {
      restaurantName: el.settingsRestaurantName ? el.settingsRestaurantName.value.trim() : "",
      storeAddress: el.settingsStoreAddress ? el.settingsStoreAddress.value.trim() : "",
      phoneNumber: el.settingsPhoneNumber ? el.settingsPhoneNumber.value.trim() : "",
      gstin: el.settingsGstin ? el.settingsGstin.value.trim().toUpperCase() : "",
      waiterTag: (el.settingsWaiterTag && el.settingsWaiterTag.value.trim()) || "Counter POS 01",
      upiId: el.settingsUpiId ? el.settingsUpiId.value.trim() : "",
      footerMessage: (el.settingsFooterMessage && el.settingsFooterMessage.value.trim()) || "Thank you for dining with us! Please visit again."
    };

    state.storeProfile = { ...state.storeProfile, ...newProfile };

    // Persist immediately to localStorage
    const tenantKey = state.shopId ? `AOLA_STORE_PROFILE_${state.shopId}` : "AOLA_STORE_PROFILE_default";
    localStorage.setItem(tenantKey, JSON.stringify(state.storeProfile));
    localStorage.setItem("AOLA_STORE_PROFILE", JSON.stringify(state.storeProfile));

    if (state.storeProfile.restaurantName && el.ownerShopName) {
      el.ownerShopName.textContent = state.storeProfile.restaurantName;
    }

    // Refresh active bill preview if open
    if (billState.order) {
      updateBillPreview();
    }

    closeSettingsModal();
    showToast("✅ Store profile saved! Receipts updated instantly.", "success");

    // Sync to backend if logged in
    if (state.shopId && state.pin) {
      if (el.btnSaveSettings) {
        el.btnSaveSettings.disabled = true;
        el.btnSaveSettings.textContent = "Syncing to Cloud...";
      }
      try {
        const res = await AOLA_API.post("owner_save_settings", {
          shop_id: state.shopId,
          pin: state.pin,
          settings: state.storeProfile
        });
        if (res && res.success) {
          showToast("☁️ Store profile synced to cloud & other devices!", "success");
        } else if (res && res.error) {
          console.warn("Cloud sync warning:", res.error);
        }
      } catch (err) {
        console.warn("Failed to sync settings with backend:", err);
      } finally {
        if (el.btnSaveSettings) {
          el.btnSaveSettings.disabled = false;
          el.btnSaveSettings.innerHTML = `<i data-lucide="save" style="width:16px;height:16px;"></i> Save & Apply to Receipts`;
          if (window.lucide) lucide.createIcons();
        }
      }
    }
  }

  /**
   * Initialize Owner Dashboard
   */
  function init() {
    loadStoreProfileFromStorage();

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

    // Instant real-time order push handler
    window.addEventListener("aola_new_order", () => {
      fetchOrders(false);
    });

    // Manual POS Terminal Triggers
    if (el.btnHeaderPos) el.btnHeaderPos.onclick = openPosModal;
    if (el.viewTabPos) el.viewTabPos.onclick = openPosModal;
    if (el.btnClosePos) el.btnClosePos.onclick = closePosModal;
    if (el.btnPosCancel) el.btnPosCancel.onclick = closePosModal;
    if (el.posModal) {
      el.posModal.onclick = (e) => {
        if (e.target === el.posModal) closePosModal();
      };
    }
    if (el.btnPosQuickClear) el.btnPosQuickClear.onclick = clearCashierCart;
    if (el.btnPosClearItems) el.btnPosClearItems.onclick = clearCashierCart;

    if (el.posDishSearch) {
      el.posDishSearch.oninput = (e) => {
        state.posSearchQuery = e.target.value.toLowerCase().trim();
        if (el.btnPosClearSearch) {
          el.btnPosClearSearch.style.display = state.posSearchQuery ? "block" : "none";
        }
        renderPosMenu();
      };
    }
    if (el.btnPosClearSearch) {
      el.btnPosClearSearch.onclick = () => {
        if (el.posDishSearch) el.posDishSearch.value = "";
        state.posSearchQuery = "";
        el.btnPosClearSearch.style.display = "none";
        renderPosMenu();
        if (el.posDishSearch) el.posDishSearch.focus();
      };
    }
    if (el.btnPosResetFilters) {
      el.btnPosResetFilters.onclick = () => {
        state.posCategoryFilter = "all";
        state.posSearchQuery = "";
        if (el.posDishSearch) el.posDishSearch.value = "";
        if (el.btnPosClearSearch) el.btnPosClearSearch.style.display = "none";
        renderPosCategories();
        renderPosMenu();
      };
    }

    if (el.posSourceSelector) {
      el.posSourceSelector.querySelectorAll(".pos-source-btn").forEach((btn) => {
        btn.onclick = () => setPosOrderSource(btn.dataset.source);
      });
    }

    if (el.posQuickTables) {
      el.posQuickTables.querySelectorAll(".pos-table-chip").forEach((chip) => {
        chip.onclick = () => {
          el.posQuickTables.querySelectorAll(".pos-table-chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          state.posSelectedTable = chip.dataset.table;
          if (el.posOrderRef) el.posOrderRef.value = chip.dataset.table;
        };
      });
    }

    if (el.btnPosSubmitOrder) {
      el.btnPosSubmitOrder.onclick = handlePosSubmitOrder;
    }

    // View Switcher (Tickets vs History vs Menu vs Expenses vs Trends)
    if (el.viewTabOrders) {
      el.viewTabOrders.onclick = () => switchView("orders");
    }
    if (el.viewTabHistory) {
      el.viewTabHistory.onclick = () => switchView("history");
    }
    if (el.viewTabMenu) {
      el.viewTabMenu.onclick = () => switchView("menu");
    }
    if (el.viewTabExpenses) {
      el.viewTabExpenses.onclick = () => switchView("expenses");
    }
    if (el.viewTabTrends) {
      el.viewTabTrends.onclick = () => switchView("trends");
    }

    // Order History Sub-tabs (All vs Completed vs Voided Audit Trail)
    if (el.btnSubtabAllOrders) {
      el.btnSubtabAllOrders.onclick = () => {
        state.historySubtab = "all";
        updateHistorySubtabUi();
        renderHistoryView();
      };
    }
    if (el.btnSubtabCompletedOrders) {
      el.btnSubtabCompletedOrders.onclick = () => {
        state.historySubtab = "completed";
        updateHistorySubtabUi();
        renderHistoryView();
      };
    }
    if (el.btnSubtabVoidedOrders) {
      el.btnSubtabVoidedOrders.onclick = () => {
        state.historySubtab = "voided";
        updateHistorySubtabUi();
        renderHistoryView();
      };
    }

    // Daily Expenses Form & Filter Events
    if (el.ownerExpenseForm) {
      el.ownerExpenseForm.onsubmit = handleSaveExpenseSubmit;
    }
    if (el.btnRefreshExpenses) {
      el.btnRefreshExpenses.onclick = () => fetchExpenses(true);
    }
    if (el.btnExportExpensesCsv) {
      el.btnExportExpensesCsv.onclick = exportExpensesToCsv;
    }
    if (el.filterExpenseCategory) {
      el.filterExpenseCategory.onchange = renderExpensesView;
    }
    if (el.expenseSearchInput) {
      el.expenseSearchInput.oninput = renderExpensesView;
    }

    // Sales Trends Timeframe Switcher & Date Search Controls
    if (el.btnTrendDaily) el.btnTrendDaily.onclick = () => setTrendTimeframe("daily");
    if (el.btnTrendWeekly) el.btnTrendWeekly.onclick = () => setTrendTimeframe("weekly");
    if (el.btnTrendMonthly) el.btnTrendMonthly.onclick = () => setTrendTimeframe("monthly");
    if (el.btnTrendYearly) el.btnTrendYearly.onclick = () => setTrendTimeframe("yearly");

    if (el.trendDateInput) {
      el.trendDateInput.onchange = () => {
        if (el.trendDateInput.value) {
          state.trendSelectedDate = el.trendDateInput.value;
          state.trendTimeframe = "daily";
          setTrendTimeframe("daily");
        }
      };
    }
    if (el.trendBtnToday) {
      el.trendBtnToday.onclick = () => {
        state.trendSelectedDate = toDateInputValue(new Date());
        state.trendTimeframe = "daily";
        setTrendTimeframe("daily");
      };
    }
    if (el.trendBtnYesterday) {
      el.trendBtnYesterday.onclick = () => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        state.trendSelectedDate = toDateInputValue(y);
        state.trendTimeframe = "daily";
        setTrendTimeframe("daily");
      };
    }
    if (el.trendBtnPrevDay) {
      el.trendBtnPrevDay.onclick = () => {
        const base = state.trendSelectedDate || toDateInputValue(new Date());
        const parts = base.split("-");
        const cur = (parts.length === 3)
          ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
          : new Date();
        cur.setDate(cur.getDate() - 1);
        state.trendSelectedDate = toDateInputValue(cur);
        state.trendTimeframe = "daily";
        setTrendTimeframe("daily");
      };
    }
    if (el.trendBtnNextDay) {
      el.trendBtnNextDay.onclick = () => {
        const base = state.trendSelectedDate || toDateInputValue(new Date());
        const parts = base.split("-");
        const cur = (parts.length === 3)
          ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
          : new Date();
        cur.setDate(cur.getDate() + 1);
        state.trendSelectedDate = toDateInputValue(cur);
        state.trendTimeframe = "daily";
        setTrendTimeframe("daily");
      };
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

    // Store Profile & Settings Modal Events
    if (el.btnOpenSettings) el.btnOpenSettings.onclick = openSettingsModal;
    if (el.btnSidebarSettings) el.btnSidebarSettings.onclick = openSettingsModal;
    if (el.btnCloseSettings) el.btnCloseSettings.onclick = closeSettingsModal;
    if (el.btnCancelSettings) el.btnCancelSettings.onclick = closeSettingsModal;
    if (el.settingsModal) {
      el.settingsModal.onclick = (e) => {
        if (e.target === el.settingsModal) closeSettingsModal();
      };
    }
    if (el.settingsForm) {
      el.settingsForm.onsubmit = handleSaveSettingsSubmit;
    }

    // Orders Filter Tabs (Ready to Bill vs In Kitchen Prep)
    if (el.tabPending) {
      el.tabPending.onclick = () => {
        state.activeTab = "ready";
        el.tabPending.classList.add("active");
        if (el.tabCompleted) el.tabCompleted.classList.remove("active");
        renderTickets();
      };
    }

    if (el.tabCompleted) {
      el.tabCompleted.onclick = () => {
        state.activeTab = "pending";
        el.tabCompleted.classList.add("active");
        if (el.tabPending) el.tabPending.classList.remove("active");
        renderTickets();
      };
    }

    if (el.btnQuickToHistory) {
      el.btnQuickToHistory.onclick = () => {
        if (el.viewTabHistory) el.viewTabHistory.click();
      };
    }

    // Thermal Paper Width Selection (58mm vs 80mm)
    if (el.btnPaper58mm) {
      el.btnPaper58mm.onclick = () => {
        state.paperWidth = "58mm";
        localStorage.setItem("AOLA_THERMAL_PAPER_WIDTH", "58mm");
        updateBillPreview();
      };
    }
    if (el.btnPaper80mm) {
      el.btnPaper80mm.onclick = () => {
        state.paperWidth = "80mm";
        localStorage.setItem("AOLA_THERMAL_PAPER_WIDTH", "80mm");
        updateBillPreview();
      };
    }

    // Bill & Invoice Modal Events
    if (el.btnCloseBillModal) el.btnCloseBillModal.onclick = closeBillModal;
    if (el.btnCancelBillModal) el.btnCancelBillModal.onclick = closeBillModal;
    if (el.billModal) {
      el.billModal.onclick = (e) => {
        if (e.target === el.billModal) closeBillModal();
      };
    }
    if (el.btnTriggerPrint) el.btnTriggerPrint.onclick = triggerPrintReceipt;
    if (el.btnBillDownloadPdf) el.btnBillDownloadPdf.onclick = generateAndDownloadPdf;
    if (el.btnBillBluetooth) el.btnBillBluetooth.onclick = printViaWebBluetooth;
    if (el.btnBillUsb) el.btnBillUsb.onclick = printViaWebUsb;
    if (el.btnBillWhatsapp) el.btnBillWhatsapp.onclick = openWhatsAppConsentModal;
    if (el.btnHeaderPrintLast) el.btnHeaderPrintLast.onclick = openLatestBill;

    // DPDP WhatsApp Consent Modal
    if (el.btnCloseWaConsent) el.btnCloseWaConsent.onclick = closeWhatsAppConsentModal;
    if (el.btnCancelWaConsent) el.btnCancelWaConsent.onclick = closeWhatsAppConsentModal;
    if (el.whatsappConsentModal) {
      el.whatsappConsentModal.onclick = (e) => {
        if (e.target === el.whatsappConsentModal) closeWhatsAppConsentModal();
      };
    }
    if (el.waConsentForm) {
      el.waConsentForm.onsubmit = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        handleWhatsAppDispatch();
      };
    }

    // Robust Event Delegation for Kitchen Ticket Action Buttons
    if (el.ticketGrid && !el.ticketGrid._hasDelegatedListeners) {
      el.ticketGrid._hasDelegatedListeners = true;
      el.ticketGrid.addEventListener("click", (e) => {
        // Checkout / Pay button
        const payBtn = e.target.closest(".btn-pay-order") || e.target.closest(".btn-complete-order");
        if (payBtn && payBtn.dataset.id) {
          e.preventDefault();
          e.stopPropagation();
          payOrder(payBtn.dataset.id, payBtn);
          return;
        }

        // Mark Ready button (expedite from owner screen)
        const readyBtn = e.target.closest(".btn-mark-ready");
        if (readyBtn && readyBtn.dataset.id) {
          e.preventDefault();
          e.stopPropagation();
          markOrderReady(readyBtn.dataset.id, readyBtn);
          return;
        }

        const voidBtn = e.target.closest(".btn-void-ticket");
        if (voidBtn && voidBtn.dataset.id) {
          e.preventDefault();
          e.stopPropagation();
          openVoidModal(voidBtn.dataset.id, voidBtn);
          return;
        }

        const quickKotBtn = e.target.closest(".btn-quick-kot");
        if (quickKotBtn && quickKotBtn.dataset.id) {
          e.preventDefault();
          e.stopPropagation();
          quickPrintKot(quickKotBtn.dataset.id);
          return;
        }

        const openBillBtn = e.target.closest(".btn-open-bill");
        if (openBillBtn && openBillBtn.dataset.id) {
          e.preventDefault();
          e.stopPropagation();
          openBillModal(openBillBtn.dataset.id, false);
          return;
        }
      });
    }

    // Void Order In-App Modal Controls
    if (el.btnCloseVoidModal) el.btnCloseVoidModal.onclick = closeVoidModal;
    if (el.btnCancelVoidModal) el.btnCancelVoidModal.onclick = closeVoidModal;
    if (el.btnConfirmVoidModal) el.btnConfirmVoidModal.onclick = handleConfirmVoid;
    if (el.voidOrderModal) {
      el.voidOrderModal.onclick = (e) => {
        if (e.target === el.voidOrderModal) closeVoidModal();
      };
    }

    // System Health & Telemetry Logs Modal Controls
    if (el.btnSidebarLogs) el.btnSidebarLogs.onclick = openSystemLogsModal;
    if (el.btnCloseLogsModal) el.btnCloseLogsModal.onclick = closeSystemLogsModal;
    if (el.systemLogsModal) {
      el.systemLogsModal.onclick = (e) => {
        if (e.target === el.systemLogsModal) closeSystemLogsModal();
      };
    }
    if (el.btnFilterLogAll) el.btnFilterLogAll.onclick = () => setLogFilter("ALL");
    if (el.btnFilterLogError) el.btnFilterLogError.onclick = () => setLogFilter("ERROR");
    if (el.btnFilterLogWarn) el.btnFilterLogWarn.onclick = () => setLogFilter("WARN");
    if (el.btnFilterLogInfo) el.btnFilterLogInfo.onclick = () => setLogFilter("INFO");
    if (el.btnExportLogs) el.btnExportLogs.onclick = exportSystemLogsJson;
    if (el.btnClearLocalLogs) {
      el.btnClearLocalLogs.onclick = () => {
        if (window.AOLA_LOGGER) window.AOLA_LOGGER.clearLogs();
        renderSystemLogsModal();
        showToast("Local log buffer cleared.", "info");
      };
    }

    // Historical Reconciliation Controls
    if (el.btnExportCsv) {
      el.btnExportCsv.onclick = exportHistoryToCsv;
    }
    if (el.historyStatusFilter) {
      el.historyStatusFilter.onchange = (e) => {
        state.historyFilter.status = e.target.value;
        renderHistoryView();
      };
    }
    if (el.historySearchInput) {
      el.historySearchInput.oninput = (e) => {
        state.historyFilter.search = e.target.value.toLowerCase().trim();
        renderHistoryView();
      };
    }
    if (el.historyDatePills) {
      el.historyDatePills.querySelectorAll(".date-pill").forEach((btn) => {
        btn.onclick = () => {
          el.historyDatePills.querySelectorAll(".date-pill").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.historyFilter.dateRange = btn.dataset.range;
          if (btn.dataset.range === "custom") {
            if (el.customDateContainer) el.customDateContainer.style.display = "flex";
          } else {
            if (el.customDateContainer) el.customDateContainer.style.display = "none";
          }
          renderHistoryView();
        };
      });
    }
    if (el.historyStartDate) {
      el.historyStartDate.onchange = (e) => {
        state.historyFilter.startDate = e.target.value;
        renderHistoryView();
      };
    }
    if (el.historyEndDate) {
      el.historyEndDate.onchange = (e) => {
        state.historyFilter.endDate = e.target.value;
        renderHistoryView();
      };
    }

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
   * View Switcher: Kitchen Tickets vs Order History vs Menu Manager vs Expenses vs Trends
   */
  function switchView(viewName) {
    state.currentView = viewName;

    if (el.viewTabOrders) el.viewTabOrders.classList.toggle("active", viewName === "orders");
    if (el.viewTabHistory) el.viewTabHistory.classList.toggle("active", viewName === "history");
    if (el.viewTabMenu) el.viewTabMenu.classList.toggle("active", viewName === "menu");
    if (el.viewTabExpenses) el.viewTabExpenses.classList.toggle("active", viewName === "expenses");
    if (el.viewTabTrends) el.viewTabTrends.classList.toggle("active", viewName === "trends");

    if (el.sectionOrdersView) el.sectionOrdersView.style.display = viewName === "orders" ? "block" : "none";
    if (el.sectionHistoryView) el.sectionHistoryView.style.display = viewName === "history" ? "block" : "none";
    if (el.sectionMenuView) el.sectionMenuView.style.display = viewName === "menu" ? "block" : "none";
    if (el.sectionExpensesView) el.sectionExpensesView.style.display = viewName === "expenses" ? "block" : "none";
    if (el.sectionTrendsView) el.sectionTrendsView.style.display = viewName === "trends" ? "block" : "none";
    if (el.menuViewActions) el.menuViewActions.style.display = viewName === "menu" ? "flex" : "none";

    const sidebarFilters = document.getElementById("sidebar-order-filters");
    if (sidebarFilters) {
      sidebarFilters.style.display = viewName === "orders" ? "block" : "none";
    }

    if (viewName === "menu") {
      if (state.menu.length === 0) {
        fetchOwnerMenu(false);
      } else {
        renderOwnerMenu();
      }
    } else if (viewName === "history") {
      updateHistorySubtabUi();
      renderHistoryView();
    } else if (viewName === "expenses") {
      if (state.expenses.length === 0) {
        fetchExpenses(false);
      } else {
        renderExpensesView();
      }
    } else if (viewName === "trends") {
      renderTrendsView();
    }
  }

  function updateHistorySubtabUi() {
    if (el.btnSubtabAllOrders) el.btnSubtabAllOrders.classList.toggle("active", state.historySubtab === "all");
    if (el.btnSubtabCompletedOrders) el.btnSubtabCompletedOrders.classList.toggle("active", state.historySubtab === "completed");
    if (el.btnSubtabVoidedOrders) el.btnSubtabVoidedOrders.classList.toggle("active", state.historySubtab === "voided");
    if (el.voidedAuditBanner) el.voidedAuditBanner.style.display = (state.historySubtab === "voided" || state.historyFilter.status === "deleted") ? "flex" : "none";
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
    el.btnLoginSubmit.innerHTML = `<span class="btn-spinner"></span><span>Verifying Credentials...</span>`;

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

      // Load tenant-specific store profile and fetch from Google Sheets
      loadStoreProfileFromStorage();
      fetchStoreProfileFromBackend();

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
    state.storeProfile = {
      restaurantName: "",
      storeAddress: "",
      phoneNumber: "",
      gstin: "",
      waiterTag: "Counter POS 01",
      footerMessage: "Thank you for dining with us! Please visit again.",
      upiId: ""
    };

    switchView("orders");
    el.dashboardContainer.style.display = "none";
    el.loginOverlay.classList.add("open");
    el.loginPin.value = "";
    showToast("Logged out successfully.", "info");
  }

  /**
   * Push-based Supabase Realtime Subscription for Kitchen Tickets
   * (Replaces legacy setInterval polling loop)
   */
  function startPolling() {
    stopPolling();
    if (!state.shopId) return;

    if (AOLA_API && typeof AOLA_API.subscribeToOrders === 'function') {
      state.realtimeChannel = AOLA_API.subscribeToOrders(state.shopId, (orderPayload, eventType, oldPayload) => {
        const orderStatus = (orderPayload?.status || "").toLowerCase();
        const orderNotes = String(orderPayload?.customer_notes || "");
        const isReadyUpdate = orderStatus === "ready" || orderNotes.includes("[KDS:READY]");

        // Realtime UPDATE: When the kitchen changes an order to 'ready', play notification audio and render
        if (isReadyUpdate || (eventType === "UPDATE" && isReadyUpdate)) {
          const ordId = String(orderPayload.id || orderPayload.order_id || "").trim();
          if (ordId) {
            state.knownOrderIds.add(ordId + "_ready");
            state.knownOrderIds.add(ordId);
          }
          playNewOrderSound();
          showToast(`🍽️ Order #${ordId} is READY from Kitchen! Bill now.`, "success");
        } else if (eventType === "INSERT") {
          showToast(`📋 New order placed for Table ${orderPayload.table_number || "1"} (In Kitchen Prep)`, "info");
        } else if (orderStatus === "paid") {
          showToast(`💰 Order #${orderPayload.id || orderPayload.order_id || ""} settled & paid!`, "info");
        }

        fetchOrders(false);
      });
    }
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (AOLA_API && typeof AOLA_API.unsubscribeFromOrders === 'function') {
      AOLA_API.unsubscribeFromOrders();
    }
    state.realtimeChannel = null;
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
    state.orders = (newOrders || []).map((o, idx) => {
      let rawNotes = String(o.customerNotes || o.customer_notes || o.notes || "").trim();
      let status = String(o.status || "Pending").trim();
      
      // Dual-compatibility check: if notes contain [KDS:READY], classify as 'ready' and clean notes for UI
      if (rawNotes.includes('[KDS:READY]')) {
        const lower = status.toLowerCase();
        if (lower === 'pending' || lower === 'new') {
          status = 'ready';
        }
        rawNotes = rawNotes.replace(/\[KDS:READY\]/gi, '').trim();
      }

      return {
        orderId: String(o.orderId || o.order_id || o.id || `ORD-${idx + 1}`).trim(),
        timestamp: String(o.timestamp || o.time || new Date().toLocaleTimeString()),
        tableNumber: String(o.tableNumber || o.table_number || o.table || "1"),
        items: String(o.items || o.itemsSummary || "Items ordered"),
        totalPrice: Number(o.totalPrice || o.total_price || o.total) || 0,
        status: status,
        customerNotes: rawNotes
      };
    });

    let hasNewReadyOrder = false;
    state.orders.forEach((o) => {
      const isReady = (o.status || "").toLowerCase() === "ready";
      if (isReady) {
        if (!state.knownOrderIds.has(o.orderId + "_ready")) {
          if (!state.isInitialLoad) {
            hasNewReadyOrder = true;
          }
        }
        state.knownOrderIds.add(o.orderId + "_ready");
      }
      state.knownOrderIds.add(o.orderId);
    });

    state.isInitialLoad = false;

    if (hasNewReadyOrder) {
      playNewOrderSound();
      showToast("🍽️ Order is Ready from Kitchen! Ready for Billing.", "success");
    }

    updateCounts();
    renderTickets();
    renderPaidOrdersTable();
    if (state.currentView === "history") {
      renderHistoryView();
    }
  }

  function updateCounts() {
    const readyCount = state.orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "ready";
    }).length;

    const prepCount = state.orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "pending" || s === "new";
    }).length;

    const paidCount = state.orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "paid" || s === "completed";
    }).length;

    if (el.countPending) el.countPending.textContent = readyCount;
    if (el.countCompleted) el.countCompleted.textContent = prepCount;
    if (el.badgeReadyCount) el.badgeReadyCount.textContent = `${readyCount} Ready to Bill`;
    if (el.paidOrdersCountBadge) el.paidOrdersCountBadge.textContent = `${paidCount} Paid`;
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
    // If activeTab is 'ready', show 'ready' orders (primary cashier queue)
    // If activeTab is 'pending', show 'pending' / 'new' orders (in kitchen prep)
    const filtered = state.orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      if (state.activeTab === "ready") {
        return s === "ready";
      } else {
        return s === "pending" || s === "new";
      }
    });

    const isReadyTab = state.activeTab === "ready";

    if (filtered.length === 0) {
      el.ticketGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; background:#FFFFFF; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <div class="empty-state-icon" style="color:var(--accent-emerald);">
            <i data-lucide="check-check" style="width:40px;height:40px;"></i>
          </div>
          <h3 style="color:var(--brand-navy); font-size:1.1rem;">
            ${isReadyTab ? "No orders waiting for billing" : "No orders in kitchen prep"}
          </h3>
          <p style="font-size:0.86rem;color:var(--text-muted);margin-top:6px;">
            ${isReadyTab ? "All caught up! When the kitchen finishes cooking and marks an order as ready, it will instantly alert and appear here for checkout." : "Chefs are caught up! New customer orders will appear here automatically."}
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.ticketGrid.innerHTML = "";
    filtered.forEach((ord) => {
      const s = (ord.status || "").toLowerCase();
      const isReady = s === "ready";
      const isPending = s === "pending" || s === "new";
      const dishList = parseOrderDishItems(ord.items);
      const totalQty = dishList.reduce((sum, d) => sum + (d.qty || 1), 0);

      const card = document.createElement("article");
      card.className = `ticket-card ${isReady ? "ready" : "pending"}`;
      card.style.borderTop = isReady ? "4px solid #059669" : "4px solid #F59E0B";

      card.innerHTML = `
        <div class="ticket-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="ticket-table-badge">TABLE ${escapeHtml(ord.tableNumber)}</span>
              ${isReady 
                ? `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; background:#D1FAE5; color:#065F46; font-size:0.72rem; font-weight:700;"><i data-lucide="bell" style="width:11px;height:11px;"></i> READY TO BILL</span>` 
                : `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; background:#FEF3C7; color:#92400E; font-size:0.72rem; font-weight:700;"><i data-lucide="chef-hat" style="width:11px;height:11px;"></i> PREPARING</span>`
              }
            </div>
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
          </div>

          <ul class="ticket-bullet-list">
            ${dishList.map((dish) => `
              <li class="ticket-bullet-item ${isReady ? 'dish-prepared' : ''}">
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
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn-secondary btn-open-bill" data-id="${escapeHtml(ord.orderId)}" title="Generate Customer Bill &amp; Print" style="padding:6px 10px; display:inline-flex; align-items:center; gap:5px; font-weight:600; font-size:0.8rem; border-color:var(--border-subtle); color:var(--brand-navy);">
              <i data-lucide="receipt" style="width:14px;height:14px;color:var(--accent-emerald);"></i>
              <span>Bill</span>
            </button>
            <button class="btn-secondary btn-quick-kot" data-id="${escapeHtml(ord.orderId)}" title="Instant Print Kitchen KOT" style="padding:6px 8px; border-color:var(--border-subtle);">
              <i data-lucide="printer" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn-void-ticket" data-id="${escapeHtml(ord.orderId)}" title="Void / Cancel Order" style="padding:6px 8px; font-size:0.78rem;">
              <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
            </button>
            ${
              isReady
                ? `
                  <button class="btn-emerald btn-pay-order" data-id="${escapeHtml(ord.orderId)}" style="padding:6px 14px; font-size:0.82rem; font-weight:700; display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg, #059669 0%, #047857 100%); color:#FFFFFF; border-radius:var(--radius-sm); border:none; box-shadow:0 2px 6px rgba(5,150,105,0.25);">
                    <i data-lucide="credit-card" style="width:14px;height:14px;"></i>
                    <span>Checkout / Pay</span>
                  </button>
                `
                : `
                  <button class="btn-secondary btn-mark-ready" data-id="${escapeHtml(ord.orderId)}" style="padding:6px 10px; font-size:0.8rem; font-weight:600; color:#D97706; border-color:#FDE68A; background:#FFFBEB;" title="Mark ready if prepared">
                    <i data-lucide="check" style="width:13px;height:13px;"></i>
                    <span>Mark Ready</span>
                  </button>
                `
            }
          </div>
        </div>
      `;

      el.ticketGrid.appendChild(card);
    });

    el.ticketGrid.querySelectorAll(".btn-void-ticket").forEach((b) => {
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        openVoidModal(b.dataset.id, b);
      };
    });

    el.ticketGrid.querySelectorAll(".btn-pay-order").forEach((b) => {
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        payOrder(b.dataset.id, b);
      };
    });

    el.ticketGrid.querySelectorAll(".btn-mark-ready").forEach((b) => {
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        markOrderReady(b.dataset.id, b);
      };
    });

    el.ticketGrid.querySelectorAll(".btn-open-bill").forEach((b) => {
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        openBillModal(b.dataset.id, false);
      };
    });

    el.ticketGrid.querySelectorAll(".btn-quick-kot").forEach((b) => {
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        quickPrintKot(b.dataset.id);
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  // State for in-app Void Confirmation Modal
  let pendingVoidOrderId = null;
  let pendingVoidButtonEl = null;

  function openVoidModal(orderId, buttonEl) {
    pendingVoidOrderId = orderId;
    pendingVoidButtonEl = buttonEl;
    if (el.voidOrderModalId) el.voidOrderModalId.textContent = `#${orderId}`;
    if (el.voidOrderReasonInput) el.voidOrderReasonInput.value = "Customer requested cancellation";
    if (el.voidOrderModal) {
      el.voidOrderModal.style.display = "flex";
      el.voidOrderModal.classList.add("open");
    }
    if (el.voidOrderReasonInput) {
      setTimeout(() => el.voidOrderReasonInput.focus(), 100);
    }
    if (window.lucide) lucide.createIcons();
  }

  function closeVoidModal() {
    pendingVoidOrderId = null;
    pendingVoidButtonEl = null;
    if (el.voidOrderModal) {
      el.voidOrderModal.style.display = "none";
      el.voidOrderModal.classList.remove("open");
    }
  }

  // ── SYSTEM TELEMETRY & AUDIT LOGS MODAL ──────────────────────────────
  let activeLogFilter = "ALL";

  function openSystemLogsModal() {
    renderSystemLogsModal();
    if (el.systemLogsModal) {
      el.systemLogsModal.style.display = "flex";
      el.systemLogsModal.classList.add("open");
    }
    if (window.lucide) lucide.createIcons();
  }

  function closeSystemLogsModal() {
    if (el.systemLogsModal) {
      el.systemLogsModal.style.display = "none";
      el.systemLogsModal.classList.remove("open");
    }
  }

  function setLogFilter(level) {
    activeLogFilter = level;
    renderSystemLogsModal();
  }

  function renderSystemLogsModal() {
    if (!el.systemLogsContainer) return;
    const logs = (window.AOLA_LOGGER && window.AOLA_LOGGER.getLogs()) || [];

    const errCount = logs.filter(l => l.level === "ERROR" || l.level === "CRITICAL").length;
    const warnCount = logs.filter(l => l.level === "WARN").length;
    const infoCount = logs.filter(l => l.level === "INFO").length;

    if (el.logCountAll) el.logCountAll.textContent = logs.length;
    if (el.logCountError) el.logCountError.textContent = errCount;
    if (el.logCountWarn) el.logCountWarn.textContent = warnCount;
    if (el.logCountInfo) el.logCountInfo.textContent = infoCount;

    let filtered = logs;
    if (activeLogFilter === "ERROR") {
      filtered = logs.filter(l => l.level === "ERROR" || l.level === "CRITICAL");
    } else if (activeLogFilter === "WARN") {
      filtered = logs.filter(l => l.level === "WARN");
    } else if (activeLogFilter === "INFO") {
      filtered = logs.filter(l => l.level === "INFO");
    }

    if (filtered.length === 0) {
      el.systemLogsContainer.innerHTML = `
        <div style="padding: 28px 12px; text-align: center; color: #94a3b8;">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">🛡️</div>
          <div style="font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">No ${activeLogFilter} Logs Recorded</div>
          <div style="font-size: 0.74rem;">System telemetry is active. All components healthy.</div>
        </div>
      `;
      return;
    }

    const levelColors = {
      CRITICAL: "#ef4444",
      ERROR: "#f87171",
      WARN: "#fbbf24",
      INFO: "#38bdf8",
      DEBUG: "#94a3b8"
    };

    el.systemLogsContainer.innerHTML = filtered.slice().reverse().map(l => {
      const time = l.created_at ? l.created_at.slice(11, 19) : "";
      const col = levelColors[l.level] || "#94a3b8";
      const metaStr = l.meta && Object.keys(l.meta).length > 0 ? JSON.stringify(l.meta) : "";
      const errStr = l.error_details && l.error_details.message ? `${l.error_details.name || 'Error'}: ${l.error_details.message}` : "";
      return `
        <div style="padding: 6px 0; border-bottom: 1px solid #1e293b; line-height: 1.45;">
          <span style="color:#64748b;">[${time}]</span>
          <span style="color:${col}; font-weight:700;">[${escapeHtml(l.level)}]</span>
          <span style="color:#a5b4fc; font-weight:600;">[${escapeHtml(l.action)}]</span>
          <span style="color:#cbd5e1;">${escapeHtml(l.message)}</span>
          ${metaStr ? `<div style="color:#64748b; font-size:0.71rem; margin-left:14px; word-break:break-all;">meta: ${escapeHtml(metaStr)}</div>` : ''}
          ${errStr ? `<div style="color:#f87171; font-size:0.71rem; margin-left:14px; word-break:break-all;">err: ${escapeHtml(errStr)}</div>` : ''}
        </div>
      `;
    }).join("");
  }

  function exportSystemLogsJson() {
    if (!window.AOLA_LOGGER) return;
    const jsonStr = window.AOLA_LOGGER.exportLogsJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aola_logs_${state.shopId || 'system'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded sanitized system logs JSON.", "success");
  }

  /**
   * Action: Confirmed Soft-Delete / Void Order (Audit Trail Protocol)
   */
  async function handleConfirmVoid() {
    const orderId = pendingVoidOrderId;
    const buttonEl = pendingVoidButtonEl;
    if (!orderId) {
      closeVoidModal();
      return;
    }

    const reason = (el.voidOrderReasonInput && el.voidOrderReasonInput.value.trim()) || "Customer requested cancellation";

    if (el.btnConfirmVoidModal) {
      el.btnConfirmVoidModal.disabled = true;
      el.btnConfirmVoidModal.innerHTML = `<span class="btn-spinner"></span><span>Voiding Order...</span>`;
    }
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="btn-spinner"></span><span>Voiding...</span>`;
    }

    try {
      const activeShop = state.shopId || sessionStorage.getItem("AOLA_OWNER_SHOP") || "bismillah";
      const activePin = state.pin || sessionStorage.getItem("AOLA_OWNER_PIN") || "1234";

      const response = await AOLA_API.post("delete_order", {
        shop_id: activeShop,
        pin: activePin,
        order_id: orderId,
        reason: reason
      });

      if (!response.success) {
        showToast(response.error || "Failed to void order.", "error");
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.innerHTML = `<i data-lucide="trash-2" style="width:13px;height:13px;"></i><span>Void</span>`;
          if (window.lucide) lucide.createIcons();
        }
        return;
      }

      showToast(`Order #${orderId} moved to Voided Orders audit trail.`, "info");

      const ord = state.orders.find((o) => String(o.orderId) === String(orderId));
      if (ord) {
        ord.status = "Deleted";
        ord.customerNotes = (ord.customerNotes ? ord.customerNotes + " | " : "") + `[VOIDED: ${reason}]`;
      }

      closeVoidModal();
      updateCounts();
      renderTickets();
      if (state.currentView === "history") {
        renderHistoryView();
      }
    } catch (err) {
      console.error("[Void Order Error]:", err);
      showToast("Error communicating with server.", "error");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<i data-lucide="trash-2" style="width:13px;height:13px;"></i><span>Void</span>`;
        if (window.lucide) lucide.createIcons();
      }
    } finally {
      if (el.btnConfirmVoidModal) {
        el.btnConfirmVoidModal.disabled = false;
        el.btnConfirmVoidModal.innerHTML = `<i data-lucide="trash-2" style="width:14px;height:14px;"></i><span>Void Order</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  // Alias for backward compatibility
  function voidOrder(orderId, buttonEl) {
    openVoidModal(orderId, buttonEl);
  }

  /**
   * Cashier Billing Action: Checkout / Pay
   * Updates Supabase order status to 'paid', moves order out of live queue and into Paid History
   */
  async function payOrder(orderId, buttonEl) {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="btn-spinner"></span><span>Settling...</span>`;
    }

    try {
      const activeShop = state.shopId || sessionStorage.getItem("AOLA_OWNER_SHOP") || "bismillah";
      const activePin = state.pin || sessionStorage.getItem("AOLA_OWNER_PIN") || "1234";

      const response = await AOLA_API.post("update_order_status", {
        shop_id: activeShop,
        pin: activePin,
        order_id: orderId,
        status: "paid"
      });

      if (!response.success) {
        showToast(response.error || "Failed to update payment status.", "error");
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.innerHTML = `<i data-lucide="credit-card" style="width:14px;height:14px;"></i><span>Checkout / Pay</span>`;
          if (window.lucide) lucide.createIcons();
        }
        return;
      }

      showToast(`💰 Order #${orderId} marked as PAID & moved to history!`, "success");

      const ord = state.orders.find((o) => String(o.orderId) === String(orderId));
      if (ord) {
        ord.status = "paid";
      }

      updateCounts();
      renderTickets();
      renderPaidOrdersTable();
      if (state.currentView === "history") {
        renderHistoryView();
      }
    } catch (err) {
      console.error("[Pay Order Error]:", err);
      showToast("Error communicating with server.", "error");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<i data-lucide="credit-card" style="width:14px;height:14px;"></i><span>Checkout / Pay</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  // Alias for backward compatibility
  function completeOrder(orderId, buttonEl) {
    return payOrder(orderId, buttonEl);
  }

  /**
   * Action: Expedite / Mark Order as Ready directly from Owner Dashboard
   */
  async function markOrderReady(orderId, buttonEl) {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="btn-spinner"></span>`;
    }

    try {
      const activeShop = state.shopId || sessionStorage.getItem("AOLA_OWNER_SHOP") || "bismillah";
      const activePin = state.pin || sessionStorage.getItem("AOLA_OWNER_PIN") || "1234";

      const response = await AOLA_API.post("update_order_status", {
        shop_id: activeShop,
        pin: activePin,
        order_id: orderId,
        status: "ready"
      });

      if (!response.success) {
        if (response.error && response.error.includes("orders_status_check")) {
          showToast("⚠️ Database status constraint: Please run backend/apply_kds_and_system_logs.sql in Supabase SQL Editor.", "warning");
        } else {
          showToast(response.error || "Failed to mark order ready.", "error");
        }
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.innerHTML = `<i data-lucide="check" style="width:13px;height:13px;"></i><span>Mark Ready</span>`;
          if (window.lucide) lucide.createIcons();
        }
        return;
      }

      showToast(`🍽️ Order #${orderId} marked ready for billing!`, "success");

      const ord = state.orders.find((o) => String(o.orderId) === String(orderId));
      if (ord) {
        ord.status = "ready";
        if (ord.customerNotes) {
          ord.customerNotes = ord.customerNotes.replace(/\[KDS:READY\]/gi, '').trim();
        }
      }

      updateCounts();
      renderTickets();
    } catch (err) {
      console.error("[Mark Ready Error]:", err);
      showToast("Error communicating with server.", "error");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<i data-lucide="check" style="width:13px;height:13px;"></i><span>Mark Ready</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /**
   * Render Completed / Settled Orders Table (True History below live ticket queue)
   */
  function renderPaidOrdersTable() {
    if (!el.paidOrdersTbody) return;

    // Filter orders where status is 'paid' (or legacy 'completed')
    const paidOrders = state.orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "paid" || s === "completed";
    });

    if (el.paidOrdersCountBadge) {
      el.paidOrdersCountBadge.textContent = `${paidOrders.length} Paid`;
    }

    if (paidOrders.length === 0) {
      el.paidOrdersTbody.innerHTML = "";
      if (el.paidOrdersTable) el.paidOrdersTable.style.display = "none";
      if (el.paidOrdersEmpty) el.paidOrdersEmpty.style.display = "block";
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (el.paidOrdersTable) el.paidOrdersTable.style.display = "table";
    if (el.paidOrdersEmpty) el.paidOrdersEmpty.style.display = "none";

    el.paidOrdersTbody.innerHTML = paidOrders.map((ord) => {
      const dishList = parseOrderDishItems(ord.items);
      const itemsSummary = dishList.map((d) => `${d.qty}x ${escapeHtml(d.name)}`).join(", ");
      const timeStr = formatTicketTime(ord.timestamp);

      return `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--brand-navy);">#${escapeHtml(ord.orderId)}</td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(timeStr)}</td>
          <td><span class="ticket-table-badge" style="font-size: 0.75rem; padding: 2px 7px;">T-${escapeHtml(ord.tableNumber)}</span></td>
          <td style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.84rem; font-weight: 500;" title="${itemsSummary}">${itemsSummary || "Items"}</td>
          <td style="font-weight: 700; color: #047857;">${formatCurrency(ord.totalPrice)}</td>
          <td><span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; color: #1E40AF; background: #DBEAFE; padding: 2px 8px; border-radius: 4px;">Settled</span></td>
          <td><span class="status-badge active" style="font-size: 0.76rem;"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Paid</span></td>
          <td style="text-align: right;">
            <button class="btn-secondary btn-table-reprint" data-id="${escapeHtml(ord.orderId)}" style="padding: 4px 8px; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;" title="Reprint Thermal Receipt">
              <i data-lucide="printer" style="width: 12px; height: 12px;"></i>
              <span>Receipt</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Bind reprint buttons
    el.paidOrdersTbody.querySelectorAll(".btn-table-reprint").forEach((btn) => {
      btn.onclick = () => {
        openBillModal(btn.dataset.id, false);
      };
    });

    if (window.lucide) lucide.createIcons();
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
        el.btnRefreshMenu.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i><span>Sync Database</span>`;
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
      if (window.AOLA_CACHE) {
        AOLA_CACHE.invalidateMenu(state.shopId);
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
    el.btnSaveDishSubmit.innerHTML = `<span class="btn-spinner"></span><span>Saving Dish to Supabase...</span>`;

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

      // Refresh menu from sheet & invalidate local cache
      if (window.AOLA_CACHE) {
        AOLA_CACHE.invalidateMenu(state.shopId);
      }
      await fetchOwnerMenu(false);
    } catch (err) {
      console.error("[Save Dish Error]:", err);
      showToast("Error saving dish to database.", "error");
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
      if (window.AOLA_CACHE) {
        AOLA_CACHE.invalidateMenu(state.shopId);
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
    el.btnSubmitChangePin.innerHTML = `<span class="btn-spinner"></span><span>Updating PIN...</span>`;

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

  // =========================================================================
  // HISTORICAL ORDER LEDGER & DAILY RECONCILIATION
  // =========================================================================

  /**
   * Helper: Parse various timestamp formats into a valid JavaScript Date
   */
  function parseOrderDate(timestampStr) {
    if (!timestampStr) return new Date();
    const d = new Date(timestampStr);
    if (!isNaN(d.getTime())) return d;

    // Handle DD/MM/YYYY or DD-MM-YYYY formats commonly found in Indian POS / Sheets
    const match = String(timestampStr).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (match) {
      const dt = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
      if (!isNaN(dt.getTime())) return dt;
    }
    return new Date();
  }

  /**
   * Filter historical orders by date range, payment/fulfillment status, and live search
   */
  function getFilteredHistoryOrders() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const endOfYesterday = new Date(endOfToday.getTime() - 86400000);

    const startOf7Days = new Date(now.getTime() - 7 * 86400000);
    startOf7Days.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    return state.orders.filter((order) => {
      const status = (order.status || "Pending").toLowerCase();

      // 0. Sub-tab Filter (All vs Completed vs Voided Audit Trail)
      if (state.historySubtab === "completed" && status !== "completed" && status !== "paid") return false;
      if (state.historySubtab === "voided" && status !== "deleted" && status !== "voided") return false;

      // 1. Status Dropdown Filter
      if (state.historyFilter.status !== "all") {
        const filterStatus = state.historyFilter.status.toLowerCase();
        if (filterStatus === "completed" && status !== "completed" && status !== "paid") return false;
        if (filterStatus === "paid" && status !== "paid") return false;
        if (filterStatus === "ready" && status !== "ready") return false;
        if (filterStatus === "pending" && status !== "pending" && status !== "new") return false;
        if ((filterStatus === "deleted" || filterStatus === "voided") && status !== "deleted" && status !== "voided") return false;
        if (filterStatus === "cancelled" && status !== "cancelled") return false;
        if (filterStatus === "refunded" && status !== "refunded") return false;
      }

      // 2. Date Range Filter
      const orderDate = parseOrderDate(order.timestamp);
      const range = state.historyFilter.dateRange;

      if (range === "today") {
        if (orderDate < startOfToday || orderDate > endOfToday) return false;
      } else if (range === "yesterday") {
        if (orderDate < startOfYesterday || orderDate > endOfYesterday) return false;
      } else if (range === "last7") {
        if (orderDate < startOf7Days) return false;
      } else if (range === "month") {
        if (orderDate < startOfMonth) return false;
      } else if (range === "custom") {
        if (state.historyFilter.startDate) {
          const customStart = new Date(state.historyFilter.startDate);
          customStart.setHours(0, 0, 0, 0);
          if (orderDate < customStart) return false;
        }
        if (state.historyFilter.endDate) {
          const customEnd = new Date(state.historyFilter.endDate);
          customEnd.setHours(23, 59, 59, 999);
          if (orderDate > customEnd) return false;
        }
      }

      // 3. Live Search Filter
      if (state.historyFilter.search) {
        const q = state.historyFilter.search;
        const matchesId = String(order.orderId).toLowerCase().includes(q);
        const matchesTable = String(order.tableNumber).toLowerCase().includes(q);
        const matchesItems = String(order.items).toLowerCase().includes(q);
        const matchesNotes = String(order.customerNotes || "").toLowerCase().includes(q);
        if (!matchesId && !matchesTable && !matchesItems && !matchesNotes) return false;
      }

      return true;
    });
  }

  /**
   * Render Historical Ledger & Top Reconciliation Metric Cards
   */
  function renderHistoryView() {
    if (!el.historyTbody) return;

    const filtered = getFilteredHistoryOrders();

    // Calculate Summary Metrics
    let totalRevenue = 0;
    let servedCount = 0;
    let cancelledCount = 0;

    // Subtab counts
    const allCount = state.orders.length;
    const compCount = state.orders.filter(o => {
      const s = (o.status || "").toLowerCase();
      return s === "completed" || s === "paid";
    }).length;
    const voidCount = state.orders.filter(o => {
      const s = (o.status || "").toLowerCase();
      return s === "deleted" || s === "voided" || s === "cancelled";
    }).length;

    if (el.subtabCountAll) el.subtabCountAll.textContent = allCount;
    if (el.subtabCountCompleted) el.subtabCountCompleted.textContent = compCount;
    if (el.subtabCountVoided) el.subtabCountVoided.textContent = voidCount;

    if (el.voidedAuditBanner) {
      el.voidedAuditBanner.style.display = (state.historySubtab === "voided" || state.historyFilter.status === "deleted") ? "flex" : "none";
    }

    filtered.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      if (s === "completed" || s === "paid") {
        totalRevenue += Number(o.totalPrice) || 0;
        servedCount++;
      } else if (s === "cancelled" || s === "deleted" || s === "voided") {
        cancelledCount++;
      }
    });

    const aov = servedCount > 0 ? totalRevenue / servedCount : 0;
    const totalOutflows = Number(state.totalExpenses) || 0;
    const netProfit = totalRevenue - totalOutflows;

    if (el.metricTotalRevenue) el.metricTotalRevenue.textContent = `${state.currency}${totalRevenue.toFixed(2)}`;
    if (el.metricHistoryExpenses) el.metricHistoryExpenses.textContent = `${state.currency}${totalOutflows.toFixed(2)}`;
    if (el.metricHistoryNetProfit) {
      el.metricHistoryNetProfit.textContent = `${netProfit >= 0 ? "+" : ""}${state.currency}${netProfit.toFixed(2)}`;
      el.metricHistoryNetProfit.className = `history-metric-val ${netProfit >= 0 ? "metric-profit-positive" : "metric-profit-negative"}`;
    }
    if (el.badgeHistoryProfit) {
      el.badgeHistoryProfit.textContent = netProfit >= 0 ? "Profitable" : "Operating Loss";
      el.badgeHistoryProfit.className = `profit-badge ${netProfit >= 0 ? "positive" : "negative"}`;
    }
    if (el.metricAov) el.metricAov.textContent = `${state.currency}${aov.toFixed(2)}`;
    if (el.metricOrdersServed) el.metricOrdersServed.textContent = servedCount;
    if (el.metricOrdersCancelled) el.metricOrdersCancelled.textContent = cancelledCount;

    if (filtered.length === 0) {
      el.historyTbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
            <div style="margin-bottom: 8px; color:var(--text-dim); display:flex; justify-content:center;">
              <i data-lucide="inbox" style="width:36px;height:36px;"></i>
            </div>
            <div style="font-weight: 600; color: var(--brand-navy); margin-bottom: 4px; font-size:1.05rem;">No Orders Found</div>
            <div style="font-size: 0.85rem; color:var(--text-muted);">No records match your selected date range or status filters.</div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.historyTbody.innerHTML = filtered.map((order) => {
      const s = (order.status || "Pending").toLowerCase();
      let statusClass = "pending";
      if (s === "completed" || s === "paid") statusClass = "completed";
      else if (s === "ready") statusClass = "active";
      else if (s === "cancelled" || s === "deleted" || s === "voided") statusClass = "deleted";
      else if (s === "refunded") statusClass = "refunded";

      const dishList = parseOrderDishItems(order.items);
      const itemsSummary = dishList.map((d) => `${d.qty}x ${escapeHtml(d.name)}`).join(", ");
      const totalQty = dishList.reduce((sum, d) => sum + (d.qty || 1), 0);

      const formattedDate = parseOrderDate(order.timestamp).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      const formattedTime = formatTicketTime(order.timestamp);

      return `
        <tr>
          <td style="font-weight: 700; font-family: monospace; color: var(--brand-navy);">
            #${escapeHtml(order.orderId)}
          </td>
          <td>
            <div style="font-size: 0.84rem; font-weight: 600; color: var(--brand-navy);">${formattedDate}</div>
            <div style="font-size: 0.74rem; color: var(--text-dim);">${formattedTime}</div>
          </td>
          <td>
            <span class="ticket-table-badge" style="padding: 2px 7px; font-size: 0.76rem;">T-${escapeHtml(order.tableNumber)}</span>
          </td>
          <td style="max-width: 260px;">
            <div style="font-size: 0.84rem; font-weight: 600; color: var(--brand-navy); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemsSummary}">
              ${itemsSummary || "No items"}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 1px;">${dishList.length} dishes (${totalQty} pcs)</div>
          </td>
          <td style="font-weight: 700; color: var(--brand-navy); font-size: 0.92rem;">
            ${formatCurrency(order.totalPrice)}
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              ${s === "paid" ? '<i data-lucide="check-check" style="width:12px;height:12px;"></i> Paid' : (s === "ready" ? '<i data-lucide="bell" style="width:12px;height:12px;"></i> Ready' : (s === "deleted" || s === "voided" ? '<i data-lucide="shield-alert" style="width:12px;height:12px;"></i> Voided' : escapeHtml(order.status || "Pending")))}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(order.customerNotes || '')}">
            ${escapeHtml(order.customerNotes || "-")}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 5px;">
              <button type="button" class="btn-secondary btn-history-bill" data-id="${escapeHtml(order.orderId)}" title="Generate Tax Bill &amp; Thermal Print" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 0.76rem; font-weight: 600; border-radius: 6px; cursor: pointer;">
                <i data-lucide="receipt" style="width:13px;height:13px;"></i>
                <span>Bill</span>
              </button>
              <button type="button" class="btn-secondary btn-history-wa" data-id="${escapeHtml(order.orderId)}" title="WhatsApp DPDP Invoice" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 0.76rem; font-weight: 600; color:#059669; border-radius: 6px; cursor: pointer;">
                <i data-lucide="send" style="width:13px;height:13px;"></i>
                <span>Share</span>
              </button>
              ${
                s !== "deleted" && s !== "voided" && s !== "cancelled"
                  ? `<button type="button" class="btn-secondary btn-history-void" data-id="${escapeHtml(order.orderId)}" title="Void / Cancel this order" style="display: inline-flex; align-items: center; gap: 3px; padding: 4px 7px; font-size: 0.76rem; font-weight: 600; color: var(--accent-rose); border-radius: 6px; cursor: pointer;">
                       <i data-lucide="ban" style="width: 12px; height: 12px;"></i>
                       <span>Void</span>
                     </button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `;
    }).join("");

    el.historyTbody.querySelectorAll(".btn-history-bill").forEach((btn) => {
      btn.onclick = () => openBillModal(btn.dataset.id, false);
    });

    el.historyTbody.querySelectorAll(".btn-history-wa").forEach((btn) => {
      btn.onclick = () => {
        const ord = state.orders.find((o) => String(o.orderId) === String(btn.dataset.id));
        if (ord) {
          billState.order = ord;
          openWhatsAppConsentModal();
        }
      };
    });

    el.historyTbody.querySelectorAll(".btn-history-void").forEach((btn) => {
      btn.onclick = () => openVoidModal(btn.dataset.id, btn);
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * One-Click CSV Export for Excel Reconciliation and Bookkeeping
   */
  function exportHistoryToCsv() {
    const orders = getFilteredHistoryOrders();
    if (!orders || orders.length === 0) {
      showToast("No orders available in current filter to export.", "info");
      return;
    }

    const headers = [
      "Order ID",
      "Date",
      "Time",
      "Table",
      "Status",
      "Dishes Summary",
      "Total Items",
      "Total Amount",
      "Customer Notes"
    ];

    function escapeCsv(val) {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }

    const rows = orders.map((ord) => {
      const dishList = parseOrderDishItems(ord.items);
      const summary = dishList.map((d) => `${d.qty}x ${d.name}`).join("; ");
      const totalQty = dishList.reduce((sum, d) => sum + (d.qty || 1), 0);
      const dt = parseOrderDate(ord.timestamp);
      const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = formatTicketTime(ord.timestamp);

      return [
        escapeCsv(ord.orderId),
        escapeCsv(dateStr),
        escapeCsv(timeStr),
        escapeCsv(ord.tableNumber),
        escapeCsv(ord.status || "Pending"),
        escapeCsv(summary),
        escapeCsv(totalQty),
        escapeCsv(Number(ord.totalPrice || 0).toFixed(2)),
        escapeCsv(ord.customerNotes || "")
      ].join(",");
    });

    // Excel-ready CSV prefixed with UTF-8 BOM (\uFEFF)
    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `AOLA_Orders_${state.shopId || "outlet"}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✅ Exported ${orders.length} orders to CSV successfully!`, "success");
  }

  // =========================================================================
  // DAILY EXPENSES LEDGER MODULE (add_expense & get_expenses)
  // =========================================================================

  /**
   * Fetch Expenses Ledger from Google Sheet / Backend
   */
  async function fetchExpenses(showFeedback = false) {
    if (!state.shopId || !state.pin) return;

    if (showFeedback && el.btnRefreshExpenses) {
      el.btnRefreshExpenses.textContent = "Syncing...";
      el.btnRefreshExpenses.disabled = true;
    }

    try {
      const response = await AOLA_API.post("get_expenses", {
        shop_id: state.shopId,
        pin: state.pin
      });

      if (response.success) {
        state.expenses = response.expenses || [];
        state.totalExpenses = Number(response.total_expenses) || 0;
        if (el.countExpensesBadge) {
          el.countExpensesBadge.textContent = `${state.currency}${state.totalExpenses.toLocaleString("en-IN")}`;
        }
        renderExpensesView();
        if (state.currentView === "history") {
          renderHistoryView();
        }
        if (showFeedback) showToast("Expenses synced from database.", "success");
      } else {
        if (showFeedback) showToast(response.error || "Failed to load expenses.", "error");
      }
    } catch (err) {
      console.error("[Fetch Expenses Error]:", err);
      if (showFeedback) showToast("Network error syncing expenses.", "error");
    } finally {
      if (showFeedback && el.btnRefreshExpenses) {
        el.btnRefreshExpenses.disabled = false;
        el.btnRefreshExpenses.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i><span>Sync Expenses</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /**
   * Action: Log New Daily Expense Outflow
   */
  async function handleSaveExpenseSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const category = el.expenseCategory ? el.expenseCategory.value : "General";
    const amount = parseFloat(el.expenseAmount ? el.expenseAmount.value : 0);
    const desc = el.expenseDesc ? el.expenseDesc.value.trim() : "";
    const dateVal = el.expenseDate ? el.expenseDate.value : "";

    if (!amount || amount <= 0) {
      showToast("Please enter a valid expense amount.", "error");
      return;
    }
    if (!desc) {
      showToast("Please provide description or vendor details.", "error");
      return;
    }

    if (el.btnSubmitExpense) {
      el.btnSubmitExpense.disabled = true;
      el.btnSubmitExpense.innerHTML = `<span class="btn-spinner"></span><span>Recording Outflow...</span>`;
    }

    let timestamp = "";
    if (dateVal) {
      const d = new Date(dateVal);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      timestamp = d.toISOString().replace("T", " ").substring(0, 19);
    } else {
      timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    }

    try {
      const response = await AOLA_API.post("add_expense", {
        shop_id: state.shopId,
        pin: state.pin,
        category: category,
        amount: amount,
        description: desc,
        timestamp: timestamp
      });

      if (!response.success) {
        showToast(response.error || "Failed to log expense.", "error");
        return;
      }

      showToast("Expense logged to database!", "success");
      if (el.ownerExpenseForm) el.ownerExpenseForm.reset();
      if (el.expenseDate) el.expenseDate.valueAsDate = new Date();
      fetchExpenses(false);
    } catch (err) {
      showToast("Error recording expense.", "error");
    } finally {
      if (el.btnSubmitExpense) {
        el.btnSubmitExpense.disabled = false;
        el.btnSubmitExpense.innerHTML = `<i data-lucide="check-circle" style="width:15px;height:15px;"></i><span>Log Expense</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  /**
   * Render Expenses View & Net Profit Calculations
   */
  function renderExpensesView() {
    if (!el.expensesTbody) return;

    // Financial calculations: Subtract total expenses from gross completed/paid revenue to display Net Profit
    const completedOrders = state.orders.filter(o => {
      const s = (o.status || "").toLowerCase();
      return s === "completed" || s === "paid";
    });
    const grossRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
    const totalOutflow = state.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = grossRevenue - totalOutflow;

    if (el.metricExpRevenue) el.metricExpRevenue.textContent = formatCurrency(grossRevenue);
    if (el.metricExpTotal) el.metricExpTotal.textContent = formatCurrency(totalOutflow);
    if (el.metricExpCount) el.metricExpCount.textContent = state.expenses.length;

    if (el.metricExpNetProfit) {
      el.metricExpNetProfit.textContent = `${netProfit >= 0 ? "+" : ""}${formatCurrency(netProfit)}`;
      el.metricExpNetProfit.className = `history-metric-val ${netProfit >= 0 ? "metric-profit-positive" : "metric-profit-negative"}`;
    }

    if (el.badgeNetProfit) {
      el.badgeNetProfit.textContent = netProfit >= 0 ? "Profitable Margin" : "Net Operating Loss";
      el.badgeNetProfit.className = `profit-badge ${netProfit >= 0 ? "positive" : "negative"}`;
    }

    // Filter table rows
    const catFilter = el.filterExpenseCategory ? el.filterExpenseCategory.value : "all";
    const searchQuery = el.expenseSearchInput ? el.expenseSearchInput.value.toLowerCase().trim() : "";

    const filtered = state.expenses.filter(exp => {
      if (catFilter !== "all" && exp.category !== catFilter) return false;
      if (searchQuery) {
        const matchesDesc = (exp.description || "").toLowerCase().includes(searchQuery);
        const matchesId = (exp.expenseId || "").toLowerCase().includes(searchQuery);
        const matchesCat = (exp.category || "").toLowerCase().includes(searchQuery);
        if (!matchesDesc && !matchesId && !matchesCat) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      el.expensesTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 44px 20px; color: var(--text-dim);">
            <div style="margin-bottom: 8px; display:flex; justify-content:center;">
              <i data-lucide="receipt-text" style="width:36px;height:36px;color:var(--text-dim);"></i>
            </div>
            <div style="font-weight:600; color:var(--brand-navy); font-size:1rem;">No Expense Entries Found</div>
            <div style="font-size:0.84rem; color:var(--text-muted); margin-top:3px;">Log daily outflows using the form above to track net profits.</div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.expensesTbody.innerHTML = filtered.map(exp => {
      const d = parseDateSafe(exp.timestamp);
      const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

      return `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--brand-navy);">
            #${escapeHtml(exp.expenseId)}
          </td>
          <td>
            <div style="font-size:0.84rem; font-weight:600; color:var(--brand-navy);">${dateStr}</div>
            <div style="font-size:0.74rem; color:var(--text-dim);">${timeStr}</div>
          </td>
          <td>
            <span class="status-badge" style="background:var(--bg-subtle); color:var(--brand-navy); border-color:var(--border-subtle); font-size:0.76rem;">
              ${escapeHtml(exp.category || "General")}
            </span>
          </td>
          <td style="max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.86rem; color: var(--text-main);" title="${escapeHtml(exp.description)}">
            ${escapeHtml(exp.description || "-")}
          </td>
          <td style="text-align: right; font-weight: 700; color: var(--accent-rose); font-size: 0.95rem;">
            -${formatCurrency(exp.amount)}
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons();
  }

  /**
   * One-Click CSV Export for Expenses Ledger
   */
  function exportExpensesToCsv() {
    if (!state.expenses || state.expenses.length === 0) {
      showToast("No expenses available to export.", "info");
      return;
    }

    const headers = ["Expense_ID", "Timestamp", "Category", "Description", "Amount_INR"];
    const rows = state.expenses.map(e => [
      `"${e.expenseId}"`,
      `"${e.timestamp}"`,
      `"${(e.category || '').replace(/"/g, '""')}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      Number(e.amount || 0).toFixed(2)
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `AOLA_Expenses_${state.shopId || "outlet"}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✅ Exported ${state.expenses.length} expenses to CSV!`, "success");
  }

  // =========================================================================
  // INTERACTIVE SALES TRENDS & ANALYTICS MODULE (Chart.js Integration)
  // =========================================================================

  /**
   * Robust Date Parser for Google Sheets timestamps and ISO strings
   */
  function parseDateSafe(ts) {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    const str = String(ts).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    const matchYMD = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (matchYMD) {
      return new Date(
        parseInt(matchYMD[1], 10),
        parseInt(matchYMD[2], 10) - 1,
        parseInt(matchYMD[3], 10),
        parseInt(matchYMD[4] || 0, 10),
        parseInt(matchYMD[5] || 0, 10),
        parseInt(matchYMD[6] || 0, 10)
      );
    }

    const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (matchDMY) {
      return new Date(
        parseInt(matchDMY[3], 10),
        parseInt(matchDMY[2], 10) - 1,
        parseInt(matchDMY[1], 10),
        parseInt(matchDMY[4] || 0, 10),
        parseInt(matchDMY[5] || 0, 10),
        parseInt(matchDMY[6] || 0, 10)
      );
    }

    return new Date();
  }

  function toDateInputValue(d) {
    if (!d) return "";
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function setTrendTimeframe(tf) {
    state.trendTimeframe = tf;
    if (el.btnTrendDaily) el.btnTrendDaily.classList.toggle("active", tf === "daily");
    if (el.btnTrendWeekly) el.btnTrendWeekly.classList.toggle("active", tf === "weekly");
    if (el.btnTrendMonthly) el.btnTrendMonthly.classList.toggle("active", tf === "monthly");
    if (el.btnTrendYearly) el.btnTrendYearly.classList.toggle("active", tf === "yearly");
    renderTrendsView();
  }

  /**
   * Parse completed orders and render Chart.js graphs
   */
  function renderTrendsView() {
    if (typeof Chart === "undefined") {
      console.warn("[AOLA Trends] Chart.js library is not loaded.");
      return;
    }

    const completedOrders = state.orders.filter(o => {
      const s = (o.status || "").toLowerCase();
      return s === "completed" || s === "paid";
    });

    const tf = state.trendTimeframe || "daily";
    if (!state.trendSelectedDate) {
      state.trendSelectedDate = toDateInputValue(new Date());
    }
    const targetDateStr = state.trendSelectedDate;

    if (el.trendDateInput && document.activeElement !== el.trendDateInput) {
      el.trendDateInput.value = targetDateStr;
    }

    const todayStr = toDateInputValue(new Date());
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yesterdayStr = toDateInputValue(yDate);

    const isToday = (targetDateStr === todayStr);
    const isYesterday = (targetDateStr === yesterdayStr);

    const parts = targetDateStr.split("-");
    const targetD = (parts.length === 3)
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      : new Date();
    const weekdayLong = targetD.toLocaleDateString("en-IN", { weekday: "long" });
    const dateFormatted = targetD.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    let dayLabel = `${weekdayLong}, ${dateFormatted}`;
    if (isToday) dayLabel = `Today (${dateFormatted})`;
    else if (isYesterday) dayLabel = `Yesterday (${dateFormatted})`;

    if (el.trendSelectedDayText) {
      el.trendSelectedDayText.textContent = dayLabel;
    }
    if (el.trendBtnToday) el.trendBtnToday.classList.toggle("active", isToday && tf === "daily");
    if (el.trendBtnYesterday) el.trendBtnYesterday.classList.toggle("active", isYesterday && tf === "daily");

    let labels = [];
    let dataPoints = [];
    let chartType = "line";
    let chartTitle = "Hourly Sales Performance";
    let chartSubtitle = "Visualizing sales hour-by-hour (00:00 to 23:00)";
    let peakLabel = "-";
    let maxVal = -1;
    let activeOrders = completedOrders;

    if (tf === "daily") {
      chartType = "line";
      chartTitle = `Daily Sales: Hour-by-Hour Curve — ${dayLabel}`;

      const dayOrders = completedOrders.filter(ord => {
        const d = parseDateSafe(ord.timestamp);
        return toDateInputValue(d) === targetDateStr;
      });
      activeOrders = dayOrders;

      if (el.trendDayOrderCountBadge) {
        el.trendDayOrderCountBadge.textContent = `${dayOrders.length} Order${dayOrders.length === 1 ? '' : 's'}`;
      }

      chartSubtitle = dayOrders.length > 0
        ? `Tracking peak lunchtime & dinner rush volumes for ${dayLabel}`
        : `No completed orders recorded on ${dayLabel}. Use the date picker above to search other days.`;

      labels = [
        "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM",
        "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
        "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM",
        "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM"
      ];
      dataPoints = new Array(24).fill(0);

      dayOrders.forEach(ord => {
        const d = parseDateSafe(ord.timestamp);
        const hour = d.getHours();
        if (hour >= 0 && hour < 24) {
          dataPoints[hour] += Number(ord.totalPrice) || 0;
        }
      });
    } else if (tf === "weekly") {
      chartType = "bar";
      // Anchor week around selected date
      const d = new Date(targetDateStr + "T00:00:00");
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      sun.setHours(23, 59, 59, 999);

      const weekStartStr = mon.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      const weekEndStr = sun.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      chartTitle = `Weekly Sales: Day-by-Day Volume (${weekStartStr} - ${weekEndStr})`;
      chartSubtitle = `Aggregating revenue across Monday through Sunday for selected week`;

      const weekOrders = completedOrders.filter(ord => {
        const od = parseDateSafe(ord.timestamp);
        return od >= mon && od <= sun;
      });
      activeOrders = weekOrders;

      if (el.trendDayOrderCountBadge) {
        el.trendDayOrderCountBadge.textContent = `${weekOrders.length} Order${weekOrders.length === 1 ? '' : 's'}`;
      }

      labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      dataPoints = [0, 0, 0, 0, 0, 0, 0];

      weekOrders.forEach(ord => {
        const od = parseDateSafe(ord.timestamp);
        const dayIdx = (od.getDay() + 6) % 7; // Convert to 0=Mon, 6=Sun
        dataPoints[dayIdx] += Number(ord.totalPrice) || 0;
      });
    } else if (tf === "monthly") {
      chartType = "line"; // Area chart
      const year = targetD.getFullYear();
      chartTitle = `Monthly Sales Growth (${year})`;
      chartSubtitle = `Cumulative monthly revenue progression for ${year}`;

      const yearOrders = completedOrders.filter(ord => {
        const od = parseDateSafe(ord.timestamp);
        return od.getFullYear() === year;
      });
      activeOrders = yearOrders;

      if (el.trendDayOrderCountBadge) {
        el.trendDayOrderCountBadge.textContent = `${yearOrders.length} Order${yearOrders.length === 1 ? '' : 's'}`;
      }

      labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      dataPoints = new Array(12).fill(0);

      yearOrders.forEach(ord => {
        const od = parseDateSafe(ord.timestamp);
        const month = od.getMonth();
        if (month >= 0 && month < 12) {
          dataPoints[month] += Number(ord.totalPrice) || 0;
        }
      });
    } else if (tf === "yearly") {
      chartType = "bar";
      chartTitle = "Year-over-Year Revenue";
      chartSubtitle = "Long-term franchise revenue trends";

      const yearMap = {};
      completedOrders.forEach(ord => {
        const od = parseDateSafe(ord.timestamp);
        const y = od.getFullYear() || 2026;
        yearMap[y] = (yearMap[y] || 0) + (Number(ord.totalPrice) || 0);
      });

      const years = Object.keys(yearMap).sort();
      if (years.length === 0) {
        labels = ["2025", "2026"];
        dataPoints = [0, 0];
      } else {
        labels = years;
        dataPoints = years.map(y => yearMap[y]);
      }
    }

    // Determine Peak Sales Window
    dataPoints.forEach((val, idx) => {
      if (val > maxVal && val > 0) {
        maxVal = val;
        peakLabel = `${labels[idx]} (${formatCurrency(val)})`;
      }
    });

    const totalWindowRevenue = dataPoints.reduce((sum, v) => sum + v, 0);
    const windowOrderCount = activeOrders.length;
    const windowAov = windowOrderCount > 0 ? totalWindowRevenue / windowOrderCount : 0;

    // Update KPI summary cards
    if (el.trendMetricRevenue) el.trendMetricRevenue.textContent = formatCurrency(totalWindowRevenue);
    if (el.trendMetricPeak) el.trendMetricPeak.textContent = (maxVal > 0) ? peakLabel : (windowOrderCount === 0 ? "No Orders on Day" : "-");
    if (el.trendMetricOrders) el.trendMetricOrders.textContent = windowOrderCount;
    if (el.trendMetricAov) el.trendMetricAov.textContent = formatCurrency(windowAov);

    if (el.trendChartMainTitle) {
      el.trendChartMainTitle.innerHTML = `<i data-lucide="${chartType === 'line' ? 'line-chart' : 'bar-chart-3'}" style="width:17px;height:17px;color:var(--accent-indigo);"></i><span>${chartTitle}</span>`;
    }
    if (el.trendChartMainSubtitle) {
      el.trendChartMainSubtitle.textContent = chartSubtitle;
    }

    // Render Primary Sales Chart (Line with tension 0.4 or Bar)
    if (el.ownerTrendsChart) {
      const ctx = el.ownerTrendsChart.getContext("2d");
      if (state.trendsChartInstance) {
        state.trendsChartInstance.destroy();
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      if (tf === "daily") {
        gradient.addColorStop(0, "rgba(5, 150, 105, 0.35)");
        gradient.addColorStop(1, "rgba(5, 150, 105, 0.0)");
      } else {
        gradient.addColorStop(0, "rgba(79, 70, 229, 0.35)");
        gradient.addColorStop(1, "rgba(79, 70, 229, 0.0)");
      }

      const isLine = (chartType === "line");
      const primaryColor = (tf === "daily") ? "#059669" : "#4F46E5";

      state.trendsChartInstance = new Chart(ctx, {
        type: chartType,
        data: {
          labels: labels,
          datasets: [{
            label: "Revenue (₹)",
            data: dataPoints,
            borderColor: primaryColor,
            backgroundColor: isLine ? gradient : primaryColor,
            borderWidth: isLine ? 2.5 : 0,
            borderRadius: isLine ? 0 : 6,
            fill: isLine,
            tension: 0.4, // Smooth curve
            pointBackgroundColor: primaryColor,
            pointBorderColor: "#FFFFFF",
            pointBorderWidth: 2,
            pointRadius: isLine ? 4 : 0,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0F172A",
              titleFont: { family: "Inter", size: 12, weight: "bold" },
              bodyFont: { family: "Inter", size: 12 },
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: (context) => ` Revenue: ${formatCurrency(context.raw || 0)}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                font: { family: "Inter", size: 11 },
                color: "#64748B"
              }
            },
            y: {
              grid: {
                color: "rgba(226, 232, 240, 0.6)",
                borderDash: [4, 4]
              },
              border: { display: false },
              ticks: {
                font: { family: "Inter", size: 11 },
                color: "#64748B",
                callback: (val) => "₹" + Number(val).toLocaleString("en-IN")
              }
            }
          }
        }
      });
    }

    // Render Secondary Category Share Chart
    if (el.ownerBreakdownChart) {
      const bCtx = el.ownerBreakdownChart.getContext("2d");
      if (state.breakdownChartInstance) {
        state.breakdownChartInstance.destroy();
      }

      const catCount = {};
      activeOrders.forEach(ord => {
        const dishList = parseOrderDishItems(ord.items);
        dishList.forEach(dish => {
          const menuItem = state.menu.find(m => m.name.toLowerCase() === dish.name.toLowerCase());
          const cat = menuItem ? menuItem.category : "Biryani / Main";
          catCount[cat] = (catCount[cat] || 0) + (dish.qty || 1);
        });
      });

      let bLabels = Object.keys(catCount);
      let bValues = Object.values(catCount);

      if (bLabels.length === 0) {
        bLabels = ["No Orders on Day"];
        bValues = [1];
      }

      const palette = bLabels[0] === "No Orders on Day"
        ? ["#CBD5E1"]
        : ["#059669", "#4F46E5", "#D97706", "#E11D48", "#2563EB", "#8B5CF6", "#0D9488"];

      state.breakdownChartInstance = new Chart(bCtx, {
        type: "doughnut",
        data: {
          labels: bLabels,
          datasets: [{
            data: bValues,
            backgroundColor: palette.slice(0, bLabels.length),
            borderWidth: 2,
            borderColor: "#FFFFFF"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                font: { family: "Inter", size: 11 },
                color: "#64748B",
                usePointStyle: true,
                padding: 12
              }
            },
            tooltip: {
              backgroundColor: "#0F172A",
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => (bLabels[0] === "No Orders on Day")
                  ? " No dishes ordered on this date"
                  : ` ${ctx.label}: ${ctx.raw} items ordered`
              }
            }
          }
        }
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  // =========================================================================
  // MANUAL POS CASHIER TERMINAL CONTROLLER (owner.html)
  // Split-screen interface for fast touch punching of orders
  // =========================================================================

  /**
   * Open the POS Terminal Modal
   */
  async function openPosModal() {
    if (!el.posModal) return;

    // Ensure menu items are loaded
    if (!state.menu || state.menu.length === 0) {
      if (el.posMenuGrid) {
        el.posMenuGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <i data-lucide="loader" class="spin" style="width: 28px; height: 28px; margin-bottom: 8px;"></i>
            <div>Loading restaurant menu...</div>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      try {
        await fetchOwnerMenu(false);
      } catch (err) {
        console.warn("[POS Menu Load Warn]:", err);
      }
    }

    // Reset filters and render
    state.posCategoryFilter = "all";
    state.posSearchQuery = "";
    if (el.posDishSearch) el.posDishSearch.value = "";
    if (el.btnPosClearSearch) el.btnPosClearSearch.style.display = "none";

    // Set default order source if not set
    if (!state.posOrderSource) {
      setPosOrderSource("Dine-In");
    } else {
      setPosOrderSource(state.posOrderSource);
    }

    renderPosCategories();
    renderPosMenu();
    renderCashierCart();

    el.posModal.style.display = "flex";
    el.posModal.classList.add("open");

    if (window.lucide) lucide.createIcons();

    // Auto-focus search or ref field
    setTimeout(() => {
      if (el.posDishSearch && window.innerWidth > 768) {
        el.posDishSearch.focus();
      }
    }, 150);
  }

  /**
   * Close the POS Terminal Modal
   */
  function closePosModal() {
    if (!el.posModal) return;
    el.posModal.classList.remove("open");
    el.posModal.style.display = "none";
  }

  /**
   * Set the POS Order Source (Dine-In, Takeaway, Zomato, Swiggy)
   */
  function setPosOrderSource(source) {
    state.posOrderSource = source || "Dine-In";

    if (el.posSourceSelector) {
      el.posSourceSelector.querySelectorAll(".pos-source-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.source === state.posOrderSource);
      });
    }

    if (el.posSourceIndicator) {
      const labels = {
        "Dine-In": "Dine-In Table",
        "Takeaway": "Takeaway / Parcel",
        "Zomato": "Zomato Delivery",
        "Swiggy": "Swiggy Delivery"
      };
      el.posSourceIndicator.textContent = labels[state.posOrderSource] || state.posOrderSource;
      el.posSourceIndicator.style.color = state.posOrderSource === "Zomato" ? "#E23744" : (state.posOrderSource === "Swiggy" ? "#FC8019" : "var(--primary)");
    }

    // Configure the reference input label and quick tables
    if (state.posOrderSource === "Dine-In") {
      if (el.posOrderRefLabel) el.posOrderRefLabel.textContent = "Table Number *";
      if (el.posOrderRef) {
        el.posOrderRef.placeholder = "e.g. 4";
        el.posOrderRef.value = state.posSelectedTable || "1";
      }
      if (el.posQuickTables) el.posQuickTables.style.display = "flex";
    } else if (state.posOrderSource === "Takeaway") {
      if (el.posOrderRefLabel) el.posOrderRefLabel.textContent = "Customer Name / Phone *";
      if (el.posOrderRef) {
        el.posOrderRef.placeholder = "e.g. Rahul / 9876543210";
        if (el.posOrderRef.value === "1" || el.posOrderRef.value === state.posSelectedTable) {
          el.posOrderRef.value = "";
        }
      }
      if (el.posQuickTables) el.posQuickTables.style.display = "none";
    } else if (state.posOrderSource === "Zomato") {
      if (el.posOrderRefLabel) el.posOrderRefLabel.textContent = "Zomato Order / Token ID *";
      if (el.posOrderRef) {
        el.posOrderRef.placeholder = "e.g. #ZOM-4921";
        if (el.posOrderRef.value === "1" || el.posOrderRef.value === state.posSelectedTable) {
          el.posOrderRef.value = "";
        }
      }
      if (el.posQuickTables) el.posQuickTables.style.display = "none";
    } else if (state.posOrderSource === "Swiggy") {
      if (el.posOrderRefLabel) el.posOrderRefLabel.textContent = "Swiggy Order / Token ID *";
      if (el.posOrderRef) {
        el.posOrderRef.placeholder = "e.g. #SWG-8103";
        if (el.posOrderRef.value === "1" || el.posOrderRef.value === state.posSelectedTable) {
          el.posOrderRef.value = "";
        }
      }
      if (el.posQuickTables) el.posQuickTables.style.display = "none";
    }
  }

  /**
   * Render POS Category Chips dynamically from menu
   */
  function renderPosCategories() {
    if (!el.posCategoryChips) return;

    const categories = ["all"];
    (state.menu || []).forEach((dish) => {
      const cat = (dish.category || "General").trim();
      if (cat && !categories.some(c => c.toLowerCase() === cat.toLowerCase())) {
        categories.push(cat);
      }
    });

    el.posCategoryChips.innerHTML = categories.map((cat) => {
      const isAll = cat.toLowerCase() === "all";
      const isActive = state.posCategoryFilter.toLowerCase() === cat.toLowerCase();
      const label = isAll ? "All Items" : cat;
      const icon = isAll ? `<i data-lucide="utensils" style="width:13px;height:13px;"></i>` : "";
      return `
        <button type="button" class="pos-cat-chip ${isActive ? "active" : ""}" data-category="${escapeHtml(cat)}">
          ${icon}
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    }).join("");

    el.posCategoryChips.querySelectorAll(".pos-cat-chip").forEach((btn) => {
      btn.onclick = () => {
        el.posCategoryChips.querySelectorAll(".pos-cat-chip").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        state.posCategoryFilter = btn.dataset.category || "all";
        renderPosMenu();
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Render POS Dishes Grid with Large Touch Hitboxes
   */
  function renderPosMenu() {
    if (!el.posMenuGrid) return;

    let items = state.menu || [];

    // Filter by Category
    if (state.posCategoryFilter && state.posCategoryFilter.toLowerCase() !== "all") {
      const catTarget = state.posCategoryFilter.toLowerCase();
      items = items.filter((d) => (d.category || "").toLowerCase() === catTarget);
    }

    // Filter by Search Query
    if (state.posSearchQuery) {
      const q = state.posSearchQuery;
      items = items.filter((d) =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.category || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q) ||
        (d.id || "").toLowerCase().includes(q)
      );
    }

    if (items.length === 0) {
      el.posMenuGrid.style.display = "none";
      if (el.posMenuEmpty) el.posMenuEmpty.style.display = "flex";
      return;
    }

    el.posMenuGrid.style.display = "grid";
    if (el.posMenuEmpty) el.posMenuEmpty.style.display = "none";

    el.posMenuGrid.innerHTML = items.map((dish) => {
      const inCart = state.cashierCart.find(i => String(i.id).toLowerCase() === String(dish.id).toLowerCase());
      const inCartQty = inCart ? inCart.qty : 0;
      const isInStock = dish.inStock !== false && String(dish.inStock).toLowerCase() !== "false";
      const isVeg = dish.isVeg === true || String(dish.isVeg).toLowerCase() === "true";
      const priceVal = Number(dish.price) || 0;

      return `
        <div class="pos-dish-card ${inCartQty > 0 ? "in-cart" : ""} ${!isInStock ? "out-of-stock" : ""}" 
             data-dish-id="${escapeHtml(dish.id)}" 
             title="${isInStock ? "Click to add " + escapeHtml(dish.name) + " to cart" : "Item marked out of stock"}">
          <div>
            <div class="pos-card-header">
              <span class="pos-diet-dot ${isVeg ? "veg" : "non-veg"}" title="${isVeg ? "Vegetarian" : "Non-Vegetarian"}"></span>
              <span class="pos-dish-price">${state.currency}${priceVal.toFixed(2)}</span>
            </div>
            <div class="pos-dish-name">${escapeHtml(dish.name)}</div>
          </div>
          <div class="pos-card-footer">
            <span style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${escapeHtml(dish.category || "")}</span>
            ${!isInStock 
              ? `<span style="font-size:0.7rem; font-weight:700; color:var(--accent-rose);">Out of Stock</span>` 
              : (inCartQty > 0 ? `<span class="pos-card-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> x${inCartQty}</span>` : `<span style="font-size:0.74rem; font-weight:700; color:var(--primary);"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</span>`)
            }
          </div>
        </div>
      `;
    }).join("");

    // Attach click events
    el.posMenuGrid.querySelectorAll(".pos-dish-card").forEach((card) => {
      card.onclick = () => {
        if (card.classList.contains("out-of-stock")) {
          showToast("This item is currently marked Out of Stock.", "warning");
          return;
        }
        const dishId = card.dataset.dishId;
        const dish = (state.menu || []).find(d => String(d.id).toLowerCase() === String(dishId).toLowerCase());
        if (dish) {
          addToCashierCart(dish);
        }
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Update active badges on dish cards without re-rendering the whole grid
   */
  function updatePosDishCardBadges() {
    if (!el.posMenuGrid) return;
    el.posMenuGrid.querySelectorAll(".pos-dish-card").forEach((card) => {
      const dishId = card.dataset.dishId;
      const inCart = state.cashierCart.find(i => String(i.id).toLowerCase() === String(dishId).toLowerCase());
      const inCartQty = inCart ? inCart.qty : 0;
      const isInStock = !card.classList.contains("out-of-stock");

      if (inCartQty > 0) {
        card.classList.add("in-cart");
      } else {
        card.classList.remove("in-cart");
      }

      if (isInStock) {
        const footer = card.querySelector(".pos-card-footer");
        if (footer) {
          const badgeSpan = footer.querySelector(".pos-card-badge") || footer.querySelector("span:last-child");
          if (badgeSpan) {
            if (inCartQty > 0) {
              badgeSpan.outerHTML = `<span class="pos-card-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> x${inCartQty}</span>`;
            } else {
              badgeSpan.outerHTML = `<span style="font-size:0.74rem; font-weight:700; color:var(--primary);"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</span>`;
            }
          }
        }
      }
    });
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Add Item to Cashier Cart
   */
  function addToCashierCart(dish) {
    if (!dish) return;
    const existing = state.cashierCart.find(i => String(i.id).toLowerCase() === String(dish.id).toLowerCase());
    if (existing) {
      existing.qty += 1;
    } else {
      state.cashierCart.push({
        id: dish.id,
        name: dish.name,
        price: Number(dish.price) || 0,
        qty: 1,
        category: dish.category || "",
        isVeg: dish.isVeg
      });
    }

    renderCashierCart();
    updatePosDishCardBadges();
  }

  /**
   * Update quantity of an item in Cashier Cart
   */
  function updateCashierCartQty(dishId, delta) {
    const item = state.cashierCart.find(i => String(i.id).toLowerCase() === String(dishId).toLowerCase());
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      state.cashierCart = state.cashierCart.filter(i => String(i.id).toLowerCase() !== String(dishId).toLowerCase());
    }

    renderCashierCart();
    updatePosDishCardBadges();
  }

  /**
   * Remove single item from Cashier Cart
   */
  function removeFromCashierCart(dishId) {
    state.cashierCart = state.cashierCart.filter(i => String(i.id).toLowerCase() !== String(dishId).toLowerCase());
    renderCashierCart();
    updatePosDishCardBadges();
  }

  /**
   * Clear entire Cashier Cart
   */
  function clearCashierCart() {
    state.cashierCart = [];
    renderCashierCart();
    updatePosDishCardBadges();
  }

  /**
   * Render Cashier Cart and update grand totals
   */
  function renderCashierCart() {
    const totalQty = state.cashierCart.reduce((acc, it) => acc + (it.qty || 0), 0);
    const grandTotal = state.cashierCart.reduce((acc, it) => acc + ((it.price || 0) * (it.qty || 0)), 0);

    if (el.posCartCount) el.posCartCount.textContent = totalQty;
    if (el.posSubtotal) el.posSubtotal.textContent = `${state.currency}${grandTotal.toFixed(2)}`;
    if (el.posGrandTotal) el.posGrandTotal.textContent = `${state.currency}${grandTotal.toFixed(2)}`;

    // Toggle clear buttons
    if (el.btnPosQuickClear) el.btnPosQuickClear.style.display = totalQty > 0 ? "inline-flex" : "none";
    if (el.btnPosClearItems) el.btnPosClearItems.style.display = totalQty > 0 ? "inline-block" : "none";

    // Enable / disable submit button
    if (el.btnPosSubmitOrder) {
      el.btnPosSubmitOrder.disabled = totalQty === 0;
    }

    if (!el.posCartList) return;

    if (state.cashierCart.length === 0) {
      el.posCartList.innerHTML = `
        <div class="pos-cart-empty" id="pos-cart-empty">
          <div class="pos-cart-empty-icon">
            <i data-lucide="shopping-cart" style="width: 30px; height: 30px; color: var(--text-dim);"></i>
          </div>
          <div style="font-weight: 600; color: var(--brand-navy); font-size: 0.92rem; margin-bottom: 4px;">Cart is empty</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; max-width: 220px; margin: 0 auto;">
            Tap any item on the left menu grid to instantly punch it into this order.
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.posCartList.innerHTML = state.cashierCart.map((item) => {
      const lineTotal = (item.price || 0) * (item.qty || 0);
      const isOne = item.qty === 1;

      return `
        <div class="pos-cart-row" data-cart-dish-id="${escapeHtml(item.id)}">
          <div class="pos-cart-row-info">
            <div class="pos-cart-row-title">${escapeHtml(item.name)}</div>
            <div class="pos-cart-row-rate">${state.currency}${(item.price || 0).toFixed(2)} each</div>
          </div>

          <!-- Quantity Stepper with Large Hitboxes -->
          <div class="pos-qty-stepper">
            <button type="button" class="pos-qty-btn ${isOne ? "trash" : ""}" data-action="dec" title="${isOne ? "Remove from cart" : "Decrease quantity"}">
              ${isOne ? `<i data-lucide="trash-2" style="width:14px;height:14px;"></i>` : `&minus;`}
            </button>
            <span class="pos-qty-value">${item.qty}</span>
            <button type="button" class="pos-qty-btn" data-action="inc" title="Increase quantity">
              &plus;
            </button>
          </div>

          <!-- Line Total -->
          <div class="pos-cart-row-total">${state.currency}${lineTotal.toFixed(2)}</div>
        </div>
      `;
    }).join("");

    // Wire stepper buttons
    el.posCartList.querySelectorAll(".pos-cart-row").forEach((row) => {
      const dishId = row.dataset.cartDishId;
      const decBtn = row.querySelector('[data-action="dec"]');
      const incBtn = row.querySelector('[data-action="inc"]');

      if (decBtn) {
        decBtn.onclick = (e) => {
          e.stopPropagation();
          updateCashierCartQty(dishId, -1);
        };
      }
      if (incBtn) {
        incBtn.onclick = (e) => {
          e.stopPropagation();
          updateCashierCartQty(dishId, 1);
        };
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Format Cashier Cart and Dispatch Order to Kitchen API
   */
  async function handlePosSubmitOrder() {
    if (!state.cashierCart || state.cashierCart.length === 0) {
      showToast("Please add at least one dish to the cart before submitting.", "warning");
      return;
    }

    const orderRefRaw = (el.posOrderRef ? el.posOrderRef.value : "").trim();
    if (!orderRefRaw) {
      const refLabel = state.posOrderSource === "Dine-In" ? "Table Number" : "Customer Reference";
      showToast(`Please enter the ${refLabel}.`, "warning");
      if (el.posOrderRef) el.posOrderRef.focus();
      return;
    }

    // Format destination label based on source
    let finalTableRef = orderRefRaw;
    if (state.posOrderSource === "Dine-In") {
      finalTableRef = /^[0-9]+$/.test(orderRefRaw) ? `Table ${orderRefRaw}` : orderRefRaw;
    } else if (state.posOrderSource === "Takeaway") {
      finalTableRef = `Takeaway - ${orderRefRaw}`;
    } else if (state.posOrderSource === "Zomato") {
      finalTableRef = `Zomato - ${orderRefRaw}`;
    } else if (state.posOrderSource === "Swiggy") {
      finalTableRef = `Swiggy - ${orderRefRaw}`;
    }

    // Format notes with explicit source tag
    const userNotes = (el.posOrderNotes ? el.posOrderNotes.value : "").trim();
    const finalNotes = `[Source: ${state.posOrderSource}]${userNotes ? " " + userNotes : ""}`;

    // Format items array to match Google Apps Script / QR endpoint exactly
    const formattedItems = state.cashierCart.map((item) => ({
      dishId: item.id,
      qty: item.qty
    }));

    // Build the payload
    const payload = {
      shop_id: state.shopId,
      table_number: finalTableRef,
      items: formattedItems,
      customer_notes: finalNotes,
      customer_fax: "", // Anti-bot honeypot
      is_pos: true, // Manual cashier punch (bypasses rate limit)
      pin: state.pin // Authenticated owner pin
    };

    // UI Loading state
    if (el.btnPosSubmitOrder) {
      el.btnPosSubmitOrder.disabled = true;
      el.btnPosSubmitOrder.innerHTML = `<span class="btn-spinner"></span><span id="pos-submit-text">Sending to Kitchen...</span>`;
    }

    try {
      const response = await AOLA_API.post("place_order", payload);

      if (response && response.success) {
        const orderId = response.order_id || "New Order";
        showToast(`Order ${orderId} sent to kitchen successfully!`, "success");

        // Clear cart and reset inputs
        clearCashierCart();
        if (el.posOrderNotes) el.posOrderNotes.value = "";
        if (state.posOrderSource !== "Dine-In" && el.posOrderRef) {
          el.posOrderRef.value = "";
        }

        // Close POS terminal modal
        closePosModal();

        // Immediately trigger kitchen sync to refresh display & tickets
        fetchOrders(true);

        // Play loud audible chime for kitchen alert
        playNewOrderSound();
      } else {
        const errMsg = response && response.error ? response.error : "Failed to place order.";
        showToast(errMsg, "error");
      }
    } catch (err) {
      console.error("[POS Submit Order Error]:", err);
      showToast("Network error submitting POS order to kitchen.", "error");
    } finally {
      if (el.btnPosSubmitOrder) {
        el.btnPosSubmitOrder.disabled = state.cashierCart.length === 0;
        el.btnPosSubmitOrder.innerHTML = `
          <i data-lucide="send" style="width: 17px; height: 17px;"></i>
          <span id="pos-submit-text">Send to Kitchen</span>
        `;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  // Expose global controller helpers
  window.AOLA_OWNER = {
    openBill: (id) => openBillModal(id, false),
    openKot: (id) => openBillModal(id, true),
    quickPrintKot: (id) => quickPrintKot(id),
    payOrder: (id, btn) => payOrder(id, btn),
    markOrderReady: (id, btn) => markOrderReady(id, btn),
    completeOrder: (id, btn) => completeOrder(id, btn),
    voidOrder: (id, btn) => openVoidModal(id, btn),
    openPos: () => openPosModal(),
    openWhatsApp: (id) => {
      const order = state.orders.find((o) => String(o.orderId) === String(id));
      if (order) {
        billState.order = order;
        openWhatsAppConsentModal();
      }
    }
  };

  // Launch on DOM ready (safely handling already loaded documents)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

