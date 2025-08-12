import { EventEmitter } from 'events';
import { z } from 'zod';
import * as _ from 'lodash';
import { 
  format, 
  subDays,
  subHours,
  subMinutes,
  isWithinInterval 
} from 'date-fns';

// Analytics Types
export const AlertEventSchema = z.object({
  id: z.string(),
  alertId: z.string(),
  timestamp: z.date(),
  type: z.enum([
    'created',
    'acknowledged',
    'escalated', 
    'resolved',
    'suppressed',
    'enriched',
    'scored',
    'grouped'
  ]),
  source: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  duration: z.number().optional(), // milliseconds
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  businessImpactScore: z.number().optional()
});

export const AnalyticsQuerySchema = z.object({
  timeRange: z.object({
    start: z.date(),
    end: z.date()
  }),
  granularity: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('hour'),
  filters: z.object({
    sources: z.array(z.string()).optional(),
    severities: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    minScore: z.number().optional(),
    maxScore: z.number().optional(),
    eventTypes: z.array(z.string()).optional()
  }).optional(),
  groupBy: z.array(z.enum(['source', 'severity', 'tag', 'hour', 'day'])).optional(),
  metrics: z.array(z.enum([
    'count',
    'mttr', // Mean Time To Resolution
    'mtta', // Mean Time To Acknowledgment
    'score_avg',
    'score_p95',
    'frequency',
    'escalation_rate',
    'suppression_rate'
  ])).optional()
});

export const DashboardWidgetSchema = z.object({
  id: z.string(),
  type: z.enum([
    'line_chart',
    'bar_chart',
    'pie_chart',
    'gauge',
    'table',
    'heat_map',
    'stat_card',
    'alert_list',
    'trend_indicator'
  ]),
  title: z.string(),
  description: z.string().optional(),
  query: AnalyticsQuerySchema,
  config: z.object({
    width: z.number().default(6), // 1-12 grid columns
    height: z.number().default(4), // grid rows
    refreshInterval: z.number().default(60), // seconds
    colors: z.array(z.string()).optional(),
    thresholds: z.array(z.object({
      value: z.number(),
      color: z.string(),
      label: z.string().optional()
    })).optional()
  }),
  enabled: z.boolean().default(true)
});

export const AlertPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pattern: z.object({
    sources: z.array(z.string()).optional(),
    severities: z.array(z.string()).optional(),
    timePattern: z.string().optional(), // cron-like expression
    frequencyThreshold: z.number().optional(),
    correlationRules: z.array(z.string()).optional()
  }),
  confidence: z.number().min(0).max(1),
  occurrences: z.number(),
  lastSeen: z.date(),
  impact: z.object({
    avgBusinessScore: z.number(),
    avgResolutionTime: z.number(),
    escalationRate: z.number()
  }),
  recommendations: z.array(z.string()),
  status: z.enum(['active', 'investigating', 'resolved', 'ignored']).default('active')
});

export type AlertEvent = z.infer<typeof AlertEventSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type AlertPattern = z.infer<typeof AlertPatternSchema>;

export interface AnalyticsConfig {
  retentionDays: number;
  aggregationIntervals: {
    minute: number; // keep for X hours
    hour: number;   // keep for X days  
    day: number;    // keep for X weeks
    week: number;   // keep for X months
  };
  patternDetection: {
    enabled: boolean;
    minOccurrences: number;
    confidenceThreshold: number;
    analysisWindow: number; // days
  };
  realTimeUpdates: boolean;
  cacheResults: boolean;
  cacheExpirationMinutes: number;
}

export interface AnalyticsMetrics {
  // Volume metrics
  totalAlerts: number;
  alertsPerHour: number;
  alertsPerDay: number;
  peakHour: { hour: number; count: number };
  
  // Performance metrics  
  meanTimeToResolution: number;
  meanTimeToAcknowledgment: number;
  escalationRate: number;
  suppressionRate: number;
  
  // Quality metrics
  falsePositiveRate: number;
  averageBusinessImpact: number;
  criticalAlertRatio: number;
  
