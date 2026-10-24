/**
 * AOLA - Agency Master Admin Controller (admin.html & hq.html)
 */

(function () {
  const state = {
    adminPin: "",
    shops: [],
    filterStatus: "all", // "all" | "active" | "suspended"
    searchQuery: "",
    grossRevenue: 148250,
    activeTab: "shops", // "shops" | "expenses" | "trends"
    expenses: [],
    expenseCategoryFilter: "all",
    expenseSearchQuery: "",
    orders: [],
    trendTimeframe: "daily",
    trendChartInstance: null,
    breakdownChartInstance: null,
    logsFilter: "all",
    logsSearchQuery: "",
    logs: []
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
    heroTotalExpenses: document.getElementById("hero-total-expenses"),
    heroNetProfit: document.getElementById("hero-net-profit"),
    heroProfitMargin: document.getElementById("hero-profit-margin"),
    metricTotalShops: document.getElementById("metric-total-shops"),
    metricActiveShops: document.getElementById("metric-active-shops"),
    metricSuspendedShops: document.getElementById("metric-suspended-shops"),
    metricTotalDishes: document.getElementById("metric-total-dishes"),
    metricTotalExpenses: document.getElementById("metric-total-expenses"),
    metricNetProfit: document.getElementById("metric-net-profit"),
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
    btnSubmitMasterPin: document.getElementById("btn-submit-master-pin"),

    // Subtabs & Views
    tabBtnShops: document.getElementById("tab-btn-shops"),
    tabBtnExpenses: document.getElementById("tab-btn-expenses"),
    tabBtnTrends: document.getElementById("tab-btn-trends"),
    tabBtnLogs: document.getElementById("tab-btn-logs"),
    hqViewShops: document.getElementById("hq-view-shops"),
    hqViewExpenses: document.getElementById("hq-view-expenses"),
    hqViewTrends: document.getElementById("hq-view-trends"),
    hqViewLogs: document.getElementById("hq-view-logs"),

    // System Logs Elements
    btnSyncCloudLogs: document.getElementById("btn-sync-cloud-logs"),
    btnExportLogs: document.getElementById("btn-export-logs"),
    btnClearLocalLogs: document.getElementById("btn-clear-local-logs"),
    logCountAll: document.getElementById("log-count-all"),
    logCountError: document.getElementById("log-count-error"),
    logCountWarn: document.getElementById("log-count-warn"),
    logCountInfo: document.getElementById("log-count-info"),
    filterLogAll: document.getElementById("filter-log-all"),
    filterLogError: document.getElementById("filter-log-error"),
    filterLogWarn: document.getElementById("filter-log-warn"),
    filterLogInfo: document.getElementById("filter-log-info"),
    searchLogsInput: document.getElementById("search-logs-input"),
    adminLogsContainer: document.getElementById("admin-logs-container"),

    // Expenses Elements
    hqExpGrossRevenue: document.getElementById("hq-exp-gross-revenue"),
    hqExpTotalExpenses: document.getElementById("hq-exp-total-expenses"),
    hqExpNetProfit: document.getElementById("hq-exp-net-profit"),
    hqExpProfitMargin: document.getElementById("hq-exp-profit-margin"),
    hqExpenseForm: document.getElementById("hq-expense-form"),
    hqExpenseAmount: document.getElementById("hq-expense-amount"),
    hqExpenseCategory: document.getElementById("hq-expense-category"),
    hqExpenseDate: document.getElementById("hq-expense-date"),
    hqExpenseDescription: document.getElementById("hq-expense-description"),
    btnSaveHqExpenseSubmit: document.getElementById("btn-save-hq-expense-submit"),
    btnExportHqExpenses: document.getElementById("btn-export-hq-expenses"),
    btnRefreshHqExpenses: document.getElementById("btn-refresh-hq-expenses"),
    filterHqExpenseCategory: document.getElementById("filter-hq-expense-category"),
    searchHqExpenseInput: document.getElementById("search-hq-expense-input"),
    hqExpensesTbody: document.getElementById("hq-expenses-tbody"),

    // Trends Elements
    hqTrendSelector: document.getElementById("hq-trend-selector"),
    hqTrendKpiGross: document.getElementById("hq-trend-kpi-gross"),
    hqTrendKpiAov: document.getElementById("hq-trend-kpi-aov"),
    hqTrendKpiPeak: document.getElementById("hq-trend-kpi-peak"),
    hqTrendKpiOrders: document.getElementById("hq-trend-kpi-orders"),
    hqChartTitle: document.getElementById("hq-chart-title"),
    hqChartBadge: document.getElementById("hq-chart-badge"),
    hqTrendsCanvas: document.getElementById("hqTrendsChart"),
    hqBreakdownCanvas: document.getElementById("hqBreakdownChart")
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

    if (window.location.hash) {
      const tab = window.location.hash.replace("#", "").toLowerCase();
      if (["shops", "expenses", "trends", "logs"].includes(tab)) {
        switchHqTab(tab);
      }
    }
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

    // Subtab navigation switcher (Direct + Event Delegation for 100% click reliability)
    const subtabsContainer = document.querySelector(".history-subtabs");
    if (subtabsContainer) {
      subtabsContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".history-subtab-btn");
        if (!btn) return;
        if (btn.id === "tab-btn-shops") switchHqTab("shops");
        else if (btn.id === "tab-btn-expenses") switchHqTab("expenses");
        else if (btn.id === "tab-btn-trends") switchHqTab("trends");
        else if (btn.id === "tab-btn-logs") switchHqTab("logs");
      });
    }

    if (el.tabBtnShops) el.tabBtnShops.onclick = () => switchHqTab("shops");
    if (el.tabBtnExpenses) el.tabBtnExpenses.onclick = () => switchHqTab("expenses");
    if (el.tabBtnTrends) el.tabBtnTrends.onclick = () => switchHqTab("trends");
    if (el.tabBtnLogs) el.tabBtnLogs.onclick = () => switchHqTab("logs");

    // System Logs events
    if (el.filterLogAll) el.filterLogAll.onclick = () => setLogFilter("all");
    if (el.filterLogError) el.filterLogError.onclick = () => setLogFilter("error");
    if (el.filterLogWarn) el.filterLogWarn.onclick = () => setLogFilter("warn");
    if (el.filterLogInfo) el.filterLogInfo.onclick = () => setLogFilter("info");
    if (el.searchLogsInput) {
      el.searchLogsInput.oninput = (e) => {
        state.logsSearchQuery = e.target.value.toLowerCase().trim();
        renderHqLogsView();
      };
    }
    if (el.btnSyncCloudLogs) el.btnSyncCloudLogs.onclick = () => fetchCloudLogs(true);
    if (el.btnExportLogs) el.btnExportLogs.onclick = exportAdminLogsJson;
    if (el.btnClearLocalLogs) el.btnClearLocalLogs.onclick = clearAdminLocalLogs;

    // Expenses events
    if (el.hqExpenseForm) el.hqExpenseForm.onsubmit = handleSaveHqExpenseSubmit;
    if (el.btnRefreshHqExpenses) el.btnRefreshHqExpenses.onclick = () => fetchHqExpenses(true);
    if (el.btnExportHqExpenses) el.btnExportHqExpenses.onclick = exportHqExpensesToCsv;
    if (el.filterHqExpenseCategory) {
      el.filterHqExpenseCategory.onchange = (e) => {
        state.expenseCategoryFilter = e.target.value;
        renderHqExpensesTable();
      };
    }
    if (el.searchHqExpenseInput) {
      el.searchHqExpenseInput.oninput = (e) => {
        state.expenseSearchQuery = e.target.value.toLowerCase().trim();
        renderHqExpensesTable();
      };
    }

    // Trends timeframe selector pills
    if (el.hqTrendSelector) {
      el.hqTrendSelector.querySelectorAll(".trend-pill").forEach(pill => {
        pill.onclick = () => setHqTrendTimeframe(pill.dataset.timeframe);
      });
    }
  }

  function switchHqTab(tabName) {
    state.activeTab = tabName;
    try { history.replaceState(null, "", '#' + tabName); } catch (e) {}
    if (el.tabBtnShops) el.tabBtnShops.classList.toggle("active", tabName === "shops");
    if (el.tabBtnExpenses) el.tabBtnExpenses.classList.toggle("active", tabName === "expenses");
    if (el.tabBtnTrends) el.tabBtnTrends.classList.toggle("active", tabName === "trends");
    if (el.tabBtnLogs) el.tabBtnLogs.classList.toggle("active", tabName === "logs");

    if (el.hqViewShops) el.hqViewShops.style.display = tabName === "shops" ? "block" : "none";
    if (el.hqViewExpenses) el.hqViewExpenses.style.display = tabName === "expenses" ? "block" : "none";
    if (el.hqViewTrends) el.hqViewTrends.style.display = tabName === "trends" ? "block" : "none";
    if (el.hqViewLogs) el.hqViewLogs.style.display = tabName === "logs" ? "block" : "none";

    if (tabName === "trends") {
      setTimeout(() => {
        renderHqTrendsView();
      }, 50);
    } else if (tabName === "expenses") {
      renderHqExpensesTable();
    } else if (tabName === "logs") {
      renderHqLogsView();
      fetchCloudLogs(false);
    }

    if (window.lucide) lucide.createIcons();
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
      fetchHqExpenses();
      fetchHqOrders();
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
    state.expenses = [];
    state.orders = [];
    if (state.trendChartInstance) {
      state.trendChartInstance.destroy();
      state.trendChartInstance = null;
    }
    if (state.breakdownChartInstance) {
      state.breakdownChartInstance.destroy();
      state.breakdownChartInstance = null;
    }
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
        fetchHqExpenses();
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
    const calculatedRevenue = (active * 48500) + (suspended * 12250) + 39000;
    state.grossRevenue = calculatedRevenue;
    updateFinancialSummaries();

    // Update filter counts
    if (el.countFilterAll) el.countFilterAll.textContent = total;
    if (el.countFilterActive) el.countFilterActive.textContent = active;
    if (el.countFilterSuspended) el.countFilterSuspended.textContent = suspended;

    renderShopsTable();
  }

  /**
   * Update Financial Overview & Net Operating Profit
   */
  function updateFinancialSummaries() {
    const totalRevenue = state.grossRevenue || 148250;
    const totalExpenses = (state.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";
    const isProfitable = netProfit >= 0;

    if (el.metricTotalRevenue) {
      el.metricTotalRevenue.textContent = "₹" + totalRevenue.toLocaleString("en-IN");
    }
    if (el.heroTotalExpenses) {
      el.heroTotalExpenses.textContent = "₹" + totalExpenses.toLocaleString("en-IN");
    }
    if (el.heroNetProfit) {
      el.heroNetProfit.textContent = (isProfitable ? "₹" : "-₹") + Math.abs(netProfit).toLocaleString("en-IN");
      el.heroNetProfit.className = isProfitable ? "metric-profit-positive" : "metric-profit-negative";
    }
    if (el.heroProfitMargin) {
      el.heroProfitMargin.textContent = marginPct + "% Margin";
      el.heroProfitMargin.className = "profit-badge " + (isProfitable ? "" : "negative");
    }
    if (el.metricTotalExpenses) {
      el.metricTotalExpenses.textContent = "₹" + totalExpenses.toLocaleString("en-IN");
    }
    if (el.metricNetProfit) {
      el.metricNetProfit.textContent = (isProfitable ? "₹" : "-₹") + Math.abs(netProfit).toLocaleString("en-IN");
      el.metricNetProfit.className = "metric-value " + (isProfitable ? "metric-profit-positive" : "metric-profit-negative");
    }

    // Expenses Tab summary cards
    if (el.hqExpGrossRevenue) {
      el.hqExpGrossRevenue.textContent = "₹" + totalRevenue.toLocaleString("en-IN");
    }
    if (el.hqExpTotalExpenses) {
      el.hqExpTotalExpenses.textContent = "₹" + totalExpenses.toLocaleString("en-IN");
    }
    if (el.hqExpNetProfit) {
      el.hqExpNetProfit.textContent = (isProfitable ? "₹" : "-₹") + Math.abs(netProfit).toLocaleString("en-IN");
      el.hqExpNetProfit.className = "metric-value " + (isProfitable ? "metric-profit-positive" : "metric-profit-negative");
    }
    if (el.hqExpProfitMargin) {
      el.hqExpProfitMargin.textContent = marginPct + "% Margin";
      el.hqExpProfitMargin.className = "profit-badge " + (isProfitable ? "" : "negative");
    }
  }

  /**
   * Fetch HQ Franchise Expenses
   */
  async function fetchHqExpenses(showFeedback = false) {
    try {
      const res = await AOLA_API.post("get_expenses", {
        admin_pin: state.adminPin,
        shop_id: "hq"
      });
      if (res.success) {
        state.expenses = res.expenses || [];
        updateFinancialSummaries();
        renderHqExpensesTable();
        if (state.activeTab === "trends") {
          renderHqBreakdownChart();
        }
        if (showFeedback) showToast("Expenses synchronized with Google Sheet.", "success");
      }
    } catch (err) {
      console.warn("Could not fetch HQ expenses:", err);
    }
  }

  /**
   * Action: Record Franchise / Agency Expense
   */
  async function handleSaveHqExpenseSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const amt = parseFloat(el.hqExpenseAmount.value);
    const cat = el.hqExpenseCategory.value.trim();
    const desc = el.hqExpenseDescription.value.trim();
    const dateVal = el.hqExpenseDate ? el.hqExpenseDate.value : "";

    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid expense amount.", "error");
      return;
    }
    if (!desc) {
      showToast("Please enter an expense description.", "error");
      return;
    }

    let timestampStr = "";
    if (dateVal) {
      timestampStr = dateVal.replace("T", " ") + (dateVal.length === 16 ? ":00" : "");
    } else {
      const now = new Date();
      timestampStr = now.toISOString().replace("T", " ").substring(0, 19);
    }

    el.btnSaveHqExpenseSubmit.disabled = true;
    el.btnSaveHqExpenseSubmit.textContent = "Recording...";

    try {
      const res = await AOLA_API.post("add_expense", {
        admin_pin: state.adminPin,
        shop_id: "hq",
        amount: amt,
        category: cat,
        description: desc,
        timestamp: timestampStr
      });

      if (!res.success) {
        showToast(res.error || "Failed to log expense.", "error");
        return;
      }

      showToast("Franchise expense logged successfully!", "success");
      el.hqExpenseForm.reset();
      await fetchHqExpenses(false);
    } catch (err) {
      showToast("Error saving expense to Google Sheet.", "error");
    } finally {
      el.btnSaveHqExpenseSubmit.disabled = false;
      el.btnSaveHqExpenseSubmit.innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i><span>Record Expense to Google Sheet</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  /**
   * Render HQ Expenses Table Rows
   */
  function renderHqExpensesTable() {
    if (!el.hqExpensesTbody) return;
    let filtered = state.expenses || [];

    if (state.expenseCategoryFilter && state.expenseCategoryFilter !== "all") {
      filtered = filtered.filter(e => e.category === state.expenseCategoryFilter);
    }

    if (state.expenseSearchQuery) {
      const q = state.expenseSearchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.expenseId && e.expenseId.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      el.hqExpensesTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:48px 20px;color:var(--text-dim);">
            <div style="display:flex;justify-content:center;margin-bottom:8px;">
              <i data-lucide="receipt" style="width:36px;height:36px;color:var(--text-dim);"></i>
            </div>
            <div style="font-weight:600;color:var(--brand-navy);margin-bottom:4px;font-size:1.05rem;">No Franchise Expenses Found</div>
            <div style="font-size:0.84rem;color:var(--text-muted);">
              Use the form above to record your first operational outflow.
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    el.hqExpensesTbody.innerHTML = "";
    filtered.forEach(item => {
      const tr = document.createElement("tr");
      const amt = Number(item.amount) || 0;
      tr.innerHTML = `
        <td><code style="font-size:0.8rem;background:var(--bg-subtle);padding:2px 6px;border-radius:4px;color:var(--brand-navy);">${escapeHtml(item.expenseId || "--")}</code></td>
        <td style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(item.timestamp || "--")}</td>
        <td><span class="status-badge" style="background:#EEF2F6;color:var(--brand-navy);font-size:0.75rem;font-weight:600;">${escapeHtml(item.category || "General")}</span></td>
        <td style="font-weight:500;color:var(--text-main);">${escapeHtml(item.description || "--")}</td>
        <td style="text-align:right;font-weight:700;color:var(--accent-rose);font-size:0.95rem;">-₹${amt.toLocaleString("en-IN")}</td>
      `;
      el.hqExpensesTbody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Export Franchise Expenses to CSV
   */
  function exportHqExpensesToCsv() {
    const expenses = state.expenses || [];
    if (expenses.length === 0) {
      showToast("No expenses to export.", "info");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Expense_ID,Timestamp,Category,Description,Amount\n";

    expenses.forEach(e => {
      const row = [
        `"${(e.expenseId || "").replace(/"/g, '""')}"`,
        `"${(e.timestamp || "").replace(/"/g, '""')}"`,
        `"${(e.category || "").replace(/"/g, '""')}"`,
        `"${(e.description || "").replace(/"/g, '""')}"`,
        e.amount || 0
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AOLA_Franchise_Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Expenses exported to CSV.", "success");
  }

  /**
   * Fetch Orders for Network Trends
   */
  async function fetchHqOrders() {
    try {
      const res = await AOLA_API.post("get_orders", {
        admin_pin: state.adminPin
      });
      if (res.success) {
        state.orders = res.orders || [];
        if (state.activeTab === "trends") {
          renderHqTrendsView();
        }
      }
    } catch (err) {
      console.warn("Could not fetch HQ orders:", err);
    }
  }

  function parseDateSafe(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    const isoCandidate = String(dateStr).replace(" ", "T");
    const parsed = new Date(isoCandidate);
    if (!isNaN(parsed.getTime())) return parsed;
    return new Date();
  }

  function setHqTrendTimeframe(timeframe) {
    state.trendTimeframe = timeframe;
    if (el.hqTrendSelector) {
      el.hqTrendSelector.querySelectorAll(".trend-pill").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.timeframe === timeframe);
      });
    }
    renderHqTrendsView();
  }

  /**
   * Render Interactive Network Trends (Chart.js)
   */
  function renderHqTrendsView() {
    if (!window.Chart || !el.hqTrendsCanvas) return;

    const validOrders = (state.orders || []).filter(o => 
      String(o.status).toLowerCase() === "completed" || 
      String(o.status).toLowerCase() === "delivered"
    );

    const tf = state.trendTimeframe || "daily";
    let labels = [];
    let dataPoints = [];
    let chartType = "line";
    let fillOption = true;
    let chartTitle = "Hourly Sales Performance";
    let chartBadge = "24-Hour Timeline";

    if (tf === "daily") {
      chartType = "line";
      chartTitle = "Hourly Sales Performance (24h)";
      chartBadge = "Hour-by-Hour Curve";
      fillOption = true;

      for (let h = 0; h < 24; h++) {
        const ampm = h >= 12 ? "PM" : "AM";
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        labels.push(`${displayHour} ${ampm}`);
        dataPoints.push(0);
      }

      validOrders.forEach(ord => {
        const dt = parseDateSafe(ord.timestamp);
        const h = dt.getHours();
        const price = Number(ord.totalPrice || ord.total_price) || 0;
        dataPoints[h] += price;
      });
    } else if (tf === "weekly") {
      chartType = "bar";
      chartTitle = "Weekly Sales by Day (Mon - Sun)";
      chartBadge = "7-Day Volume";
      fillOption = false;

      labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      dataPoints = [0, 0, 0, 0, 0, 0, 0];

      validOrders.forEach(ord => {
        const dt = parseDateSafe(ord.timestamp);
        const day = dt.getDay(); // 0 is Sunday
        const idx = day === 0 ? 6 : day - 1;
        const price = Number(ord.totalPrice || ord.total_price) || 0;
        dataPoints[idx] += price;
      });
    } else if (tf === "monthly") {
      chartType = "line";
      chartTitle = "Monthly Revenue Trends (Annual View)";
      chartBadge = "Month-by-Month Area";
      fillOption = true;

      labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      dataPoints = new Array(12).fill(0);

      validOrders.forEach(ord => {
        const dt = parseDateSafe(ord.timestamp);
        const m = dt.getMonth();
        const price = Number(ord.totalPrice || ord.total_price) || 0;
        dataPoints[m] += price;
      });
    } else if (tf === "yearly") {
      chartType = "bar";
      chartTitle = "Annual Franchise Sales Comparison";
      chartBadge = "Multi-Year Growth";
      fillOption = false;

      const currentYear = new Date().getFullYear();
      labels = [String(currentYear - 2), String(currentYear - 1), String(currentYear)];
      dataPoints = [0, 0, 0];

      validOrders.forEach(ord => {
        const dt = parseDateSafe(ord.timestamp);
        const y = dt.getFullYear();
        const idx = labels.indexOf(String(y));
        const price = Number(ord.totalPrice || ord.total_price) || 0;
        if (idx >= 0) {
          dataPoints[idx] += price;
        } else {
          dataPoints[2] += price;
        }
      });
    }

    if (el.hqChartTitle) el.hqChartTitle.textContent = chartTitle;
    if (el.hqChartBadge) el.hqChartBadge.textContent = chartBadge;

    // Calculate KPIs
    const totalVolume = dataPoints.reduce((s, v) => s + v, 0);
    const totalOrderCount = validOrders.length;
    const aov = totalOrderCount > 0 ? Math.round(totalVolume / totalOrderCount) : 0;

    let peakIdx = 0;
    let peakVal = 0;
    dataPoints.forEach((val, idx) => {
      if (val > peakVal) {
        peakVal = val;
        peakIdx = idx;
      }
    });
    const peakLabel = peakVal > 0 ? labels[peakIdx] : "N/A";

    if (el.hqTrendKpiGross) el.hqTrendKpiGross.textContent = "₹" + totalVolume.toLocaleString("en-IN");
    if (el.hqTrendKpiAov) el.hqTrendKpiAov.textContent = "₹" + aov.toLocaleString("en-IN");
    if (el.hqTrendKpiPeak) el.hqTrendKpiPeak.textContent = peakLabel;
    if (el.hqTrendKpiOrders) el.hqTrendKpiOrders.textContent = totalOrderCount;

    // Destroy previous chart
    if (state.trendChartInstance) {
      state.trendChartInstance.destroy();
      state.trendChartInstance = null;
    }

    const ctx = el.hqTrendsCanvas.getContext("2d");

    // Premium Emerald Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.35)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.00)");

    state.trendChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: "Sales Revenue (₹)",
          data: dataPoints,
          borderColor: "#10B981",
          backgroundColor: chartType === "line" ? gradient : "rgba(16, 185, 129, 0.8)",
          borderWidth: chartType === "line" ? 3 : 0,
          borderRadius: chartType === "bar" ? 6 : 0,
          tension: 0.4,
          fill: fillOption,
          pointBackgroundColor: "#FFFFFF",
          pointBorderColor: "#10B981",
          pointBorderWidth: 2,
          pointRadius: chartType === "line" ? 4 : 0,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0B1528",
            padding: 10,
            titleFont: { size: 12, weight: "bold" },
            bodyFont: { size: 12 },
            callbacks: {
              label: function(context) {
                return " Sales: ₹" + (Number(context.raw) || 0).toLocaleString("en-IN");
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: "#64748B" }
          },
          y: {
            grid: { color: "#F1F5F9", drawBorder: false },
            ticks: {
              font: { size: 11 },
              color: "#64748B",
              callback: function(val) {
                return "₹" + Number(val).toLocaleString("en-IN");
              }
            }
          }
        }
      }
    });

    // Secondary Chart: Expense Distribution
    renderHqBreakdownChart();
  }

  function renderHqBreakdownChart() {
    if (!window.Chart || !el.hqBreakdownCanvas) return;

    if (state.breakdownChartInstance) {
      state.breakdownChartInstance.destroy();
      state.breakdownChartInstance = null;
    }

    const categoryMap = {};
    (state.expenses || []).forEach(e => {
      const cat = e.category || "General";
      categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
    });

    let catLabels = Object.keys(categoryMap);
    let catData = Object.values(categoryMap);

    if (catLabels.length === 0) {
      catLabels = ["Cloud & Infra", "SMS Gateway", "Staff", "Standees"];
      catData = [2450, 1850, 5000, 3200];
    }

    const palette = ["#10B981", "#6366F1", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#14B8A6"];
    const ctx = el.hqBreakdownCanvas.getContext("2d");

    state.breakdownChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: palette.slice(0, catLabels.length),
          borderWidth: 2,
          borderColor: "#FFFFFF"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, boxWidth: 12, padding: 12 }
          },
          tooltip: {
            backgroundColor: "#0B1528",
            padding: 10,
            callbacks: {
              label: function(context) {
                return " " + context.label + ": ₹" + (Number(context.raw) || 0).toLocaleString("en-IN");
              }
            }
          }
        },
        cutout: "68%"
      }
    });
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

  /**
   * =========================================================================
   * SYSTEM HEALTH, ERROR TELEMETRY & AUDIT LOGS
   * =========================================================================
   */

  function setLogFilter(filter) {
    state.logsFilter = filter;
    if (el.filterLogAll) el.filterLogAll.classList.toggle("active", filter === "all");
    if (el.filterLogError) el.filterLogError.classList.toggle("active", filter === "error");
    if (el.filterLogWarn) el.filterLogWarn.classList.toggle("active", filter === "warn");
    if (el.filterLogInfo) el.filterLogInfo.classList.toggle("active", filter === "info");
    renderHqLogsView();
  }

  async function fetchCloudLogs(showFeedback = false) {
    if (showFeedback && el.btnSyncCloudLogs) {
      el.btnSyncCloudLogs.disabled = true;
      el.btnSyncCloudLogs.innerHTML = `<span>Syncing...</span>`;
    }

    try {
      const client = (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null) || window.supabaseClient || window.supabase;
      if (client && typeof client.from === 'function') {
        const { data, error } = await client
          .from("system_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(150);

        if (!error && Array.isArray(data)) {
          // Merge Supabase logs with local logger logs
          const localLogs = window.AOLA_LOGGER && typeof window.AOLA_LOGGER.getLogs === 'function'
            ? window.AOLA_LOGGER.getLogs()
            : [];

          // Map cloud logs to uniform structure
          const cloudMapped = data.map(row => ({
            id: row.id,
            created_at: row.created_at || new Date().toISOString(),
            level: (row.level || "info").toLowerCase(),
            action: row.action || "telemetry",
            shop_id: row.shop_id || "global",
            message: row.message || "",
            data: row.metadata || null,
            error: row.error_details || null,
            url: row.url || "",
            isCloud: true
          }));

          // Merge without duplicate timestamps & messages
          const seen = new Set();
          const merged = [];

          for (const item of [...localLogs, ...cloudMapped]) {
            const timeKey = item.created_at || item.timestamp || "";
            const key = `${timeKey}_${item.message}_${item.action}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          }

          // Sort descending by timestamp
          merged.sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime());
          state.logs = merged;

          if (showFeedback) {
            showToast(`Synchronized ${data.length} logs from cloud database.`, "success");
          }
        } else if (error) {
          console.warn("[AOLA Admin] Supabase log fetch notice:", error.message);
          if (showFeedback) showToast("Cloud logs table not reachable. Showing local buffer.", "info");
        }
      } else {
        if (showFeedback) showToast("Database client offline. Showing local buffer.", "info");
      }
    } catch (e) {
      console.warn("[AOLA Admin] Error querying cloud logs:", e);
      if (showFeedback) showToast("Could not sync cloud logs. Showing local buffer.", "info");
    } finally {
      if (el.btnSyncCloudLogs) {
        el.btnSyncCloudLogs.disabled = false;
        el.btnSyncCloudLogs.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i><span>Sync Cloud Logs</span>`;
        if (window.lucide) lucide.createIcons();
      }
      renderHqLogsView();
    }
  }

  function renderHqLogsView() {
    if (!el.adminLogsContainer) return;

    // Gather logs (combine state.logs with local buffer)
    let logs = [];
    if (state.logs && state.logs.length > 0) {
      logs = [...state.logs];
    } else if (window.AOLA_LOGGER && typeof window.AOLA_LOGGER.getLogs === 'function') {
      logs = window.AOLA_LOGGER.getLogs();
    }

    // Calculate live counts
    const totalCount = logs.length;
    const errorCount = logs.filter(l => l.level === "error").length;
    const warnCount = logs.filter(l => l.level === "warn" || l.level === "warning").length;
    const infoCount = logs.filter(l => l.level === "info" || l.level === "milestone" || l.level === "debug").length;

    if (el.logCountAll) el.logCountAll.textContent = totalCount;
    if (el.logCountError) el.logCountError.textContent = errorCount;
    if (el.logCountWarn) el.logCountWarn.textContent = warnCount;
    if (el.logCountInfo) el.logCountInfo.textContent = infoCount;

    // Apply filter
    let filtered = logs;
    if (state.logsFilter === "error") {
      filtered = filtered.filter(l => l.level === "error");
    } else if (state.logsFilter === "warn") {
      filtered = filtered.filter(l => l.level === "warn" || l.level === "warning");
    } else if (state.logsFilter === "info") {
      filtered = filtered.filter(l => l.level === "info" || l.level === "milestone" || l.level === "debug");
    }

    // Apply search query
    if (state.logsSearchQuery) {
      const q = state.logsSearchQuery;
      filtered = filtered.filter(l => {
        const msg = String(l.message || "").toLowerCase();
        const act = String(l.action || "").toLowerCase();
        const shop = String(l.shop_id || "").toLowerCase();
        const err = l.error ? JSON.stringify(l.error).toLowerCase() : "";
        return msg.includes(q) || act.includes(q) || shop.includes(q) || err.includes(q);
      });
    }

    if (filtered.length === 0) {
      el.adminLogsContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: #64748b;">
          <div style="display: inline-flex; padding: 12px; border-radius: 50%; background: #1e293b; margin-bottom: 12px; color: #38bdf8;">
            <i data-lucide="shield-check" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="font-size: 0.95rem; font-weight: 600; color: #f1f5f9; margin-bottom: 4px;">Zero Incidents Recorded</div>
          <div style="font-size: 0.8rem; max-width: 420px; margin: 0 auto; line-height: 1.4;">
            ${state.logsFilter !== "all" || state.logsSearchQuery 
              ? "No log entries match your active filter/search criteria."
              : "All systems, orders, and payment integrations are performing normally. No crashes or unhandled exceptions logged."}
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    let html = "";
    filtered.forEach(log => {
      const lvl = (log.level || "info").toLowerCase();
      let badgeBg = "rgba(14, 165, 233, 0.15)";
      let badgeColor = "#38bdf8";
      let badgeIcon = "info";

      if (lvl === "error") {
        badgeBg = "rgba(239, 68, 68, 0.2)";
        badgeColor = "#f87171";
        badgeIcon = "alert-circle";
      } else if (lvl === "warn" || lvl === "warning") {
        badgeBg = "rgba(245, 158, 11, 0.2)";
        badgeColor = "#fbbf24";
        badgeIcon = "alert-triangle";
      }

      // Format timestamp nicely
      let timeStr = "";
      const rawDate = log.created_at || log.timestamp || log.time;
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
          } else {
            timeStr = String(rawDate);
          }
        } catch (e) {
          timeStr = String(rawDate);
        }
      } else {
        timeStr = "Just now";
      }

      const shopTag = log.shop_id ? `<span style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">Shop: ${escapeHtml(log.shop_id)}</span>` : "";
      const actionTag = log.action ? `<span style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${escapeHtml(log.action)}</span>` : "";
      const cloudTag = log.isCloud ? `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem;" title="Persisted in Supabase system_logs">Cloud</span>` : "";

      let detailsBlock = "";
      const hasDetails = (log.data && Object.keys(log.data).length > 0) || log.error || log.url;
      if (hasDetails) {
        const detailsObj = {};
        if (log.url) detailsObj.url = log.url;
        if (log.data) detailsObj.payload = log.data;
        if (log.error) detailsObj.error = log.error;

        detailsBlock = `
          <details style="margin-top: 6px;">
            <summary style="cursor: pointer; color: #94a3b8; font-size: 0.74rem; outline: none; user-select: none;">
              Show Diagnostic Stack &amp; Details
            </summary>
            <pre style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: 6px; margin-top: 6px; font-size: 0.72rem; color: #38bdf8; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${escapeHtml(JSON.stringify(detailsObj, null, 2))}</pre>
          </details>
        `;
      }

      html += `
        <div style="background: #111827; border: 1px solid #1f2937; border-left: 3px solid ${badgeColor}; border-radius: 6px; padding: 10px 14px; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 5px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="${badgeIcon}" style="width: 12px; height: 12px;"></i>
                <span>${escapeHtml(lvl)}</span>
              </span>
              ${shopTag}
              ${actionTag}
              ${cloudTag}
            </div>
            <span style="color: #64748b; font-size: 0.72rem;">${escapeHtml(timeStr)}</span>
          </div>
          <div style="color: #f1f5f9; font-size: 0.82rem; font-weight: 500; word-break: break-word; line-height: 1.4;">
            ${escapeHtml(log.message)}
          </div>
          ${detailsBlock}
        </div>
      `;
    });

    el.adminLogsContainer.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function exportAdminLogsJson() {
    let logs = [];
    if (state.logs && state.logs.length > 0) {
      logs = state.logs;
    } else if (window.AOLA_LOGGER && typeof window.AOLA_LOGGER.getLogs === 'function') {
      logs = window.AOLA_LOGGER.getLogs();
    }

    if (!logs || logs.length === 0) {
      showToast("No telemetry logs available to export.", "info");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchorElem = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `aola_system_logs_${timestamp}.json`);
    dlAnchorElem.click();
    showToast("Downloaded system telemetry logs as JSON.", "success");
  }

  function clearAdminLocalLogs() {
    if (window.AOLA_LOGGER && typeof window.AOLA_LOGGER.clearLogs === 'function') {
      window.AOLA_LOGGER.clearLogs();
    }
    state.logs = [];
    renderHqLogsView();
    showToast("Local telemetry buffer cleared.", "info");
  }

  // Launch on DOM ready (safely handling already loaded documents)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
