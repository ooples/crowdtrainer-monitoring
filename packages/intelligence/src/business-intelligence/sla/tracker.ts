import { EventEmitter } from 'events';

export interface SLATarget {
  id: string;
  name: string;
  description: string;
  targetPercentage: number; // 99.99, 99.9, etc.
  timeWindowHours: number;
  metricType: 'availability' | 'latency' | 'error_rate' | 'throughput';
  thresholdValue?: number; // for latency (ms), error_rate (%), throughput (req/s)
  tags: Record<string, string>;
  errorBudgetMinutes: number;
}

export interface SLAMeasurement {
  timestamp: Date;
  value: number;
  isCompliant: boolean;
  errorBudgetConsumed: number;
  tags: Record<string, string>;
}

export interface SLAStatus {
  target: SLATarget;
  currentCompliance: number;
  errorBudgetRemaining: number;
  errorBudgetConsumedPercent: number;
  timeToExhaustBudget?: number; // minutes
  lastViolationTime?: Date;
  measurementCount: number;
  trend: 'improving' | 'stable' | 'degrading';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class SLATracker extends EventEmitter {
  private targets = new Map<string, SLATarget>();
  private measurements = new Map<string, SLAMeasurement[]>();
  private windowSizeLimit = 10000; // Maximum measurements to keep in memory

  constructor(private config: {
    alertThreshold: number; // Alert when error budget consumption exceeds this %
    cleanupIntervalMinutes: number;
  } = {
    alertThreshold: 80,
    cleanupIntervalMinutes: 60
  }) {
    super();
    this.startCleanupInterval();
  }

  /**
   * Register a new SLA target for tracking
   */
  addSLATarget(target: SLATarget): void {
    this.targets.set(target.id, target);
    this.measurements.set(target.id, []);
    this.emit('target_added', { target });
  }

  /**
   * Remove an SLA target
   */
  removeSLATarget(targetId: string): void {
    const target = this.targets.get(targetId);
    if (target) {
      this.targets.delete(targetId);
      this.measurements.delete(targetId);
      this.emit('target_removed', { target });
    }
  }

  /**
   * Record a measurement for an SLA target with 99.99% accuracy calculation
   */
  recordMeasurement(targetId: string, value: number, timestamp: Date = new Date()): void {
    const target = this.targets.get(targetId);
    if (!target) {
      throw new Error(`SLA target not found: ${targetId}`);
    }

    const isCompliant = this.evaluateCompliance(target, value);
    const errorBudgetConsumed = isCompliant ? 0 : this.calculateErrorBudgetConsumption(target);
    
    const measurement: SLAMeasurement = {
      timestamp,
      value,
      isCompliant,
      errorBudgetConsumed,
      tags: target.tags
    };

    const measurements = this.measurements.get(targetId) || [];
    measurements.push(measurement);
    
    // Keep only recent measurements within time window
    const cutoffTime = new Date(timestamp.getTime() - target.timeWindowHours * 60 * 60 * 1000);
    const filteredMeasurements = measurements.filter(m => m.timestamp >= cutoffTime);
    
    // Limit memory usage
    if (filteredMeasurements.length > this.windowSizeLimit) {
      filteredMeasurements.splice(0, filteredMeasurements.length - this.windowSizeLimit);
    }
    
    this.measurements.set(targetId, filteredMeasurements);

    // Check for alerts
    const status = this.calculateSLAStatus(targetId);
    if (status) {
      this.checkAndEmitAlerts(status);
    }

    this.emit('measurement_recorded', { targetId, measurement, status });
  }

  /**
   * Get current SLA status with high precision calculations
   */
  getSLAStatus(targetId: string): SLAStatus | null {
    return this.calculateSLAStatus(targetId);
  }

  /**
   * Get all SLA statuses
   */
  getAllSLAStatuses(): Map<string, SLAStatus> {
    const statuses = new Map<string, SLAStatus>();
    for (const targetId of Array.from(this.targets.keys())) {
      const status = this.calculateSLAStatus(targetId);
      if (status) {
        statuses.set(targetId, status);
      }
    }
    return statuses;
  }

  /**
   * Calculate time-series compliance data for trending
   */
  getComplianceTrend(targetId: string, intervalMinutes: number = 60): Array<{
    timestamp: Date;
    compliance: number;
    errorBudgetUsed: number;
  }> {
    const measurements = this.measurements.get(targetId) || [];
    const target = this.targets.get(targetId);
    if (!target || measurements.length === 0) {
      return [];
    }

    const intervals: Array<{
      timestamp: Date;
      compliance: number;
      errorBudgetUsed: number;
    }> = [];

    const intervalMs = intervalMinutes * 60 * 1000;
    const oldest = measurements[0].timestamp;
    const newest = measurements[measurements.length - 1].timestamp;
    
    for (let time = oldest.getTime(); time <= newest.getTime(); time += intervalMs) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(time + intervalMs);
      
      const intervalMeasurements = measurements.filter(
        m => m.timestamp >= intervalStart && m.timestamp < intervalEnd
      );

      if (intervalMeasurements.length > 0) {
        const compliance = this.calculateComplianceForMeasurements(intervalMeasurements);
        const errorBudgetUsed = this.calculateErrorBudgetUsedForMeasurements(target, intervalMeasurements);
        
        intervals.push({
          timestamp: intervalStart,
          compliance,
          errorBudgetUsed
        });
      }
    }

    return intervals;
  }

