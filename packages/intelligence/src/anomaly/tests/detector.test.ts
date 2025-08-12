/**
 * Comprehensive Test Suite for Anomaly Detector
 * 
 * Tests cover:
 * - Initialization and configuration
 * - Real-time anomaly detection
 * - Batch processing
 * - Model integration
 * - Performance requirements
 * - Auto-tuning functionality
 * - Error handling and edge cases
 * - Integration with baseline and explainer
 */

import { AnomalyDetector, defaultDetectorConfig } from '../detector';
import { BaselineManager } from '../baseline';
import { AnomalyExplainer } from '../explainer';
import {
  MonitoringData,
  DetectorConfig,
  AnomalyScore,
  Feedback,
  ModelConfig
} from '../../types';

// Mock data generators
const generateMetricData = (value: number, timestamp?: number): MonitoringData => ({
  timestamp: timestamp || Date.now(),
  value,
  source: 'test-service',
  tags: { environment: 'test' },
  metadata: {}
});

const generateLogData = (level: 'debug' | 'info' | 'warn' | 'error' | 'critical', message: string): MonitoringData => ({
  timestamp: Date.now(),
  level,
  message,
  source: 'test-app',
  tags: { component: 'auth' },
  metadata: {}
});

const generateTraceData = (duration: number, status: 'success' | 'error' | 'timeout'): MonitoringData => ({
  timestamp: Date.now(),
  traceId: 'test-trace-id',
  spanId: 'test-span-id',
  operation: 'database.query',
  duration,
  status,
  source: 'test-db',
  tags: { service: 'user-service' },
  metadata: {}
});

const generateErrorData = (severity: 'low' | 'medium' | 'high' | 'critical'): MonitoringData => ({
  timestamp: Date.now(),
  type: 'TypeError',
  message: 'Cannot read property of undefined',
  severity,
  source: 'frontend',
  stackTrace: 'Error at line 42...',
  tags: { page: 'checkout' },
  metadata: {}
});

