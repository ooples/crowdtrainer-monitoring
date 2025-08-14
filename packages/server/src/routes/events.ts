import { FastifyInstance, FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { getWebSocketManager } from '../websocket';
import { requirePermission } from '../middleware';
import { Event, EventSchema } from '../types';


// Request type interfaces
interface CreateEventRequest extends RouteGenericInterface {
  Body: z.infer<typeof CreateEventSchema.shape.body>;
}

interface BulkCreateEventsRequest extends RouteGenericInterface {
  Body: z.infer<typeof BulkCreateEventsSchema.shape.body>;
}

interface QueryEventsRequest extends RouteGenericInterface {
  Querystring: z.infer<typeof QueryEventsSchema.shape.query>;
}

interface EventByIdRequest extends RouteGenericInterface {
  Params: { id: string };
}

interface EventStatsRequest extends RouteGenericInterface {
  Querystring: z.infer<typeof EventStatsSchema.shape.query>;
}

// Request schemas
const CreateEventSchema = z.object({
  body: EventSchema.omit({ id: true, timestamp: true }),
});

const BulkCreateEventsSchema = z.object({
  body: z.object({
    events: z.array(EventSchema.omit({ id: true, timestamp: true })).max(1000),
  }),
});

const QueryEventsSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    type: z.array(z.string()).or(z.string()).optional(),
    level: z.array(z.string()).or(z.string()).optional(),
    source: z.array(z.string()).or(z.string()).optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    requestId: z.string().optional(),
    tags: z.array(z.string()).or(z.string()).optional(),
    search: z.string().optional(),
    limit: z.coerce.number().min(1).max(10000).default(100),
    offset: z.coerce.number().min(0).default(0),
    orderBy: z.enum(['timestamp', 'level', 'type', 'source']).default('timestamp'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const EventStatsSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
    type: z.array(z.string()).or(z.string()).optional(),
    level: z.array(z.string()).or(z.string()).optional(),
    source: z.array(z.string()).or(z.string()).optional(),
  }),
});

