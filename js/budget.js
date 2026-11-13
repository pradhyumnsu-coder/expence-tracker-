/**
 * budget.js
 * ---------------------------------------------------------------------------
 * Pure monthly budget calculations (utilization %, remaining, 80% warning,
 * exceeded alert) and Budget Management view renderer.
 */

import {
  EXPENSE_CATEGORIES,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCategoryColor,
  getMonthKey,
} from './storage.js';

/* ==========================================================================
   Pure Budget Calculations (Storage-Independent)
   ========================================================================== */

export function calculateBudgetStatus(transactions, budgetConfig, monthKey) {
  const monthlyLimit = Math.max(0, Number(budgetConfig?.monthlyLimit) || 0);
  const categoryLimits = budgetConfig?.categoryLimits || {};

  const monthlyExpensesList = transactions.filter(
    (tx) => tx.type === 'expense' && getMonthKey(tx.date) === monthKey
  );

  const monthlySpent = monthlyExpensesList.reduce(
    (sum, tx) => sum + Number(tx.amount || 0),
    0
  );

  const remaining = monthlyLimit - monthlySpent;
  const utilizationPct = monthlyLimit > 0 ? (monthlySpent / monthlyLimit) * 100 : 0;

  let status = 'unset'; // 'unset' | 'normal' | 'warning' | 'exceeded'
  if (monthlyLimit > 0) {
    if (utilizationPct >= 100) {
      status = 'exceeded';
    } else if (utilizationPct >= 80) {
      status = 'warning';
    } else {
      status = 'normal';
    }
  }

  // Per-category spending for the selected month
  const spentByCategory = {};
  monthlyExpensesList.forEach((tx) => {
    spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + Number(tx.amount || 0);
  });

  const categoryTrackers = EXPENSE_CATEGORIES.map((category) => {
    const spent = spentByCategory[category] || 0;
    const limit = Math.max(0, Number(categoryLimits[category]) || 0);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    let catStatus = 'unset';
    if (limit > 0) {
      catStatus = pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'normal';
    }
    return {
      category,
      spent,
      limit,
      remaining: limit - spent,
      utilizationPct: pct,
      status: catStatus,
    };
  }).filter((item) => item.limit > 0 || item.spent > 0);

  return {
    monthKey,
    monthlyLimit,
    monthlySpent,
    remaining,
    utilizationPct,
    status,
    categoryTrackers,
  };
}

export function renderBudgetAlertBanner(budgetStatus, options = {}) {
  const { showManageAction = false } = options;
  if (budgetStatus.status !== 'warning' && budgetStatus.status !== 'exceeded') {
    return '';
  }

  const isExceeded = budgetStatus.status === 'exceeded';
  const monthLabel = formatMonthLabel(budgetStatus.monthKey);
  const pctFormatted = `${budgetStatus.utilizationPct.toFixed(1)}%`;

  const title = isExceeded
    ? `Monthly budget exceeded for ${monthLabel}`
    : `Approaching monthly budget limit (${pctFormatted} used)`;

  const desc = isExceeded
    ? `Spending of ${formatCurrency(budgetStatus.monthlySpent)} has exceeded your ${formatCurrency(
        budgetStatus.monthlyLimit
      )} budget by ${formatCurrency(Math.abs(budgetStatus.remaining))}.`
    : `You have used ${formatCurrency(budgetStatus.monthlySpent)} of your ${formatCurrency(
        budgetStatus.monthlyLimit
      )} budget for ${monthLabel}. ${formatCurrency(budgetStatus.remaining)} remains.`;

  return `
    <div class="status-banner ${isExceeded ? 'is-danger' : 'is-warning'}" role="alert">
      <div class="status-banner-content">
        <i data-lucide="${isExceeded ? 'alert-octagon' : 'alert-triangle'}" aria-hidden="true"></i>
        <div>
          <div class="status-banner-title">${escapeHtml(title)}</div>
          <div class="status-banner-desc">${escapeHtml(desc)}</div>
        </div>
      </div>
      ${
        showManageAction
          ? `<button type="button" class="btn btn-secondary btn-sm" data-nav-target="budget">Review Budget</button>`
          : ''
      }
    </div>
  `;
}

/* ==========================================================================
   Budget Management View Renderer
   ========================================================================== */

