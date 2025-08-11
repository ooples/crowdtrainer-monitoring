const rateLimit = require('express-rate-limit');
const { trackError } = require('../utils/monitoring');
const logger = require('../utils/logger');

// Create rate limiter with monitoring integration
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((15 * 60 * 1000) / 1000), // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom key generator (can be used for user-based rate limiting)
  keyGenerator: (req) => {
    return req.ip;
  },
  
  // Skip successful requests
  skipSuccessfulRequests: false,
  
  // Skip failed requests
  skipFailedRequests: false,
  
  // Custom handler for when rate limit is exceeded
  handler: (req, res) => {
    const clientIP = req.ip;
    const userAgent = req.get('User-Agent');
    
    // Log rate limit exceeded
    logger.warn('Rate limit exceeded:', {
      ip: clientIP,
      userAgent: userAgent,
      url: req.url,
      method: req.method,
    });
    
    // Track rate limit exceeded event
    trackError(new Error(`Rate limit exceeded for IP: ${clientIP}`), {
      category: 'security',
      action: 'rate_limit_exceeded',
      severity: 'medium',
      metadata: {
        ip: clientIP,
        user_agent: userAgent,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((15 * 60 * 1000) / 1000),
      timestamp: new Date().toISOString(),
    });
  },
  
  // Called when a request is made
  onLimitReached: (req, res, options) => {
    logger.warn(`Rate limit reached for IP: ${req.ip}`);
  },
});

// Stricter rate limiter for sensitive endpoints
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests to sensitive endpoint, please try again later.',
    retryAfter: Math.ceil((15 * 60 * 1000) / 1000),
  },
  
  handler: (req, res) => {
    const clientIP = req.ip;
    const userAgent = req.get('User-Agent');
    
    logger.warn('Strict rate limit exceeded:', {
      ip: clientIP,
      userAgent: userAgent,
      url: req.url,
      method: req.method,
    });
    
    // Track strict rate limit exceeded event
    trackError(new Error(`Strict rate limit exceeded for IP: ${clientIP}`), {
      category: 'security',
      action: 'strict_rate_limit_exceeded',
      severity: 'high',
      metadata: {
        ip: clientIP,
        user_agent: userAgent,
        url: req.url,
        method: req.method,
        endpoint_type: 'sensitive',
        timestamp: new Date().toISOString(),
      },
    });
    
    res.status(429).json({
      error: 'Too many requests to sensitive endpoint, please try again later.',
      retryAfter: Math.ceil((15 * 60 * 1000) / 1000),
      timestamp: new Date().toISOString(),
    });
  },
});

// Rate limiter for webhooks
const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 webhook requests per minute
  message: {
    error: 'Too many webhook requests, please check your webhook configuration.',
    retryAfter: 60,
  },
  
  keyGenerator: (req) => {
    // Use a combination of IP and webhook source if available
    const source = req.headers['x-webhook-source'] || 'unknown';
    return `${req.ip}-${source}`;
  },
  
  handler: (req, res) => {
    const clientIP = req.ip;
    const webhookSource = req.headers['x-webhook-source'] || 'unknown';
    
    logger.warn('Webhook rate limit exceeded:', {
      ip: clientIP,
      webhookSource: webhookSource,
      url: req.url,
      method: req.method,
    });
    
    // Track webhook rate limit exceeded event
    trackError(new Error(`Webhook rate limit exceeded for source: ${webhookSource}`), {
      category: 'webhook_security',
      action: 'webhook_rate_limit_exceeded',
      severity: 'medium',
      metadata: {
        ip: clientIP,
        webhook_source: webhookSource,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
    });
    
    res.status(429).json({
      error: 'Too many webhook requests, please check your webhook configuration.',
      retryAfter: 60,
      timestamp: new Date().toISOString(),
    });
  },
});

// Dynamic rate limiter factory
function createDynamicRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests',
    category = 'rate_limiting',
    action = 'rate_limit_exceeded',
    severity = 'medium',
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    
    handler: (req, res) => {
      logger.warn(`Dynamic rate limit exceeded: ${message}`, {
        ip: req.ip,
        url: req.url,
        method: req.method,
      });
      
      trackError(new Error(`Dynamic rate limit exceeded: ${message}`), {
        category,
        action,
        severity,
        metadata: {
          ip: req.ip,
          url: req.url,
          method: req.method,
          rate_limit_type: 'dynamic',
          window_ms: windowMs,
          max_requests: max,
          timestamp: new Date().toISOString(),
        },
      });
      
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString(),
      });
    },
  });
}

module.exports = {
  rateLimiter,
  strictRateLimiter,
  webhookRateLimiter,
  createDynamicRateLimiter,
};