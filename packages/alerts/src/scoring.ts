import { EventEmitter } from 'events';
import { z } from 'zod';
import * as _ from 'lodash';

// Business Impact Scoring Types
export const BusinessContextSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  tier: z.enum(['critical', 'high', 'medium', 'low']),
  revenue: z.object({
    hourly: z.number(),
    daily: z.number(),
    monthly: z.number()
  }).optional(),
  users: z.object({
    affected: z.number(),
    total: z.number(),
    vip: z.number().optional()
  }).optional(),
  dependencies: z.array(z.string()).optional(),
  sla: z.object({
    availability: z.number(), // percentage
    responseTime: z.number(), // milliseconds
    errorRate: z.number() // percentage
  }).optional(),
  businessHours: z.boolean().optional(),
  customMetrics: z.record(z.number()).optional()
});

export const ScoringWeightsSchema = z.object({
  severity: z.number().default(0.25),
  serviceImportance: z.number().default(0.20),
  userImpact: z.number().default(0.20),
  revenueImpact: z.number().default(0.15),
  frequency: z.number().default(0.10),
  duration: z.number().default(0.10)
});

export const AlertScoringRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  conditions: z.object({
    sources: z.array(z.string()).optional(),
    severities: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
    tags: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
    timeOfDay: z.object({
      start: z.string(), // HH:mm
      end: z.string()    // HH:mm
    }).optional(),
    businessHours: z.boolean().optional()
  }),
  scoreAdjustments: z.object({
    multiplier: z.number().default(1.0),
    additive: z.number().default(0),
    overrides: z.record(z.number()).optional()
  }),
  enabled: z.boolean().default(true)
});

