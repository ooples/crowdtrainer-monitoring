import { FailurePredictionModel } from '../models/failure';
import { TrafficForecastingEngine } from '../forecasting/traffic';
import { BudgetPredictor } from '../budgets/prediction';
import { ChurnAnalyzer } from '../churn/analysis';
import { PerformanceDegradationDetector } from '../degradation/detector';
import { TrendAnalyzer } from '../trends/analyzer';
import { WhatIfSimulator } from '../simulation/whatif';
import {
  FailurePredictionInput,
  TrafficForecastInput,
  BudgetPredictionInput,
  ChurnAnalysisInput,
  PerformanceDegradationInput,
  TrendAnalysisInput,
  WhatIfScenarioInput
} from '../types';

describe('Predictive Analytics Package', () => {
  describe('FailurePredictionModel', () => {
    let model: FailurePredictionModel;

    beforeEach(() => {
      model = new FailurePredictionModel('test-failure-model');
    });

    it('should create a model with correct properties', () => {
      expect(model.id).toBe('test-failure-model');
      expect(model.type).toBe('failure_prediction');
      expect(model.version).toBe('1.0.0');
      expect(model.accuracy).toBe(0);
    });

    it('should train successfully with sufficient data', async () => {
      const trainingData = generateFailureTrainingData(150);
      
      await expect(model.train(trainingData)).resolves.not.toThrow();
      expect(model.updatedAt.getTime()).toBeGreaterThan(model.createdAt.getTime());
    });

    it('should reject training with insufficient data', async () => {
      const trainingData = generateFailureTrainingData(50);
      
      await expect(model.train(trainingData)).rejects.toThrow('Insufficient training data');
    });

    it('should make predictions after training', async () => {
      const trainingData = generateFailureTrainingData(150);
      await model.train(trainingData);

      const input: FailurePredictionInput = {
        systemMetrics: {
          cpuUsage: 85,
          memoryUsage: 78,
          diskUsage: 45,
          networkLatency: 150,
          errorRate: 0.08,
          requestRate: 1200
        },
        historicalPatterns: {
          timeOfDay: 14,
          dayOfWeek: 3,
          recentFailures: 2,
          maintenanceScheduled: false
        },
        externalFactors: {
          deploymentRecent: true,
          highTrafficPeriod: true,
          dependencyIssues: 1
        }
      };

      const prediction = await model.predict(input);
      
      expect(prediction).toHaveProperty('probability');
      expect(prediction).toHaveProperty('riskLevel');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('factors');
      expect(prediction).toHaveProperty('recommendations');
      
      expect(prediction.probability).toBeGreaterThanOrEqual(0);
      expect(prediction.probability).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high', 'critical']).toContain(prediction.riskLevel);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.1);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(prediction.factors)).toBe(true);
      expect(Array.isArray(prediction.recommendations)).toBe(true);
    });

    it('should evaluate model performance', async () => {
      const trainingData = generateFailureTrainingData(150);
      await model.train(trainingData);

      const testData = generateFailureTestData(30);
      const metrics = await model.evaluate(testData);

      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('f1Score');
      expect(metrics).toHaveProperty('rmse');
      
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
    });

    it('should serialize and deserialize correctly', async () => {
      const trainingData = generateFailureTrainingData(150);
      await model.train(trainingData);

      const serialized = model.serialize();
      expect(typeof serialized).toBe('string');

      const newModel = new FailurePredictionModel();
      newModel.deserialize(serialized);

      expect(newModel.version).toBe(model.version);
      expect(newModel.accuracy).toBe(model.accuracy);
    });
  });

  describe('TrafficForecastingEngine', () => {
    let engine: TrafficForecastingEngine;

    beforeEach(() => {
      engine = new TrafficForecastingEngine();
    });

    it('should generate traffic forecast', async () => {
      const input: TrafficForecastInput = {
        historicalData: generateTrafficHistoricalData(100),
        seasonality: {
          hourly: Array.from({ length: 24 }, (_, i) => Math.sin(i * Math.PI / 12) + 1),
          daily: Array.from({ length: 7 }, (_, i) => Math.cos(i * Math.PI / 3.5) + 1),
          weekly: Array.from({ length: 52 }, (_, i) => Math.sin(i * Math.PI / 26) + 1)
        },
        externalEvents: {
          holidays: [new Date('2024-12-25'), new Date('2024-01-01')],
          promotions: [{
            start: new Date('2024-11-24'),
            end: new Date('2024-11-30'),
            impact: 0.5
          }],
          deployments: [new Date('2024-11-15')]
        }
      };

      const forecast = await engine.generateForecast(input);

      expect(forecast).toHaveProperty('predictions');
      expect(forecast).toHaveProperty('seasonalityDetected');
      expect(forecast).toHaveProperty('recommendations');
      
      expect(Array.isArray(forecast.predictions)).toBe(true);
      expect(forecast.predictions.length).toBeGreaterThan(0);
      
      if (forecast.predictions.length > 0) {
        const prediction = forecast.predictions[0];
        expect(prediction).toHaveProperty('timestamp');
        expect(prediction).toHaveProperty('expectedRequests');
        expect(prediction).toHaveProperty('confidenceInterval');
        expect(prediction).toHaveProperty('resourceNeeds');
      }
    });

    it('should detect seasonality patterns', async () => {
      const input: TrafficForecastInput = {
        historicalData: generateSeasonalTrafficData(200),
        seasonality: {
          hourly: Array.from({ length: 24 }, (_, i) => Math.sin(i * Math.PI / 12) * 2 + 3),
          daily: Array.from({ length: 7 }, () => 1),
          weekly: Array.from({ length: 52 }, () => 1)
        },
        externalEvents: { holidays: [], promotions: [], deployments: [] }
      };

      const forecast = await engine.generateForecast(input);
      
      expect(forecast.seasonalityDetected.length).toBeGreaterThan(0);
      const seasonality = forecast.seasonalityDetected[0];
      expect(seasonality).toHaveProperty('pattern');
      expect(seasonality).toHaveProperty('strength');
      expect(seasonality).toHaveProperty('period');
    });

    it('should reject insufficient data', async () => {
      const input: TrafficForecastInput = {
        historicalData: generateTrafficHistoricalData(10), // Too few data points
        seasonality: { hourly: [], daily: [], weekly: [] },
        externalEvents: { holidays: [], promotions: [], deployments: [] }
      };

      await expect(engine.generateForecast(input)).rejects.toThrow('Insufficient historical data');
    });
  });

  describe('BudgetPredictor', () => {
    let predictor: BudgetPredictor;

    beforeEach(() => {
      predictor = new BudgetPredictor();
    });

    it('should predict budget successfully', async () => {
      const input: BudgetPredictionInput = {
        currentUsage: {
          compute: 5000,
          storage: 1200,
          bandwidth: 800,
          database: 2000,
          thirdParty: 500
        },
        historicalSpend: generateBudgetHistoricalData(60),
        growthMetrics: {
          userGrowthRate: 0.15,
          trafficGrowthRate: 0.20,
          featureGrowthRate: 0.10
        },
        budgetConstraints: {
          total: 15000,
          categories: {
            compute: 8000,
            storage: 2000,
            bandwidth: 1500
          },
          alertThresholds: [0.8, 0.9, 0.95]
        }
      };

      const prediction = await predictor.predictBudget(input);

      expect(prediction).toHaveProperty('projectedSpend');
      expect(prediction).toHaveProperty('budgetAlerts');
      expect(prediction).toHaveProperty('optimizationOpportunities');
      expect(prediction).toHaveProperty('recommendations');
      
      expect(Array.isArray(prediction.projectedSpend)).toBe(true);
      expect(Array.isArray(prediction.budgetAlerts)).toBe(true);
      expect(Array.isArray(prediction.optimizationOpportunities)).toBe(true);
      expect(Array.isArray(prediction.recommendations)).toBe(true);

      if (prediction.projectedSpend.length > 0) {
        const spend = prediction.projectedSpend[0];
        expect(spend).toHaveProperty('date');
        expect(spend).toHaveProperty('amount');
        expect(spend).toHaveProperty('breakdown');
        expect(spend).toHaveProperty('confidence');
      }
    });

    it('should generate budget alerts', async () => {
      const input: BudgetPredictionInput = {
        currentUsage: {
          compute: 7500, // High usage that will trigger alerts
          storage: 1800,
          bandwidth: 1200,
          database: 2500,
          thirdParty: 800
        },
        historicalSpend: generateBudgetHistoricalData(45),
        growthMetrics: {
          userGrowthRate: 0.25,
          trafficGrowthRate: 0.30,
          featureGrowthRate: 0.15
        },
        budgetConstraints: {
          total: 15000,
          categories: {
            compute: 8000,
            storage: 2000
          },
          alertThresholds: [0.7, 0.8, 0.9]
        }
      };

      const prediction = await predictor.predictBudget(input);
      
      expect(prediction.budgetAlerts.length).toBeGreaterThan(0);
      
      const alert = prediction.budgetAlerts[0];
      expect(alert).toHaveProperty('threshold');
      expect(alert).toHaveProperty('estimatedDate');
      expect(alert).toHaveProperty('category');
      expect(alert).toHaveProperty('severity');
      expect(['warning', 'critical']).toContain(alert.severity);
    });
  });

  describe('ChurnAnalyzer', () => {
    let analyzer: ChurnAnalyzer;

    beforeEach(() => {
      analyzer = new ChurnAnalyzer();
    });

    it('should analyze churn successfully', async () => {
      const input: ChurnAnalysisInput = {
        userMetrics: generateUserMetrics(100),
        engagementPatterns: generateEngagementPatterns(100),
        cohortData: generateCohortData(6)
      };

      const analysis = await analyzer.analyzeChurn(input);

      expect(analysis).toHaveProperty('userRiskScores');
      expect(analysis).toHaveProperty('cohortInsights');
      expect(analysis).toHaveProperty('globalMetrics');
      expect(analysis).toHaveProperty('interventionStrategies');
      
      expect(Array.isArray(analysis.userRiskScores)).toBe(true);
      expect(analysis.userRiskScores.length).toBe(100);
      
      if (analysis.userRiskScores.length > 0) {
        const userRisk = analysis.userRiskScores[0];
        expect(userRisk).toHaveProperty('userId');
        expect(userRisk).toHaveProperty('churnProbability');
        expect(userRisk).toHaveProperty('riskLevel');
        expect(userRisk).toHaveProperty('keyFactors');
        expect(userRisk).toHaveProperty('recommendedActions');
        
        expect(['low', 'medium', 'high']).toContain(userRisk.riskLevel);
        expect(userRisk.churnProbability).toBeGreaterThanOrEqual(0);
        expect(userRisk.churnProbability).toBeLessThanOrEqual(1);
      }
    });

    it('should identify high-risk users', async () => {
      const input: ChurnAnalysisInput = {
        userMetrics: generateHighRiskUserMetrics(50),
        engagementPatterns: generateLowEngagementPatterns(50),
        cohortData: generateCohortData(3)
      };

      const analysis = await analyzer.analyzeChurn(input);
      
      const highRiskUsers = analysis.userRiskScores.filter(u => u.riskLevel === 'high');
      expect(highRiskUsers.length).toBeGreaterThan(0);
      
      const highRiskUser = highRiskUsers[0];
      expect(highRiskUser.churnProbability).toBeGreaterThan(0.6);
      expect(highRiskUser.keyFactors.length).toBeGreaterThan(0);
      expect(highRiskUser.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should validate input data', async () => {
      const invalidInput: ChurnAnalysisInput = {
        userMetrics: [],
        engagementPatterns: [],
        cohortData: []
      };

      await expect(analyzer.analyzeChurn(invalidInput)).rejects.toThrow('User metrics data is required');
    });
  });

  describe('PerformanceDegradationDetector', () => {
    let detector: PerformanceDegradationDetector;

    beforeEach(() => {
      detector = new PerformanceDegradationDetector();
    });

    it('should detect performance degradation', async () => {
      const input: PerformanceDegradationInput = {
        metrics: generatePerformanceMetrics(48, true), // Include degradation
        baselines: {
          responseTime: 100,
          throughput: 1000,
          errorRate: 0.01
        },
        thresholds: {
          responseTimeDegradation: 0.2,
          throughputDegradation: 0.15,
          errorRateIncrease: 0.02
        }
      };

      const result = await detector.detectDegradation(input);

      expect(result).toHaveProperty('degradationScore');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('affectedMetrics');
      expect(result).toHaveProperty('rootCauses');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.degradationScore).toBeGreaterThanOrEqual(0);
      expect(result.degradationScore).toBeLessThanOrEqual(1);
      expect(['improving', 'stable', 'degrading']).toContain(result.trend);
      
      expect(Array.isArray(result.affectedMetrics)).toBe(true);
      expect(Array.isArray(result.rootCauses)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should detect stable performance', async () => {
      const input: PerformanceDegradationInput = {
        metrics: generatePerformanceMetrics(48, false), // No degradation
        baselines: {
          responseTime: 100,
          throughput: 1000,
          errorRate: 0.01
        },
        thresholds: {
          responseTimeDegradation: 0.2,
          throughputDegradation: 0.15,
          errorRateIncrease: 0.02
        }
      };

      const result = await detector.detectDegradation(input);
      
      expect(result.degradationScore).toBeLessThan(0.3);
      expect(result.trend).toBe('stable');
      expect(result.affectedMetrics.length).toBe(0);
    });

    it('should require sufficient data', async () => {
      const input: PerformanceDegradationInput = {
        metrics: generatePerformanceMetrics(10), // Too few data points
        baselines: { responseTime: 100, throughput: 1000, errorRate: 0.01 },
        thresholds: { responseTimeDegradation: 0.2, throughputDegradation: 0.15, errorRateIncrease: 0.02 }
      };

      await expect(detector.detectDegradation(input)).rejects.toThrow('Need at least 24 hours');
    });
  });

  describe('TrendAnalyzer', () => {
    let analyzer: TrendAnalyzer;

    beforeEach(() => {
      analyzer = new TrendAnalyzer();
    });

    it('should analyze trends successfully', async () => {
      const input: TrendAnalysisInput = {
        timeSeries: generateTimeSeriesData(100),
        analysisParams: {
          trendDetectionSensitivity: 0.5,
          seasonalityDetection: true,
          anomalyDetection: true,
          forecastHorizon: 30
        }
      };

      const result = await analyzer.analyzeTrends(input);

      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('seasonality');
      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('insights');
      
      expect(Array.isArray(result.trends)).toBe(true);
      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(Array.isArray(result.forecast)).toBe(true);
      
      expect(result.seasonality).toHaveProperty('detected');
      expect(result.insights).toHaveProperty('summary');
      expect(result.insights).toHaveProperty('keyFindings');
      expect(result.insights).toHaveProperty('recommendations');
    });

    it('should detect linear trends', async () => {
      const input: TrendAnalysisInput = {
        timeSeries: generateLinearTrendData(50),
        analysisParams: {
          trendDetectionSensitivity: 0.3,
          seasonalityDetection: false,
          anomalyDetection: false,
          forecastHorizon: 10
        }
      };

      const result = await analyzer.analyzeTrends(input);
      
      expect(result.trends.length).toBeGreaterThan(0);
      const trend = result.trends[0];
      expect(trend.type).toBe('linear');
      expect(['increasing', 'decreasing', 'stable']).toContain(trend.direction);
      expect(trend.strength).toBeGreaterThanOrEqual(0);
    });

    it('should generate forecasts', async () => {
      const input: TrendAnalysisInput = {
        timeSeries: generateTimeSeriesData(60),
        analysisParams: {
          trendDetectionSensitivity: 0.4,
          seasonalityDetection: false,
          anomalyDetection: false,
          forecastHorizon: 20
        }
      };

      const result = await analyzer.analyzeTrends(input);
      
      expect(result.forecast.length).toBe(20);
      
      if (result.forecast.length > 0) {
        const forecast = result.forecast[0];
        expect(forecast).toHaveProperty('timestamp');
        expect(forecast).toHaveProperty('predictedValue');
        expect(forecast).toHaveProperty('confidenceInterval');
        expect(forecast.confidenceInterval).toHaveProperty('lower');
        expect(forecast.confidenceInterval).toHaveProperty('upper');
      }
    });
  });

  describe('WhatIfSimulator', () => {
    let simulator: WhatIfSimulator;

    beforeEach(() => {
      simulator = new WhatIfSimulator();
    });

    it('should run scenarios successfully', async () => {
      const input: WhatIfScenarioInput = {
        baselineMetrics: {
          cpu_usage: 50,
          memory_usage: 45,
          response_time: 100,
          request_rate: 1000,
          user_count: 10000,
          infrastructure_cost: 5000
        },
        scenarios: [
          {
            id: 'scale_up',
            name: 'Scale Up Infrastructure',
            changes: [
              { parameter: 'cpu_usage', value: 30, type: 'absolute' },
              { parameter: 'memory_usage', value: 35, type: 'absolute' },
              { parameter: 'response_time', value: -20, type: 'percentage' },
              { parameter: 'infrastructure_cost', value: 50, type: 'percentage' }
            ],
            duration: 30
          },
          {
            id: 'user_growth',
            name: 'User Growth Scenario',
            changes: [
              { parameter: 'user_count', value: 2, type: 'multiplier' },
              { parameter: 'request_rate', value: 80, type: 'percentage' }
            ]
          }
        ],
        constraints: [
          { parameter: 'cpu_usage', max: 80 },
          { parameter: 'response_time', max: 200 },
          { parameter: 'infrastructure_cost', max: 10000 }
        ]
      };

      const result = await simulator.runScenarios(input);

      expect(result).toHaveProperty('scenarios');
      expect(result).toHaveProperty('comparisons');
      
      expect(Array.isArray(result.scenarios)).toBe(true);
      expect(result.scenarios.length).toBe(2);
      
      if (result.scenarios.length > 0) {
        const scenario = result.scenarios[0];
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('projectedOutcome');
        expect(scenario).toHaveProperty('risks');
        expect(scenario).toHaveProperty('costs');
        expect(scenario).toHaveProperty('timeline');
      }
      
      expect(result.comparisons).toHaveProperty('scenarioIds');
      expect(result.comparisons).toHaveProperty('bestCase');
      expect(result.comparisons).toHaveProperty('worstCase');
      expect(result.comparisons).toHaveProperty('mostLikely');
      expect(result.comparisons).toHaveProperty('recommendations');
    });

    it('should assess risks correctly', async () => {
      const input: WhatIfScenarioInput = {
        baselineMetrics: {
          cpu_usage: 70,
          response_time: 150,
          error_rate: 0.02
        },
        scenarios: [{
          id: 'high_risk',
          name: 'High Risk Scenario',
          changes: [
            { parameter: 'cpu_usage', value: 95, type: 'absolute' }, // High CPU
            { parameter: 'response_time', value: 100, type: 'percentage' }, // Double response time
            { parameter: 'error_rate', value: 200, type: 'percentage' } // Triple error rate
          ]
        }],
        constraints: [
          { parameter: 'cpu_usage', max: 85 },
          { parameter: 'response_time', max: 200 }
        ]
      };

      const result = await simulator.runScenarios(input);
      
      expect(result.scenarios.length).toBe(1);
      const scenario = result.scenarios[0];
      
      expect(scenario.risks.length).toBeGreaterThan(0);
      const highRisks = scenario.risks.filter(r => r.impact === 'high');
      expect(highRisks.length).toBeGreaterThan(0);
    });

    it('should validate input properly', async () => {
      const invalidInput: WhatIfScenarioInput = {
        baselineMetrics: {},
        scenarios: [],
        constraints: []
      };

      await expect(simulator.runScenarios(invalidInput)).rejects.toThrow('Baseline metrics are required');
    });
  });

  // Helper functions for generating test data
  function generateFailureTrainingData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      features: [
        Math.random(), // CPU usage
        Math.random(), // Memory usage
        Math.random(), // Disk usage
        Math.random(), // Network latency
        Math.random() * 0.1, // Error rate
        Math.random() * 1000, // Request rate
        Math.sin(i * Math.PI / 12), // Time of day
        Math.cos(i * Math.PI / 12),
        Math.sin(i * Math.PI / 3.5), // Day of week
        Math.cos(i * Math.PI / 3.5),
        Math.floor(Math.random() * 5), // Recent failures
        Math.random() > 0.8 ? 1 : 0, // Maintenance
        Math.random() > 0.9 ? 1 : 0, // Deployment
        Math.random() > 0.7 ? 1 : 0, // High traffic
        Math.floor(Math.random() * 3), // Dependencies
        Math.random(), // Resource pressure
        Math.random() * 100, // Error load
        Math.random() * 3 // Overall usage
      ],
      label: Math.random() > 0.8 ? 1 : 0, // 20% failure rate
      timestamp: new Date(Date.now() - (count - i) * 60 * 60 * 1000)
    }));
  }

  function generateFailureTestData(count: number) {
    return Array.from({ length: count }, () => ({
      input: {
        systemMetrics: {
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 100,
          diskUsage: Math.random() * 100,
          networkLatency: Math.random() * 500,
          errorRate: Math.random() * 0.1,
          requestRate: Math.random() * 2000
        },
        historicalPatterns: {
          timeOfDay: Math.floor(Math.random() * 24),
          dayOfWeek: Math.floor(Math.random() * 7),
          recentFailures: Math.floor(Math.random() * 5),
          maintenanceScheduled: Math.random() > 0.8
        },
        externalFactors: {
          deploymentRecent: Math.random() > 0.9,
          highTrafficPeriod: Math.random() > 0.7,
          dependencyIssues: Math.floor(Math.random() * 3)
        }
      },
      expected: {
        probability: Math.random(),
        riskLevel: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        confidence: 0.7,
        factors: [],
        recommendations: []
      }
    }));
  }

  function generateTrafficHistoricalData(count: number) {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(now.getTime() - (count - i) * 60 * 60 * 1000),
      requestCount: Math.floor(Math.random() * 1000) + 500,
      uniqueUsers: Math.floor(Math.random() * 500) + 100,
      responseTime: Math.random() * 200 + 50,
      errorCount: Math.floor(Math.random() * 10)
    }));
  }

  function generateSeasonalTrafficData(count: number) {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
      const hour = i % 24;
      const seasonal = Math.sin(hour * Math.PI / 12) * 300 + 500;
      return {
        timestamp: new Date(now.getTime() - (count - i) * 60 * 60 * 1000),
        requestCount: Math.floor(seasonal + Math.random() * 100),
        uniqueUsers: Math.floor(seasonal * 0.3 + Math.random() * 50),
        responseTime: Math.random() * 100 + 50,
        errorCount: Math.floor(Math.random() * 5)
      };
    });
  }

  function generateBudgetHistoricalData(days: number) {
    const categories = ['compute', 'storage', 'bandwidth', 'database', 'thirdParty'];
    const data = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      for (const category of categories) {
        data.push({
          date,
          amount: Math.random() * 1000 + 100,
          category
        });
      }
    }
    
    return data;
  }

  function generateUserMetrics(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      userId: `user_${i}`,
      accountAge: Math.floor(Math.random() * 365) + 30,
      lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      sessionsLastWeek: Math.floor(Math.random() * 20),
      avgSessionDuration: Math.random() * 60 + 5,
      featuresUsed: Array.from({ length: Math.floor(Math.random() * 15) + 1 }, (_, j) => `feature_${j}`),
      supportTickets: Math.floor(Math.random() * 5),
      paymentIssues: Math.floor(Math.random() * 2)
    }));
  }

  function generateEngagementPatterns(count: number) {
    return Array.from({ length: count }, () => ({
      loginFrequency: Math.random() * 30,
      featureAdoption: Math.random(),
      socialInteractions: Math.floor(Math.random() * 100),
      contentCreated: Math.floor(Math.random() * 50)
    }));
  }

  function generateHighRiskUserMetrics(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      userId: `high_risk_user_${i}`,
      accountAge: Math.floor(Math.random() * 180) + 10, // Newer accounts
      lastActivity: new Date(Date.now() - (Math.random() * 14 + 7) * 24 * 60 * 60 * 1000), // 1-3 weeks ago
      sessionsLastWeek: Math.floor(Math.random() * 3), // Low sessions
      avgSessionDuration: Math.random() * 10 + 1, // Short sessions
      featuresUsed: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => `feature_${j}`), // Few features
      supportTickets: Math.floor(Math.random() * 8) + 2, // Many support tickets
      paymentIssues: Math.floor(Math.random() * 3) + 1 // Some payment issues
    }));
  }

  function generateLowEngagementPatterns(count: number) {
    return Array.from({ length: count }, () => ({
      loginFrequency: Math.random() * 5, // Low login frequency
      featureAdoption: Math.random() * 0.3, // Poor feature adoption
      socialInteractions: Math.floor(Math.random() * 10), // Few interactions
      contentCreated: Math.floor(Math.random() * 3) // Little content
    }));
  }

  function generateCohortData(months: number) {
    return Array.from({ length: months }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (months - i));
      return {
        cohortMonth: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        userCount: Math.floor(Math.random() * 1000) + 100,
        retentionRates: Array.from({ length: 12 }, (_, j) => Math.max(0, 1 - j * 0.1 - Math.random() * 0.2))
      };
    });
  }

  function generatePerformanceMetrics(count: number, includeDegradation = false) {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
      let responseTime = 100 + Math.random() * 50;
      let throughput = 1000 + Math.random() * 200;
      let errorRate = 0.01 + Math.random() * 0.02;
      
      if (includeDegradation && i > count / 2) {
        // Add degradation to second half
        const degradationFactor = (i - count / 2) / (count / 2);
        responseTime += degradationFactor * 100;
        throughput -= degradationFactor * 300;
        errorRate += degradationFactor * 0.05;
      }
      
      return {
        timestamp: new Date(now.getTime() - (count - i) * 60 * 60 * 1000),
        responseTime,
        throughput,
        errorRate,
        resourceUtilization: {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          disk: Math.random() * 100,
          network: Math.random() * 100
        }
      };
    });
  }

  function generateTimeSeriesData(count: number) {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(now.getTime() - (count - i) * 60 * 60 * 1000),
      value: Math.random() * 100 + 50 + Math.sin(i * 0.1) * 20,
      metadata: { index: i }
    }));
  }

  function generateLinearTrendData(count: number) {
    const now = new Date();
    const slope = 2; // Clear upward trend
    const intercept = 100;
    
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(now.getTime() - (count - i) * 60 * 60 * 1000),
      value: slope * i + intercept + Math.random() * 20 - 10, // Add some noise
      metadata: { index: i }
    }));
  }
});