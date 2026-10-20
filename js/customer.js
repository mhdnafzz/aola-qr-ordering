/**
 * AOLA - Customer Menu & Ordering Engine (index.html)
 */

(function () {
  // Application State
  const state = {
    shopId: "",
    tableNumber: "",
    shopData: null,
    menuItems: [],
    selectedCategory: "all",
    cart: {}, // { [dishId]: { item, qty } }
    isSubmitting: false
  };

  // DOM Elements
  const el = {
    restaurantName: document.getElementById("restaurant-name"),
    brandLogoContainer: document.getElementById("brand-logo-container"),
    tableBadge: document.getElementById("table-badge"),
    tableLabel: document.getElementById("table-label"),
    shopIdTag: document.getElementById("shop-id-tag"),
    categoryBar: document.getElementById("category-bar"),
    menuFeed: document.getElementById("menu-feed"),
    cartBar: document.getElementById("cart-bar"),
    cartItemCount: document.getElementById("cart-item-count"),
    cartBarTotal: document.getElementById("cart-bar-total"),
    btnOpenCart: document.getElementById("btn-open-cart"),
    cartModal: document.getElementById("cart-modal"),
    btnCloseCart: document.getElementById("btn-close-cart"),
    modalCartItems: document.getElementById("modal-cart-items"),
    summarySubtotal: document.getElementById("summary-subtotal"),
    summaryTotal: document.getElementById("summary-total"),
    orderTableInput: document.getElementById("order-table-input"),
    orderNotesInput: document.getElementById("order-notes-input"),
    customerFax: document.getElementById("customer_fax"),
    btnSubmitOrder: document.getElementById("btn-submit-order"),
    successModal: document.getElementById("success-modal"),
    successOrderId: document.getElementById("success-order-id"),
    successTableNum: document.getElementById("success-table-num"),
    successTotalAmt: document.getElementById("success-total-amt"),
    btnOrderMore: document.getElementById("btn-order-more"),
    quickShopSelect: document.getElementById("quick-shop-select"),
    linkOwnerPortal: document.getElementById("link-owner-portal")
  };

  /**
   * Initialize App on Load
   */
  async function init() {
    // 1. Extract URL Parameters
    state.shopId = (getUrlParam("shop") || "").toLowerCase().trim();
    state.tableNumber = (getUrlParam("table") || "").trim();

    // Default to demo restaurant if no shop parameter is provided
    if (!state.shopId) {
      state.shopId = "bismillah";
      console.info("[AOLA] No ?shop= parameter detected. Defaulting to demo shop 'bismillah'. Try visiting ?shop=bismillah&table=4");
    }

    if (el.quickShopSelect) {
      const knownShops = ["bismillah", "kfc"];
      if (knownShops.includes(state.shopId)) {
        el.quickShopSelect.value = state.shopId;
      } else {
        // Add custom option dynamically
        const opt = document.createElement("option");
        opt.value = state.shopId;
        opt.textContent = state.shopId.toUpperCase();
        opt.selected = true;
        el.quickShopSelect.insertBefore(opt, el.quickShopSelect.firstChild);
      }

      el.quickShopSelect.onchange = () => {
        const val = el.quickShopSelect.value;
        if (val === "custom") {
          const customId = prompt("Enter your Hotel / Restaurant ID (slug):", "");
          if (customId && customId.trim()) {
            window.location.href = `?shop=${encodeURIComponent(customId.trim().toLowerCase())}&table=${state.tableNumber || 1}`;
          } else {
            el.quickShopSelect.value = state.shopId;
          }
        } else {
          window.location.href = `?shop=${encodeURIComponent(val)}&table=${state.tableNumber || 1}`;
        }
      };
    }

    if (el.linkOwnerPortal) {
      el.linkOwnerPortal.href = `./owner.html?shop=${encodeURIComponent(state.shopId)}`;
    }

    if (state.tableNumber) {
      el.tableLabel.textContent = `Table ${state.tableNumber}`;
      el.orderTableInput.value = state.tableNumber;
    } else {
      el.tableLabel.textContent = "Select Table";
    }

    el.shopIdTag.textContent = `@${state.shopId}`;

    // 2. Bind Event Listeners
    setupEventListeners();

    // 3. Fetch Branding & Menu
    await loadMenu();
  }

  /**
   * Load Menu Data from Backend API
   */
  async function loadMenu() {
    try {
      el.menuFeed.innerHTML = `
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      `;

      const response = await AOLA_API.get("get_menu", { shop: state.shopId });

      if (!response.success) {
        if (response.suspended) {
          renderSuspendedNotice(response.error);
        } else {
          renderErrorNotice(response.error || "Unable to load restaurant menu.");
        }
        return;
      }

      state.shopData = response.shop;
      state.menuItems = response.menu || [];

      // Update Branding
      el.restaurantName.textContent = state.shopData.name || "Restaurant";
      document.title = `${state.shopData.name} - Instant QR Ordering`;

      if (state.shopData.logoUrl) {
        el.brandLogoContainer.innerHTML = `<img src="${escapeHtml(state.shopData.logoUrl)}" alt="${escapeHtml(state.shopData.name)} logo">`;
      } else {
        el.brandLogoContainer.innerHTML = `<div style="font-size:2rem;">🍽️</div>`;
      }

      // Render Categories & Menu Feed
      renderCategories();
      renderMenuFeed();
    } catch (err) {
      renderErrorNotice("Failed to connect to menu server. Please check your network connection.");
    }
  }

  /**
   * Render Category Chips
   */
  function renderCategories() {
    const categories = new Set(["all"]);
    state.menuItems.forEach((item) => {
      if (item.category) categories.add(item.category);
    });

    el.categoryBar.innerHTML = "";
    categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = `cat-chip ${state.selectedCategory === cat ? "active" : ""}`;
      btn.textContent = cat === "all" ? "All Items" : cat;
      btn.onclick = () => {
        state.selectedCategory = cat;
        renderCategories();
        renderMenuFeed();
      };
      el.categoryBar.appendChild(btn);
    });
  }

  /**
   * Render Filtered Menu Items
   */
  function renderMenuFeed() {
    const filtered = state.menuItems.filter((item) => {
      if (state.selectedCategory === "all") return true;
      return item.category === state.selectedCategory;
    });

    if (filtered.length === 0) {
      el.menuFeed.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🍽️</div>
          <h3>No items in this category</h3>
          <p style="font-size:0.85rem;margin-top:6px;">Please choose another category from the bar above.</p>
        </div>
      `;
      return;
    }

    el.menuFeed.innerHTML = "";
    filtered.forEach((item) => {
      const card = document.createElement("article");
      card.className = `dish-card ${!item.inStock ? "out-of-stock" : ""}`;

      const cartQty = state.cart[item.id] ? state.cart[item.id].qty : 0;

      card.innerHTML = `
        <div class="dish-info">
          <div class="dish-category">${escapeHtml(item.category || "Main")}</div>
          <h3 class="dish-name">
            ${escapeHtml(item.name)}
            ${!item.inStock ? '<span class="dish-tag oos">Sold Out</span>' : ""}
          </h3>
          <div class="dish-price">${formatCurrency(item.price)}</div>
        </div>
        <div class="dish-action">
          ${
            !item.inStock
              ? `<button class="btn-add" disabled>Unavailable</button>`
              : cartQty > 0
              ? `
                <div class="qty-stepper">
                  <button class="qty-btn btn-dec" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                  <span class="qty-count">${cartQty}</span>
                  <button class="qty-btn btn-inc" data-id="${item.id}" aria-label="Increase quantity">+</button>
                </div>
              `
              : `
                <button class="btn-add btn-initial-add" data-id="${item.id}">
                  + Add
                </button>
              `
          }
        </div>
      `;

      el.menuFeed.appendChild(card);
    });

    // Attach click events for steppers
    el.menuFeed.querySelectorAll(".btn-initial-add").forEach((b) => {
      b.onclick = () => addToCart(b.dataset.id);
    });
    el.menuFeed.querySelectorAll(".btn-inc").forEach((b) => {
      b.onclick = () => addToCart(b.dataset.id);
    });
    el.menuFeed.querySelectorAll(".btn-dec").forEach((b) => {
      b.onclick = () => decrementCart(b.dataset.id);
    });
  }

  /**
   * Cart Management
   */
  function addToCart(dishId) {
    const item = state.menuItems.find((d) => d.id === dishId);
    if (!item || !item.inStock) return;

    if (!state.cart[dishId]) {
      state.cart[dishId] = { item, qty: 1 };
    } else {
      state.cart[dishId].qty += 1;
    }

    updateCartUI();
  }

  function decrementCart(dishId) {
    if (!state.cart[dishId]) return;

    state.cart[dishId].qty -= 1;
    if (state.cart[dishId].qty <= 0) {
      delete state.cart[dishId];
    }

    updateCartUI();
  }

  function updateCartUI() {
    const cartEntries = Object.values(state.cart);
    const totalItems = cartEntries.reduce((sum, entry) => sum + entry.qty, 0);
    const totalPrice = cartEntries.reduce((sum, entry) => sum + entry.qty * entry.item.price, 0);

    // Floating Cart Bar Visibility
    if (totalItems > 0) {
      el.cartBar.style.display = "flex";
      el.cartItemCount.textContent = `${totalItems} ITEM${totalItems > 1 ? "S" : ""}`;
      el.cartBarTotal.textContent = formatCurrency(totalPrice);
    } else {
      el.cartBar.style.display = "none";
      closeCartModal();
    }

    // Refresh menu item counts
    renderMenuFeed();
    renderModalCartItems(cartEntries, totalPrice);
  }

  /**
   * Render Items in Slide-up Review Modal
   */
  function renderModalCartItems(cartEntries, totalPrice) {
    if (cartEntries.length === 0) {
      el.modalCartItems.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:20px;">Your cart is empty.</p>`;
      el.summarySubtotal.textContent = "₹0";
      el.summaryTotal.textContent = "₹0";
      return;
    }

    el.modalCartItems.innerHTML = "";
    cartEntries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "cart-item-row";
      row.innerHTML = `
        <div class="cart-item-info">
          <h4>${escapeHtml(entry.item.name)}</h4>
          <span>${formatCurrency(entry.item.price)} &times; ${entry.qty} = ${formatCurrency(entry.item.price * entry.qty)}</span>
        </div>
        <div class="qty-stepper">
          <button class="qty-btn" onclick="window.AOLA_CUSTOMER.decrement('${entry.item.id}')">-</button>
          <span class="qty-count">${entry.qty}</span>
          <button class="qty-btn" onclick="window.AOLA_CUSTOMER.increment('${entry.item.id}')">+</button>
        </div>
      `;
      el.modalCartItems.appendChild(row);
    });

    el.summarySubtotal.textContent = formatCurrency(totalPrice);
    el.summaryTotal.textContent = formatCurrency(totalPrice);
  }

  /**
   * Handle Order Submission
   */
  async function submitOrder() {
    if (state.isSubmitting) return;

    // ==========================================
    // SECURITY LAYER 1: FRONTEND HONEYPOT CHECK
    // ==========================================
    const honeypotVal = el.customerFax.value;
    if (honeypotVal && honeypotVal.trim().length > 0) {
      console.warn("[AOLA Security] Bot detected via invisible honeypot field. Aborting order.");
      showToast("Order could not be verified. Please try again.", "error");
      return;
    }

    // Validate table number
    const tableNumber = el.orderTableInput.value.trim();
    if (!tableNumber) {
      showToast("Please enter your table number to proceed.", "error");
      el.orderTableInput.focus();
      return;
    }

    const cartEntries = Object.values(state.cart);
    if (cartEntries.length === 0) {
      showToast("Your cart is empty. Please select some dishes first.", "error");
      return;
    }

    // Prepare payload
    const itemsPayload = cartEntries.map((e) => ({
      name: e.item.name,
      qty: e.qty,
      price: e.item.price
    }));

    const totalPrice = cartEntries.reduce((sum, e) => sum + e.qty * e.item.price, 0);
    const notes = el.orderNotesInput.value.trim();

    state.isSubmitting = true;
    el.btnSubmitOrder.disabled = true;
    el.btnSubmitOrder.innerHTML = `<span>Placing Order...</span>`;

    try {
      const response = await AOLA_API.post("place_order", {
        shop_id: state.shopId,
        table_number: tableNumber,
        items: itemsPayload,
        total_price: totalPrice,
        customer_notes: notes,
        customer_fax: honeypotVal // Pass honeypot for double verification
      });

      if (!response.success) {
        // Backend Rate Limiting or other error triggered
        showToast(response.error || "Order placement failed.", "error");
        return;
      }

      // Success! Show confirmation
      closeCartModal();
      showSuccessModal(response.order_id, response.table_number, response.total_price);

      // Reset cart
      state.cart = {};
      updateCartUI();
      el.orderNotesInput.value = "";
    } catch (err) {
      showToast("Network error placing order. Please check your connection.", "error");
    } finally {
      state.isSubmitting = false;
      el.btnSubmitOrder.disabled = false;
      el.btnSubmitOrder.innerHTML = `
        <span>Send Order to Kitchen</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 2L11 13"></path>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
    }
  }

  /**
   * Modal Open / Close Helpers
   */
  function openCartModal() {
    el.cartModal.classList.add("open");
  }

  function closeCartModal() {
    el.cartModal.classList.remove("open");
  }

  function showSuccessModal(orderId, tableNum, totalAmt) {
    el.successOrderId.textContent = orderId;
    el.successTableNum.textContent = `Table ${tableNum}`;
    el.successTotalAmt.textContent = formatCurrency(totalAmt);
    el.successModal.classList.add("open");
  }

  function closeSuccessModal() {
    el.successModal.classList.remove("open");
  }

  function renderSuspendedNotice(message) {
    el.menuFeed.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        <div class="empty-state-icon" style="color:var(--accent-rose); opacity:1;">⚠️</div>
        <h2 style="color:var(--accent-rose); margin-bottom: 8px;">Service Temporarily Inactive</h2>
        <p style="color:var(--text-muted); font-size:0.95rem; max-width:320px; margin:0 auto;">
          ${escapeHtml(message || "This restaurant's ordering system is currently offline.")}
        </p>
      </div>
    `;
    el.restaurantName.textContent = "Offline";
  }

  function renderErrorNotice(message) {
    el.menuFeed.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Unable to load menu</h3>
        <p style="color:var(--text-muted);margin:8px 0 16px;">${escapeHtml(message)}</p>
        <button class="btn-secondary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  /**
   * Bind DOM Events
   */
  function setupEventListeners() {
    el.btnOpenCart.onclick = openCartModal;
    el.btnCloseCart.onclick = closeCartModal;

    // Close modal if clicking on outer dark backdrop
    el.cartModal.onclick = (e) => {
      if (e.target === el.cartModal) closeCartModal();
    };

    el.btnSubmitOrder.onclick = submitOrder;

    el.btnOrderMore.onclick = () => {
      closeSuccessModal();
    };

    el.tableBadge.onclick = () => {
      const newTable = prompt("Enter your Table Number:", state.tableNumber || "");
      if (newTable && newTable.trim()) {
        state.tableNumber = newTable.trim();
        el.tableLabel.textContent = `Table ${state.tableNumber}`;
        el.orderTableInput.value = state.tableNumber;
      }
    };
  }

  // Expose methods for stepper buttons rendered in modal
  window.AOLA_CUSTOMER = {
    increment: addToCart,
    decrement: decrementCart
  };

  // Launch on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
