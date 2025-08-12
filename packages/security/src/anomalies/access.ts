import { EventEmitter } from 'events';
import {
  AccessPattern,
  TimePattern,
  ResourceAccess,
  AccessFrequency,
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity,
  GeoLocation,
  AnomalyDetectionConfig,
  MLModelConfig,
  AnomalyDetectedHandler
} from '../types';
import {
  CryptoUtils,
  StatsUtils,
  TimeUtils,
  GeoUtils,
  IPUtils
} from '../utils';

/**
 * Access anomaly detection system with 99% accuracy requirement
 * Uses machine learning and statistical analysis to detect unusual access patterns
 */
export class AccessAnomalyDetector extends EventEmitter {
  private config: AnomalyDetectionConfig;
  private userPatterns: Map<string, AccessPattern> = new Map();
  private globalPatterns: GlobalAccessPattern;
  private mlModel: MLAnomalyModel;
  private isRunning = false;
  private analysisInterval?: NodeJS.Timeout;
  private trainingData: AccessEvent[] = [];
  private anomalies: DetectedAnomaly[] = [];
  private metrics: AnomalyMetrics;

  constructor(config: AnomalyDetectionConfig) {
    super();
    this.config = config;
    this.mlModel = new MLAnomalyModel(config.mlModel);
    this.globalPatterns = new GlobalAccessPattern();
    this.metrics = {
      totalAnalyzed: 0,
      anomaliesDetected: 0,
      falsePositives: 0,
      truePositives: 0,
      accuracy: 0,
      lastTraining: new Date(),
      modelVersion: '1.0.0'
    };
  }

  /**
   * Start anomaly detection
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Load existing patterns
    await this.loadPatterns();
    
    // Initialize ML model
    await this.mlModel.initialize();
    
    // Start continuous analysis
    this.startContinuousAnalysis();
    
    // Schedule model retraining
    this.scheduleRetraining();

    this.emit('anomaly:started');
  }

  /**
   * Stop anomaly detection
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    // Save current patterns
    await this.savePatterns();

    this.emit('anomaly:stopped');
  }

  /**
   * Analyze access event for anomalies
   */
  async analyzeAccess(event: AccessEvent): Promise<AnomalyAnalysisResult> {
    this.metrics.totalAnalyzed++;
    
    const analysisStart = Date.now();
    const result: AnomalyAnalysisResult = {
      isAnomaly: false,
      confidence: 0,
      anomalyTypes: [],
      score: 0,
      patterns: [],
      recommendations: []
    };

    try {
      // Get or create user pattern
      const userPattern = await this.getUserPattern(event.userId);
      
      // Statistical analysis
      const statResult = await this.performStatisticalAnalysis(event, userPattern);
      
      // Behavioral analysis
      const behaviorResult = await this.performBehavioralAnalysis(event, userPattern);
      
      // Temporal analysis
      const temporalResult = await this.performTemporalAnalysis(event, userPattern);
      
      // Geolocation analysis
      const geoResult = await this.performGeoAnalysis(event, userPattern);
      
      // ML model analysis
      const mlResult = await this.mlModel.analyze(event, userPattern);

      // Combine results
      const analyses = [statResult, behaviorResult, temporalResult, geoResult, mlResult];
      result.score = this.combineScores(analyses);
      result.confidence = this.calculateConfidence(analyses);
      result.anomalyTypes = analyses.flatMap(a => a.anomalyTypes);
      result.patterns = analyses.flatMap(a => a.patterns);

      // Determine if anomaly based on threshold
      result.isAnomaly = result.score >= this.config.sensitivity;

      // Generate recommendations if anomaly detected
      if (result.isAnomaly) {
        result.recommendations = this.generateRecommendations(result, event);
        await this.handleAnomaly(event, result);
      }

      // Update patterns
      await this.updatePatterns(event, userPattern);

      // Record training data
      this.recordTrainingData(event, result);

      const analysisTime = Date.now() - analysisStart;
      if (analysisTime > 1000) { // Should be near real-time
        console.warn(`Anomaly analysis took ${analysisTime}ms`);
      }

    } catch (error) {
      console.error('Error during anomaly analysis:', error);
      result.isAnomaly = false;
      result.confidence = 0;
    }

    return result;
  }

  /**
   * Get current accuracy metrics
   */
  getMetrics(): AnomalyMetrics {
    if (this.metrics.totalAnalyzed > 0) {
      const totalCorrect = this.metrics.truePositives + 
        (this.metrics.totalAnalyzed - this.metrics.anomaliesDetected - this.metrics.falsePositives);
      this.metrics.accuracy = (totalCorrect / this.metrics.totalAnalyzed) * 100;
    }
    
    return { ...this.metrics };
  }

