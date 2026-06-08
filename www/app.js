const STORAGE_KEY = "personal-ledger-v1";
const TREND_MODE_KEY = "personal-ledger-trend-mode";

const expenseCategories = ["餐饮", "交通", "购物", "学习", "娱乐", "房租", "人情", "医疗", "日用品", "其他"];
const incomeCategories = ["工资/生活费", "兼职", "报销", "退款", "理财", "其他"];
const defaultAccounts = ["微信", "支付宝", "银行卡", "校园卡"];
const largeExpenseLimit = 100;
const categoryPalette = ["#2f6f53", "#d59b31", "#315b7b", "#a94731", "#6d5b3f", "#4c7f74", "#b96f3c", "#7b6fa8", "#8a8f46", "#c75d67"];

const state = loadState();
let currentView = "home";
let entryType = "expense";
let dailyTrendMode = localStorage.getItem(TREND_MODE_KEY) || "amount";

const $ = (id) => document.getElementById(id);

const els = {
  todayLabel: $("todayLabel"),
  todayExpense: $("todayExpense"),
  budgetLeft: $("budgetLeft"),
  totalBalance: $("totalBalance"),
  recentList: $("recentList"),
  entryForm: $("entryForm"),
  editingId: $("editingId"),
  amountInput: $("amountInput"),
  accountSelect: $("accountSelect"),
  fromAccountSelect: $("fromAccountSelect"),
  toAccountSelect: $("toAccountSelect"),
  categorySelect: $("categorySelect"),
  dateInput: $("dateInput"),
  specialInput: $("specialInput"),
  noteInput: $("noteInput"),
  singleAccountFields: $("singleAccountFields"),
  transferFields: $("transferFields"),
  categoryField: $("categoryField"),
  specialField: $("specialField"),
  saveEntryBtn: $("saveEntryBtn"),
  recordsList: $("recordsList"),
  filterMonth: $("filterMonth"),
  filterAccount: $("filterAccount"),
  filterType: $("filterType"),
  filterCategory: $("filterCategory"),
  filterSpecial: $("filterSpecial"),
  monthExpense: $("monthExpense"),
  monthBudget: $("monthBudget"),
  specialTotal: $("specialTotal"),
  largeCount: $("largeCount"),
  categoryStats: $("categoryStats"),
  dailyTrend: $("dailyTrend"),
  accountBalances: $("accountBalances"),
  largeExpenseList: $("largeExpenseList"),
  specialList: $("specialList"),
  budgetInput: $("budgetInput"),
  accountSettings: $("accountSettings"),
  setupDialog: $("setupDialog"),
  setupForm: $("setupForm"),
  setupAccounts: $("setupAccounts"),
  setupBudget: $("setupBudget"),
  toast: $("toast"),
  importInput: $("importInput")
};

init();

function init() {
  els.todayLabel.textContent = formatHumanDate(new Date());
  els.dateInput.value = today();
  els.filterMonth.value = monthKey(new Date());
  bindEvents();
  ensureCurrentBudget();
  renderAll();

  if (!state.hasSetup) {
    renderSetup();
    if (typeof els.setupDialog.showModal === "function") {
      els.setupDialog.showModal();
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function bindEvents() {
  document.querySelectorAll("[data-nav-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.navTarget));
  });

  document.querySelectorAll("[data-new-type]").forEach((button) => {
    button.addEventListener("click", () => {
      startNewEntry(button.dataset.newType);
      showView("entry");
    });
  });

  $("quickExpenseBtn").addEventListener("click", () => {
    startNewEntry("expense");
    showView("entry");
  });

  document.querySelectorAll("[data-entry-type]").forEach((button) => {
    button.addEventListener("click", () => setEntryType(button.dataset.entryType));
  });

  document.querySelectorAll("[data-trend-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      dailyTrendMode = button.dataset.trendMode;
      localStorage.setItem(TREND_MODE_KEY, dailyTrendMode);
      renderStats();
    });
  });

  $("clearEntryBtn").addEventListener("click", () => startNewEntry(entryType));
  els.entryForm.addEventListener("submit", saveEntry);
  $("resetFiltersBtn").addEventListener("click", resetFilters);
  $("saveBudgetBtn").addEventListener("click", saveBudget);
  $("addAccountBtn").addEventListener("click", addAccount);
  $("exportBtn").addEventListener("click", exportCsvFiles);
  els.importInput.addEventListener("change", importCsvFiles);
  els.setupForm.addEventListener("submit", finishSetup);

  [els.filterMonth, els.filterAccount, els.filterType, els.filterCategory, els.filterSpecial].forEach((el) => {
    el.addEventListener("change", renderRecords);
  });
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return normalizeState({
    hasSetup: false,
    accounts: defaultAccounts.map((name, index) => ({
      id: cryptoId(),
      name,
      initialBalance: 0,
      isActive: true,
      sortOrder: index,
      createdAt: nowIso(),
      updatedAt: nowIso()
    })),
    transactions: [],
    budgets: []
  });
}

