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
    btnSubmitChangePin: document.getElementById("btn-submit-change-pin")
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
        el.btnTogglePinVisibility.textContent = isPassword ? "🙈" : "👁️";
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
      el.btnLoginSubmit.innerHTML = `<span>Unlock Kitchen Display</span>`;
    }
  }

  // Global helper for instant 1-click test login
  window.AOLA_FORCE_OWNER_LOGIN = function (shopId = "bismillah", pin = "1234") {
    el.loginShopId.value = shopId;
    el.loginPin.value = pin;
    state.shopId = shopId;
    state.pin = pin;
    performLogin();
  };

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
        el.btnManualRefresh.textContent = "🔄 Refresh";
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
      status: String(o.status || "Pending").trim()
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
   * Render Ticket Cards
   */
  function renderTickets() {
    const filtered = state.orders.filter((o) => {
      const isPending = o.status.toLowerCase() === "pending" || o.status.toLowerCase() === "new";
      return state.activeTab === "pending" ? isPending : !isPending;
    });

    if (filtered.length === 0) {
      el.ticketGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">✅</div>
          <h3>No ${state.activeTab} orders right now</h3>
          <p style="font-size:0.88rem;color:var(--text-muted);margin-top:6px;">
            ${state.activeTab === "pending" ? "All clear! New QR orders will appear here automatically." : "No completed orders recorded yet."}
          </p>
        </div>
      `;
      return;
    }

    el.ticketGrid.innerHTML = "";
    filtered.forEach((ord) => {
      const isPending = ord.status.toLowerCase() === "pending" || ord.status.toLowerCase() === "new";
      const card = document.createElement("article");
      card.className = `ticket-card ${isPending ? "pending" : "completed"}`;

      card.innerHTML = `
        <div class="ticket-header">
          <div>
            <span class="ticket-table-badge">TABLE ${escapeHtml(ord.tableNumber)}</span>
            <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px;">ID: ${escapeHtml(ord.orderId)}</div>
          </div>
          <span class="ticket-time">${escapeHtml(ord.timestamp)}</span>
        </div>

        <div class="ticket-items">${escapeHtml(ord.items)}</div>

        <div class="ticket-footer">
          <div class="ticket-price">${formatCurrency(ord.totalPrice)}</div>
          ${
            isPending
              ? `
                <button class="btn-emerald btn-complete-order" data-id="${escapeHtml(ord.orderId)}">
                  ✓ Mark Complete
                </button>
              `
              : `<span class="status-badge" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald);">Completed</span>`
          }
        </div>
      `;

      el.ticketGrid.appendChild(card);
    });

    el.ticketGrid.querySelectorAll(".btn-complete-order").forEach((b) => {
      b.onclick = () => completeOrder(b.dataset.id, b);
    });
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
        el.btnRefreshMenu.textContent = "🔄 Sync Menu";
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
          <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-dim);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🍽️</div>
            <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">No Dishes Found</div>
            <div style="font-size: 0.85rem;">
              ${state.menu.length === 0 ? "Your menu has no items yet. Click '+ Add New Dish' to create your first item." : "No dishes match your active search or category filter."}
            </div>
          </td>
        </tr>
      `;
      return;
    }

    el.ownerMenuTbody.innerHTML = filtered
      .map((item) => {
        const vegBadge = item.isVeg
          ? `<span class="diet-tag-veg">🟢 Veg</span>`
          : `<span class="diet-tag-nonveg">🔴 Non-Veg</span>`;

        const stockButton = item.inStock
          ? `<button class="btn-stock-toggle in-stock" data-id="${escapeHtml(item.id)}" data-stock="true" title="Click to 86 / Mark Out of Stock">✅ In Stock</button>`
          : `<button class="btn-stock-toggle out-of-stock" data-id="${escapeHtml(item.id)}" data-stock="false" title="Click to mark Available">❌ Out of Stock</button>`;

        const descText = item.description
          ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.description)}</div>`
          : "";

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff; font-size: 0.96rem;">${escapeHtml(item.name)}</div>
              ${descText}
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">ID: <code>${escapeHtml(item.id)}</code></div>
            </td>
            <td>
              <span class="category-badge">${escapeHtml(item.category)}</span>
            </td>
            <td>${vegBadge}</td>
            <td style="font-weight: 700; color: var(--primary); font-size: 1rem;">
              ${state.currency}${item.price.toFixed(0)}
            </td>
            <td>${stockButton}</td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px;">
                <button class="btn-secondary btn-edit-dish" data-id="${escapeHtml(item.id)}" style="padding: 5px 10px; font-size: 0.82rem;" title="Edit Dish Details">
                  ✏️ Edit
                </button>
                <button class="btn-danger btn-delete-dish" data-id="${escapeHtml(item.id)}" style="padding: 5px 10px; font-size: 0.82rem;" title="Delete Dish">
                  🗑️
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
