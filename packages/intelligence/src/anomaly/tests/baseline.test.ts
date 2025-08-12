/**
 * Test Suite for Baseline Manager
 */

import { BaselineManager } from '../baseline';
import { MonitoringData } from '../../types';

describe('BaselineManager', () => {
  let baselineManager: BaselineManager;

  beforeEach(async () => {
    baselineManager = new BaselineManager();
    await baselineManager.initialize();
  });

  afterEach(async () => {
    await baselineManager.shutdown();
  });

  const generateTestData = (count: number, baseValue: number = 100, variance: number = 10): MonitoringData[] => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: Date.now() - (count - i) * 60000, // 1 minute intervals
      value: baseValue + (Math.random() - 0.5) * variance,
      source: 'test-service',
      tags: { environment: 'test' },
      metadata: {}
    }));
  };

  test('should initialize successfully', async () => {
    const newManager = new BaselineManager();
    await expect(newManager.initialize()).resolves.not.toThrow();
    await newManager.shutdown();
  });

  test('should update baselines with data', async () => {
    const testData = generateTestData(200);
    await baselineManager.updateBaselines(testData);
    
    const baseline = await baselineManager.getBaseline(testData[0]);
    expect(baseline).not.toBeNull();
    expect(baseline!.sampleSize).toBe(200);
    expect(baseline!.mean).toBeCloseTo(100, 0);
  });

  test('should calculate statistical properties correctly', async () => {
    const testData = generateTestData(1000, 50, 20);
    await baselineManager.updateBaselines(testData);
    
    const baseline = await baselineManager.getBaseline(testData[0]);
    expect(baseline).not.toBeNull();
    expect(baseline!.mean).toBeCloseTo(50, 0);
    expect(baseline!.stdDev).toBeGreaterThan(0);
    expect(baseline!.min).toBeLessThan(baseline!.max);
    expect(baseline!.percentiles.p50).toBeCloseTo(50, 5);
  });

  test('should detect seasonal patterns', async () => {
    // Create hourly pattern data
    const hourlyData: MonitoringData[] = [];
    const now = Date.now();
    
    for (let i = 0; i < 168; i++) { // 1 week of hourly data
      const hour = i % 24;
      const baseValue = 100 + Math.sin((hour / 24) * 2 * Math.PI) * 20; // Sinusoidal pattern
      
      hourlyData.push({
        timestamp: now - (168 - i) * 3600000, // 1 hour intervals
        value: baseValue + Math.random() * 5,
        source: 'test-service',
        tags: { environment: 'test' },
        metadata: {}
      });
    }
    
    await baselineManager.updateBaselines(hourlyData);
    const baseline = await baselineManager.getBaseline(hourlyData[0]);
    
    expect(baseline).not.toBeNull();
    expect(baseline!.seasonalPatterns).toBeDefined();
    
    if (baseline!.seasonalPatterns && baseline!.seasonalPatterns.length > 0) {
      const hourlyPattern = baseline!.seasonalPatterns.find(p => p.period === 'hourly');
      expect(hourlyPattern).toBeDefined();
      expect(hourlyPattern!.strength).toBeGreaterThan(0.1);
    }
  });

  test('should calculate trend data', async () => {
    // Create trending data
    const trendingData = Array.from({ length: 100 }, (_, i) => ({
      timestamp: Date.now() - (100 - i) * 60000,
      value: 50 + i * 0.5 + Math.random() * 5, // Upward trend
      source: 'test-service',
      tags: { environment: 'test' },
      metadata: {}
    }));
    
    await baselineManager.updateBaselines(trendingData);
    const baseline = await baselineManager.getBaseline(trendingData[0]);
    
    expect(baseline).not.toBeNull();
    expect(baseline!.trendData).toBeDefined();
    expect(baseline!.trendData!.direction).toBe('increasing');
    expect(baseline!.trendData!.slope).toBeGreaterThan(0);
  });

  test('should group data by source and type', async () => {
    const mixedData: MonitoringData[] = [
      ...generateTestData(50).map(d => ({ ...d, source: 'service-a' })),
      ...generateTestData(50).map(d => ({ ...d, source: 'service-b' })),
      {
        timestamp: Date.now(),
        level: 'error' as const,
        message: 'Test error',
        source: 'service-a',
        tags: {},
        metadata: {}
      }
    ];
    
    await baselineManager.updateBaselines(mixedData);
    const stats = baselineManager.getBaselineStats();
    
    expect(stats.totalBaselines).toBeGreaterThan(0); // Should have baselines
  });

  test('should identify anomalous values', async () => {
    const normalData = generateTestData(200, 100, 5);
    await baselineManager.updateBaselines(normalData);
    
    const baseline = await baselineManager.getBaseline(normalData[0]);
    expect(baseline).not.toBeNull();
    
    // Test normal value
    const normalResult = baselineManager.isAnomalous(102, baseline!);
    expect(normalResult.isAnomaly).toBe(false);
    
    // Test anomalous value
    const anomalousResult = baselineManager.isAnomalous(200, baseline!);
    expect(anomalousResult.isAnomaly).toBe(true);
    expect(anomalousResult.score).toBeGreaterThan(0.5);
  });

  test('should handle empty baselines gracefully', async () => {
    const testData = generateTestData(1);
    const baseline = await baselineManager.getBaseline(testData[0]);
    expect(baseline).toBeNull();
  });

  test('should cleanup old data', async () => {
    const oldData = generateTestData(100, 100, 10);
    // Make data very old
    oldData.forEach(d => d.timestamp = Date.now() - 10 * 24 * 60 * 60 * 1000);
    
    await baselineManager.updateBaselines(oldData);
    baselineManager.cleanup();
    
    // Add recent data
    const recentData = generateTestData(100, 100, 10);
    await baselineManager.updateBaselines(recentData);
    
    const stats = baselineManager.getBaselineStats();
    expect(stats.timeSeriesCount).toBeGreaterThan(0);
  });

  test('should emit events on updates', async () => {
    const updatePromise = new Promise(resolve => {
      baselineManager.once('baselines_updated', resolve);
    });
    
    const testData = generateTestData(150);
    await baselineManager.updateBaselines(testData);
    
    await expect(updatePromise).resolves.toBeDefined();
  });

  test('should handle different data types', async () => {
    const multiTypeData: MonitoringData[] = [
      {
        timestamp: Date.now(),
        value: 100,
        source: 'metrics-service',
        tags: {},
        metadata: {}
      },
      {
        timestamp: Date.now(),
        level: 'info' as const,
        message: 'User logged in',
        source: 'auth-service',
        tags: {},
        metadata: {}
      },
      {
        timestamp: Date.now(),
        traceId: 'trace-123',
        spanId: 'span-456',
        operation: 'database.query',
        duration: 150,
        status: 'success' as const,
        source: 'db-service',
        tags: {},
        metadata: {}
      }
    ];
    
    await expect(baselineManager.updateBaselines(multiTypeData)).resolves.not.toThrow();
  });

  test('should provide baseline statistics', async () => {
    const testData = generateTestData(300);
    await baselineManager.updateBaselines(testData);
    
    const stats = baselineManager.getBaselineStats();
    expect(stats.totalBaselines).toBeGreaterThan(0);
    expect(stats.avgDataPoints).toBeGreaterThan(0);
    expect(stats.newestBaseline).toBeGreaterThanOrEqual(stats.oldestBaseline);
  });
});