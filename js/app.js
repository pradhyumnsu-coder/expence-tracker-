/**
 * app.js
 * ---------------------------------------------------------------------------
 * Application controller: coordinates view routing, global state, reporting
 * month selection, modal dialogs, sidebar responsiveness, and toast feedback.
 */

import {
  clearAllData,
  deleteTransaction,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getBudget,
  getCurrentMonthKey,
  getMonthKey,
  getTransactions,
  initializeStorage,
  resetToSampleData,
  saveBudget,
  saveTransaction,
  updateTransaction,
} from './storage.js';
import {
  createTransactionModalController,
  renderTransactionsView,
} from './transactions.js';
import { destroyDashboardCharts, renderDashboardView } from './dashboard.js';
import { destroyAnalyticsCharts, renderAnalyticsView } from './analytics.js';
import { calculateBudgetStatus, renderBudgetView } from './budget.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

const state = {
  activeView: 'dashboard',
  activeMonth: getCurrentMonthKey(),
  analyticsPeriod: 'all',
  filters: {
    search: '',
    type: 'all',
    category: 'all',
    monthScope: 'all',
    sortBy: 'date-desc',
  },
};

let txModal = null;
let confirmActionCallback = null;

/* ==========================================================================
   Toast & Confirmation Dialog Helpers
   ========================================================================== */

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : ''}`;
  toast.innerHTML = `
    <i data-lucide="${variant === 'error' ? 'alert-circle' : 'check-circle-2'}" aria-hidden="true"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  refreshIcons();

  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 150ms ease, transform 150ms ease';
    window.setTimeout(() => toast.remove(), 160);
  }, 2800);
}

function openConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const messageEl = document.getElementById('confirm-modal-message');
  const confirmBtn = document.getElementById('confirm-modal-confirm');

  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmBtn.textContent = confirmLabel;
  confirmActionCallback = onConfirm;
  modal.hidden = false;
  confirmBtn.focus();
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.hidden = true;
  confirmActionCallback = null;
}

function refreshIcons() {
  if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/* ==========================================================================
   Month Selector & Sidebar Budget Widget
   ========================================================================== */

function populateMonthSelector(transactions) {
  const select = document.getElementById('global-month-select');
  if (!select) return;

  const currentMonth = getCurrentMonthKey();
  const monthSet = new Set([currentMonth, state.activeMonth]);

  // Include last 6 months by default
  const [cy, cm] = currentMonth.split('-').map(Number);
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(cy, cm - 1 - i, 1);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Include any month present in transactions
  transactions.forEach((tx) => {
    const key = getMonthKey(tx.date);
    if (/^\d{4}-\d{2}$/.test(key)) {
      monthSet.add(key);
    }
  });

  const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  select.innerHTML = sortedMonths
    .map(
      (key) =>
        `<option value="${escapeHtml(key)}" ${
          key === state.activeMonth ? 'selected' : ''
        }>${escapeHtml(formatMonthLabel(key))}</option>`
    )
    .join('');
}

function updateSidebarBudgetSummary(transactions, budgetConfig) {
  const pctEl = document.getElementById('sidebar-budget-pct');
  const barEl = document.getElementById('sidebar-budget-bar');
  const metaEl = document.getElementById('sidebar-budget-meta');
  if (!pctEl || !barEl || !metaEl) return;

  const status = calculateBudgetStatus(transactions, budgetConfig, state.activeMonth);
  if (status.monthlyLimit <= 0) {
    pctEl.textContent = '—';
    barEl.style.width = '0%';
    barEl.className = 'progress-fill';
    metaEl.textContent = 'No budget configured';
    return;
  }

  const clamped = Math.min(100, Math.max(0, status.utilizationPct)).toFixed(1);
  pctEl.textContent = `${status.utilizationPct.toFixed(0)}%`;
  barEl.style.width = `${clamped}%`;
  barEl.className = `progress-fill ${
    status.status === 'exceeded'
      ? 'is-danger'
      : status.status === 'warning'
      ? 'is-warning'
      : ''
  }`;

  metaEl.textContent = `${formatCurrency(status.monthlySpent)} of ${formatCurrency(
    status.monthlyLimit
  )}`;
}

/* ==========================================================================
   View Rendering & Navigation
   ========================================================================== */

function setActiveView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  state.activeView = viewName;

  document.querySelectorAll('.nav-item[data-nav]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-nav') === viewName;
    btn.classList.toggle('is-active', isMatch);
    if (isMatch) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  const titleEl = document.getElementById('topbar-view-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[viewName];
  }

  document.querySelectorAll('.view-section').forEach((sec) => {
    const match = sec.id === `view-${viewName}`;
    sec.hidden = !match;
    sec.classList.toggle('is-active', match);
  });

  closeMobileSidebar();
  renderCurrentView();
}

