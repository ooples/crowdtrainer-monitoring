import { FastifyRequest, FastifyReply } from 'fastify';
import { getAuthManager, authenticateRequest } from '../auth';
import { getRedis } from '../redis';

// Request timing middleware
export async function requestTimingMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  request.startTime = Date.now();
}

// Request ID middleware
export async function requestIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = (request.headers['x-request-id'] as string) || 
                   `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  request.requestId = requestId;
  reply.header('X-Request-ID', requestId);
}

// Authentication middleware (wrapper for the auth module)
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await authenticateRequest(request, reply);
    if (reply.sent) return; // Response already sent (authentication failed)
  } catch (error) {
    (request.log as any).error({ error: error instanceof Error ? error.message : String(error) }, 'Authentication error');
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Authentication service error',
    });
  }
}

// Rate limiting middleware
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip rate limiting for health checks and docs
  if (request.url === '/health' || request.url?.startsWith('/docs')) {
    return;
  }

  try {
    const auth = getAuthManager();
    const redis = getRedis();
    
    if (request.apiKey) {
      // Use API key specific rate limiting
      const rateLimitResult = await auth.checkRateLimit(request.apiKey, request.url || '');
      
      if (!rateLimitResult.allowed) {
        reply.code(429).send({
          error: 'Rate Limit Exceeded',
          message: 'Too many requests for this API key',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        });
        return;
      }
      
      request.rateLimitInfo = {
        limit: rateLimitResult.remaining + 1, // Add current request
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime),
      };
      
      // Add rate limit headers
      reply.header('X-RateLimit-Limit', rateLimitResult.remaining + 1);
      reply.header('X-RateLimit-Remaining', rateLimitResult.remaining);
      reply.header('X-RateLimit-Reset', rateLimitResult.resetTime);
    } else {
      // IP-based rate limiting for unauthenticated requests
      const clientIp = request.ip || 'unknown';
      const rateLimitKey = `ratelimit:ip:${clientIp}`;
      const limit = 100; // 100 requests per hour for IP
      const window = 3600 * 1000; // 1 hour
      
      const rateLimitResult = await redis.checkRateLimit(rateLimitKey, limit, window);
      
      if (!rateLimitResult.allowed) {
        reply.code(429).send({
          error: 'Rate Limit Exceeded',
          message: 'Too many requests from your IP address',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        });
        return;
      }
    }
    
    // done(); // Removed - done is not defined in this scope
  } catch (error) {
    (request.log as any).error({ error: error instanceof Error ? error.message : String(error) }, 'Rate limiting error');
    // On error, allow the request but log the issue
  }
}

// Request validation middleware
export function validateRequest(schema: any) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      if (schema.body && request.body) {
        schema.body.parse(request.body);
      }
      
      if (schema.query && request.query) {
        schema.query.parse(request.query);
      }
      
      if (schema.params && request.params) {
        schema.params.parse(request.params);
      }
    } catch (error) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Request data validation failed',
        details: error instanceof Error ? error.message : 'Unknown validation error',
      });
    }
  };
}

// Permission checking middleware
export function requirePermission(permission: 'read' | 'write' | 'admin') {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.apiKey) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const auth = getAuthManager();
    if (!auth.hasPermission(request.apiKey, permission)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Permission '${permission}' is required`,
      });
      return;
    }
  };
}

// Content type validation middleware
export function requireContentType(contentType: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const requestContentType = request.headers['content-type'];
    
    if (!requestContentType || !requestContentType.includes(contentType)) {
      reply.code(415).send({
        error: 'Unsupported Media Type',
        message: `Content-Type must be ${contentType}`,
      });
      return;
    }
  };
}

// Response headers middleware
export async function responseHeadersMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Security headers (additional to Helmet)
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // API versioning header
  reply.header('X-API-Version', '1.0.0');
  
  // Response timing
  reply.header('X-Response-Time', `${Date.now() - (request.startTime || Date.now())}ms`);
}

