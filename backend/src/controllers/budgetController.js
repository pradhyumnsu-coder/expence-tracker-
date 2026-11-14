const db = require('../config/database');

function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function formatBudgetRecord(row) {
  if (!row) return null;
  let categoryLimits = {};
  if (row.category_limits) {
    try {
      categoryLimits = JSON.parse(row.category_limits);
    } catch (e) {
      categoryLimits = {};
    }
  }
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    amount: row.amount,
    category_limits: categoryLimits,
    created_at: row.created_at,
  };
}

exports.getByYearMonth = (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return res.status(400).json({ success: false, error: 'Invalid year. Must be a valid year (e.g. 2026).' });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: 'Invalid month. Must be an integer between 1 and 12.' });
    }

    const stmt = db.prepare('SELECT * FROM monthly_budgets WHERE year = ? AND month = ?');
    const row = stmt.get(year, month);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: `No budget found for month ${month} and year ${year}.`,
      });
    }

    res.status(200).json({ success: true, data: formatBudgetRecord(row) });
  } catch (err) {
    next(err);
  }
};

exports.create = (req, res, next) => {
  try {
    const { year, month, amount, category_limits } = req.body;

    const numYear = Number(year);
    if (!Number.isInteger(numYear) || numYear < 1900 || numYear > 2100) {
      return res.status(400).json({ success: false, error: 'Year is required and must be a valid year.' });
    }

    const numMonth = Number(month);
    if (!Number.isInteger(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ success: false, error: 'Month is required and must be an integer between 1 and 12.' });
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount is required and must be a number greater than 0.' });
    }

    // Check if a budget already exists for this (year, month)
    const checkStmt = db.prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ?');
    const existing = checkStmt.get(numYear, numMonth);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A budget for ${numYear}-${String(numMonth).padStart(2, '0')} already exists. Use PUT /api/budgets/${existing.id} to update it.`,
        data: { id: existing.id },
      });
    }

    const categoryLimitsStr =
      category_limits && typeof category_limits === 'object'
        ? JSON.stringify(category_limits)
        : null;

    const insertStmt = db.prepare(`
      INSERT INTO monthly_budgets (year, month, amount, category_limits)
      VALUES (?, ?, ?, ?)
    `);

    const result = insertStmt.run(numYear, numMonth, numAmount, categoryLimitsStr);
    const newId = result.lastInsertRowid;

    const fetchStmt = db.prepare('SELECT * FROM monthly_budgets WHERE id = ?');
    const newRow = fetchStmt.get(newId);

    res.status(201).json({ success: true, data: formatBudgetRecord(newRow) });
  } catch (err) {
    next(err);
  }
};

exports.update = (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid ID: must be a positive integer.' });
    }

    const existingStmt = db.prepare('SELECT * FROM monthly_budgets WHERE id = ?');
    const existing = existingStmt.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Budget with ID ${id} not found.` });
    }

    const { year, month, amount, category_limits } = req.body;

    const targetYear = year !== undefined ? Number(year) : existing.year;
    if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 2100) {
      return res.status(400).json({ success: false, error: 'Year must be a valid year.' });
    }

    const targetMonth = month !== undefined ? Number(month) : existing.month;
    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ success: false, error: 'Month must be an integer between 1 and 12.' });
    }

    const targetAmount = amount !== undefined ? Number(amount) : existing.amount;
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a number greater than 0.' });
    }

    // If changing year or month, ensure it doesn't collide with another record
    if (targetYear !== existing.year || targetMonth !== existing.month) {
      const collisionStmt = db.prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ? AND id != ?');
      const collision = collisionStmt.get(targetYear, targetMonth, id);
      if (collision) {
        return res.status(409).json({
          success: false,
          error: `Another budget already exists for ${targetYear}-${String(targetMonth).padStart(2, '0')}.`,
        });
      }
    }

    let categoryLimitsStr = existing.category_limits;
    if (category_limits !== undefined) {
      categoryLimitsStr =
        category_limits && typeof category_limits === 'object'
          ? JSON.stringify(category_limits)
          : null;
    }

    const updateStmt = db.prepare(`
      UPDATE monthly_budgets
      SET year = ?, month = ?, amount = ?, category_limits = ?
      WHERE id = ?
    `);

    updateStmt.run(targetYear, targetMonth, targetAmount, categoryLimitsStr, id);

    const updated = existingStmt.get(id);
    res.status(200).json({ success: true, data: formatBudgetRecord(updated) });
  } catch (err) {
    next(err);
  }
};

