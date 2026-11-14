function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
  });
}

function errorHandler(err, req, res, next) {
  console.error('[server error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