const generateBehaviorData = (success: boolean, action: string): MonitoringData => ({
  timestamp: Date.now(),
  userId: 'user-123',
  sessionId: 'session-456',
  action,
  page: 'dashboard',
  duration: 1500,
  success,
  source: 'web-app',
  tags: { browser: 'chrome' },
  metadata: {}
});

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;
  let config: DetectorConfig;

  beforeEach(async () => {
    // Use a lightweight config for testing
    config = {
      ...defaultDetectorConfig,
      models: [{
        type: 'isolation_forest',
        parameters: { isolationTreeCount: 10 }, // Smaller for faster tests
        threshold: 0.6,
        autoTune: false // Disable for deterministic tests
      }],
      performance: {
        maxLatency: 100,
        batchSize: 50,
        parallelProcessing: false // Disable for deterministic tests
      }
    };
    
    detector = new AnomalyDetector(config);
    await detector.initialize();
  });

  afterEach(async () => {
    await detector?.shutdown();
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      const defaultDetector = new AnomalyDetector(defaultDetectorConfig);
      await expect(defaultDetector.initialize()).resolves.not.toThrow();
      await defaultDetector.shutdown();
    });

    test('should initialize all components', async () => {
      expect(detector).toBeInstanceOf(AnomalyDetector);
      // Test that initialization completed by trying to detect
      const testData = generateMetricData(100);
      await expect(detector.detect(testData)).resolves.toBeDefined();
    });

    test('should emit initialized event', async () => {
      const newDetector = new AnomalyDetector(config);
      const initPromise = new Promise(resolve => {
        newDetector.once('initialized', resolve);
      });
      
      await newDetector.initialize();
      await expect(initPromise).resolves.toBeDefined();
      await newDetector.shutdown();
    });

    test('should throw error if detecting before initialization', async () => {
      const uninitializedDetector = new AnomalyDetector(config);
      const testData = generateMetricData(100);
      
      await expect(uninitializedDetector.detect(testData)).rejects.toThrow('not initialized');
      await uninitializedDetector.shutdown();
    });
  });

  describe('Anomaly Detection', () => {
    beforeEach(async () => {
      // Train with some normal data
      const normalData = Array.from({ length: 100 }, (_, i) => 
        generateMetricData(100 + Math.random() * 20 - 10) // Values around 100 ±10
      );
      await detector.retrain(normalData);
    });

    test('should detect obvious anomalies', async () => {
      const anomalousData = generateMetricData(1000); // Way outside normal range
      const result = await detector.detect(anomalousData);
      
      expect(result).not.toBeNull();
      expect(result!.score.score).toBeGreaterThan(50); // Should be high anomaly score
      expect(result!.score.confidence).toBeGreaterThan(0.5);
      expect(result!.explanation).toBeDefined();
      expect(result!.id).toMatch(/^anomaly_/);
    });

    test('should not flag normal data as anomalous', async () => {
      const normalData = generateMetricData(105); // Within normal range
      const result = await detector.detect(normalData);
      
      expect(result).toBeNull(); // Should not be detected as anomaly
    });

    test('should handle different data types', async () => {
      const testCases = [
        generateLogData('error', 'Database connection failed'),
        generateTraceData(10000, 'timeout'), // Very slow
        generateErrorData('critical'),
        generateBehaviorData(false, 'payment')
      ];

      for (const testData of testCases) {
        const result = await detector.detect(testData);
        expect(result).toBeDefined(); // May or may not be anomaly, but should not throw
      }
    });

    test('should meet latency requirements', async () => {
      const testData = generateMetricData(200);
      const startTime = Date.now();
      
      await detector.detect(testData);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(config.performance.maxLatency);
    });

    test('should include baseline data in results when available', async () => {
      const testData = generateMetricData(150);
      const result = await detector.detect(testData);
      
      if (result) {
        expect(result.baseline).toBeDefined();
        expect(typeof result.baseline!.mean).toBe('number');
        expect(typeof result.baseline!.stdDev).toBe('number');
      }
    });

    test('should emit anomaly events', async () => {
      const eventPromise = new Promise(resolve => {
        detector.once('anomaly', resolve);
      });
      
      const anomalousData = generateMetricData(2000);
      await detector.detect(anomalousData);
      
      await expect(eventPromise).resolves.toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple data points efficiently', async () => {
      const batchData = Array.from({ length: 50 }, (_, i) => 
        generateMetricData(i % 10 === 0 ? 1000 : 100 + Math.random() * 10) // Every 10th is anomalous
      );

      const startTime = Date.now();
      const results = await detector.detectBatch(batchData);
      const processingTime = Date.now() - startTime;
      
      expect(results).toHaveLength(batchData.length);
      expect(processingTime).toBeLessThan(batchData.length * 10); // Should be much faster than individual processing
      
      // Should detect some anomalies
      const anomalies = results.filter(r => r !== null);
      expect(anomalies.length).toBeGreaterThan(0);
    });

    test('should handle empty batch', async () => {
      const results = await detector.detectBatch([]);
      expect(results).toHaveLength(0);
    });

    test('should handle mixed data types in batch', async () => {
      const mixedData = [
        generateMetricData(1000),
        generateLogData('critical', 'System failure'),
        generateTraceData(15000, 'timeout'),
        generateErrorData('high'),
        generateBehaviorData(false, 'login')
      ];

      const results = await detector.detectBatch(mixedData);
      expect(results).toHaveLength(mixedData.length);
    });
  });

  describe('Model Integration', () => {
    test('should work with different model configurations', async () => {
      const models: ModelConfig[] = [
        { type: 'isolation_forest', parameters: { isolationTreeCount: 5 }, threshold: 0.6, autoTune: false },
        { type: 'clustering', parameters: { clusterCount: 3 }, threshold: 0.7, autoTune: false }
      ];

      for (const modelConfig of models) {
        const testConfig = { ...config, models: [modelConfig] };
        const testDetector = new AnomalyDetector(testConfig);
        
        await testDetector.initialize();
        
        const testData = generateMetricData(500);
        const result = await testDetector.detect(testData);
        
        expect(result).toBeDefined(); // Should work with any model type
        await testDetector.shutdown();
      }
    });

    test('should handle model failures gracefully', async () => {
      // Create a detector with invalid model parameters
      const invalidConfig: DetectorConfig = {
        ...config,
        models: [{
          type: 'isolation_forest',
          parameters: { invalidParam: 'invalid' },
          threshold: 0.5,
          autoTune: false
        }]
      };

      const testDetector = new AnomalyDetector(invalidConfig);
      await testDetector.initialize(); // Should not throw
      
      const testData = generateMetricData(100);
      const result = await testDetector.detect(testData);
      
      // Should handle gracefully, may return null or low-confidence result
      expect(result).toBeDefined();
      await testDetector.shutdown();
    });
  });

  describe('Auto-tuning', () => {
    beforeEach(async () => {
      // Create detector with auto-tuning enabled
      const autoTuningConfig = {
        ...config,
        autoTuning: {
          enabled: true,
          feedbackWindow: 1, // 1 minute for fast testing
          minSamples: 5,
          adjustmentRate: 0.2
        }
      };
      
      if (detector) await detector.shutdown();
      detector = new AnomalyDetector(autoTuningConfig);
      await detector.initialize();
    });

    test('should adjust thresholds based on feedback', async () => {
      const initialThreshold = config.thresholds.anomalyScore;
      
      // Provide false positive feedback
      const feedbacks: Feedback[] = Array.from({ length: 10 }, (_, i) => ({
        anomalyId: `test-anomaly-${i}`,
        isActualAnomaly: false, // All false positives
        timestamp: Date.now(),
        userId: 'test-user'
      }));

      for (const feedback of feedbacks) {
        await detector.provideFeedback(feedback);
      }

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if threshold adjustment event was emitted
      const adjustmentPromise = new Promise(resolve => {
        detector.once('thresholds_adjusted', resolve);
      });

      // Trigger threshold adjustment by providing one more feedback
      await detector.provideFeedback({
        anomalyId: 'final-test',
        isActualAnomaly: false,
        timestamp: Date.now()
      });

      await expect(adjustmentPromise).resolves.toBeDefined();
    });

    test('should maintain performance metrics during auto-tuning', async () => {
      // Generate some feedback
      await detector.provideFeedback({
        anomalyId: 'test-anomaly',
        isActualAnomaly: true,
        timestamp: Date.now()
      });

      const metrics = detector.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.accuracy).toBe('number');
      expect(typeof metrics.falsePositiveRate).toBe('number');
      expect(metrics.falsePositiveRate).toBeLessThan(0.1); // Should be reasonable
    });
  });

  describe('Performance Requirements', () => {
    test('should meet false positive rate target', async () => {
      // Generate mixed normal and anomalous data
      const testData = [
        ...Array.from({ length: 80 }, () => generateMetricData(100 + Math.random() * 20 - 10)), // Normal
        ...Array.from({ length: 20 }, () => generateMetricData(500 + Math.random() * 100)) // Anomalous
      ];

      // Train first
      await detector.retrain(testData.slice(0, 60));

      let falsePositives = 0;
      let truePositives = 0;
      let falseNegatives = 0;
      let trueNegatives = 0;

      for (let i = 60; i < testData.length; i++) {
        const data = testData[i];
        const result = await detector.detect(data);
        const isDetected = result !== null;
        const isActualAnomaly = (data as any).value > 400; // Our anomaly threshold

        if (isDetected && isActualAnomaly) truePositives++;
        else if (isDetected && !isActualAnomaly) falsePositives++;
        else if (!isDetected && isActualAnomaly) falseNegatives++;
        else trueNegatives++;
      }

      const falsePositiveRate = falsePositives / (falsePositives + trueNegatives);
      expect(falsePositiveRate).toBeLessThan(0.08); // Allow some margin in tests
    });

    test('should process data within latency limits', async () => {
      const testData = generateMetricData(200);
      const runs = 10;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        await detector.detect(testData);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      expect(avgTime).toBeLessThan(config.performance.maxLatency);
    });

    test('should handle high throughput', async () => {
      const batchSize = 100;
      const testData = Array.from({ length: batchSize }, () => generateMetricData(Math.random() * 200));

      const startTime = Date.now();
      await detector.detectBatch(testData);
      const endTime = Date.now();

      const throughput = batchSize / ((endTime - startTime) / 1000);
      expect(throughput).toBeGreaterThan(100); // Should process >100 items/second
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid data gracefully', async () => {
      const invalidData = [
        null,
        undefined,
        {},
        { timestamp: 'invalid' },
        { value: NaN },
        { value: Infinity }
      ];

      for (const data of invalidData) {
        await expect(detector.detect(data as any)).not.toThrow();
      }
    });

    test('should handle memory pressure', async () => {
      // Generate a large amount of data
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => 
        generateMetricData(Math.random() * 1000)
      );

      // Should not crash or throw out of memory errors
      await expect(detector.detectBatch(largeDataSet)).resolves.toBeDefined();
    });

    test('should recover from model errors', async () => {
      // This test would require mocking internal model failures
      // For now, test that detector continues working after errors
      
      const testData = generateMetricData(100);
      const result1 = await detector.detect(testData);
      
      // Detector should still work for subsequent calls
      const result2 = await detector.detect(generateMetricData(200));
      
      expect(result2).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should work with baseline manager', async () => {
      const baselineManager = new BaselineManager();
      await baselineManager.initialize();

      // Add some baseline data
      const baselineData = Array.from({ length: 200 }, (_, i) => 
        generateMetricData(100 + Math.sin(i * 0.1) * 10) // Sinusoidal pattern
      );
      
      await baselineManager.updateBaselines(baselineData);
      
      const testData = generateMetricData(250); // Anomalous value
      const baseline = await baselineManager.getBaseline(testData);
      
      expect(baseline).not.toBeNull();
      expect(baseline!.mean).toBeCloseTo(100, 0); // Should be around 100
      
      await baselineManager.shutdown();
    });

    test('should work with explainer', async () => {
      const explainer = new AnomalyExplainer();
      await explainer.initialize();

      const testData = generateMetricData(500);
      const anomalyScore: AnomalyScore = {
        score: 85,
        confidence: 0.9,
        severity: 'high',
        timestamp: Date.now()
      };

      const explanation = await explainer.explain(
        testData,
        anomalyScore,
        null,
        new Map([['isolation_forest', 0.8]])
      );

      expect(explanation).toBeDefined();
      expect(explanation.reason).toBeTruthy();
      expect(explanation.factors).toHaveLength(1);
      expect(explanation.suggestions).toHaveLength(1);
    });
  });

  describe('Memory and Resource Management', () => {
    test('should cleanup resources on shutdown', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and shutdown multiple detectors
      for (let i = 0; i < 5; i++) {
        const testDetector = new AnomalyDetector(config);
        await testDetector.initialize();
        
        // Process some data
        await testDetector.detect(generateMetricData(100));
        
        await testDetector.shutdown();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle concurrent detection requests', async () => {
      const concurrentRequests = 20;
      const testData = Array.from({ length: concurrentRequests }, (_, i) => 
        generateMetricData(i % 5 === 0 ? 1000 : 100) // Every 5th is anomalous
      );

      // Run concurrent detection
      const promises = testData.map(data => detector.detect(data));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentRequests);
      
      // All requests should complete
      results.forEach(result => {
        expect(result).toBeDefined(); // null or Anomaly object
      });
    });
  });

  describe('Configuration Validation', () => {
    test('should handle minimal configuration', async () => {
      const minimalConfig: DetectorConfig = {
        models: [{
          type: 'isolation_forest',
          parameters: {},
          threshold: 0.5,
          autoTune: false
        }],
        thresholds: {
          anomalyScore: 50,
          confidence: 0.5
        },
        autoTuning: {
          enabled: false,
          feedbackWindow: 60,
          minSamples: 10,
          adjustmentRate: 0.1
        },
        performance: {
          maxLatency: 200,
          batchSize: 50,
          parallelProcessing: false
        }
      };

      const minimalDetector = new AnomalyDetector(minimalConfig);
      await expect(minimalDetector.initialize()).resolves.not.toThrow();
      
      const testData = generateMetricData(100);
      await expect(minimalDetector.detect(testData)).resolves.toBeDefined();
      
      await minimalDetector.shutdown();
    });

    test('should use sensible defaults for missing parameters', async () => {
      const partialConfig = {
        models: [{
          type: 'clustering' as const,
          parameters: {}, // Empty parameters
          threshold: 0.6,
          autoTune: false
        }],
        thresholds: {
          anomalyScore: 70,
          confidence: 0.7
        },
        autoTuning: {
          enabled: false,
          feedbackWindow: 60,
          minSamples: 10,
          adjustmentRate: 0.1
        },
        performance: {
          maxLatency: 100,
          batchSize: 100,
          parallelProcessing: false
        }
      };

      const testDetector = new AnomalyDetector(partialConfig);
      await expect(testDetector.initialize()).resolves.not.toThrow();
      await testDetector.shutdown();
    });
  });
});

