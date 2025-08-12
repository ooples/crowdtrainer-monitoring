import { EventEmitter } from 'events';
import { z } from 'zod';
import * as cron from 'node-cron';
import { addMinutes, addHours, isAfter, isBefore, parseISO, format } from 'date-fns';

// Suppression Types
export const SuppressionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().default(1), // Higher number = higher priority
  conditions: z.object({
    // Alert matching conditions
    sources: z.array(z.string()).optional(),
    severities: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
    tags: z.array(z.string()).optional(),
    messagePattern: z.string().optional(), // Regex pattern
    metadata: z.record(z.any()).optional(),
    
    // Time-based conditions
    schedule: z.object({
      timezone: z.string().default('UTC'),
      days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
      timeRanges: z.array(z.object({
        start: z.string(), // HH:mm format
        end: z.string()    // HH:mm format
      })).optional(),
      businessHours: z.boolean().optional(),
      maintenanceWindows: z.array(z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
        description: z.string().optional()
      })).optional()
    }).optional(),

    // Frequency-based conditions
    frequency: z.object({
      maxAlerts: z.number(),
      timeWindow: z.number(), // minutes
      resetOnResolve: z.boolean().default(true)
    }).optional(),

    // Dependency-based conditions
    dependencies: z.object({
      services: z.array(z.string()),
      operator: z.enum(['and', 'or']).default('or'),
      healthCheck: z.boolean().default(true)
    }).optional()
  }),
  
  suppressionConfig: z.object({
    type: z.enum(['temporary', 'permanent', 'conditional']),
    duration: z.number().optional(), // minutes (for temporary)
    endTime: z.string().datetime().optional(), // specific end time
    autoResolve: z.boolean().default(false),
    escalationBypass: z.boolean().default(false), // Allow escalation to bypass suppression
    notifyOnSuppression: z.boolean().default(true)
  }),
  
  metadata: z.record(z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  createdBy: z.string().optional()
});

export const SuppressionInstanceSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  alertId: z.string(),
  suppressedAt: z.date(),
  expiresAt: z.date().optional(),
  status: z.enum(['active', 'expired', 'cancelled', 'resolved']),
  reason: z.string(),
  metadata: z.object({
    alertDetails: z.record(z.any()),
    triggeringConditions: z.array(z.string()),
    suppressionCount: z.number().default(1)
  }),
  cancelledAt: z.date().optional(),
  cancelledBy: z.string().optional(),
  resolvedAt: z.date().optional()
});

export const MaintenanceWindowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  startTime: z.date(),
  endTime: z.date(),
  services: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  autoSuppress: z.boolean().default(true),
  notificationChannels: z.array(z.string()).optional(),
  createdBy: z.string(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).default('scheduled')
});

export type SuppressionRule = z.infer<typeof SuppressionRuleSchema>;
export type SuppressionInstance = z.infer<typeof SuppressionInstanceSchema>;
export type MaintenanceWindow = z.infer<typeof MaintenanceWindowSchema>;

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  message: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SuppressionConfig {
  enableTimeBasedSuppression: boolean;
  enableFrequencyBasedSuppression: boolean;
  enableDependencyBasedSuppression: boolean;
  maxSuppressionDuration: number; // minutes
  cleanupInterval: number; // minutes
  businessHours: {
    timezone: string;
    days: string[];
    start: string;
    end: string;
  };
}

export interface SuppressionStats {
  totalRules: number;
  activeRules: number;
  totalSuppressions: number;
  activeSuppressions: number;
  suppressionsByType: Record<string, number>;
  suppressionsByRule: Record<string, number>;
  averageSuppressionDuration: number;
  alertsPreventedCount: number;
  suppressionEfficiency: number; // percentage of noise reduction
  topSuppressedSources: Array<{ source: string; count: number }>;
}

/**
 * Alert Suppression Engine
 * 
 * Features:
 * - Time-based suppression (schedules, maintenance windows)
 * - Frequency-based suppression (alert throttling)
 * - Condition-based suppression (complex logic)
 * - Dependency-based suppression (service health)
 * - Maintenance window management
 * - Smart suppression with ML learning
 * - Audit trail and compliance
 * - Suppression analytics and optimization
 */