export function renderBudgetView(container, transactions, budgetConfig, activeMonth, handlers) {
  const status = calculateBudgetStatus(transactions, budgetConfig, activeMonth);
  const monthLabel = formatMonthLabel(activeMonth);
  const clampedWidth = Math.min(100, Math.max(0, status.utilizationPct)).toFixed(1);

  const barClass =
    status.status === 'exceeded'
      ? 'is-danger'
      : status.status === 'warning'
      ? 'is-warning'
      : '';

  const statusText =
    status.status === 'exceeded'
      ? 'Budget Exceeded'
      : status.status === 'warning'
      ? 'Warning: 80%+ Utilized'
      : status.status === 'normal'
      ? 'On Track'
      : 'No Budget Set';

  container.innerHTML = `
    <div class="section-header-row">
      <div>
        <h2 class="section-heading">Budget Management</h2>
        <p class="section-subtext">
          Configure monthly spending limits and monitor utilization for ${escapeHtml(monthLabel)}.
        </p>
      </div>
    </div>

    ${renderBudgetAlertBanner(status, { showManageAction: false })}

    <div class="budget-grid">
      <!-- Set Monthly Budget Form -->
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Monthly Budget Target</h3>
            <p class="card-subtitle">Applies across all expense categories</p>
          </div>
        </div>
        <form id="monthly-budget-form" class="card-body" novalidate style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group">
            <label for="monthly-budget-input" class="form-label">Monthly Spending Limit</label>
            <div class="input-with-prefix">
              <span class="input-prefix">$</span>
              <input
                type="number"
                id="monthly-budget-input"
                class="form-input has-prefix tabular-nums"
                step="1"
                min="0"
                value="${status.monthlyLimit > 0 ? status.monthlyLimit : ''}"
                placeholder="e.g., 3200"
                required
              />
            </div>
            <p class="form-error" id="error-monthly-budget" role="alert"></p>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span style="font-size:12px;color:var(--text-muted);">
              Alerts trigger automatically at 80% and 100%.
            </span>
            <button type="submit" class="btn btn-primary btn-sm">Save Budget</button>
          </div>
        </form>
      </div>

      <!-- Budget Utilization Overview -->
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${escapeHtml(monthLabel)} Utilization</h3>
            <p class="card-subtitle">Live tracking against recorded expenses</p>
          </div>
          <span class="tabular-nums" style="font-size:12.5px;font-weight:600;color:${
            status.status === 'exceeded'
              ? 'var(--danger)'
              : status.status === 'warning'
              ? 'var(--warning)'
              : status.status === 'normal'
              ? 'var(--success)'
              : 'var(--text-muted)'
          };">${escapeHtml(statusText)}</span>
        </div>

        <div class="card-body">
          ${
            status.monthlyLimit > 0
              ? `
                <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:13px;color:var(--text-secondary);">Utilization Rate</span>
                  <span class="mono-num" style="font-size:20px;font-weight:700;">
                    ${status.utilizationPct.toFixed(1)}%
                  </span>
                </div>
                <div class="progress-track is-lg" role="progressbar" aria-valuenow="${Math.round(
                  status.utilizationPct
                )}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-fill ${barClass}" style="width: ${clampedWidth}%"></div>
                </div>

                <div class="budget-stat-strip">
                  <div>
                    <div class="budget-stat-label">Monthly Budget</div>
                    <div class="budget-stat-value tabular-nums">${formatCurrency(
                      status.monthlyLimit
                    )}</div>
                  </div>
                  <div>
                    <div class="budget-stat-label">Monthly Spent</div>
                    <div class="budget-stat-value tabular-nums">${formatCurrency(
                      status.monthlySpent
                    )}</div>
                  </div>
                  <div>
                    <div class="budget-stat-label">${
                      status.remaining >= 0 ? 'Remaining' : 'Over Budget'
                    }</div>
                    <div class="budget-stat-value tabular-nums" style="color:${
                      status.remaining >= 0 ? 'var(--success)' : 'var(--danger)'
                    }">
                      ${formatCurrency(Math.abs(status.remaining))}
                    </div>
                  </div>
                </div>
                <p style="font-size:12.5px;color:var(--text-muted);">
                  ${
                    status.remaining >= 0
                      ? `You can spend up to ${formatCurrency(
                          status.remaining
                        )} more in ${escapeHtml(monthLabel)} before reaching your limit.`
                      : `Expenses have exceeded your ${formatCurrency(
                          status.monthlyLimit
                        )} target by ${formatCurrency(Math.abs(status.remaining))}.`
                  }
                </p>
              `
              : `
                <div class="empty-state" style="padding:28px 16px;">
                  <div class="empty-state-icon">
                    <i data-lucide="wallet" aria-hidden="true"></i>
                  </div>
                  <h4 class="empty-state-title">No monthly budget set</h4>
                  <p class="empty-state-desc">
                    Enter a monthly limit on the left to track utilization and receive 80% and 100% spending alerts.
                  </p>
                </div>
              `
          }
        </div>
      </div>
    </div>

    <!-- Category-Level Budget Allocations -->
    <div class="surface-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Category Limits (${escapeHtml(monthLabel)})</h3>
          <p class="card-subtitle">Optional monthly caps per expense category</p>
        </div>
      </div>
      <form id="category-budgets-form" class="card-body">
        <div class="category-budget-list">
          ${EXPENSE_CATEGORIES.map((category) => {
            const tracker = status.categoryTrackers.find((t) => t.category === category) || {
              category,
              spent: 0,
              limit: Number(budgetConfig?.categoryLimits?.[category]) || 0,
              utilizationPct: 0,
              status: 'unset',
            };
            const width = tracker.limit > 0 ? Math.min(100, tracker.utilizationPct).toFixed(1) : 0;
            const fillCls =
              tracker.status === 'exceeded'
                ? 'is-danger'
                : tracker.status === 'warning'
                ? 'is-warning'
                : '';

            return `
              <div class="category-budget-row">
                <div class="category-budget-top">
                  <div class="breakdown-name-wrap">
                    <span class="color-swatch" style="background:${getCategoryColor(category)}"></span>
                    <span style="font-weight:500;">${escapeHtml(category)}</span>
                  </div>
                  <span class="tabular-nums" style="color:var(--text-secondary);">
                    Spent: <strong>${formatCurrency(tracker.spent)}</strong>
                    ${
                      tracker.limit > 0
                        ? ` / ${formatCurrency(tracker.limit)} (${tracker.utilizationPct.toFixed(0)}%)`
                        : ' (No cap)'
                    }
                  </span>
                </div>
                <div class="category-budget-input-row">
                  <div class="progress-track">
                    <div class="progress-fill ${fillCls}" style="width:${width}%"></div>
                  </div>
                  <div class="input-with-prefix">
                    <span class="input-prefix">$</span>
                    <input
                      type="number"
                      class="form-input has-prefix tabular-nums"
                      style="height:32px;font-size:12.5px;"
                      data-cat-limit="${escapeHtml(category)}"
                      min="0"
                      step="1"
                      placeholder="No limit"
                      value="${tracker.limit > 0 ? tracker.limit : ''}"
                      aria-label="${escapeHtml(category)} monthly budget limit"
                    />
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;">
          <button type="submit" class="btn btn-secondary btn-sm">Save Category Limits</button>
        </div>
      </form>
    </div>

    <!-- Local Ledger Data Controls -->
    <div class="surface-card">
      <div class="card-body data-management-row">
        <div>
          <h3 class="card-title">Local Data Storage</h3>
          <p class="card-subtitle">
            All transactions and budgets are persisted locally in your browser's LocalStorage.
          </p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" id="reset-sample-data-btn">
            Load Sample Data
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="clear-all-data-btn" style="color:var(--danger);">
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind Budget Handlers
  const monthlyForm = container.querySelector('#monthly-budget-form');
  const monthlyInput = container.querySelector('#monthly-budget-input');
  const monthlyErr = container.querySelector('#error-monthly-budget');

  monthlyInput?.addEventListener('input', () => {
    monthlyErr.textContent = '';
    monthlyInput.classList.remove('is-invalid');
  });

  monthlyForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = Number(monthlyInput.value);
    if (!monthlyInput.value || !Number.isFinite(val) || val <= 0) {
      monthlyErr.textContent = 'Please enter a valid monthly budget greater than zero.';
      monthlyInput.classList.add('is-invalid');
      monthlyInput.focus();
      return;
    }
    handlers.onSaveMonthlyBudget(Math.round(val * 100) / 100);
  });

  const catForm = container.querySelector('#category-budgets-form');
  catForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nextLimits = {};
    catForm.querySelectorAll('[data-cat-limit]').forEach((input) => {
      const cat = input.getAttribute('data-cat-limit');
      const val = Number(input.value);
      if (input.value !== '' && Number.isFinite(val) && val > 0) {
        nextLimits[cat] = Math.round(val * 100) / 100;
      }
    });
    handlers.onSaveCategoryBudgets(nextLimits);
  });

  container.querySelector('#reset-sample-data-btn')?.addEventListener('click', () => {
    handlers.onResetSampleData();
  });

  container.querySelector('#clear-all-data-btn')?.addEventListener('click', () => {
    handlers.onClearAllData();
  });
}
