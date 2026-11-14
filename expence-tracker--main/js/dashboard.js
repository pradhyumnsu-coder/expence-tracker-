/**
 * dashboard.js
 * ---------------------------------------------------------------------------
 * Pure dashboard KPI calculations and Dashboard view rendering + Chart.js
 * visualizations (Monthly Spending Overview & Expense Category Breakdown).
 */

import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  formatShortMonthLabel,
  getCategoryColor,
  getMonthKey,
} from './storage.js';
import { calculateBudgetStatus, renderBudgetAlertBanner } from './budget.js';

let monthlyOverviewChart = null;
let categoryBreakdownChart = null;

/* ==========================================================================
   Pure Dashboard Calculations (Storage-Independent)
   ========================================================================== */

export function calculateDashboardMetrics(transactions, activeMonth) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlySpending = 0;
  let monthlyIncome = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    const txMonth = getMonthKey(tx.date);

    if (tx.type === 'income') {
      totalIncome += amount;
      incomeCount += 1;
      if (txMonth === activeMonth) {
        monthlyIncome += amount;
      }
    } else if (tx.type === 'expense') {
      totalExpenses += amount;
      expenseCount += 1;
      if (txMonth === activeMonth) {
        monthlySpending += amount;
      }
    }
  });

  // Total Balance = Total Income - Total Expenses
  const totalBalance = totalIncome - totalExpenses;

  return {
    totalBalance,
    totalIncome,
    totalExpenses,
    monthlySpending,
    monthlyIncome,
    incomeCount,
    expenseCount,
  };
}

export function buildMonthlySpendingSeries(transactions, activeMonth, monthCount = 6) {
  const [y, m] = activeMonth.split('-').map(Number);
  const monthKeys = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
  }

  const incomeMap = {};
  const expenseMap = {};
  monthKeys.forEach((k) => {
    incomeMap[k] = 0;
    expenseMap[k] = 0;
  });

  transactions.forEach((tx) => {
    const key = getMonthKey(tx.date);
    if (key in expenseMap) {
      if (tx.type === 'income') {
        incomeMap[key] += Number(tx.amount) || 0;
      } else {
        expenseMap[key] += Number(tx.amount) || 0;
      }
    }
  });

  return {
    labels: monthKeys.map(formatShortMonthLabel),
    incomeSeries: monthKeys.map((k) => Math.round(incomeMap[k] * 100) / 100),
    expenseSeries: monthKeys.map((k) => Math.round(expenseMap[k] * 100) / 100),
  };
}

export function buildCategoryBreakdown(transactions, activeMonth) {
  const expenses = transactions.filter(
    (tx) => tx.type === 'expense' && getMonthKey(tx.date) === activeMonth
  );
  // Fall back to all expenses if the selected month has zero expenses but ledger has expenses
  const targetExpenses =
    expenses.length > 0 ? expenses : transactions.filter((tx) => tx.type === 'expense');

  const isMonthly = expenses.length > 0;
  const totals = {};
  let grandTotal = 0;

  targetExpenses.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    totals[tx.category] = (totals[tx.category] || 0) + amt;
    grandTotal += amt;
  });

  const items = Object.entries(totals)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
      color: getCategoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    items,
    grandTotal,
    isMonthly,
  };
}

export function getRecentTransactions(transactions, limit = 6) {
  return [...transactions]
    .sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return cmp !== 0 ? cmp : String(b.id).localeCompare(String(a.id));
    })
    .slice(0, limit);
}

/* ==========================================================================
   Chart Rendering Helpers
   ========================================================================== */

export function destroyDashboardCharts() {
  if (monthlyOverviewChart) {
    monthlyOverviewChart.destroy();
    monthlyOverviewChart = null;
  }
  if (categoryBreakdownChart) {
    categoryBreakdownChart.destroy();
    categoryBreakdownChart = null;
  }
}