function renderCurrentView(options = {}) {
  const { preserveSearchFocus = false } = options;

  let searchSelectionStart = null;
  let searchSelectionEnd = null;
  if (preserveSearchFocus && document.activeElement?.id === 'tx-search-input') {
    searchSelectionStart = document.activeElement.selectionStart;
    searchSelectionEnd = document.activeElement.selectionEnd;
  }

  const transactions = getTransactions();
  const budgetConfig = getBudget();

  populateMonthSelector(transactions);
  updateSidebarBudgetSummary(transactions, budgetConfig);

  if (state.activeView !== 'dashboard') {
    destroyDashboardCharts();
  }
  if (state.activeView !== 'analytics') {
    destroyAnalyticsCharts();
  }

  if (state.activeView === 'dashboard') {
    const container = document.getElementById('view-dashboard');
    renderDashboardView(container, transactions, budgetConfig, state.activeMonth, {
      onNavigate: (target) => setActiveView(target),
      onAddClick: () => txModal.open(null),
      onEditClick: (id) => {
        const tx = transactions.find((item) => item.id === id);
        if (tx) txModal.open(tx);
      },
    });
  } else if (state.activeView === 'transactions') {
    const container = document.getElementById('view-transactions');
    renderTransactionsView(container, transactions, state, {
      onFilterChange: (patch) => {
        const isSearchUpdate = 'search' in patch && Object.keys(patch).length === 1;
        state.filters = { ...state.filters, ...patch };
        renderCurrentView({ preserveSearchFocus: isSearchUpdate });
      },
      onAddClick: () => txModal.open(null),
      onEditClick: (id) => {
        const tx = transactions.find((item) => item.id === id);
        if (tx) txModal.open(tx);
      },
      onDeleteClick: (id) => {
        const tx = transactions.find((item) => item.id === id);
        if (!tx) return;
        openConfirmModal({
          title: 'Delete Transaction',
          message: `Remove "${tx.title}" (${formatCurrency(
            tx.amount
          )}) from your transaction history? This action cannot be undone.`,
          confirmLabel: 'Delete Transaction',
          onConfirm: () => {
            deleteTransaction(id);
            showToast('Transaction deleted');
            renderCurrentView();
          },
        });
      },
    });

    if (preserveSearchFocus) {
      const searchEl = document.getElementById('tx-search-input');
      if (searchEl) {
        searchEl.focus();
        if (searchSelectionStart !== null) {
          searchEl.setSelectionRange(searchSelectionStart, searchSelectionEnd);
        }
      }
    }
  } else if (state.activeView === 'analytics') {
    const container = document.getElementById('view-analytics');
    renderAnalyticsView(container, transactions, state, {
      onPeriodChange: (period) => {
        state.analyticsPeriod = period;
        renderCurrentView();
      },
      onAddClick: () => txModal.open(null),
    });
  } else if (state.activeView === 'budget') {
    const container = document.getElementById('view-budget');
    renderBudgetView(container, transactions, budgetConfig, state.activeMonth, {
      onSaveMonthlyBudget: (monthlyLimit) => {
        saveBudget({ monthlyLimit });
        showToast('Monthly budget updated');
        renderCurrentView();
      },
      onSaveCategoryBudgets: (categoryLimits) => {
        saveBudget({ categoryLimits });
        showToast('Category limits saved');
        renderCurrentView();
      },
      onResetSampleData: () => {
        openConfirmModal({
          title: 'Load Sample Data',
          message:
            'Replace your current ledger with sample transactions and default monthly budget limits?',
          confirmLabel: 'Load Sample Data',
          onConfirm: () => {
            resetToSampleData();
            state.activeMonth = getCurrentMonthKey();
            showToast('Sample ledger data loaded');
            renderCurrentView();
          },
        });
      },
      onClearAllData: () => {
        openConfirmModal({
          title: 'Clear All Data',
          message:
            'Delete all transactions and reset monthly budget targets to zero? This cannot be undone.',
          confirmLabel: 'Clear All Data',
          onConfirm: () => {
            clearAllData();
            showToast('All ledger data cleared');
            renderCurrentView();
          },
        });
      },
    });
  }

  refreshIcons();
}

/* ==========================================================================
   Mobile Sidebar Drawer
   ========================================================================== */

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('is-open');
  document.getElementById('sidebar-backdrop')?.classList.add('is-visible');
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-visible');
}

/* ==========================================================================
   Application Bootstrap
   ========================================================================== */

function initApp() {
  initializeStorage();

  // Initialize Add / Edit Transaction Modal
  txModal = createTransactionModalController((payload) => {
    if (payload.id) {
      updateTransaction(payload.id, payload);
      showToast('Transaction updated');
    } else {
      const saved = saveTransaction(payload);
      // Automatically switch activeMonth if user records an entry for a different month
      const txMonth = getMonthKey(saved.date);
      if (txMonth && state.activeView === 'dashboard') {
        state.activeMonth = txMonth;
      }
      showToast(`${saved.type === 'income' ? 'Income' : 'Expense'} recorded`);
    }
    renderCurrentView();
  });

  // Sidebar navigation links
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const view = el.getAttribute('data-nav');
      setActiveView(view);
    });
  });

  // Topbar & Sidebar Add buttons
  document.getElementById('topbar-add-btn')?.addEventListener('click', () => txModal.open(null));
  document
    .getElementById('open-quick-add-sidebar')
    ?.addEventListener('click', () => {
      closeMobileSidebar();
      txModal.open(null);
    });

  // Global reporting month selector
  document.getElementById('global-month-select')?.addEventListener('change', (e) => {
    state.activeMonth = e.target.value;
    renderCurrentView();
  });

  // Mobile sidebar controls
  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Confirm modal controls
  document.getElementById('confirm-modal-close')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal-cancel')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') closeConfirmModal();
  });
  document.getElementById('confirm-modal-confirm')?.addEventListener('click', () => {
    const cb = confirmActionCallback;
    closeConfirmModal();
    if (typeof cb === 'function') cb();
  });

  // Keyboard Escape closes open modals or mobile drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const confirmModal = document.getElementById('confirm-modal');
    const txModalEl = document.getElementById('transaction-modal');
    if (confirmModal && !confirmModal.hidden) {
      closeConfirmModal();
    } else if (txModalEl && !txModalEl.hidden) {
      txModal.close();
    } else {
      closeMobileSidebar();
    }
  });

  // Initial render
  setActiveView('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
