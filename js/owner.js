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
    currentView: "orders", // "orders" | "history" | "menu"
    menu: [],
    currency: "₹",
    menuFilterCategory: "all",
    menuSearchQuery: "",
    pollTimer: null,
    knownOrderIds: new Set(),
    isInitialLoad: true,
    paperWidth: localStorage.getItem("AOLA_THERMAL_PAPER_WIDTH") || "58mm", // 58mm default or 80mm
    outletAddress: "Main High Street Market, City Center",
    outletContact: "+91 98470 54970",
    outletGstin: "32AABCU9603R1ZM",
    waiterTag: "Counter POS 01",
    historyFilter: {
      dateRange: "today",
      startDate: "",
      endDate: "",
      status: "all",
      search: ""
    }
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
    viewTabHistory: document.getElementById("view-tab-history"),
    viewTabMenu: document.getElementById("view-tab-menu"),
    menuViewActions: document.getElementById("menu-view-actions"),
    btnRefreshMenu: document.getElementById("btn-refresh-menu"),
    btnOpenAddDish: document.getElementById("btn-open-add-dish"),
    sectionOrdersView: document.getElementById("section-orders-view"),
    sectionHistoryView: document.getElementById("section-history-view"),
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

    // Historical Reconciliation View & Metrics
    metricTotalRevenue: document.getElementById("metric-total-revenue"),
    metricAov: document.getElementById("metric-aov"),
    metricOrdersServed: document.getElementById("metric-orders-served"),
    metricOrdersCancelled: document.getElementById("metric-orders-cancelled"),
    historyDatePills: document.getElementById("history-date-pills"),
    customDateContainer: document.getElementById("custom-date-container"),
    historyStartDate: document.getElementById("history-start-date"),
    historyEndDate: document.getElementById("history-end-date"),
    historyStatusFilter: document.getElementById("history-status-filter"),
    historySearchInput: document.getElementById("history-search-input"),
    btnExportCsv: document.getElementById("btn-export-csv"),
    historyTbody: document.getElementById("history-tbody"),

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

    const is58mm = (state.paperWidth || "58mm") === "58mm";
    const restaurantName = escapeHtml((state.shopName || "AOLA RESTAURANT").toUpperCase());
    const orderId = escapeHtml(order.orderId || "ORD");
    const tableNum = escapeHtml(order.tableNumber || "1");
    const formattedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const formattedTime = formatTicketTime(order.timestamp);
    const paymentMode = escapeHtml(options.paymentMode || "Paid (UPI / Online)");
    const taxRate = typeof options.taxRate === "number" ? options.taxRate : 5;
    const discountInput = typeof options.discountAmount === "number" ? options.discountAmount : 0;
    const waiterTag = escapeHtml(state.waiterTag || "Counter POS 01");
    const outletAddress = escapeHtml(state.outletAddress || "Main Market, City Center");
    const outletContact = escapeHtml(state.outletContact || "+91 98470 54970");
    const gstin = escapeHtml(state.outletGstin || "32AABCU9603R1ZM");

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
        <div class="receipt-tagline">${isKot ? "Live Preparation Docket" : `${outletAddress} &bull; Ph: ${outletContact}`}</div>
        ${(!isKot && gstin) ? `<div style="font-size:0.7rem; font-weight:600; color:#334155; margin-top:1px;">GSTIN: ${gstin}</div>` : ""}
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
          <div>Thank you for dining with us!</div>
          <div>Please visit us again soon.</div>

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

    // Standard NPCI UPI Intent URI for instantaneous counter payments
    const upiUri = `upi://pay?pa=aola.pay@icici&pn=${encodeURIComponent(state.shopName || "Restaurant")}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Order " + ord.orderId)}`;

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
      const frame = el.isolatedPrintFrame;
      if (frame) {
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
          frame.contentWindow.focus();
          frame.contentWindow.print();
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

    // 1. Initialize Printer (ESC @)
    pushBytes(0x1B, 0x40);

    // 2. Center Align for Header (ESC a 1)
    pushBytes(0x1B, 0x61, 0x01);

    // Double Height & Width for Restaurant Name
    pushBytes(0x1B, 0x21, 0x30);
    pushLine(state.shopName || "AOLA RESTAURANT");

    // Reset Font
    pushBytes(0x1B, 0x21, 0x00);
    if (!isKot) {
      pushLine("TAX INVOICE / CASH BILL");
      pushLine(state.outletAddress || "Main Market, City Center");
      pushLine("Ph: " + (state.outletContact || "+91 98470 54970"));
      if (state.outletGstin) pushLine("GSTIN: " + state.outletGstin);
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
    pushTwoColumns("Staff: " + (state.waiterTag || "Counter POS 01"), options.paymentMode ? options.paymentMode.replace("Paid ", "") : "UPI");

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
      pushLine("Thank you for dining with us!");
      pushLine("Please visit us again soon.");
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

    const digitalBillUrl = `${window.location.origin}${window.location.pathname.replace("owner.html", "index.html")}?shop=${encodeURIComponent(state.shopId)}&bill=${encodeURIComponent(ord.orderId)}`;

    const text = `🧾 *${(state.shopName || "AOLA RESTAURANT").toUpperCase()}*\n` +
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
      `Thank you for dining with us! 🙏`;

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
    updateBillPreview();
    triggerPrintReceipt();
    showToast("Printing Kitchen KOT for Table " + order.tableNumber + "...", "info");
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

    // View Switcher (Tickets vs History vs Menu)
    if (el.viewTabOrders) {
      el.viewTabOrders.onclick = () => switchView("orders");
    }
    if (el.viewTabHistory) {
      el.viewTabHistory.onclick = () => switchView("history");
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
   * View Switcher: Kitchen Tickets vs Order History vs Menu Manager
   */
  function switchView(viewName) {
    state.currentView = viewName;

    if (el.viewTabOrders) el.viewTabOrders.classList.toggle("active", viewName === "orders");
    if (el.viewTabHistory) el.viewTabHistory.classList.toggle("active", viewName === "history");
    if (el.viewTabMenu) el.viewTabMenu.classList.toggle("active", viewName === "menu");

    if (el.sectionOrdersView) el.sectionOrdersView.style.display = viewName === "orders" ? "block" : "none";
    if (el.sectionHistoryView) el.sectionHistoryView.style.display = viewName === "history" ? "block" : "none";
    if (el.sectionMenuView) el.sectionMenuView.style.display = viewName === "menu" ? "block" : "none";
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
      renderHistoryView();
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
    if (state.currentView === "history") {
      renderHistoryView();
    }
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

      // Refresh menu from sheet & invalidate local cache
      if (window.AOLA_CACHE) {
        AOLA_CACHE.invalidateMenu(state.shopId);
      }
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
      // 1. Status Filter
      const status = (order.status || "Pending").toLowerCase();
      if (state.historyFilter.status !== "all") {
        const filterStatus = state.historyFilter.status.toLowerCase();
        if (filterStatus === "completed" && status !== "completed") return false;
        if (filterStatus === "pending" && status !== "pending" && status !== "new") return false;
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

    filtered.forEach((o) => {
      const s = (o.status || "").toLowerCase();
      if (s === "completed") {
        totalRevenue += Number(o.totalPrice) || 0;
        servedCount++;
      } else if (s === "cancelled") {
        cancelledCount++;
      }
    });

    const aov = servedCount > 0 ? totalRevenue / servedCount : 0;

    if (el.metricTotalRevenue) el.metricTotalRevenue.textContent = `${state.currency}${totalRevenue.toFixed(2)}`;
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
      if (s === "completed") statusClass = "completed";
      else if (s === "cancelled") statusClass = "cancelled";
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
              ${escapeHtml(order.status || "Pending")}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(order.customerNotes || "-")}
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 4px;">
              <button class="btn-secondary btn-history-bill" data-id="${escapeHtml(order.orderId)}" title="Generate Tax Bill &amp; Thermal Print" style="padding: 4px 8px; font-size: 0.78rem;">
                <i data-lucide="receipt" style="width:13px;height:13px;"></i>
              </button>
              <button class="btn-secondary btn-history-wa" data-id="${escapeHtml(order.orderId)}" title="WhatsApp DPDP Invoice" style="padding: 4px 8px; font-size: 0.78rem; color:#25D366;">
                <i data-lucide="send" style="width:13px;height:13px;"></i>
              </button>
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

  // Expose global controller helpers
  window.AOLA_OWNER = {
    openBill: (id) => openBillModal(id, false),
    openKot: (id) => openBillModal(id, true),
    quickPrintKot: (id) => quickPrintKot(id),
    openWhatsApp: (id) => {
      const order = state.orders.find((o) => String(o.orderId) === String(id));
      if (order) {
        billState.order = order;
        openWhatsAppConsentModal();
      }
    }
  };

  // Launch on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();

