/**
 * analytics.js
 * ---------------------------------------------------------------------------
 * Pure expense analytics calculations (category breakdown, monthly income vs
 * expenses, spending distribution, highest spending category, total savings)
 * and Analytics view + Chart.js rendering.
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
  getCategoryColor,
  getMonthKey,
} from './storage.js';

let incomeVsExpenseChart = null;
let categoryBarChart = null;
let distributionChart = null;

/* ==========================================================================
   Pure Analytics Calculations (Storage-Independent)
   ========================================================================== */

export function filterByAnalyticsPeriod(transactions, period, activeMonth) {
  if (period === 'month') {
    return transactions.filter((tx) => getMonthKey(tx.date) === activeMonth);
  }
  if (period === '6m') {
    const [y, m] = activeMonth.split('-').map(Number);
    const start = new Date(y, m - 6, 1);
    const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    return transactions.filter((tx) => {
      const k = getMonthKey(tx.date);
      return k >= startKey && k <= activeMonth;
    });
  }
  return transactions;
}

export function calculateAnalyticsData(transactions, period, activeMonth) {
  const scoped = filterByAnalyticsPeriod(transactions, period, activeMonth);

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = {};
  const monthMap = {};

  scoped.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    const monthKey = getMonthKey(tx.date);

    if (monthKey) {
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { income: 0, expense: 0 };
      }
      monthMap[monthKey][tx.type === 'income' ? 'income' : 'expense'] += amount;
    }

    if (tx.type === 'income') {
      totalIncome += amount;
    } else if (tx.type === 'expense') {
      totalExpenses += amount;
      if (!categoryMap[tx.category]) {
        categoryMap[tx.category] = { amount: 0, count: 0 };
      }
      categoryMap[tx.category].amount += amount;
      categoryMap[tx.category].count += 1;
    }
  });

  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  const categories = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
      percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      color: getCategoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestCategory = categories.length > 0 ? categories[0] : null;

  const sortedMonthKeys = Object.keys(monthMap).sort();
  const monthlyComparison = {
    labels: sortedMonthKeys.map(formatShortMonthLabel),
    income: sortedMonthKeys.map((k) => Math.round(monthMap[k].income * 100) / 100),
    expenses: sortedMonthKeys.map((k) => Math.round(monthMap[k].expense * 100) / 100),
    netSavings: sortedMonthKeys.map(
      (k) => Math.round((monthMap[k].income - monthMap[k].expense) * 100) / 100
    ),
  };

  const expenseCount = scoped.filter((t) => t.type === 'expense').length;
  const avgExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

  return {
    scopedCount: scoped.length,
    totalIncome,
    totalExpenses,
    totalSavings,
    savingsRate,
    avgExpense,
    highestCategory,
    categories,
    monthlyComparison,
  };
}

/* ==========================================================================
   Chart Rendering Helpers
   ========================================================================== */

export function destroyAnalyticsCharts() {
  if (incomeVsExpenseChart) {
    incomeVsExpenseChart.destroy();
    incomeVsExpenseChart = null;
  }
  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }
  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }
}

