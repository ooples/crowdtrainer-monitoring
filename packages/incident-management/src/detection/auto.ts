import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import {
  Alert,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  AlertSource,
  IncidentManagementConfig,
  AlertSchema,
  IncidentSchema,
  ValidationError,
  TimelineEvent,
} from '../types';

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    alertPattern: string;
    threshold: number;
    timeWindow: number; // seconds
    severity: IncidentSeverity;
  };
  actions: {
    createIncident: boolean;
    assignToTeam?: string;
    escalateAfter?: number; // seconds
    runbook?: string;
  };
}

export interface AlertCorrelation {
  id: string;
  alerts: Alert[];
  pattern: string;
  confidence: number;
  suggestedIncident?: Partial<Incident>;
  createdAt: Date;
}

export class AutomaticIncidentDetection extends EventEmitter {
  private redis: Redis;
  private logger: Logger;
  private config: IncidentManagementConfig;
  private detectionRules: Map<string, DetectionRule> = new Map();
  private alertBuffer: Map<string, Alert[]> = new Map();
  private correlationEngine: AlertCorrelationEngine;
  private isRunning = false;
  private detectionInterval?: NodeJS.Timeout;

  constructor(
    config: IncidentManagementConfig,
    redis: Redis,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.redis = redis;
    this.logger = logger;
    this.correlationEngine = new AlertCorrelationEngine(logger);
    
    this.setupDefaultRules();
  }

  /**
   * Start the automatic incident detection system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Incident detection already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting automatic incident detection system');

    // Subscribe to alert stream
    await this.redis.subscribe('alerts:new');
    this.redis.on('message', this.handleAlertMessage.bind(this));

    // Start periodic correlation analysis
    this.detectionInterval = setInterval(
      () => this.runCorrelationAnalysis(),
      30000 // 30 seconds
    );

    this.emit('started');
    this.logger.info('Automatic incident detection system started');
  }

  /**
   * Stop the automatic incident detection system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.logger.info('Stopping automatic incident detection system');

    await this.redis.unsubscribe('alerts:new');
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    this.emit('stopped');
    this.logger.info('Automatic incident detection system stopped');
  }

  /**
   * Process incoming alert and detect incidents
   */
  async processAlert(alert: Alert): Promise<void> {
    try {
      // Validate alert
      const validatedAlert = AlertSchema.parse(alert);
      
      // Check for duplicate alerts
      const isDuplicate = await this.isDuplicateAlert(validatedAlert);
      if (isDuplicate) {
        this.logger.debug(`Duplicate alert ignored: ${validatedAlert.id}`);
        return;
      }

      // Store alert in buffer
      await this.bufferAlert(validatedAlert);

      // Apply detection rules
      const matchedRules = this.matchDetectionRules(validatedAlert);
      
      for (const rule of matchedRules) {
        await this.processRule(rule, validatedAlert);
      }

      // Update correlation analysis
      this.correlationEngine.addAlert(validatedAlert);

      // Record detection metrics
      await this.recordDetectionMetrics(validatedAlert);

      this.logger.info(`Alert processed: ${validatedAlert.id}`);
      this.emit('alert_processed', validatedAlert);

    } catch (error) {
      this.logger.error('Error processing alert:', error);
      this.emit('error', error);
    }
  }

  /**
   * Add or update detection rule
   */
  addDetectionRule(rule: DetectionRule): void {
    this.detectionRules.set(rule.id, rule);
    this.logger.info(`Detection rule added/updated: ${rule.name}`);
    this.emit('rule_updated', rule);
  }

  /**
   * Remove detection rule
   */
  removeDetectionRule(ruleId: string): void {
    this.detectionRules.delete(ruleId);
    this.logger.info(`Detection rule removed: ${ruleId}`);
    this.emit('rule_removed', ruleId);
  }

  /**
   * Get all detection rules
   */
  getDetectionRules(): DetectionRule[] {
    return Array.from(this.detectionRules.values());
  }

  /**
   * Get correlation suggestions
   */
  async getCorrelationSuggestions(): Promise<AlertCorrelation[]> {
    return this.correlationEngine.getCorrelations();
  }

