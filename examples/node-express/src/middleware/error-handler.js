const logger = require('../utils/logger');
const { trackError } = require('../utils/monitoring');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    headers: req.headers,
  });

  // Track error in monitoring system
  trackError(err, {
    category: 'application_error',
    action: 'unhandled_error',
    severity: getErrorSeverity(err),
    metadata: {
      url: req.url,
      method: req.method,
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      request_id: req.requestId,
      body: sanitizeData(req.body),
      params: req.params,
      query: req.query,
      headers: sanitizeHeaders(req.headers),
    },
  });

  // Determine error response
  const statusCode = getStatusCode(err);
  const errorResponse = createErrorResponse(err, statusCode, req);

  // Send error response
  if (!res.headersSent) {
    res.status(statusCode).json(errorResponse);
  }
}

/**
 * Determine HTTP status code from error
 * @param {Error} err - Error object
 * @returns {number} HTTP status code
 */
function getStatusCode(err) {
  // Check if error has statusCode property
  if (err.statusCode && typeof err.statusCode === 'number') {
    return err.statusCode;
  }

  // Check if error has status property
  if (err.status && typeof err.status === 'number') {
    return err.status;
  }

  // Check error name/type
  switch (err.name) {
    case 'ValidationError':
      return 400;
    case 'UnauthorizedError':
    case 'JsonWebTokenError':
      return 401;
    case 'ForbiddenError':
      return 403;
    case 'NotFoundError':
      return 404;
    case 'ConflictError':
      return 409;
    case 'PayloadTooLargeError':
      return 413;
    case 'TooManyRequestsError':
      return 429;
    default:
      return 500;
  }
}

/**
 * Determine error severity for monitoring
 * @param {Error} err - Error object
 * @returns {string} Severity level
 */
function getErrorSeverity(err) {
  const statusCode = getStatusCode(err);

  if (statusCode >= 500) {
    return 'high';
  } else if (statusCode >= 400) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Create error response object
 * @param {Error} err - Error object
 * @param {number} statusCode - HTTP status code
 * @param {Object} req - Express request object
 * @returns {Object} Error response
 */
function createErrorResponse(err, statusCode, req) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    error: {
      message: err.message || 'An unexpected error occurred',
      status: statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  // Add request ID if available
  if (req.requestId) {
    response.error.requestId = req.requestId;
  }

  // Include stack trace in development
  if (isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  // Include additional error details in development
  if (isDevelopment) {
    response.error.details = {
      name: err.name,
      code: err.code,
    };
  }

  // Add validation errors if present
  if (err.name === 'ValidationError' && err.errors) {
    response.error.validation = err.errors;
  }

  return response;
}

/**
 * Sanitize request data for logging
 * @param {Object} data - Data to sanitize
 * @returns {Object} Sanitized data
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'authorization',
    'secret',
    'key',
    'apikey',
    'api_key',
    'access_token',
    'refresh_token',
  ];

  const sanitized = { ...data };

  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize request headers for logging
 * @param {Object} headers - Headers to sanitize
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }

  const sanitized = { ...headers };
  
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
  ];

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Create custom error classes
 */
class ValidationError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class TooManyRequestsError extends Error {
  constructor(message = 'Too Many Requests') {
    super(message);
    this.name = 'TooManyRequestsError';
    this.statusCode = 429;
  }
}

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  asyncHandler,
};