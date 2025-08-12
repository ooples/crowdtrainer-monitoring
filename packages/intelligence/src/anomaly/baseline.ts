/**
 * Baseline Learning System for Normal Pattern Detection
 * 
 * This system learns normal patterns from historical data to establish
 * baselines for anomaly detection. It handles:
 * - Statistical baselines (mean, std dev, percentiles)
 * - Seasonal pattern detection
 * - Trend analysis
 * - Adaptive learning with concept drift
 * - Multi-dimensional data patterns
 */

import { EventEmitter } from 'events';
import {
  BaselineData,
  SeasonalPattern,
  TrendData,
  MonitoringData,
  DataType
} from '../types';

interface BaselineStore {
  [key: string]: BaselineData;
}

interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  source: string;
  type: DataType;
}

export class BaselineManager extends EventEmitter {
  private baselines: BaselineStore = {};
  private timeSeries: Map<string, TimeSeriesPoint[]> = new Map();
  private isInitialized = false;
  private updateInterval?: NodeJS.Timeout;
  private readonly maxHistorySize = 50000; // Maximum points to keep in memory
  private readonly minDataPoints = 100; // Minimum points needed for baseline
  
  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    console.log('Initializing Baseline Manager...');
    
    this.baselines = {};
    this.timeSeries.clear();
    
    // Start periodic baseline updates
    this.startPeriodicUpdates();
    
    this.isInitialized = true;
    console.log('Baseline Manager initialized');
    
