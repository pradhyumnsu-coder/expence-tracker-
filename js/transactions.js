/**
 * transactions.js
 * ---------------------------------------------------------------------------
 * Pure transaction validation, filtering, sorting, CSV serialization,
 * Transaction History table rendering, and Add/Edit Transaction Modal.
 */

import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  getMonthKey,
  getTodayISO,
} from './storage.js';

/* ==========================================================================
   Pure Data & Validation Functions (Storage-Independent)
   ========================================================================== */

export function validateTransactionInput(input) {
  const errors = {};
  const title = String(input.title || '').trim();
  const amount = Number(input.amount);
  const category = String(input.category || '').trim();
  const type = input.type;
  const date = String(input.date || '').trim();
  const description = String(input.description || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  if (!input.amount && input.amount !== 0) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  } else if (amount > 999999999) {
    errors.amount = 'Amount exceeds maximum supported limit.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Transaction type must be income or expense.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  if (description.length > 240) {
    errors.description = 'Description cannot exceed 240 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function filterTransactions(transactions, filters = {}) {
  const {
    search = '',
    type = 'all',
    category = 'all',
    month = 'all',
  } = filters;

  const query = search.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month !== 'all' && getMonthKey(tx.date) !== month) return false;

    if (query) {
      const hay = `${tx.title} ${tx.category} ${tx.description || ''}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }

    return true;
  });
}

export function sortTransactions(transactions, sortBy = 'date-desc') {
  const copy = [...transactions];
  copy.sort((a, b) => {
    switch (sortBy) {
      case 'date-asc': {
        const cmp = a.date.localeCompare(b.date);
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
      }
      case 'amount-desc':
        return Number(b.amount) - Number(a.amount);
      case 'amount-asc':
        return Number(a.amount) - Number(b.amount);
      case 'date-desc':
      default: {
        const cmp = b.date.localeCompare(a.date);
        return cmp !== 0 ? cmp : String(b.id).localeCompare(String(a.id));
      }
    }
  });
  return copy;
}

export function transactionsToCSV(transactions) {
  const header = ['ID', 'Date', 'Title', 'Type', 'Category', 'Amount', 'Description'];
  const escapeCSV = (val) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = transactions.map((tx) => [
    tx.id,
    tx.date,
    tx.title,
    tx.type,
    tx.category,
    Number(tx.amount).toFixed(2),
    tx.description || '',
  ]);

  return [header, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
}

/* ==========================================================================
   Transaction History View Renderer
   ========================================================================== */

export function renderTransactionsView(container, transactions, state, handlers) {
  const { filters, activeMonth } = state;
  const effectiveFilters = {
    ...filters,
    month: filters.monthScope === 'selected' ? activeMonth : 'all',
  };

  const filtered = sortTransactions(
    filterTransactions(transactions, effectiveFilters),
    filters.sortBy
  );

  const allCategories = Array.from(
    new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...transactions.map((t) => t.category)])
  ).sort((a, b) => a.localeCompare(b));

  const filteredIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const filteredExpense = filtered
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.type !== 'all' ||
    filters.category !== 'all' ||
    filters.monthScope === 'selected';

  const dateSortNext = filters.sortBy === 'date-desc' ? 'date-asc' : 'date-desc';
  const amountSortNext = filters.sortBy === 'amount-desc' ? 'amount-asc' : 'amount-desc';

  container.innerHTML = `
    <div class="section-header-row">
      <div>
        <h2 class="section-heading">Transaction History</h2>
        <p class="section-subtext">
          Search, filter, edit, and audit every income and expense record.
        </p>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button type="button" class="btn btn-secondary btn-sm" id="export-csv-btn" ${
          filtered.length === 0 ? 'disabled' : ''
        }>
          <i data-lucide="download" aria-hidden="true"></i>
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <div class="surface-card">
      <div class="toolbar">
        <div class="toolbar-filters">
          <div class="search-input-wrap">
            <i data-lucide="search" aria-hidden="true"></i>
            <input
              type="search"
              id="tx-search-input"
              class="search-input"
              placeholder="Search title, category, or notes..."
              value="${escapeHtml(filters.search)}"
              aria-label="Search transactions"
            />
          </div>

          <div class="segmented-control" role="group" aria-label="Filter by transaction type">
            <button type="button" class="segmented-btn ${
              filters.type === 'all' ? 'is-active' : ''
            }" data-filter-type="all">All</button>
            <button type="button" class="segmented-btn ${
              filters.type === 'income' ? 'is-active' : ''
            }" data-filter-type="income">Income</button>
            <button type="button" class="segmented-btn ${
              filters.type === 'expense' ? 'is-active' : ''
            }" data-filter-type="expense">Expense</button>
          </div>

          <label for="tx-filter-category" class="sr-only">Filter by category</label>
          <select id="tx-filter-category" class="select-compact" aria-label="Filter by category">
            <option value="all">All Categories</option>
            ${allCategories
              .map(
                (cat) =>
                  `<option value="${escapeHtml(cat)}" ${
                    filters.category === cat ? 'selected' : ''
                  }>${escapeHtml(cat)}</option>`
              )
              .join('')}
          </select>

          <label for="tx-filter-month-scope" class="sr-only">Month scope</label>
          <select id="tx-filter-month-scope" class="select-compact" aria-label="Timeframe">
            <option value="all" ${filters.monthScope === 'all' ? 'selected' : ''}>All Months</option>
            <option value="selected" ${filters.monthScope === 'selected' ? 'selected' : ''}>
              ${escapeHtml(formatMonthLabel(activeMonth))}
            </option>
          </select>

          <label for="tx-sort-select" class="sr-only">Sort transactions</label>
          <select id="tx-sort-select" class="select-compact" aria-label="Sort transactions">
            <option value="date-desc" ${filters.sortBy === 'date-desc' ? 'selected' : ''}>Date: Newest First</option>
            <option value="date-asc" ${filters.sortBy === 'date-asc' ? 'selected' : ''}>Date: Oldest First</option>
            <option value="amount-desc" ${filters.sortBy === 'amount-desc' ? 'selected' : ''}>Amount: High to Low</option>
            <option value="amount-asc" ${filters.sortBy === 'amount-asc' ? 'selected' : ''}>Amount: Low to High</option>
          </select>
        </div>

        ${
          hasActiveFilters
            ? `<button type="button" class="btn btn-ghost btn-sm" id="clear-filters-btn">Clear filters</button>`
            : ''
        }
      </div>

      ${renderTableContent(filtered, transactions.length, dateSortNext, amountSortNext, filters.sortBy)}

      <div class="table-footer">
        <span class="tabular-nums">
          Showing ${filtered.length} of ${transactions.length} transaction${
            transactions.length === 1 ? '' : 's'
          }
        </span>
        <span class="tabular-nums">
          Income: <strong style="color:var(--success)">${formatCurrency(filteredIncome)}</strong>
          &nbsp;·&nbsp;
          Expenses: <strong style="color:var(--text-primary)">${formatCurrency(filteredExpense)}</strong>
        </span>
      </div>
    </div>
  `;

  // Bind Toolbar & Table Handlers
  const searchInput = container.querySelector('#tx-search-input');
  searchInput?.addEventListener('input', (e) => {
    handlers.onFilterChange({ search: e.target.value });
  });

  container.querySelectorAll('[data-filter-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onFilterChange({ type: btn.getAttribute('data-filter-type') });
    });
  });

  container.querySelector('#tx-filter-category')?.addEventListener('change', (e) => {
    handlers.onFilterChange({ category: e.target.value });
  });

  container.querySelector('#tx-filter-month-scope')?.addEventListener('change', (e) => {
    handlers.onFilterChange({ monthScope: e.target.value });
  });

  container.querySelector('#tx-sort-select')?.addEventListener('change', (e) => {
    handlers.onFilterChange({ sortBy: e.target.value });
  });

  container.querySelector('#clear-filters-btn')?.addEventListener('click', () => {
    handlers.onFilterChange({
      search: '',
      type: 'all',
      category: 'all',
      monthScope: 'all',
      sortBy: 'date-desc',
    });
  });

  container.querySelector('#empty-add-tx-btn')?.addEventListener('click', () => {
    handlers.onAddClick();
  });

  container.querySelector('#empty-reset-filters-btn')?.addEventListener('click', () => {
    handlers.onFilterChange({
      search: '',
      type: 'all',
      category: 'all',
      monthScope: 'all',
    });
  });

  container.querySelectorAll('[data-sort-trigger]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onFilterChange({ sortBy: btn.getAttribute('data-sort-trigger') });
    });
  });

  container.querySelector('#export-csv-btn')?.addEventListener('click', () => {
    if (filtered.length === 0) return;
    const csv = transactionsToCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clearledger-transactions-${getTodayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  container.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-id');
      handlers.onEditClick(id);
    });
  });

  container.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-id');
      handlers.onDeleteClick(id);
    });
  });
}

function renderTableContent(filtered, totalCount, dateSortNext, amountSortNext, currentSort) {
  if (totalCount === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="receipt" aria-hidden="true"></i>
        </div>
        <h3 class="empty-state-title">No transactions recorded yet</h3>
        <p class="empty-state-desc">
          Start logging your income and expenses to unlock live balance tracking, category charts, and budget alerts.
        </p>
        <button type="button" class="btn btn-primary btn-sm" id="empty-add-tx-btn">
          <i data-lucide="plus" aria-hidden="true"></i>
          <span>Add First Transaction</span>
        </button>
      </div>
    `;
  }

  if (filtered.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="search-x" aria-hidden="true"></i>
        </div>
        <h3 class="empty-state-title">No matching transactions</h3>
        <p class="empty-state-desc">
          Adjust your search query or clear active category and type filters to view entries.
        </p>
        <button type="button" class="btn btn-secondary btn-sm" id="empty-reset-filters-btn">
          Clear Filters
        </button>
      </div>
    `;
  }

  const dateArrow = currentSort === 'date-asc' ? 'arrow-up' : 'arrow-down';
  const amountArrow = currentSort === 'amount-asc' ? 'arrow-up' : 'arrow-down';

  return `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              <button type="button" class="th-sort-btn" data-sort-trigger="${dateSortNext}">
                <span>Date</span>
                <i data-lucide="${dateArrow}" style="width:13px;height:13px;opacity:${
                  currentSort.startsWith('date') ? '1' : '0.35'
                }" aria-hidden="true"></i>
              </button>
            </th>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th class="th-right">
              <button type="button" class="th-sort-btn" data-sort-trigger="${amountSortNext}" style="margin-left:auto;">
                <span>Amount</span>
                <i data-lucide="${amountArrow}" style="width:13px;height:13px;opacity:${
                  currentSort.startsWith('amount') ? '1' : '0.35'
                }" aria-hidden="true"></i>
              </button>
            </th>
            <th class="th-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((tx) => {
              const isIncome = tx.type === 'income';
              const signedAmount = isIncome
                ? formatCurrency(tx.amount, { showSign: true })
                : formatCurrency(-Number(tx.amount));
              return `
                <tr>
                  <td class="tx-meta-text tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
                  <td>
                    <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                    ${
                      tx.description
                        ? `<div class="tx-desc-sub" title="${escapeHtml(tx.description)}">${escapeHtml(
                            tx.description
                          )}</div>`
                        : ''
                    }
                  </td>
                  <td class="tx-meta-text">${escapeHtml(tx.category)}</td>
                  <td class="tx-meta-text" style="color:${
                    isIncome ? 'var(--success)' : 'var(--text-secondary)'
                  }">${isIncome ? 'Income' : 'Expense'}</td>
                  <td class="td-right tx-amount tabular-nums ${
                    isIncome ? 'is-income' : 'is-expense'
                  }">${escapeHtml(signedAmount)}</td>
                  <td class="td-right">
                    <div class="row-actions">
                      <button
                        type="button"
                        class="icon-btn"
                        data-edit-id="${escapeHtml(tx.id)}"
                        aria-label="Edit ${escapeHtml(tx.title)}"
                        title="Edit transaction"
                      >
                        <i data-lucide="pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        class="icon-btn is-danger"
                        data-delete-id="${escapeHtml(tx.id)}"
                        aria-label="Delete ${escapeHtml(tx.title)}"
                        title="Delete transaction"
                      >
                        <i data-lucide="trash-2" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   Add / Edit Transaction Modal Controller
   ========================================================================== */

export function createTransactionModalController(onSubmitSuccess, getBudgetAlertContext) {
  const modal = document.getElementById('transaction-modal');
  const form = document.getElementById('transaction-form');
  const titleEl = document.getElementById('transaction-modal-title');
  const submitBtn = document.getElementById('transaction-submit-btn');

  const idInput = document.getElementById('tx-id');
  const typeInput = document.getElementById('tx-type');
  const typeExpenseBtn = document.getElementById('tx-type-expense');
  const typeIncomeBtn = document.getElementById('tx-type-income');
  const titleInput = document.getElementById('tx-title');
  const amountInput = document.getElementById('tx-amount');
  const categorySelect = document.getElementById('tx-category');
  const dateInput = document.getElementById('tx-date');
  const descriptionInput = document.getElementById('tx-description');

  const budgetImpactBanner = document.getElementById('tx-budget-impact-banner');
  const budgetImpactTitle = document.getElementById('tx-budget-impact-title');
  const budgetImpactDesc = document.getElementById('tx-budget-impact-desc');

  function updateBudgetImpactWarning() {
    if (!budgetImpactBanner || !budgetImpactTitle || !budgetImpactDesc) return;

    if (typeInput.value !== 'expense' || !amountInput.value) {
      budgetImpactBanner.style.display = 'none';
      return;
    }

    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      budgetImpactBanner.style.display = 'none';
      return;
    }

    if (typeof getBudgetAlertContext !== 'function') {
      budgetImpactBanner.style.display = 'none';
      return;
    }

    const context = getBudgetAlertContext();
    if (!context || !context.budgetConfig) {
      budgetImpactBanner.style.display = 'none';
      return;
    }

    const { transactions = [], budgetConfig = {} } = context;
    const currentMonth = (dateInput.value || getTodayISO()).slice(0, 7);
    const monthlyLimit = Number(budgetConfig.monthlyLimit) || 0;
    const categoryLimits = budgetConfig.categoryLimits || {};
    const selectedCategory = categorySelect.value || 'Other';
    const categoryLimit = Number(categoryLimits[selectedCategory]) || 0;

    const currentEditingId = idInput.value;
    const otherExpenses = transactions.filter(
      (t) =>
        t.type === 'expense' &&
        t.date &&
        t.date.slice(0, 7) === currentMonth &&
        String(t.id) !== String(currentEditingId)
    );

    const currentMonthlySpent = otherExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const currentCatSpent = otherExpenses
      .filter((t) => t.category === selectedCategory)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const newMonthlySpent = currentMonthlySpent + amount;
    const newCatSpent = currentCatSpent + amount;

    // 1. Check category breach
    if (categoryLimit > 0 && newCatSpent > categoryLimit) {
      const over = newCatSpent - categoryLimit;
      budgetImpactBanner.className = 'status-banner is-danger';
      budgetImpactTitle.textContent = `Category Limit Exceeded: ${selectedCategory}`;
      budgetImpactDesc.textContent = `This expense pushes ${selectedCategory} to ${formatCurrency(newCatSpent)}, exceeding the ${formatCurrency(categoryLimit)} cap by ${formatCurrency(over)}.`;
      budgetImpactBanner.style.display = 'flex';
      return;
    }

    // 2. Check overall monthly budget breach
    if (monthlyLimit > 0 && newMonthlySpent > monthlyLimit) {
      const over = newMonthlySpent - monthlyLimit;
      budgetImpactBanner.className = 'status-banner is-danger';
      budgetImpactTitle.textContent = 'Monthly Budget Will Be Exceeded';
      budgetImpactDesc.textContent = `This entry pushes total spending to ${formatCurrency(newMonthlySpent)}, exceeding your ${formatCurrency(monthlyLimit)} budget by ${formatCurrency(over)}.`;
      budgetImpactBanner.style.display = 'flex';
      return;
    }

    // 3. Check 80%+ warning
    if (monthlyLimit > 0 && newMonthlySpent >= monthlyLimit * 0.8) {
      const pct = ((newMonthlySpent / monthlyLimit) * 100).toFixed(0);
      budgetImpactBanner.className = 'status-banner is-warning';
      budgetImpactTitle.textContent = `Approaching Monthly Budget (${pct}% Used)`;
      budgetImpactDesc.textContent = `Total spending will reach ${formatCurrency(newMonthlySpent)} of your ${formatCurrency(monthlyLimit)} limit (${formatCurrency(monthlyLimit - newMonthlySpent)} remaining).`;
      budgetImpactBanner.style.display = 'flex';
      return;
    }

    // 4. Check category 80%+ warning
    if (categoryLimit > 0 && newCatSpent >= categoryLimit * 0.8) {
      const pct = ((newCatSpent / categoryLimit) * 100).toFixed(0);
      budgetImpactBanner.className = 'status-banner is-warning';
      budgetImpactTitle.textContent = `Approaching ${selectedCategory} Cap (${pct}% Used)`;
      budgetImpactDesc.textContent = `${selectedCategory} spending will reach ${formatCurrency(newCatSpent)} of your ${formatCurrency(categoryLimit)} cap.`;
      budgetImpactBanner.style.display = 'flex';
      return;
    }

    budgetImpactBanner.style.display = 'none';
  }

  const errorEls = {
    title: document.getElementById('error-tx-title'),
    amount: document.getElementById('error-tx-amount'),
    category: document.getElementById('error-tx-category'),
    date: document.getElementById('error-tx-date'),
    description: document.getElementById('error-tx-description'),
  };

  const fieldEls = {
    title: titleInput,
    amount: amountInput,
    category: categorySelect,
    date: dateInput,
    description: descriptionInput,
  };

  function populateCategoryOptions(type, selectedCategory = '') {
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const options = [
      `<option value="">Select category...</option>`,
      ...categories.map(
        (cat) =>
          `<option value="${escapeHtml(cat)}" ${
            selectedCategory === cat ? 'selected' : ''
          }>${escapeHtml(cat)}</option>`
      ),
    ];

    if (selectedCategory && !categories.includes(selectedCategory)) {
      options.push(
        `<option value="${escapeHtml(selectedCategory)}" selected>${escapeHtml(
          selectedCategory
        )}</option>`
      );
    }

    categorySelect.innerHTML = options.join('');
  }

  function setTransactionType(type, preserveCategory = false) {
    const normalized = type === 'income' ? 'income' : 'expense';
    typeInput.value = normalized;
    typeExpenseBtn.classList.toggle('is-active', normalized === 'expense');
    typeIncomeBtn.classList.toggle('is-active', normalized === 'income');

    const currentCat = preserveCategory ? categorySelect.value : '';
    populateCategoryOptions(normalized, currentCat);
    clearFieldError('category');
  }

  function clearAllErrors() {
    Object.keys(errorEls).forEach((key) => clearFieldError(key));
  }

  function clearFieldError(key) {
    if (errorEls[key]) errorEls[key].textContent = '';
    if (fieldEls[key]) fieldEls[key].classList.remove('is-invalid');
  }

  function showValidationErrors(errors) {
    clearAllErrors();
    Object.entries(errors).forEach(([key, msg]) => {
      if (errorEls[key]) errorEls[key].textContent = msg;
      if (fieldEls[key]) fieldEls[key].classList.add('is-invalid');
    });
  }

  function open(txToEdit = null) {
    clearAllErrors();

    if (txToEdit) {
      titleEl.textContent = 'Edit Transaction';
      submitBtn.textContent = 'Update Transaction';
      idInput.value = txToEdit.id;
      setTransactionType(txToEdit.type, false);
      populateCategoryOptions(txToEdit.type, txToEdit.category);
      titleInput.value = txToEdit.title;
      amountInput.value = Number(txToEdit.amount).toFixed(2);
      dateInput.value = txToEdit.date;
      descriptionInput.value = txToEdit.description || '';
    } else {
      titleEl.textContent = 'Add Transaction';
      submitBtn.textContent = 'Save Transaction';
      idInput.value = '';
      setTransactionType('expense', false);
      titleInput.value = '';
      amountInput.value = '';
      dateInput.value = getTodayISO();
      descriptionInput.value = '';
    }

    modal.hidden = false;
    updateBudgetImpactWarning();
    window.setTimeout(() => titleInput.focus(), 30);
  }

  function close() {
    modal.hidden = true;
    form.reset();
    clearAllErrors();
    if (budgetImpactBanner) budgetImpactBanner.style.display = 'none';
  }

  typeExpenseBtn.addEventListener('click', () => {
    setTransactionType('expense');
    updateBudgetImpactWarning();
  });
  typeIncomeBtn.addEventListener('click', () => {
    setTransactionType('income');
    updateBudgetImpactWarning();
  });

  amountInput?.addEventListener('input', updateBudgetImpactWarning);
  categorySelect?.addEventListener('change', updateBudgetImpactWarning);
  dateInput?.addEventListener('change', updateBudgetImpactWarning);

  Object.entries(fieldEls).forEach(([key, el]) => {
    el?.addEventListener('input', () => clearFieldError(key));
    el?.addEventListener('change', () => clearFieldError(key));
  });

  document.getElementById('transaction-modal-close')?.addEventListener('click', close);
  document.getElementById('transaction-modal-cancel')?.addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const payload = {
      id: idInput.value || null,
      type: typeInput.value,
      title: titleInput.value,
      amount: amountInput.value,
      category: categorySelect.value,
      date: dateInput.value,
      description: descriptionInput.value,
    };

    const result = validateTransactionInput(payload);
    if (!result.valid) {
      showValidationErrors(result.errors);
      const firstInvalidKey = Object.keys(result.errors)[0];
      fieldEls[firstInvalidKey]?.focus();
      return;
    }

    onSubmitSuccess({
      id: payload.id,
      type: payload.type,
      title: payload.title.trim(),
      amount: Math.round(Number(payload.amount) * 100) / 100,
      category: payload.category,
      date: payload.date,
      description: payload.description.trim(),
    });

    close();
  });

  return { open, close };
}