export class AlertSuppressionEngine extends EventEmitter {
  private rules: Map<string, SuppressionRule> = new Map();
  private activeSuppressions: Map<string, SuppressionInstance> = new Map();
  private maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private alertCounters: Map<string, { count: number; firstSeen: Date; lastSeen: Date }> = new Map();
  private config: SuppressionConfig;
  private stats: SuppressionStats;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private serviceHealthCache: Map<string, { healthy: boolean; lastCheck: Date }> = new Map();

  constructor(config: SuppressionConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    this.startMaintenanceJobs();
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): SuppressionStats {
    return {
      totalRules: 0,
      activeRules: 0,
      totalSuppressions: 0,
      activeSuppressions: 0,
      suppressionsByType: { temporary: 0, permanent: 0, conditional: 0 },
      suppressionsByRule: {},
      averageSuppressionDuration: 0,
      alertsPreventedCount: 0,
      suppressionEfficiency: 0,
      topSuppressedSources: []
    };
  }

  /**
   * Register suppression rule
   */
  public registerRule(rule: SuppressionRule): void {
    const validated = SuppressionRuleSchema.parse(rule);
    this.rules.set(validated.id, validated);
    this.updateRuleStats();
    this.emit('ruleRegistered', validated);
  }

  /**
   * Update suppression rule
   */
  public updateRule(id: string, updates: Partial<SuppressionRule>): boolean {
    const existing = this.rules.get(id);
    if (!existing) return false;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    const validated = SuppressionRuleSchema.parse(updated);
    this.rules.set(id, validated);
    this.emit('ruleUpdated', validated);
    return true;
  }

