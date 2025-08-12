import { EventEmitter } from 'events';
import { z } from 'zod';
import * as _ from 'lodash';

// Template Types
export const AlertTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum([
    'infrastructure',
    'application',
    'security',
    'performance',
    'business',
    'monitoring',
    'deployment',
    'database',
    'network',
    'custom'
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  conditions: z.object({
    metric: z.string(),
    operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'ne', 'contains', 'regex']),
    threshold: z.union([z.number(), z.string()]),
    timeWindow: z.number(), // seconds
    occurrences: z.number().default(1),
    groupBy: z.array(z.string()).optional()
  }),
  message: z.object({
    title: z.string(),
    description: z.string(),
    variables: z.record(z.string()).optional(), // Template variables
    tags: z.array(z.string()).optional()
  }),
  actions: z.array(z.object({
    type: z.enum(['email', 'slack', 'webhook', 'pagerduty', 'sms', 'discord', 'teams', 'jira']),
    config: z.record(z.any()),
    conditions: z.object({
      severity: z.array(z.string()).optional(),
      businessHours: z.boolean().optional(),
      escalationLevel: z.number().optional()
    }).optional()
  })),
  escalationPolicy: z.string().optional(),
  suppressionRules: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  enabled: z.boolean().default(true),
  version: z.string().default('1.0'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  createdBy: z.string().optional()
});

export const TemplateVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  defaultValue: z.any().optional(),
  required: z.boolean().default(false),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.string()).optional()
  }).optional()
});

export const AlertInstanceSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  triggeredAt: z.date(),
  resolvedAt: z.date().optional(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'suppressed']),
  values: z.record(z.any()), // Variable values
  computedMessage: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).optional()
  }),
  metadata: z.record(z.any()).optional()
});

export type AlertTemplate = z.infer<typeof AlertTemplateSchema>;
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type AlertInstance = z.infer<typeof AlertInstanceSchema>;

export interface TemplateConfig {
  defaultSeverity: 'critical' | 'high' | 'medium' | 'low';
  defaultTimeWindow: number;
  maxTemplatesPerCategory: number;
  enableVersioning: boolean;
  templateDirectory: string;
  autoImportBuiltins: boolean;
}

export interface TemplateStats {
  totalTemplates: number;
  templatesPerCategory: Record<string, number>;
  templatesPerSeverity: Record<string, number>;
  mostUsedTemplates: Array<{ id: string; name: string; usage: number }>;
  templateUsage: Record<string, number>;
  averageResolutionTime: Record<string, number>;
  successRate: Record<string, number>;
}

/**
 * Alert Templates Manager
 * 
 * Features:
 * - Pre-built templates for common scenarios
 * - Custom template creation with variables
 * - Template inheritance and composition
 * - Dynamic message generation
 * - Category-based organization
 * - Template versioning
 * - Usage analytics and optimization
 * - Template validation and testing
 */
export class AlertTemplateManager extends EventEmitter {
  private templates: Map<string, AlertTemplate> = new Map();
  private instances: Map<string, AlertInstance> = new Map();
  private variables: Map<string, TemplateVariable> = new Map();
  private config: TemplateConfig;
  private stats: TemplateStats;

