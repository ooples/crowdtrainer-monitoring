import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import { config } from 'dotenv';
import { EnvSchema, type Env, type ServerStats } from './types';
import { initDatabase } from './database';
import { initRedis } from './redis';
import { initWebSocket } from './websocket';
import { authMiddleware, rateLimitMiddleware } from './middleware';
import eventsRoutes from './routes/events';
import metricsRoutes from './routes/metrics';
import dashboardRoutes from './routes/dashboard';
import alertsRoutes from './routes/alerts';
import adminRoutes from './routes/admin';

// Load environment variables
config();

// Validate environment variables
const env: Env = EnvSchema.parse(process.env);

// Server statistics
const serverStats: ServerStats = {
  uptime: Date.now(),
  memoryUsage: process.memoryUsage(),
  cpuUsage: process.cpuUsage(),
  activeConnections: 0,
  eventsProcessed: 0,
  metricsProcessed: 0,
  alertsTriggered: 0,
  errorRate: 0,
  averageResponseTime: 0,
};

// Create Fastify instance
const server = fastify({
  logger: env.NODE_ENV === 'development' ? {
    level: env.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  } : {
    level: env.LOG_LEVEL,
  },
  trustProxy: env.TRUST_PROXY,
  bodyLimit: env.MAX_PAYLOAD_SIZE,
  ignoreTrailingSlash: true,
  ajv: {
    customOptions: {
      strict: 'log',
      keywords: ['kind', 'modifier'],
    },
  },
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    // Close WebSocket connections
    if (server.wsClients) {
      server.wsClients.forEach((ws) => ws.close());
    }
    
    // Close database connections
    if (server.db) {
      await server.db.end();
    }
    
    // Close Redis connections
    if (server.redis) {
      await server.redis.quit();
    }
    
    // Close Fastify server
    await server.close();
    server.log.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    server.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error during shutdown');
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => void gracefulShutdown('SIGUSR2')); // nodemon

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  server.log.fatal({ err: error }, 'Uncaught exception');
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  server.log.fatal({ reason, promise }, 'Unhandled rejection');
  void gracefulShutdown('unhandledRejection');
});

// Initialize server
async function start() {
  try {
    server.log.info('Starting Monitoring API Server...');

    // Register plugins
    await server.register(cors, {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: env.CORS_CREDENTIALS,
      methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    });

    await server.register(helmet, {
      contentSecurityPolicy: env.HELMET_CSP_ENABLED ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      } : false,
    });

    await server.register(jwt, {
      secret: env.JWT_SECRET,
    });

    await server.register(rateLimit, {
      global: false, // We'll apply per route
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      skipOnError: false,
      keyGenerator: (request) => {
        return request.headers['x-api-key'] as string || 
               request.ip || 
               'anonymous';
      },
      errorResponseBuilder: (_request, context) => {
        return {
          error: 'Rate limit exceeded',
          message: `Too many requests, retry after ${Math.round(context.ttl / 1000)} seconds`,
          statusCode: 429,
        };
      },
    });

    await server.register(websocket);

    // Swagger documentation
    await server.register(swagger, {
      swagger: {
        info: {
          title: 'Monitoring API',
          description: 'Real-time monitoring and analytics API',
          version: '1.0.0',
        },
        host: `localhost:${env.PORT}`,
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
    });

    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
      uiHooks: {
        onRequest: function (_request, _reply, next) {
          next();
        },
        preHandler: function (_request, _reply, next) {
          next();
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });

    // Initialize database connection
    server.log.info('Connecting to database...');
    const db = await initDatabase({
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      database: env.DATABASE_NAME,
      username: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      ssl: env.DATABASE_SSL,
      poolMin: 2,
      poolMax: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    server.decorate('db', db);

    // Initialize Redis connection
    server.log.info('Connecting to Redis...');
    const redisConfig = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      db: env.REDIS_DB,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
    };
    const redis = await initRedis(redisConfig);
    server.decorate('redis', redis);

    // Initialize WebSocket
    server.log.info('Setting up WebSocket...');
    const wsClients = await initWebSocket(server, {
      heartbeatInterval: env.WS_HEARTBEAT_INTERVAL,
      maxConnections: env.WS_MAX_CONNECTIONS,
    });
    server.decorate('wsClients', wsClients);

    // Add server stats
    server.decorate('stats', serverStats);

    // Register middleware
    server.addHook('preHandler', authMiddleware);
    server.addHook('preHandler', rateLimitMiddleware);

    // Health check endpoint
    server.get('/health', {
      schema: {
        description: 'Health check endpoint',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              version: { type: 'string' },
              database: { type: 'string' },
              redis: { type: 'string' },
            },
          },
        },
      },
    }, async (_request, reply) => {
      const uptime = Date.now() - serverStats.uptime;
      
      // Check database connection
      let dbStatus = 'connected';
      try {
        await server.db.query('SELECT 1');
      } catch (error) {
        dbStatus = 'error';
        server.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Database health check failed');
      }
      
      // Check Redis connection
      let redisStatus = 'connected';
      try {
        await server.redis.ping();
      } catch (error) {
        redisStatus = 'error';
        server.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Redis health check failed');
      }
      
      const health = {
        status: dbStatus === 'connected' && redisStatus === 'connected' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime,
        version: '1.0.0',
        database: dbStatus,
        redis: redisStatus,
      };
      
      reply.code(health.status === 'healthy' ? 200 : 503).send(health);
    });

    // Server statistics endpoint
    server.get('/stats', {
      schema: {
        description: 'Server statistics',
        tags: ['monitoring'],
        security: [{ apiKey: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              uptime: { type: 'number' },
              memoryUsage: { type: 'object' },
              activeConnections: { type: 'number' },
              eventsProcessed: { type: 'number' },
              metricsProcessed: { type: 'number' },
              alertsTriggered: { type: 'number' },
              errorRate: { type: 'number' },
              averageResponseTime: { type: 'number' },
            },
          },
        },
      },
    }, async (_request, reply) => {
      const stats = {
        ...serverStats,
        uptime: Date.now() - serverStats.uptime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };
      
      reply.send(stats);
    });

    // Register route modules
    await server.register(eventsRoutes, { prefix: '/api/v1/events' });
    await server.register(metricsRoutes, { prefix: '/api/v1/metrics' });
    await server.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
    await server.register(alertsRoutes, { prefix: '/api/v1/alerts' });
    await server.register(adminRoutes, { prefix: '/api/v1/admin' });

    // Start server
    await server.listen({
      port: env.PORT,
      host: env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
    });

    server.log.info(`🚀 Monitoring API Server running on port ${env.PORT}`);
    server.log.info(`📚 API Documentation available at http://localhost:${env.PORT}/docs`);
    server.log.info(`🔍 Health check available at http://localhost:${env.PORT}/health`);

  } catch (error) {
    server.log.fatal({ error: error instanceof Error ? error.message : String(error) }, 'Error starting server');
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  start();
}

export { server };
export default start;