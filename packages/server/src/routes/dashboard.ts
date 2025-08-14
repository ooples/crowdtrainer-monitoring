import { FastifyInstance, FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { requirePermission } from '../middleware';
// Dashboard route interfaces
interface OverviewQueryInterface extends RouteGenericInterface {
  Querystring: z.infer<typeof OverviewStatsSchema.shape.query>;
}

interface TimeSeriesQueryInterface extends RouteGenericInterface {
  Querystring: z.infer<typeof TimeSeriesSchema.shape.query>;
}

interface TopListParamsInterface extends RouteGenericInterface {
  Params: { type: 'errors' | 'slow_requests' | 'traffic_sources' | 'user_agents' };
  Querystring: Omit<z.infer<typeof TopListSchema.shape.query>, 'type'>;
}

interface HeatmapQueryInterface extends RouteGenericInterface {
  Querystring: z.infer<typeof HeatmapSchema.shape.query>;
}

interface CreateWidgetInterface extends RouteGenericInterface {
  Body: { name: string; type: string; query: object; config?: object };
}

// Extended dashboard query schemas
const OverviewStatsSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
  }),
});

const TimeSeriesSchema = z.object({
  query: z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    metrics: z.array(z.string()).min(1),
    sources: z.array(z.string()).optional(),
    interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).default('5m'),
    aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  }),
});

const TopListSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    type: z.enum(['errors', 'slow_requests', 'traffic_sources', 'user_agents']),
    limit: z.coerce.number().min(1).max(100).default(10),
  }),
});

const HeatmapSchema = z.object({
  query: z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    metric: z.string(),
    source: z.string().optional(),
    xAxis: z.enum(['hour', 'day', 'week']).default('day'),
    yAxis: z.string(),
  }),
});

