import { EventEmitter } from 'events';
import { z } from 'zod';

// Enrichment Types
export const EnrichmentSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['logs', 'metrics', 'traces', 'api', 'database', 'webhook', 'file']),
  config: z.object({
    endpoint: z.string().optional(),
    credentials: z.record(z.string()).optional(),
    queryTemplate: z.string().optional(),
    timeout: z.number().default(5000),
    retries: z.number().default(3),
    headers: z.record(z.string()).optional()
  }),
  filters: z.object({
    sources: z.array(z.string()).optional(),
    severities: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    timeWindow: z.number().optional() // minutes
  }).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().default(1)
});

export const EnrichmentRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sourceId: z.string(),
  conditions: z.object({
    alertSeverity: z.array(z.string()).optional(),
    alertSource: z.array(z.string()).optional(),
    alertTags: z.array(z.string()).optional(),
    businessHours: z.boolean().optional()
  }),
  enrichmentType: z.enum(['logs', 'metrics', 'traces', 'context', 'related_alerts']),
  queryConfig: z.object({
    template: z.string(),
    timeWindow: z.number().default(30), // minutes
    maxResults: z.number().default(100),
    fields: z.array(z.string()).optional()
  }),
  transformConfig: z.object({
    format: z.enum(['json', 'text', 'markdown', 'html']).default('json'),
    includeTimestamp: z.boolean().default(true),
    groupBy: z.string().optional(),
    aggregation: z.enum(['count', 'sum', 'avg', 'max', 'min']).optional()
  }).optional(),
  enabled: z.boolean().default(true)
});

export const EnrichedDataSchema = z.object({
  sourceId: z.string(),
  type: z.enum(['logs', 'metrics', 'traces', 'context', 'related_alerts']),
  timestamp: z.date(),
  data: z.any(),
  metadata: z.object({
    query: z.string().optional(),
    resultCount: z.number(),
    executionTime: z.number(),
    cached: z.boolean().default(false)
  }),
  summary: z.string().optional()
});

export const EnrichedAlertSchema = z.object({
  alertId: z.string(),
  originalAlert: z.record(z.any()),
  enrichedData: z.array(EnrichedDataSchema),
  enrichmentTimestamp: z.date(),
  processingTime: z.number(),
  cacheHits: z.number(),
  cacheMisses: z.number(),
  errors: z.array(z.object({
    sourceId: z.string(),
    error: z.string(),
    timestamp: z.date()
  })).optional()
});

export type EnrichmentSource = z.infer<typeof EnrichmentSourceSchema>;
export type EnrichmentRule = z.infer<typeof EnrichmentRuleSchema>;
export type EnrichedData = z.infer<typeof EnrichedDataSchema>;
export type EnrichedAlert = z.infer<typeof EnrichedAlertSchema>;

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  message: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EnrichmentConfig {
  enableCaching: boolean;
  cacheExpirationMinutes: number;
  maxConcurrentEnrichments: number;
  timeoutMs: number;
  enableAIAnalysis: boolean;
  aiAnalysisConfig: {
    provider: 'openai' | 'anthropic' | 'local';
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  };
}

export interface EnrichmentStats {
  totalEnrichments: number;
  enrichmentsByType: Record<string, number>;
  averageEnrichmentTime: number;
  cacheHitRate: number;
  errorRate: number;
  enrichmentsBySource: Record<string, number>;
  aiAnalysisCount: number;
  topQueries: Array<{ query: string; count: number; avgTime: number }>;
}

/**
 * Contextual Alert Enrichment Engine
 * 
 * Features:
 * - Multi-source data enrichment (logs, metrics, traces)
 * - Intelligent context gathering
 * - Related alert correlation
 * - AI-powered analysis and insights
 * - Caching for performance
 * - Configurable enrichment rules
 * - Real-time and batch enrichment
 */
export class AlertEnrichment extends EventEmitter {
  private sources: Map<string, EnrichmentSource> = new Map();
  private rules: Map<string, EnrichmentRule> = new Map();
  private cache: Map<string, { data: any; timestamp: Date; ttl: number }> = new Map();
  private config: EnrichmentConfig;
  private stats: EnrichmentStats;
  private aiClient: any;

