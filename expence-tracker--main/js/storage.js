/**
 * storage.js
 * ---------------------------------------------------------------------------
 * Centralized data persistence module for ClearLedger.
 *
 * Backed by REST API calls to the Node.js + Express + SQLite backend.
 * Uses relative API base (/api) sharing the same host and port.
 */

const API_BASE = '/api';

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
  MIGRATED: 'clearledger_migrated_v1',
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

export function buildSeedTransactions() {
  const m0 = getCurrentMonthKey();
  const m1 = shiftMonth(m0, -1);
  const m2 = shiftMonth(m0, -2);
  const m3 = shiftMonth(m0, -3);
  const m4 = shiftMonth(m0, -4);
  const m5 = shiftMonth(m0, -5);

  return [
    {
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: `${m0}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m0}-02`,
      description: 'Monthly lease payment',
    },
    {
      title: 'Grocery Shopping',
      amount: 285.4,
      category: 'Food',
      type: 'expense',
      date: `${m0}-05`,
      description: 'Weekly groceries and household staples',
    },
    {
      title: 'UI Consulting Retainer',
      amount: 850.0,
      category: 'Freelance',
      type: 'income',
      date: `${m0}-06`,
      description: 'Design system audit milestone',
    },
    {
      title: 'Electric & Fiber Internet',
      amount: 164.2,
      category: 'Utilities',
      type: 'expense',
      date: `${m0}-07`,
      description: 'Monthly power and gigabit broadband',
    },
    {
      title: 'Metro Pass & Fuel',
      amount: 138.0,
      category: 'Transportation',
      type: 'expense',
      date: `${m0}-09`,
      description: 'Commuter transit pass and refueling',
    },
    {
      title: 'Pharmacy & Dental Checkup',
      amount: 145.0,
      category: 'Healthcare',
      type: 'expense',
      date: `${m0}-10`,
      description: 'Routine dental cleaning copay',
    },
    {
      title: 'Whole Foods Market',
      amount: 196.8,
      category: 'Food',
      type: 'expense',
      date: `${m0}-12`,
      description: 'Fresh produce and dinner prep',
    },
    {
      title: 'Streaming & Books',
      amount: 72.5,
      category: 'Entertainment',
      type: 'expense',
      date: `${m0}-13`,
      description: 'Monthly media subscriptions and technical book',
    },
    {
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: `${m1}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m1}-02`,
      description: 'Monthly lease payment',
    },
    {
      title: 'Groceries & Dining',
      amount: 512.3,
      category: 'Food',
      type: 'expense',
      date: `${m1}-11`,
      description: 'Monthly food and dining expenses',
    },
    {
      title: 'Winter Jacket & Essentials',
      amount: 240.0,
      category: 'Shopping',
      type: 'expense',
      date: `${m1}-16`,
      description: 'Seasonal wardrobe replacement',
    },
    {
      title: 'Utilities Bundle',
      amount: 158.9,
      category: 'Utilities',
      type: 'expense',
      date: `${m1}-20`,
      description: 'Water, electric, and internet',
    },
    {
      title: 'Dividend Payout',
      amount: 320.0,
      category: 'Investments',
      type: 'income',
      date: `${m1}-24`,
      description: 'Quarterly index ETF distribution',
    },
    {
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: `${m2}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m2}-02`,
      description: 'Monthly lease payment',
    },
    {
      title: 'Weekend Rail Trip',
      amount: 390.0,
      category: 'Travel',
      type: 'expense',
      date: `${m2}-14`,
      description: 'Train tickets and hotel stay',
    },
    {
      title: 'Groceries',
      amount: 465.0,
      category: 'Food',
      type: 'expense',
      date: `${m2}-18`,
      description: 'Supermarket runs',
    },
    {
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: `${m3}-01`,
      description: 'Primary payroll deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m3}-02`,
      description: 'Monthly lease payment',
    },
    {
      title: 'Online Course Subscription',
      amount: 199.0,
      category: 'Education',
      type: 'expense',
      date: `${m3}-09`,
      description: 'Systems architecture workshop',
    },
    {
      title: 'Groceries & Transit',
      amount: 615.0,
      category: 'Food',
      type: 'expense',
      date: `${m3}-19`,
      description: 'Monthly groceries and local transit',
    },
    {
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: `${m4}-01`,
      description: 'Primary payroll deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m4}-02`,
      description: 'Monthly lease payment',
    },
    {
      title: 'Food & Utilities',
      amount: 680.0,
      category: 'Food',
      type: 'expense',
      date: `${m4}-15`,
      description: 'Groceries and summer electric bill',
    },
    {
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: `${m5}-01`,
      description: 'Primary payroll deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1450.0,
      category: 'Housing',
      type: 'expense',
      date: `${m5}-02`,
      description: 'Monthly lease payment',
    },
    {
      title: 'Groceries & Supplies',
      amount: 540.0,
      category: 'Food',
      type: 'expense',
      date: `${m5}-12`,
      description: 'Supermarket groceries',
    },
  ];
}

