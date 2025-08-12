import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import * as _ from 'lodash';
import { addMinutes, isAfter, isBefore } from 'date-fns';

// Types for deduplication
export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  message: string;
  fingerprint?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  suppressed?: boolean;
  groupKey?: string;
  count?: number;
}

export interface DeduplicationConfig {
  /** Time window for grouping alerts (in minutes) */
  timeWindow: number;
  /** Maximum alerts per group before throttling */
  maxAlertsPerGroup: number;
  /** Similarity threshold for alert grouping (0-1) */
  similarityThreshold: number;
  /** Fields to include in fingerprint generation */
  fingerprintFields: string[];
  /** Custom fingerprint function */
  customFingerprintFn?: (alert: Alert) => string;
  /** Enable machine learning clustering */
  enableMLClustering: boolean;
  /** Clustering algorithm to use */
  clusteringAlgorithm: 'kmeans' | 'dbscan' | 'agglomerative';
}

export interface AlertGroup {
  id: string;
  fingerprint: string;
  alerts: Alert[];
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  representative: Alert;
  suppressed: boolean;
  suppressedUntil?: Date;
}

export interface DeduplicationStats {
  totalAlerts: number;
  uniqueAlerts: number;
  deduplicationRate: number;
  groupsCreated: number;
  alertsSuppressed: number;
  processingTimeMs: number;
}

/**
 * Alert Deduplication Engine
 * 
 * Features:
 * - Smart grouping of similar alerts
 * - Configurable similarity thresholds
 * - Machine learning-based clustering
 * - Real-time deduplication
 * - Alert fingerprinting
 * - Time-based grouping windows
 */
export class AlertDeduplication extends EventEmitter {
  private groups: Map<string, AlertGroup> = new Map();
  private config: DeduplicationConfig;
  private stats: DeduplicationStats = {
    totalAlerts: 0,
    uniqueAlerts: 0,
    deduplicationRate: 0,
    groupsCreated: 0,
    alertsSuppressed: 0,
    processingTimeMs: 0
  };
  private mlModel?: any; // Machine learning model for clustering

  constructor(config: DeduplicationConfig) {
    super();
    this.config = config;
    this.startCleanupTimer();
    
    if (config.enableMLClustering) {
      this.initializeMLModel();
    }
  }

