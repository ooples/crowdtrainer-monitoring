import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { getWebSocketManager } from '../websocket';
import { requirePermission } from '../middleware';
import { Metric, MetricSchema } from '../types';

// Request schemas
const CreateMetricSchema = z.object({
  body: MetricSchema.omit({ timestamp: true }),
});

const BulkCreateMetricsSchema = z.object({
  body: z.object({
    metrics: z.array(MetricSchema.omit({ timestamp: true })).max(1000),
  }),
});

const QueryMetricsSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    name: z.array(z.string()).or(z.string()).optional(),
    source: z.array(z.string()).or(z.string()).optional(),
    unit: z.string().optional(),
    dimensions: z.record(z.string()).optional(),
    aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
    groupBy: z.array(z.string()).optional(),
    interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).default('5m'),
    limit: z.coerce.number().min(1).max(10000).default(1000),
    offset: z.coerce.number().min(0).default(0),
  }),
});

const MetricStatsSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    name: z.array(z.string()).or(z.string()).optional(),
    source: z.array(z.string()).or(z.string()).optional(),
    groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  }),
});

export default async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();
  const redis = getRedis();

  // Create single metric
  fastify.post<{
    Body: z.infer<typeof CreateMetricSchema.shape.body>;
  }>('/', {
    schema: {
      description: 'Create a new metric',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          unit: { type: 'string' },
          dimensions: { type: 'object', additionalProperties: true },
          source: { type: 'string' }
        },
        required: ['name', 'value', 'source']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [requirePermission('write')],
  }, async (request, reply) => {
    try {
      const { body } = CreateMetricSchema.parse(request);
      
      // Add server-side timestamp
      const metric: Metric = {
        ...body,
        timestamp: new Date().toISOString(),
      };

      // Validate metric
      const validatedMetric = MetricSchema.parse(metric);

      // Store in database
      const result = await db.query(`
        INSERT INTO metrics (name, value, timestamp, unit, dimensions, source)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        validatedMetric.name,
        validatedMetric.value,
        validatedMetric.timestamp,
        validatedMetric.unit,
        JSON.stringify(validatedMetric.dimensions || {}),
        validatedMetric.source,
      ]);

      const metricId = result.rows[0].id;

      // Publish to Redis for real-time updates
      await redis.publish('metrics:realtime', {
        ...validatedMetric,
        id: metricId,
      });

      // Store in Redis for fast access (with TTL)
      const cacheKey = `metric:${validatedMetric.name}:${validatedMetric.source}:latest`;
      await redis.setJSON(cacheKey, { ...validatedMetric, id: metricId }, 3600); // 1 hour TTL

      // Update server stats
      if (fastify.stats) {
        fastify.stats.metricsProcessed++;
      }

      // Send to WebSocket subscribers
      const wsManager = getWebSocketManager();
      wsManager.broadcast('metrics:realtime', {
        type: 'metric',
        data: { ...validatedMetric, id: metricId },
      });

      reply.code(201).send({
        id: metricId,
        message: 'Metric created successfully',
      });

    } catch (error) {
      request.log.error("Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create metric',
      });
    }
  });

  // Create multiple metrics (bulk)
  fastify.post<{
    Body: z.infer<typeof BulkCreateMetricsSchema.shape.body>;
  }>('/bulk', {
    schema: {
      description: 'Create multiple metrics in bulk',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            maxItems: 1000,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
                unit: { type: 'string' },
                dimensions: { type: 'object', additionalProperties: true },
                source: { type: 'string' }
              },
              required: ['name', 'value', 'source']
            }
          }
        },
        required: ['metrics']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [requirePermission('write')],
  }, async (request, reply) => {
    try {
      const { body } = BulkCreateMetricsSchema.parse(request);
      
      if (body.metrics.length === 0) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'At least one metric is required',
        });
        return;
      }

      // Process metrics in transaction
      const createdIds = await db.transaction(async (client) => {
        const ids: string[] = [];
        const timestamp = new Date().toISOString();
        
        for (const metricData of body.metrics) {
          const metric: Metric = {
            ...metricData,
            timestamp,
          };

          const validatedMetric = MetricSchema.parse(metric);

          const result = await client.query(`
            INSERT INTO metrics (name, value, timestamp, unit, dimensions, source)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [
            validatedMetric.name,
            validatedMetric.value,
            validatedMetric.timestamp,
            validatedMetric.unit,
            JSON.stringify(validatedMetric.dimensions || {}),
            validatedMetric.source,
          ]);

          ids.push(result.rows[0].id);

          // Publish to Redis for real-time updates
          await redis.publish('metrics:realtime', {
            ...validatedMetric,
            id: result.rows[0].id,
          });

          // Cache latest value
          const cacheKey = `metric:${validatedMetric.name}:${validatedMetric.source}:latest`;
          await redis.setJSON(cacheKey, { ...validatedMetric, id: result.rows[0].id }, 3600);
        }

        return ids;
      });

      // Update server stats
      if (fastify.stats) {
        fastify.stats.metricsProcessed += createdIds.length;
      }

      reply.code(201).send({
        created: createdIds.length,
        message: `${createdIds.length} metrics created successfully`,
      });

    } catch (error) {
      request.log.error("Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create metrics',
      });
    }
  });

  // Query metrics with aggregation
  fastify.get<{
    Querystring: z.infer<typeof QueryMetricsSchema.shape.query>;
  }>('/', {
    schema: {
      description: 'Query metrics with filtering, aggregation, and time-based grouping',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          name: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          source: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          unit: { type: 'string' },
          dimensions: { type: 'object', additionalProperties: true },
          aggregation: { type: 'string', enum: ['avg', 'sum', 'min', 'max', 'count'], default: 'avg' },
          groupBy: { type: 'array', items: { type: 'string' } },
          interval: { type: 'string', enum: ['1m', '5m', '15m', '1h', '6h', '1d'], default: '5m' },
          limit: { type: 'number', minimum: 1, maximum: 10000, default: 1000 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                  name: { type: 'string' },
                  value: { type: 'number' },
                  unit: { type: 'string' },
                  source: { type: 'string' },
                  dimensions: { type: 'object' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                offset: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request, reply) => {
    try {
      const { query } = QueryMetricsSchema.parse(request);

      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (query.startTime) {
        conditions.push(`timestamp >= $${++paramCount}`);
        params.push(query.startTime);
      }

      if (query.endTime) {
        conditions.push(`timestamp <= $${++paramCount}`);
        params.push(query.endTime);
      }

      if (query.name) {
        const names = Array.isArray(query.name) ? query.name : [query.name];
        conditions.push(`name = ANY($${++paramCount})`);
        params.push(names);
      }

      if (query.source) {
        const sources = Array.isArray(query.source) ? query.source : [query.source];
        conditions.push(`source = ANY($${++paramCount})`);
        params.push(sources);
      }

      if (query.unit) {
        conditions.push(`unit = $${++paramCount}`);
        params.push(query.unit);
      }

      if (query.dimensions) {
        conditions.push(`dimensions @> $${++paramCount}`);
        params.push(JSON.stringify(query.dimensions));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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

      // Build GROUP BY clause
      const groupByFields = ['time_bucket($' + (++paramCount) + ', timestamp)', 'name', 'source'];
      params.push(bucketInterval);

      if (query.groupBy) {
        // Add additional grouping fields from dimensions
        for (const field of query.groupBy) {
          groupByFields.push(`dimensions->>'${field}'`);
        }
      }

      // Build aggregation function
      const aggFunction = query.aggregation === 'count' ? 'COUNT(*)' : `${query.aggregation.toUpperCase()}(value)`;

      // Get total count (for pagination)
      const countResult = await db.query(`
        SELECT COUNT(DISTINCT (time_bucket('${bucketInterval}', timestamp), name, source)) as total 
        FROM metrics ${whereClause}
      `, params.slice(0, -1)); // Remove interval parameter for count query

      const total = parseInt(countResult.rows[0].total);

      // Get aggregated metrics
      const metricsResult = await db.query(`
        SELECT 
          time_bucket($${paramCount}, timestamp) as timestamp,
          name,
          source,
          ${aggFunction} as value,
          unit,
          dimensions
        FROM metrics 
        ${whereClause}
        GROUP BY ${groupByFields.join(', ')}, unit, dimensions
        ORDER BY timestamp DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, query.limit, query.offset]);

      reply.send({
        metrics: metricsResult.rows,
        pagination: {
          offset: query.offset,
          limit: query.limit,
          total,
        },
      });

    } catch (error) {
      request.log.error("Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to query metrics',
      });
    }
  });

  // Get latest metric values
  fastify.get<{
    Querystring: { name?: string | string[]; source?: string | string[] };
  }>('/latest', {
    schema: {
      description: 'Get latest values for metrics',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          name: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          source: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'number' },
                  timestamp: { type: 'string' },
                  source: { type: 'string' },
                  unit: { type: 'string' },
                  dimensions: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request, reply) => {
    try {
      const query = request.query;

      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (query.name) {
        const names = Array.isArray(query.name) ? query.name : [query.name];
        conditions.push(`name = ANY($${++paramCount})`);
        params.push(names);
      }

      if (query.source) {
        const sources = Array.isArray(query.source) ? query.source : [query.source];
        conditions.push(`source = ANY($${++paramCount})`);
        params.push(sources);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Use window function to get latest value for each metric name + source combination
      const result = await db.query(`
        SELECT DISTINCT ON (name, source)
          name, value, timestamp, source, unit, dimensions
        FROM metrics 
        ${whereClause}
        ORDER BY name, source, timestamp DESC
      `, params);

      reply.send({
        metrics: result.rows,
      });

    } catch (error) {
      request.log.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get latest metrics',
      });
    }
  });

  // Get metric names (for autocomplete/discovery)
  fastify.get('/names', {
    schema: {
      description: 'Get all available metric names',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            names: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request, reply) => {
    try {
      const result = await db.query(`
        SELECT DISTINCT name FROM metrics 
        ORDER BY name
      `);

      reply.send({
        names: result.rows.map((row: any) => row.name),
      });

    } catch (error) {
      request.log.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get metric names',
      });
    }
  });

  // Get metric sources (for filtering)
  fastify.get('/sources', {
    schema: {
      description: 'Get all available metric sources',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            sources: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request, reply) => {
    try {
      const result = await db.query(`
        SELECT DISTINCT source FROM metrics 
        ORDER BY source
      `);

      reply.send({
        sources: result.rows.map((row: any) => row.source),
      });

    } catch (error) {
      request.log.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get metric sources',
      });
    }
  });

  // Get metric statistics
  fastify.get<{
    Querystring: z.infer<typeof MetricStatsSchema.shape.query>;
  }>('/stats', {
    schema: {
      description: 'Get metric statistics',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          name: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          source: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          groupBy: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            stats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string' },
                  total_metrics: { type: 'number' },
                  unique_names: { type: 'number' },
                  unique_sources: { type: 'number' },
                  avg_value: { type: 'number' },
                  min_value: { type: 'number' },
                  max_value: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requirePermission('read')],
  }, async (request, reply) => {
    try {
      const { query } = MetricStatsSchema.parse(request);

      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (query.startTime) {
        conditions.push(`timestamp >= $${++paramCount}`);
        params.push(query.startTime);
      }

      if (query.endTime) {
        conditions.push(`timestamp <= $${++paramCount}`);
        params.push(query.endTime);
      }

      if (query.name) {
        const names = Array.isArray(query.name) ? query.name : [query.name];
        conditions.push(`name = ANY($${++paramCount})`);
        params.push(names);
      }

      if (query.source) {
        const sources = Array.isArray(query.source) ? query.source : [query.source];
        conditions.push(`source = ANY($${++paramCount})`);
        params.push(sources);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Determine time bucket based on groupBy
      const timeBucketMap = {
        hour: '1 hour',
        day: '1 day',
        week: '1 week',
        month: '1 month',
      };

      const result = await db.query(`
        SELECT 
          time_bucket('${timeBucketMap[query.groupBy]}', timestamp) AS period,
          COUNT(*) as total_metrics,
          COUNT(DISTINCT name) as unique_names,
          COUNT(DISTINCT source) as unique_sources,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value
        FROM metrics ${whereClause}
        GROUP BY period
        ORDER BY period DESC
        LIMIT 100
      `, params);

      const stats = result.rows.map((row: any) => ({
        period: row.period,
        total_metrics: parseInt(row.total_metrics),
        unique_names: parseInt(row.unique_names),
        unique_sources: parseInt(row.unique_sources),
        avg_value: parseFloat(row.avg_value) || 0,
        min_value: parseFloat(row.min_value) || 0,
        max_value: parseFloat(row.max_value) || 0,
      }));

      reply.send({ stats });

    } catch (error) {
      request.log.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get metric statistics',
      });
    }
  });

  // Delete metric (admin only)
  fastify.delete<{
    Params: { id: string };
  }>('/:id', {
    schema: {
      description: 'Delete metric by ID (admin only)',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [requirePermission('admin')],
  }, async (request, reply) => {
    try {
      const result = await db.query('DELETE FROM metrics WHERE id = $1', [request.params.id]);

      if (result.rowCount === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Metric not found',
        });
        return;
      }

      reply.send({
        message: 'Metric deleted successfully',
      });

    } catch (error) {
      request.log.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete metric',
      });
    }
  });

  // Increment metric (convenient endpoint for counters)
  fastify.post<{
    Params: { name: string };
    Body: { value?: number; source: string; dimensions?: Record<string, string> };
  }>('/increment/:name', {
    schema: {
      description: 'Increment a metric by a value',
      tags: ['metrics'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      body: {
        type: 'object',
        properties: {
          value: { type: 'number', default: 1 },
          source: { type: 'string' },
          dimensions: { type: 'object' },
        },
        required: ['source'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            newValue: { type: 'number' },
          },
        },
      },
    },
    preHandler: [requirePermission('write')],
  }, async (request, reply) => {
    try {
      const { name } = request.params;
      const { value = 1, source, dimensions } = request.body;

      // Create the increment metric
      const metric: Metric = {
        name,
        value,
        source,
        dimensions,
        timestamp: new Date().toISOString(),
      };

      const validatedMetric = MetricSchema.parse(metric);

      // Store in database
      const result = await db.query(`
        INSERT INTO metrics (name, value, timestamp, unit, dimensions, source)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        validatedMetric.name,
        validatedMetric.value,
        validatedMetric.timestamp,
        validatedMetric.unit,
        JSON.stringify(validatedMetric.dimensions || {}),
        validatedMetric.source,
      ]);

      // Also increment in Redis for fast access
      const redisKey = `metric:counter:${name}:${source}`;
      const newValue = await redis.incrementMetric(redisKey, value);

      // Publish to Redis for real-time updates
      await redis.publish('metrics:realtime', {
        ...validatedMetric,
        id: result.rows[0].id,
      });

      reply.send({
        message: 'Metric incremented successfully',
        newValue,
      });

    } catch (error) {
      request.log.error("Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to increment metric',
      });
    }
  });
}