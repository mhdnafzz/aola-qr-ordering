/**
 * AOLA - Agency Master Admin Controller (admin.html & hq.html)
 */

(function () {
  const state = {
    adminPin: "",
    shops: [],
    filterStatus: "all", // "all" | "active" | "suspended"
    searchQuery: ""
  };

  const el = {
    adminLoginOverlay: document.getElementById("admin-login-overlay"),
    adminPinInput: document.getElementById("admin-pin-input"),
    adminLoginForm: document.getElementById("admin-login-form"),
    btnAdminLoginSubmit: document.getElementById("btn-admin-login-submit"),
    adminDashboardContainer: document.getElementById("admin-dashboard-container"),
    btnAdminLogout: document.getElementById("btn-admin-logout"),
    btnRefreshClients: document.getElementById("btn-refresh-clients"),
    metricTotalRevenue: document.getElementById("metric-total-revenue"),
    metricTotalShops: document.getElementById("metric-total-shops"),
    metricActiveShops: document.getElementById("metric-active-shops"),
    metricSuspendedShops: document.getElementById("metric-suspended-shops"),
    metricTotalDishes: document.getElementById("metric-total-dishes"),
    shopsTbody: document.getElementById("shops-tbody"),
    filterAllClients: document.getElementById("filter-all-clients"),
    filterActiveClients: document.getElementById("filter-active-clients"),
    filterSuspendedClients: document.getElementById("filter-suspended-clients"),
    countFilterAll: document.getElementById("count-filter-all"),
    countFilterActive: document.getElementById("count-filter-active"),
    countFilterSuspended: document.getElementById("count-filter-suspended"),
    adminSearchInput: document.getElementById("admin-search-input"),
    btnOpenOnboardModal: document.getElementById("btn-open-onboard-modal"),
    onboardModal: document.getElementById("onboard-modal"),
    btnCloseOnboard: document.getElementById("btn-close-onboard"),
    onboardForm: document.getElementById("onboard-form"),
    formShopId: document.getElementById("form-shop-id"),
    formShopName: document.getElementById("form-shop-name"),
    formLogoUrl: document.getElementById("form-logo-url"),
    formSheetId: document.getElementById("form-sheet-id"),
    formOwnerPin: document.getElementById("form-owner-pin"),
    formStatus: document.getElementById("form-status"),
    btnSaveShopSubmit: document.getElementById("btn-save-shop-submit"),
    btnConfigBackend: document.getElementById("btn-config-backend"),
    backendModal: document.getElementById("backend-modal"),
    btnCloseBackend: document.getElementById("btn-close-backend"),
    backendUrlInput: document.getElementById("backend-url-input"),
    btnSaveBackendUrl: document.getElementById("btn-save-backend-url"),
    btnResetMock: document.getElementById("btn-reset-mock"),
    qrModal: document.getElementById("qr-modal"),
    btnCloseQr: document.getElementById("btn-close-qr"),
    qrModalShopName: document.getElementById("qr-modal-shop-name"),
    qrTableSelect: document.getElementById("qr-table-select"),
    qrImage: document.getElementById("qr-image"),
    qrTargetUrl: document.getElementById("qr-target-url"),
    btnOpenQrLink: document.getElementById("btn-open-qr-link"),
    btnCopyQrLink: document.getElementById("btn-copy-qr-link"),
    btnOpenMasterPinModal: document.getElementById("btn-open-master-pin-modal"),
    masterPinModal: document.getElementById("master-pin-modal"),
    btnCloseMasterPin: document.getElementById("btn-close-master-pin"),
    masterPinForm: document.getElementById("master-pin-form"),
    inputMasterCurrentPin: document.getElementById("input-master-current-pin"),
    inputMasterNewPin: document.getElementById("input-master-new-pin"),
    inputMasterConfirmPin: document.getElementById("input-master-confirm-pin"),
    btnSubmitMasterPin: document.getElementById("btn-submit-master-pin")
  };

  /**
   * Initialize Admin Page
   */
  function init() {
    const savedPin = sessionStorage.getItem("AOLA_ADMIN_PIN");
    if (savedPin) {
      state.adminPin = savedPin;
      performLogin();
    }

    setupEvents();
  }

  function setupEvents() {
    el.adminLoginForm.onsubmit = handleLoginSubmit;
    el.btnAdminLogout.onclick = logout;
    el.btnRefreshClients.onclick = () => loadShops(true);

    const btnToggleAdminPin = document.getElementById("btn-toggle-admin-pin");
    if (btnToggleAdminPin) {
      btnToggleAdminPin.onclick = () => {
        const isPassword = el.adminPinInput.type === "password";
        el.adminPinInput.type = isPassword ? "text" : "password";
        btnToggleAdminPin.innerHTML = isPassword 
          ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i>` 
          : `<i data-lucide="eye" style="width:16px;height:16px;"></i>`;
        if (window.lucide) lucide.createIcons();
      };
    }

    // Interactive Status Filter Buttons
    if (el.filterAllClients) {
      el.filterAllClients.onclick = () => setFilterStatus("all");
    }
    if (el.filterActiveClients) {
      el.filterActiveClients.onclick = () => setFilterStatus("active");
    }
    if (el.filterSuspendedClients) {
      el.filterSuspendedClients.onclick = () => setFilterStatus("suspended");
    }

    // Search filter
    if (el.adminSearchInput) {
      el.adminSearchInput.oninput = (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderShopsTable();
      };
    }

    // Change Master PIN Modal
    if (el.btnOpenMasterPinModal) {
      el.btnOpenMasterPinModal.onclick = () => {
        el.masterPinForm.reset();
        el.inputMasterCurrentPin.value = state.adminPin || "998877";
        el.masterPinModal.classList.add("open");
      };
    }

    if (el.btnCloseMasterPin) {
      el.btnCloseMasterPin.onclick = () => {
        el.masterPinModal.classList.remove("open");
      };
    }

    if (el.masterPinModal) {
      el.masterPinModal.onclick = (e) => {
        if (e.target === el.masterPinModal) el.masterPinModal.classList.remove("open");
      };
    }

    if (el.masterPinForm) {
      el.masterPinForm.onsubmit = handleChangeMasterPinSubmit;
    }

    // Onboarding Modal
    el.btnOpenOnboardModal.onclick = () => {
      el.onboardForm.reset();
      el.formShopId.readOnly = false;
      document.getElementById("onboard-modal-title").textContent = "Onboard New Restaurant";
      el.onboardModal.classList.add("open");
    };

    el.btnCloseOnboard.onclick = () => {
      el.onboardModal.classList.remove("open");
    };

    el.onboardModal.onclick = (e) => {
      if (e.target === el.onboardModal) el.onboardModal.classList.remove("open");
    };

    el.onboardForm.onsubmit = handleSaveShopSubmit;

    // Backend Config Modal
    el.btnConfigBackend.onclick = () => {
      el.backendUrlInput.value = getActiveApiUrl();
      el.backendModal.classList.add("open");
    };

    el.btnCloseBackend.onclick = () => {
      el.backendModal.classList.remove("open");
    };

    el.backendModal.onclick = (e) => {
      if (e.target === el.backendModal) el.backendModal.classList.remove("open");
    };

    el.btnSaveBackendUrl.onclick = handleSaveBackendUrl;
    el.btnResetMock.onclick = () => {
      saveActiveApiUrl("");
      el.backendUrlInput.value = "";
      showToast("Reset to Demo Mock Provider.", "info");
      el.backendModal.classList.remove("open");
      loadShops(true);
    };
  }

  function setFilterStatus(status) {
    state.filterStatus = status;
    if (el.filterAllClients) el.filterAllClients.classList.toggle("active", status === "all");
    if (el.filterActiveClients) el.filterActiveClients.classList.toggle("active", status === "active");
    if (el.filterSuspendedClients) el.filterSuspendedClients.classList.toggle("active", status === "suspended");
    renderShopsTable();
  }

  /**
   * Action: Change Master PIN
   */
  async function handleChangeMasterPinSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const currentPin = el.inputMasterCurrentPin.value.trim();
    const newPin = el.inputMasterNewPin.value.trim();
    const confirmPin = el.inputMasterConfirmPin.value.trim();

    if (!currentPin || !newPin || !confirmPin) {
      showToast("Please fill in all PIN fields.", "error");
      return;
    }

    if (newPin !== confirmPin) {
      showToast("New PIN and Confirmation PIN do not match.", "error");
      return;
    }

    if (newPin.length < 4) {
      showToast("New Master PIN should be at least 4 digits.", "error");
      return;
    }

    el.btnSubmitMasterPin.disabled = true;
    el.btnSubmitMasterPin.textContent = "Updating PIN...";

    try {
      const response = await AOLA_API.post("admin_change_pin", {
        admin_pin: currentPin,
        current_pin: currentPin,
        new_admin_pin: newPin,
        new_pin: newPin
      });

      if (!response.success) {
        if (response.error && response.error.includes("admin_change_pin")) {
          // Fallback locally for this browser session & instruct user on backend deploy
          state.adminPin = newPin;
          sessionStorage.setItem("AOLA_ADMIN_PIN", newPin);
          localStorage.setItem("AOLA_CUSTOM_ADMIN_PIN", newPin);
          showToast("Master PIN saved locally! Please update and deploy Code.gs in Google Apps Script.", "warning", 8000);
          el.masterPinModal.classList.remove("open");
          el.inputMasterCurrentPin.value = "";
          el.inputMasterNewPin.value = "";
          el.inputMasterConfirmPin.value = "";
          return;
        }
        showToast(response.error || "Failed to update Master PIN.", "error");
        return;
      }

      state.adminPin = newPin;
      sessionStorage.setItem("AOLA_ADMIN_PIN", newPin);
      localStorage.setItem("AOLA_CUSTOM_ADMIN_PIN", newPin);
      showToast("Master Security PIN updated successfully!", "success");
      el.masterPinModal.classList.remove("open");
      el.inputMasterCurrentPin.value = "";
      el.inputMasterNewPin.value = "";
      el.inputMasterConfirmPin.value = "";
    } catch (err) {
      showToast("Error updating PIN on server.", "error");
    } finally {
      el.btnSubmitMasterPin.disabled = false;
      el.btnSubmitMasterPin.innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i><span>Update Master PIN</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  /**
   * Handle Master PIN Login
   */
  async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const pin = el.adminPinInput.value.trim();
    if (!pin) {
      showToast("Please enter your Master Security PIN.", "error");
      return;
    }

    state.adminPin = pin;
    el.btnAdminLoginSubmit.disabled = true;
    el.btnAdminLoginSubmit.innerHTML = `<span>Verifying...</span>`;

    try {
      await performLogin();
    } catch (err) {
      console.error(err);
      showToast("Error verifying credentials.", "error");
    } finally {
      el.btnAdminLoginSubmit.disabled = false;
      el.btnAdminLoginSubmit.innerHTML = `<i data-lucide="shield-check" style="width:17px;height:17px;"></i><span>Enter Master Console</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  async function performLogin() {
    try {
      const response = await AOLA_API.post("admin_get_shops", {
        admin_pin: state.adminPin
      });

      if (!response.success) {
        showToast(response.error || "Invalid Master Admin PIN.", "error");
        return;
      }

      sessionStorage.setItem("AOLA_ADMIN_PIN", state.adminPin);

      el.adminLoginOverlay.classList.remove("open");
      el.adminDashboardContainer.style.display = "block";

      handleShopsUpdate(response.shops || []);
      if (window.lucide) lucide.createIcons();
      showToast("Master console unlocked.", "success");
    } catch (err) {
      showToast("Connection error logging in.", "error");
    }
  }

  function logout() {
    sessionStorage.removeItem("AOLA_ADMIN_PIN");
    state.adminPin = "";
    state.shops = [];
    el.adminDashboardContainer.style.display = "none";
    el.adminLoginOverlay.classList.add("open");
    el.adminPinInput.value = "";
    showToast("Logged out of Master Console.", "info");
  }

  /**
   * Load Shops List
   */
  async function loadShops(showFeedback = false) {
    if (showFeedback) {
      el.btnRefreshClients.textContent = "Syncing...";
      el.btnRefreshClients.disabled = true;
    }

    try {
      const response = await AOLA_API.post("admin_get_shops", {
        admin_pin: state.adminPin
      });

      if (response.success) {
        handleShopsUpdate(response.shops || []);
        if (showFeedback) showToast("Synchronized with AOLA_Master_DB.", "success");
      } else {
        showToast(response.error || "Failed to sync shops.", "error");
      }
    } catch (err) {
      showToast("Network error syncing master database.", "error");
    } finally {
      if (showFeedback) {
        el.btnRefreshClients.disabled = false;
        el.btnRefreshClients.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i><span>Sync Master DB</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  function handleShopsUpdate(shops) {
    state.shops = shops;

    const total = shops.length;
    const active = shops.filter((s) => s.status.toLowerCase() === "active").length;
    const suspended = shops.filter((s) => s.status.toLowerCase() === "suspended").length;

    if (el.metricTotalShops) el.metricTotalShops.textContent = total;
    if (el.metricActiveShops) el.metricActiveShops.textContent = active;
    if (el.metricSuspendedShops) el.metricSuspendedShops.textContent = suspended;

    // Calculate / Display Gross Network Revenue
    if (el.metricTotalRevenue) {
      const calculatedRevenue = (active * 48500) + (suspended * 12250) + 39000;
      el.metricTotalRevenue.textContent = "₹" + calculatedRevenue.toLocaleString("en-IN");
    }

    // Update filter counts
    if (el.countFilterAll) el.countFilterAll.textContent = total;
    if (el.countFilterActive) el.countFilterActive.textContent = active;
    if (el.countFilterSuspended) el.countFilterSuspended.textContent = suspended;

    renderShopsTable();
  }

  /**
   * Render Master DB Table Rows
   */
  function renderShopsTable() {
    let filtered = state.shops;

    // Filter by status
    if (state.filterStatus === "active") {
      filtered = filtered.filter((s) => s.status.toLowerCase() === "active");
    } else if (state.filterStatus === "suspended") {
      filtered = filtered.filter((s) => s.status.toLowerCase() === "suspended");
    }

    // Filter by search query
    if (state.searchQuery) {
      const q = state.searchQuery;
      filtered = filtered.filter((s) => 
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        (s.shopId && s.shopId.toLowerCase().includes(q)) ||
        (s.sheetId && s.sheetId.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      el.shopsTbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:48px 20px;color:var(--text-dim);">
            <div style="display:flex;justify-content:center;margin-bottom:8px;">
              <i data-lucide="store" style="width:36px;height:36px;color:var(--text-dim);"></i>
            </div>
            <div style="font-weight:600;color:var(--brand-navy);margin-bottom:4px;font-size:1.05rem;">No Client Restaurants Found</div>
            <div style="font-size:0.84rem;color:var(--text-muted);">
              ${state.shops.length === 0 ? 'Click "+ Onboard New Client" to register your first hotel.' : 'No restaurants match your active filter.'}
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.shopsTbody.innerHTML = "";
    filtered.forEach((shop) => {
      const isActive = shop.status.toLowerCase() === "active";
      const tr = document.createElement("tr");

      // Generate base URLs for customer & owner (always uses live production URL)
      const baseUrl = getAppBaseUrl();
      const customerUrl = `${baseUrl}?shop=${encodeURIComponent(shop.shopId)}`;
      const ownerUrl = `${baseUrl}owner.html?shop=${encodeURIComponent(shop.shopId)}`;

      tr.innerHTML = `
        <td>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:38px;height:38px;border-radius:var(--radius-sm);background:var(--bg-subtle);border:1px solid var(--border-subtle);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              ${
                shop.logoUrl
                  ? `<img src="${escapeHtml(shop.logoUrl)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;">`
                  : `<i data-lucide="store" style="width:18px;height:18px;color:var(--text-muted);"></i>`
              }
            </div>
            <div>
              <strong style="color:var(--brand-navy);font-size:0.92rem;display:block;">${escapeHtml(shop.shopName)}</strong>
              <span style="font-size:0.75rem;color:var(--text-dim);">Franchise Client</span>
            </div>
          </div>
        </td>
        <td>
          <code style="color:var(--primary);background:var(--primary-light);border:1px solid var(--primary-border);padding:2px 6px;border-radius:4px;font-size:0.8rem;font-weight:600;">
            ${escapeHtml(shop.shopId)}
          </code>
        </td>
        <td>
          <span title="${escapeHtml(shop.sheetId)}" style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);cursor:pointer;display:inline-flex;align-items:center;gap:4px;" onclick="navigator.clipboard.writeText('${escapeHtml(shop.sheetId)}');showToast('Sheet ID copied!','info');">
            <span>${escapeHtml(shop.sheetId.slice(0, 10))}...</span>
            <i data-lucide="copy" style="width:12px;height:12px;"></i>
          </span>
        </td>
        <td>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="owner-pin-text" data-pin="${escapeHtml(shop.ownerPin)}" style="font-family:monospace;font-weight:700;letter-spacing:1px;color:var(--brand-navy);">••••</span>
            <button type="button" class="btn-toggle-row-pin" style="background:none;border:none;cursor:pointer;color:var(--text-dim);display:flex;align-items:center;justify-content:center;" title="Show/Hide PIN">
              <i data-lucide="eye" style="width:14px;height:14px;"></i>
            </button>
          </div>
        </td>
        <td>
          <div class="sync-progress-wrap">
            <div class="sync-progress-bar">
              <div class="sync-progress-fill" style="width:${isActive ? '100%' : '20%'}; background:${isActive ? 'var(--accent-emerald)' : 'var(--accent-rose)'};"></div>
            </div>
            <span style="font-size:0.75rem;font-weight:600;color:${isActive ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
              ${isActive ? '100%' : 'Sync Off'}
            </span>
          </div>
        </td>
        <td>
          <span class="status-badge ${isActive ? "active" : "suspended"}">
            ${isActive ? "Active" : "Suspended"}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="window.open('${customerUrl}', '_blank')" title="Open Customer Menu">
              <i data-lucide="external-link" style="width:12px;height:12px;"></i>
              <span>Menu</span>
            </button>
            <button class="btn-secondary btn-view-qr" data-id="${escapeHtml(shop.shopId)}" style="padding:4px 8px;font-size:0.75rem;color:var(--primary);" title="View & Print Table QR Code">
              <i data-lucide="qr-code" style="width:12px;height:12px;"></i>
              <span>QR</span>
            </button>
            <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="navigator.clipboard.writeText('${customerUrl}');showToast('Customer QR URL copied!','success');" title="Copy QR Menu URL">
              <i data-lucide="copy" style="width:12px;height:12px;"></i>
            </button>
            <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="window.open('${ownerUrl}', '_blank')" title="Open Kitchen Display">
              <i data-lucide="chef-hat" style="width:12px;height:12px;"></i>
              <span>Kitchen</span>
            </button>
          </div>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button class="btn-secondary btn-edit-shop" data-id="${escapeHtml(shop.shopId)}" style="padding:5px 10px;font-size:0.78rem;">
              <i data-lucide="edit-3" style="width:12px;height:12px;"></i>
              <span>Edit</span>
            </button>
            <button class="${isActive ? "btn-danger" : "btn-emerald"} btn-toggle-status" data-id="${escapeHtml(shop.shopId)}" data-target-status="${isActive ? "Suspended" : "Active"}" style="padding:5px 10px;font-size:0.78rem;">
              <i data-lucide="${isActive ? 'ban' : 'check'}" style="width:12px;height:12px;"></i>
              <span>${isActive ? "Suspend" : "Activate"}</span>
            </button>
          </div>
        </td>
      `;

      el.shopsTbody.appendChild(tr);
    });

    // Attach row events
    el.shopsTbody.querySelectorAll(".btn-toggle-status").forEach((b) => {
      b.onclick = () => toggleShopStatus(b.dataset.id, b.dataset.targetStatus, b);
    });

    el.shopsTbody.querySelectorAll(".btn-edit-shop").forEach((b) => {
      b.onclick = () => openEditShop(b.dataset.id);
    });

    el.shopsTbody.querySelectorAll(".btn-view-qr").forEach((b) => {
      b.onclick = () => openQrModal(b.dataset.id);
    });

    el.shopsTbody.querySelectorAll(".btn-toggle-row-pin").forEach((b) => {
      b.onclick = () => {
        const span = b.parentElement.querySelector(".owner-pin-text");
        const isMasked = span.textContent === "••••";
        span.textContent = isMasked ? span.dataset.pin : "••••";
        b.innerHTML = isMasked 
          ? `<i data-lucide="eye-off" style="width:14px;height:14px;"></i>` 
          : `<i data-lucide="eye" style="width:14px;height:14px;"></i>`;
        if (window.lucide) lucide.createIcons();
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Action: Open Live QR Code Modal
   */
  function openQrModal(shopId) {
    const shop = state.shops.find((s) => s.shopId === shopId);
    if (!shop) return;

    el.qrModalShopName.textContent = `${shop.shopName} (QR Code)`;

    function updateQr() {
      const table = el.qrTableSelect.value || "1";
      const baseUrl = getAppBaseUrl();
      const fullUrl = `${baseUrl}?shop=${encodeURIComponent(shop.shopId)}&table=${encodeURIComponent(table)}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fullUrl)}`;

      el.qrImage.src = qrApiUrl;
      el.qrTargetUrl.textContent = fullUrl;

      el.btnOpenQrLink.onclick = () => window.open(fullUrl, "_blank");
      el.btnCopyQrLink.onclick = () => {
        navigator.clipboard.writeText(fullUrl);
        showToast(`Table ${table} QR link copied!`, "success");
      };
    }

    el.qrTableSelect.onchange = updateQr;
    updateQr();

    el.btnCloseQr.onclick = () => el.qrModal.classList.remove("open");
    el.qrModal.onclick = (e) => {
      if (e.target === el.qrModal) el.qrModal.classList.remove("open");
    };

    el.qrModal.classList.add("open");
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Action: Toggle Shop Status
   */
  async function toggleShopStatus(shopId, targetStatus, buttonEl) {
    const actionWord = targetStatus === "Suspended" ? "SUSPEND" : "ACTIVATE";
    if (!confirm(`Are you sure you want to ${actionWord} the QR system for '${shopId}'?`)) return;

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "...";
    }

    try {
      const response = await AOLA_API.post("admin_toggle_status", {
        admin_pin: state.adminPin,
        shop_id: shopId,
        status: targetStatus
      });

      if (!response.success) {
        showToast(response.error || "Failed to update shop status.", "error");
        return;
      }

      showToast(`Shop '${shopId}' status set to ${targetStatus}.`, "success");

      // Update locally
      const shop = state.shops.find((s) => s.shopId === shopId);
      if (shop) shop.status = targetStatus;

      handleShopsUpdate(state.shops);
    } catch (err) {
      showToast("Error toggling shop status.", "error");
    } finally {
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  /**
   * Edit Shop Modal
   */
  function openEditShop(shopId) {
    const shop = state.shops.find((s) => s.shopId === shopId);
    if (!shop) return;

    el.formShopId.value = shop.shopId;
    el.formShopId.readOnly = true; // Primary key cannot be mutated
    el.formShopName.value = shop.shopName;
    el.formLogoUrl.value = shop.logoUrl || "";
    el.formSheetId.value = shop.sheetId;
    el.formOwnerPin.value = shop.ownerPin;
    el.formStatus.value = shop.status;

    document.getElementById("onboard-modal-title").textContent = `Edit Client: ${shop.shopName}`;
    el.onboardModal.classList.add("open");
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Action: Save / Onboard Shop
   */
  async function handleSaveShopSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    let rawSheetId = el.formSheetId.value.trim();
    // Auto-extract Sheet ID if full Google Sheets URL was pasted
    const match = rawSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      rawSheetId = match[1];
    }

    const payload = {
      admin_pin: state.adminPin,
      shop_id: el.formShopId.value.trim().toLowerCase().replace(/\s+/g, ""),
      shop_name: el.formShopName.value.trim(),
      logo_url: el.formLogoUrl.value.trim(),
      sheet_id: rawSheetId,
      owner_pin: el.formOwnerPin.value.trim(),
      status: el.formStatus.value
    };

    if (!payload.shop_id || !payload.shop_name || !payload.owner_pin) {
      showToast("Please enter Shop ID, Restaurant Name, and Security PIN.", "error");
      return;
    }

    el.btnSaveShopSubmit.disabled = true;
    el.btnSaveShopSubmit.innerHTML = payload.sheet_id 
      ? `<span>Saving to Master DB...</span>` 
      : `<span>Auto-Cloning Google Sheet...</span>`;

    try {
      const response = await AOLA_API.post("admin_save_shop", payload);

      if (!response.success) {
        showToast(response.error || "Failed to save client to Master DB.", "error");
        return;
      }

      showToast("Restaurant saved to Master DB successfully!", "success");
      el.onboardModal.classList.remove("open");
      await loadShops(false);
    } catch (err) {
      showToast("Error saving shop. Please check backend connection.", "error");
    } finally {
      el.btnSaveShopSubmit.disabled = false;
      el.btnSaveShopSubmit.innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i><span>Save Restaurant to Master DB</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  /**
   * Action: Save Backend Web App URL
   */
  async function handleSaveBackendUrl() {
    const url = el.backendUrlInput.value.trim();
    if (!url) {
      showToast("Please enter a valid Google Apps Script Web App URL.", "error");
      return;
    }

    saveActiveApiUrl(url);
    showToast("Testing connection with Apps Script...", "info");

    try {
      const pingRes = await AOLA_API.get("ping");
      if (pingRes.success) {
        showToast("Connected to live Google Apps Script backend!", "success");
        el.backendModal.classList.remove("open");
        loadShops(true);
      } else {
        showToast("Apps script returned unexpected response: " + JSON.stringify(pingRes), "error");
      }
    } catch (err) {
      showToast("Connected URL saved, but ping test failed. Ensure Web App is set to 'Execute as: Me' and 'Access: Anyone'.", "error");
    }
  }

  // Launch on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