  constructor(config: TemplateConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    
    if (config.autoImportBuiltins) {
      this.loadBuiltinTemplates();
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): TemplateStats {
    return {
      totalTemplates: 0,
      templatesPerCategory: {},
      templatesPerSeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      mostUsedTemplates: [],
      templateUsage: {},
      averageResolutionTime: {},
      successRate: {}
    };
  }

  /**
   * Load built-in templates for common scenarios
   */
  private loadBuiltinTemplates(): void {
    const builtinTemplates: Partial<AlertTemplate>[] = [
      // Infrastructure Templates
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        description: 'Alert when CPU usage exceeds threshold',
        category: 'infrastructure',
        severity: 'high',
        conditions: {
          metric: 'cpu.usage.percent',
          operator: 'gt',
          threshold: 85,
          timeWindow: 300,
          occurrences: 3
        },
        message: {
          title: '🔥 High CPU Usage Alert',
          description: 'CPU usage on {{host}} has been above {{threshold}}% for {{duration}} minutes. Current usage: {{current_value}}%',
          tags: ['infrastructure', 'cpu', 'performance']
        },
        actions: [
          {
            type: 'slack',
            config: {
              channel: '#infrastructure-alerts',
              mention: '@here'
            }
          },
          {
            type: 'email',
            config: {
              recipients: ['ops-team@company.com']
            }
          }
        ]
      },
      
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds threshold',
        category: 'infrastructure',
        severity: 'high',
        conditions: {
          metric: 'memory.usage.percent',
          operator: 'gt',
          threshold: 90,
          timeWindow: 180,
          occurrences: 2
        },
        message: {
          title: '💾 High Memory Usage Alert',
          description: 'Memory usage on {{host}} has exceeded {{threshold}}% for {{duration}} minutes. Current usage: {{current_value}}%',
          tags: ['infrastructure', 'memory', 'performance']
        },
        actions: [
          {
            type: 'slack',
            config: {
              channel: '#infrastructure-alerts'
            }
          }
        ]
      },

      {
        id: 'disk_space_low',
        name: 'Low Disk Space',
        description: 'Alert when disk space is running low',
        category: 'infrastructure',
        severity: 'medium',
        conditions: {
          metric: 'disk.usage.percent',
          operator: 'gt',
          threshold: 85,
          timeWindow: 600,
          occurrences: 1
        },
        message: {
          title: '💽 Low Disk Space Alert',
          description: 'Disk usage on {{host}}:{{mount_point}} has reached {{current_value}}%. Only {{free_space}}GB remaining.',
          tags: ['infrastructure', 'disk', 'storage']
        },
        actions: [
          {
            type: 'email',
            config: {
              recipients: ['ops-team@company.com']
            }
          }
        ]
      },

      // Application Templates
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when application error rate exceeds threshold',
        category: 'application',
        severity: 'critical',
        conditions: {
          metric: 'app.error.rate',
          operator: 'gt',
          threshold: 5,
          timeWindow: 300,
          occurrences: 2
        },
        message: {
          title: '🚨 High Error Rate Alert',
          description: 'Error rate for {{service}} has increased to {{current_value}}% over the last {{timeWindow}} minutes. Threshold: {{threshold}}%',
          tags: ['application', 'errors', 'performance']
        },
        actions: [
          {
            type: 'pagerduty',
            config: {
              service_key: 'app-critical-alerts'
            }
          },
          {
            type: 'slack',
            config: {
              channel: '#app-alerts',
              mention: '@channel'
            }
          }
        ]
      },

      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        description: 'Alert when API response time is too slow',
        category: 'performance',
        severity: 'medium',
        conditions: {
          metric: 'http.response_time.p95',
          operator: 'gt',
          threshold: 2000,
          timeWindow: 600,
          occurrences: 5
        },
        message: {
          title: '🐌 Slow Response Time Alert',
          description: 'API {{endpoint}} response time has degraded. P95: {{current_value}}ms (threshold: {{threshold}}ms)',
          tags: ['performance', 'api', 'latency']
        },
        actions: [
          {
            type: 'slack',
            config: {
              channel: '#performance-alerts'
            }
          }
        ]
      },

      // Security Templates
      {
        id: 'failed_login_attempts',
        name: 'Failed Login Attempts',
        description: 'Alert on suspicious login activity',
        category: 'security',
        severity: 'high',
        conditions: {
          metric: 'security.failed_logins',
          operator: 'gt',
          threshold: 10,
          timeWindow: 300,
          occurrences: 1,
          groupBy: ['source_ip']
        },
        message: {
          title: '🔒 Security Alert: Failed Login Attempts',
          description: 'Multiple failed login attempts detected from IP {{source_ip}}. Count: {{current_value}} in {{timeWindow}} minutes.',
          tags: ['security', 'authentication', 'suspicious-activity']
        },
        actions: [
          {
            type: 'email',
            config: {
              recipients: ['security@company.com']
            }
          },
          {
            type: 'slack',
            config: {
              channel: '#security-alerts',
              mention: '@security-team'
            }
          }
        ]
      },

      // Database Templates
      {
        id: 'database_connection_pool',
        name: 'Database Connection Pool Exhausted',
        description: 'Alert when database connection pool is exhausted',
        category: 'database',
        severity: 'critical',
        conditions: {
          metric: 'db.connection_pool.used_percent',
          operator: 'gt',
          threshold: 95,
          timeWindow: 120,
          occurrences: 1
        },
        message: {
          title: '🗄️ Database Connection Pool Alert',
          description: 'Database {{database_name}} connection pool is {{current_value}}% utilized. Immediate action required.',
          tags: ['database', 'connections', 'performance']
        },
        actions: [
          {
            type: 'pagerduty',
            config: {
              service_key: 'database-critical'
            }
          }
        ]
      },

      {
        id: 'slow_database_queries',
        name: 'Slow Database Queries',
        description: 'Alert on slow database queries',
        category: 'database',
        severity: 'medium',
        conditions: {
          metric: 'db.query.duration.p95',
          operator: 'gt',
          threshold: 5000,
          timeWindow: 300,
          occurrences: 3
        },
        message: {
          title: '🐌 Slow Database Queries',
          description: 'Database {{database_name}} has slow queries. P95 duration: {{current_value}}ms',
          tags: ['database', 'performance', 'queries']
        },
        actions: [
          {
            type: 'email',
            config: {
              recipients: ['dba@company.com']
            }
          }
        ]
      },

      // Business Templates
      {
        id: 'revenue_drop',
        name: 'Revenue Drop',
        description: 'Alert when revenue metrics show significant drop',
        category: 'business',
        severity: 'critical',
        conditions: {
          metric: 'business.revenue.hourly',
          operator: 'lt',
          threshold: 1000,
          timeWindow: 3600,
          occurrences: 1
        },
        message: {
          title: '💰 Revenue Drop Alert',
          description: 'Hourly revenue has dropped to {{current_value}} (expected: >{{threshold}}). Immediate investigation required.',
          tags: ['business', 'revenue', 'critical']
        },
        actions: [
          {
            type: 'pagerduty',
            config: {
              service_key: 'business-critical'
            }
          },
          {
            type: 'email',
            config: {
              recipients: ['executives@company.com', 'product@company.com']
            }
          }
        ]
      },

      // Network Templates
      {
        id: 'network_latency',
        name: 'High Network Latency',
        description: 'Alert on high network latency',
        category: 'network',
        severity: 'medium',
        conditions: {
          metric: 'network.latency.avg',
          operator: 'gt',
          threshold: 100,
          timeWindow: 300,
          occurrences: 5
        },
        message: {
          title: '🌐 High Network Latency',
          description: 'Network latency between {{source}} and {{destination}} is {{current_value}}ms (threshold: {{threshold}}ms)',
          tags: ['network', 'latency', 'connectivity']
        },
        actions: [
          {
            type: 'slack',
            config: {
              channel: '#network-alerts'
            }
          }
        ]
      }
    ];

    // Register all builtin templates
    builtinTemplates.forEach(template => {
      this.registerTemplate({
        ...template,
        id: template.id!,
        name: template.name!,
        category: template.category!,
        severity: template.severity!,
        conditions: template.conditions!,
        message: template.message!,
        actions: template.actions!,
        enabled: true,
        version: '1.0',
        createdAt: new Date(),
        createdBy: 'system'
      } as AlertTemplate);
    });
  }

  /**
   * Register a new alert template
   */
  public registerTemplate(template: AlertTemplate): void {
    const validated = AlertTemplateSchema.parse(template);
    
    // Check category limits
    const categoryCount = this.getCategoryCount(validated.category);
    if (categoryCount >= this.config.maxTemplatesPerCategory) {
      throw new Error(`Maximum templates reached for category: ${validated.category}`);
    }

    this.templates.set(validated.id, validated);
    this.updateStats(validated);
    this.emit('templateRegistered', validated);
  }

  /**
   * Update a template
   */
  public updateTemplate(id: string, updates: Partial<AlertTemplate>): boolean {
    const existing = this.templates.get(id);
    if (!existing) return false;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
      version: this.incrementVersion(existing.version)
    };

    const validated = AlertTemplateSchema.parse(updated);
    this.templates.set(id, validated);
    this.emit('templateUpdated', validated);
    return true;
  }

  /**
   * Delete a template
   */
  public deleteTemplate(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    this.templates.delete(id);
    this.emit('templateDeleted', { id, template });
    return true;
  }

  /**
   * Get template by ID
   */
  public getTemplate(id: string): AlertTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  public getTemplates(filters?: {
    category?: string;
    severity?: string;
    enabled?: boolean;
  }): AlertTemplate[] {
    let templates = Array.from(this.templates.values());

    if (filters) {
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category);
      }
      if (filters.severity) {
        templates = templates.filter(t => t.severity === filters.severity);
      }
      if (filters.enabled !== undefined) {
        templates = templates.filter(t => t.enabled === filters.enabled);
      }
    }

    return templates;
  }

  /**
   * Create alert instance from template
   */
  public async createAlertInstance(
    templateId: string, 
    values: Record<string, any>
  ): Promise<AlertInstance | null> {
    const template = this.templates.get(templateId);
    if (!template || !template.enabled) return null;

    try {
      // Validate values against template variables
      this.validateTemplateValues(template, values);

      // Generate computed message
      const computedMessage = this.computeMessage(template.message, values);

      // Create instance
      const instance: AlertInstance = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        templateId,
        triggeredAt: new Date(),
        status: 'active',
        values,
        computedMessage,
        metadata: {
          template: {
            name: template.name,
            category: template.category,
            version: template.version
          }
        }
      };

      this.instances.set(instance.id, instance);
      this.updateUsageStats(templateId);
      this.emit('instanceCreated', instance);

      return instance;

    } catch (error) {
      this.emit('instanceError', { templateId, values, error });
      return null;
    }
  }

  /**
   * Validate template values
   */
  private validateTemplateValues(template: AlertTemplate, values: Record<string, any>): void {
    const requiredVariables = this.extractVariablesFromTemplate(template);
    
    for (const variable of requiredVariables) {
      const variableConfig = this.variables.get(variable);
      if (variableConfig?.required && !(variable in values)) {
        throw new Error(`Required variable missing: ${variable}`);
      }

      if (variable in values && variableConfig?.validation) {
        this.validateVariableValue(variable, values[variable], variableConfig.validation);
      }
    }
  }

  /**
   * Validate variable value
   */
  private validateVariableValue(name: string, value: any, validation: any): void {
    if (validation.min !== undefined && value < validation.min) {
      throw new Error(`Variable ${name} below minimum: ${validation.min}`);
    }
    
    if (validation.max !== undefined && value > validation.max) {
      throw new Error(`Variable ${name} above maximum: ${validation.max}`);
    }
    
    if (validation.pattern && !new RegExp(validation.pattern).test(String(value))) {
      throw new Error(`Variable ${name} doesn't match pattern: ${validation.pattern}`);
    }
    
    if (validation.enum && !validation.enum.includes(String(value))) {
      throw new Error(`Variable ${name} not in allowed values: ${validation.enum.join(', ')}`);
    }
  }

  /**
   * Extract variables from template
   */
  private extractVariablesFromTemplate(template: AlertTemplate): string[] {
    const variables = new Set<string>();
    
    // Extract from message title and description
    const textContent = `${template.message.title} ${template.message.description}`;
    const matches = textContent.match(/\{\{([^}]+)\}\}/g);
    
    if (matches) {
      matches.forEach(match => {
        const variable = match.replace(/\{\{|\}\}/g, '').trim();
        variables.add(variable);
      });
    }

    return Array.from(variables);
  }

  /**
   * Compute message with variable substitution
   */
  private computeMessage(
    messageTemplate: AlertTemplate['message'], 
    values: Record<string, any>
  ): { title: string; description: string; tags?: string[] } {
    
    const substituteVariables = (text: string): string => {
      return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        const variableName = variable.trim();
        if (variableName in values) {
          return String(values[variableName]);
        }
        return match; // Keep original if variable not found
      });
    };

    return {
      title: substituteVariables(messageTemplate.title),
      description: substituteVariables(messageTemplate.description),
      tags: messageTemplate.tags
    };
  }

  /**
   * Test template with sample data
   */
  public async testTemplate(templateId: string, sampleValues: Record<string, any>): Promise<{
    success: boolean;
    computedMessage?: any;
    errors?: string[];
  }> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        return { success: false, errors: ['Template not found'] };
      }

      // Validate values
      this.validateTemplateValues(template, sampleValues);

      // Compute message
      const computedMessage = this.computeMessage(template.message, sampleValues);

      return {
        success: true,
        computedMessage
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Clone template
   */
  public cloneTemplate(sourceId: string, newId: string, overrides?: Partial<AlertTemplate>): boolean {
    const source = this.templates.get(sourceId);
    if (!source) return false;

    const cloned: AlertTemplate = {
      ..._.cloneDeep(source),
      id: newId,
      name: overrides?.name || `${source.name} (Copy)`,
      version: '1.0',
      createdAt: new Date(),
      createdBy: overrides?.createdBy || 'system',
      ...overrides
    };

    this.registerTemplate(cloned);
    this.emit('templateCloned', { sourceId, newId, template: cloned });
    return true;
  }

  /**
   * Export templates
   */
  public exportTemplates(templateIds?: string[]): AlertTemplate[] {
    const templates = templateIds 
      ? templateIds.map(id => this.templates.get(id)).filter(Boolean) as AlertTemplate[]
      : Array.from(this.templates.values());

    return templates;
  }

  /**
   * Import templates
   */
  public importTemplates(templates: AlertTemplate[], options?: {
    overwrite?: boolean;
    prefix?: string;
  }): { imported: number; skipped: number; errors: string[] } {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const template of templates) {
      try {
        const id = options?.prefix ? `${options.prefix}_${template.id}` : template.id;
        
        if (this.templates.has(id) && !options?.overwrite) {
          skipped++;
          continue;
        }

        this.registerTemplate({ ...template, id });
        imported++;

      } catch (error) {
        errors.push(`Template ${template.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.emit('templatesImported', { imported, skipped, errors: errors.length });
    return { imported, skipped, errors };
  }

  /**
   * Get template categories
   */
  public getCategories(): Array<{ category: string; count: number }> {
    const categories = new Map<string, number>();
    
    for (const template of this.templates.values()) {
      categories.set(template.category, (categories.get(template.category) || 0) + 1);
    }

    return Array.from(categories.entries()).map(([category, count]) => ({ category, count }));
  }

  /**
   * Search templates
   */
  public searchTemplates(query: {
    text?: string;
    category?: string;
    severity?: string;
    tags?: string[];
  }): AlertTemplate[] {
    return Array.from(this.templates.values()).filter(template => {
      if (query.text) {
        const searchText = query.text.toLowerCase();
        const templateText = `${template.name} ${template.description || ''} ${template.message.title} ${template.message.description}`.toLowerCase();
        if (!templateText.includes(searchText)) return false;
      }

      if (query.category && template.category !== query.category) return false;
      if (query.severity && template.severity !== query.severity) return false;
      
      if (query.tags && query.tags.length > 0) {
        const templateTags = template.message.tags || [];
        if (!query.tags.some(tag => templateTags.includes(tag))) return false;
      }

      return true;
    });
  }

  /**
   * Get template usage analytics
   */
  public getTemplateAnalytics(templateId?: string): any {
    if (templateId) {
      const template = this.templates.get(templateId);
      if (!template) return null;

      const instances = Array.from(this.instances.values()).filter(i => i.templateId === templateId);
      const resolvedInstances = instances.filter(i => i.status === 'resolved' && i.resolvedAt);
      
      const avgResolutionTime = resolvedInstances.length > 0
        ? resolvedInstances.reduce((sum, instance) => {
            const duration = instance.resolvedAt!.getTime() - instance.triggeredAt.getTime();
            return sum + duration;
          }, 0) / resolvedInstances.length
        : 0;

      return {
        template,
        usage: instances.length,
        activeInstances: instances.filter(i => i.status === 'active').length,
        resolvedInstances: resolvedInstances.length,
        averageResolutionTime: avgResolutionTime,
        successRate: resolvedInstances.length / Math.max(instances.length, 1) * 100
      };
    }

    // Return overall analytics
    return {
      totalTemplates: this.templates.size,
      totalInstances: this.instances.size,
      templatesPerCategory: this.stats.templatesPerCategory,
      mostUsedTemplates: this.stats.mostUsedTemplates
    };
  }

  /**
   * Register template variable
   */
  public registerVariable(variable: TemplateVariable): void {
    const validated = TemplateVariableSchema.parse(variable);
    this.variables.set(validated.name, validated);
    this.emit('variableRegistered', validated);
  }

  /**
   * Get template variables
   */
  public getVariables(): TemplateVariable[] {
    return Array.from(this.variables.values());
  }

  /**
   * Helper methods
   */
  private getCategoryCount(category: string): number {
    return Array.from(this.templates.values()).filter(t => t.category === category).length;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private updateStats(template: AlertTemplate): void {
    this.stats.totalTemplates = this.templates.size;
    this.stats.templatesPerCategory[template.category] = (this.stats.templatesPerCategory[template.category] || 0) + 1;
    this.stats.templatesPerSeverity[template.severity] = (this.stats.templatesPerSeverity[template.severity] || 0) + 1;
  }

  private updateUsageStats(templateId: string): void {
    this.stats.templateUsage[templateId] = (this.stats.templateUsage[templateId] || 0) + 1;
    
    // Update most used templates
    this.stats.mostUsedTemplates = Object.entries(this.stats.templateUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, usage]) => ({
        id,
        name: this.templates.get(id)?.name || 'Unknown',
        usage
      }));
  }

  /**
   * Get statistics
   */
  public getStats(): TemplateStats {
    return { ...this.stats };
  }

  /**
   * Get template instances
   */
  public getInstances(templateId?: string): AlertInstance[] {
    const instances = Array.from(this.instances.values());
    return templateId ? instances.filter(i => i.templateId === templateId) : instances;
  }

  /**
   * Resolve alert instance
   */
  public resolveInstance(instanceId: string, resolvedBy?: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status === 'resolved') return false;

    instance.status = 'resolved';
    instance.resolvedAt = new Date();
    instance.metadata = {
      ...instance.metadata,
      resolvedBy
    };

    this.emit('instanceResolved', instance);
    return true;
  }
}

export default AlertTemplateManager;