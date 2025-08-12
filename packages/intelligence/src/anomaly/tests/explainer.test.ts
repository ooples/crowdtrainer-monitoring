/**
 * Test Suite for Anomaly Explainer
 */

import { AnomalyExplainer } from '../explainer';
import { MonitoringData, AnomalyScore, BaselineData } from '../../types';

describe('AnomalyExplainer', () => {
  let explainer: AnomalyExplainer;

  beforeEach(async () => {
    explainer = new AnomalyExplainer();
    await explainer.initialize();
  });

  const createTestData = (type: 'metric' | 'log' | 'trace' | 'error' | 'behavior', overrides?: any): MonitoringData => {
    const baseData = {
      timestamp: Date.now(),
      source: 'test-service',
      tags: { environment: 'test' },
      metadata: {}
    };

    switch (type) {
      case 'metric':
        return { ...baseData, value: 100, ...overrides };
      case 'log':
        return { ...baseData, level: 'error' as const, message: 'Test error', ...overrides };
      case 'trace':
        return { 
          ...baseData, 
          traceId: 'trace-123', 
          spanId: 'span-456',
          operation: 'database.query',
          duration: 1000,
          status: 'success' as const,
          ...overrides 
        };
      case 'error':
        return { 
          ...baseData, 
          type: 'TypeError',
          message: 'Test error',
          severity: 'high' as const,
          ...overrides 
        };
      case 'behavior':
        return { 
          ...baseData,
          userId: 'user-123',
          sessionId: 'session-456',
          action: 'login',
          page: 'dashboard',
          success: false,
          ...overrides 
        };
    }
  };

  const createAnomalyScore = (score: number = 85): AnomalyScore => ({
    score,
    confidence: 0.9,
    severity: score > 80 ? 'high' : 'medium',
    timestamp: Date.now()
  });

  const createBaseline = (): BaselineData => ({
    mean: 100,
    stdDev: 20,
    min: 50,
    max: 150,
    percentiles: {
      p10: 70,
      p25: 85,
      p50: 100,
      p75: 115,
      p90: 130,
      p95: 140,
      p99: 145
    },
    seasonalPatterns: [{
      period: 'hourly',
      pattern: Array.from({ length: 24 }, (_, i) => 100 + Math.sin(i / 24 * 2 * Math.PI) * 10),
      strength: 0.7
    }],
    trendData: {
      slope: 0.1,
      intercept: 95,
      correlation: 0.8,
      direction: 'increasing'
    },
    lastUpdated: Date.now(),
    sampleSize: 1000
  });

  test('should initialize successfully', async () => {
    const newExplainer = new AnomalyExplainer();
    await expect(newExplainer.initialize()).resolves.not.toThrow();
  });

  test('should generate explanation for metric anomaly', async () => {
    const testData = createTestData('metric', { value: 300 });
    const anomalyScore = createAnomalyScore(90);
    const baseline = createBaseline();
    const modelScores = new Map([['isolation_forest', 0.85], ['clustering', 0.80]]);

    const explanation = await explainer.explain(testData, anomalyScore, baseline, modelScores);

    expect(explanation).toBeDefined();
    expect(explanation.reason).toBeTruthy();
    expect(explanation.factors).toHaveLength(1);
    expect(explanation.factors[0].name).toBeTruthy();
    expect(explanation.factors[0].impact).toBeGreaterThan(0);
    expect(explanation.suggestions).toHaveLength(1);
  });

  test('should generate explanation for log anomaly', async () => {
    const testData = createTestData('log', { level: 'critical', message: 'System failure' });
    const anomalyScore = createAnomalyScore(95);
    const modelScores = new Map([['statistical', 0.9]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    expect(explanation.reason).toContain('CRITICAL');
    expect(explanation.factors.some(f => f.name === 'High Severity Log')).toBe(true);
  });

  test('should generate explanation for trace anomaly', async () => {
    const testData = createTestData('trace', { duration: 10000, status: 'timeout' });
    const anomalyScore = createAnomalyScore(88);
    const modelScores = new Map([['lstm', 0.82]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    expect(explanation.factors.some(f => f.name === 'High Latency' || f.name === 'Failed Operation')).toBe(true);
  });

  test('should generate explanation for error anomaly', async () => {
    const testData = createTestData('error', { severity: 'critical', type: 'SystemError' });
    const anomalyScore = createAnomalyScore(92);
    const modelScores = new Map([['ensemble', 0.88]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    expect(explanation.factors.some(f => f.name === 'Error Severity')).toBe(true);
    expect(explanation.reason).toContain('CRITICAL');
  });

  test('should generate explanation for behavior anomaly', async () => {
    const testData = createTestData('behavior', { success: false, action: 'payment' });
    const anomalyScore = createAnomalyScore(80);
    const modelScores = new Map([['clustering', 0.75]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    expect(explanation.factors.some(f => f.name === 'Failed User Action')).toBe(true);
  });

  test('should analyze statistical deviation factors', async () => {
    const testData = createTestData('metric', { value: 250 }); // Well outside normal range
    const anomalyScore = createAnomalyScore(95);
    const baseline = createBaseline(); // mean: 100, stdDev: 20
    const modelScores = new Map([['isolation_forest', 0.9]]);

    const explanation = await explainer.explain(testData, anomalyScore, baseline, modelScores);

    const statFactor = explanation.factors.find(f => f.name === 'Statistical Deviation');
    expect(statFactor).toBeDefined();
    expect(statFactor!.impact).toBeGreaterThan(0.8); // Should be high impact for 7.5 std devs
  });

  test('should analyze temporal patterns', async () => {
    const now = new Date();
    now.setHours(3); // 3 AM - unusual hour
    
    const testData = createTestData('metric', { 
      value: 120,
      timestamp: now.getTime()
    });
    
    const anomalyScore = createAnomalyScore(75);
    const baseline = createBaseline();
    const modelScores = new Map([['lstm', 0.7]]);

    const explanation = await explainer.explain(testData, anomalyScore, baseline, modelScores);

    const temporalFactor = explanation.factors.find(f => f.name === 'Temporal Pattern');
    expect(temporalFactor).toBeDefined();
    expect(temporalFactor!.impact).toBeGreaterThan(0.2);
  });

  test('should analyze model consensus', async () => {
    const testData = createTestData('metric', { value: 180 });
    const anomalyScore = createAnomalyScore(85);
    
    // High consensus models
    const highConsensusScores = new Map([
      ['isolation_forest', 0.85],
      ['lstm', 0.83],
      ['clustering', 0.87]
    ]);

    const explanation = await explainer.explain(testData, anomalyScore, null, highConsensusScores);
    const consensusFactor = explanation.factors.find(f => f.name === 'Model Consensus');
    
    expect(consensusFactor).toBeDefined();
    expect(consensusFactor!.impact).toBeGreaterThan(0.6);
  });

  test('should generate contextual factors', async () => {
    const testData = createTestData('metric', { 
      value: 150,
      tags: { 
        status: 'error',
        alert: 'critical',
        environment: 'production' 
      }
    });
    
    const anomalyScore = createAnomalyScore(80);
    const modelScores = new Map([['statistical', 0.75]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    const contextFactor = explanation.factors.find(f => f.name === 'Context Indicators');
    expect(contextFactor).toBeDefined();
    expect(contextFactor!.impact).toBeGreaterThan(0.2);
  });

  test('should generate appropriate suggestions based on factors', async () => {
    const testData = createTestData('trace', { 
      duration: 15000, // Very high latency
      status: 'timeout'
    });
    
    const anomalyScore = createAnomalyScore(90);
    const modelScores = new Map([['lstm', 0.85]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    expect(explanation.suggestions).toContain('Investigate database and network performance');
    expect(explanation.suggestions.length).toBeGreaterThan(0);
    expect(explanation.suggestions.length).toBeLessThanOrEqual(5);
  });

  test('should provide detailed explanation with visual data', async () => {
    const testData = createTestData('metric', { value: 300 });
    const anomalyScore = createAnomalyScore(88);
    const baseline = createBaseline();
    const modelScores = new Map([['ensemble', 0.82]]);
    
    const historicalData = Array.from({ length: 50 }, (_, i) => 
      createTestData('metric', { value: 100 + Math.random() * 20, timestamp: Date.now() - i * 60000 })
    );

    const detailed = await explainer.explainDetailed(
      testData, 
      anomalyScore, 
      baseline, 
      modelScores, 
      historicalData
    );

    expect(detailed.explanation).toBeDefined();
    expect(detailed.visualData).toHaveLength(2); // Time series + distribution
    expect(detailed.confidence).toBeGreaterThan(0);
    expect(detailed.confidence).toBeLessThanOrEqual(1);
    expect(detailed.alternativeExplanations).toHaveLength(3);
  });

  test('should handle missing baseline gracefully', async () => {
    const testData = createTestData('metric', { value: 200 });
    const anomalyScore = createAnomalyScore(75);
    const modelScores = new Map([['isolation_forest', 0.7]]);

    const explanation = await explainer.explain(testData, anomalyScore, null, modelScores);

    expect(explanation).toBeDefined();
    expect(explanation.reason).toBeTruthy();
    expect(explanation.factors.length).toBeGreaterThan(0);
  });

  test('should handle empty model scores', async () => {
    const testData = createTestData('metric', { value: 150 });
    const anomalyScore = createAnomalyScore(60);
    const baseline = createBaseline();
    const emptyScores = new Map();

    const explanation = await explainer.explain(testData, anomalyScore, baseline, emptyScores);

    expect(explanation).toBeDefined();
    expect(explanation.reason).toBeTruthy();
  });

  test('should provide fallback explanation on error', async () => {
    // Test with invalid data that might cause internal errors
    const invalidData = { invalid: true } as any;
    const anomalyScore = createAnomalyScore(80);
    const modelScores = new Map([['test', 0.8]]);

    const explanation = await explainer.explain(invalidData, anomalyScore, null, modelScores);

    expect(explanation).toBeDefined();
    expect(explanation.reason).toContain('Anomaly detected');
    expect(explanation.factors).toHaveLength(1);
    expect(explanation.factors[0].name).toBe('Statistical Deviation');
  });

  test('should calculate explanation confidence correctly', async () => {
    const testData = createTestData('metric', { value: 200 });
    const highConfidenceScore: AnomalyScore = {
      score: 90,
      confidence: 0.95,
      severity: 'high',
      timestamp: Date.now()
    };
    
    const goodBaseline = createBaseline();
    goodBaseline.sampleSize = 2000; // Large sample size
    
    const modelScores = new Map([
      ['isolation_forest', 0.88],
      ['lstm', 0.85],
      ['clustering', 0.87]
    ]);

    const detailed = await explainer.explainDetailed(
      testData,
      highConfidenceScore,
      goodBaseline,
      modelScores
    );

    expect(detailed.confidence).toBeGreaterThan(0.7);
  });

  test('should limit factor count and sort by impact', async () => {
    const testData = createTestData('error', {
      severity: 'critical',
      type: 'SystemFailure',
      tags: {
        error: 'critical',
        alert: 'high',
        status: 'failure',
        priority: 'urgent'
      }
    });
    
    const anomalyScore = createAnomalyScore(95);
    const baseline = createBaseline();
    const modelScores = new Map([['ensemble', 0.9]]);

    const explanation = await explainer.explain(testData, anomalyScore, baseline, modelScores);

    expect(explanation.factors.length).toBeLessThanOrEqual(5);
    
    // Check that factors are sorted by impact (descending)
    for (let i = 1; i < explanation.factors.length; i++) {
      expect(explanation.factors[i-1].impact).toBeGreaterThanOrEqual(explanation.factors[i].impact);
    }
  });

  test('should generate different explanations for different severities', async () => {
    const testData = createTestData('metric', { value: 180 });
    const modelScores = new Map([['isolation_forest', 0.8]]);

    const lowScore = createAnomalyScore(55);
    lowScore.severity = 'low';
    
    const highScore = createAnomalyScore(95);
    highScore.severity = 'critical';

    const lowExplanation = await explainer.explain(testData, lowScore, null, modelScores);
    const highExplanation = await explainer.explain(testData, highScore, null, modelScores);

    expect(lowExplanation.reason).toContain('LOW');
    expect(highExplanation.reason).toContain('CRITICAL');
    expect(highExplanation.suggestions).toContain('Immediate investigation required');
  });
});