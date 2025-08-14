import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { requirePermission } from '../middleware';

// Admin route interfaces (schemas not used in this implementation)

export default async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();
  const redis = getRedis();

  // Clear all monitoring data
  fastify.post('/clear', {
    schema: {
      description: 'Clear all monitoring data (admin only)',
      tags: ['admin'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          confirmAction: { type: 'boolean' },
          tables: { 
            type: 'array', 
            items: { 
              type: 'string', 
              enum: ['events', 'metrics', 'alerts', 'all'] 
            } 
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            clearedTables: { type: 'array', items: { type: 'string' } },
            recordsDeleted: { type: 'object' },
          },
        },
      },
    },
    preHandler: [requirePermission('admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as any) || {};
      const tables = body.tables || ['all'];
      const recordsDeleted: { [key: string]: number } = {};
      const clearedTables: string[] = [];

      // Clear events table
      if (tables.includes('events') || tables.includes('all')) {
        const result = await db.query('DELETE FROM events');
        recordsDeleted.events = result.rowCount || 0;
        clearedTables.push('events');
      }

      // Clear metrics table
      if (tables.includes('metrics') || tables.includes('all')) {
        const result = await db.query('DELETE FROM metrics');
        recordsDeleted.metrics = result.rowCount || 0;
        clearedTables.push('metrics');
      }

      // Clear alerts table (if it exists)
      if (tables.includes('alerts') || tables.includes('all')) {
        try {
          const result = await db.query('DELETE FROM alert_instances');
          recordsDeleted.alert_instances = result.rowCount || 0;
          clearedTables.push('alert_instances');
        } catch (error) {
          // Table might not exist, which is okay
          fastify.log.warn('Alert instances table not found or could not be cleared');
        }
      }

      // Clear Redis cache
      try {
        const keys = await (redis as any).client.keys('monitoring:*');
        if (keys.length > 0) {
          await (redis as any).client.del(...keys);
          recordsDeleted.redis_keys = keys.length;
        }
      } catch (error) {
        fastify.log.warn('Could not clear Redis cache');
      }

      // Reset server statistics
      if (fastify.stats) {
        fastify.stats.eventsProcessed = 0;
        fastify.stats.metricsProcessed = 0;
        fastify.stats.alertsTriggered = 0;
        fastify.stats.errorRate = 0;
      }

      reply.send({
        success: true,
        message: `Successfully cleared ${clearedTables.join(', ')} tables`,
        clearedTables,
        recordsDeleted,
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error clearing data');
      reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to clear monitoring data',
      });
    }
  });

  // Reset metrics and counters
  fastify.post('/reset-metrics', {
    schema: {
      description: 'Reset metrics and performance counters',
      tags: ['admin'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          resetCounters: { type: 'boolean' },
          resetCache: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            resetOperations: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    preHandler: [requirePermission('admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as any) || {};
      const resetOperations: string[] = [];

      // Reset server statistics
      if (body.resetCounters !== false && (fastify as any).stats) {
        (fastify as any).stats.eventsProcessed = 0;
        (fastify as any).stats.metricsProcessed = 0;
        (fastify as any).stats.alertsTriggered = 0;
        (fastify as any).stats.errorRate = 0;
        (fastify as any).stats.averageResponseTime = 0;
        resetOperations.push('server_counters');
      }

      // Reset Redis metrics cache
      if (body.resetCache !== false) {
        try {
          const keys = await (redis as any).client.keys('metric:*');
          if (keys.length > 0) {
            await (redis as any).client.del(...keys);
            resetOperations.push('redis_metrics_cache');
          }
        } catch (error) {
          fastify.log.warn('Could not reset Redis metrics cache');
        }
      }

      reply.send({
        success: true,
        message: `Successfully reset: ${resetOperations.join(', ')}`,
        resetOperations,
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error resetting metrics');
      reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to reset metrics',
      });
    }
  });

  // Export monitoring data
  fastify.get('/export', {
    schema: {
      description: 'Export monitoring data',
      tags: ['admin'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
          tables: { 
            type: 'array', 
            items: { 
              type: 'string', 
              enum: ['events', 'metrics', 'alerts'] 
            } 
          },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    preHandler: [requirePermission('admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = (request.query as any) || {};
      const format = query.format || 'json';
      const tables = query.tables || ['events', 'metrics'];
      
      // Default to last 7 days if no time range specified
      const endTime = query.endTime || new Date().toISOString();
      const startTime = query.startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const exportData: { [key: string]: any[] } = {};

      // Export events
      if (tables.includes('events')) {
        const eventsResult = await db.query(`
          SELECT * FROM events 
          WHERE timestamp >= $1 AND timestamp <= $2 
          ORDER BY timestamp DESC
        `, [startTime, endTime]);
        exportData.events = eventsResult.rows;
      }

      // Export metrics
      if (tables.includes('metrics')) {
        const metricsResult = await db.query(`
          SELECT * FROM metrics 
          WHERE timestamp >= $1 AND timestamp <= $2 
          ORDER BY timestamp DESC
        `, [startTime, endTime]);
        exportData.metrics = metricsResult.rows;
      }

      // Export alerts (if table exists)
      if (tables.includes('alerts')) {
        try {
          const alertsResult = await db.query(`
            SELECT * FROM alert_instances 
            WHERE triggered_at >= $1 AND triggered_at <= $2 
            ORDER BY triggered_at DESC
          `, [startTime, endTime]);
          exportData.alerts = alertsResult.rows;
        } catch (error) {
          fastify.log.warn('Alert instances table not found');
          exportData.alerts = [];
        }
      }

      // Add metadata
      const metadata = {
        exportedAt: new Date().toISOString(),
        timeRange: { startTime, endTime },
        tables: Object.keys(exportData),
        recordCounts: Object.fromEntries(
          Object.entries(exportData).map(([table, data]) => [table, data.length])
        ),
      };

      if (format === 'json') {
        reply.type('application/json');
        reply.send({
          metadata,
          data: exportData,
        });
      } else if (format === 'csv') {
        // For CSV, we'll export each table separately in a simple format
        reply.type('text/csv');
        
        let csvContent = '';
        
        for (const [tableName, tableData] of Object.entries(exportData)) {
          if (tableData.length === 0) continue;
          
          csvContent += `\n# ${tableName.toUpperCase()}\n`;
          
          // Get headers from first row
          const headers = Object.keys(tableData[0]);
          csvContent += headers.join(',') + '\n';
          
          // Add data rows
          for (const row of tableData) {
            const values = headers.map(header => {
              const value = row[header];
              // Escape commas and quotes in CSV
              if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value || '';
            });
            csvContent += values.join(',') + '\n';
          }
        }
        
        reply.send(csvContent);
      }

    } catch (error) {
      fastify.log.error({ error }, 'Error exporting data');
      reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to export data',
      });
    }
  });

  // Get admin dashboard statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get detailed admin statistics',
      tags: ['admin'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                events: { type: 'object' },
                metrics: { type: 'object' },
                alerts: { type: 'object' },
              },
            },
            server: {
              type: 'object',
              properties: {
                uptime: { type: 'number' },
                memoryUsage: { type: 'object' },
                cpuUsage: { type: 'object' },
                activeConnections: { type: 'number' },
                processedCounts: { type: 'object' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                keyCount: { type: 'number' },
                memoryUsage: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('admin')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Database statistics
      const [eventsStats, metricsStats] = await Promise.all([
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE level IN ('critical', 'high', 'error')) as errors,
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours') as last_24h,
            MIN(timestamp) as oldest,
            MAX(timestamp) as newest
          FROM events
        `),
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT name) as unique_metrics,
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours') as last_24h,
            MIN(timestamp) as oldest,
            MAX(timestamp) as newest
          FROM metrics
        `),
      ]);

      let alertStats = { rows: [{ total: 0, active: 0, last_24h: 0 }] };
      try {
        alertStats = await db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'active') as active,
            COUNT(*) FILTER (WHERE triggered_at >= NOW() - INTERVAL '24 hours') as last_24h
          FROM alert_instances
        `);
      } catch (error) {
        // Alert table doesn't exist
      }

      // Redis statistics
      let redisStats = {
        connected: false,
        keyCount: 0,
        memoryUsage: 'unknown',
      };

      try {
        await redis.ping();
        const keys = await (redis as any).client.keys('*');
        redisStats = {
          connected: true,
          keyCount: keys.length,
          memoryUsage: 'connected',
        };
      } catch (error) {
        fastify.log.warn('Redis stats unavailable');
      }

      // Server statistics
      const serverStats = {
        uptime: (fastify as any).stats ? Date.now() - (fastify as any).stats.uptime : 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        activeConnections: (fastify as any).stats?.activeConnections || 0,
        processedCounts: {
          events: (fastify as any).stats?.eventsProcessed || 0,
          metrics: (fastify as any).stats?.metricsProcessed || 0,
          alerts: (fastify as any).stats?.alertsTriggered || 0,
        },
      };

      reply.send({
        database: {
          events: {
            total: parseInt(String(eventsStats.rows[0].total)) || 0,
            errors: parseInt(String(eventsStats.rows[0].errors)) || 0,
            last_24h: parseInt(String(eventsStats.rows[0].last_24h)) || 0,
            oldest: eventsStats.rows[0].oldest,
            newest: eventsStats.rows[0].newest,
          },
          metrics: {
            total: parseInt(String(metricsStats.rows[0].total)) || 0,
            unique_metrics: parseInt(String(metricsStats.rows[0].unique_metrics)) || 0,
            last_24h: parseInt(String(metricsStats.rows[0].last_24h)) || 0,
            oldest: metricsStats.rows[0].oldest,
            newest: metricsStats.rows[0].newest,
          },
          alerts: {
            total: parseInt(String(alertStats.rows[0].total)) || 0,
            active: parseInt(String(alertStats.rows[0].active)) || 0,
            last_24h: parseInt(String(alertStats.rows[0].last_24h)) || 0,
          },
        },
        server: serverStats,
        redis: redisStats,
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error getting admin stats');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get admin statistics',
      });
    }
  });

  // System health check with detailed information
  fastify.get('/health', {
    schema: {
      description: 'Detailed system health check',
      tags: ['admin'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            overall: { type: 'string' },
            timestamp: { type: 'string' },
            components: { type: 'object' },
            performance: { type: 'object' },
            recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    preHandler: [requirePermission('admin')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const components = {
        database: { status: 'unknown', latency: 0, error: null as string | null },
        redis: { status: 'unknown', latency: 0, error: null as string | null },
        websocket: { status: 'unknown', connections: 0 },
      };

      const recommendations: string[] = [];

      // Check database
      try {
        const start = Date.now();
        await db.query('SELECT 1');
        components.database = {
          status: 'healthy',
          latency: Date.now() - start,
          error: null,
        };

        if (components.database.latency > 100) {
          recommendations.push('Database latency is high (>100ms)');
        }
      } catch (error) {
        components.database = {
          status: 'error',
          latency: 0,
          error: (error as Error).message,
        };
      }

      // Check Redis
      try {
        const start = Date.now();
        await redis.ping();
        components.redis = {
          status: 'healthy',
          latency: Date.now() - start,
          error: null,
        };

        if (components.redis.latency > 50) {
          recommendations.push('Redis latency is high (>50ms)');
        }
      } catch (error) {
        components.redis = {
          status: 'error',
          latency: 0,
          error: (error as Error).message,
        };
      }

      // Check WebSocket
      const wsConnections = (fastify as any).wsClients?.size || 0;
      components.websocket = {
        status: wsConnections >= 0 ? 'healthy' : 'error',
        connections: wsConnections,
      };

      // Performance metrics
      const memUsage = process.memoryUsage();
      const performance = {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        uptime: (fastify as any).stats ? Date.now() - (fastify as any).stats.uptime : 0,
      };

      // Performance recommendations
      if (performance.memory.used > 500) {
        recommendations.push('Memory usage is high (>500MB)');
      }

      if (performance.uptime < 60000) {
        recommendations.push('Server recently restarted');
      }

      // Overall health
      const allHealthy = Object.values(components).every(
        (comp: any) => comp.status === 'healthy'
      );
      
      const overall = allHealthy ? 'healthy' : 'degraded';

      reply.code(allHealthy ? 200 : 503).send({
        overall,
        timestamp: new Date().toISOString(),
        components,
        performance,
        recommendations,
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error in admin health check');
      reply.code(500).send({
        overall: 'error',
        timestamp: new Date().toISOString(),
        error: 'Failed to perform health check',
        message: (error as Error).message,
      });
    }
  });
}