function renderMonthlyIncomeVsExpenseChart(canvas, monthlyComparison) {
  if (!canvas || typeof window.Chart === 'undefined') return;
  if (incomeVsExpenseChart) incomeVsExpenseChart.destroy();

  incomeVsExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: monthlyComparison.labels,
      datasets: [
        {
          label: 'Income',
          data: monthlyComparison.income,
          backgroundColor: '#16A34A',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: monthlyComparison.expenses,
          backgroundColor: '#DC2626',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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
          ticks: { color: '#64748B', font: { family: "'DM Sans', sans-serif", size: 12 } },
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

function renderCategoryWiseBarChart(canvas, categories) {
  if (!canvas || typeof window.Chart === 'undefined' || categories.length === 0) return;
  if (categoryBarChart) categoryBarChart.destroy();

  categoryBarChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          label: 'Total Spent',
          data: categories.map((c) => c.amount),
          backgroundColor: categories.map((c) => c.color),
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(ctx) {
              const cat = categories[ctx.dataIndex];
              return ` ${formatCurrency(cat.amount)} (${cat.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          border: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback(val) {
              return `$${val}`;
            },
          },
        },
        y: {
          grid: { display: false },
          border: { color: '#E2E8F0' },
          ticks: {
            color: '#0F172A',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
      },
    },
  });
}

function renderSpendingDistributionChart(canvas, categories) {
  if (!canvas || typeof window.Chart === 'undefined' || categories.length === 0) return;
  if (distributionChart) distributionChart.destroy();

  distributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          data: categories.map((c) => c.amount),
          backgroundColor: categories.map((c) => c.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(ctx) {
              const cat = categories[ctx.dataIndex];
              return ` ${cat.category}: ${formatCurrency(cat.amount)} (${cat.percentage.toFixed(
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
   Analytics View Renderer
   ========================================================================== */

export function renderAnalyticsView(container, transactions, state, handlers) {
  const { analyticsPeriod, activeMonth } = state;
  const analytics = calculateAnalyticsData(transactions, analyticsPeriod, activeMonth);
  const monthLabel = formatMonthLabel(activeMonth);

  const periodLabel =
    analyticsPeriod === 'month'
      ? monthLabel
      : analyticsPeriod === '6m'
      ? `Last 6 Months (to ${monthLabel})`
      : 'All Time';

  container.innerHTML = `
    <div class="section-header-row">
      <div>
        <h2 class="section-heading">Expense Analytics</h2>
        <p class="section-subtext">
          Category spending distribution, monthly cash flow, and net savings for ${escapeHtml(
            periodLabel
          )}.
        </p>
      </div>
      <div class="segmented-control" role="group" aria-label="Analytics timeframe">
        <button type="button" class="segmented-btn ${
          analyticsPeriod === 'all' ? 'is-active' : ''
        }" data-analytics-period="all">All Time</button>
        <button type="button" class="segmented-btn ${
          analyticsPeriod === '6m' ? 'is-active' : ''
        }" data-analytics-period="6m">6 Months</button>
        <button type="button" class="segmented-btn ${
          analyticsPeriod === 'month' ? 'is-active' : ''
        }" data-analytics-period="month">${escapeHtml(monthLabel)}</button>
      </div>
    </div>

    <!-- Key Analytics Metrics -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Savings</span>
          <i data-lucide="piggy-bank" style="width:15px;height:15px;color:var(--success);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums ${
          analytics.totalSavings >= 0 ? 'is-positive' : 'is-negative'
        }">${formatCurrency(analytics.totalSavings)}</div>
        <div class="kpi-meta tabular-nums">
          Savings rate: ${analytics.savingsRate.toFixed(1)}%
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Highest Spending Category</span>
          <i data-lucide="award" style="width:15px;height:15px;color:var(--accent);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value" style="font-size:20px;">
          ${analytics.highestCategory ? escapeHtml(analytics.highestCategory.category) : '—'}
        </div>
        <div class="kpi-meta tabular-nums">
          ${
            analytics.highestCategory
              ? `${formatCurrency(
                  analytics.highestCategory.amount
                )} · ${analytics.highestCategory.percentage.toFixed(1)}% of expenses`
              : 'No expenses in range'
          }
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Period Income</span>
          <i data-lucide="arrow-down-left" style="width:15px;height:15px;color:var(--success);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatCurrency(analytics.totalIncome)}</div>
        <div class="kpi-meta tabular-nums">
          Expenses: ${formatCurrency(analytics.totalExpenses)}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Average Expense</span>
          <i data-lucide="calculator" style="width:15px;height:15px;color:var(--text-muted);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatCurrency(analytics.avgExpense)}</div>
        <div class="kpi-meta tabular-nums">
          Across ${analytics.scopedCount} transaction${analytics.scopedCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>

    ${
      analytics.scopedCount === 0
        ? `
          <div class="surface-card">
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="bar-chart-3" aria-hidden="true"></i>
              </div>
              <h3 class="empty-state-title">No analytics data for this period</h3>
              <p class="empty-state-desc">
                Add transactions or switch the timeframe selector above to inspect spending trends.
              </p>
              <button type="button" class="btn btn-primary btn-sm" id="analytics-empty-add-btn">
                <i data-lucide="plus" aria-hidden="true"></i>
                <span>Add Transaction</span>
              </button>
            </div>
          </div>
        `
        : `
          <!-- Analytics Charts Grid -->
          <div class="analytics-charts-grid">
            <div class="surface-card analytics-span-full">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Monthly Income vs. Expenses</h3>
                  <p class="card-subtitle">Chronological comparison of monthly inflows and outflows</p>
                </div>
              </div>
              <div class="card-body">
                <div class="chart-canvas-wrap is-tall">
                  <canvas id="analytics-income-expense-chart" aria-label="Monthly income versus expenses chart"></canvas>
                </div>
              </div>
            </div>

            <div class="surface-card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Category-Wise Expense Breakdown</h3>
                  <p class="card-subtitle">Ranked from highest to lowest spend</p>
                </div>
              </div>
              <div class="card-body">
                ${
                  analytics.categories.length > 0
                    ? `<div class="chart-canvas-wrap is-tall"><canvas id="analytics-category-bar-chart" aria-label="Category-wise expense breakdown chart"></canvas></div>`
                    : `<div class="empty-state" style="padding:36px 16px;"><p class="empty-state-desc">No expense records in this period.</p></div>`
                }
              </div>
            </div>

            <div class="surface-card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Spending Distribution</h3>
                  <p class="card-subtitle">Share of total expenses (${formatCurrency(
                    analytics.totalExpenses
                  )})</p>
                </div>
              </div>
              <div class="card-body">
                ${
                  analytics.categories.length > 0
                    ? `
                      <div class="category-breakdown-layout">
                        <div class="doughnut-wrap">
                          <canvas id="analytics-distribution-chart" aria-label="Spending distribution doughnut chart"></canvas>
                        </div>
                        <ul class="breakdown-list">
                          ${analytics.categories
                            .map(
                              (item) => `
                                <li class="breakdown-row">
                                  <div class="breakdown-name-wrap">
                                    <span class="color-swatch" style="background:${item.color}"></span>
                                    <span class="breakdown-name">${escapeHtml(item.category)}</span>
                                  </div>
                                  <div class="breakdown-figures tabular-nums">
                                    <span class="breakdown-amount">${formatCurrency(item.amount)}</span>
                                    <span class="breakdown-pct">${item.percentage.toFixed(1)}%</span>
                                  </div>
                                </li>
                              `
                            )
                            .join('')}
                        </ul>
                      </div>
                    `
                    : `<div class="empty-state" style="padding:36px 16px;"><p class="empty-state-desc">No expense records in this period.</p></div>`
                }
              </div>
            </div>
          </div>

          <!-- Detailed Category Summary Table -->
          ${
            analytics.categories.length > 0
              ? `
                <div class="surface-card">
                  <div class="card-header">
                    <div>
                      <h3 class="card-title">Category Breakdown Table</h3>
                      <p class="card-subtitle">Exact expenditure counts and percentage weights</p>
                    </div>
                  </div>
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th class="th-right">Transactions</th>
                          <th class="th-right">Total Spent</th>
                          <th class="th-right">Share</th>
                          <th style="width:180px;">Distribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${analytics.categories
                          .map(
                            (item) => `
                              <tr>
                                <td>
                                  <div class="breakdown-name-wrap">
                                    <span class="color-swatch" style="background:${item.color}"></span>
                                    <span style="font-weight:500;">${escapeHtml(item.category)}</span>
                                  </div>
                                </td>
                                <td class="td-right tabular-nums tx-meta-text">${item.count}</td>
                                <td class="td-right tabular-nums" style="font-weight:600;">${formatCurrency(
                                  item.amount
                                )}</td>
                                <td class="td-right tabular-nums tx-meta-text">${item.percentage.toFixed(
                                  1
                                )}%</td>
                                <td>
                                  <div class="progress-track">
                                    <div class="progress-fill" style="width:${item.percentage.toFixed(
                                      1
                                    )}%;background-color:${item.color};"></div>
                                  </div>
                                </td>
                              </tr>
                            `
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `
              : ''
          }
        `
    }
  `;

  // Render charts
  if (analytics.scopedCount > 0) {
    renderMonthlyIncomeVsExpenseChart(
      container.querySelector('#analytics-income-expense-chart'),
      analytics.monthlyComparison
    );
    if (analytics.categories.length > 0) {
      renderCategoryWiseBarChart(
        container.querySelector('#analytics-category-bar-chart'),
        analytics.categories
      );
      renderSpendingDistributionChart(
        container.querySelector('#analytics-distribution-chart'),
        analytics.categories
      );
    }
  }

  // Bind period selector & empty CTA
  container.querySelectorAll('[data-analytics-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onPeriodChange(btn.getAttribute('data-analytics-period'));
    });
  });

  container.querySelector('#analytics-empty-add-btn')?.addEventListener('click', () => {
    handlers.onAddClick();
  });
}