function normalizeState(raw) {
  return {
    hasSetup: Boolean(raw.hasSetup),
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    budgets: Array.isArray(raw.budgets) ? raw.budgets : []
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  populateSelectors();
  renderHome();
  renderRecords();
  renderStats();
  renderSettings();
}

function showView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.navTarget === view);
  });
  renderAll();
}

function setEntryType(type) {
  entryType = type;
  document.querySelectorAll("[data-entry-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.entryType === type);
  });

  const isTransfer = type === "transfer";
  els.singleAccountFields.classList.toggle("hidden", isTransfer);
  els.transferFields.classList.toggle("hidden", !isTransfer);
  els.categoryField.classList.toggle("hidden", isTransfer);
  els.specialField.classList.toggle("hidden", type !== "expense");
  els.saveEntryBtn.textContent = els.editingId.value ? "保存修改" : "保存";
  populateCategorySelect(type);
}

function startNewEntry(type = "expense") {
  els.entryForm.reset();
  els.editingId.value = "";
  els.dateInput.value = today();
  setEntryType(type);
  populateSelectors();
}

function saveEntry(event) {
  event.preventDefault();
  const amount = Number(els.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("请输入有效金额");
    return;
  }

  const editingId = els.editingId.value;
  const timestamp = nowIso();
  const base = {
    id: editingId || cryptoId(),
    type: entryType,
    amount: roundMoney(amount),
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    category: "",
    note: els.noteInput.value.trim(),
    isSpecial: false,
    transactionDate: els.dateInput.value || today(),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (entryType === "transfer") {
    base.fromAccountId = els.fromAccountSelect.value;
    base.toAccountId = els.toAccountSelect.value;
    if (!base.fromAccountId || !base.toAccountId || base.fromAccountId === base.toAccountId) {
      showToast("请选择不同的转出和转入账户");
      return;
    }
  } else {
    base.accountId = els.accountSelect.value;
    base.category = els.categorySelect.value;
    base.isSpecial = entryType === "expense" && els.specialInput.checked;
    if (!base.accountId || !base.category) {
      showToast("请选择账户和分类");
      return;
    }
  }

  if (editingId) {
    const index = state.transactions.findIndex((item) => item.id === editingId);
    if (index >= 0) {
      base.createdAt = state.transactions[index].createdAt;
      state.transactions[index] = base;
    }
  } else {
    state.transactions.push(base);
  }

  persist();
  startNewEntry(entryType);
  renderAll();
  showToast(editingId ? "已保存修改" : "已记账");
  showView("home");
}

function editTransaction(id) {
  const item = state.transactions.find((tx) => tx.id === id);
  if (!item) return;

  setEntryType(item.type);
  els.editingId.value = item.id;
  els.amountInput.value = item.amount;
  els.dateInput.value = item.transactionDate;
  els.noteInput.value = item.note || "";
  els.specialInput.checked = Boolean(item.isSpecial);

  populateSelectors();
  if (item.type === "transfer") {
    els.fromAccountSelect.value = item.fromAccountId || "";
    els.toAccountSelect.value = item.toAccountId || "";
  } else {
    els.accountSelect.value = item.accountId || "";
    populateCategorySelect(item.type);
    els.categorySelect.value = item.category || "";
  }

  showView("entry");
}

function deleteTransaction(id) {
  const item = state.transactions.find((tx) => tx.id === id);
  if (!item) return;
  const label = describeTransaction(item);
  if (!confirm(`删除这条流水？\n${label}`)) return;
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  persist();
  renderAll();
  showToast("已删除");
}

function populateSelectors() {
  const activeAccounts = getActiveAccounts();
  const allAccountOptions = [{ value: "", label: "全部账户" }].concat(
    state.accounts.map((account) => ({ value: account.id, label: account.name }))
  );

  fillSelect(els.accountSelect, activeAccounts.map((account) => ({ value: account.id, label: account.name })));
  fillSelect(els.fromAccountSelect, activeAccounts.map((account) => ({ value: account.id, label: account.name })));
  fillSelect(els.toAccountSelect, activeAccounts.map((account) => ({ value: account.id, label: account.name })));
  fillSelect(els.filterAccount, allAccountOptions);
  populateCategorySelect(entryType);
  populateFilterCategories();
}

function populateCategorySelect(type) {
  if (type === "transfer") return;
  const categories = type === "income" ? incomeCategories : expenseCategories;
  fillSelect(els.categorySelect, categories.map((name) => ({ value: name, label: name })));
}

function populateFilterCategories() {
  const categories = ["全部分类"].concat(expenseCategories, incomeCategories);
  const current = els.filterCategory.value;
  fillSelect(
    els.filterCategory,
    categories.map((name, index) => ({ value: index === 0 ? "" : name, label: name }))
  );
  els.filterCategory.value = current;
}

function fillSelect(select, options) {
  const previous = select.value;
  select.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  if (options.some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function renderHome() {
  const todayTotal = sum(
    state.transactions.filter((tx) => tx.type === "expense" && tx.transactionDate === today()),
    "amount"
  );
  const budget = getBudget(currentMonth());
  const monthExpenseValue = getMonthExpense(currentMonth());
  els.todayExpense.textContent = money(todayTotal);
  els.budgetLeft.textContent = money(budget - monthExpenseValue);
  els.totalBalance.textContent = money(getTotalBalance());

  const recent = sortTransactions(state.transactions).slice(0, 5);
  renderTransactionList(els.recentList, recent, { compact: true });
}

function renderRecords() {
  const filtered = sortTransactions(state.transactions).filter((tx) => {
    if (els.filterMonth.value && monthKey(tx.transactionDate) !== els.filterMonth.value) return false;
    if (els.filterType.value && tx.type !== els.filterType.value) return false;
    if (els.filterCategory.value && tx.category !== els.filterCategory.value) return false;
    if (els.filterSpecial.value && String(Boolean(tx.isSpecial)) !== els.filterSpecial.value) return false;
    if (els.filterAccount.value && !transactionUsesAccount(tx, els.filterAccount.value)) return false;
    return true;
  });

  renderTransactionList(els.recordsList, filtered);
}

function renderStats() {
  const month = els.filterMonth.value || currentMonth();
  const monthExpenses = state.transactions.filter((tx) => tx.type === "expense" && monthKey(tx.transactionDate) === month);
  const total = sum(monthExpenses, "amount");
  const budget = getBudget(month);
  const special = monthExpenses.filter((tx) => tx.isSpecial);
  const large = monthExpenses.filter((tx) => tx.amount >= largeExpenseLimit);

  els.monthExpense.textContent = money(total);
  els.monthBudget.textContent = money(budget);
  els.specialTotal.textContent = money(sum(special, "amount"));
  els.largeCount.textContent = String(large.length);
  document.querySelectorAll("[data-trend-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.trendMode === dailyTrendMode);
  });

  renderCategoryStats(monthExpenses);
  renderDailyTrend(monthExpenses, month);
  renderAccountBalances();
  renderTransactionList(els.largeExpenseList, sortTransactions(large), { compact: true, emptyText: "暂无大额支出" });
  renderTransactionList(els.specialList, sortTransactions(special), { compact: true, emptyText: "暂无特殊账单" });
}

function renderCategoryStats(expenses) {
  const total = sum(expenses, "amount");
  if (!expenses.length) {
    els.categoryStats.innerHTML = `<div class="empty">本月还没有支出</div>`;
    return;
  }

  const groups = groupBySum(expenses, (tx) => tx.category || "其他");
  const entries = Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount], index) => ({
      category,
      amount,
      percent: total ? (amount / total) * 100 : 0,
      color: categoryPalette[index % categoryPalette.length]
    }));

  let angle = 0;
  const pieStops = entries.map((entry) => {
    const start = angle;
    const end = angle + (entry.percent / 100) * 360;
    angle = end;
    return `${entry.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });

  const lineSegments = entries.map((entry) => `
    <div
      class="stack-segment"
      style="flex-basis:${entry.percent.toFixed(4)}%; background:${entry.color}"
      title="${escapeHtml(entry.category)} ${money(entry.amount)} / ${Math.round(entry.percent)}%"
    ></div>
  `).join("");

  const legend = entries.map((entry) => `
    <div class="category-row">
      <span class="category-dot" style="background:${entry.color}"></span>
      <span>${escapeHtml(entry.category)}</span>
      <b>${money(entry.amount)}</b>
      <em>${Math.round(entry.percent)}%</em>
    </div>
  `).join("");

  els.categoryStats.innerHTML = `
    <div class="category-visual">
      <div class="pie-chart" style="background:conic-gradient(${pieStops.join(", ")})">
        <span>${money(total)}</span>
      </div>
      <div class="category-copy">
        <strong>本月分类构成</strong>
        <span>按支出金额占比统计</span>
      </div>
    </div>
    <div class="stack-track" aria-label="分类占比线段">${lineSegments}</div>
    <div class="category-legend">${legend}</div>
  `;
}

function renderDailyTrend(expenses, month) {
  const days = daysInMonth(month);
  const dailyTotals = groupBySum(expenses, (tx) => tx.transactionDate.slice(-2));
  const max = Math.max(1, ...Object.values(dailyTotals));
  const axisMax = Math.ceil(max / niceAxisStep(max)) * niceAxisStep(max);
  const axisLabels = [axisMax, axisMax / 2, 0];
  const bars = [];

  for (let day = 1; day <= days; day += 1) {
    const key = String(day).padStart(2, "0");
    const amount = dailyTotals[key] || 0;
    const height = Math.max(2, Math.round((amount / axisMax) * 112));
    const dayExpenses = expenses.filter((tx) => tx.transactionDate.slice(-2) === key);
    const segments = buildDailySegments(dayExpenses, amount);
    const showComposition = dailyTrendMode === "composition" && amount > 0;
    const amountLabel = amount > 0 ? `<b>${compactMoney(amount)}</b>` : `<b class="muted-zero">0</b>`;
    const fill = showComposition
      ? `<i class="trend-stack" style="height:${height}px">${segments}</i>`
      : `<i style="height:${height}px"></i>`;

    bars.push(`
      <div class="trend-bar" title="${key}日 ${money(amount)}">
        ${amountLabel}
        <div class="trend-column">
          ${fill}
        </div>
        <span>${day}</span>
      </div>
    `);
  }

  els.dailyTrend.innerHTML = `
    <div class="trend-axis" aria-hidden="true">
      ${axisLabels.map((value) => `<span>${compactMoney(value)}</span>`).join("")}
    </div>
    <div class="trend-scroll">
      <div class="trend-grid-lines" aria-hidden="true"></div>
      <div class="trend-chart">${bars.join("")}</div>
    </div>
  `;
}

function buildDailySegments(dayExpenses, total) {
  if (!dayExpenses.length || total <= 0) return "";
  const groups = groupBySum(dayExpenses, (tx) => tx.category || "其他");
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const percent = total ? (amount / total) * 100 : 0;
      return `
        <span
          class="trend-segment"
          style="height:${percent.toFixed(4)}%; background:${getCategoryColor(category)}"
          title="${escapeHtml(category)} ${money(amount)} / ${Math.round(percent)}%"
        ></span>
      `;
    })
    .join("");
}

function getCategoryColor(category) {
  const index = expenseCategories.indexOf(category);
  if (index >= 0) return categoryPalette[index % categoryPalette.length];
  return categoryPalette[categoryPalette.length - 1];
}

function renderAccountBalances() {
  const balances = getAccountBalances();
  els.accountBalances.innerHTML = state.accounts
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((account) => `
      <div class="balance-row">
        <div>
          <strong>${escapeHtml(account.name)}</strong>
          <div class="record-meta">${account.isActive ? "启用中" : "已停用，仍计入总余额"}</div>
        </div>
        <strong>${money(balances[account.id] || 0)}</strong>
      </div>
    `)
    .join("");
}

function renderSettings() {
  els.budgetInput.value = getBudget(currentMonth());
  els.accountSettings.innerHTML = state.accounts
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((account) => `
      <div class="account-row" data-account-id="${escapeHtml(account.id)}">
        <input type="text" value="${escapeHtml(account.name)}" aria-label="账户名称">
        <input type="number" inputmode="decimal" step="0.01" value="${account.initialBalance}" aria-label="初始余额">
        <input type="checkbox" ${account.isActive ? "checked" : ""} aria-label="是否启用">
      </div>
    `)
    .join("");

  els.accountSettings.querySelectorAll(".account-row").forEach((row) => {
    const account = state.accounts.find((item) => item.id === row.dataset.accountId);
    const [nameInput, balanceInput, activeInput] = row.querySelectorAll("input");
    nameInput.addEventListener("change", () => updateAccount(account.id, { name: nameInput.value.trim() || account.name }));
    balanceInput.addEventListener("change", () => updateAccount(account.id, { initialBalance: roundMoney(Number(balanceInput.value) || 0) }));
    activeInput.addEventListener("change", () => updateAccount(account.id, { isActive: activeInput.checked }));
  });
}

function renderSetup() {
  els.setupAccounts.innerHTML = state.accounts
    .map((account) => `
      <div class="setup-row" data-account-id="${escapeHtml(account.id)}">
        <strong>${escapeHtml(account.name)}</strong>
        <input type="number" inputmode="decimal" step="0.01" value="${account.initialBalance}" aria-label="${escapeHtml(account.name)}初始余额">
      </div>
    `)
    .join("");
  els.setupBudget.value = getBudget(currentMonth()) || "";
}

function finishSetup(event) {
  event.preventDefault();
  els.setupAccounts.querySelectorAll(".setup-row").forEach((row) => {
    const account = state.accounts.find((item) => item.id === row.dataset.accountId);
    const input = row.querySelector("input");
    account.initialBalance = roundMoney(Number(input.value) || 0);
    account.updatedAt = nowIso();
  });
  setBudget(currentMonth(), Number(els.setupBudget.value) || 0);
  state.hasSetup = true;
  persist();
  els.setupDialog.close();
  renderAll();
  showToast("初始化完成");
}

function renderTransactionList(host, transactions, options = {}) {
  const emptyText = options.emptyText || "暂无流水";
  if (!transactions.length) {
    host.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }

  host.innerHTML = transactions
    .map((tx) => {
      const typeClass = tx.type === "expense" ? "negative" : tx.type === "income" ? "positive" : "neutral";
      const signed = tx.type === "expense" ? "-" : tx.type === "income" ? "+" : "";
      const amount = `${signed}${money(tx.amount)}`;
      const meta = describeTransaction(tx);
      const note = tx.note ? `<div class="record-note">${escapeHtml(tx.note)}</div>` : "";
      const special = tx.isSpecial ? " · 特殊账单" : "";
      return `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(tx.category || "转账")}${special}</strong>
            <div class="record-meta">${escapeHtml(meta)}</div>
          </div>
          <strong class="${typeClass}">${amount}</strong>
          ${note}
          <div class="record-actions">
            <button class="mini-button" type="button" data-edit-id="${escapeHtml(tx.id)}">编辑</button>
            <button class="mini-button danger" type="button" data-delete-id="${escapeHtml(tx.id)}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");

  host.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => editTransaction(button.dataset.editId));
  });
  host.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.deleteId));
  });
}