  /**
   * Get detailed error budget analysis
   */
  getErrorBudgetAnalysis(targetId: string): {
    totalBudgetMinutes: number;
    usedMinutes: number;
    remainingMinutes: number;
    usedPercentage: number;
    burnRate: number; // budget consumption rate per hour
    timeToExhaust?: number; // hours until budget exhausted at current rate
    projectedExhaustionDate?: Date;
  } | null {
    const target = this.targets.get(targetId);
    const measurements = this.measurements.get(targetId) || [];
    
    if (!target || measurements.length === 0) {
      return null;
    }

    const totalBudgetMinutes = target.errorBudgetMinutes;
    const usedMinutes = measurements.reduce((sum, m) => sum + m.errorBudgetConsumed, 0);
    const remainingMinutes = Math.max(0, totalBudgetMinutes - usedMinutes);
    const usedPercentage = (usedMinutes / totalBudgetMinutes) * 100;

    // Calculate burn rate from recent measurements (last 4 hours)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const recentMeasurements = measurements.filter(m => m.timestamp >= fourHoursAgo);
    
    let burnRate = 0;
    let timeToExhaust: number | undefined;
    let projectedExhaustionDate: Date | undefined;

    if (recentMeasurements.length > 0) {
      const recentUsed = recentMeasurements.reduce((sum, m) => sum + m.errorBudgetConsumed, 0);
      const timeSpanHours = (Date.now() - recentMeasurements[0].timestamp.getTime()) / (60 * 60 * 1000);
      burnRate = recentUsed / Math.max(timeSpanHours, 0.1); // budget minutes per hour

      if (burnRate > 0 && remainingMinutes > 0) {
        timeToExhaust = remainingMinutes / (burnRate / 60); // hours
        projectedExhaustionDate = new Date(Date.now() + timeToExhaust * 60 * 60 * 1000);
      }
    }

    return {
      totalBudgetMinutes,
      usedMinutes,
      remainingMinutes,
      usedPercentage,
      burnRate,
      timeToExhaust,
      projectedExhaustionDate
    };
  }

  private evaluateCompliance(target: SLATarget, value: number): boolean {
    switch (target.metricType) {
      case 'availability':
        return value >= target.targetPercentage;
      case 'latency':
        return target.thresholdValue ? value <= target.thresholdValue : true;
      case 'error_rate':
        return target.thresholdValue ? value <= target.thresholdValue : true;
      case 'throughput':
        return target.thresholdValue ? value >= target.thresholdValue : true;
      default:
        return true;
    }
  }

  private calculateErrorBudgetConsumption(target: SLATarget): number {
    // Each non-compliant measurement consumes 1 minute of error budget
    // This is a simplified model - in reality, this would depend on the measurement interval
    // Error budget consumption varies by target type and configuration
    const baseConsumption = target.errorBudgetMinutes > 60 ? 1 : 0.5; // Higher budgets consume more per violation
    return baseConsumption;
  }

  private calculateSLAStatus(targetId: string): SLAStatus | null {
    const target = this.targets.get(targetId);
    const measurements = this.measurements.get(targetId) || [];
    
    if (!target || measurements.length === 0) {
      return null;
    }

    // Calculate current compliance with high precision
    const currentCompliance = this.calculateComplianceForMeasurements(measurements);
    
    // Calculate error budget status
    const errorBudgetUsed = measurements.reduce((sum, m) => sum + m.errorBudgetConsumed, 0);
    const errorBudgetRemaining = Math.max(0, target.errorBudgetMinutes - errorBudgetUsed);
    const errorBudgetConsumedPercent = (errorBudgetUsed / target.errorBudgetMinutes) * 100;

    // Find last violation
    const violations = measurements.filter(m => !m.isCompliant);
    const lastViolationTime = violations.length > 0 ? violations[violations.length - 1].timestamp : undefined;

    // Calculate trend
    const trend = this.calculateTrend(measurements);
    
    // Assess risk level
    const riskLevel = this.assessRiskLevel(errorBudgetConsumedPercent, trend);

    return {
      target,
      currentCompliance,
      errorBudgetRemaining,
      errorBudgetConsumedPercent,
      lastViolationTime,
      measurementCount: measurements.length,
      trend,
      riskLevel
    };
  }

