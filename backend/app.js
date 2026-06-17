const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');

// Load environment variables
dotenv.config();

const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const scoreRoutes = require('./routes/scoreRoutes');

const app = express();

// Enable CORS
app.use(cors());

// Parse incoming requests JSON body
app.use(express.json());

// Set up HTTP request logging using morgan streaming to winston logger
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Serve swagger docs
let swaggerDocument;
try {
  swaggerDocument = require('./docs/swagger.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  logger.info('Swagger documentation initialized at /api-docs');
} catch (error) {
  logger.warn('Failed to load Swagger document. /api-docs will be unavailable until the file is generated.', error.message);
}

// Mount api routes
app.use('/api', scoreRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Game Ops System API',
    docs: '/api-docs',
    status: 'healthy'
  });
});

// Use central error handling middleware (must be after all routes)
app.use(errorHandler);

module.exports = app;
