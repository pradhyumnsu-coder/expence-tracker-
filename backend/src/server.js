const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const frontendPath = path.resolve(__dirname, '..', '..', 'expence-tracker--main');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(frontendPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// REST API routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);

// Catch-all 404 for unknown /api routes
app.use('/api', notFoundHandler);

// Fallback for non-API GET requests: serve frontend index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }
  next();
});

// Centralized error handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[ClearLedger] Server running on http://localhost:${PORT}`);
    console.log(`[ClearLedger] Serving frontend from: ${frontendPath}`);
  });
}

module.exports = app;