function renderMonthlyOverviewChart(canvas, series) {
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (monthlyOverviewChart) {
    monthlyOverviewChart.destroy();
  }

  monthlyOverviewChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeSeries,
          backgroundColor: '#16A34A',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#1D4ED8',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(ctx) {
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: '#E2E8F0' },
          ticks: {
            color: '#64748B',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          border: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback(val) {
              if (val >= 1000) return `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
              return `$${val}`;
            },
          },
        },
      },
    },
  });
}

function renderCategoryDoughnut(canvas, items) {
  if (!canvas || typeof window.Chart === 'undefined' || items.length === 0) return;

  if (categoryBreakdownChart) {
    categoryBreakdownChart.destroy();
  }

  categoryBreakdownChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.category),
      datasets: [
        {
          data: items.map((i) => i.amount),
          backgroundColor: items.map((i) => i.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(ctx) {
              const item = items[ctx.dataIndex];
              return ` ${item.category}: ${formatCurrency(item.amount)} (${item.percentage.toFixed(
                1
              )}%)`;
            },
          },
        },
      },
    },
  });
}

/* ==========================================================================
   Dashboard View Renderer
   ========================================================================== */

export function renderDashboardView(container, transactions, budgetConfig, activeMonth, handlers) {
  const metrics = calculateDashboardMetrics(transactions, activeMonth);
  const budgetStatus = calculateBudgetStatus(transactions, budgetConfig, activeMonth);
  const monthlySeries = buildMonthlySpendingSeries(transactions, activeMonth, 6);
  const categoryBreakdown = buildCategoryBreakdown(transactions, activeMonth);
  const recent = getRecentTransactions(transactions, 6);
  const monthLabel = formatMonthLabel(activeMonth);

  const budgetSubtext =
    budgetStatus.monthlyLimit > 0
      ? `${budgetStatus.utilizationPct.toFixed(1)}% of ${formatCurrency(
          budgetStatus.monthlyLimit
        )} budget`
      : `No budget set for ${monthLabel}`;

  container.innerHTML = `
    ${renderBudgetAlertBanner(budgetStatus, { showManageAction: true })}

    <!-- Summary KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Balance</span>
          <i data-lucide="landmark" style="width:15px;height:15px;color:var(--text-muted);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums ${
          metrics.totalBalance < 0 ? 'is-negative' : ''
        }">${formatCurrency(metrics.totalBalance)}</div>
        <div class="kpi-meta tabular-nums">
          Net of income minus expenses
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Income</span>
          <i data-lucide="trending-up" style="width:15px;height:15px;color:var(--success);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value is-positive tabular-nums">${formatCurrency(metrics.totalIncome)}</div>
        <div class="kpi-meta tabular-nums">
          ${metrics.incomeCount} recorded inflow${metrics.incomeCount === 1 ? '' : 's'}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Expenses</span>
          <i data-lucide="trending-down" style="width:15px;height:15px;color:var(--text-muted);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatCurrency(metrics.totalExpenses)}</div>
        <div class="kpi-meta tabular-nums">
          ${metrics.expenseCount} recorded outflow${metrics.expenseCount === 1 ? '' : 's'}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Monthly Spending</span>
          <i data-lucide="calendar" style="width:15px;height:15px;color:var(--accent);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatCurrency(metrics.monthlySpending)}</div>
        <div class="kpi-meta tabular-nums">
          ${escapeHtml(monthLabel)} · ${escapeHtml(budgetSubtext)}
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="dashboard-charts-grid">
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Monthly Spending Overview</h2>
            <p class="card-subtitle">6-month income vs. expense cash flow ending ${escapeHtml(
              monthLabel
            )}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-nav-target="analytics">
            Full Analytics
          </button>
        </div>
        <div class="card-body">
          ${
            transactions.length > 0
              ? `<div class="chart-canvas-wrap"><canvas id="dashboard-monthly-chart" aria-label="Monthly spending overview chart"></canvas></div>`
              : `<div class="empty-state" style="padding:36px 16px;">
                  <p class="empty-state-desc">Add income or expense entries to plot your 6-month overview.</p>
                </div>`
          }
        </div>
      </div>

      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Expense Category Breakdown</h2>
            <p class="card-subtitle">${
              categoryBreakdown.isMonthly
                ? `${escapeHtml(monthLabel)} spending share`
                : 'All-time expense share'
            }</p>
          </div>
        </div>
        <div class="card-body">
          ${
            categoryBreakdown.items.length > 0
              ? `
                <div class="category-breakdown-layout">
                  <div class="doughnut-wrap">
                    <canvas id="dashboard-category-chart" aria-label="Expense category breakdown chart"></canvas>
                  </div>
                  <ul class="breakdown-list">
                    ${categoryBreakdown.items
                      .slice(0, 6)
                      .map(
                        (item) => `
                          <li class="breakdown-row">
                            <div class="breakdown-name-wrap">
                              <span class="color-swatch" style="background:${item.color}"></span>
                              <span class="breakdown-name">${escapeHtml(item.category)}</span>
                            </div>
                            <div class="breakdown-figures tabular-nums">
                              <span class="breakdown-amount">${formatCurrency(item.amount)}</span>
                              <span class="breakdown-pct">${item.percentage.toFixed(0)}%</span>
                            </div>
                          </li>
                        `
                      )
                      .join('')}
                  </ul>
                </div>
              `
              : `
                <div class="empty-state" style="padding:36px 16px;">
                  <p class="empty-state-desc">No expenses logged yet for category breakdown.</p>
                </div>
              `
          }
        </div>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="surface-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Recent Transactions</h2>
          <p class="card-subtitle">Latest activity across all accounts</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-nav-target="transactions">
          View All Transactions
        </button>
      </div>

      ${
        recent.length > 0
          ? `
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th class="th-right">Amount</th>
                    <th class="th-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  ${recent
                    .map((tx) => {
                      const isIncome = tx.type === 'income';
                      const signed = isIncome
                        ? formatCurrency(tx.amount, { showSign: true })
                        : formatCurrency(-Number(tx.amount));
                      return `
                        <tr>
                          <td class="tx-meta-text tabular-nums">${escapeHtml(
                            formatDate(tx.date)
                          )}</td>
                          <td>
                            <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                            ${
                              tx.description
                                ? `<div class="tx-desc-sub">${escapeHtml(tx.description)}</div>`
                                : ''
                            }
                          </td>
                          <td class="tx-meta-text">${escapeHtml(tx.category)}</td>
                          <td class="td-right tx-amount tabular-nums ${
                            isIncome ? 'is-income' : 'is-expense'
                          }">${escapeHtml(signed)}</td>
                          <td class="td-right">
                            <button
                              type="button"
                              class="icon-btn"
                              data-dashboard-edit="${escapeHtml(tx.id)}"
                              aria-label="Edit ${escapeHtml(tx.title)}"
                            >
                              <i data-lucide="pencil" aria-hidden="true"></i>
                            </button>
                          </td>
                        </tr>
                      `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : `
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="receipt" aria-hidden="true"></i>
              </div>
              <h3 class="empty-state-title">Your ledger is empty</h3>
              <p class="empty-state-desc">
                Add your first income or expense transaction to populate your dashboard metrics and charts.
              </p>
              <button type="button" class="btn btn-primary btn-sm" id="dashboard-empty-add-btn">
                <i data-lucide="plus" aria-hidden="true"></i>
                <span>Add Transaction</span>
              </button>
            </div>
          `
      }
    </div>
  `;

  // Initialize Chart.js instances
  if (transactions.length > 0) {
    renderMonthlyOverviewChart(
      container.querySelector('#dashboard-monthly-chart'),
      monthlySeries
    );
  }
  if (categoryBreakdown.items.length > 0) {
    renderCategoryDoughnut(
      container.querySelector('#dashboard-category-chart'),
      categoryBreakdown.items
    );
  }

  // Bind navigation & actions
  container.querySelectorAll('[data-nav-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onNavigate(btn.getAttribute('data-nav-target'));
    });
  });

  container.querySelectorAll('[data-dashboard-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onEditClick(btn.getAttribute('data-dashboard-edit'));
    });
  });

  container.querySelector('#dashboard-empty-add-btn')?.addEventListener('click', () => {
    handlers.onAddClick();
  });
}