export const BusinessImpactScoreSchema = z.object({
  alertId: z.string(),
  score: z.number().min(0).max(100),
  breakdown: z.object({
    severityScore: z.number(),
    serviceScore: z.number(),
    userImpactScore: z.number(),
    revenueImpactScore: z.number(),
    frequencyScore: z.number(),
    durationScore: z.number()
  }),
  factors: z.object({
    severity: z.string(),
    serviceImportance: z.string(),
    usersAffected: z.number().optional(),
    revenueAtRisk: z.number().optional(),
    frequency: z.number(),
    duration: z.number(),
    businessHours: z.boolean(),
    appliedRules: z.array(z.string())
  }),
  calculatedAt: z.date(),
  version: z.string().default('1.0')
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type AlertScoringRule = z.infer<typeof AlertScoringRuleSchema>;
export type BusinessImpactScore = z.infer<typeof BusinessImpactScoreSchema>;

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  message: string;
  tags?: string[];
  metadata?: Record<string, any>;
  duration?: number; // milliseconds
}

export interface AlertHistory {
  alertId: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  averageDuration: number;
  resolution: {
    automatic: number;
    manual: number;
    escalated: number;
  };
}

export interface ScoringConfig {
  weights: ScoringWeights;
  enableMachineLearning: boolean;
  learningThreshold: number; // minimum alerts needed for ML
  businessHours: {
    timezone: string;
    days: string[];
    start: string;
    end: string;
  };
  revenueCalculation: {
    method: 'linear' | 'exponential' | 'logarithmic';
    baseCost: number;
    multipliers: Record<string, number>;
  };
}

export interface ScoringStats {
  alertsScored: number;
  averageScore: number;
  scoreDistribution: Record<string, number>; // score ranges
  highImpactAlerts: number; // score > 80
  mediumImpactAlerts: number; // score 50-80
  lowImpactAlerts: number; // score < 50
  mlAccuracy: number;
  processingTimeMs: number;
}

/**
 * Business Impact Scoring Engine
 * 
 * Features:
 * - Multi-factor scoring (severity, service importance, user impact, revenue)
 * - Machine learning-based score refinement
 * - Historical pattern analysis
 * - Business context awareness
 * - Real-time score calculation
 * - Score trend analysis
 * - Configurable scoring rules and weights
 */
export class BusinessImpactScorer extends EventEmitter {
  private businessContexts: Map<string, BusinessContext> = new Map();
  private scoringRules: Map<string, AlertScoringRule> = new Map();
  private alertHistory: Map<string, AlertHistory> = new Map();
  private config: ScoringConfig;
  private stats: ScoringStats;
  private mlModel?: any;
  private scoreCache: Map<string, BusinessImpactScore> = new Map();

  constructor(config: ScoringConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    
    if (config.enableMachineLearning) {
      this.initializeMachineLearning();
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): ScoringStats {
    return {
      alertsScored: 0,
      averageScore: 0,
      scoreDistribution: {
        '0-20': 0,
        '21-40': 0,
        '41-60': 0,
        '61-80': 0,
        '81-100': 0
      },
      highImpactAlerts: 0,
      mediumImpactAlerts: 0,
      lowImpactAlerts: 0,
      mlAccuracy: 0,
      processingTimeMs: 0
    };
  }

  /**
   * Calculate business impact score for an alert
   */
  public async calculateScore(alert: Alert): Promise<BusinessImpactScore> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(alert);
      const cached = this.scoreCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Get business context for the service
      const businessContext = this.getBusinessContext(alert.source);
      
      // Update alert history
      this.updateAlertHistory(alert);
      
      // Calculate component scores
      const breakdown = {
        severityScore: this.calculateSeverityScore(alert.severity),
        serviceScore: this.calculateServiceScore(businessContext),
        userImpactScore: this.calculateUserImpactScore(alert, businessContext),
        revenueImpactScore: this.calculateRevenueImpactScore(alert, businessContext),
        frequencyScore: this.calculateFrequencyScore(alert),
        durationScore: this.calculateDurationScore(alert)
      };

      // Calculate weighted total score
      const weights = this.config.weights;
      let totalScore = (
        breakdown.severityScore * weights.severity +
        breakdown.serviceScore * weights.serviceImportance +
        breakdown.userImpactScore * weights.userImpact +
        breakdown.revenueImpactScore * weights.revenueImpact +
        breakdown.frequencyScore * weights.frequency +
        breakdown.durationScore * weights.duration
      );

      // Apply scoring rules
      const appliedRules = await this.applyScoringRules(alert, totalScore);
      totalScore = appliedRules.adjustedScore;

      // Apply ML adjustments if available
      if (this.mlModel && this.stats.alertsScored > this.config.learningThreshold) {
        const mlAdjustment = await this.getMachineLearningAdjustment(alert, breakdown);
        totalScore = Math.max(0, Math.min(100, totalScore + mlAdjustment));
      }

      // Ensure score is within bounds
      totalScore = Math.max(0, Math.min(100, totalScore));

      // Create score object
      const score: BusinessImpactScore = {
        alertId: alert.id,
        score: totalScore,
        breakdown,
        factors: {
          severity: alert.severity,
          serviceImportance: businessContext?.tier || 'unknown',
          usersAffected: businessContext?.users?.affected,
          revenueAtRisk: this.calculateRevenueAtRisk(alert, businessContext),
          frequency: this.getAlertFrequency(alert),
          duration: alert.duration || 0,
          businessHours: this.isBusinessHours(),
          appliedRules: appliedRules.rules
        },
        calculatedAt: new Date(),
        version: '1.0'
      };

      // Cache the score
      this.scoreCache.set(cacheKey, score);

      // Update statistics
      this.updateStatistics(score);

      // Emit events
      this.emit('scoreCalculated', score);
      
      if (totalScore > 80) {
        this.emit('highImpactAlert', { alert, score });
      }

      return score;

    } catch (error) {
      this.emit('scoringError', { alert, error });
      throw error;
    } finally {
      this.stats.processingTimeMs = Date.now() - startTime;
    }
  }

  /**
   * Calculate severity score (0-100)
   */
  private calculateSeverityScore(severity: string): number {
    const severityScores = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    };
    return severityScores[severity as keyof typeof severityScores] || 0;
  }

  /**
   * Calculate service importance score (0-100)
   */
  private calculateServiceScore(businessContext?: BusinessContext): number {
    if (!businessContext) return 50; // Default neutral score

    const tierScores = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    };

    let score = tierScores[businessContext.tier];

    // Adjust based on SLA requirements
    if (businessContext.sla) {
      if (businessContext.sla.availability > 99.9) score += 10;
      if (businessContext.sla.responseTime < 100) score += 5;
      if (businessContext.sla.errorRate < 0.1) score += 5;
    }

    // Adjust for dependencies
    if (businessContext.dependencies && businessContext.dependencies.length > 5) {
      score += 10; // High dependency services are more critical
    }

    return Math.min(100, score);
  }

  /**
   * Calculate user impact score (0-100)
   */
  private calculateUserImpactScore(_alert: Alert, businessContext?: BusinessContext): number {
    if (!businessContext?.users) return 25; // Default low impact

    const { affected, total, vip = 0 } = businessContext.users;
    
    // Calculate percentage of users affected
    const percentageAffected = (affected / total) * 100;
    let score = Math.min(100, percentageAffected);

    // Boost score for VIP users
    if (vip > 0) {
      const vipImpact = (vip / affected) * 50;
      score += vipImpact;
    }

    // Business hours multiplier
    if (this.isBusinessHours()) {
      score *= 1.5;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate revenue impact score (0-100)
   */
  private calculateRevenueImpactScore(alert: Alert, businessContext?: BusinessContext): number {
    if (!businessContext?.revenue) return 10; // Default minimal revenue impact

    const revenueAtRisk = this.calculateRevenueAtRisk(alert, businessContext);
    if (revenueAtRisk === undefined) return 10;

    // Convert revenue impact to score (logarithmic scale)
    const method = this.config.revenueCalculation.method;
    let score: number;

    switch (method) {
      case 'linear':
        score = Math.min(100, (revenueAtRisk / 10000) * 100); // $10k = 100 points
        break;
      case 'exponential':
        score = Math.min(100, Math.pow(revenueAtRisk / 1000, 0.5) * 20);
        break;
      case 'logarithmic':
      default:
        score = Math.min(100, Math.log10(revenueAtRisk + 1) * 25);
        break;
    }

    return score;
  }

  /**
   * Calculate frequency score (0-100)
   */
  private calculateFrequencyScore(alert: Alert): number {
    const history = this.getAlertHistory(alert);
    if (!history) return 20; // Default for new alerts

    const hoursElapsed = (Date.now() - history.firstSeen.getTime()) / (1000 * 60 * 60);
    const frequency = history.count / Math.max(hoursElapsed, 1);

    // Convert frequency to score
    if (frequency > 10) return 100; // Very frequent
    if (frequency > 5) return 75;   // Frequent
    if (frequency > 2) return 50;   // Moderate
    if (frequency > 0.5) return 25; // Occasional
    return 10; // Rare
  }

  /**
   * Calculate duration score (0-100)
   */
  private calculateDurationScore(alert: Alert): number {
    if (!alert.duration) return 30; // Default for new alerts

    const durationHours = alert.duration / (1000 * 60 * 60);
    
    // Convert duration to score
    if (durationHours > 4) return 100; // Long outage
    if (durationHours > 2) return 75;  // Extended issue
    if (durationHours > 1) return 50;  // Moderate duration
    if (durationHours > 0.5) return 25; // Brief issue
    return 10; // Very short
  }

  /**
   * Apply scoring rules and adjustments
   */
  private async applyScoringRules(alert: Alert, baseScore: number): Promise<{ adjustedScore: number; rules: string[] }> {
    let adjustedScore = baseScore;
    const appliedRules: string[] = [];

    for (const rule of this.scoringRules.values()) {
      if (!rule.enabled) continue;
      
      if (this.ruleMatches(rule, alert)) {
        adjustedScore = adjustedScore * rule.scoreAdjustments.multiplier + rule.scoreAdjustments.additive;
        appliedRules.push(rule.id);

        // Apply overrides if specified
        if (rule.scoreAdjustments.overrides) {
          for (const [condition, override] of Object.entries(rule.scoreAdjustments.overrides)) {
            if (this.conditionMatches(condition, alert)) {
              adjustedScore = override;
              break;
            }
          }
        }
      }
    }

    return { adjustedScore: Math.max(0, Math.min(100, adjustedScore)), rules: appliedRules };
  }

  /**
   * Check if rule matches alert
   */
  private ruleMatches(rule: AlertScoringRule, alert: Alert): boolean {
    const conditions = rule.conditions;

    if (conditions.sources && !conditions.sources.includes(alert.source)) {
      return false;
    }

    if (conditions.severities && !conditions.severities.includes(alert.severity)) {
      return false;
    }

    if (conditions.tags && alert.tags) {
      const hasRequiredTag = conditions.tags.some(tag => alert.tags!.includes(tag));
      if (!hasRequiredTag) return false;
    }

    if (conditions.businessHours !== undefined) {
      const isBusinessHours = this.isBusinessHours();
      if (conditions.businessHours !== isBusinessHours) return false;
    }

    if (conditions.timeOfDay) {
      const currentTime = new Date().toTimeString().slice(0, 5);
      if (currentTime < conditions.timeOfDay.start || currentTime > conditions.timeOfDay.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if condition matches alert
   */
  private conditionMatches(condition: string, alert: Alert): boolean {
    // Simple condition matching - can be extended
    if (condition.includes('severity=')) {
      const expectedSeverity = condition.split('=')[1];
      return alert.severity === expectedSeverity;
    }
    return false;
  }

  /**
   * Get machine learning score adjustment
   */
  private async getMachineLearningAdjustment(alert: Alert, breakdown: any): Promise<number> {
    if (!this.mlModel) return 0;

    try {
      // Convert alert and breakdown to feature vector
      const features = [
        breakdown.severityScore,
        breakdown.serviceScore,
        breakdown.userImpactScore,
        breakdown.revenueImpactScore,
        breakdown.frequencyScore,
        breakdown.durationScore,
        this.isBusinessHours() ? 1 : 0,
        alert.tags?.length || 0
      ];

      // Get ML prediction
      const prediction = await this.mlModel.predict(features);
      
      // Return adjustment (-20 to +20)
      return Math.max(-20, Math.min(20, prediction));

    } catch (error) {
      console.warn('ML adjustment failed:', error);
      return 0;
    }
  }

  /**
   * Calculate revenue at risk
   */
  private calculateRevenueAtRisk(alert: Alert, businessContext?: BusinessContext): number | undefined {
    if (!businessContext?.revenue) return undefined;

    const durationHours = alert.duration ? alert.duration / (1000 * 60 * 60) : 1;
    const hourlyRevenue = businessContext.revenue.hourly;
    
    // Base calculation
    let revenueAtRisk = hourlyRevenue * durationHours;

    // Apply service-specific multipliers
    const multipliers = this.config.revenueCalculation.multipliers;
    const multiplier = multipliers[businessContext.serviceName] || multipliers['default'] || 1;
    
    revenueAtRisk *= multiplier;

    // Apply business hours multiplier
    if (this.isBusinessHours()) {
      revenueAtRisk *= 2; // Double impact during business hours
    }

    return revenueAtRisk;
  }

  /**
   * Update alert history
   */
  private updateAlertHistory(alert: Alert): void {
    const historyKey = this.generateHistoryKey(alert);
    const existing = this.alertHistory.get(historyKey);

    if (existing) {
      existing.count++;
      existing.lastSeen = alert.timestamp;
      
      if (alert.duration) {
        existing.averageDuration = ((existing.averageDuration * (existing.count - 1)) + alert.duration) / existing.count;
      }
    } else {
      this.alertHistory.set(historyKey, {
        alertId: alert.id,
        count: 1,
        firstSeen: alert.timestamp,
        lastSeen: alert.timestamp,
        averageDuration: alert.duration || 0,
        resolution: {
          automatic: 0,
          manual: 0,
          escalated: 0
        }
      });
    }
  }

  /**
   * Get alert history
   */
  private getAlertHistory(alert: Alert): AlertHistory | undefined {
    const historyKey = this.generateHistoryKey(alert);
    return this.alertHistory.get(historyKey);
  }

  /**
   * Get alert frequency (alerts per hour)
   */
  private getAlertFrequency(alert: Alert): number {
    const history = this.getAlertHistory(alert);
    if (!history) return 0;

    const hoursElapsed = (Date.now() - history.firstSeen.getTime()) / (1000 * 60 * 60);
    return history.count / Math.max(hoursElapsed, 1);
  }

  /**
   * Generate cache key for alert scoring
   */
  private generateCacheKey(alert: Alert): string {
    const keyData = {
      source: alert.source,
      severity: alert.severity,
      tags: alert.tags?.sort(),
      businessHours: this.isBusinessHours()
    };
    return `score_${JSON.stringify(keyData)}`;
  }

  /**
   * Generate history key for alert
   */
  private generateHistoryKey(alert: Alert): string {
    return `${alert.source}_${alert.severity}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(score: BusinessImpactScore): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return (Date.now() - score.calculatedAt.getTime()) < maxAge;
  }

  /**
   * Check if currently in business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5);

    return this.config.businessHours.days.includes(dayOfWeek) &&
           currentTime >= this.config.businessHours.start &&
           currentTime <= this.config.businessHours.end;
  }

  /**
   * Get business context for service
   */
  private getBusinessContext(serviceId: string): BusinessContext | undefined {
    return this.businessContexts.get(serviceId);
  }

  /**
   * Update statistics
   */
  private updateStatistics(score: BusinessImpactScore): void {
    this.stats.alertsScored++;
    
    // Update average score
    const currentAvg = this.stats.averageScore;
    const count = this.stats.alertsScored;
    this.stats.averageScore = ((currentAvg * (count - 1)) + score.score) / count;

    // Update score distribution
    const scoreRange = this.getScoreRange(score.score);
    this.stats.scoreDistribution[scoreRange]++;

    // Update impact categories
    if (score.score > 80) {
      this.stats.highImpactAlerts++;
    } else if (score.score >= 50) {
      this.stats.mediumImpactAlerts++;
    } else {
      this.stats.lowImpactAlerts++;
    }
  }

  /**
   * Get score range for distribution tracking
   */
  private getScoreRange(score: number): string {
    if (score <= 20) return '0-20';
    if (score <= 40) return '21-40';
    if (score <= 60) return '41-60';
    if (score <= 80) return '61-80';
    return '81-100';
  }

  /**
   * Initialize machine learning model
   */
  private async initializeMachineLearning(): Promise<void> {
    // Mock ML model - in production, this would load a real model
    this.mlModel = {
      predict: async (features: number[]) => {
        // Simple linear regression mock
        const weights = [0.1, 0.15, 0.2, 0.25, 0.1, 0.1, 0.05, 0.05];
        const prediction = features.reduce((sum, feature, index) => {
          return sum + (feature * weights[index]);
        }, 0);
        return Math.max(-20, Math.min(20, prediction - 50));
      },
      
      train: async (trainingData: any[]) => {
        console.log('Training ML model with', trainingData.length, 'samples');
        // Training implementation
      }
    };
  }

  /**
   * Register business context
   */
  public registerBusinessContext(context: BusinessContext): void {
    const validated = BusinessContextSchema.parse(context);
    this.businessContexts.set(validated.serviceId, validated);
    this.emit('contextRegistered', validated);
  }

  /**
   * Register scoring rule
   */
  public registerScoringRule(rule: AlertScoringRule): void {
    const validated = AlertScoringRuleSchema.parse(rule);
    this.scoringRules.set(validated.id, validated);
    this.emit('ruleRegistered', validated);
  }

  /**
   * Update scoring weights
   */
  public updateWeights(weights: Partial<ScoringWeights>): void {
    this.config.weights = { ...this.config.weights, ...weights };
    this.scoreCache.clear(); // Clear cache when weights change
    this.emit('weightsUpdated', this.config.weights);
  }

  /**
   * Train machine learning model with historical data
   */
  public async trainModel(trainingData: Array<{ alert: Alert; actualScore: number }>): Promise<void> {
    if (!this.mlModel || trainingData.length < this.config.learningThreshold) {
      return;
    }

    try {
      await this.mlModel.train(trainingData);
      this.stats.mlAccuracy = await this.validateModel(trainingData);
      this.emit('modelTrained', { samples: trainingData.length, accuracy: this.stats.mlAccuracy });
    } catch (error) {
      this.emit('trainingError', error);
    }
  }

  /**
   * Validate machine learning model accuracy
   */
  private async validateModel(testData: Array<{ alert: Alert; actualScore: number }>): Promise<number> {
    if (!this.mlModel) return 0;

    let totalError = 0;
    for (const { alert, actualScore } of testData) {
      const predictedScore = await this.calculateScore(alert);
      totalError += Math.abs(predictedScore.score - actualScore);
    }

    const averageError = totalError / testData.length;
    return Math.max(0, 100 - averageError); // Convert error to accuracy percentage
  }

  /**
   * Get scoring statistics
   */
  public getStats(): ScoringStats {
    return { ...this.stats };
  }

  /**
   * Get top scoring alerts
   */
  public getTopAlerts(limit: number = 10): BusinessImpactScore[] {
    return Array.from(this.scoreCache.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get business contexts
   */
  public getBusinessContexts(): BusinessContext[] {
    return Array.from(this.businessContexts.values());
  }

  /**
   * Get scoring rules
   */
  public getScoringRules(): AlertScoringRule[] {
    return Array.from(this.scoringRules.values());
  }

  /**
   * Clear score cache
   */
  public clearCache(): void {
    this.scoreCache.clear();
    this.emit('cacheCleared');
  }
}

export default BusinessImpactScorer;