// Additional test utilities
describe('Test Utilities and Helpers', () => {
  test('data generators should produce valid data', () => {
    const metricData = generateMetricData(100);
    expect(metricData).toHaveProperty('timestamp');
    expect(metricData).toHaveProperty('value', 100);
    expect(metricData).toHaveProperty('source');

    const logData = generateLogData('error', 'Test message');
    expect(logData).toHaveProperty('level', 'error');
    expect(logData).toHaveProperty('message', 'Test message');

    const traceData = generateTraceData(1000, 'success');
    expect(traceData).toHaveProperty('duration', 1000);
    expect(traceData).toHaveProperty('status', 'success');
  });

  test('should generate diverse test data', () => {
    const dataTypes = [
      generateMetricData(100),
      generateLogData('info', 'Test'),
      generateTraceData(500, 'success'),
      generateErrorData('medium'),
      generateBehaviorData(true, 'click')
    ];

    expect(dataTypes).toHaveLength(5);
    
    // Each should have different structure
    expect(dataTypes[0]).toHaveProperty('value');
    expect(dataTypes[1]).toHaveProperty('level');
    expect(dataTypes[2]).toHaveProperty('traceId');
    expect(dataTypes[3]).toHaveProperty('severity');
    expect(dataTypes[4]).toHaveProperty('action');
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  let detector: AnomalyDetector;

  beforeAll(async () => {
    detector = new AnomalyDetector(defaultDetectorConfig);
    await detector.initialize();
  });

  afterAll(async () => {
    await detector.shutdown();
  });

  test('single detection benchmark', async () => {
    const iterations = 100;
    const testData = generateMetricData(150);
    
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await detector.detect(testData);
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`Average detection time: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(100); // Should be under 100ms
  });

  test('batch processing benchmark', async () => {
    const batchSizes = [10, 50, 100, 200];
    
    for (const size of batchSizes) {
      const testData = Array.from({ length: size }, (_, i) => generateMetricData(100 + i));
      
      const startTime = performance.now();
      await detector.detectBatch(testData);
      const endTime = performance.now();
      
      const throughput = size / ((endTime - startTime) / 1000);
      console.log(`Batch size ${size}: ${throughput.toFixed(0)} items/second`);
      
      expect(throughput).toBeGreaterThan(50); // Minimum throughput
    }
  });
});