export default async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();
  const redis = getRedis();

  // Get overview statistics
  fastify.get('/overview', {
    schema: {
      description: 'Get dashboard overview statistics',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                totalEvents: { type: 'number' },
                totalMetrics: { type: 'number' },
                activeAlerts: { type: 'number' },
                errorRate: { type: 'number' },
                avgResponseTime: { type: 'number' },
              },
            },
            trends: {
              type: 'object',
              properties: {
                eventsGrowth: { type: 'number' },
                metricsGrowth: { type: 'number' },
                errorRateChange: { type: 'number' },
                responseTimeChange: { type: 'number' },
              },
            },
            topSources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string' },
                  eventCount: { type: 'number' },
                  metricCount: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<OverviewQueryInterface>, reply: FastifyReply) => {
    try {
      const query = request.query;

      // Default to last 24 hours if no time range specified
      const endTime = query.endTime || new Date().toISOString();
      const startTime = query.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Previous period for comparison (same duration)
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
      const previousStartTime = new Date(new Date(startTime).getTime() - duration).toISOString();
      const previousEndTime = startTime;

      // Get current period stats
      const [eventsResult, metricsResult, alertsResult] = await Promise.all([
        // Total events in current period
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE level IN ('critical', 'high')) as errors,
            AVG(EXTRACT(EPOCH FROM (NOW() - timestamp))) as avg_age
          FROM events 
          WHERE timestamp >= $1 AND timestamp <= $2
        `, [startTime, endTime]),

        // Total metrics in current period  
        db.query(`
          SELECT 
            COUNT(*) as total,
            AVG(value) FILTER (WHERE name LIKE '%response_time%') as avg_response_time
          FROM metrics 
          WHERE timestamp >= $1 AND timestamp <= $2
        `, [startTime, endTime]),

        // Active alerts
        db.query(`
          SELECT COUNT(*) as active_alerts
          FROM alert_instances 
          WHERE status = 'active'
        `),
      ]);

      // Get previous period stats for trends
      const [prevEventsResult, prevMetricsResult] = await Promise.all([
        db.query(`
          SELECT COUNT(*) as total
          FROM events 
          WHERE timestamp >= $1 AND timestamp <= $2
        `, [previousStartTime, previousEndTime]),

        db.query(`
          SELECT 
            COUNT(*) as total,
            AVG(value) FILTER (WHERE name LIKE '%response_time%') as avg_response_time
          FROM metrics 
          WHERE timestamp >= $1 AND timestamp <= $2
        `, [previousStartTime, previousEndTime]),
      ]);

      // Get top sources
      const topSourcesResult = await db.query(`
        SELECT 
          COALESCE(e.source, m.source) as source,
          COALESCE(e.event_count, 0) as event_count,
          COALESCE(m.metric_count, 0) as metric_count
        FROM (
          SELECT source, COUNT(*) as event_count
          FROM events 
          WHERE timestamp >= $1 AND timestamp <= $2
          GROUP BY source
        ) e
        FULL OUTER JOIN (
          SELECT source, COUNT(*) as metric_count
          FROM metrics 
          WHERE timestamp >= $1 AND timestamp <= $2
          GROUP BY source
        ) m ON e.source = m.source
        ORDER BY (COALESCE(e.event_count, 0) + COALESCE(m.metric_count, 0)) DESC
        LIMIT 10
      `, [startTime, endTime]);

      // Calculate summary
      const currentStats = {
        totalEvents: parseInt(eventsResult.rows[0].total) || 0,
        totalMetrics: parseInt(metricsResult.rows[0].total) || 0,
        activeAlerts: parseInt(alertsResult.rows[0].active_alerts) || 0,
        errorRate: parseInt(eventsResult.rows[0].errors) / Math.max(parseInt(eventsResult.rows[0].total), 1),
        avgResponseTime: parseFloat(metricsResult.rows[0].avg_response_time) || 0,
      };

      // Calculate trends (growth rates)
      const previousEvents = parseInt(prevEventsResult.rows[0].total) || 1;
      const previousMetrics = parseInt(prevMetricsResult.rows[0].total) || 1;
      const previousResponseTime = parseFloat(prevMetricsResult.rows[0].avg_response_time) || 1;

      const trends = {
        eventsGrowth: ((currentStats.totalEvents - previousEvents) / previousEvents) * 100,
        metricsGrowth: ((currentStats.totalMetrics - previousMetrics) / previousMetrics) * 100,
        errorRateChange: 0, // Would need more complex calculation
        responseTimeChange: ((currentStats.avgResponseTime - previousResponseTime) / previousResponseTime) * 100,
      };

      reply.send({
        summary: currentStats,
        trends,
        topSources: topSourcesResult.rows.map((row: any) => ({
          source: row.source,
          eventCount: parseInt(row.event_count),
          metricCount: parseInt(row.metric_count),
        })),
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get dashboard overview',
      });
    }
  });

  // Get time series data for charts
  fastify.get('/timeseries', {
    schema: {
      description: 'Get time series data for dashboard charts',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          metrics: { type: 'array', items: { type: 'string' }, minItems: 1 },
          sources: { type: 'array', items: { type: 'string' } },
          interval: { type: 'string', enum: ['1m', '5m', '15m', '1h', '6h', '1d'], default: '5m' },
          aggregation: { type: 'string', enum: ['avg', 'sum', 'min', 'max', 'count'], default: 'avg' }
        },
        required: ['startTime', 'endTime', 'metrics']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            series: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  source: { type: 'string' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        timestamp: { type: 'string' },
                        value: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<TimeSeriesQueryInterface>, reply: FastifyReply) => {
    try {
      const query = request.query;

      // Map interval to PostgreSQL time_bucket interval
      const intervalMap: Record<string, string> = {
        '1m': '1 minute',
        '5m': '5 minutes',
        '15m': '15 minutes',
        '1h': '1 hour',
        '6h': '6 hours',
        '1d': '1 day',
      };

      const bucketInterval = intervalMap[query.interval];
      const aggFunction = query.aggregation === 'count' ? 'COUNT(*)' : `${query.aggregation.toUpperCase()}(value)`;

      // Build WHERE clause for sources
      const sourceCondition = query.sources && query.sources.length > 0 
        ? `AND source = ANY($4)` 
        : '';
      
      const params = [
        bucketInterval,
        query.startTime,
        query.endTime,
        ...(query.sources && query.sources.length > 0 ? [query.sources] : []),
      ];

      const series = [];

      // Get data for each requested metric
      for (const metricName of query.metrics) {
        const metricParams = [...params];
        metricParams.splice(1, 0, metricName); // Insert metric name as second parameter

        const result = await db.query(`
          SELECT 
            time_bucket($1, timestamp) as timestamp,
            source,
            ${aggFunction} as value
          FROM metrics 
          WHERE name = $2 
            AND timestamp >= $3 
            AND timestamp <= $4
            ${sourceCondition}
          GROUP BY time_bucket($1, timestamp), source
          ORDER BY timestamp, source
        `, metricParams);

        // Group by source
        const sourceGroups: Record<string, Array<{ timestamp: string; value: number }>> = {};
        
        for (const row of result.rows) {
          const source = row.source;
          if (!sourceGroups[source]) {
            sourceGroups[source] = [];
          }
          sourceGroups[source].push({
            timestamp: row.timestamp,
            value: parseFloat(row.value) || 0,
          });
        }

        // Add series for each source
        for (const [source, data] of Object.entries(sourceGroups)) {
          series.push({
            name: metricName,
            source,
            data,
          });
        }

        // If no sources specified or no data, create empty series
        if (Object.keys(sourceGroups).length === 0) {
          series.push({
            name: metricName,
            source: 'unknown',
            data: [],
          });
        }
      }

      reply.send({ series });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get time series data',
      });
    }
  });

  // Get top lists (errors, slow requests, etc.)
  fastify.get('/top/:type', {
    schema: {
      description: 'Get top lists for dashboard widgets',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['errors', 'slow_requests', 'traffic_sources', 'user_agents'] },
        },
        required: ['type'],
      },
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'number' },
                  change: { type: 'number' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<TopListParamsInterface>, reply: FastifyReply) => {
    try {
      const { type } = request.params;
      const query = request.query;
      
      // Default to last 24 hours
      const endTime = query.endTime || new Date().toISOString();
      const startTime = query.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const limit = query.limit || 10;

      let result;
      
      switch (type) {
        case 'errors':
          result = await db.query(`
            SELECT 
              message as label,
              COUNT(*) as value,
              source,
              level
            FROM events 
            WHERE timestamp >= $1 
              AND timestamp <= $2 
              AND level IN ('critical', 'high', 'error')
            GROUP BY message, source, level
            ORDER BY value DESC
            LIMIT $3
          `, [startTime, endTime, limit]);
          break;

        case 'slow_requests':
          result = await db.query(`
            SELECT 
              COALESCE(dimensions->>'endpoint', 'unknown') as label,
              AVG(value) as value,
              COUNT(*) as request_count
            FROM metrics 
            WHERE timestamp >= $1 
              AND timestamp <= $2 
              AND name LIKE '%response_time%'
            GROUP BY dimensions->>'endpoint'
            ORDER BY value DESC
            LIMIT $3
          `, [startTime, endTime, limit]);
          break;

        case 'traffic_sources':
          result = await db.query(`
            SELECT 
              source as label,
              COUNT(*) as value,
              COUNT(DISTINCT session_id) as unique_sessions
            FROM events 
            WHERE timestamp >= $1 
              AND timestamp <= $2 
              AND type = 'user_action'
            GROUP BY source
            ORDER BY value DESC
            LIMIT $3
          `, [startTime, endTime, limit]);
          break;

        case 'user_agents':
          result = await db.query(`
            SELECT 
              COALESCE(user_agent, 'unknown') as label,
              COUNT(*) as value,
              COUNT(DISTINCT session_id) as unique_sessions
            FROM events 
            WHERE timestamp >= $1 
              AND timestamp <= $2 
              AND user_agent IS NOT NULL
            GROUP BY user_agent
            ORDER BY value DESC
            LIMIT $3
          `, [startTime, endTime, limit]);
          break;

        default:
          reply.code(400).send({
            error: 'Bad Request',
            message: 'Invalid top list type',
          });
          return;
      }

      const items = result.rows.map((row: any) => ({
        label: row.label,
        value: parseFloat(row.value) || 0,
        change: 0, // Would need previous period comparison
        metadata: {
          ...(row.source && { source: row.source }),
          ...(row.level && { level: row.level }),
          ...(row.request_count && { requestCount: parseInt(row.request_count) }),
          ...(row.unique_sessions && { uniqueSessions: parseInt(row.unique_sessions) }),
        },
      }));

      reply.send({ items });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get top list',
      });
    }
  });

  // Get heatmap data
  fastify.get('/heatmap', {
    schema: {
      description: 'Get heatmap data for visualization',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          metric: { type: 'string' },
          source: { type: 'string' },
          xAxis: { type: 'string', enum: ['hour', 'day', 'week'], default: 'day' },
          yAxis: { type: 'string' }
        },
        required: ['startTime', 'endTime', 'metric', 'yAxis']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'string' },
                  y: { type: 'string' },
                  value: { type: 'number' },
                },
              },
            },
            xLabels: { type: 'array', items: { type: 'string' } },
            yLabels: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<HeatmapQueryInterface>, reply: FastifyReply) => {
    try {
      const query = request.query;

      // Map xAxis to PostgreSQL date_trunc
      const xAxisMap = {
        hour: 'hour',
        day: 'day',
        week: 'week',
      };

      const sourceCondition = query.source ? `AND source = $4` : '';
      const params = [
        query.metric,
        query.startTime,
        query.endTime,
        ...(query.source ? [query.source] : []),
      ];

      // Build query based on yAxis (dimension key)
      const result = await db.query(`
        SELECT 
          date_trunc('${xAxisMap[query.xAxis]}', timestamp) as x_value,
          COALESCE(dimensions->>'${query.yAxis}', 'unknown') as y_value,
          AVG(value) as value
        FROM metrics 
        WHERE name = $1 
          AND timestamp >= $2 
          AND timestamp <= $3
          ${sourceCondition}
        GROUP BY date_trunc('${xAxisMap[query.xAxis]}', timestamp), dimensions->>'${query.yAxis}'
        ORDER BY x_value, y_value
      `, params);

      // Transform data for heatmap
      const data = result.rows.map((row: any) => ({
        x: row.x_value,
        y: row.y_value,
        value: parseFloat(row.value) || 0,
      }));

      // Extract unique labels for axes
      const xLabels = [...new Set(data.map((d: any) => d.x))].sort();
      const yLabels = [...new Set(data.map((d: any) => d.y))].sort();

      reply.send({
        data,
        xLabels,
        yLabels,
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get heatmap data',
      });
    }
  });

  // Get real-time dashboard data
  fastify.get('/realtime', {
    schema: {
      description: 'Get real-time dashboard metrics',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            timestamp: { type: 'string' },
            activeConnections: { type: 'number' },
            eventsPerSecond: { type: 'number' },
            metricsPerSecond: { type: 'number' },
            errorRate: { type: 'number' },
            avgResponseTime: { type: 'number' },
            systemHealth: {
              type: 'object',
              properties: {
                cpu: { type: 'number' },
                memory: { type: 'number' },
                disk: { type: 'number' },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get recent metrics from Redis (faster than database)
      const [eventsPerSec, metricsPerSec, errorRate] = await Promise.all([
        redis.getMetricValue('events_per_second'),
        redis.getMetricValue('metrics_per_second'),
        redis.getMetricValue('error_rate'),
      ]);

      // Get latest response time from database
      const responseTimeResult = await db.query(`
        SELECT value
        FROM metrics 
        WHERE name LIKE '%response_time%' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      const avgResponseTime = responseTimeResult.rows.length > 0 
        ? parseFloat(responseTimeResult.rows[0].value) 
        : 0;

      // Get system health metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      reply.send({
        timestamp: new Date().toISOString(),
        activeConnections: fastify.stats?.activeConnections || 0,
        eventsPerSecond: eventsPerSec,
        metricsPerSecond: metricsPerSec,
        errorRate: errorRate / 100, // Convert to percentage
        avgResponseTime,
        systemHealth: {
          cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
          memory: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          disk: 0, // Would need additional library to get disk usage
        },
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get real-time data',
      });
    }
  });

  // Create custom dashboard widget
  fastify.post('/widgets', {
    schema: {
      description: 'Create custom dashboard widget',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['chart', 'table', 'single-value', 'heatmap'] },
          query: { type: 'object' },
          config: { type: 'object' },
        },
        required: ['name', 'type', 'query'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [requirePermission('write')],
  }, async (request: FastifyRequest<CreateWidgetInterface>, reply: FastifyReply) => {
    try {
      const body = request.body;

      // Store widget configuration in Redis
      const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const widget = {
        id: widgetId,
        name: body.name,
        type: body.type,
        query: body.query,
        config: body.config || {},
        createdAt: new Date().toISOString(),
        createdBy: (request as any).apiKey?.name || 'unknown',
      };

      await redis.setJSON(`dashboard:widget:${widgetId}`, widget);

      reply.code(201).send({
        id: widgetId,
        message: 'Widget created successfully',
      });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create widget',
      });
    }
  });

  // Get dashboard widgets
  fastify.get('/widgets', {
    schema: {
      description: 'Get all dashboard widgets',
      tags: ['dashboard'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            widgets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  config: { type: 'object' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get widget keys from Redis
      const keys = await (redis as any).client.keys('dashboard:widget:*');
      const widgets = [];

      for (const key of keys) {
        const widget = await redis.getJSON(key);
        if (widget && typeof widget === 'object') {
          // Don't expose the full query in list view
          widgets.push({
            id: (widget as any).id,
            name: (widget as any).name,
            type: (widget as any).type,
            config: (widget as any).config,
            createdAt: (widget as any).createdAt,
          });
        }
      }

      reply.send({ widgets });

    } catch (error) {
      fastify.log.error({ error }, 'Error in dashboard route');
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get widgets',
      });
    }
  });
}