export default async function eventsRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();
  const redis = getRedis();

  // Create single event
  fastify.post<CreateEventRequest>('/', {
    schema: {
      description: 'Create a new event',
      tags: ['events'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['error', 'warning', 'info', 'debug', 'performance', 'user_action', 'system', 'security', 'business'] },
          level: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          source: { type: 'string' },
          message: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
          userId: { type: 'string' },
          sessionId: { type: 'string' },
          requestId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          stack: { type: 'string' },
          url: { type: 'string' },
          userAgent: { type: 'string' },
          ip: { type: 'string' }
        },
        required: ['type', 'source', 'message']
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
    } as any,
    preHandler: [requirePermission('write')],
  }, async (request: FastifyRequest<CreateEventRequest>, reply: FastifyReply) => {
    try {
      const { body } = CreateEventSchema.parse(request);
      
      // Add server-side metadata
      const event: Event = {
        ...body,
        timestamp: new Date().toISOString(),
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      // Validate event
      const validatedEvent = EventSchema.parse(event);

      // Store in database
      const result = await db.query(`
        INSERT INTO events (
          timestamp, type, level, source, message, metadata,
          user_id, session_id, request_id, tags, stack, url, user_agent, ip
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING id
      `, [
        validatedEvent.timestamp,
        validatedEvent.type,
        validatedEvent.level,
        validatedEvent.source,
        validatedEvent.message,
        JSON.stringify(validatedEvent.metadata || {}),
        validatedEvent.userId,
        validatedEvent.sessionId,
        validatedEvent.requestId,
        validatedEvent.tags || [],
        validatedEvent.stack,
        validatedEvent.url,
        validatedEvent.userAgent,
        validatedEvent.ip,
      ]);

      const eventId = result.rows[0].id;

      // Publish to Redis for real-time updates
      await redis.publish('events:realtime', {
        ...validatedEvent,
        id: eventId,
      });

      // Update server stats
      if (fastify.stats) {
        fastify.stats.eventsProcessed++;
      }

      // Send to WebSocket subscribers
      const wsManager = getWebSocketManager();
      wsManager.broadcast('events:realtime', {
        type: 'event',
        data: { ...validatedEvent, id: eventId },
      });

      reply.code(201).send({
        id: eventId,
        message: 'Event created successfully',
      });

    } catch (error) {
      request.log.error({ error }, "Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create event',
      });
    }
  });

  // Create multiple events (bulk)
  fastify.post<BulkCreateEventsRequest>('/bulk', {
    schema: {
      description: 'Create multiple events in bulk',
      tags: ['events'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            maxItems: 1000,
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['error', 'warning', 'info', 'debug', 'performance', 'user_action', 'system', 'security', 'business'] },
                level: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
                source: { type: 'string' },
                message: { type: 'string' },
                metadata: { type: 'object', additionalProperties: true },
                userId: { type: 'string' },
                sessionId: { type: 'string' },
                requestId: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                stack: { type: 'string' },
                url: { type: 'string' },
                userAgent: { type: 'string' },
                ip: { type: 'string' }
              },
              required: ['type', 'source', 'message']
            }
          }
        },
        required: ['events']
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
    } as any,
    preHandler: [requirePermission('write')],
  }, async (request: FastifyRequest<BulkCreateEventsRequest>, reply: FastifyReply) => {
    try {
      const { body } = BulkCreateEventsSchema.parse(request);
      
      if (body.events.length === 0) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'At least one event is required',
        });
        return;
      }

      // Process events in transaction
      const createdIds = await db.transaction(async (client) => {
        const ids: string[] = [];
        
        for (const eventData of body.events) {
          const event: Event = {
            ...eventData,
            timestamp: new Date().toISOString(),
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          };

          const validatedEvent = EventSchema.parse(event);

          const result = await client.query(`
            INSERT INTO events (
              timestamp, type, level, source, message, metadata,
              user_id, session_id, request_id, tags, stack, url, user_agent, ip
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            ) RETURNING id
          `, [
            validatedEvent.timestamp,
            validatedEvent.type,
            validatedEvent.level,
            validatedEvent.source,
            validatedEvent.message,
            JSON.stringify(validatedEvent.metadata || {}),
            validatedEvent.userId,
            validatedEvent.sessionId,
            validatedEvent.requestId,
            validatedEvent.tags || [],
            validatedEvent.stack,
            validatedEvent.url,
            validatedEvent.userAgent,
            validatedEvent.ip,
          ]);

          ids.push(result.rows[0].id);

          // Publish to Redis for real-time updates
          await redis.publish('events:realtime', {
            ...validatedEvent,
            id: result.rows[0].id,
          });
        }

        return ids;
      });

      // Update server stats
      if (fastify.stats) {
        fastify.stats.eventsProcessed += createdIds.length;
      }

      reply.code(201).send({
        created: createdIds.length,
        message: `${createdIds.length} events created successfully`,
      });

    } catch (error) {
      request.log.error({ error }, "Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create events',
      });
    }
  });

  // Query events
  fastify.get<QueryEventsRequest>('/', {
    schema: {
      description: 'Query events with filtering and pagination',
      tags: ['events'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          type: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          level: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          source: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          userId: { type: 'string' },
          sessionId: { type: 'string' },
          requestId: { type: 'string' },
          tags: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          search: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 10000, default: 100 },
          offset: { type: 'number', minimum: 0, default: 0 },
          orderBy: { type: 'string', enum: ['timestamp', 'level', 'type', 'source'], default: 'timestamp' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  timestamp: { type: 'string' },
                  type: { type: 'string' },
                  level: { type: 'string' },
                  source: { type: 'string' },
                  message: { type: 'string' },
                  metadata: { type: 'object' },
                  user_id: { type: 'string' },
                  session_id: { type: 'string' },
                  request_id: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
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
    } as any,
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<QueryEventsRequest>, reply: FastifyReply) => {
    try {
      const { query } = QueryEventsSchema.parse(request);

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

      if (query.type) {
        const types = Array.isArray(query.type) ? query.type : [query.type];
        conditions.push(`type = ANY($${++paramCount})`);
        params.push(types);
      }

      if (query.level) {
        const levels = Array.isArray(query.level) ? query.level : [query.level];
        conditions.push(`level = ANY($${++paramCount})`);
        params.push(levels);
      }

      if (query.source) {
        const sources = Array.isArray(query.source) ? query.source : [query.source];
        conditions.push(`source = ANY($${++paramCount})`);
        params.push(sources);
      }

      if (query.userId) {
        conditions.push(`user_id = $${++paramCount}`);
        params.push(query.userId);
      }

      if (query.sessionId) {
        conditions.push(`session_id = $${++paramCount}`);
        params.push(query.sessionId);
      }

      if (query.requestId) {
        conditions.push(`request_id = $${++paramCount}`);
        params.push(query.requestId);
      }

      if (query.tags) {
        const tags = Array.isArray(query.tags) ? query.tags : [query.tags];
        conditions.push(`tags && $${++paramCount}`);
        params.push(tags);
      }

      if (query.search) {
        conditions.push(`(message ILIKE $${++paramCount} OR source ILIKE $${paramCount})`);
        params.push(`%${query.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total FROM events ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get events
      const eventsResult = await db.query(`
        SELECT 
          id, timestamp, type, level, source, message, metadata,
          user_id, session_id, request_id, tags, stack, url, user_agent, ip
        FROM events 
        ${whereClause}
        ORDER BY ${query.orderBy} ${query.order}
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, query.limit, query.offset]);

      reply.send({
        events: eventsResult.rows,
        pagination: {
          offset: query.offset,
          limit: query.limit,
          total,
        },
      });

    } catch (error) {
      request.log.error({ error }, "Error occurred");
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to query events',
      });
    }
  });

  // Get event by ID
  fastify.get<EventByIdRequest>('/:id', {
    schema: {
      description: 'Get event by ID',
      tags: ['events'],
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
            id: { type: 'string' },
            timestamp: { type: 'string' },
            type: { type: 'string' },
            level: { type: 'string' },
            source: { type: 'string' },
            message: { type: 'string' },
            metadata: { type: 'object' },
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
    } as any,
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<EventByIdRequest>, reply: FastifyReply) => {
    try {
      const result = await db.query(`
        SELECT 
          id, timestamp, type, level, source, message, metadata,
          user_id, session_id, request_id, tags, stack, url, user_agent, ip
        FROM events WHERE id = $1
      `, [request.params.id]);

      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Event not found',
        });
        return;
      }

      reply.send(result.rows[0]);

    } catch (error) {
      request.log.error({ error }, "Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get event',
      });
    }
  });

  // Get event statistics
  fastify.get<EventStatsRequest>('/stats', {
    schema: {
      description: 'Get event statistics',
      tags: ['events'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          groupBy: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
          type: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          level: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          source: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] }
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
                  total: { type: 'number' },
                  by_type: { type: 'object' },
                  by_level: { type: 'object' },
                  by_source: { type: 'object' },
                },
              },
            },
          },
        },
      },
    } as any,
    preHandler: [requirePermission('read')],
  }, async (request: FastifyRequest<EventStatsRequest>, reply: FastifyReply) => {
    try {
      const { query } = EventStatsSchema.parse(request);

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

      if (query.type) {
        const types = Array.isArray(query.type) ? query.type : [query.type];
        conditions.push(`type = ANY($${++paramCount})`);
        params.push(types);
      }

      if (query.level) {
        const levels = Array.isArray(query.level) ? query.level : [query.level];
        conditions.push(`level = ANY($${++paramCount})`);
        params.push(levels);
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
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE type = 'error') as errors,
          COUNT(*) FILTER (WHERE type = 'warning') as warnings,
          COUNT(*) FILTER (WHERE type = 'info') as info,
          COUNT(*) FILTER (WHERE level = 'critical') as critical,
          COUNT(*) FILTER (WHERE level = 'high') as high,
          COUNT(*) FILTER (WHERE level = 'medium') as medium,
          COUNT(*) FILTER (WHERE level = 'low') as low
        FROM events ${whereClause}
        GROUP BY period
        ORDER BY period DESC
        LIMIT 100
      `, params);

      const stats = result.rows.map((row: any) => ({
        period: row.period,
        total: parseInt(row.total),
        by_type: {
          error: parseInt(row.errors),
          warning: parseInt(row.warnings),
          info: parseInt(row.info),
        },
        by_level: {
          critical: parseInt(row.critical),
          high: parseInt(row.high),
          medium: parseInt(row.medium),
          low: parseInt(row.low),
        },
      }));

      reply.send({ stats });

    } catch (error) {
      request.log.error({ error }, "Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get event statistics',
      });
    }
  });

  // Delete event (admin only)
  fastify.delete<EventByIdRequest>('/:id', {
    schema: {
      description: 'Delete event by ID (admin only)',
      tags: ['events'],
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
    } as any,
    preHandler: [requirePermission('admin')],
  }, async (request: FastifyRequest<EventByIdRequest>, reply: FastifyReply) => {
    try {
      const result = await db.query('DELETE FROM events WHERE id = $1', [request.params.id]);

      if (result.rowCount === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Event not found',
        });
        return;
      }

      reply.send({
        message: 'Event deleted successfully',
      });

    } catch (error) {
      request.log.error({ error }, "Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete event',
      });
    }
  });
}