  constructor(config: EnrichmentConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    
    if (config.enableAIAnalysis) {
      this.initializeAIClient();
    }

    this.startCacheCleanup();
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): EnrichmentStats {
    return {
      totalEnrichments: 0,
      enrichmentsByType: {},
      averageEnrichmentTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      enrichmentsBySource: {},
      aiAnalysisCount: 0,
      topQueries: []
    };
  }

  /**
   * Initialize AI client
   */
  private async initializeAIClient(): Promise<void> {
    const { provider, apiKey } = this.config.aiAnalysisConfig;
    
    if (provider === 'openai' && apiKey) {
      // Mock OpenAI client - in production, use actual OpenAI SDK
      this.aiClient = {
        analyze: async (prompt: string) => {
          console.log('AI Analysis:', prompt.substring(0, 100) + '...');
          return `AI Analysis: Based on the alert data, this appears to be related to ${Math.random() > 0.5 ? 'infrastructure' : 'application'} issues. Recommend immediate investigation.`;
        }
      };
    }
  }

  /**
   * Register enrichment source
   */
  public registerSource(source: EnrichmentSource): void {
    const validated = EnrichmentSourceSchema.parse(source);
    this.sources.set(validated.id, validated);
    this.emit('sourceRegistered', validated);
  }

  /**
   * Register enrichment rule
   */
  public registerRule(rule: EnrichmentRule): void {
    const validated = EnrichmentRuleSchema.parse(rule);
    this.rules.set(validated.id, validated);
    this.emit('ruleRegistered', validated);
  }