exports.getSmartAlerts = (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return res.status(400).json({ success: false, error: 'Invalid year.' });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: 'Invalid month.' });
    }

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const budgetStmt = db.prepare('SELECT * FROM monthly_budgets WHERE year = ? AND month = ?');
    const budgetRow = budgetStmt.get(year, month);
    const formattedBudget = formatBudgetRecord(budgetRow);

    const monthlyLimit = formattedBudget ? formattedBudget.amount : 0;
    const categoryLimits = formattedBudget ? formattedBudget.category_limits : {};

    // Get all expenses for this month from database
    const expensesStmt = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND date LIKE ?
      GROUP BY category
    `);
    const categoryRows = expensesStmt.all(`${monthKey}-%`);

    const spentByCategory = {};
    let monthlySpent = 0;
    categoryRows.forEach((row) => {
      spentByCategory[row.category] = Number(row.total) || 0;
      monthlySpent += Number(row.total) || 0;
    });

    const remaining = monthlyLimit - monthlySpent;
    const utilizationPct = monthlyLimit > 0 ? (monthlySpent / monthlyLimit) * 100 : 0;

    let overallStatus = 'unset';
    if (monthlyLimit > 0) {
      if (utilizationPct >= 100) overallStatus = 'exceeded';
      else if (utilizationPct >= 80) overallStatus = 'warning';
      else overallStatus = 'normal';
    }

    // Days calculation for velocity and pacing
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
    const remainingDays = Math.max(1, daysInMonth - currentDay);

    const dailyBurnRate = currentDay > 0 ? monthlySpent / currentDay : 0;
    const projectedSpend = currentDay > 0 ? dailyBurnRate * daysInMonth : monthlySpent;
    const safeDailyAllowance = remaining > 0 ? remaining / remainingDays : 0;

    // Check category alerts
    const categoryAlerts = [];
    Object.entries(categoryLimits).forEach(([cat, limit]) => {
      const numLimit = Number(limit) || 0;
      if (numLimit > 0) {
        const spent = spentByCategory[cat] || 0;
        const pct = (spent / numLimit) * 100;
        if (pct >= 80) {
          categoryAlerts.push({
            category: cat,
            limit: numLimit,
            spent,
            remaining: numLimit - spent,
            utilizationPct: Math.round(pct * 10) / 10,
            status: pct >= 100 ? 'exceeded' : 'warning',
          });
        }
      }
    });

    // Build intelligent alert notifications
    const alerts = [];

    // 1. Overall limit exceeded or warning
    if (overallStatus === 'exceeded') {
      alerts.push({
        id: 'budget_exceeded',
        severity: 'danger',
        title: 'Monthly Budget Exceeded',
        message: `Total spending of $${monthlySpent.toFixed(2)} exceeds your $${monthlyLimit.toFixed(2)} limit by $${Math.abs(remaining).toFixed(2)}.`,
      });
    } else if (overallStatus === 'warning') {
      alerts.push({
        id: 'budget_warning',
        severity: 'warning',
        title: 'Approaching Budget Limit',
        message: `You have utilized ${utilizationPct.toFixed(1)}% of your monthly limit ($${monthlySpent.toFixed(2)} / $${monthlyLimit.toFixed(2)}). $${remaining.toFixed(2)} remaining.`,
      });
    }

    // 2. Spending velocity forecast (if current month, midway through, and spending fast)
    if (isCurrentMonth && monthlyLimit > 0 && currentDay >= 2 && overallStatus !== 'exceeded') {
      const projectedOver = projectedSpend - monthlyLimit;
      if (projectedOver > 0) {
        const projectedExceedDay = Math.min(daysInMonth, Math.max(1, Math.floor(monthlyLimit / dailyBurnRate)));
        alerts.push({
          id: 'spending_velocity',
          severity: 'warning',
          title: 'High Spending Pace Detected',
          message: `At your current pace of $${dailyBurnRate.toFixed(2)}/day, you are projected to reach $${projectedSpend.toFixed(2)} by month-end, exceeding your budget around Day ${projectedExceedDay}.`,
        });
      }
    }

    // 3. Category alerts
    categoryAlerts.forEach((ca) => {
      alerts.push({
        id: `cat_${ca.category}`,
        severity: ca.status === 'exceeded' ? 'danger' : 'warning',
        title: ca.status === 'exceeded' ? `Category Cap Exceeded: ${ca.category}` : `Category Alert: ${ca.category}`,
        message: ca.status === 'exceeded'
          ? `${ca.category} spending ($${ca.spent.toFixed(2)}) has exceeded your $${ca.limit.toFixed(2)} cap by $${Math.abs(ca.remaining).toFixed(2)}.`
          : `${ca.category} spending is at ${ca.utilizationPct}% ($${ca.spent.toFixed(2)} / $${ca.limit.toFixed(2)}).`,
        category: ca.category,
      });
    });

    res.status(200).json({
      success: true,
      data: {
        year,
        month,
        monthKey,
        monthlyLimit,
        monthlySpent: Math.round(monthlySpent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        utilizationPct: Math.round(utilizationPct * 10) / 10,
        overallStatus,
        dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
        projectedSpend: Math.round(projectedSpend * 100) / 100,
        safeDailyAllowance: Math.round(safeDailyAllowance * 100) / 100,
        daysInMonth,
        currentDay,
        remainingDays,
        isCurrentMonth,
        categoryAlerts,
        alerts,
      },
    });
  } catch (err) {
    next(err);
  }
};