  // Efficiency metrics
  deduplicationRate: number;
  enrichmentCoverage: number;
  automationRate: number;
  
  // Trend metrics
  alertTrend: 'increasing' | 'decreasing' | 'stable';
  severityTrend: Record<string, 'increasing' | 'decreasing' | 'stable'>;
  
  // Top lists
  topSources: Array<{ source: string; count: number; trend: string }>;
  topAlertTypes: Array<{ type: string; count: number; avgScore: number }>;
  problematicPatterns: Array<{ pattern: string; frequency: number; impact: number }>;
}

/**
 * Alert Analytics Engine
 * 
 * Features:
 * - Real-time analytics dashboard
 * - Alert pattern detection and analysis
 * - Performance metrics and KPIs
 * - Trend analysis and forecasting
 * - Customizable widgets and visualizations  
 * - Alert fatigue analysis
 * - Business impact correlation
 * - Automated insights and recommendations
 */
export class AlertAnalytics extends EventEmitter {
  private events: AlertEvent[] = [];
  private patterns: Map<string, AlertPattern> = new Map();
  private widgets: Map<string, DashboardWidget> = new Map();
  private cache: Map<string, { data: any; timestamp: Date }> = new Map();
  private config: AnalyticsConfig;
  private metrics: AnalyticsMetrics;

  constructor(config: AnalyticsConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.startMaintenanceJobs();
    this.initializeBuiltinPatterns();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): AnalyticsMetrics {
    return {
      totalAlerts: 0,
      alertsPerHour: 0,
      alertsPerDay: 0,
      peakHour: { hour: 0, count: 0 },
      meanTimeToResolution: 0,
      meanTimeToAcknowledgment: 0,
      escalationRate: 0,
      suppressionRate: 0,
      falsePositiveRate: 0,
      averageBusinessImpact: 0,
      criticalAlertRatio: 0,
      deduplicationRate: 0,
      enrichmentCoverage: 0,
      automationRate: 0,
      alertTrend: 'stable',
      severityTrend: { critical: 'stable', high: 'stable', medium: 'stable', low: 'stable' },
      topSources: [],
      topAlertTypes: [],
      problematicPatterns: []
    };
  }

  /**
   * Record alert event
   */
  public recordEvent(event: Omit<AlertEvent, 'id'>): void {
    const alertEvent: AlertEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.events.push(alertEvent);
    this.updateMetrics(alertEvent);
    
    // Check for patterns
    if (this.config.patternDetection.enabled) {
      this.detectPatterns(alertEvent);
    }
    
    this.emit('eventRecorded', alertEvent);

    // Clean up old events
    this.cleanupOldEvents();
  }

