const app = require('./app');
const logger = require('./middleware/logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`==================================================`);
  logger.info(`  Game Ops System server running on port ${PORT}   `);
  logger.info(`  Environment: ${process.env.NODE_ENV || 'development'} `);
  logger.info(`  API Docs: http://localhost:${PORT}/api-docs     `);
  logger.info(`==================================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle termination signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated.');
    process.exit(0);
  });
});
