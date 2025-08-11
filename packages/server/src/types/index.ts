import { z } from 'zod';

// Environment Configuration Schema
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // Database
  DATABASE_URL: z.string(),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('monitoring_db'),
  DATABASE_USER: z.string().default('monitoring_user'),
  DATABASE_PASSWORD: z.string(),
  DATABASE_SSL: z.coerce.boolean().default(false),
  
  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  
  // Auth
  JWT_SECRET: z.string().min(32),
  API_KEY_SECRET: z.string().min(16),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // WebSocket
  WS_HEARTBEAT_INTERVAL: z.coerce.number().default(30000),
  WS_MAX_CONNECTIONS: z.coerce.number().default(1000),
  
  // Monitoring
  ALERT_CHECK_INTERVAL: z.coerce.number().default(60000),
  RETENTION_DAYS: z.coerce.number().default(30),
  BATCH_SIZE: z.coerce.number().default(1000),
  
  // External Services
  WEBHOOK_TIMEOUT: z.coerce.number().default(5000),
  SLACK_WEBHOOK_URL: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  PAGERDUTY_INTEGRATION_KEY: z.string().optional(),
  
  // Security
  HELMET_CSP_ENABLED: z.coerce.boolean().default(true),
  TRUST_PROXY: z.coerce.boolean().default(false),
  
  // Performance
  CLUSTER_MODE: z.coerce.boolean().default(false),
  WORKER_THREADS: z.coerce.number().default(4),
  MAX_PAYLOAD_SIZE: z.coerce.number().default(1048576),
});

export type Env = z.infer<typeof EnvSchema>;

// Event Types
export const EventTypeSchema = z.enum([
  'error',
  'warning',
  'info',
  'debug',
  'performance',
  'user_action',
  'system',
  'security',
  'business'
]);

export type EventType = z.infer<typeof EventTypeSchema>;

// Event Schema
export const EventSchema = z.object({
  id: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
  type: EventTypeSchema,
  level: z.enum(['critical', 'high', 'medium', 'low', 'info']).default('info'),
  source: z.string(),
  message: z.string(),
  metadata: z.record(z.any()).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stack: z.string().optional(),
  url: z.string().url().optional(),
  userAgent: z.string().optional(),
  ip: z.string().ip().optional()
});

export type Event = z.infer<typeof EventSchema>;

// Metric Schema
export const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  timestamp: z.string().datetime().optional(),
  unit: z.string().optional(),
  dimensions: z.record(z.string()).optional(),
  source: z.string()
});

export type Metric = z.infer<typeof MetricSchema>;

// Alert Configuration Schema
export const AlertConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  conditions: z.object({
    metric: z.string(),
    operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'ne']),
    threshold: z.number(),
    timeWindow: z.number(), // seconds
    occurrences: z.number().default(1)
  }),
  actions: z.array(z.object({
    type: z.enum(['webhook', 'email', 'slack', 'discord', 'pagerduty']),
    endpoint: z.string().url(),
    template: z.string().optional()
  })),
  cooldown: z.number().default(300), // seconds
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  tags: z.array(z.string()).optional()
});

export type AlertConfig = z.infer<typeof AlertConfigSchema>;

// API Key Schema
export const ApiKeySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  key: z.string(),
  hash: z.string(),
  permissions: z.array(z.enum(['read', 'write', 'admin'])),
  rateLimit: z.number().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  lastUsedAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true)
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

// Dashboard Query Schema
export const DashboardQuerySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  metrics: z.array(z.string()).optional(),
  eventTypes: z.array(EventTypeSchema).optional(),
  sources: z.array(z.string()).optional(),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  groupBy: z.array(z.string()).optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).default('5m'),
  limit: z.number().min(1).max(10000).default(1000)
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

// WebSocket Message Schema
export const WebSocketMessageSchema = z.object({
  type: z.enum(['event', 'metric', 'alert', 'subscribe', 'unsubscribe', 'heartbeat']),
  data: z.any(),
  timestamp: z.string().datetime().optional(),
  channel: z.string().optional()
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Database Connection Config
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

// Redis Connection Config
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
}

// Server Statistics
export interface ServerStats {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  eventsProcessed: number;
  metricsProcessed: number;
  alertsTriggered: number;
  errorRate: number;
  averageResponseTime: number;
}

// Fastify Instance Extensions
declare module 'fastify' {
  interface FastifyInstance {
    db: any; // PostgreSQL client
    redis: any; // Redis client
    wsClients: Set<any>; // WebSocket clients
    stats: ServerStats;
  }
  
  interface FastifyRequest {
    apiKey?: ApiKey;
    rateLimitInfo?: {
      limit: number;
      remaining: number;
      resetTime: Date;
    };
  }
}

export * from 'zod';