  /**
   * Process incoming alert and return deduplicated result
   */
  public async processAlert(alert: Alert): Promise<{
    alert: Alert;
    isNew: boolean;
    groupId: string;
    suppressed: boolean;
    similarAlerts: Alert[];
  }> {
    const startTime = Date.now();
    
    try {
      this.stats.totalAlerts++;
      
      // Generate fingerprint for the alert
      const fingerprint = this.generateFingerprint(alert);
      alert.fingerprint = fingerprint;

      // Find or create alert group
      const groupResult = await this.findOrCreateGroup(alert, fingerprint);
      const { group, isNew } = groupResult;

      // Update statistics
      if (isNew) {
        this.stats.uniqueAlerts++;
        this.stats.groupsCreated++;
      }

      // Check if alert should be suppressed
      const suppressed = this.shouldSuppressAlert(group);
      
      if (suppressed) {
        this.stats.alertsSuppressed++;
      }

      // Get similar alerts from the group
      const similarAlerts = group.alerts.slice(0, 10); // Return top 10 similar alerts

      // Calculate deduplication rate
      this.stats.deduplicationRate = ((this.stats.totalAlerts - this.stats.uniqueAlerts) / this.stats.totalAlerts) * 100;
      this.stats.processingTimeMs = Date.now() - startTime;

      // Emit events
      if (isNew) {
        this.emit('newGroup', group);
      } else {
        this.emit('groupUpdated', group);
      }

      if (suppressed) {
        this.emit('alertSuppressed', { alert, group });
      } else {
        this.emit('alertProcessed', { alert, group, isNew });
      }

      return {
        alert,
        isNew,
        groupId: group.id,
        suppressed,
        similarAlerts
      };

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Generate fingerprint for alert grouping
   */
  private generateFingerprint(alert: Alert): string {
    if (this.config.customFingerprintFn) {
      return this.config.customFingerprintFn(alert);
    }

    // Use configured fields or defaults
    const fields = this.config.fingerprintFields.length > 0 
      ? this.config.fingerprintFields 
      : ['source', 'severity', 'message'];

    const fingerprintData: Record<string, any> = {};
    
    fields.forEach(field => {
      if (alert.hasOwnProperty(field)) {
        fingerprintData[field] = (alert as any)[field];
      }
    });

    // Normalize message for better grouping
    if (fingerprintData.message) {
      fingerprintData.message = this.normalizeMessage(fingerprintData.message);
    }

    const fingerprintString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
    return createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Normalize message for better grouping
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, 'IP') // Replace IP addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'EMAIL') // Replace emails
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find existing group or create new one
   */
  private async findOrCreateGroup(alert: Alert, fingerprint: string): Promise<{
    group: AlertGroup;
    isNew: boolean;
  }> {
    // First, try exact fingerprint match
    let group = this.groups.get(fingerprint);
    
    if (group && this.isWithinTimeWindow(group, alert.timestamp)) {
      // Add alert to existing group
      group.alerts.push(alert);
      group.lastSeen = alert.timestamp;
      group.count++;
      
      // Update group severity to highest
      if (this.getSeverityLevel(alert.severity) > this.getSeverityLevel(group.severity)) {
        group.severity = alert.severity;
        group.representative = alert;
      }
      
      return { group, isNew: false };
    }

    // If no exact match, try fuzzy matching with ML clustering
    if (this.config.enableMLClustering && this.mlModel) {
      const similarGroup = await this.findSimilarGroupML(alert);
      if (similarGroup) {
        similarGroup.alerts.push(alert);
        similarGroup.lastSeen = alert.timestamp;
        similarGroup.count++;
        return { group: similarGroup, isNew: false };
      }
    }

    // If no similar group found, try rule-based similarity
    const similarGroup = this.findSimilarGroupRuleBased(alert);
    if (similarGroup) {
      similarGroup.alerts.push(alert);
      similarGroup.lastSeen = alert.timestamp;
      similarGroup.count++;
      return { group: similarGroup, isNew: false };
    }

    // Create new group
    const newGroup: AlertGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fingerprint,
      alerts: [alert],
      firstSeen: alert.timestamp,
      lastSeen: alert.timestamp,
      count: 1,
      severity: alert.severity,
      representative: alert,
      suppressed: false
    };

    this.groups.set(fingerprint, newGroup);
    return { group: newGroup, isNew: true };
  }

  /**
   * Check if alert is within time window of group
   */
  private isWithinTimeWindow(group: AlertGroup, timestamp: Date): boolean {
    const windowEnd = addMinutes(group.firstSeen, this.config.timeWindow);
    return isBefore(timestamp, windowEnd) || isAfter(timestamp, group.firstSeen);
  }

  /**
   * Find similar group using machine learning
   */
  private async findSimilarGroupML(alert: Alert): Promise<AlertGroup | null> {
    if (!this.mlModel) return null;

    try {
      // Convert alert to feature vector
      const features = this.extractFeatures(alert);
      
      // Use ML model to find cluster
      const clusterId = await this.mlModel.predict(features);
      
      // Find group with same cluster ID
      for (const group of this.groups.values()) {
        if (group.representative && this.extractClusterId(group.representative) === clusterId) {
          const similarity = this.calculateSimilarity(alert, group.representative);
          if (similarity >= this.config.similarityThreshold) {
            return group;
          }
        }
      }
    } catch (error) {
      console.warn('ML clustering failed:', error);
    }

    return null;
  }

  /**
   * Find similar group using rule-based approach
   */
  private findSimilarGroupRuleBased(alert: Alert): AlertGroup | null {
    let bestMatch: { group: AlertGroup; similarity: number } | null = null;

    for (const group of this.groups.values()) {
      if (!this.isWithinTimeWindow(group, alert.timestamp)) continue;

      const similarity = this.calculateSimilarity(alert, group.representative);
      
      if (similarity >= this.config.similarityThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { group, similarity };
        }
      }
    }

    return bestMatch?.group || null;
  }