  /**
   * Execute analytics query
   */
  public async executeQuery(query: AnalyticsQuery): Promise<{
    data: any[];
    aggregations: Record<string, any>;
    metadata: {
      totalCount: number;
      executionTime: number;
      cached: boolean;
      timeRange: { start: Date; end: Date };
    };
  }> {
    const startTime = Date.now();
    
    // Check cache
    const cacheKey = this.generateCacheKey(query);
    if (this.config.cacheResults) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return {
          ...cached.data,
          metadata: {
            ...cached.data.metadata,
            cached: true
          }
        };
      }
    }

    try {
      // Filter events based on query
      const filteredEvents = this.filterEvents(query);
      
      // Group and aggregate data
      const groupedData = this.groupEvents(filteredEvents, query);
      const aggregatedData = this.aggregateData(groupedData, query);
      
      // Calculate additional metrics
      const aggregations = this.calculateAggregations(filteredEvents, query);
      
      const result = {
        data: aggregatedData,
        aggregations,
        metadata: {
          totalCount: filteredEvents.length,
          executionTime: Date.now() - startTime,
          cached: false,
          timeRange: query.timeRange
        }
      };

      // Cache result
      if (this.config.cacheResults) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: new Date()
        });
      }

      return result;

    } catch (error) {
      this.emit('queryError', { query, error });
      throw error;
    }
  }

  /**
   * Filter events based on query
   */
  private filterEvents(query: AnalyticsQuery): AlertEvent[] {
    return this.events.filter(event => {
      // Time range filter
      if (!isWithinInterval(event.timestamp, query.timeRange)) {
        return false;
      }

      // Additional filters
      if (query.filters) {
        const { sources, severities, tags, minScore, maxScore, eventTypes } = query.filters;
        
        if (sources && !sources.includes(event.source)) return false;
        if (severities && !severities.includes(event.severity)) return false;
        if (eventTypes && !eventTypes.includes(event.type)) return false;
        if (tags && event.tags && !tags.some(tag => event.tags!.includes(tag))) return false;
        
        if (minScore && event.businessImpactScore && event.businessImpactScore < minScore) return false;
        if (maxScore && event.businessImpactScore && event.businessImpactScore > maxScore) return false;
      }

      return true;
    });
  }

  /**
   * Group events based on query
   */
  private groupEvents(events: AlertEvent[], query: AnalyticsQuery): Map<string, AlertEvent[]> {
    if (!query.groupBy || query.groupBy.length === 0) {
      return new Map([['all', events]]);
    }

    const groups = new Map<string, AlertEvent[]>();

    for (const event of events) {
      const groupKey = query.groupBy.map(field => {
        switch (field) {
          case 'source':
            return event.source;
          case 'severity': 
            return event.severity;
          case 'tag':
            return event.tags?.[0] || 'no-tag';
          case 'hour':
            return format(event.timestamp, 'yyyy-MM-dd-HH');
          case 'day':
            return format(event.timestamp, 'yyyy-MM-dd');
          default:
            return 'unknown';
        }
      }).join('|');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(event);
    }

    return groups;
  }

  /**
   * Aggregate data based on query
   */
  private aggregateData(groupedData: Map<string, AlertEvent[]>, query: AnalyticsQuery): any[] {
    const result: any[] = [];
    
    for (const [groupKey, events] of groupedData.entries()) {
      const aggregated: any = { group: groupKey };

      // Calculate requested metrics
      const metrics = query.metrics || ['count'];
      
      for (const metric of metrics) {
        switch (metric) {
          case 'count':
            aggregated.count = events.length;
            break;
            
          case 'mttr':
            aggregated.mttr = this.calculateMTTR(events);
            break;
            
          case 'mtta':
            aggregated.mtta = this.calculateMTTA(events);
            break;
            
          case 'score_avg':
            const scores = events.map(e => e.businessImpactScore).filter(Boolean) as number[];
            aggregated.score_avg = scores.length > 0 ? _.mean(scores) : 0;
            break;
            
          case 'score_p95':
            const allScores = events.map(e => e.businessImpactScore).filter(Boolean) as number[];
            aggregated.score_p95 = allScores.length > 0 ? this.percentile(allScores, 95) : 0;
            break;
            
          case 'frequency':
            const timeSpan = query.timeRange.end.getTime() - query.timeRange.start.getTime();
            aggregated.frequency = events.length / (timeSpan / (1000 * 60 * 60)); // per hour
            break;
            
          case 'escalation_rate':
            const escalated = events.filter(e => e.type === 'escalated').length;
            aggregated.escalation_rate = events.length > 0 ? (escalated / events.length) * 100 : 0;
            break;
            
          case 'suppression_rate':
            const suppressed = events.filter(e => e.type === 'suppressed').length;
            aggregated.suppression_rate = events.length > 0 ? (suppressed / events.length) * 100 : 0;
            break;
        }
      }

      result.push(aggregated);
    }

    return result.sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  /**
   * Calculate aggregations
   */
  private calculateAggregations(events: AlertEvent[], _query: AnalyticsQuery): Record<string, any> {
    return {
      total_events: events.length,
      unique_sources: new Set(events.map(e => e.source)).size,
      severity_distribution: this.calculateSeverityDistribution(events),
      hourly_distribution: this.calculateHourlyDistribution(events),
      avg_business_impact: this.calculateAverageBusinessImpact(events),
      resolution_stats: this.calculateResolutionStats(events)
    };
  }

  /**
   * Calculate Mean Time To Resolution
   */
  private calculateMTTR(events: AlertEvent[]): number {
    const resolvedAlerts = new Map<string, { created: Date; resolved: Date }>();
    
    // Group events by alert ID
    for (const event of events) {
      if (event.type === 'created') {
        if (!resolvedAlerts.has(event.alertId)) {
          resolvedAlerts.set(event.alertId, { created: event.timestamp, resolved: new Date(0) });
        }
        resolvedAlerts.get(event.alertId)!.created = event.timestamp;
      } else if (event.type === 'resolved') {
        if (!resolvedAlerts.has(event.alertId)) {
          resolvedAlerts.set(event.alertId, { created: new Date(0), resolved: event.timestamp });
        }
        resolvedAlerts.get(event.alertId)!.resolved = event.timestamp;
      }
    }

    // Calculate resolution times
    const resolutionTimes = Array.from(resolvedAlerts.values())
      .filter(alert => alert.created.getTime() > 0 && alert.resolved.getTime() > 0)
      .map(alert => alert.resolved.getTime() - alert.created.getTime());

    return resolutionTimes.length > 0 ? _.mean(resolutionTimes) : 0;
  }

  /**
   * Calculate Mean Time To Acknowledgment
   */
  private calculateMTTA(events: AlertEvent[]): number {
    const acknowledgedAlerts = new Map<string, { created: Date; acknowledged: Date }>();
    
    // Group events by alert ID
    for (const event of events) {
      if (event.type === 'created') {
        if (!acknowledgedAlerts.has(event.alertId)) {
          acknowledgedAlerts.set(event.alertId, { created: event.timestamp, acknowledged: new Date(0) });
        }
        acknowledgedAlerts.get(event.alertId)!.created = event.timestamp;
      } else if (event.type === 'acknowledged') {
        if (!acknowledgedAlerts.has(event.alertId)) {
          acknowledgedAlerts.set(event.alertId, { created: new Date(0), acknowledged: event.timestamp });
        }
        acknowledgedAlerts.get(event.alertId)!.acknowledged = event.timestamp;
      }
    }

    // Calculate acknowledgment times
    const acknowledgmentTimes = Array.from(acknowledgedAlerts.values())
      .filter(alert => alert.created.getTime() > 0 && alert.acknowledged.getTime() > 0)
      .map(alert => alert.acknowledged.getTime() - alert.created.getTime());

    return acknowledgmentTimes.length > 0 ? _.mean(acknowledgmentTimes) : 0;
  }

  /**
   * Calculate severity distribution
   */
  private calculateSeverityDistribution(events: AlertEvent[]): Record<string, number> {
    const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
    
    for (const event of events) {
      if (event.type === 'created') {
        distribution[event.severity]++;
      }
    }
    
    return distribution;
  }

  /**
   * Calculate hourly distribution
   */
  private calculateHourlyDistribution(events: AlertEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const event of events) {
      if (event.type === 'created') {
        const hour = format(event.timestamp, 'HH');
        distribution[hour] = (distribution[hour] || 0) + 1;
      }
    }
    
    return distribution;
  }

  /**
   * Calculate average business impact
   */
  private calculateAverageBusinessImpact(events: AlertEvent[]): number {
    const scores = events
      .filter(e => e.type === 'created' && e.businessImpactScore)
      .map(e => e.businessImpactScore!) as number[];
      
    return scores.length > 0 ? _.mean(scores) : 0;
  }

  /**
   * Calculate resolution statistics
   */
  private calculateResolutionStats(events: AlertEvent[]): any {
    const createdCount = events.filter(e => e.type === 'created').length;
    const resolvedCount = events.filter(e => e.type === 'resolved').length;
    const escalatedCount = events.filter(e => e.type === 'escalated').length;
    const suppressedCount = events.filter(e => e.type === 'suppressed').length;
    
    return {
      resolution_rate: createdCount > 0 ? (resolvedCount / createdCount) * 100 : 0,
      escalation_rate: createdCount > 0 ? (escalatedCount / createdCount) * 100 : 0,
      suppression_rate: createdCount > 0 ? (suppressedCount / createdCount) * 100 : 0
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Detect patterns in alert data
   */
  private detectPatterns(newEvent: AlertEvent): void {
    const analysisWindow = this.config.patternDetection.analysisWindow;
    const cutoff = subDays(new Date(), analysisWindow);
    const recentEvents = this.events.filter(e => e.timestamp >= cutoff);

    // Pattern 1: High frequency alerts from same source
    this.detectHighFrequencyPattern(newEvent, recentEvents);
    
    // Pattern 2: Cascading failures
    this.detectCascadingFailurePattern(newEvent, recentEvents);
    
    // Pattern 3: Time-based patterns
    this.detectTimeBasedPattern(newEvent, recentEvents);
    
    // Pattern 4: Severity escalation patterns
    this.detectSeverityEscalationPattern(newEvent, recentEvents);
  }

  /**
   * Detect high frequency patterns
   */
  private detectHighFrequencyPattern(newEvent: AlertEvent, recentEvents: AlertEvent[]): void {
    const sourceEvents = recentEvents.filter(e => 
      e.source === newEvent.source && 
      e.type === 'created'
    );

    if (sourceEvents.length >= this.config.patternDetection.minOccurrences) {
      const patternId = `high_freq_${newEvent.source}`;
      
      const pattern: AlertPattern = {
        id: patternId,
        name: `High Frequency Alerts: ${newEvent.source}`,
        description: `Frequent alerts from ${newEvent.source}`,
        pattern: {
          sources: [newEvent.source],
          frequencyThreshold: sourceEvents.length
        },
        confidence: Math.min(0.95, sourceEvents.length / 50),
        occurrences: sourceEvents.length,
        lastSeen: newEvent.timestamp,
        impact: {
          avgBusinessScore: _.mean(sourceEvents.map(e => e.businessImpactScore || 0)),
          avgResolutionTime: this.calculateMTTR(sourceEvents),
          escalationRate: (sourceEvents.filter(e => e.type === 'escalated').length / sourceEvents.length) * 100
        },
        recommendations: [
          'Review monitoring configuration for this source',
          'Consider alert throttling or suppression rules',
          'Investigate underlying system issues'
        ],
        status: 'active'
      };

      this.patterns.set(patternId, pattern);
      this.emit('patternDetected', pattern);
    }
  }

  /**
   * Detect cascading failure patterns
   */
  private detectCascadingFailurePattern(newEvent: AlertEvent, recentEvents: AlertEvent[]): void {
    const recentAlerts = recentEvents
      .filter(e => e.type === 'created' && e.timestamp >= subMinutes(new Date(), 30))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (recentAlerts.length >= 5) {
      const sources = recentAlerts.map(e => e.source);
      const uniqueSources = new Set(sources);
      
      if (uniqueSources.size >= 3) {
        const patternId = 'cascading_failure';
        
        const pattern: AlertPattern = {
          id: patternId,
          name: 'Cascading Failure Pattern',
          description: 'Multiple services failing in sequence',
          pattern: {
            sources: Array.from(uniqueSources),
            correlationRules: ['temporal_proximity', 'multiple_services']
          },
          confidence: Math.min(0.9, uniqueSources.size / 10),
          occurrences: recentAlerts.length,
          lastSeen: newEvent.timestamp,
          impact: {
            avgBusinessScore: _.mean(recentAlerts.map(e => e.businessImpactScore || 0)),
            avgResolutionTime: 0, // Too early to calculate
            escalationRate: 0
          },
          recommendations: [
            'Check infrastructure dependencies',
            'Review recent deployments',
            'Investigate common failure points'
          ],
          status: 'active'
        };

        this.patterns.set(patternId, pattern);
        this.emit('patternDetected', pattern);
      }
    }
  }

  /**
   * Detect time-based patterns
   */
  private detectTimeBasedPattern(newEvent: AlertEvent, recentEvents: AlertEvent[]): void {
    const sourceEvents = recentEvents.filter(e => 
      e.source === newEvent.source && 
      e.type === 'created'
    );

    // Group by hour to find patterns
    const hourlyDistribution: Record<number, number> = {};
    for (const event of sourceEvents) {
      const hour = event.timestamp.getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    }

    // Find peak hours (more than 50% above average)
    const averagePerHour = sourceEvents.length / 24;
    const peakHours = Object.entries(hourlyDistribution)
      .filter(([, count]) => count > averagePerHour * 1.5)
      .map(([hour]) => parseInt(hour));

    if (peakHours.length > 0 && sourceEvents.length >= this.config.patternDetection.minOccurrences) {
      const patternId = `time_pattern_${newEvent.source}`;
      
      const pattern: AlertPattern = {
        id: patternId,
        name: `Time-based Pattern: ${newEvent.source}`,
        description: `Alerts from ${newEvent.source} peak at specific hours`,
        pattern: {
          sources: [newEvent.source],
          timePattern: `Peak hours: ${peakHours.join(', ')}`
        },
        confidence: Math.min(0.8, peakHours.length / 8),
        occurrences: sourceEvents.length,
        lastSeen: newEvent.timestamp,
        impact: {
          avgBusinessScore: _.mean(sourceEvents.map(e => e.businessImpactScore || 0)),
          avgResolutionTime: this.calculateMTTR(sourceEvents),
          escalationRate: 0
        },
        recommendations: [
          'Consider time-based alert suppression during peak hours',
          'Investigate if pattern correlates with usage patterns',
          'Review scheduled tasks or batch jobs'
        ],
        status: 'active'
      };

      this.patterns.set(patternId, pattern);
      this.emit('patternDetected', pattern);
    }
  }

  /**
   * Detect severity escalation patterns
   */
  private detectSeverityEscalationPattern(newEvent: AlertEvent, recentEvents: AlertEvent[]): void {
    const alertEvents = recentEvents
      .filter(e => e.alertId === newEvent.alertId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (alertEvents.length >= 3) {
      const severities = alertEvents.map(e => e.severity);
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      const levels = severities.map(s => severityLevels[s as keyof typeof severityLevels]);
      
      // Check for escalation pattern
      let isEscalating = true;
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] <= levels[i - 1]) {
          isEscalating = false;
          break;
        }
      }

      if (isEscalating) {
        const patternId = `severity_escalation_${newEvent.alertId}`;
        
        const pattern: AlertPattern = {
          id: patternId,
          name: 'Severity Escalation Pattern',
          description: 'Alert severity escalating over time',
          pattern: {
            severities,
            correlationRules: ['severity_escalation']
          },
          confidence: 0.85,
          occurrences: alertEvents.length,
          lastSeen: newEvent.timestamp,
          impact: {
            avgBusinessScore: _.mean(alertEvents.map(e => e.businessImpactScore || 0)),
            avgResolutionTime: 0,
            escalationRate: 100 // By definition
          },
          recommendations: [
            'Immediate escalation required',
            'Review incident response procedures',
            'Check if automated remediation is available'
          ],
          status: 'active'
        };

        this.patterns.set(patternId, pattern);
        this.emit('patternDetected', pattern);
      }
    }
  }

  /**
   * Create dashboard widget
   */
  public createWidget(widget: DashboardWidget): void {
    const validated = DashboardWidgetSchema.parse(widget);
    this.widgets.set(validated.id, validated);
    this.emit('widgetCreated', validated);
  }

  /**
   * Update metrics
   */
  private updateMetrics(event: AlertEvent): void {
    if (event.type === 'created') {
      this.metrics.totalAlerts++;
    }

    // Update real-time metrics periodically
    this.recalculateMetrics();
  }

  /**
   * Recalculate all metrics
   */
  private recalculateMetrics(): void {
    const now = new Date();
    const last24Hours = subHours(now, 24);
    const recentEvents = this.events.filter(e => e.timestamp >= last24Hours);

    // Volume metrics
    this.metrics.alertsPerDay = recentEvents.filter(e => e.type === 'created').length;
    this.metrics.alertsPerHour = this.metrics.alertsPerDay / 24;

    // Performance metrics
    this.metrics.meanTimeToResolution = this.calculateMTTR(recentEvents);
    this.metrics.meanTimeToAcknowledgment = this.calculateMTTA(recentEvents);

    // Update top sources
    const sourceCounts = _.countBy(recentEvents.filter(e => e.type === 'created'), 'source');
    this.metrics.topSources = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count, trend: 'stable' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Update patterns
    this.metrics.problematicPatterns = Array.from(this.patterns.values())
      .filter(p => p.status === 'active')
      .map(p => ({ pattern: p.name, frequency: p.occurrences, impact: p.impact.avgBusinessScore }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5);
  }

  /**
   * Initialize builtin patterns
   */
  private initializeBuiltinPatterns(): void {
    // Pattern detection rules would be loaded here
    // For now, patterns are detected dynamically
  }

  /**
   * Start maintenance jobs
   */
  private startMaintenanceJobs(): void {
    // Clean up old events
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000); // Every hour

    // Update metrics
    setInterval(() => {
      this.recalculateMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Clean up cache
    if (this.config.cacheResults) {
      setInterval(() => {
        this.cleanupCache();
      }, 10 * 60 * 1000); // Every 10 minutes
    }
  }

  /**
   * Clean up old events
   */
  private cleanupOldEvents(): void {
    const cutoff = subDays(new Date(), this.config.retentionDays);
    this.events = this.events.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Clean up cache
   */
  private cleanupCache(): void {
    const cutoff = subMinutes(new Date(), this.config.cacheExpirationMinutes);
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoff) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: AnalyticsQuery): string {
    return `query_${JSON.stringify(query)}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(entry: { data: any; timestamp: Date }): boolean {
    const maxAge = this.config.cacheExpirationMinutes * 60 * 1000;
    return (Date.now() - entry.timestamp.getTime()) < maxAge;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): AnalyticsMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detected patterns
   */
  public getPatterns(status?: string): AlertPattern[] {
    const patterns = Array.from(this.patterns.values());
    return status ? patterns.filter(p => p.status === status) : patterns;
  }

  /**
   * Get dashboard widgets
   */
  public getWidgets(): DashboardWidget[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Generate automated insights
   */
  public generateInsights(): Array<{
    type: 'warning' | 'info' | 'critical';
    title: string;
    description: string;
    recommendation: string;
    confidence: number;
  }> {
    const insights: any[] = [];

    // Alert volume insights
    if (this.metrics.alertsPerHour > 50) {
      insights.push({
        type: 'warning',
        title: 'High Alert Volume',
        description: `Current alert rate: ${this.metrics.alertsPerHour.toFixed(1)} per hour`,
        recommendation: 'Consider reviewing alert configuration and implementing suppression rules',
        confidence: 0.9
      });
    }

    // MTTR insights
    if (this.metrics.meanTimeToResolution > 30 * 60 * 1000) { // 30 minutes
      insights.push({
        type: 'critical',
        title: 'High Mean Time to Resolution',
        description: `MTTR: ${(this.metrics.meanTimeToResolution / (60 * 1000)).toFixed(1)} minutes`,
        recommendation: 'Improve incident response procedures and consider automation',
        confidence: 0.85
      });
    }

    // Pattern insights
    const activePatterns = this.getPatterns('active');
    if (activePatterns.length > 5) {
      insights.push({
        type: 'warning',
        title: 'Multiple Active Patterns Detected',
        description: `${activePatterns.length} alert patterns currently active`,
        recommendation: 'Investigate recurring issues and implement preventive measures',
        confidence: 0.8
      });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Export analytics data
   */
  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'type', 'source', 'severity', 'businessImpactScore'];
      const rows = this.events.map(e => [
        e.timestamp.toISOString(),
        e.type,
        e.source,
        e.severity,
        e.businessImpactScore || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify({
      events: this.events,
      patterns: Array.from(this.patterns.values()),
      metrics: this.metrics
    }, null, 2);
  }
}

export default AlertAnalytics;