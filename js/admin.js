/**
 * AOLA - Agency Master Admin Controller (admin.html)
 */

(function () {
  const state = {
    adminPin: "",
    shops: []
  };

  const el = {
    adminLoginOverlay: document.getElementById("admin-login-overlay"),
    adminPinInput: document.getElementById("admin-pin-input"),
    adminLoginForm: document.getElementById("admin-login-form"),
    btnAdminLoginSubmit: document.getElementById("btn-admin-login-submit"),
    adminDashboardContainer: document.getElementById("admin-dashboard-container"),
    btnAdminLogout: document.getElementById("btn-admin-logout"),
    btnRefreshClients: document.getElementById("btn-refresh-clients"),
    metricTotalShops: document.getElementById("metric-total-shops"),
    metricActiveShops: document.getElementById("metric-active-shops"),
    metricSuspendedShops: document.getElementById("metric-suspended-shops"),
    shopsTbody: document.getElementById("shops-tbody"),
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
        btnToggleAdminPin.textContent = isPassword ? "🙈" : "👁️";
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

  /**
   * Action: Change Master PIN
   */
  async function handleChangeMasterPinSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const currentPin = el.inputMasterCurrentPin.value.trim();
    const newPin = el.inputMasterNewPin.value.trim();
    const confirmPin = el.inputMasterConfirmPin.value.trim();

    if (!currentPin || !newPin) {
      showToast("Please enter current and new PIN.", "error");
      return;
    }

    if (newPin !== confirmPin) {
      showToast("New PIN and Confirm PIN do not match.", "error");
      return;
    }

    if (newPin.length < 4) {
      showToast("Master PIN must be at least 4 digits.", "error");
      return;
    }

    el.btnSubmitMasterPin.disabled = true;
    el.btnSubmitMasterPin.textContent = "Updating...";

    try {
      const response = await AOLA_API.post("admin_change_pin", {
        current_pin: currentPin,
        new_pin: newPin,
        admin_pin: currentPin
      });

      if (!response.success) {
        showToast(response.error || "Failed to update PIN.", "error");
        return;
      }

      state.adminPin = newPin;
      sessionStorage.setItem("AOLA_ADMIN_PIN", newPin);
      showToast("Master Admin PIN updated successfully!", "success");
      el.masterPinModal.classList.remove("open");
    } catch (err) {
      showToast("Error updating Master PIN.", "error");
    } finally {
      el.btnSubmitMasterPin.disabled = false;
      el.btnSubmitMasterPin.textContent = "Update Master PIN";
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
      el.btnAdminLoginSubmit.innerHTML = `<span>Enter Master Console</span>`;
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
        el.btnRefreshClients.textContent = "🔄 Sync Master DB";
        el.btnRefreshClients.disabled = false;
      }
    }
  }

  function handleShopsUpdate(shops) {
    state.shops = shops;

    const total = shops.length;
    const active = shops.filter((s) => s.status.toLowerCase() === "active").length;
    const suspended = shops.filter((s) => s.status.toLowerCase() === "suspended").length;

    el.metricTotalShops.textContent = total;
    el.metricActiveShops.textContent = active;
    el.metricSuspendedShops.textContent = suspended;

    renderShopsTable();
  }

  /**
   * Render Master DB Table Rows
   */
  function renderShopsTable() {
    if (state.shops.length === 0) {
      el.shopsTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">
            No client restaurants found in AOLA_Master_DB. Click "+ Onboard New Client" to add one.
          </td>
        </tr>
      `;
      return;
    }

    el.shopsTbody.innerHTML = "";
    state.shops.forEach((shop) => {
      const isActive = shop.status.toLowerCase() === "active";
      const tr = document.createElement("tr");

      // Generate base URLs for customer & owner (always uses live production URL)
      const baseUrl = getAppBaseUrl();
      const customerUrl = `${baseUrl}?shop=${encodeURIComponent(shop.shopId)}`;
      const ownerUrl = `${baseUrl}owner.html?shop=${encodeURIComponent(shop.shopId)}`;

      tr.innerHTML = `
        <td>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:var(--bg-elevated);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              ${
                shop.logoUrl
                  ? `<img src="${escapeHtml(shop.logoUrl)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;">`
                  : `🍽️`
              }
            </div>
            <div>
              <strong style="color:#fff;">${escapeHtml(shop.shopName)}</strong>
            </div>
          </div>
        </td>
        <td>
          <code style="color:var(--primary);">${escapeHtml(shop.shopId)}</code>
        </td>
        <td>
          <span title="${escapeHtml(shop.sheetId)}" style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);cursor:pointer;" onclick="navigator.clipboard.writeText('${escapeHtml(shop.sheetId)}');showToast('Sheet ID copied!','info');">
            ${escapeHtml(shop.sheetId.slice(0, 10))}... 📋
          </span>
        </td>
        <td>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="owner-pin-text" data-pin="${escapeHtml(shop.ownerPin)}" style="font-family:monospace;font-weight:700;letter-spacing:1px;">••••</span>
            <button type="button" class="btn-toggle-row-pin" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:0.85rem;" title="Show/Hide PIN">👁️</button>
          </div>
        </td>
        <td>
          <span class="status-badge ${isActive ? "active" : "suspended"}">
            ${isActive ? "Active" : "Suspended"}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="window.open('${customerUrl}', '_blank')" title="Open Customer Menu">
              Menu ↗
            </button>
            <button class="btn-secondary btn-view-qr" data-id="${escapeHtml(shop.shopId)}" style="padding:4px 8px;font-size:0.75rem;color:var(--primary);" title="View & Print Table QR Code">
              QR Code 📱
            </button>
            <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="navigator.clipboard.writeText('${customerUrl}');showToast('Customer QR URL copied!','success');" title="Copy QR Menu URL">
              Copy URL 🔗
            </button>
            <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="window.open('${ownerUrl}', '_blank')" title="Open Kitchen Display">
              Kitchen 👨‍🍳
            </button>
          </div>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button class="btn-secondary btn-edit-shop" data-id="${escapeHtml(shop.shopId)}" style="padding:6px 10px;font-size:0.8rem;">
              Edit
            </button>
            <button class="${isActive ? "btn-danger" : "btn-emerald"} btn-toggle-status" data-id="${escapeHtml(shop.shopId)}" data-target-status="${isActive ? "Suspended" : "Active"}" style="padding:6px 12px;font-size:0.8rem;">
              ${isActive ? "Suspend" : "Activate"}
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
        b.textContent = isMasked ? "🙈" : "👁️";
      };
    });
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
      : `<span>⚡ Auto-Cloning Google Sheet...</span>`;

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
      el.btnSaveShopSubmit.innerHTML = `<span>Save Restaurant to Master DB</span>`;
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