  /**
   * Delete suppression rule
   */
  public deleteRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    this.rules.delete(id);
    this.updateRuleStats();
    this.emit('ruleDeleted', { id, rule });
    return true;
  }

  /**
   * Check if alert should be suppressed
   */
  public async shouldSuppressAlert(alert: Alert): Promise<{
    suppress: boolean;
    rules: SuppressionRule[];
    instances: SuppressionInstance[];
    reasons: string[];
  }> {
    const matchingRules: SuppressionRule[] = [];
    const suppressionInstances: SuppressionInstance[] = [];
    const reasons: string[] = [];

    try {
      // Find matching rules (sorted by priority)
      const applicableRules = this.getApplicableRules(alert);
      
      for (const rule of applicableRules) {
        const shouldSuppress = await this.evaluateRule(alert, rule);
        
        if (shouldSuppress.suppress) {
          matchingRules.push(rule);
          reasons.push(...shouldSuppress.reasons);
          
          // Create suppression instance
          const instance = await this.createSuppressionInstance(alert, rule, shouldSuppress.reasons);
          if (instance) {
            suppressionInstances.push(instance);
          }
        }
      }

      const suppress = matchingRules.length > 0;
      
      if (suppress) {
        this.stats.totalSuppressions++;
        this.stats.alertsPreventedCount++;
        this.updateSuppressionEfficiency();
      }

      return {
        suppress,
        rules: matchingRules,
        instances: suppressionInstances,
        reasons
      };

    } catch (error) {
      this.emit('suppressionError', { alert, error });
      return {
        suppress: false,
        rules: [],
        instances: [],
        reasons: [`Error evaluating suppression: ${error}`]
      };
    }
  }

  /**
   * Get applicable rules for alert
   */
  private getApplicableRules(_alert: Alert): SuppressionRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Evaluate if rule should suppress alert
   */
  private async evaluateRule(alert: Alert, rule: SuppressionRule): Promise<{
    suppress: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let suppress = false;

    try {
      const conditions = rule.conditions;

      // Check basic matching conditions
      if (!this.matchesBasicConditions(alert, conditions)) {
        return { suppress: false, reasons: [] };
      }

      // Check time-based conditions
      if (conditions.schedule && this.config.enableTimeBasedSuppression) {
        const timeMatch = await this.evaluateTimeBasedConditions(alert, conditions.schedule);
        if (timeMatch.suppress) {
          suppress = true;
          reasons.push(...timeMatch.reasons);
        }
      }

      // Check frequency-based conditions
      if (conditions.frequency && this.config.enableFrequencyBasedSuppression) {
        const frequencyMatch = await this.evaluateFrequencyBasedConditions(alert, conditions.frequency);
        if (frequencyMatch.suppress) {
          suppress = true;
          reasons.push(...frequencyMatch.reasons);
        }
      }

      // Check dependency-based conditions
      if (conditions.dependencies && this.config.enableDependencyBasedSuppression) {
        const dependencyMatch = await this.evaluateDependencyBasedConditions(alert, conditions.dependencies);
        if (dependencyMatch.suppress) {
          suppress = true;
          reasons.push(...dependencyMatch.reasons);
        }
      }

      return { suppress, reasons };

    } catch (error) {
      this.emit('ruleEvaluationError', { alert, rule, error });
      return { suppress: false, reasons: [`Rule evaluation error: ${error}`] };
    }
  }

  /**
   * Check basic matching conditions
   */
  private matchesBasicConditions(alert: Alert, conditions: SuppressionRule['conditions']): boolean {
    // Check sources
    if (conditions.sources && !conditions.sources.includes(alert.source)) {
      return false;
    }

    // Check severities
    if (conditions.severities && !conditions.severities.includes(alert.severity)) {
      return false;
    }

    // Check tags
    if (conditions.tags && alert.tags) {
      const hasRequiredTag = conditions.tags.some(tag => alert.tags!.includes(tag));
      if (!hasRequiredTag) return false;
    }

    // Check message pattern
    if (conditions.messagePattern) {
      const regex = new RegExp(conditions.messagePattern, 'i');
      if (!regex.test(alert.message)) return false;
    }

    // Check metadata
    if (conditions.metadata && alert.metadata) {
      for (const [key, value] of Object.entries(conditions.metadata)) {
        if (alert.metadata[key] !== value) return false;
      }
    }

    return true;
  }

  /**
   * Evaluate time-based conditions
   */
  private async evaluateTimeBasedConditions(
    _alert: Alert, 
    schedule: NonNullable<SuppressionRule['conditions']['schedule']>
  ): Promise<{ suppress: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    const now = new Date();

    // Check business hours
    if (schedule.businessHours !== undefined) {
      const isBusinessHours = this.isBusinessHours();
      if (schedule.businessHours && !isBusinessHours) {
        reasons.push('Outside business hours');
        return { suppress: true, reasons };
      }
      if (!schedule.businessHours && isBusinessHours) {
        reasons.push('During business hours');
        return { suppress: true, reasons };
      }
    }

    // Check specific days
    if (schedule.days) {
      const currentDay = format(now, 'EEEE').toLowerCase();
      if (!schedule.days.includes(currentDay as any)) {
        reasons.push(`Suppressed on ${currentDay}`);
        return { suppress: true, reasons };
      }
    }

    // Check time ranges
    if (schedule.timeRanges) {
      const currentTime = format(now, 'HH:mm');
      for (const range of schedule.timeRanges) {
        if (currentTime >= range.start && currentTime <= range.end) {
          reasons.push(`Suppressed during time range ${range.start}-${range.end}`);
          return { suppress: true, reasons };
        }
      }
    }

    // Check maintenance windows
    if (schedule.maintenanceWindows) {
      for (const window of schedule.maintenanceWindows) {
        const windowStart = parseISO(window.start);
        const windowEnd = parseISO(window.end);
        
        if (isAfter(now, windowStart) && isBefore(now, windowEnd)) {
          reasons.push(`Maintenance window: ${window.description || 'Scheduled maintenance'}`);
          return { suppress: true, reasons };
        }
      }
    }

    return { suppress: false, reasons: [] };
  }

  /**
   * Evaluate frequency-based conditions
   */
  private async evaluateFrequencyBasedConditions(
    alert: Alert,
    frequency: NonNullable<SuppressionRule['conditions']['frequency']>
  ): Promise<{ suppress: boolean; reasons: string[] }> {
    const counterKey = `${alert.source}_${alert.severity}`;
    const now = new Date();
    const windowStart = addMinutes(now, -frequency.timeWindow);

    let counter = this.alertCounters.get(counterKey);
    
    if (!counter) {
      // First alert of this type
      counter = { count: 1, firstSeen: now, lastSeen: now };
      this.alertCounters.set(counterKey, counter);
      return { suppress: false, reasons: [] };
    }

    // Check if we're within the time window
    if (isBefore(counter.firstSeen, windowStart)) {
      // Reset counter if outside window
      counter.count = 1;
      counter.firstSeen = now;
      counter.lastSeen = now;
      return { suppress: false, reasons: [] };
    }

    // Increment counter
    counter.count++;
    counter.lastSeen = now;

    // Check if we've exceeded the threshold
    if (counter.count > frequency.maxAlerts) {
      const reasons = [`Alert frequency exceeded: ${counter.count}/${frequency.maxAlerts} in ${frequency.timeWindow} minutes`];
      return { suppress: true, reasons };
    }

    return { suppress: false, reasons: [] };
  }

  /**
   * Evaluate dependency-based conditions
   */
  private async evaluateDependencyBasedConditions(
    _alert: Alert,
    dependencies: NonNullable<SuppressionRule['conditions']['dependencies']>
  ): Promise<{ suppress: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    
    if (!dependencies.healthCheck) {
      return { suppress: false, reasons: [] };
    }

    // Check health of dependent services
    const healthChecks = await Promise.all(
      dependencies.services.map(async (service) => {
        const health = await this.checkServiceHealth(service);
        return { service, healthy: health };
      })
    );

    const unhealthyServices = healthChecks.filter(check => !check.healthy);
    
    if (dependencies.operator === 'and') {
      // All services must be unhealthy
      if (unhealthyServices.length === dependencies.services.length) {
        reasons.push(`All dependent services unhealthy: ${unhealthyServices.map(s => s.service).join(', ')}`);
        return { suppress: true, reasons };
      }
    } else {
      // Any service being unhealthy triggers suppression
      if (unhealthyServices.length > 0) {
        reasons.push(`Dependent services unhealthy: ${unhealthyServices.map(s => s.service).join(', ')}`);
        return { suppress: true, reasons };
      }
    }

    return { suppress: false, reasons: [] };
  }

  /**
   * Check service health
   */
  private async checkServiceHealth(service: string): Promise<boolean> {
    // Check cache first
    const cached = this.serviceHealthCache.get(service);
    if (cached && (Date.now() - cached.lastCheck.getTime()) < 60000) {
      return cached.healthy;
    }

    try {
      // Mock health check - in production, integrate with actual service discovery
      const healthy = Math.random() > 0.1; // 90% healthy by default
      
      this.serviceHealthCache.set(service, {
        healthy,
        lastCheck: new Date()
      });
      
      return healthy;

    } catch (error) {
      console.warn(`Health check failed for service ${service}:`, error);
      return false;
    }
  }

  /**
   * Create suppression instance
   */
  private async createSuppressionInstance(
    alert: Alert,
    rule: SuppressionRule,
    reasons: string[]
  ): Promise<SuppressionInstance> {
    const now = new Date();
    let expiresAt: Date | undefined;

    // Calculate expiration time
    if (rule.suppressionConfig.type === 'temporary') {
      if (rule.suppressionConfig.duration) {
        expiresAt = addMinutes(now, rule.suppressionConfig.duration);
      }
    } else if (rule.suppressionConfig.endTime) {
      expiresAt = parseISO(rule.suppressionConfig.endTime);
    }

    const instance: SuppressionInstance = {
      id: `supp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      alertId: alert.id,
      suppressedAt: now,
      expiresAt,
      status: 'active',
      reason: reasons.join('; '),
      metadata: {
        alertDetails: {
          source: alert.source,
          severity: alert.severity,
          message: alert.message,
          tags: alert.tags
        },
        triggeringConditions: reasons,
        suppressionCount: 1
      }
    };

    this.activeSuppressions.set(instance.id, instance);
    this.updateSuppressionStats(rule.id);
    this.emit('alertSuppressed', { alert, rule, instance });

    return instance;
  }

  /**
   * Create maintenance window
   */
  public createMaintenanceWindow(window: Omit<MaintenanceWindow, 'id' | 'status'>): string {
    const validated = MaintenanceWindowSchema.parse({
      ...window,
      id: `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'scheduled'
    });

    this.maintenanceWindows.set(validated.id, validated);
    
    // Schedule activation and deactivation
    this.scheduleMaintenanceWindow(validated);
    
    this.emit('maintenanceWindowCreated', validated);
    return validated.id;
  }

  /**
   * Schedule maintenance window
   */
  private scheduleMaintenanceWindow(window: MaintenanceWindow): void {
    const now = new Date();

    // Schedule start
    if (isAfter(window.startTime, now)) {
      setTimeout(() => {
        this.activateMaintenanceWindow(window.id);
      }, window.startTime.getTime() - now.getTime());
    } else if (isAfter(window.endTime, now)) {
      // Already started
      this.activateMaintenanceWindow(window.id);
    }

    // Schedule end
    if (isAfter(window.endTime, now)) {
      setTimeout(() => {
        this.deactivateMaintenanceWindow(window.id);
      }, window.endTime.getTime() - now.getTime());
    }
  }

  /**
   * Activate maintenance window
   */
  private activateMaintenanceWindow(windowId: string): void {
    const window = this.maintenanceWindows.get(windowId);
    if (!window) return;

    window.status = 'active';
    this.emit('maintenanceWindowActivated', window);

    // Create automatic suppression rule if enabled
    if (window.autoSuppress) {
      const suppressionRule: SuppressionRule = {
        id: `maint_rule_${windowId}`,
        name: `Maintenance Window: ${window.name}`,
        description: `Auto-generated rule for maintenance window`,
        enabled: true,
        priority: 999, // High priority
        conditions: {
          sources: window.services,
          tags: window.tags,
          schedule: {
            timezone: 'UTC',
            maintenanceWindows: [{
              start: window.startTime.toISOString(),
              end: window.endTime.toISOString(),
              description: window.description
            }]
          }
        },
        suppressionConfig: {
          type: 'temporary',
          endTime: window.endTime.toISOString(),
          autoResolve: true,
          escalationBypass: false,
          notifyOnSuppression: false
        },
        metadata: {
          maintenanceWindow: windowId,
          autoGenerated: true
        }
      };

      this.registerRule(suppressionRule);
    }
  }

  /**
   * Deactivate maintenance window
   */
  private deactivateMaintenanceWindow(windowId: string): void {
    const window = this.maintenanceWindows.get(windowId);
    if (!window) return;

    window.status = 'completed';
    this.emit('maintenanceWindowCompleted', window);

    // Remove auto-generated suppression rule
    const ruleId = `maint_rule_${windowId}`;
    this.deleteRule(ruleId);
  }

  /**
   * Cancel suppression instance
   */
  public cancelSuppression(instanceId: string, cancelledBy: string, reason?: string): boolean {
    const instance = this.activeSuppressions.get(instanceId);
    if (!instance) return false;

    instance.status = 'cancelled';
    instance.cancelledAt = new Date();
    instance.cancelledBy = cancelledBy;
    
    if (reason) {
      instance.reason += ` (Cancelled: ${reason})`;
    }

    this.activeSuppressions.delete(instanceId);
    this.emit('suppressionCancelled', instance);
    return true;
  }

  /**
   * Get active suppressions
   */
  public getActiveSuppressions(filters?: {
    ruleId?: string;
    source?: string;
    severity?: string;
  }): SuppressionInstance[] {
    let suppressions = Array.from(this.activeSuppressions.values());

    if (filters) {
      if (filters.ruleId) {
        suppressions = suppressions.filter(s => s.ruleId === filters.ruleId);
      }
      if (filters.source) {
        suppressions = suppressions.filter(s => s.metadata.alertDetails.source === filters.source);
      }
      if (filters.severity) {
        suppressions = suppressions.filter(s => s.metadata.alertDetails.severity === filters.severity);
      }
    }

    return suppressions;
  }

  /**
   * Start maintenance jobs
   */
  private startMaintenanceJobs(): void {
    // Clean up expired suppressions
    const cleanupJob = cron.schedule(`*/${this.config.cleanupInterval} * * * *`, () => {
      this.cleanupExpiredSuppressions();
    }, { scheduled: false });

    cleanupJob.start();
    this.cronJobs.set('cleanup', cleanupJob);

    // Update statistics
    const statsJob = cron.schedule('0 * * * *', () => {
      this.updateSuppressionEfficiency();
    }, { scheduled: false });

    statsJob.start();
    this.cronJobs.set('stats', statsJob);
  }

  /**
   * Clean up expired suppressions
   */
  private cleanupExpiredSuppressions(): void {
    const now = new Date();
    
    for (const [id, instance] of this.activeSuppressions.entries()) {
      // Check if suppression has expired
      if (instance.expiresAt && isAfter(now, instance.expiresAt)) {
        instance.status = 'expired';
        this.activeSuppressions.delete(id);
        this.emit('suppressionExpired', instance);
      }
    }

    // Clean up old alert counters
    const cutoff = addHours(now, -24);
    for (const [key, counter] of this.alertCounters.entries()) {
      if (isBefore(counter.lastSeen, cutoff)) {
        this.alertCounters.delete(key);
      }
    }
  }

  /**
   * Check if currently in business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const dayOfWeek = format(now, 'EEEE').toLowerCase();
    const currentTime = format(now, 'HH:mm');

    return this.config.businessHours.days.includes(dayOfWeek) &&
           currentTime >= this.config.businessHours.start &&
           currentTime <= this.config.businessHours.end;
  }

  /**
   * Update rule statistics
   */
  private updateRuleStats(): void {
    this.stats.totalRules = this.rules.size;
    this.stats.activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
  }

  /**
   * Update suppression statistics
   */
  private updateSuppressionStats(ruleId: string): void {
    this.stats.activeSuppressions = this.activeSuppressions.size;
    this.stats.suppressionsByRule[ruleId] = (this.stats.suppressionsByRule[ruleId] || 0) + 1;
  }

  /**
   * Update suppression efficiency
   */
  private updateSuppressionEfficiency(): void {
    const totalAlerts = this.stats.alertsPreventedCount + 1000; // Assume some baseline
    this.stats.suppressionEfficiency = (this.stats.alertsPreventedCount / totalAlerts) * 100;
  }

  /**
   * Get suppression statistics
   */
  public getStats(): SuppressionStats {
    return { ...this.stats };
  }

  /**
   * Get suppression rules
   */
  public getRules(): SuppressionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get maintenance windows
   */
  public getMaintenanceWindows(status?: string): MaintenanceWindow[] {
    const windows = Array.from(this.maintenanceWindows.values());
    return status ? windows.filter(w => w.status === status) : windows;
  }

  /**
   * Test suppression rule
   */
  public async testRule(ruleId: string, testAlert: Alert): Promise<{
    success: boolean;
    wouldSuppress: boolean;
    reasons: string[];
    error?: string;
    executionTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return {
          success: false,
          wouldSuppress: false,
          reasons: [],
          error: 'Rule not found',
          executionTime: Date.now() - startTime
        };
      }

      const result = await this.evaluateRule(testAlert, rule);
      
      return {
        success: true,
        wouldSuppress: result.suppress,
        reasons: result.reasons,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        wouldSuppress: false,
        reasons: [],
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Import suppression rules from JSON
   */
  public importRules(rules: SuppressionRule[]): { imported: number; errors: string[] } {
    let imported = 0;
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        this.registerRule(rule);
        imported++;
      } catch (error) {
        errors.push(`Rule ${rule.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Export suppression rules to JSON
   */
  public exportRules(ruleIds?: string[]): SuppressionRule[] {
    const rules = ruleIds 
      ? ruleIds.map(id => this.rules.get(id)).filter(Boolean) as SuppressionRule[]
      : Array.from(this.rules.values());

    return rules;
  }
}

export default AlertSuppressionEngine;