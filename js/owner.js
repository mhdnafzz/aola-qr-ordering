/**
 * AOLA - Kitchen Display & Owner Dashboard Controller (owner.html)
 */

(function () {
  const state = {
    shopId: "",
    pin: "",
    orders: [],
    activeTab: "pending", // "pending" | "completed"
    pollTimer: null,
    knownOrderIds: new Set(),
    isInitialLoad: true
  };

  const el = {
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
    tabPending: document.getElementById("tab-pending"),
    tabCompleted: document.getElementById("tab-completed"),
    countPending: document.getElementById("count-pending"),
    countCompleted: document.getElementById("count-completed"),
    ticketGrid: document.getElementById("ticket-grid"),
    chkAudio: document.getElementById("chk-audio"),
    btnTogglePinVisibility: document.getElementById("btn-toggle-pin-visibility"),
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
    if (!el.chkAudio.checked) return;
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
    // Check URL param or stored session
    const urlShop = getUrlParam("shop");
    if (urlShop) {
      el.loginShopId.value = urlShop.toLowerCase().trim();
    } else if (!el.loginShopId.value) {
      el.loginShopId.value = "bismillah";
    }

    // Toggle PIN visibility
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
   * Login Handler
   */
  async function handleLoginSubmit() {
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

    await performLogin();

    el.btnLoginSubmit.disabled = false;
    el.btnLoginSubmit.innerHTML = `<span>Unlock Kitchen Display</span>`;
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

      // Save authenticated session
      sessionStorage.setItem("AOLA_OWNER_SHOP", state.shopId);
      sessionStorage.setItem("AOLA_OWNER_PIN", state.pin);

      // Hide login overlay, show dashboard
      el.loginOverlay.classList.remove("open");
      el.dashboardContainer.style.display = "block";
      el.ownerShopName.textContent = response.shopName || "Kitchen Display";
      el.ownerShopTag.textContent = `@${state.shopId}`;

      // Populate orders
      handleOrdersUpdate(response.orders || []);

      // Start 15s Polling
      startPolling();
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
    state.knownOrderIds.clear();
    state.isInitialLoad = true;

    el.dashboardContainer.style.display = "none";
    el.loginOverlay.classList.add("open");
    el.loginPin.value = "";
    showToast("Logged out successfully.", "info");
  }

  /**
   * 15-Second Polling Timer
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
    state.orders = newOrders;

    let hasNewPendingOrder = false;
    newOrders.forEach((o) => {
      if (o.status.toLowerCase() === "pending") {
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
    const pendingCount = state.orders.filter((o) => o.status.toLowerCase() === "pending").length;
    const completedCount = state.orders.filter((o) => o.status.toLowerCase() === "completed").length;

    el.countPending.textContent = pendingCount;
    el.countCompleted.textContent = completedCount;
  }

  /**
   * Render Ticket Cards
   */
  function renderTickets() {
    const filtered = state.orders.filter((o) => {
      const isPending = o.status.toLowerCase() === "pending";
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
      const isPending = ord.status.toLowerCase() === "pending";
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

    // Attach click events for "Mark Complete"
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

      // Update local state immediately
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
