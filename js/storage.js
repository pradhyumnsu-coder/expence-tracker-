/**
 * storage.js
 * ---------------------------------------------------------------------------
 * Centralized data persistence module for ClearLedger.
 *
 * Currently backed by browser LocalStorage. Designed as a clean repository
 * boundary so every function can be swapped to async REST API calls
 * (Node.js + Express.js + SQL) without changing UI or calculation modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Travel',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Rental',
  'Bonus',
  'Other Income',
];

export const CATEGORY_COLORS = {
  Food: '#2563EB',
  Housing: '#0F172A',
  Transportation: '#0891B2',
  Utilities: '#D97706',
  Healthcare: '#DC2626',
  Entertainment: '#7C3AED',
  Shopping: '#DB2777',
  Education: '#059669',
  Travel: '#EA580C',
  Other: '#64748B',
  Salary: '#16A34A',
  Freelance: '#0D9488',
  Investments: '#1D4ED8',
  Rental: '#4F46E5',
  Bonus: '#65A30D',
  'Other Income': '#475569',
};

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#64748B';
}

export function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey() {
  return getTodayISO().slice(0, 7);
}

export function getMonthKey(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  return dateStr.slice(0, 7);
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function formatShortMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
}

export function formatCurrency(amount, options = {}) {
  const num = Number(amount) || 0;
  const { showSign = false, currency = 'USD' } = options;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (num < 0) return `-${formatted}`;
  if (showSign && num > 0) return `+${formatted}`;
  return formatted;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function shiftMonth(monthKey, deltaMonths) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function buildSeedTransactions() {
  const m0 = getCurrentMonthKey();
  const m1 = shiftMonth(m0, -1);
  const m2 = shiftMonth(m0, -2);
  const m3 = shiftMonth(m0, -3);
  const m4 = shiftMonth(m0, -4);
  const m5 = shiftMonth(m0, -5);

  return [
    // Current month
    {
      id: 'tx_seed_01',
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: `${m0}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: 'tx_seed_02',
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m0}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_03',
      title: 'Grocery Shopping',
      amount: 285.4,
      category: 'Food',
      type: 'expense',
      date: `${m0}-05`,
      description: 'Weekly groceries and household staples',
    },
    {
      id: 'tx_seed_04',
      title: 'UI Consulting Retainer',
      amount: 850.0,
      category: 'Freelance',
      type: 'income',
      date: `${m0}-06`,
      description: 'Design system audit milestone',
    },
    {
      id: 'tx_seed_05',
      title: 'Electric & Fiber Internet',
      amount: 164.2,
      category: 'Utilities',
      type: 'expense',
      date: `${m0}-07`,
      description: 'Monthly power and gigabit broadband',
    },
    {
      id: 'tx_seed_06',
      title: 'Metro Pass & Fuel',
      amount: 138.0,
      category: 'Transportation',
      type: 'expense',
      date: `${m0}-09`,
      description: 'Commuter transit pass and refueling',
    },
    {
      id: 'tx_seed_07',
      title: 'Pharmacy & Dental Checkup',
      amount: 145.0,
      category: 'Healthcare',
      type: 'expense',
      date: `${m0}-10`,
      description: 'Routine dental cleaning copay',
    },
    {
      id: 'tx_seed_08',
      title: 'Whole Foods Market',
      amount: 196.8,
      category: 'Food',
      type: 'expense',
      date: `${m0}-12`,
      description: 'Fresh produce and dinner prep',
    },
    {
      id: 'tx_seed_09',
      title: 'Streaming & Books',
      amount: 72.5,
      category: 'Entertainment',
      type: 'expense',
      date: `${m0}-13`,
      description: 'Monthly media subscriptions and technical book',
    },
    // Month -1
    {
      id: 'tx_seed_10',
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: `${m1}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: 'tx_seed_11',
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m1}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_12',
      title: 'Groceries & Dining',
      amount: 512.3,
      category: 'Food',
      type: 'expense',
      date: `${m1}-11`,
      description: 'Monthly food and dining expenses',
    },
    {
      id: 'tx_seed_13',
      title: 'Winter Jacket & Essentials',
      amount: 240.0,
      category: 'Shopping',
      type: 'expense',
      date: `${m1}-16`,
      description: 'Seasonal wardrobe replacement',
    },
    {
      id: 'tx_seed_14',
      title: 'Utilities Bundle',
      amount: 158.9,
      category: 'Utilities',
      type: 'expense',
      date: `${m1}-20`,
      description: 'Water, electric, and internet',
    },
    {
      id: 'tx_seed_15',
      title: 'Dividend Payout',
      amount: 320.0,
      category: 'Investments',
      type: 'income',
      date: `${m1}-24`,
      description: 'Quarterly index ETF distribution',
    },
    // Month -2
    {
      id: 'tx_seed_16',
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: `${m2}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: 'tx_seed_17',
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m2}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_18',
      title: 'Weekend Rail Trip',
      amount: 390.0,
      category: 'Travel',
      type: 'expense',
      date: `${m2}-14`,
      description: 'Train tickets and hotel stay',
    },
    {
      id: 'tx_seed_19',
      title: 'Groceries',
      amount: 465.0,
      category: 'Food',
      type: 'expense',
      date: `${m2}-18`,
      description: 'Supermarket runs',
    },
    // Month -3
    {
      id: 'tx_seed_20',
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: `${m3}-01`,
      description: 'Primary payroll deposit',
    },
    {
      id: 'tx_seed_21',
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m3}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_22',
      title: 'Online Course Subscription',
      amount: 199.0,
      category: 'Education',
      type: 'expense',
      date: `${m3}-09`,
      description: 'Systems architecture workshop',
    },
    {
      id: 'tx_seed_23',
      title: 'Groceries & Transit',
      amount: 615.0,
      category: 'Food',
      type: 'expense',
      date: `${m3}-19`,
      description: 'Monthly groceries and local transit',
    },
    // Month -4
    {
      id: 'tx_seed_24',
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: `${m4}-01`,
      description: 'Primary payroll deposit',
    },
    {
      id: 'tx_seed_25',
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m4}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_26',
      title: 'Food & Utilities',
      amount: 680.0,
      category: 'Food',
      type: 'expense',
      date: `${m4}-15`,
      description: 'Groceries and summer electric bill',
    },
    // Month -5
    {
      id: 'tx_seed_27',
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: `${m5}-01`,
      description: 'Primary payroll deposit',
    },
    {
      id: 'tx_seed_28',
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m5}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_29',
      title: 'Groceries & Supplies',
      amount: 540.0,
      category: 'Food',
      type: 'expense',
      date: `${m5}-12`,
      description: 'Supermarket groceries',
    },
  ];
}

function buildDefaultBudget() {
  return {
    monthlyLimit: 3200,
    categoryLimits: {
      Food: 650,
      Housing: 1500,
      Transportation: 250,
      Utilities: 220,
      Entertainment: 150,
      Shopping: 300,
    },
    updatedAt: getTodayISO(),
  };
}

function safeReadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse LocalStorage key "${key}":`, err);
    return fallback;
  }
}

function safeWriteJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Failed to write LocalStorage key "${key}":`, err);
    return false;
  }
}

/**
 * Ensures initial sample data exists on first load only.
 * If a user deletes all transactions later, the empty state is respected.
 */