// Error handling middleware
export async function errorHandlingMiddleware(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  (request.log as any).error({
    error: error.message,
    stack: error.stack,
    requestId: request.requestId,
    url: request.url,
    method: request.method
  }, 'Request error');

  // Log to Redis for monitoring
  try {
    const redis = getRedis();
    await redis.queueEvent({
      type: 'error',
      level: 'high',
      source: 'api-server',
      message: error.message,
      metadata: {
        requestId: request.requestId,
        url: request.url,
        method: request.method,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (redisError) {
    (request.log as any).error({ error: redisError instanceof Error ? redisError.message : String(redisError) }, 'Failed to log error to Redis');
  }

  // Determine error type and response
  if (error.name === 'ValidationError') {
    reply.code(400).send({
      error: 'Validation Error',
      message: error.message,
      requestId: request.requestId,
    });
    return;
  }

  if (error.name === 'UnauthorizedError') {
    reply.code(401).send({
      error: 'Unauthorized',
      message: error.message,
      requestId: request.requestId,
    });
    return;
  }

  if (error.name === 'ForbiddenError') {
    reply.code(403).send({
      error: 'Forbidden',
      message: error.message,
      requestId: request.requestId,
    });
    return;
  }

  if (error.name === 'NotFoundError') {
    reply.code(404).send({
      error: 'Not Found',
      message: error.message,
      requestId: request.requestId,
    });
    return;
  }

  // Generic server error
  reply.code(500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    requestId: request.requestId,
  });
}

// Request logging middleware
export async function requestLoggingMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();
  
  (request.log as any).info({
    requestId: request.requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
    apiKey: request.apiKey ? `${request.apiKey.name} (${request.apiKey.id?.substring(0, 8)}...)` : 'none'
  }, 'Request started');

  // Store response logging info for later use in onResponse hook
  request.loggingStartTime = startTime;
}

// Health check middleware to update server stats
export async function healthCheckMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (request.url === '/health' || request.url === '/stats') {
    // Update server statistics
    if (request.server?.stats) {
      request.server.stats.activeConnections = request.server.wsClients?.size || 0;
      request.server.stats.memoryUsage = process.memoryUsage();
      request.server.stats.cpuUsage = process.cpuUsage();
    }
  }
}

// WebSocket connection middleware
export function websocketConnectionMiddleware() {
  return async (connection: any, request: FastifyRequest): Promise<void> => {
    const redis = getRedis();
    const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Store connection metadata
    await redis.addWebSocketConnection(connectionId, {
      connectedAt: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    connection.on('close', async () => {
      await redis.removeWebSocketConnection(connectionId);
    });

    // Add connection ID to connection object
    (connection as any).connectionId = connectionId;
  };
}

// Metrics collection middleware
export async function metricsMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();
  
  // Store metrics info for later use in onResponse hook
  request.metricsStartTime = startTime;
}

// Batch request processing middleware for high-volume endpoints
export function batchProcessingMiddleware(batchSize: number = 100) {
  const requestQueue: Array<{
    request: FastifyRequest;
    reply: FastifyReply;
    resolve: Function;
    reject: Function;
  }> = [];
  
  let processingBatch = false;

  const processBatch = async () => {
    if (processingBatch || requestQueue.length === 0) return;
    
    processingBatch = true;
    const batch = requestQueue.splice(0, batchSize);
    
    try {
      // Process all requests in the batch
      await Promise.all(batch.map(async ({ request: _request, reply: _reply, resolve, reject }) => {
        try {
          // Your batch processing logic here
          resolve();
        } catch (error) {
          reject(error);
        }
      }));
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      processingBatch = false;
      
      // Process next batch if there are more requests
      if (requestQueue.length > 0) {
        setTimeout(processBatch, 10);
      }
    }
  };

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      requestQueue.push({ request, reply, resolve, reject });
      processBatch();
    });
  };
}

// Response logging hook for request completion
export async function onResponseLoggingHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.loggingStartTime) {
    const duration = Date.now() - request.loggingStartTime;
    
    (request.log as any).info({
      requestId: request.requestId,
      statusCode: reply.statusCode,
      duration,
      method: request.method,
      url: request.url,
    }, 'Request completed');

    // Update server statistics
    if (request.server?.stats) {
      request.server.stats.averageResponseTime = 
        (request.server.stats.averageResponseTime + duration) / 2;
      
      if (reply.statusCode >= 400) {
        request.server.stats.errorRate = 
          (request.server.stats.errorRate + 1) / 2;
      }
    }
  }
}

// Response metrics hook for metrics collection
export async function onResponseMetricsHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.metricsStartTime) {
    try {
      const redis = getRedis();
      const duration = Date.now() - request.metricsStartTime;
      
      // Collect request metrics
      await redis.incrementMetric('requests_total');
      await redis.incrementMetric(`requests_by_status_${reply.statusCode}`);
      await redis.incrementMetric(`requests_by_method_${request.method.toLowerCase()}`);
      
      // Track response times
      await redis.queueEvent({
        type: 'performance',
        level: 'info',
        source: 'api-server',
        message: 'Request completed',
        metadata: {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration,
          requestId: request.requestId,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      (request.log as any).error({ error: error instanceof Error ? error.message : String(error) }, 'Metrics collection error');
    }
  }
}

// Export all middleware
export const middleware = {
  requestTiming: requestTimingMiddleware,
  requestId: requestIdMiddleware,
  auth: authMiddleware,
  rateLimit: rateLimitMiddleware,
  validateRequest,
  requirePermission,
  requireContentType,
  responseHeaders: responseHeadersMiddleware,
  errorHandling: errorHandlingMiddleware,
  requestLogging: requestLoggingMiddleware,
  healthCheck: healthCheckMiddleware,
  websocketConnection: websocketConnectionMiddleware,
  metrics: metricsMiddleware,
  batchProcessing: batchProcessingMiddleware,
  onResponseLogging: onResponseLoggingHook,
  onResponseMetrics: onResponseMetricsHook,
};

export default middleware;