  /**
   * Handle Redis alert messages
   */
  private async handleAlertMessage(channel: string, message: string): Promise<void> {
    if (channel !== 'alerts:new') return;

    try {
      const alert = JSON.parse(message) as Alert;
      await this.processAlert(alert);
    } catch (error) {
      this.logger.error('Error handling alert message:', error);
    }
  }

  /**
   * Check if alert is duplicate within cooldown period
   */
  private async isDuplicateAlert(alert: Alert): Promise<boolean> {
    const key = `alert:${alert.source}:${alert.title}`;
    const existing = await this.redis.get(key);
    
    if (existing) {
      const existingAlert = JSON.parse(existing) as Alert;
      const timeDiff = alert.timestamp.getTime() - existingAlert.timestamp.getTime();
      
      if (timeDiff < this.config.detection.cooldownPeriod * 1000) {
        return true;
      }
    }

    // Store alert with TTL
    await this.redis.setex(
      key,
      this.config.detection.cooldownPeriod,
      JSON.stringify(alert)
    );
    
    return false;
  }

  /**
   * Buffer alert for correlation analysis
   */
  private async bufferAlert(alert: Alert): Promise<void> {
    const bufferKey = `alert_buffer:${alert.source}`;
    
    if (!this.alertBuffer.has(bufferKey)) {
      this.alertBuffer.set(bufferKey, []);
    }

    const buffer = this.alertBuffer.get(bufferKey)!;
    buffer.push(alert);

    // Keep only alerts from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.alertBuffer.set(
      bufferKey,
      buffer.filter(a => a.timestamp > oneHourAgo)
    );
  }

  /**
   * Match alert against detection rules
   */
  private matchDetectionRules(alert: Alert): DetectionRule[] {
    const matched: DetectionRule[] = [];

    for (const rule of this.detectionRules.values()) {
      if (!rule.enabled) continue;

      if (this.alertMatchesRule(alert, rule)) {
        matched.push(rule);
      }
    }

    return matched;
  }

  /**
   * Check if alert matches rule conditions
   */
  private alertMatchesRule(alert: Alert, rule: DetectionRule): boolean {
    // Match pattern
    const pattern = new RegExp(rule.conditions.alertPattern, 'i');
    if (!pattern.test(alert.title) && !pattern.test(alert.description)) {
      return false;
    }

    // Match severity
    if (rule.conditions.severity !== alert.severity) {
      return false;
    }

    return true;
  }

  /**
   * Process matched detection rule
   */
  private async processRule(rule: DetectionRule, alert: Alert): Promise<void> {
    this.logger.info(`Processing rule "${rule.name}" for alert ${alert.id}`);

    // Check threshold
    const recentAlerts = await this.getRecentAlertsForRule(rule);
    
    if (recentAlerts.length < rule.conditions.threshold) {
      this.logger.debug(`Threshold not met for rule "${rule.name}": ${recentAlerts.length}/${rule.conditions.threshold}`);
      return;
    }

    if (rule.actions.createIncident) {
      await this.createIncidentFromRule(rule, alert, recentAlerts);
    }
  }

  /**
   * Get recent alerts that match rule
   */
  private async getRecentAlertsForRule(rule: DetectionRule): Promise<Alert[]> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - rule.conditions.timeWindow * 1000);
    
    const allAlerts: Alert[] = [];
    for (const buffer of this.alertBuffer.values()) {
      allAlerts.push(...buffer.filter(a => 
        a.timestamp >= windowStart && 
        this.alertMatchesRule(a, rule)
      ));
    }

    return allAlerts;
  }

  /**
   * Create incident from detection rule
   */
  private async createIncidentFromRule(
    rule: DetectionRule, 
    triggerAlert: Alert, 
    relatedAlerts: Alert[]
  ): Promise<void> {
    const incident: Incident = {
      id: uuidv4(),
      title: `Auto-detected: ${rule.name}`,
      description: `Incident automatically created by rule "${rule.name}". Triggered by ${relatedAlerts.length} alerts.`,
      status: IncidentStatus.INVESTIGATING,
      severity: rule.conditions.severity,
      source: triggerAlert.source,
      affectedComponents: [],
      assignedTeam: rule.actions.assignToTeam,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['auto-detected', rule.id],
      metadata: {
        detectionRule: rule.id,
        triggerAlert: triggerAlert.id,
        relatedAlerts: relatedAlerts.map(a => a.id),
        runbook: rule.actions.runbook,
      },
    };

    // Validate incident
    const validatedIncident = IncidentSchema.parse(incident);

    // Store incident
    await this.redis.hset(
      'incidents',
      incident.id,
      JSON.stringify(validatedIncident)
    );

    // Create timeline event
    const timelineEvent: TimelineEvent = {
      id: uuidv4(),
      incidentId: incident.id,
      type: 'alert',
      title: 'Incident Created',
      description: `Incident automatically created by detection rule: ${rule.name}`,
      timestamp: new Date(),
      metadata: { ruleId: rule.id },
    };

    await this.redis.lpush(
      `timeline:${incident.id}`,
      JSON.stringify(timelineEvent)
    );

    // Emit event
    this.emit('incident_created', validatedIncident);
    this.logger.info(`Incident created: ${incident.id} from rule "${rule.name}"`);

    // Schedule escalation if configured
    if (rule.actions.escalateAfter) {
      setTimeout(() => {
        this.emit('escalate_incident', incident.id);
      }, rule.actions.escalateAfter * 1000);
    }
  }

  /**
   * Run correlation analysis on buffered alerts
   */
  private async runCorrelationAnalysis(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const correlations = await this.correlationEngine.analyzeCorrelations();
      
      for (const correlation of correlations) {
        if (correlation.confidence > 0.8) {
          this.emit('high_correlation_detected', correlation);
          this.logger.info(`High correlation detected: ${correlation.pattern}`);
        }
      }
    } catch (error) {
      this.logger.error('Error running correlation analysis:', error);
    }
  }

  /**
   * Record detection metrics
   */
  private async recordDetectionMetrics(alert: Alert): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const metrics = {
      alerts_processed: 1,
      alert_source: alert.source,
      alert_severity: alert.severity,
      detection_latency: Date.now() - alert.timestamp.getTime(),
    };

    await this.redis.zadd(
      'detection_metrics',
      timestamp,
      JSON.stringify(metrics)
    );
  }

  /**
   * Setup default detection rules
   */
  private setupDefaultRules(): void {
    const defaultRules: DetectionRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Detect when error rate exceeds threshold',
        enabled: true,
        conditions: {
          alertPattern: 'error.rate|errors|failure',
          threshold: 3,
          timeWindow: 300, // 5 minutes
          severity: IncidentSeverity.P2_HIGH,
        },
        actions: {
          createIncident: true,
          assignToTeam: 'platform',
          escalateAfter: 900, // 15 minutes
          runbook: 'high-error-rate-runbook',
        },
      },
      {
        id: 'service-down',
        name: 'Service Down',
        description: 'Detect when critical service is down',
        enabled: true,
        conditions: {
          alertPattern: 'down|unavailable|timeout',
          threshold: 1,
          timeWindow: 60, // 1 minute
          severity: IncidentSeverity.P1_CRITICAL,
        },
        actions: {
          createIncident: true,
          assignToTeam: 'sre',
          escalateAfter: 300, // 5 minutes
          runbook: 'service-down-runbook',
        },
      },
      {
        id: 'database-issues',
        name: 'Database Performance Issues',
        description: 'Detect database performance degradation',
        enabled: true,
        conditions: {
          alertPattern: 'database|db|mysql|postgres|slow.query',
          threshold: 5,
          timeWindow: 600, // 10 minutes
          severity: IncidentSeverity.P3_MEDIUM,
        },
        actions: {
          createIncident: true,
          assignToTeam: 'database',
          escalateAfter: 1800, // 30 minutes
          runbook: 'database-performance-runbook',
        },
      },
    ];

    for (const rule of defaultRules) {
      this.detectionRules.set(rule.id, rule);
    }

    this.logger.info(`Loaded ${defaultRules.length} default detection rules`);
  }
}

