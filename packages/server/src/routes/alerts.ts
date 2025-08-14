import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { getWebSocketManager } from '../websocket';
import { requirePermission } from '../middleware';
import { AlertConfigSchema } from '../types';
import * as cron from 'node-cron';

// Request schemas
const CreateAlertSchema = z.object({
  body: AlertConfigSchema.omit({ id: true }),
});

const UpdateAlertSchema = z.object({
  body: AlertConfigSchema.omit({ id: true }).partial(),
});

const QueryAlertsSchema = z.object({
  query: z.object({
    enabled: z.coerce.boolean().optional(),
    severity: z.array(z.string()).or(z.string()).optional(),
    tags: z.array(z.string()).or(z.string()).optional(),
    limit: z.coerce.number().min(1).max(1000).default(100),
    offset: z.coerce.number().min(0).default(0),
  }),
});

const QueryAlertInstancesSchema = z.object({
  query: z.object({
    alertConfigId: z.string().uuid().optional(),
    status: z.enum(['active', 'resolved']).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    severity: z.array(z.string()).or(z.string()).optional(),
    limit: z.coerce.number().min(1).max(1000).default(100),
    offset: z.coerce.number().min(0).default(0),
  }),
});

const TestAlertSchema = z.object({
  body: z.object({
    testData: z.record(z.any()).optional(),
  }),
});