  /**
   * Calculate similarity between two alerts
   */
  private calculateSimilarity(alert1: Alert, alert2: Alert): number {
    let totalWeight = 0;
    let weightedSimilarity = 0;

    // Source similarity (weight: 0.3)
    const sourceWeight = 0.3;
    const sourceSimilarity = alert1.source === alert2.source ? 1 : 0;
    weightedSimilarity += sourceSimilarity * sourceWeight;
    totalWeight += sourceWeight;

    // Severity similarity (weight: 0.2)
    const severityWeight = 0.2;
    const severitySimilarity = alert1.severity === alert2.severity ? 1 : 
      Math.max(0, 1 - Math.abs(this.getSeverityLevel(alert1.severity) - this.getSeverityLevel(alert2.severity)) / 3);
    weightedSimilarity += severitySimilarity * severityWeight;
    totalWeight += severityWeight;

    // Message similarity (weight: 0.4)
    const messageWeight = 0.4;
    const messageSimilarity = this.calculateStringSimilarity(
      this.normalizeMessage(alert1.message),
      this.normalizeMessage(alert2.message)
    );
    weightedSimilarity += messageSimilarity * messageWeight;
    totalWeight += messageWeight;

    // Tags similarity (weight: 0.1)
    if (alert1.tags && alert2.tags) {
      const tagsWeight = 0.1;
      const tagsSimilarity = this.calculateArraySimilarity(alert1.tags, alert2.tags);
      weightedSimilarity += tagsSimilarity * tagsWeight;
      totalWeight += tagsWeight;
    }

    return totalWeight > 0 ? weightedSimilarity / totalWeight : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate array similarity (Jaccard similarity)
   */
  private calculateArraySimilarity(arr1: string[], arr2: string[]): number {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 1 : intersection.size / union.size;
  }

  /**
   * Get severity level as number for comparison
   */
  private getSeverityLevel(severity: string): number {
    const levels = { 'critical': 3, 'high': 2, 'medium': 1, 'low': 0 };
    return levels[severity as keyof typeof levels] || 0;
  }

  /**
   * Check if alert should be suppressed
   */
  private shouldSuppressAlert(group: AlertGroup): boolean {
    // Don't suppress critical alerts
    if (group.severity === 'critical') return false;
    
    // Don't suppress first alert in group
    if (group.count <= 1) return false;
    
    // Check if group has reached max alerts threshold
    if (group.count > this.config.maxAlertsPerGroup) return true;
    
    // Check if group is already suppressed
    if (group.suppressed && group.suppressedUntil && isAfter(new Date(), group.suppressedUntil)) {
      group.suppressed = false;
      group.suppressedUntil = undefined;
    }
    
    return group.suppressed;
  }

  /**
   * Extract features for ML clustering
   */
  private extractFeatures(alert: Alert): number[] {
    // Extract numerical features for ML model
    const features = [
      this.getSeverityLevel(alert.severity),
      alert.message.length,
      alert.source.length,
      alert.tags?.length || 0,
      // Add more features as needed
    ];
    
    return features;
  }

  /**
   * Extract cluster ID from alert
   */
  private extractClusterId(alert: Alert): string {
    return alert.metadata?.clusterId || 'unknown';
  }

  /**
   * Initialize machine learning model
   */
  private async initializeMLModel(): Promise<void> {
    // This would typically load a pre-trained model
    // For now, we'll use a simple mock implementation
    this.mlModel = {
      predict: async (features: number[]) => {
        // Simple clustering based on feature hash
        const hash = features.reduce((acc, f) => acc + f * 31, 0);
        return `cluster_${Math.abs(hash) % 10}`;
      }
    };
  }

  /**
   * Start cleanup timer to remove old groups
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldGroups();
    }, 60000); // Run every minute
  }

  /**
   * Clean up old alert groups
   */
  private cleanupOldGroups(): void {
    const cutoff = addMinutes(new Date(), -this.config.timeWindow * 2);
    
    for (const [fingerprint, group] of this.groups.entries()) {
      if (isBefore(group.lastSeen, cutoff)) {
        this.groups.delete(fingerprint);
        this.emit('groupExpired', group);
      }
    }
  }

  /**
   * Get current statistics
   */
  public getStats(): DeduplicationStats {
    return { ...this.stats };
  }

  /**
   * Get all active groups
   */
  public getGroups(): AlertGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get group by ID
   */
  public getGroup(id: string): AlertGroup | undefined {
    return Array.from(this.groups.values()).find(g => g.id === id);
  }

  /**
   * Suppress group for specified duration
   */
  public suppressGroup(groupId: string, durationMinutes: number): boolean {
    const group = this.getGroup(groupId);
    if (!group) return false;

    group.suppressed = true;
    group.suppressedUntil = addMinutes(new Date(), durationMinutes);
    
    this.emit('groupSuppressed', { group, durationMinutes });
    return true;
  }

  /**
   * Unsuppress group
   */
  public unsuppressGroup(groupId: string): boolean {
    const group = this.getGroup(groupId);
    if (!group) return false;

    group.suppressed = false;
    group.suppressedUntil = undefined;
    
    this.emit('groupUnsuppressed', group);
    return true;
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalAlerts: 0,
      uniqueAlerts: 0,
      deduplicationRate: 0,
      groupsCreated: 0,
      alertsSuppressed: 0,
      processingTimeMs: 0
    };
  }

  /**
   * Export configuration
   */
  public getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enableMLClustering && !this.mlModel) {
      this.initializeMLModel();
    }
    
    this.emit('configUpdated', this.config);
  }
}

export default AlertDeduplication;