const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { monitoringMiddleware, initializeMonitoring } = require('./middleware/monitoring');
const { errorHandler } = require('./middleware/error-handler');
const { rateLimiter } = require('./middleware/rate-limiter');
const logger = require('./utils/logger');
const database = require('./database/connection');

// Import routes
const apiRoutes = require('./routes/api');
const usersRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');
const webhooksRoutes = require('./routes/webhooks');
const metricsRoutes = require('./routes/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
database.initialize();

// Initialize monitoring system
initializeMonitoring({
  apiEndpoint: process.env.MONITORING_ENDPOINT || 'http://localhost:3001/api/monitoring',
  serviceName: 'node-express-demo',
  environment: process.env.NODE_ENV || 'development',
  enableDatabaseMonitoring: true,
  enableApiMonitoring: true,
  enablePerformanceTracking: true,
  debug: process.env.NODE_ENV === 'development',
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", process.env.MONITORING_ENDPOINT || 'http://localhost:3001'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Rate limiting
app.use('/api/', rateLimiter);

// Logging middleware (before monitoring to capture all requests)
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Monitoring middleware (tracks all requests)
app.use(monitoringMiddleware);

// Health check (before other routes, no monitoring needed)
app.use('/health', healthRoutes);

// API routes
app.use('/api', apiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/webhooks', webhooksRoutes);

// Serve static files for demo
app.use(express.static('public'));

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Node.js Express Monitoring Example',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
  // Send to monitoring system
  const { trackError } = require('./utils/monitoring');
  trackError(new Error(`Unhandled Promise Rejection: ${reason}`), {
    category: 'system_error',
    action: 'unhandled_rejection',
    severity: 'critical',
    metadata: {
      reason: reason?.toString(),
      promise: promise?.toString(),
    },
  });
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  
  // Send to monitoring system
  const { trackError } = require('./utils/monitoring');
  trackError(error, {
    category: 'system_error',
    action: 'uncaught_exception',
    severity: 'critical',
  });
  
  // Exit after logging
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  
  // Track server startup
  const { track } = require('./utils/monitoring');
  track({
    category: 'system',
    action: 'server_started',
    metadata: {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      memory_usage: process.memoryUsage(),
    },
  });
});

module.exports = { app, server };