export default async function alertsRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();
  const redis = getRedis();

  // Initialize alert checking cron job
  cron.schedule('* * * * *', () => {
    checkAlerts().catch(error => {
      console.error('Error in alert checking cron job:', error);
    });
  });

  // Create alert configuration
  fastify.post<{ Body: z.infer<typeof CreateAlertSchema.shape.body> }>('/', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          enabled: { type: 'boolean', default: true },
          conditions: {
            type: 'object',
            properties: {
              metric: { type: 'string' },
              operator: { type: 'string', enum: ['gt', 'lt', 'gte', 'lte', 'eq', 'ne'] },
              threshold: { type: 'number' },
              timeWindow: { type: 'number' },
              occurrences: { type: 'number', default: 1 }
            },
            required: ['metric', 'operator', 'threshold', 'timeWindow']
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['webhook', 'email', 'slack', 'discord', 'pagerduty'] },
                endpoint: { type: 'string', format: 'uri' },
                template: { type: 'string' }
              },
              required: ['type', 'endpoint']
            }
          },
          cooldown: { type: 'number', default: 300 },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'conditions', 'actions']
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
  }, async (request, reply) => {
    try {
      const { body } = CreateAlertSchema.parse(request);
      
      // Validate alert configuration
      const validatedAlert = AlertConfigSchema.parse(body);

      // Store in database
      const result = await db.query(`
        INSERT INTO alert_configs (
          name, description, enabled, conditions, actions, cooldown, severity, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        validatedAlert.name,
        validatedAlert.description,
        validatedAlert.enabled,
        JSON.stringify(validatedAlert.conditions),
        JSON.stringify(validatedAlert.actions),
        validatedAlert.cooldown,
        validatedAlert.severity,
        validatedAlert.tags || [],
      ]);

      const alertId = result.rows[0].id;

      // Cache alert config in Redis for faster access during checks
      await redis.setJSON(`alert:config:${alertId}`, {
        ...validatedAlert,
        id: alertId,
      });

      reply.code(201).send({
        id: alertId,
        message: 'Alert configuration created successfully',
      });

    } catch (error) {
      console.error(`Error creating alert: ${error instanceof Error ? error.message : String(error)}`);
      
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation Error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
      }

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create alert configuration',
      });
    }
  });

  // Get alert configurations
  fastify.get<{ Querystring: z.infer<typeof QueryAlertsSchema.shape.query> }>('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          severity: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          tags: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  enabled: { type: 'boolean' },
                  severity: { type: 'string' },
                  conditions: { type: 'object' },
                  actions: { type: 'array' },
                  tags: { type: 'array', items: { type: 'string' } },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
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
  }, async (request, reply) => {
    try {
      const { query } = QueryAlertsSchema.parse(request);

      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (query.enabled !== undefined) {
        conditions.push(`enabled = $${++paramCount}`);
        params.push(query.enabled);
      }

      if (query.severity) {
        const severities = Array.isArray(query.severity) ? query.severity : [query.severity];
        conditions.push(`severity = ANY($${++paramCount})`);
        params.push(severities);
      }

      if (query.tags) {
        const tags = Array.isArray(query.tags) ? query.tags : [query.tags];
        conditions.push(`tags && $${++paramCount}`);
        params.push(tags);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total FROM alert_configs ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get alert configurations
      const alertsResult = await db.query(`
        SELECT 
          id, name, description, enabled, conditions, actions, 
          cooldown, severity, tags, created_at, updated_at
        FROM alert_configs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, query.limit, query.offset]);

      reply.send({
        alerts: alertsResult.rows,
        pagination: {
          offset: query.offset,
          limit: query.limit,
          total,
        },
      });

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get alert configurations',
      });
    }
  });

  // Get alert configuration by ID
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
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
            name: { type: 'string' },
            description: { type: 'string' },
            enabled: { type: 'boolean' },
            conditions: { type: 'object' },
            actions: { type: 'array' },
            cooldown: { type: 'number' },
            severity: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
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
  }, async (request, reply) => {
    try {
      const result = await db.query(`
        SELECT 
          id, name, description, enabled, conditions, actions,
          cooldown, severity, tags, created_at, updated_at
        FROM alert_configs WHERE id = $1
      `, [request.params.id]);

      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Alert configuration not found',
        });
        return;
      }

      reply.send(result.rows[0]);

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get alert configuration',
      });
    }
  });

  // Update alert configuration
  fastify.put<{ 
    Params: { id: string };
    Body: z.infer<typeof UpdateAlertSchema.shape.body>;
  }>('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          enabled: { type: 'boolean' },
          conditions: {
            type: 'object',
            properties: {
              metric: { type: 'string' },
              operator: { type: 'string', enum: ['gt', 'lt', 'gte', 'lte', 'eq', 'ne'] },
              threshold: { type: 'number' },
              timeWindow: { type: 'number' },
              occurrences: { type: 'number' }
            }
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['webhook', 'email', 'slack', 'discord', 'pagerduty'] },
                endpoint: { type: 'string', format: 'uri' },
                template: { type: 'string' }
              }
            }
          },
          cooldown: { type: 'number' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          tags: { type: 'array', items: { type: 'string' } }
        }
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
    preHandler: [requirePermission('write')],
  }, async (request, reply) => {
    try {
      const { body } = UpdateAlertSchema.parse(request);
      const updateFields: string[] = [];
      const params: any[] = [request.params.id];
      let paramCount = 1;

      // Build dynamic UPDATE query
      if (body.name !== undefined) {
        updateFields.push(`name = $${++paramCount}`);
        params.push(body.name);
      }

      if (body.description !== undefined) {
        updateFields.push(`description = $${++paramCount}`);
        params.push(body.description);
      }

      if (body.enabled !== undefined) {
        updateFields.push(`enabled = $${++paramCount}`);
        params.push(body.enabled);
      }

      if (body.conditions !== undefined) {
        updateFields.push(`conditions = $${++paramCount}`);
        params.push(JSON.stringify(body.conditions));
      }

      if (body.actions !== undefined) {
        updateFields.push(`actions = $${++paramCount}`);
        params.push(JSON.stringify(body.actions));
      }

      if (body.cooldown !== undefined) {
        updateFields.push(`cooldown = $${++paramCount}`);
        params.push(body.cooldown);
      }

      if (body.severity !== undefined) {
        updateFields.push(`severity = $${++paramCount}`);
        params.push(body.severity);
      }

      if (body.tags !== undefined) {
        updateFields.push(`tags = $${++paramCount}`);
        params.push(body.tags);
      }

      if (updateFields.length === 0) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'No fields to update',
        });
        return;
      }

      updateFields.push(`updated_at = NOW()`);

      const result = await db.query(`
        UPDATE alert_configs 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id
      `, params);

      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Alert configuration not found',
        });
        return;
      }

      // Update cache
      const updatedAlert = await db.query(`
        SELECT * FROM alert_configs WHERE id = $1
      `, [request.params.id]);
      
      if (updatedAlert.rows.length > 0) {
        await redis.setJSON(`alert:config:${request.params.id}`, updatedAlert.rows[0]);
      }

      reply.send({
        message: 'Alert configuration updated successfully',
      });

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update alert configuration',
      });
    }
  });

  // Delete alert configuration
  fastify.delete<{ 
    Params: { id: string };
  }>('/:id', {
    schema: {
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
  }, async (request, reply) => {
    try {
      const result = await db.query('DELETE FROM alert_configs WHERE id = $1', [request.params.id]);

      if (result.rowCount === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Alert configuration not found',
        });
        return;
      }

      // Remove from cache
      await redis.del(`alert:config:${request.params.id}`);

      reply.send({
        message: 'Alert configuration deleted successfully',
      });

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete alert configuration',
      });
    }
  });

  // Test alert configuration
  fastify.post<{ 
    Params: { id: string };
    Body: z.infer<typeof TestAlertSchema.shape.body>;
  }>('/:id/test', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          testData: { type: 'object', additionalProperties: true }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            triggered: { type: 'boolean' },
            message: { type: 'string' },
            testValue: { type: 'number' },
            threshold: { type: 'number' },
          },
        },
      },
    } as any,
    preHandler: [requirePermission('write')],
  }, async (request, reply) => {
    try {
      // Get alert configuration
      const alertResult = await db.query(`
        SELECT * FROM alert_configs WHERE id = $1 AND enabled = true
      `, [request.params.id]);

      if (alertResult.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Alert configuration not found or disabled',
        });
        return;
      }

      const alertConfig = alertResult.rows[0];
      const conditions = alertConfig.conditions;

      // Use test data or get latest metric value
      let testValue: number;
      if (request.body.testData && typeof request.body.testData === 'object' && request.body.testData.value !== undefined) {
        testValue = Number(request.body.testData.value);
      } else {
        // Get latest metric value from database
        const metricResult = await db.query(`
          SELECT value FROM metrics 
          WHERE name = $1 
          ORDER BY timestamp DESC 
          LIMIT 1
        `, [conditions.metric]);

        if (metricResult.rows.length === 0) {
          reply.code(400).send({
            error: 'Bad Request',
            message: `No data found for metric: ${conditions.metric}`,
          });
          return;
        }

        testValue = parseFloat(metricResult.rows[0].value);
      }

      // Evaluate condition
      const triggered = evaluateCondition(testValue, conditions);

      if (triggered) {
        // Simulate alert actions (don't actually send notifications for tests)
        console.log(`TEST ALERT: ${alertConfig.name} would trigger with value ${testValue}`);
      }

      reply.send({
        triggered,
        message: triggered 
          ? `Alert would trigger: ${testValue} ${conditions.operator} ${conditions.threshold}`
          : `Alert would not trigger: ${testValue} ${conditions.operator} ${conditions.threshold}`,
        testValue,
        threshold: conditions.threshold,
      });

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to test alert configuration',
      });
    }
  });

  // Get alert instances (triggered alerts)
  fastify.get<{ Querystring: z.infer<typeof QueryAlertInstancesSchema.shape.query> }>('/instances', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          alertConfigId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['active', 'resolved'] },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          severity: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            instances: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  alert_config_id: { type: 'string' },
                  triggered_at: { type: 'string' },
                  resolved_at: { type: 'string' },
                  status: { type: 'string' },
                  trigger_value: { type: 'number' },
                  message: { type: 'string' },
                  metadata: { type: 'object' },
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
  }, async (request, reply) => {
    try {
      const { query } = QueryAlertInstancesSchema.parse(request);

      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (query.alertConfigId) {
        conditions.push(`ai.alert_config_id = $${++paramCount}`);
        params.push(query.alertConfigId);
      }

      if (query.status) {
        conditions.push(`ai.status = $${++paramCount}`);
        params.push(query.status);
      }

      if (query.startTime) {
        conditions.push(`ai.triggered_at >= $${++paramCount}`);
        params.push(query.startTime);
      }

      if (query.endTime) {
        conditions.push(`ai.triggered_at <= $${++paramCount}`);
        params.push(query.endTime);
      }

      if (query.severity) {
        const severities = Array.isArray(query.severity) ? query.severity : [query.severity];
        conditions.push(`ac.severity = ANY($${++paramCount})`);
        params.push(severities);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total 
        FROM alert_instances ai 
        LEFT JOIN alert_configs ac ON ai.alert_config_id = ac.id
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get alert instances
      const instancesResult = await db.query(`
        SELECT 
          ai.id, ai.alert_config_id, ai.triggered_at, ai.resolved_at,
          ai.status, ai.trigger_value, ai.message, ai.metadata,
          ac.name as alert_name, ac.severity
        FROM alert_instances ai 
        LEFT JOIN alert_configs ac ON ai.alert_config_id = ac.id
        ${whereClause}
        ORDER BY ai.triggered_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, query.limit, query.offset]);

      reply.send({
        instances: instancesResult.rows,
        pagination: {
          offset: query.offset,
          limit: query.limit,
          total,
        },
      });

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get alert instances',
      });
    }
  });

  // Resolve alert instance
  fastify.post<{ 
    Params: { id: string };
  }>('/instances/:id/resolve', {
    schema: {
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
      },
    } as any,
    preHandler: [requirePermission('write')],
  }, async (request, reply) => {
    try {
      const result = await db.query(`
        UPDATE alert_instances 
        SET status = 'resolved', resolved_at = NOW()
        WHERE id = $1 AND status = 'active'
        RETURNING id
      `, [request.params.id]);

      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Active alert instance not found',
        });
        return;
      }

      // Publish resolution to WebSocket
      const wsManager = getWebSocketManager();
      wsManager.broadcast('alerts:realtime', {
        type: 'alert',
        data: {
          instanceId: request.params.id,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        },
      });

      reply.send({
        message: 'Alert instance resolved successfully',
      });

    } catch (error) {
      console.error("Error occurred");
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to resolve alert instance',
      });
    }
  });

  // Alert checking function (called by cron job)
  async function checkAlerts(): Promise<void> {
    try {
      // Get all enabled alert configurations
      const alertConfigs = await db.query(`
        SELECT * FROM alert_configs WHERE enabled = true
      `);

      for (const config of alertConfigs.rows) {
        await checkSingleAlert(config);
      }
    } catch (error) {
      console.error('Error in alert checking:', error);
    }
  }

  // Check a single alert configuration
  async function checkSingleAlert(config: any): Promise<void> {
    try {
      const conditions = config.conditions;
      const now = new Date();
      const timeWindow = conditions.timeWindow || 300; // Default 5 minutes
      const checkTime = new Date(now.getTime() - timeWindow * 1000);

      // Get metric data for the time window
      const metricResult = await db.query(`
        SELECT AVG(value) as avg_value, MAX(value) as max_value, MIN(value) as min_value, COUNT(*) as count
        FROM metrics 
        WHERE name = $1 AND timestamp >= $2 AND timestamp <= $3
      `, [conditions.metric, checkTime.toISOString(), now.toISOString()]);

      if (metricResult.rows.length === 0 || metricResult.rows[0].count === 0) {
        return; // No data available
      }

      const data = metricResult.rows[0];
      let value: number;

      // Determine which value to use based on aggregation (default to average)
      switch (conditions.aggregation || 'avg') {
        case 'max':
          value = parseFloat(data.max_value);
          break;
        case 'min':
          value = parseFloat(data.min_value);
          break;
        case 'count':
          value = parseInt(data.count);
          break;
        default:
          value = parseFloat(data.avg_value);
      }

      // Check if condition is met
      const conditionMet = evaluateCondition(value, conditions);

      if (conditionMet) {
        // Check for cooldown period
        const lastAlert = await db.query(`
          SELECT triggered_at FROM alert_instances 
          WHERE alert_config_id = $1 
          ORDER BY triggered_at DESC 
          LIMIT 1
        `, [config.id]);

        if (lastAlert.rows.length > 0) {
          const lastAlertTime = new Date(lastAlert.rows[0].triggered_at);
          const cooldownExpiry = new Date(lastAlertTime.getTime() + config.cooldown * 1000);
          
          if (now < cooldownExpiry) {
            return; // Still in cooldown period
          }
        }

        // Trigger alert
        await triggerAlert(config, value);
      }
    } catch (error) {
      console.error(`Error checking alert ${config.name}:`, error);
    }
  }

  // Evaluate alert condition
  function evaluateCondition(value: number, conditions: any): boolean {
    const threshold = conditions.threshold;
    
    switch (conditions.operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      default:
        return false;
    }
  }

  // Trigger alert
  async function triggerAlert(config: any, triggerValue: number): Promise<void> {
    try {
      // Create alert instance
      const instanceResult = await db.query(`
        INSERT INTO alert_instances (
          alert_config_id, triggered_at, status, trigger_value, message, metadata
        ) VALUES ($1, NOW(), 'active', $2, $3, $4)
        RETURNING id
      `, [
        config.id,
        triggerValue,
        `Alert ${config.name} triggered: value ${triggerValue} ${config.conditions.operator} ${config.conditions.threshold}`,
        JSON.stringify({ conditions: config.conditions }),
      ]);

      const instanceId = instanceResult.rows[0].id;

      // Update server stats
      if (fastify.stats) {
        fastify.stats.alertsTriggered++;
      }

      // Publish to Redis and WebSocket
      const alertData = {
        instanceId,
        configId: config.id,
        name: config.name,
        severity: config.severity,
        triggerValue,
        message: `Alert ${config.name} triggered`,
        triggeredAt: new Date().toISOString(),
      };

      await redis.publish('alerts:realtime', alertData);

      const wsManager = getWebSocketManager();
      wsManager.broadcast('alerts:realtime', {
        type: 'alert',
        data: alertData,
      });

      // Execute alert actions
      for (const action of config.actions) {
        await executeAlertAction(action, config, triggerValue);
      }

      console.log(`Alert triggered: ${config.name} (value: ${triggerValue})`);
    } catch (error) {
      console.error(`Error triggering alert ${config.name}:`, error);
    }
  }

  // Execute alert action (webhook, email, etc.)
  async function executeAlertAction(action: any, config: any, triggerValue: number): Promise<void> {
    try {
      const payload = {
        alert: {
          name: config.name,
          severity: config.severity,
          triggerValue,
          threshold: config.conditions.threshold,
          operator: config.conditions.operator,
          metric: config.conditions.metric,
        },
        timestamp: new Date().toISOString(),
      };

      switch (action.type) {
        case 'webhook':
          // Send webhook (using fetch or axios)
          console.log(`Sending webhook to ${action.endpoint}:`, payload);
          // Implementation would depend on chosen HTTP client
          break;
          
        case 'slack':
          // Send Slack notification
          console.log(`Sending Slack notification:`, payload);
          break;
          
        case 'discord':
          // Send Discord notification
          console.log(`Sending Discord notification:`, payload);
          break;
          
        case 'email':
          // Send email notification
          console.log(`Sending email notification:`, payload);
          break;
          
        case 'pagerduty':
          // Send PagerDuty alert
          console.log(`Sending PagerDuty alert:`, payload);
          break;
          
        default:
          console.warn(`Unknown alert action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing alert action ${action.type}:`, error);
    }
  }
}