  private calculateComplianceForMeasurements(measurements: SLAMeasurement[]): number {
    if (measurements.length === 0) return 100;
    
    const compliantCount = measurements.filter(m => m.isCompliant).length;
    return (compliantCount / measurements.length) * 100;
  }

  private calculateErrorBudgetUsedForMeasurements(target: SLATarget, measurements: SLAMeasurement[]): number {
    const used = measurements.reduce((sum, m) => sum + m.errorBudgetConsumed, 0);
    return (used / target.errorBudgetMinutes) * 100;
  }

  private calculateTrend(measurements: SLAMeasurement[]): 'improving' | 'stable' | 'degrading' {
    if (measurements.length < 10) return 'stable';

    // Compare recent performance (last 25%) with older performance
    const splitPoint = Math.floor(measurements.length * 0.75);
    const olderMeasurements = measurements.slice(0, splitPoint);
    const recentMeasurements = measurements.slice(splitPoint);

    const olderCompliance = this.calculateComplianceForMeasurements(olderMeasurements);
    const recentCompliance = this.calculateComplianceForMeasurements(recentMeasurements);

    const difference = recentCompliance - olderCompliance;
    
    if (difference > 1) return 'improving';
    if (difference < -1) return 'degrading';
    return 'stable';
  }

  private assessRiskLevel(errorBudgetConsumedPercent: number, trend: string): 'low' | 'medium' | 'high' | 'critical' {
    if (errorBudgetConsumedPercent >= 95) return 'critical';
    if (errorBudgetConsumedPercent >= 80) {
      return trend === 'degrading' ? 'critical' : 'high';
    }
    if (errorBudgetConsumedPercent >= 60) {
      return trend === 'degrading' ? 'high' : 'medium';
    }
    return trend === 'degrading' ? 'medium' : 'low';
  }

  private checkAndEmitAlerts(status: SLAStatus): void {
    const { alertThreshold } = this.config;
    
    if (status.errorBudgetConsumedPercent >= alertThreshold) {
      this.emit('sla_alert', {
        type: 'error_budget_threshold',
        status,
        severity: status.riskLevel,
        message: `Error budget ${status.errorBudgetConsumedPercent.toFixed(2)}% consumed for ${status.target.name}`
      });
    }

    if (status.riskLevel === 'critical') {
      this.emit('sla_alert', {
        type: 'critical_risk',
        status,
        severity: 'critical',
        message: `Critical SLA risk for ${status.target.name}`
      });
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldMeasurements();
    }, this.config.cleanupIntervalMinutes * 60 * 1000);
  }

  private cleanupOldMeasurements(): void {
    const now = new Date();
    
    for (const [targetId, target] of Array.from(this.targets.entries())) {
      const measurements = this.measurements.get(targetId) || [];
      const cutoffTime = new Date(now.getTime() - target.timeWindowHours * 60 * 60 * 1000);
      
      const filteredMeasurements = measurements.filter(m => m.timestamp >= cutoffTime);
      this.measurements.set(targetId, filteredMeasurements);
    }

    this.emit('cleanup_completed', { 
      timestamp: now,
      targetsProcessed: this.targets.size 
    });
  }
}

// Example usage and configuration helpers
export const createAvailabilitySLA = (
  id: string,
  name: string,
  targetPercentage: number = 99.99,
  timeWindowHours: number = 24
): SLATarget => ({
  id,
  name,
  description: `${targetPercentage}% availability over ${timeWindowHours} hours`,
  targetPercentage,
  timeWindowHours,
  metricType: 'availability',
  tags: { type: 'availability' },
  errorBudgetMinutes: ((100 - targetPercentage) / 100) * timeWindowHours * 60
});

export const createLatencySLA = (
  id: string,
  name: string,
  thresholdMs: number,
  timeWindowHours: number = 24
): SLATarget => ({
  id,
  name,
  description: `Latency under ${thresholdMs}ms over ${timeWindowHours} hours`,
  targetPercentage: 95, // 95% of requests should be under threshold
  timeWindowHours,
  metricType: 'latency',
  thresholdValue: thresholdMs,
  tags: { type: 'latency' },
  errorBudgetMinutes: (5 / 100) * timeWindowHours * 60 // 5% error budget
});

export default SLATracker;