export function buildDefaultBudget() {
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

/* ==========================================================================
   REST API Client Helpers
   ========================================================================== */

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  } catch (netErr) {
    throw new Error('Failed to connect to the backend server. Is it running?');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (jsonErr) {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/* ==========================================================================
   One-Time LocalStorage to SQLite Migration (Requirement 27 & 28)
   ========================================================================== */

export async function initializeStorage() {
  const isMigrated = window.localStorage.getItem(STORAGE_KEYS.MIGRATED);
  if (isMigrated === 'true') {
    return { migrated: false, count: 0 };
  }

  let importedCount = 0;
  try {
    const rawTxs = window.localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    let localTxs = [];
    if (rawTxs) {
      try {
        localTxs = JSON.parse(rawTxs);
      } catch (e) {
        localTxs = [];
      }
    }

    // If local storage has transactions, import them via POST /api/transactions
    if (Array.isArray(localTxs) && localTxs.length > 0) {
      for (const item of localTxs) {
        await saveTransaction({
          title: item.title,
          amount: item.amount,
          category: item.category,
          type: item.type,
          date: item.date,
          description: item.description,
        });
        importedCount += 1;
      }
    }

    // If local storage has budget, import it via POST /api/budgets
    const rawBudget = window.localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (rawBudget) {
      try {
        const localBudget = JSON.parse(rawBudget);
        if (localBudget && Number(localBudget.monthlyLimit) > 0) {
          const mKey = getCurrentMonthKey();
          await saveBudget(
            {
              monthlyLimit: Number(localBudget.monthlyLimit),
              categoryLimits: localBudget.categoryLimits || {},
            },
            mKey
          );
        }
      } catch (bErr) {
        console.warn('Failed to migrate local budget:', bErr);
      }
    }

    // Set migration flag so this never runs twice. Original LocalStorage is NOT deleted (kept as backup).
    window.localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
    console.log(`[ClearLedger Migration] Successfully imported ${importedCount} transaction(s) into database.`);
    return { migrated: true, count: importedCount };
  } catch (err) {
    console.error('[ClearLedger Migration] Migration encountered an error:', err);
    return { migrated: false, count: importedCount, error: err };
  }
}

/* ==========================================================================
   CRUD Operations (Backed by REST API)
   ========================================================================== */

/**
 * Retrieve all transactions (newest first).
 * REST endpoint: GET /api/transactions
 */
export async function getTransactions() {
  const response = await apiRequest('/transactions');
  return Array.isArray(response.data) ? response.data : [];
}

/**
 * Save a new transaction.
 * REST endpoint: POST /api/transactions
 */
export async function saveTransaction(txInput) {
  const payload = {
    title: String(txInput.title || '').trim(),
    amount: Number(txInput.amount),
    category: String(txInput.category || 'Other').trim(),
    type: txInput.type === 'income' ? 'income' : 'expense',
    date: String(txInput.date || getTodayISO()).trim(),
    description: String(txInput.description || '').trim(),
  };

  const response = await apiRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
}

/**
 * Update an existing transaction by ID.
 * REST endpoint: PUT /api/transactions/:id
 */
export async function updateTransaction(id, updates) {
  const payload = {
    title: updates.title !== undefined ? String(updates.title).trim() : undefined,
    amount: updates.amount !== undefined ? Number(updates.amount) : undefined,
    category: updates.category !== undefined ? String(updates.category).trim() : undefined,
    type: updates.type === 'income' || updates.type === 'expense' ? updates.type : undefined,
    date: updates.date !== undefined ? String(updates.date).trim() : undefined,
    description: updates.description !== undefined ? String(updates.description).trim() : undefined,
  };

  const response = await apiRequest(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  return response.data;
}

/**
 * Delete a transaction by ID.
 * REST endpoint: DELETE /api/transactions/:id
 */
export async function deleteTransaction(id) {
  const response = await apiRequest(`/transactions/${id}`, {
    method: 'DELETE',
  });
  return response.success === true;
}

/**
 * Retrieve budget configuration for a specific month (YYYY-MM).
 * REST endpoint: GET /api/budgets/:year/:month
 */
export async function getBudget(monthKey = getCurrentMonthKey()) {
  const [year, month] = monthKey.split('-').map(Number);
  try {
    const response = await apiRequest(`/budgets/${year}/${month}`);
    if (response && response.data) {
      return {
        id: response.data.id,
        monthlyLimit: Number(response.data.amount) || 0,
        categoryLimits: response.data.category_limits || {},
        updatedAt: response.data.created_at || getTodayISO(),
      };
    }
  } catch (err) {
    if (err.status === 404) {
      return {
        id: null,
        monthlyLimit: 0,
        categoryLimits: {},
        updatedAt: getTodayISO(),
      };
    }
    throw err;
  }

  return {
    id: null,
    monthlyLimit: 0,
    categoryLimits: {},
    updatedAt: getTodayISO(),
  };
}

/**
 * Retrieve smart budget alerts and spending pace forecasts.
 * REST endpoint: GET /api/budgets/:year/:month/alerts
 */
export async function getBudgetSmartAlerts(monthKey = getCurrentMonthKey()) {
  const [year, month] = monthKey.split('-').map(Number);
  try {
    const response = await apiRequest(`/budgets/${year}/${month}/alerts`);
    return response.data || null;
  } catch (err) {
    console.warn('[storage] Failed to fetch smart alerts:', err);
    return null;
  }
}

/**
 * Save budget configuration for a specific month.
 * REST endpoint: POST /api/budgets or PUT /api/budgets/:id
 */
export async function saveBudget(budgetInput, monthKey = getCurrentMonthKey()) {
  const [year, month] = monthKey.split('-').map(Number);
  const current = await getBudget(monthKey);

  const nextLimit =
    budgetInput.monthlyLimit !== undefined
      ? Math.max(0, Number(budgetInput.monthlyLimit) || 0)
      : current.monthlyLimit;

  const nextCategoryLimits =
    budgetInput.categoryLimits !== undefined
      ? budgetInput.categoryLimits
      : current.categoryLimits;

  if (current.id) {
    const response = await apiRequest(`/budgets/${current.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        year,
        month,
        amount: Math.max(0.01, nextLimit),
        category_limits: nextCategoryLimits,
      }),
    });
    return {
      id: response.data.id,
      monthlyLimit: Number(response.data.amount) || 0,
      categoryLimits: response.data.category_limits || {},
      updatedAt: response.data.created_at || getTodayISO(),
    };
  } else {
    const response = await apiRequest('/budgets', {
      method: 'POST',
      body: JSON.stringify({
        year,
        month,
        amount: Math.max(0.01, nextLimit),
        category_limits: nextCategoryLimits,
      }),
    });
    return {
      id: response.data.id,
      monthlyLimit: Number(response.data.amount) || 0,
      categoryLimits: response.data.category_limits || {},
      updatedAt: response.data.created_at || getTodayISO(),
    };
  }
}

/**
 * Clear all user transactions and reset budget to 0.
 */
export async function clearAllData(monthKey = getCurrentMonthKey()) {
  const transactions = await getTransactions();
  for (const tx of transactions) {
    await deleteTransaction(tx.id);
  }

  const current = await getBudget(monthKey);
  if (current.id) {
    await apiRequest(`/budgets/${current.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount: 0.01,
        category_limits: {},
      }),
    }).catch(() => { });
  }
}

/**
 * Restore sample ledger data.
 */
export async function resetToSampleData() {
  const currentTxs = await getTransactions();
  for (const tx of currentTxs) {
    await deleteTransaction(tx.id);
  }

  const seeds = buildSeedTransactions();
  for (const item of seeds) {
    await saveTransaction(item);
  }

  const m0 = getCurrentMonthKey();
  const [y, m] = m0.split('-').map(Number);
  const defBudget = buildDefaultBudget();
  const existingBudget = await getBudget(m0);

  if (existingBudget.id) {
    await apiRequest(`/budgets/${existingBudget.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        year: y,
        month: m,
        amount: defBudget.monthlyLimit,
        category_limits: defBudget.categoryLimits,
      }),
    });
  } else {
    await apiRequest('/budgets', {
      method: 'POST',
      body: JSON.stringify({
        year: y,
        month: m,
        amount: defBudget.monthlyLimit,
        category_limits: defBudget.categoryLimits,
      }),
    });
  }
}