/**
 * Alert Correlation Engine for detecting patterns in alerts
 */
class AlertCorrelationEngine {
  private alerts: Alert[] = [];
  private correlations: AlertCorrelation[] = [];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  addAlert(alert: Alert): void {
    this.alerts.push(alert);
    
    // Keep only alerts from last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > twoHoursAgo);
  }

  async analyzeCorrelations(): Promise<AlertCorrelation[]> {
    const newCorrelations: AlertCorrelation[] = [];

    // Pattern 1: Same source, different components
    const correlationsBySource = this.groupAlertsBySource();
    for (const [source, alerts] of correlationsBySource.entries()) {
      if (alerts.length >= 3) {
        const correlation = this.createCorrelation(
          alerts,
          `Multiple alerts from ${source}`,
          0.7
        );
        newCorrelations.push(correlation);
      }
    }

    // Pattern 2: Cascade failures (temporal correlation)
    const cascadeCorrelations = await this.detectCascadeFailures();
    newCorrelations.push(...cascadeCorrelations);

    // Pattern 3: Similar error messages
    const messageCorrelations = this.detectSimilarMessages();
    newCorrelations.push(...messageCorrelations);

    this.correlations = newCorrelations;
    return newCorrelations;
  }

  getCorrelations(): AlertCorrelation[] {
    return this.correlations;
  }

