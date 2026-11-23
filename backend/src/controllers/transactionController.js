const db = require('../config/database');

function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function validateTransactionInput(body, isUpdate = false) {
  const { title, amount, category, type, date, description } = body;

  if (!isUpdate || title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return 'Title is required and must be a non-empty string.';
    }
  }

  if (!isUpdate || amount !== undefined) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return 'Amount is required and must be a number greater than 0.';
    }
  }

  if (!isUpdate || type !== undefined) {
    if (type !== 'income' && type !== 'expense') {
      return 'Type is required and must be either "income" or "expense".';
    }
  }

  if (!isUpdate || category !== undefined) {
    if (typeof category !== 'string' || category.trim().length === 0) {
      return 'Category is required and must be a non-empty string.';
    }
  }

  if (!isUpdate || date !== undefined) {
    if (!isValidDate(date)) {
      return 'Date is required and must be a valid date in YYYY-MM-DD format.';
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return 'Description must be a string.';
    }
  }

  return null;
}

exports.getAll = (req, res, next) => {
  try {
    const stmt = db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC');
    const rows = stmt.all();
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getById = (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid ID: must be a positive integer.' });
    }

    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return res.status(404).json({ success: false, error: `Transaction with ID ${id} not found.` });
    }

    res.status(200).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
};

exports.create = (req, res, next) => {
  try {
    const errorMsg = validateTransactionInput(req.body, false);
    if (errorMsg) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const title = req.body.title.trim();
    const amount = Number(req.body.amount);
    const category = req.body.category.trim();
    const type = req.body.type;
    const date = req.body.date.trim();
    const description = req.body.description ? req.body.description.trim() : null;

    const stmt = db.prepare(`
      INSERT INTO transactions (title, amount, category, type, date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(title, amount, category, type, date, description);
    const newId = result.lastInsertRowid;

    const fetchStmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const newTx = fetchStmt.get(newId);

    res.status(201).json({ success: true, data: newTx });
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

    const existingStmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const existing = existingStmt.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Transaction with ID ${id} not found.` });
    }

    const errorMsg = validateTransactionInput(req.body, false);
    if (errorMsg) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const title = req.body.title.trim();
    const amount = Number(req.body.amount);
    const category = req.body.category.trim();
    const type = req.body.type;
    const date = req.body.date.trim();
    const description = req.body.description !== undefined ? (req.body.description ? req.body.description.trim() : null) : existing.description;

    const updateStmt = db.prepare(`
      UPDATE transactions
      SET title = ?, amount = ?, category = ?, type = ?, date = ?, description = ?
      WHERE id = ?
    `);

    updateStmt.run(title, amount, category, type, date, description, id);

    const updated = existingStmt.get(id);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.delete = (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid ID: must be a positive integer.' });
    }

    const existingStmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const existing = existingStmt.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Transaction with ID ${id} not found.` });
    }

    const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    deleteStmt.run(id);

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully',
      data: { id },
    });
  } catch (err) {
    next(err);
  }
};