function describeTransaction(tx) {
  if (tx.type === "transfer") {
    return `${tx.transactionDate} · ${accountName(tx.fromAccountId)} -> ${accountName(tx.toAccountId)}`;
  }
  const typeLabel = tx.type === "expense" ? "支出" : "收入";
  return `${tx.transactionDate} · ${typeLabel} · ${accountName(tx.accountId)}`;
}

function resetFilters() {
  els.filterMonth.value = currentMonth();
  els.filterAccount.value = "";
  els.filterType.value = "";
  els.filterCategory.value = "";
  els.filterSpecial.value = "";
  renderRecords();
}

function saveBudget() {
  setBudget(currentMonth(), Number(els.budgetInput.value) || 0);
  persist();
  renderAll();
  showToast("预算已保存");
}

function addAccount() {
  const name = prompt("账户名称");
  if (!name || !name.trim()) return;
  state.accounts.push({
    id: cryptoId(),
    name: name.trim(),
    initialBalance: 0,
    isActive: true,
    sortOrder: state.accounts.length,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  persist();
  renderAll();
  showToast("账户已新增");
}

function updateAccount(id, patch) {
  const account = state.accounts.find((item) => item.id === id);
  if (!account) return;
  Object.assign(account, patch, { updatedAt: nowIso() });
  persist();
  renderAll();
  showToast("账户已更新");
}

function ensureCurrentBudget() {
  const month = currentMonth();
  if (state.budgets.some((item) => item.month === month)) return;
  const previous = state.budgets
    .filter((item) => item.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  setBudget(month, previous ? previous.amount : 0, false);
  persist();
}

function setBudget(month, amount, shouldPersist = true) {
  const existing = state.budgets.find((item) => item.month === month);
  if (existing) {
    existing.amount = roundMoney(amount);
    existing.updatedAt = nowIso();
  } else {
    state.budgets.push({
      id: cryptoId(),
      month,
      amount: roundMoney(amount),
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
  if (shouldPersist) persist();
}

function getBudget(month) {
  ensureBudgetFor(month);
  return state.budgets.find((item) => item.month === month)?.amount || 0;
}

function ensureBudgetFor(month) {
  if (state.budgets.some((item) => item.month === month)) return;
  const previous = state.budgets
    .filter((item) => item.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  state.budgets.push({
    id: cryptoId(),
    month,
    amount: previous ? previous.amount : 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  persist();
}

function getMonthExpense(month) {
  return sum(
    state.transactions.filter((tx) => tx.type === "expense" && monthKey(tx.transactionDate) === month),
    "amount"
  );
}

function getAccountBalances() {
  const balances = {};
  state.accounts.forEach((account) => {
    balances[account.id] = roundMoney(account.initialBalance || 0);
  });

  state.transactions.forEach((tx) => {
    if (tx.type === "expense") {
      balances[tx.accountId] = roundMoney((balances[tx.accountId] || 0) - tx.amount);
    } else if (tx.type === "income") {
      balances[tx.accountId] = roundMoney((balances[tx.accountId] || 0) + tx.amount);
    } else if (tx.type === "transfer") {
      balances[tx.fromAccountId] = roundMoney((balances[tx.fromAccountId] || 0) - tx.amount);
      balances[tx.toAccountId] = roundMoney((balances[tx.toAccountId] || 0) + tx.amount);
    }
  });

  return balances;
}

function getTotalBalance() {
  return Object.values(getAccountBalances()).reduce((total, amount) => roundMoney(total + amount), 0);
}

function getActiveAccounts() {
  return state.accounts.filter((account) => account.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

function accountName(id) {
  return state.accounts.find((account) => account.id === id)?.name || "未知账户";
}

function transactionUsesAccount(tx, accountId) {
  return tx.accountId === accountId || tx.fromAccountId === accountId || tx.toAccountId === accountId;
}

function sortTransactions(transactions) {
  return transactions.slice().sort((a, b) => {
    const byDate = b.transactionDate.localeCompare(a.transactionDate);
    if (byDate) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function exportCsvFiles() {
  downloadCsv("accounts.csv", [
    ["id", "name", "initial_balance", "is_active", "sort_order", "created_at", "updated_at"],
    ...state.accounts.map((a) => [a.id, a.name, a.initialBalance, a.isActive, a.sortOrder, a.createdAt, a.updatedAt])
  ]);

  downloadCsv("transactions.csv", [
    ["id", "type", "amount", "account_name", "from_account_name", "to_account_name", "category", "note", "is_special", "transaction_date", "created_at", "updated_at"],
    ...state.transactions.map((tx) => [
      tx.id,
      tx.type,
      tx.amount,
      tx.accountId ? accountName(tx.accountId) : "",
      tx.fromAccountId ? accountName(tx.fromAccountId) : "",
      tx.toAccountId ? accountName(tx.toAccountId) : "",
      tx.category,
      tx.note,
      tx.isSpecial,
      tx.transactionDate,
      tx.createdAt,
      tx.updatedAt
    ])
  ]);

  downloadCsv("budgets.csv", [
    ["id", "month", "amount", "created_at", "updated_at"],
    ...state.budgets.map((b) => [b.id, b.month, b.amount, b.createdAt, b.updatedAt])
  ]);

  showToast("已导出 CSV");
}

function downloadCsv(filename, rows) {
  const content = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importCsvFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  if (!confirm("导入会覆盖当前数据，确定继续？")) {
    els.importInput.value = "";
    return;
  }

  const parsed = {};
  for (const file of files) {
    const name = file.name.toLowerCase();
    const text = await file.text();
    if (name.includes("account")) parsed.accounts = parseCsv(text);
    if (name.includes("transaction")) parsed.transactions = parseCsv(text);
    if (name.includes("budget")) parsed.budgets = parseCsv(text);
  }

  if (!parsed.accounts || !parsed.transactions || !parsed.budgets) {
    showToast("请同时选择 accounts、transactions、budgets 三个 CSV");
    els.importInput.value = "";
    return;
  }

  const accounts = parsed.accounts.slice(1).filter((row) => row.length >= 7).map((row) => ({
    id: row[0] || cryptoId(),
    name: row[1] || "未命名账户",
    initialBalance: roundMoney(Number(row[2]) || 0),
    isActive: row[3] === "true",
    sortOrder: Number(row[4]) || 0,
    createdAt: row[5] || nowIso(),
    updatedAt: row[6] || nowIso()
  }));

  const accountByName = Object.fromEntries(accounts.map((account) => [account.name, account.id]));
  const transactions = parsed.transactions.slice(1).filter((row) => row.length >= 12).map((row) => ({
    id: row[0] || cryptoId(),
    type: row[1],
    amount: roundMoney(Number(row[2]) || 0),
    accountId: accountByName[row[3]] || null,
    fromAccountId: accountByName[row[4]] || null,
    toAccountId: accountByName[row[5]] || null,
    category: row[6] || "",
    note: row[7] || "",
    isSpecial: row[8] === "true",
    transactionDate: row[9] || today(),
    createdAt: row[10] || nowIso(),
    updatedAt: row[11] || nowIso()
  }));

  const budgets = parsed.budgets.slice(1).filter((row) => row.length >= 5).map((row) => ({
    id: row[0] || cryptoId(),
    month: row[1],
    amount: roundMoney(Number(row[2]) || 0),
    createdAt: row[3] || nowIso(),
    updatedAt: row[4] || nowIso()
  }));

  state.accounts = accounts;
  state.transactions = transactions;
  state.budgets = budgets;
  state.hasSetup = true;
  ensureCurrentBudget();
  persist();
  renderAll();
  els.importInput.value = "";
  showToast("导入完成");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cleanCsvValue(value));
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cleanCsvValue(value));
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(cleanCsvValue(value));
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function cleanCsvValue(value) {
  return value.replace(/^\uFEFF/, "");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function groupBySum(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] = roundMoney((groups[key] || 0) + item.amount);
    return groups;
  }, {});
}

function sum(items, field) {
  return roundMoney(items.reduce((total, item) => total + (Number(item[field]) || 0), 0));
}

function niceAxisStep(value) {
  if (value <= 10) return 5;
  if (value <= 50) return 10;
  if (value <= 100) return 20;
  if (value <= 500) return 100;
  if (value <= 1000) return 200;
  if (value <= 5000) return 1000;
  return 5000;
}

function compactMoney(value) {
  const rounded = roundMoney(value);
  if (rounded >= 10000) return `${roundMoney(rounded / 10000)}万`;
  if (rounded >= 1000) return `${Math.round(rounded)}`;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function money(value) {
  return roundMoney(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function today() {
  return localDateKey(new Date());
}

function currentMonth() {
  return localDateKey(new Date()).slice(0, 7);
}

function monthKey(value) {
  if (value instanceof Date) return localDateKey(value).slice(0, 7);
  return String(value).slice(0, 7);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function formatHumanDate(date) {
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  });
}

function nowIso() {
  return new Date().toISOString();
}

function cryptoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}
