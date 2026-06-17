const logger = require('./logger');

const errorHandler = (err, req, res, next) => {
  // Log the complete stack trace for errors
  logger.error(`Error encountered during ${req.method} ${req.url}: ${err.message}`, {
    stack: err.stack,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