export function initializeStorage() {
  const initialized = window.localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!initialized) {
    safeWriteJSON(STORAGE_KEYS.TRANSACTIONS, buildSeedTransactions());
    safeWriteJSON(STORAGE_KEYS.BUDGET, buildDefaultBudget());
    window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

/**
 * Retrieve all transactions.
 * Future REST endpoint: GET /api/transactions
 * @returns {Array<Object>}
 */
export function getTransactions() {
  initializeStorage();
  const data = safeReadJSON(STORAGE_KEYS.TRANSACTIONS, []);
  return Array.isArray(data) ? data : [];
}

/**
 * Save a new transaction.
 * Future REST endpoint: POST /api/transactions
 * @param {Object} txInput
 * @returns {Object} Saved transaction record
 */
export function saveTransaction(txInput) {
  const list = getTransactions();
  const newTx = {
    id: txInput.id || generateId(),
    title: String(txInput.title || '').trim(),
    amount: Number(txInput.amount),
    category: String(txInput.category || 'Other'),
    type: txInput.type === 'income' ? 'income' : 'expense',
    date: String(txInput.date || getTodayISO()),
    description: String(txInput.description || '').trim(),
  };
  list.push(newTx);
  safeWriteJSON(STORAGE_KEYS.TRANSACTIONS, list);
  return newTx;
}

/**
 * Update an existing transaction by ID.
 * Future REST endpoint: PUT /api/transactions/:id
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
export function updateTransaction(id, updates) {
  const list = getTransactions();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated = {
    ...list[index],
    title: updates.title !== undefined ? String(updates.title).trim() : list[index].title,
    amount: updates.amount !== undefined ? Number(updates.amount) : list[index].amount,
    category: updates.category !== undefined ? String(updates.category) : list[index].category,
    type: updates.type === 'income' || updates.type === 'expense' ? updates.type : list[index].type,
    date: updates.date !== undefined ? String(updates.date) : list[index].date,
    description:
      updates.description !== undefined
        ? String(updates.description).trim()
        : list[index].description,
  };

  list[index] = updated;
  safeWriteJSON(STORAGE_KEYS.TRANSACTIONS, list);
  return updated;
}

/**
 * Delete a transaction by ID.
 * Future REST endpoint: DELETE /api/transactions/:id
 * @param {string} id
 * @returns {boolean}
 */
export function deleteTransaction(id) {
  const list = getTransactions();
  const filtered = list.filter((item) => item.id !== id);
  if (filtered.length === list.length) return false;
  safeWriteJSON(STORAGE_KEYS.TRANSACTIONS, filtered);
  return true;
}

/**
 * Retrieve budget configuration.
 * Future REST endpoint: GET /api/budget
 * @returns {{ monthlyLimit: number, categoryLimits: Object, updatedAt: string }}
 */
export function getBudget() {
  initializeStorage();
  const budget = safeReadJSON(STORAGE_KEYS.BUDGET, null);
  if (!budget || typeof budget !== 'object') {
    return buildDefaultBudget();
  }
  return {
    monthlyLimit: Number(budget.monthlyLimit) || 0,
    categoryLimits:
      budget.categoryLimits && typeof budget.categoryLimits === 'object'
        ? budget.categoryLimits
        : {},
    updatedAt: budget.updatedAt || getTodayISO(),
  };
}

/**
 * Save budget configuration.
 * Future REST endpoint: PUT /api/budget
 * @param {Object} budgetInput
 * @returns {Object}
 */
export function saveBudget(budgetInput) {
  const current = getBudget();
  const next = {
    monthlyLimit: Math.max(0, Number(budgetInput.monthlyLimit) || 0),
    categoryLimits:
      budgetInput.categoryLimits !== undefined
        ? budgetInput.categoryLimits
        : current.categoryLimits,
    updatedAt: getTodayISO(),
  };
  safeWriteJSON(STORAGE_KEYS.BUDGET, next);
  return next;
}

/**
 * Clear all user transactions and reset budget to 0 (for testing Empty State).
 */
export function clearAllData() {
  safeWriteJSON(STORAGE_KEYS.TRANSACTIONS, []);
  safeWriteJSON(STORAGE_KEYS.BUDGET, {
    monthlyLimit: 0,
    categoryLimits: {},
    updatedAt: getTodayISO(),
  });
  window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

/**
 * Restore realistic sample ledger data.
 */
export function resetToSampleData() {
  safeWriteJSON(STORAGE_KEYS.TRANSACTIONS, buildSeedTransactions());
  safeWriteJSON(STORAGE_KEYS.BUDGET, buildDefaultBudget());
  window.localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}