    this.emit('initialized');
  }

  /**
   * Get baseline for a specific data point
   */
  async getBaseline(data: MonitoringData): Promise<BaselineData | null> {
    if (!this.isInitialized) return null;
    
    const key = this.generateBaselineKey(data);
    return this.baselines[key] || null;
  }

  /**
   * Update baselines with new data
   */
  async updateBaselines(dataPoints: MonitoringData[]): Promise<void> {
    if (!this.isInitialized) return;
    
    console.log(`Updating baselines with ${dataPoints.length} data points`);
    const startTime = Date.now();
    
    // Group data by type and source
    const groupedData = this.groupDataPoints(dataPoints);
    
    // Update time series and calculate baselines
    for (const [key, points] of groupedData) {
      await this.updateBaselineForKey(key, points);
    }
    
    console.log(`Baselines updated in ${Date.now() - startTime}ms`);
    this.emit('baselines_updated', { 
      count: Object.keys(this.baselines).length,
      dataPoints: dataPoints.length 
    });
  }

  /**
   * Force recalculation of all baselines
   */
  async recalculateAll(): Promise<void> {
    console.log('Recalculating all baselines...');
    const startTime = Date.now();
    
    for (const [key, points] of this.timeSeries) {
      if (points.length >= this.minDataPoints) {
        const baseline = await this.calculateBaseline(points);
        this.baselines[key] = baseline;
      }
    }
    
    console.log(`All baselines recalculated in ${Date.now() - startTime}ms`);
    this.emit('baselines_recalculated', { count: Object.keys(this.baselines).length });
  }

  /**
   * Get all current baselines
   */
  getAllBaselines(): BaselineStore {
    return { ...this.baselines };
  }

  /**
   * Get statistics about baseline coverage
   */
  getBaselineStats(): {
    totalBaselines: number;
    timeSeriesCount: number;
    avgDataPoints: number;
    oldestBaseline: number;
    newestBaseline: number;
  } {
    const baselineValues = Object.values(this.baselines);
    const timeSeriesValues = Array.from(this.timeSeries.values());
    
    return {
      totalBaselines: baselineValues.length,
      timeSeriesCount: timeSeriesValues.length,
      avgDataPoints: timeSeriesValues.reduce((sum, points) => sum + points.length, 0) / Math.max(1, timeSeriesValues.length),
      oldestBaseline: baselineValues.length > 0 ? Math.min(...baselineValues.map(b => b.lastUpdated)) : 0,
      newestBaseline: baselineValues.length > 0 ? Math.max(...baselineValues.map(b => b.lastUpdated)) : 0
    };
  }

  /**
   * Clear old data to manage memory
   */
  cleanup(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    let cleanedCount = 0;
    
    for (const [key, points] of this.timeSeries) {
      const filteredPoints = points.filter(p => p.timestamp > cutoffTime);
      if (filteredPoints.length !== points.length) {
        this.timeSeries.set(key, filteredPoints);
        cleanedCount++;
      }
      
      // Also limit by size
      if (filteredPoints.length > this.maxHistorySize) {
        const trimmedPoints = filteredPoints.slice(-this.maxHistorySize);
        this.timeSeries.set(key, trimmedPoints);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} time series`);
    }
  }

  private async updateBaselineForKey(key: string, newPoints: TimeSeriesPoint[]): Promise<void> {
    // Get existing time series or create new one
    const existingPoints = this.timeSeries.get(key) || [];
    
    // Add new points
    const allPoints = [...existingPoints, ...newPoints];
    
    // Sort by timestamp
    allPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Limit size to prevent memory issues
    const limitedPoints = allPoints.slice(-this.maxHistorySize);
    this.timeSeries.set(key, limitedPoints);
    
    // Calculate baseline if we have enough data
    if (limitedPoints.length >= this.minDataPoints) {
      const baseline = await this.calculateBaseline(limitedPoints);
      this.baselines[key] = baseline;
    }
  }

  private async calculateBaseline(points: TimeSeriesPoint[]): Promise<BaselineData> {
    const values = points.map(p => p.value).filter(v => isFinite(v));
    
    if (values.length === 0) {
      return this.createEmptyBaseline();
    }
    
    // Basic statistics
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    // Percentiles
    const percentiles = {
      p10: this.percentile(sorted, 10),
      p25: this.percentile(sorted, 25),
      p50: this.percentile(sorted, 50),
      p75: this.percentile(sorted, 75),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
    
    // Detect seasonal patterns
    const seasonalPatterns = await this.detectSeasonalPatterns(points);
    
    // Calculate trend
    const trendData = this.calculateTrend(points);
    
    return {
      mean,
      stdDev,
      min,
      max,
      percentiles,
      seasonalPatterns,
      trendData,
      lastUpdated: Date.now(),
      sampleSize: points.length
    };
  }

  private async detectSeasonalPatterns(points: TimeSeriesPoint[]): Promise<SeasonalPattern[]> {
    const patterns: SeasonalPattern[] = [];
    
    if (points.length < 168) return patterns; // Need at least a week of hourly data
    
    try {
      // Hourly pattern (24 hours)
      const hourlyPattern = this.extractHourlyPattern(points);
      if (hourlyPattern.strength > 0.1) { // Minimum strength threshold
        patterns.push(hourlyPattern);
      }
      
      // Daily pattern (7 days)
      if (points.length >= 24 * 7) {
        const dailyPattern = this.extractDailyPattern(points);
        if (dailyPattern.strength > 0.1) {
          patterns.push(dailyPattern);
        }
      }
      
      // Weekly pattern (4 weeks)
      if (points.length >= 24 * 7 * 4) {
        const weeklyPattern = this.extractWeeklyPattern(points);
        if (weeklyPattern.strength > 0.1) {
          patterns.push(weeklyPattern);
        }
      }
      
    } catch (error) {
      console.warn('Error detecting seasonal patterns:', error);
    }
    
    return patterns;
  }

  private extractHourlyPattern(points: TimeSeriesPoint[]): SeasonalPattern {
    const hourlyBuckets = new Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));
    
    // Aggregate values by hour of day
    for (const point of points) {
      const hour = new Date(point.timestamp).getHours();
      hourlyBuckets[hour].sum += point.value;
      hourlyBuckets[hour].count++;
    }
    
    // Calculate average for each hour
    const pattern = hourlyBuckets.map(bucket => 
      bucket.count > 0 ? bucket.sum / bucket.count : 0
    );
    
    // Calculate pattern strength (coefficient of variation)
    const patternMean = pattern.reduce((sum, v) => sum + v, 0) / pattern.length;
    const patternVariance = pattern.reduce((sum, v) => sum + Math.pow(v - patternMean, 2), 0) / pattern.length;
    const strength = patternMean > 0 ? Math.sqrt(patternVariance) / patternMean : 0;
    
    return {
      period: 'hourly',
      pattern,
      strength: Math.min(1, strength)
    };
  }

  private extractDailyPattern(points: TimeSeriesPoint[]): SeasonalPattern {
    const dailyBuckets = new Array(7).fill(0).map(() => ({ sum: 0, count: 0 }));
    
    // Aggregate values by day of week
    for (const point of points) {
      const dayOfWeek = new Date(point.timestamp).getDay();
      dailyBuckets[dayOfWeek].sum += point.value;
      dailyBuckets[dayOfWeek].count++;
    }
    
    const pattern = dailyBuckets.map(bucket => 
      bucket.count > 0 ? bucket.sum / bucket.count : 0
    );
    
    const patternMean = pattern.reduce((sum, v) => sum + v, 0) / pattern.length;
    const patternVariance = pattern.reduce((sum, v) => sum + Math.pow(v - patternMean, 2), 0) / pattern.length;
    const strength = patternMean > 0 ? Math.sqrt(patternVariance) / patternMean : 0;
    
    return {
      period: 'daily',
      pattern,
      strength: Math.min(1, strength)
    };
  }

  private extractWeeklyPattern(points: TimeSeriesPoint[]): SeasonalPattern {
    // Group by week and calculate weekly averages
    const weeklyData: { [week: string]: { sum: number, count: number } } = {};
    
    for (const point of points) {
      const date = new Date(point.timestamp);
      const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { sum: 0, count: 0 };
      }
      
      weeklyData[weekKey].sum += point.value;
      weeklyData[weekKey].count++;
    }
    
    const weeklyAverages = Object.values(weeklyData).map(data => data.sum / data.count);
    
    if (weeklyAverages.length < 4) {
      return { period: 'weekly', pattern: [], strength: 0 };
    }
    
    const patternMean = weeklyAverages.reduce((sum, v) => sum + v, 0) / weeklyAverages.length;
    const patternVariance = weeklyAverages.reduce((sum, v) => sum + Math.pow(v - patternMean, 2), 0) / weeklyAverages.length;
    const strength = patternMean > 0 ? Math.sqrt(patternVariance) / patternMean : 0;
    
    return {
      period: 'weekly',
      pattern: weeklyAverages,
      strength: Math.min(1, strength)
    };
  }

  private calculateTrend(points: TimeSeriesPoint[]): TrendData {
    if (points.length < 10) {
      return {
        slope: 0,
        intercept: 0,
        correlation: 0,
        direction: 'stable'
      };
    }
    
    // Prepare data for linear regression
    const n = points.length;
    const x = points.map((_, i) => i); // Use index as x
    const y = points.map(p => p.value);
    
    // Calculate linear regression
    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient (R)
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator !== 0 ? numerator / denominator : 0;
    
    // Determine trend direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    const slopeThreshold = Math.abs(slope) > 0.01; // Configurable threshold
    
    if (slopeThreshold) {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    } else {
      direction = 'stable';
    }
    
    return {
      slope,
      intercept,
      correlation: correlation * correlation, // R-squared
      direction
    };
  }

  private groupDataPoints(dataPoints: MonitoringData[]): Map<string, TimeSeriesPoint[]> {
    const grouped = new Map<string, TimeSeriesPoint[]>();
    
    for (const data of dataPoints) {
      const key = this.generateBaselineKey(data);
      const value = this.extractPrimaryValue(data);
      const type = this.getDataType(data);
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      grouped.get(key)!.push({
        timestamp: data.timestamp,
        value,
        source: data.source,
        type
      });
    }
    
    return grouped;
  }

  private generateBaselineKey(data: MonitoringData): string {
    const type = this.getDataType(data);
    const source = data.source || 'unknown';
    
    // Include relevant tags for more granular baselines
    const tags = data.tags || {};
    const relevantTags = ['service', 'endpoint', 'environment', 'region']
      .filter(tag => tags[tag])
      .map(tag => `${tag}:${tags[tag]}`)
      .sort()
      .join(',');
    
    return `${type}:${source}${relevantTags ? ':' + relevantTags : ''}`;
  }

  private extractPrimaryValue(data: MonitoringData): number {
    if ('value' in data) return (data as any).value || 0;
    if ('duration' in data) return (data as any).duration || 0;
    if ('level' in data) return this.getLogLevelNumeric((data as any).level);
    if ('severity' in data) return this.getSeverityNumeric((data as any).severity);
    return 0;
  }

  private getDataType(data: MonitoringData): DataType {
    if ('value' in data) return 'metric';
    if ('level' in data) return 'log';
    if ('traceId' in data) return 'trace';
    if ('stackTrace' in data) return 'error';
    if ('action' in data) return 'behavior';
    return 'metric';
  }

  private getLogLevelNumeric(level: string): number {
    const levels: Record<string, number> = { debug: 1, info: 2, warn: 3, error: 4, critical: 5 };
    return levels[level] || 0;
  }

  private getSeverityNumeric(severity: string): number {
    const severities: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    return severities[severity] || 0;
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private createEmptyBaseline(): BaselineData {
    return {
      mean: 0,
      stdDev: 1,
      min: 0,
      max: 1,
      percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
      seasonalPatterns: [],
      trendData: {
        slope: 0,
        intercept: 0,
        correlation: 0,
        direction: 'stable'
      },
      lastUpdated: Date.now(),
      sampleSize: 0
    };
  }

  private startPeriodicUpdates(): void {
    // Update baselines every 5 minutes
    this.updateInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a value is anomalous based on baseline
   */
  isAnomalous(value: number, baseline: BaselineData, sensitivity: number = 2): {
    isAnomaly: boolean;
    score: number;
    reason: string;
  } {
    if (!baseline || baseline.sampleSize === 0) {
      return { isAnomaly: false, score: 0, reason: 'No baseline available' };
    }
    
    // Z-score based detection
    const zScore = Math.abs(value - baseline.mean) / (baseline.stdDev || 1);
    const zScoreAnomaly = zScore > sensitivity;
    
    // Percentile based detection
    const percentileAnomaly = value < baseline.percentiles.p10 || value > baseline.percentiles.p90;
    
    // Combine methods
    const isAnomaly = zScoreAnomaly || percentileAnomaly;
    const score = Math.min(1, zScore / 3); // Normalize to 0-1
    
    let reason = 'Normal';
    if (zScoreAnomaly) {
      reason = `High z-score (${zScore.toFixed(2)})`;
    } else if (percentileAnomaly) {
      reason = value < baseline.percentiles.p10 ? 'Below 10th percentile' : 'Above 90th percentile';
    }
    
    return { isAnomaly, score, reason };
  }

  /**
   * Shutdown the baseline manager
   */
  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    
    this.removeAllListeners();
    this.baselines = {};
    this.timeSeries.clear();
    this.isInitialized = false;
    
    console.log('Baseline Manager shutdown complete');
  }
}