  /**
   * Train model with labeled data
   */
  async trainModel(labeledData: LabeledAccessEvent[]): Promise<void> {
    await this.mlModel.train(labeledData);
    this.metrics.lastTraining = new Date();
    this.metrics.modelVersion = this.generateModelVersion();
    
    this.emit('anomaly:model_trained', {
      dataSize: labeledData.length,
      timestamp: this.metrics.lastTraining,
      version: this.metrics.modelVersion
    });
  }

  /**
   * Provide feedback on anomaly detection
   */
  async provideFeedback(eventId: string, isActualAnomaly: boolean): Promise<void> {
    const anomaly = this.anomalies.find(a => a.eventId === eventId);
    if (!anomaly) return;

    if (isActualAnomaly) {
      this.metrics.truePositives++;
    } else {
      this.metrics.falsePositives++;
    }

    // Update ML model with feedback
    await this.mlModel.updateWithFeedback(eventId, isActualAnomaly);
    
    this.emit('anomaly:feedback', { eventId, isActualAnomaly });
  }

  /**
   * Get user access pattern
   */
  private async getUserPattern(userId: string): Promise<AccessPattern> {
    let pattern = this.userPatterns.get(userId);
    
    if (!pattern) {
      pattern = {
        userId,
        ipAddresses: [],
        userAgents: [],
        locations: [],
        timePattern: {
          typicalHours: [],
          typicalDays: [],
          timezone: 'UTC',
          frequency: AccessFrequency.NORMAL
        },
        resourceAccess: [],
        score: 0
      };
      
      this.userPatterns.set(userId, pattern);
    }
    
    return pattern;
  }

