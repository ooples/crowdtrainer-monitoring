const logger = require('../utils/logger');

// Monitoring configuration
let config = {
  apiEndpoint: 'http://localhost:3001/api/monitoring',
  serviceName: 'node-express-demo',
  environment: 'development',
  enableDatabaseMonitoring: true,
  enableApiMonitoring: true,
  enablePerformanceTracking: true,
  debug: false,
};

// Global monitoring state
const monitoringState = {
  isInitialized: false,
  requestCounts: {
    total: 0,
    errors: 0,
    success: 0,
  },
  responseTimers: new Map(),
  activeConnections: 0,
  startTime: Date.now(),
};

/**
 * Initialize monitoring system
 * @param {Object} userConfig - User configuration
 */
function initializeMonitoring(userConfig = {}) {
  config = { ...config, ...userConfig };
  monitoringState.isInitialized = true;
  
  if (config.debug) {
    logger.info('[Monitoring] Initialized with config:', config);
  }

  // Set up periodic metrics collection
  setupPeriodicMetrics();
  
  // Track initialization
  track({
    category: 'monitoring',
    action: 'initialized',
    metadata: {
      service: config.serviceName,
      environment: config.environment,
      config: config,
    },
  });
}

/**
 * Main monitoring middleware
 */
function monitoringMiddleware(req, res, next) {
  if (!monitoringState.isInitialized) {
    return next();
  }

  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Increment active connections
  monitoringState.activeConnections++;
  
  // Store request start time
  monitoringState.responseTimers.set(requestId, startTime);
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Track request start
  if (config.enableApiMonitoring && !isHealthCheck(req.path)) {
    track({
      category: 'api_request',
      action: 'request_start',
      metadata: {
        method: req.method,
        path: req.path,
        user_agent: req.get('User-Agent'),
        ip: getClientIP(req),
        request_id: requestId,
        query_params: Object.keys(req.query).length > 0 ? req.query : undefined,
      },
    });
  }

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Decrement active connections
    monitoringState.activeConnections--;
    
    // Update request counts
    monitoringState.requestCounts.total++;
    if (res.statusCode >= 400) {
      monitoringState.requestCounts.errors++;
    } else {
      monitoringState.requestCounts.success++;
    }
    
    // Clean up timer
    monitoringState.responseTimers.delete(requestId);
    
    // Track response if API monitoring is enabled and not a health check
    if (config.enableApiMonitoring && !isHealthCheck(req.path)) {
      // Track API response
      track({
        category: 'api_request',
        action: 'request_completed',
        metadata: {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          duration_ms: duration,
          request_id: requestId,
          response_size: chunk ? Buffer.byteLength(chunk) : 0,
          success: res.statusCode < 400,
        },
      });
      
      // Track performance metric
      trackPerformance({
        name: 'api_response_time',
        value: duration,
        unit: 'ms',
        metadata: {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          endpoint: `${req.method} ${req.path}`,
        },
      });
      
      // Track errors
      if (res.statusCode >= 400) {
        trackError(new Error(`HTTP ${res.statusCode}: ${req.method} ${req.path}`), {
          category: 'api_error',
          action: 'http_error',
          severity: res.statusCode >= 500 ? 'high' : 'medium',
          metadata: {
            method: req.method,
            path: req.path,
            status_code: res.statusCode,
            duration_ms: duration,
            request_id: requestId,
          },
        });
      }
    }
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Database query monitoring wrapper
 * @param {string} query - SQL query or operation description
 * @param {Function} operation - Database operation function
 * @returns {Promise} Operation result
 */
async function monitorDatabaseQuery(query, operation) {
  if (!config.enableDatabaseMonitoring) {
    return operation();
  }

  const startTime = Date.now();
  const queryId = `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Track query start
    track({
      category: 'database',
      action: 'query_start',
      metadata: {
        query: query.substring(0, 200), // Truncate long queries
        query_id: queryId,
      },
    });

    const result = await operation();
    const duration = Date.now() - startTime;
    
    // Track successful query
    track({
      category: 'database',
      action: 'query_completed',
      metadata: {
        query: query.substring(0, 200),
        query_id: queryId,
        duration_ms: duration,
        success: true,
        result_count: Array.isArray(result) ? result.length : (result ? 1 : 0),
      },
    });
    
    // Track performance
    trackPerformance({
      name: 'database_query_time',
      value: duration,
      unit: 'ms',
      metadata: {
        query_type: query.split(' ')[0]?.toUpperCase(),
        query_id: queryId,
      },
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Track database error
    trackError(error, {
      category: 'database_error',
      action: 'query_failed',
      metadata: {
        query: query.substring(0, 200),
        query_id: queryId,
        duration_ms: duration,
      },
    });
    
    throw error;
  }
}

/**
 * External API call monitoring wrapper
 * @param {string} url - API URL
 * @param {Object} options - Request options
 * @param {Function} operation - HTTP operation function
 * @returns {Promise} Operation result
 */
async function monitorExternalAPI(url, options = {}, operation) {
  const startTime = Date.now();
  const callId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Track API call start
    track({
      category: 'external_api',
      action: 'call_start',
      metadata: {
        url: url,
        method: options.method || 'GET',
        call_id: callId,
      },
    });

    const result = await operation();
    const duration = Date.now() - startTime;
    
    // Track successful API call
    track({
      category: 'external_api',
      action: 'call_completed',
      metadata: {
        url: url,
        method: options.method || 'GET',
        call_id: callId,
        duration_ms: duration,
        status_code: result?.status || result?.statusCode,
        success: true,
      },
    });
    
    // Track performance
    trackPerformance({
      name: 'external_api_response_time',
      value: duration,
      unit: 'ms',
      metadata: {
        url: url,
        method: options.method || 'GET',
        call_id: callId,
      },
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Track API error
    trackError(error, {
      category: 'external_api_error',
      action: 'call_failed',
      metadata: {
        url: url,
        method: options.method || 'GET',
        call_id: callId,
        duration_ms: duration,
        status_code: error?.response?.status || error?.status,
      },
    });
    
    throw error;
  }
}

/**
 * Track custom event
 * @param {Object} event - Event data
 */
function track(event) {
  if (!monitoringState.isInitialized) return;

  const eventData = {
    type: 'event',
    category: event.category,
    action: event.action,
    label: event.label || null,
    value: event.value || null,
    serviceName: config.serviceName,
    environment: config.environment,
    metadata: {
      ...event.metadata,
      timestamp: new Date().toISOString(),
      server_uptime: Date.now() - monitoringState.startTime,
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
    },
  };

  // Send to monitoring service
  sendToMonitoringService(eventData);

  if (config.debug) {
    logger.info('[Monitoring] Event tracked:', eventData);
  }
}

/**
 * Track performance metric
 * @param {Object} metric - Performance metric data
 */
function trackPerformance(metric) {
  if (!config.enablePerformanceTracking) return;

  const performanceData = {
    type: 'performance',
    name: metric.name,
    value: metric.value,
    unit: metric.unit || 'ms',
    serviceName: config.serviceName,
    environment: config.environment,
    metadata: {
      ...metric.metadata,
      timestamp: new Date().toISOString(),
    },
  };

  sendToMonitoringService(performanceData);

  if (config.debug) {
    logger.info('[Monitoring] Performance metric tracked:', performanceData);
  }
}

/**
 * Track error
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function trackError(error, context = {}) {
  const errorData = {
    type: 'error',
    category: context.category || 'application_error',
    action: context.action || 'error_occurred',
    label: context.label || error.name,
    serviceName: config.serviceName,
    environment: config.environment,
    metadata: {
      ...context.metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    },
    severity: context.severity || 'medium',
  };

  sendToMonitoringService(errorData);

  // Also log to application logger
  logger.error('[Monitoring] Error tracked:', {
    error: error.message,
    context: context,
  });
}

/**
 * Get system metrics
 */
function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    uptime: process.uptime(),
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    requests: monitoringState.requestCounts,
    activeConnections: monitoringState.activeConnections,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Set up periodic metrics collection
 */
function setupPeriodicMetrics() {
  // Collect system metrics every 30 seconds
  setInterval(() => {
    const metrics = getSystemMetrics();
    
    // Track memory usage
    trackPerformance({
      name: 'memory_usage',
      value: metrics.memory.heapUsed / 1024 / 1024, // MB
      unit: 'MB',
      metadata: {
        heap_total: metrics.memory.heapTotal / 1024 / 1024,
        rss: metrics.memory.rss / 1024 / 1024,
      },
    });
    
    // Track CPU usage
    trackPerformance({
      name: 'cpu_usage',
      value: (metrics.cpu.user + metrics.cpu.system) / 1000, // Convert to ms
      unit: 'ms',
    });
    
    // Track active connections
    trackPerformance({
      name: 'active_connections',
      value: metrics.activeConnections,
      unit: 'count',
    });
    
    // Track request rates
    track({
      category: 'system_metrics',
      action: 'periodic_collection',
      metadata: {
        ...metrics,
        collection_time: new Date().toISOString(),
      },
    });
    
  }, 30000); // Every 30 seconds
}

/**
 * Send data to monitoring service
 * @param {Object} data - Data to send
 */
async function sendToMonitoringService(data) {
  try {
    // In a real implementation, this would send to your monitoring API
    // For now, we'll just log it
    if (config.debug) {
      console.log('[Monitoring] Would send to API:', JSON.stringify(data, null, 2));
    }
    
    // Example implementation:
    // await fetch(`${config.apiEndpoint}/events`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data),
    // });
    
  } catch (error) {
    logger.error('[Monitoring] Failed to send to monitoring service:', error);
  }
}

/**
 * Check if path is a health check
 * @param {string} path - Request path
 */
function isHealthCheck(path) {
  return path.startsWith('/health') || path.startsWith('/metrics');
}

/**
 * Get client IP address
 * @param {Object} req - Express request object
 */
function getClientIP(req) {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

module.exports = {
  initializeMonitoring,
  monitoringMiddleware,
  monitorDatabaseQuery,
  monitorExternalAPI,
  track,
  trackPerformance,
  trackError,
  getSystemMetrics,
};