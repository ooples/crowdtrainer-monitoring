const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'node-express-monitoring',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/exceptions.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  ],
  
  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/rejections.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMessage = `${timestamp} [${level}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          const metaString = JSON.stringify(meta, null, 2);
          if (metaString !== '{}') {
            logMessage += `\n${metaString}`;
          }
        }
        
        if (stack) {
          logMessage += `\n${stack}`;
        }
        
        return logMessage;
      })
    ),
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Helper methods for structured logging
const structuredLogger = {
  // Log HTTP requests
  logRequest: (req, res, duration) => {
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });
  },

  // Log database operations
  logDatabase: (operation, query, duration, error = null) => {
    const logData = {
      operation,
      query: query.substring(0, 200), // Truncate long queries
      duration: `${duration}ms`,
    };

    if (error) {
      logger.error('Database Error', { ...logData, error: error.message });
    } else {
      logger.info('Database Operation', logData);
    }
  },

  // Log external API calls
  logExternalAPI: (method, url, statusCode, duration, error = null) => {
    const logData = {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
    };

    if (error) {
      logger.error('External API Error', { ...logData, error: error.message });
    } else {
      logger.info('External API Call', logData);
    }
  },

  // Log security events
  logSecurity: (event, details) => {
    logger.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log business events
  logBusiness: (event, details) => {
    logger.info('Business Event', {
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log system metrics
  logMetrics: (metrics) => {
    logger.info('System Metrics', {
      ...metrics,
      timestamp: new Date().toISOString(),
    });
  },
};

// Export both the logger and structured logger
module.exports = Object.assign(logger, structuredLogger);