  /**
   * Enrich an alert with contextual data
   */
  public async enrichAlert(alert: Alert): Promise<EnrichedAlert> {
    const startTime = Date.now();
    const enrichedData: EnrichedData[] = [];
    const errors: Array<{ sourceId: string; error: string; timestamp: Date }> = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    try {
      // Find applicable enrichment rules
      const applicableRules = this.getApplicableRules(alert);
      
      if (applicableRules.length === 0) {
        console.log('No applicable enrichment rules for alert:', alert.id);
      }

      // Execute enrichment rules concurrently (with limit)
      const enrichmentPromises = applicableRules.map(async (rule) => {
        try {
          const result = await this.executeEnrichmentRule(alert, rule);
          if (result.fromCache) {
            cacheHits++;
          } else {
            cacheMisses++;
          }
          return result.data;
        } catch (error) {
          errors.push({
            sourceId: rule.sourceId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
          return null;
        }
      });

      // Wait for all enrichments to complete
      const results = await Promise.allSettled(enrichmentPromises);
      
      // Collect successful enrichments
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          enrichedData.push(result.value);
        }
      });

      // Add AI analysis if enabled
      if (this.config.enableAIAnalysis && enrichedData.length > 0) {
        try {
          const aiAnalysis = await this.performAIAnalysis(alert, enrichedData);
          if (aiAnalysis) {
            enrichedData.push(aiAnalysis);
            this.stats.aiAnalysisCount++;
          }
        } catch (error) {
          console.warn('AI analysis failed:', error);
        }
      }

      const processingTime = Date.now() - startTime;

      // Create enriched alert
      const enrichedAlert: EnrichedAlert = {
        alertId: alert.id,
        originalAlert: alert as any,
        enrichedData,
        enrichmentTimestamp: new Date(),
        processingTime,
        cacheHits,
        cacheMisses,
        errors: errors.length > 0 ? errors : undefined
      };

      // Update statistics
      this.updateStats(enrichedAlert);
      
      this.emit('alertEnriched', enrichedAlert);
      return enrichedAlert;

    } catch (error) {
      this.emit('enrichmentError', { alert, error });
      throw error;
    }
  }

  /**
   * Get applicable enrichment rules for alert
   */
  private getApplicableRules(alert: Alert): EnrichmentRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;

      const conditions = rule.conditions;

      // Check severity
      if (conditions.alertSeverity && !conditions.alertSeverity.includes(alert.severity)) {
        return false;
      }

      // Check source
      if (conditions.alertSource && !conditions.alertSource.includes(alert.source)) {
        return false;
      }

      // Check tags
      if (conditions.alertTags && alert.tags) {
        const hasRequiredTag = conditions.alertTags.some(tag => alert.tags!.includes(tag));
        if (!hasRequiredTag) return false;
      }

      // Check business hours
      if (conditions.businessHours !== undefined) {
        const isBusinessHours = this.isBusinessHours();
        if (conditions.businessHours !== isBusinessHours) return false;
      }

      return true;
    });
  }

  /**
   * Execute enrichment rule
   */
  private async executeEnrichmentRule(
    alert: Alert, 
    rule: EnrichmentRule
  ): Promise<{ data: EnrichedData; fromCache: boolean }> {
    const source = this.sources.get(rule.sourceId);
    if (!source || !source.enabled) {
      throw new Error(`Enrichment source not found or disabled: ${rule.sourceId}`);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(alert, rule);
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return { data: cached.data, fromCache: true };
      }
    }

    // Execute enrichment based on type
    const startTime = Date.now();
    let enrichmentData: any;

    switch (rule.enrichmentType) {
      case 'logs':
        enrichmentData = await this.enrichWithLogs(alert, rule, source);
        break;
      case 'metrics':
        enrichmentData = await this.enrichWithMetrics(alert, rule, source);
        break;
      case 'traces':
        enrichmentData = await this.enrichWithTraces(alert, rule, source);
        break;
      case 'context':
        enrichmentData = await this.enrichWithContext(alert, rule, source);
        break;
      case 'related_alerts':
        enrichmentData = await this.enrichWithRelatedAlerts(alert, rule, source);
        break;
      default:
        throw new Error(`Unknown enrichment type: ${rule.enrichmentType}`);
    }

    const executionTime = Date.now() - startTime;

    // Create enriched data object
    const enrichedData: EnrichedData = {
      sourceId: rule.sourceId,
      type: rule.enrichmentType,
      timestamp: new Date(),
      data: enrichmentData.data,
      metadata: {
        query: enrichmentData.query,
        resultCount: enrichmentData.resultCount || 0,
        executionTime,
        cached: false
      },
      summary: enrichmentData.summary
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, {
        data: enrichedData,
        timestamp: new Date(),
        ttl: this.config.cacheExpirationMinutes * 60 * 1000
      });
    }

    return { data: enrichedData, fromCache: false };
  }

  /**
   * Enrich with logs data
   */
  private async enrichWithLogs(
    alert: Alert, 
    rule: EnrichmentRule, 
    _source: EnrichmentSource
  ): Promise<any> {
    const query = this.buildQuery(alert, rule.queryConfig.template);
    const timeWindow = rule.queryConfig.timeWindow;
    const maxResults = rule.queryConfig.maxResults;

    // Mock log data - in production, integrate with actual log systems
    const mockLogs = [
      {
        timestamp: new Date(),
        level: 'ERROR',
        message: `Service ${alert.source} encountered error: Connection timeout`,
        source: alert.source,
        metadata: { requestId: 'req_123', userId: 'user_456' }
      },
      {
        timestamp: new Date(Date.now() - 60000),
        level: 'WARN',
        message: `Service ${alert.source} slow response detected`,
        source: alert.source,
        metadata: { responseTime: 2500 }
      }
    ];

    const relevantLogs = mockLogs.slice(0, maxResults);
    
    return {
      data: relevantLogs,
      query,
      resultCount: relevantLogs.length,
      summary: `Found ${relevantLogs.length} log entries in the last ${timeWindow} minutes`
    };
  }

  /**
   * Enrich with metrics data
   */
  private async enrichWithMetrics(
    alert: Alert, 
    rule: EnrichmentRule, 
    _source: EnrichmentSource
  ): Promise<any> {
    const query = this.buildQuery(alert, rule.queryConfig.template);
    
    // Mock metrics data - in production, integrate with metrics systems
    const mockMetrics = [
      {
        name: 'cpu.usage',
        value: 85.5,
        timestamp: new Date(),
        tags: { host: alert.source, service: 'api' }
      },
      {
        name: 'memory.usage',
        value: 78.2,
        timestamp: new Date(),
        tags: { host: alert.source, service: 'api' }
      },
      {
        name: 'response.time.p95',
        value: 1250,
        timestamp: new Date(),
        tags: { endpoint: '/api/users', service: 'api' }
      }
    ];

    return {
      data: mockMetrics,
      query,
      resultCount: mockMetrics.length,
      summary: `Retrieved ${mockMetrics.length} metrics for analysis`
    };
  }

  /**
   * Enrich with traces data
   */
  private async enrichWithTraces(
    alert: Alert, 
    rule: EnrichmentRule, 
    _source: EnrichmentSource
  ): Promise<any> {
    const query = this.buildQuery(alert, rule.queryConfig.template);
    
    // Mock trace data - in production, integrate with tracing systems
    const mockTraces = [
      {
        traceId: 'trace_123',
        spanId: 'span_456',
        operationName: 'api.getUserProfile',
        duration: 1250000, // microseconds
        tags: {
          'http.method': 'GET',
          'http.status_code': 500,
          'error': true
        },
        logs: [
          {
            timestamp: new Date(),
            fields: {
              'event': 'error',
              'error.object': 'Database connection failed'
            }
          }
        ]
      }
    ];

    return {
      data: mockTraces,
      query,
      resultCount: mockTraces.length,
      summary: `Found ${mockTraces.length} related traces with errors`
    };
  }

  /**
   * Enrich with contextual data
   */
  private async enrichWithContext(
    alert: Alert, 
    _rule: EnrichmentRule, 
    _source: EnrichmentSource
  ): Promise<any> {
    // Gather contextual information about the alert
    const context = {
      service: {
        name: alert.source,
        version: '1.2.3',
        environment: 'production',
        team: 'platform',
        dependencies: ['database', 'redis', 'external-api']
      },
      infrastructure: {
        region: 'us-west-2',
        availability_zone: 'us-west-2a',
        instance_type: 't3.medium',
        cluster: 'production-cluster'
      },
      recent_deployments: [
        {
          version: '1.2.3',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          author: 'john.doe@company.com'
        }
      ],
      similar_alerts: [
        {
          id: 'alert_789',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          severity: 'medium',
          resolved: true,
          resolution_time: 15 * 60 * 1000
        }
      ]
    };

    return {
      data: context,
      query: 'Context gathering for service: ' + alert.source,
      resultCount: Object.keys(context).length,
      summary: 'Gathered comprehensive service context and recent activity'
    };
  }

  /**
   * Enrich with related alerts
   */
  private async enrichWithRelatedAlerts(
    alert: Alert, 
    _rule: EnrichmentRule, 
    _source: EnrichmentSource
  ): Promise<any> {
    // Mock related alerts - in production, query actual alert storage
    const relatedAlerts = [
      {
        id: 'alert_related_1',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        severity: 'medium',
        source: alert.source,
        message: 'High memory usage detected',
        status: 'active',
        correlation_score: 0.85
      },
      {
        id: 'alert_related_2',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'low',
        source: 'dependency-service',
        message: 'Slow database queries',
        status: 'resolved',
        correlation_score: 0.72
      }
    ];

    return {
      data: relatedAlerts,
      query: `Related alerts for ${alert.source}`,
      resultCount: relatedAlerts.length,
      summary: `Found ${relatedAlerts.length} related alerts with correlation scores > 0.7`
    };
  }

  /**
   * Perform AI analysis on enriched data
   */
  private async performAIAnalysis(alert: Alert, enrichedData: EnrichedData[]): Promise<EnrichedData | null> {
    if (!this.aiClient) return null;

    try {
      // Create analysis prompt directly
      const prompt = `Analyze this alert and its enrichment data:
      
Alert: ${alert.message} (Severity: ${alert.severity}, Source: ${alert.source})

Enrichment Summary:
${enrichedData.map(ed => `- ${ed.type}: ${ed.summary}`).join('\n')}

Provide insights about:
1. Likely root cause
2. Impact assessment
3. Recommended actions
4. Similar incident patterns`;

      const analysis = await this.aiClient.analyze(prompt);

      return {
        sourceId: 'ai-analysis',
        type: 'context',
        timestamp: new Date(),
        data: {
          analysis,
          confidence: Math.random() * 0.3 + 0.7, // Mock confidence score
          insights: [
            'High correlation with recent deployment',
            'Similar pattern observed 3 times in past week',
            'Affects critical user journey'
          ],
          recommendations: [
            'Check recent code changes',
            'Review service dependencies',
            'Scale infrastructure if needed'
          ]
        },
        metadata: {
          resultCount: 1,
          executionTime: 500,
          cached: false
        },
        summary: 'AI-powered analysis of alert and contextual data'
      };

    } catch (error) {
      console.warn('AI analysis failed:', error);
      return null;
    }
  }

  /**
   * Build query from template
   */
  private buildQuery(alert: Alert, template: string): string {
    return template
      .replace(/\{\{alert\.source\}\}/g, alert.source)
      .replace(/\{\{alert\.severity\}\}/g, alert.severity)
      .replace(/\{\{alert\.message\}\}/g, alert.message)
      .replace(/\{\{alert\.timestamp\}\}/g, alert.timestamp.toISOString())
      .replace(/\{\{alert\.tags\}\}/g, (alert.tags || []).join(','));
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(alert: Alert, rule: EnrichmentRule): string {
    const keyData = {
      ruleId: rule.id,
      alertSource: alert.source,
      alertSeverity: alert.severity,
      timeWindow: Math.floor(Date.now() / (rule.queryConfig.timeWindow * 60 * 1000))
    };
    return `enrichment_${JSON.stringify(keyData)}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(cacheEntry: { data: any; timestamp: Date; ttl: number }): boolean {
    return (Date.now() - cacheEntry.timestamp.getTime()) < cacheEntry.ttl;
  }

  /**
   * Check if currently in business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Simple business hours: Monday-Friday, 9 AM - 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const currentTime = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if ((currentTime - entry.timestamp.getTime()) > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Clean every 5 minutes
  }

  /**
   * Update statistics
   */
  private updateStats(enrichedAlert: EnrichedAlert): void {
    this.stats.totalEnrichments++;
    
    // Update average enrichment time
    const currentAvg = this.stats.averageEnrichmentTime;
    const count = this.stats.totalEnrichments;
    this.stats.averageEnrichmentTime = ((currentAvg * (count - 1)) + enrichedAlert.processingTime) / count;

    // Update cache hit rate
    const totalRequests = enrichedAlert.cacheHits + enrichedAlert.cacheMisses;
    if (totalRequests > 0) {
      const hitRate = enrichedAlert.cacheHits / totalRequests;
      this.stats.cacheHitRate = ((this.stats.cacheHitRate * (count - 1)) + hitRate) / count;
    }

    // Update enrichments by type
    enrichedAlert.enrichedData.forEach(data => {
      this.stats.enrichmentsByType[data.type] = (this.stats.enrichmentsByType[data.type] || 0) + 1;
      this.stats.enrichmentsBySource[data.sourceId] = (this.stats.enrichmentsBySource[data.sourceId] || 0) + 1;
    });

    // Update error rate
    const hasErrors = enrichedAlert.errors && enrichedAlert.errors.length > 0;
    this.stats.errorRate = ((this.stats.errorRate * (count - 1)) + (hasErrors ? 1 : 0)) / count;
  }

  /**
   * Batch enrich multiple alerts
   */
  public async enrichAlerts(alerts: Alert[]): Promise<EnrichedAlert[]> {
    const semaphore = new Semaphore(this.config.maxConcurrentEnrichments);
    
    const promises = alerts.map(alert => 
      semaphore.acquire().then(async (release) => {
        try {
          return await this.enrichAlert(alert);
        } finally {
          release();
        }
      })
    );

    return Promise.all(promises);
  }

  /**
   * Get enrichment statistics
   */
  public getStats(): EnrichmentStats {
    return { ...this.stats };
  }

  /**
   * Get registered sources
   */
  public getSources(): EnrichmentSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get registered rules
   */
  public getRules(): EnrichmentRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Test enrichment rule
   */
  public async testRule(ruleId: string, testAlert: Alert): Promise<{
    success: boolean;
    data?: EnrichedData;
    error?: string;
    executionTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return { success: false, error: 'Rule not found' };
      }

      const result = await this.executeEnrichmentRule(testAlert, rule);
      
      return {
        success: true,
        data: result.data,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    hitRate: number;
    entries: Array<{ key: string; size: number; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: JSON.stringify(entry.data).length,
      age: Date.now() - entry.timestamp.getTime()
    }));

    return {
      size: this.cache.size,
      hitRate: this.stats.cacheHitRate,
      entries
    };
  }
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => {
          this.permits++;
          if (this.waiting.length > 0) {
            const next = this.waiting.shift()!;
            next();
          }
        });
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => {
            this.permits++;
            if (this.waiting.length > 0) {
              const next = this.waiting.shift()!;
              next();
            }
          });
        });
      }
    });
  }
}

export default AlertEnrichment;