  /**
   * Perform statistical analysis
   */
  private async performStatisticalAnalysis(
    event: AccessEvent,
    userPattern: AccessPattern
  ): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      score: 0,
      confidence: 0.8,
      anomalyTypes: [],
      patterns: []
    };

    // Analyze request frequency
    const recentAccess = this.getRecentAccess(event.userId, 3600000); // 1 hour
    const avgFrequency = this.calculateAverageFrequency(event.userId);
    const currentFrequency = recentAccess.length;

    if (avgFrequency > 0) {
      const zScore = StatsUtils.calculateZScore(currentFrequency, avgFrequency, 
        StatsUtils.standardDeviation([avgFrequency, currentFrequency]));
      
      if (Math.abs(zScore) > 2.5) { // High deviation
        result.score += 0.3;
        result.anomalyTypes.push('frequency_anomaly');
        result.patterns.push(`Unusual access frequency: ${currentFrequency} vs avg ${avgFrequency.toFixed(1)}`);
      }
    }

    // Analyze resource access patterns
    const resourceScore = this.analyzeResourceAccess(event, userPattern);
    result.score += resourceScore * 0.2;

    if (resourceScore > 0.7) {
      result.anomalyTypes.push('resource_anomaly');
      result.patterns.push('Accessing unusual resources');
    }

    return result;
  }

  /**
   * Perform behavioral analysis
   */
  private async performBehavioralAnalysis(
    event: AccessEvent,
    userPattern: AccessPattern
  ): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      score: 0,
      confidence: 0.9,
      anomalyTypes: [],
      patterns: []
    };

    // Analyze IP address patterns
    const isKnownIP = userPattern.ipAddresses.includes(event.ipAddress);
    if (!isKnownIP && userPattern.ipAddresses.length > 0) {
      result.score += 0.4;
      result.anomalyTypes.push('new_ip_address');
      result.patterns.push(`New IP address: ${event.ipAddress}`);
    }

    // Analyze user agent patterns
    const isKnownUA = userPattern.userAgents.some(ua => 
      this.calculateStringSimilarity(ua, event.userAgent) > 0.8
    );
    
    if (!isKnownUA && userPattern.userAgents.length > 0) {
      result.score += 0.3;
      result.anomalyTypes.push('new_user_agent');
      result.patterns.push('New user agent detected');
    }

    // Analyze access method patterns
    const methodScore = this.analyzeAccessMethod(event, userPattern);
    result.score += methodScore * 0.3;

    if (methodScore > 0.7) {
      result.anomalyTypes.push('method_anomaly');
      result.patterns.push('Unusual access method');
    }

    return result;
  }

  /**
   * Perform temporal analysis
   */
  private async performTemporalAnalysis(
    event: AccessEvent,
    userPattern: AccessPattern
  ): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      score: 0,
      confidence: 0.85,
      anomalyTypes: [],
      patterns: []
    };

    const eventHour = event.timestamp.getHours();
    const eventDay = event.timestamp.getDay();
    
    // Check if time is typical for user
    const isTypicalHour = userPattern.timePattern.typicalHours.includes(eventHour);
    const isTypicalDay = userPattern.timePattern.typicalDays.includes(eventDay);
    
    if (!isTypicalHour && userPattern.timePattern.typicalHours.length > 0) {
      result.score += 0.3;
      result.anomalyTypes.push('unusual_time');
      result.patterns.push(`Access at unusual hour: ${eventHour}:00`);
    }
    
    if (!isTypicalDay && userPattern.timePattern.typicalDays.length > 0) {
      result.score += 0.2;
      result.anomalyTypes.push('unusual_day');
      result.patterns.push(`Access on unusual day: ${this.getDayName(eventDay)}`);
    }

    // Check for off-hours access
    if (!TimeUtils.isBusinessHours(event.timestamp)) {
      result.score += 0.2;
      result.anomalyTypes.push('off_hours_access');
      result.patterns.push('Access during off-hours');
    }

    // Check for weekend access
    if (TimeUtils.isWeekend(event.timestamp)) {
      result.score += 0.15;
      result.anomalyTypes.push('weekend_access');
      result.patterns.push('Access during weekend');
    }

    return result;
  }

  /**
   * Perform geolocation analysis
   */
  private async performGeoAnalysis(
    event: AccessEvent,
    userPattern: AccessPattern
  ): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      score: 0,
      confidence: 0.7,
      anomalyTypes: [],
      patterns: []
    };

    if (!event.location) return result;

    // Check for new locations
    const isKnownLocation = userPattern.locations.some(loc => 
      this.calculateLocationSimilarity(loc, event.location!) > 0.8
    );

    if (!isKnownLocation && userPattern.locations.length > 0) {
      result.score += 0.4;
      result.anomalyTypes.push('new_location');
      result.patterns.push(`New location: ${event.location.city}, ${event.location.country}`);
    }

    // Check for impossible travel
    const lastLocation = this.getLastLocation(event.userId);
    if (lastLocation && lastLocation.location) {
      const timeDiff = event.timestamp.getTime() - lastLocation.timestamp.getTime();
      const travelCheck = GeoUtils.isSuspiciousLocationChange(
        lastLocation.location,
        event.location,
        timeDiff
      );

      if (travelCheck.isSuspicious) {
        result.score += 0.8;
        result.anomalyTypes.push('impossible_travel');
        result.patterns.push(`Impossible travel: ${travelCheck.reason}`);
      }
    }

    return result;
  }

  /**
   * Combine analysis scores
   */
  private combineScores(analyses: AnalysisResult[]): number {
    const weights = [0.25, 0.30, 0.20, 0.15, 0.10]; // Statistical, Behavioral, Temporal, Geo, ML
    let weightedScore = 0;
    let totalWeight = 0;

    analyses.forEach((analysis, index) => {
      if (index < weights.length) {
        weightedScore += analysis.score * weights[index] * analysis.confidence;
        totalWeight += weights[index] * analysis.confidence;
      }
    });

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(analyses: AnalysisResult[]): number {
    const confidences = analyses.map(a => a.confidence);
    return StatsUtils.mean(confidences);
  }

  /**
   * Handle detected anomaly
   */
  private async handleAnomaly(event: AccessEvent, result: AnomalyAnalysisResult): Promise<void> {
    const anomaly: DetectedAnomaly = {
      id: CryptoUtils.generateSecureId(),
      eventId: event.id,
      userId: event.userId,
      timestamp: event.timestamp,
      score: result.score,
      confidence: result.confidence,
      types: result.anomalyTypes,
      patterns: result.patterns,
      status: 'open',
      severity: this.calculateSeverity(result.score)
    };

    this.anomalies.push(anomaly);
    this.metrics.anomaliesDetected++;

    // Create security event
    const securityEvent: SecurityEvent = {
      id: CryptoUtils.generateSecureId(),
      timestamp: new Date(),
      type: SecurityEventType.ACCESS_ANOMALY,
      severity: anomaly.severity,
      source: 'access_anomaly_detector',
      details: {
        anomalyId: anomaly.id,
        score: result.score,
        confidence: result.confidence,
        types: result.anomalyTypes,
        patterns: result.patterns,
        recommendations: result.recommendations
      },
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      location: event.location
    };

    this.emit('anomaly', anomaly);
    this.emit('security_event', securityEvent);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    result: AnomalyAnalysisResult,
    event: AccessEvent
  ): string[] {
    const recommendations: string[] = [];

    if (result.anomalyTypes.includes('new_ip_address')) {
      recommendations.push('Verify user identity and add IP to whitelist if legitimate');
    }

    if (result.anomalyTypes.includes('impossible_travel')) {
      recommendations.push('Immediately verify user identity - potential account compromise');
    }

    if (result.anomalyTypes.includes('unusual_time') || result.anomalyTypes.includes('off_hours_access')) {
      recommendations.push('Confirm legitimate business need for off-hours access');
    }

    if (result.anomalyTypes.includes('resource_anomaly')) {
      recommendations.push('Review access permissions and principle of least privilege');
    }

    if (result.score > 0.8) {
      recommendations.push('Consider temporarily suspending account pending investigation');
    }

    return recommendations;
  }

  /**
   * Update user patterns
   */
  private async updatePatterns(event: AccessEvent, pattern: AccessPattern): Promise<void> {
    // Update IP addresses (keep last 10)
    if (!pattern.ipAddresses.includes(event.ipAddress)) {
      pattern.ipAddresses.push(event.ipAddress);
      if (pattern.ipAddresses.length > 10) {
        pattern.ipAddresses.shift();
      }
    }

    // Update user agents (keep last 5)
    const similarUA = pattern.userAgents.find(ua => 
      this.calculateStringSimilarity(ua, event.userAgent) > 0.9
    );
    
    if (!similarUA) {
      pattern.userAgents.push(event.userAgent);
      if (pattern.userAgents.length > 5) {
        pattern.userAgents.shift();
      }
    }

    // Update locations
    if (event.location) {
      const similarLocation = pattern.locations.find(loc =>
        this.calculateLocationSimilarity(loc, event.location!) > 0.9
      );
      
      if (!similarLocation) {
        pattern.locations.push(event.location);
        if (pattern.locations.length > 10) {
          pattern.locations.shift();
        }
      }
    }

    // Update time patterns
    const hour = event.timestamp.getHours();
    const day = event.timestamp.getDay();
    
    if (!pattern.timePattern.typicalHours.includes(hour)) {
      pattern.timePattern.typicalHours.push(hour);
    }
    
    if (!pattern.timePattern.typicalDays.includes(day)) {
      pattern.timePattern.typicalDays.push(day);
    }

    // Update resource access
    this.updateResourceAccess(pattern, event);
  }

  /**
   * Start continuous analysis
   */
  private startContinuousAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.performMaintenanceTasks();
    }, 300000); // Every 5 minutes
  }

  /**
   * Schedule model retraining
   */
  private scheduleRetraining(): void {
    const retrainingInterval = this.parseRetrainingInterval();
    
    setInterval(async () => {
      if (this.trainingData.length >= 100) { // Minimum training data
        await this.retrainModel();
      }
    }, retrainingInterval);
  }

  /**
   * Perform maintenance tasks
   */
  private performMaintenanceTasks(): void {
    // Clean old anomalies
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    this.anomalies = this.anomalies.filter(a => a.timestamp > cutoff);

    // Clean old training data
    this.trainingData = this.trainingData.filter(t => t.timestamp > cutoff);

    // Update global patterns
    this.globalPatterns.update(Array.from(this.userPatterns.values()));
  }

  // Helper methods
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateLocationSimilarity(loc1: GeoLocation, loc2: GeoLocation): number {
    if (loc1.country !== loc2.country) return 0;
    if (loc1.region !== loc2.region) return 0.5;
    if (loc1.city !== loc2.city) return 0.7;
    return 1.0;
  }

  private calculateSeverity(score: number): SecuritySeverity {
    if (score >= 0.8) return SecuritySeverity.CRITICAL;
    if (score >= 0.6) return SecuritySeverity.HIGH;
    if (score >= 0.4) return SecuritySeverity.MEDIUM;
    return SecuritySeverity.LOW;
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }

  private parseRetrainingInterval(): number {
    const interval = this.config.mlModel.retraining;
    if (interval.endsWith('h')) return parseInt(interval) * 60 * 60 * 1000;
    if (interval.endsWith('d')) return parseInt(interval) * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000; // Default 24 hours
  }

  private generateModelVersion(): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${timestamp}.${Math.floor(Math.random() * 1000)}`;
  }

  // Placeholder methods that would be implemented with actual data storage
  private async loadPatterns(): Promise<void> { /* Load from storage */ }
  private async savePatterns(): Promise<void> { /* Save to storage */ }
  private getRecentAccess(userId: string, windowMs: number): AccessEvent[] { return []; }
  private calculateAverageFrequency(userId: string): number { return 0; }
  private analyzeResourceAccess(event: AccessEvent, pattern: AccessPattern): number { return 0; }
  private analyzeAccessMethod(event: AccessEvent, pattern: AccessPattern): number { return 0; }
  private getLastLocation(userId: string): { timestamp: Date; location: GeoLocation } | null { return null; }
  private updateResourceAccess(pattern: AccessPattern, event: AccessEvent): void { /* Update resource access patterns */ }
  private recordTrainingData(event: AccessEvent, result: AnomalyAnalysisResult): void { /* Record for ML training */ }
  private async retrainModel(): Promise<void> { /* Retrain ML model */ }
}

/**
 * Machine Learning model for anomaly detection
 */
class MLAnomalyModel {
  private config: MLModelConfig;
  private isInitialized = false;

  constructor(config: MLModelConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize ML model based on algorithm
    console.log(`Initializing ML model: ${this.config.algorithm}`);
    this.isInitialized = true;
  }

  async analyze(event: AccessEvent, pattern: AccessPattern): Promise<AnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('ML model not initialized');
    }

    // Simplified ML analysis - in production this would use actual ML algorithms
    const features = this.extractFeatures(event, pattern);
    const score = this.calculateAnomalyScore(features);

    return {
      score: Math.min(score, 1.0),
      confidence: 0.9,
      anomalyTypes: score > 0.5 ? ['ml_anomaly'] : [],
      patterns: score > 0.5 ? ['ML model detected anomalous pattern'] : []
    };
  }

  async train(data: LabeledAccessEvent[]): Promise<void> {
    console.log(`Training ML model with ${data.length} samples`);
    // In production, implement actual ML training
  }

  async updateWithFeedback(eventId: string, isActualAnomaly: boolean): Promise<void> {
    console.log(`Updating ML model with feedback for event ${eventId}: ${isActualAnomaly}`);
    // In production, implement online learning
  }

  private extractFeatures(event: AccessEvent, pattern: AccessPattern): number[] {
    // Extract numerical features for ML model
    return [
      event.timestamp.getHours() / 24,
      event.timestamp.getDay() / 7,
      pattern.ipAddresses.length / 10,
      pattern.userAgents.length / 5,
      pattern.locations.length / 10
    ];
  }

  private calculateAnomalyScore(features: number[]): number {
    // Simplified anomaly calculation - in production use actual ML
    const mean = StatsUtils.mean(features);
    const std = StatsUtils.standardDeviation(features);
    return Math.abs(mean - 0.5) + std;
  }
}

/**
 * Global access patterns for baseline comparison
 */
class GlobalAccessPattern {
  private patterns: AccessPattern[] = [];

  update(userPatterns: AccessPattern[]): void {
    this.patterns = [...userPatterns];
  }

  getTypicalPattern(): AccessPattern | null {
    if (this.patterns.length === 0) return null;

    // Calculate typical patterns across all users
    return {
      userId: 'global',
      ipAddresses: [],
      userAgents: [],
      locations: [],
      timePattern: {
        typicalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // Business hours
        typicalDays: [1, 2, 3, 4, 5], // Weekdays
        timezone: 'UTC',
        frequency: AccessFrequency.NORMAL
      },
      resourceAccess: [],
      score: 0
    };
  }
}

// Supporting interfaces
interface AccessEvent {
  id: string;
  userId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  resource: string;
  method: string;
  outcome: 'success' | 'failure';
  location?: GeoLocation;
  sessionId?: string;
}

interface LabeledAccessEvent extends AccessEvent {
  isAnomaly: boolean;
  anomalyType?: string;
}

interface AnomalyAnalysisResult {
  isAnomaly: boolean;
  confidence: number;
  anomalyTypes: string[];
  score: number;
  patterns: string[];
  recommendations: string[];
}

interface AnalysisResult {
  score: number;
  confidence: number;
  anomalyTypes: string[];
  patterns: string[];
}

interface DetectedAnomaly {
  id: string;
  eventId: string;
  userId: string;
  timestamp: Date;
  score: number;
  confidence: number;
  types: string[];
  patterns: string[];
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  severity: SecuritySeverity;
}

interface AnomalyMetrics {
  totalAnalyzed: number;
  anomaliesDetected: number;
  falsePositives: number;
  truePositives: number;
  accuracy: number;
  lastTraining: Date;
  modelVersion: string;
}