  private groupAlertsBySource(): Map<AlertSource, Alert[]> {
    const grouped = new Map<AlertSource, Alert[]>();
    
    for (const alert of this.alerts) {
      if (!grouped.has(alert.source)) {
        grouped.set(alert.source, []);
      }
      grouped.get(alert.source)!.push(alert);
    }

    return grouped;
  }

  private async detectCascadeFailures(): Promise<AlertCorrelation[]> {
    const correlations: AlertCorrelation[] = [];
    const sortedAlerts = [...this.alerts].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (let i = 0; i < sortedAlerts.length - 2; i++) {
      const window = sortedAlerts.slice(i, i + 3);
      const timeSpan = window[2].timestamp.getTime() - window[0].timestamp.getTime();
      
      // If 3+ alerts within 10 minutes, consider cascade
      if (timeSpan <= 10 * 60 * 1000) {
        correlations.push(this.createCorrelation(
          window,
          'Potential cascade failure',
          0.6
        ));
      }
    }

    return correlations;
  }

  private detectSimilarMessages(): AlertCorrelation[] {
    const correlations: AlertCorrelation[] = [];
    const groups = new Map<string, Alert[]>();

    for (const alert of this.alerts) {
      const key = this.extractKeywords(alert.title + ' ' + alert.description);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(alert);
    }

    for (const [keywords, alerts] of groups.entries()) {
      if (alerts.length >= 2) {
        correlations.push(this.createCorrelation(
          alerts,
          `Similar messages: ${keywords}`,
          0.5
        ));
      }
    }

    return correlations;
  }

  private extractKeywords(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3)
      .sort()
      .join('-');
  }

  private createCorrelation(
    alerts: Alert[],
    pattern: string,
    confidence: number
  ): AlertCorrelation {
    return {
      id: uuidv4(),
      alerts,
      pattern,
      confidence,
      createdAt: new Date(),
      suggestedIncident: {
        title: `Correlated Issue: ${pattern}`,
        description: `Multiple related alerts detected: ${alerts.map(a => a.title).join(', ')}`,
        severity: this.determineSeverityFromAlerts(alerts),
        affectedComponents: [...new Set(alerts.flatMap(a => 
          Object.keys(a.labels).filter(k => k.includes('component'))
        ))],
        tags: ['auto-correlated'],
      },
    };
  }

  private determineSeverityFromAlerts(alerts: Alert[]): IncidentSeverity {
    const severities = alerts.map(a => a.severity);
    
    if (severities.includes(IncidentSeverity.P1_CRITICAL)) {
      return IncidentSeverity.P1_CRITICAL;
    }
    if (severities.includes(IncidentSeverity.P2_HIGH)) {
      return IncidentSeverity.P2_HIGH;
    }
    if (severities.includes(IncidentSeverity.P3_MEDIUM)) {
      return IncidentSeverity.P3_MEDIUM;
    }
    return IncidentSeverity.P4_LOW;
  }
}