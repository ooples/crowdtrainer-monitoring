import { Matrix } from 'ml-matrix';
import { MultivariateLinearRegression } from 'ml-regression';
import { standardDeviation, mean } from 'simple-statistics';

import {
  MLModel,
  ModelMetrics,
  FailurePredictionInput,
  FailurePredictionOutput
} from '../types';

interface FailureTrainingData {
  features: number[];
  label: number; // 0 = no failure, 1 = failure
  timestamp: Date;
  metadata?: {
    actualFailureTime?: Date;
    failureType?: string;
    recoveryTime?: number;
  };
}

export class FailurePredictionModel implements MLModel<FailurePredictionInput, FailurePredictionOutput> {
  public readonly id: string;
  public readonly type = 'failure_prediction';
  public version: string;
  public accuracy: number;
  public createdAt: Date;
  public updatedAt: Date;

  private model?: MultivariateLinearRegression;
  private featureScalers: { mean: number; std: number }[] = [];
  private thresholds = {
    low: 0.2,
    medium: 0.4,
    high: 0.7,
    critical: 0.85
  };
  private trainingData: FailureTrainingData[] = [];
  private readonly maxTrainingDataSize = 10000;
  private readonly minTrainingDataSize = 100;

  // Feature importance weights learned during training
  private featureWeights: Record<string, number> = {};
  private baselineMetrics: Record<string, number> = {};

  constructor(id?: string) {
    this.id = id || `failure_prediction_${Date.now()}`;
    this.version = '1.0.0';
    this.accuracy = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  async train(data: FailurePredictionInput[]): Promise<void> {
    // Convert input to training data format
    const trainingData: FailureTrainingData[] = data.map((input, _index) => ({
      features: this.extractFeatures(input),
      label: 0, // Default label - would need actual failure data in practice
      timestamp: new Date(),
      metadata: {}
    }));
    
    return this.trainWithTrainingData(trainingData);
  }

  async trainWithTrainingData(data: FailureTrainingData[]): Promise<void> {
    if (data.length < this.minTrainingDataSize) {
      throw new Error(`Insufficient training data. Need at least ${this.minTrainingDataSize} samples, got ${data.length}`);
    }

    // Store training data
    this.trainingData = [...this.trainingData, ...data];
    if (this.trainingData.length > this.maxTrainingDataSize) {
      // Keep most recent data
      this.trainingData = this.trainingData.slice(-this.maxTrainingDataSize);
    }

    // Prepare features and labels
    const features = this.trainingData.map(d => d.features);
    const labels = this.trainingData.map(d => d.label);

    // Calculate feature scalers
    this.calculateFeatureScalers(features);

    // Scale features
    const scaledFeatures = features.map(feature => this.scaleFeatures(feature));

    // Train the model
    const X = new Matrix(scaledFeatures);
    const y = Matrix.columnVector(labels);

    this.model = new MultivariateLinearRegression(X, y);

    // Calculate baseline metrics for comparison
    this.calculateBaselineMetrics();

    // Calculate feature importance
    this.calculateFeatureImportance();

    this.updatedAt = new Date();
  }

  async predict(input: FailurePredictionInput): Promise<FailurePredictionOutput> {
    if (!this.model) {
      throw new Error('Model not trained. Call train() first.');
    }

    // Extract features from input
    const features = this.extractFeatures(input);
    const scaledFeatures = this.scaleFeatures(features);

    // Make prediction
    const predictions = this.model.predict([scaledFeatures]);
    const prediction = Array.isArray(predictions) ? predictions[0] : predictions;
    const probability = Math.max(0, Math.min(1, prediction)); // Clamp to [0, 1]

    // Determine risk level
    const riskLevel = this.determineRiskLevel(probability);

    // Calculate time to failure estimate
    const timeToFailure = this.estimateTimeToFailure(input, probability);

    // Calculate confidence based on data quality and model certainty
    const confidence = this.calculateConfidence(input, probability);

    // Identify contributing factors
    const factors = this.identifyContributingFactors(input, features);

    // Generate recommendations
    const recommendations = this.generateRecommendations(input, riskLevel, factors);

    return {
      probability,
      riskLevel,
      timeToFailure,
      confidence,
      factors,
      recommendations
    };
  }

  async evaluate(testData: { input: FailurePredictionInput; expected: FailurePredictionOutput }[]): Promise<ModelMetrics> {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const predictions: number[] = [];
    const actuals: number[] = [];
    
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const testCase of testData) {
      const prediction = await this.predict(testCase.input);
      const predicted = prediction.probability > 0.5 ? 1 : 0;
      const actual = testCase.expected.probability > 0.5 ? 1 : 0;

      predictions.push(prediction.probability);
      actuals.push(testCase.expected.probability);

      if (predicted === 1 && actual === 1) truePositives++;
      else if (predicted === 1 && actual === 0) falsePositives++;
      else if (predicted === 0 && actual === 0) trueNegatives++;
      else if (predicted === 0 && actual === 1) falseNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / testData.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    // Calculate RMSE
    const rmse = Math.sqrt(
      predictions.reduce((sum, pred, i) => sum + Math.pow(pred - actuals[i], 2), 0) / predictions.length
    );

    // Calculate MAE
    const mae = predictions.reduce((sum, pred, i) => sum + Math.abs(pred - actuals[i]), 0) / predictions.length;

    // Update model accuracy
    this.accuracy = accuracy;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      rmse,
      mae,
      confusionMatrix: [
        [trueNegatives, falsePositives],
        [falseNegatives, truePositives]
      ]
    };
  }

  serialize(): string {
    return JSON.stringify({
      id: this.id,
      version: this.version,
      accuracy: this.accuracy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      model: this.model ? {
        weights: this.model.weights,
        intercept: this.model.intercept
      } : null,
      featureScalers: this.featureScalers,
      thresholds: this.thresholds,
      featureWeights: this.featureWeights,
      baselineMetrics: this.baselineMetrics,
      trainingDataSize: this.trainingData.length
    });
  }

  deserialize(data: string): void {
    const parsed = JSON.parse(data);
    this.version = parsed.version;
    this.accuracy = parsed.accuracy;
    this.createdAt = new Date(parsed.createdAt);
    this.updatedAt = new Date(parsed.updatedAt);
    this.featureScalers = parsed.featureScalers;
    this.thresholds = parsed.thresholds;
    this.featureWeights = parsed.featureWeights;
    this.baselineMetrics = parsed.baselineMetrics;

    if (parsed.model) {
      // Reconstruct the model (simplified)
      this.model = {
        weights: parsed.model.weights,
        intercept: parsed.model.intercept,
        predict: function(X: number[][]) {
          return X.map(x => 
            x.reduce((sum, val, i) => sum + val * this.weights[i], 0) + this.intercept
          );
        },
        score: () => 0.8, // Default score value
        toString: () => 'Deserialized Model'
      } as MultivariateLinearRegression;
    }
  }

  private extractFeatures(input: FailurePredictionInput): number[] {
    const { systemMetrics, historicalPatterns, externalFactors } = input;

    return [
      // System metrics (normalized to 0-1)
      systemMetrics.cpuUsage / 100,
      systemMetrics.memoryUsage / 100,
      systemMetrics.diskUsage / 100,
      systemMetrics.networkLatency / 1000, // Assume max 1000ms
      systemMetrics.errorRate,
      Math.log(systemMetrics.requestRate + 1) / 10, // Log transform and normalize

      // Historical patterns
      Math.sin(2 * Math.PI * historicalPatterns.timeOfDay / 24), // Cyclical time
      Math.cos(2 * Math.PI * historicalPatterns.timeOfDay / 24),
      Math.sin(2 * Math.PI * historicalPatterns.dayOfWeek / 7), // Cyclical day
      Math.cos(2 * Math.PI * historicalPatterns.dayOfWeek / 7),
      historicalPatterns.recentFailures / 10, // Normalize
      historicalPatterns.maintenanceScheduled ? 1 : 0,

      // External factors
      externalFactors.deploymentRecent ? 1 : 0,
      externalFactors.highTrafficPeriod ? 1 : 0,
      Math.min(externalFactors.dependencyIssues / 5, 1), // Cap at 5

      // Derived features
      systemMetrics.cpuUsage * systemMetrics.memoryUsage / 10000, // Resource pressure
      systemMetrics.errorRate * systemMetrics.requestRate, // Error load
      (systemMetrics.cpuUsage + systemMetrics.memoryUsage + systemMetrics.diskUsage) / 300 // Overall resource usage
    ];
  }

  private calculateFeatureScalers(features: number[][]): void {
    const numFeatures = features[0].length;
    this.featureScalers = [];

    for (let i = 0; i < numFeatures; i++) {
      const featureValues = features.map(f => f[i]);
      const featureMean = mean(featureValues);
      const featureStd = standardDeviation(featureValues) || 1;

      this.featureScalers.push({ mean: featureMean, std: featureStd });
    }
  }

  private scaleFeatures(features: number[]): number[] {
    return features.map((value, i) => {
      const scaler = this.featureScalers[i];
      if (!scaler) return value;
      return (value - scaler.mean) / scaler.std;
    });
  }

  private calculateBaselineMetrics(): void {
    if (this.trainingData.length === 0) return;

    const systemMetrics = this.trainingData.map(d => {
      const input = this.reconstructInputFromFeatures(d.features);
      return input?.systemMetrics;
    }).filter(Boolean) as any[];

    if (systemMetrics.length > 0) {
      this.baselineMetrics = {
        avgCpuUsage: mean(systemMetrics.map(m => m.cpuUsage)),
        avgMemoryUsage: mean(systemMetrics.map(m => m.memoryUsage)),
        avgErrorRate: mean(systemMetrics.map(m => m.errorRate)),
        avgNetworkLatency: mean(systemMetrics.map(m => m.networkLatency))
      };
    }
  }

  private calculateFeatureImportance(): void {
    if (!this.model || !this.model.weights) return;

    const featureNames = [
      'cpuUsage', 'memoryUsage', 'diskUsage', 'networkLatency', 'errorRate', 'requestRate',
      'timeOfDay_sin', 'timeOfDay_cos', 'dayOfWeek_sin', 'dayOfWeek_cos', 
      'recentFailures', 'maintenanceScheduled', 'deploymentRecent', 'highTrafficPeriod',
      'dependencyIssues', 'resourcePressure', 'errorLoad', 'overallResourceUsage'
    ];

    this.featureWeights = {};
    this.model.weights.forEach((weight: number, i: number) => {
      if (featureNames[i]) {
        this.featureWeights[featureNames[i]] = Math.abs(weight);
      }
    });
  }

  private determineRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= this.thresholds.critical) return 'critical';
    if (probability >= this.thresholds.high) return 'high';
    if (probability >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  private estimateTimeToFailure(input: FailurePredictionInput, probability: number): number | undefined {
    if (probability < 0.3) return undefined;

    // Simple heuristic based on current system state
    const { systemMetrics } = input;
    const resourcePressure = (systemMetrics.cpuUsage + systemMetrics.memoryUsage + systemMetrics.diskUsage) / 300;
    
    // Higher resource pressure and error rates = faster failure
    const baseTime = 240; // 4 hours base
    const pressureFactor = Math.max(0.1, 1 - resourcePressure);
    const errorFactor = Math.max(0.1, 1 - systemMetrics.errorRate);
    const probabilityFactor = Math.max(0.1, 1 - probability);

    return Math.floor(baseTime * pressureFactor * errorFactor * probabilityFactor);
  }

  private calculateConfidence(input: FailurePredictionInput, probability: number): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence with more training data
    if (this.trainingData.length > 1000) confidence += 0.2;
    else if (this.trainingData.length > 500) confidence += 0.1;

    // Higher confidence with higher model accuracy
    if (this.accuracy > 0.9) confidence += 0.2;
    else if (this.accuracy > 0.8) confidence += 0.1;

    // Lower confidence for extreme predictions
    if (probability > 0.9 || probability < 0.1) confidence -= 0.1;

    // Data quality factors
    const { systemMetrics } = input;
    const hasCompleteData = [
      systemMetrics.cpuUsage,
      systemMetrics.memoryUsage,
      systemMetrics.errorRate,
      systemMetrics.requestRate
    ].every(val => val !== undefined && val !== null && !isNaN(val));

    if (hasCompleteData) confidence += 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private identifyContributingFactors(input: FailurePredictionInput, _features: number[]) {
    const factors = [];
    const { systemMetrics, historicalPatterns, externalFactors } = input;

    // High resource usage
    if (systemMetrics.cpuUsage > 80) {
      factors.push({
        factor: 'High CPU Usage',
        impact: this.featureWeights['cpuUsage'] || 0.5,
        description: `CPU usage at ${systemMetrics.cpuUsage.toFixed(1)}% is critically high`
      });
    }

    if (systemMetrics.memoryUsage > 80) {
      factors.push({
        factor: 'High Memory Usage',
        impact: this.featureWeights['memoryUsage'] || 0.5,
        description: `Memory usage at ${systemMetrics.memoryUsage.toFixed(1)}% is critically high`
      });
    }

    // High error rates
    if (systemMetrics.errorRate > 0.05) {
      factors.push({
        factor: 'Elevated Error Rate',
        impact: this.featureWeights['errorRate'] || 0.7,
        description: `Error rate at ${(systemMetrics.errorRate * 100).toFixed(2)}% is above normal`
      });
    }

    // Recent issues
    if (historicalPatterns.recentFailures > 2) {
      factors.push({
        factor: 'Recent Failure History',
        impact: this.featureWeights['recentFailures'] || 0.6,
        description: `${historicalPatterns.recentFailures} recent failures indicate instability`
      });
    }

    // External factors
    if (externalFactors.deploymentRecent) {
      factors.push({
        factor: 'Recent Deployment',
        impact: this.featureWeights['deploymentRecent'] || 0.4,
        description: 'Recent deployment increases failure risk'
      });
    }

    if (externalFactors.dependencyIssues > 1) {
      factors.push({
        factor: 'Dependency Issues',
        impact: this.featureWeights['dependencyIssues'] || 0.5,
        description: `${externalFactors.dependencyIssues} dependency issues detected`
      });
    }

    return factors.sort((a, b) => b.impact - a.impact).slice(0, 5);
  }

  private generateRecommendations(
    input: FailurePredictionInput,
    riskLevel: string,
    factors: any[]
  ): string[] {
    const recommendations = [];
    const { systemMetrics } = input;

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Immediate investigation required');
      
      if (systemMetrics.cpuUsage > 80) {
        recommendations.push('Scale up compute resources immediately');
      }
      
      if (systemMetrics.memoryUsage > 80) {
        recommendations.push('Increase memory allocation or optimize memory usage');
      }
      
      if (systemMetrics.errorRate > 0.05) {
        recommendations.push('Investigate and fix error sources immediately');
      }
    }

    if (riskLevel === 'medium') {
      recommendations.push('Monitor closely and prepare for scaling');
      recommendations.push('Review recent changes and deployments');
    }

    // Specific recommendations based on contributing factors
    for (const factor of factors) {
      if (factor.factor === 'Recent Deployment') {
        recommendations.push('Consider rollback if issues persist');
      }
      if (factor.factor === 'Dependency Issues') {
        recommendations.push('Check and resolve external dependency problems');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue normal monitoring');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private reconstructInputFromFeatures(features: number[]): FailurePredictionInput | null {
    // This is a simplified reconstruction for baseline calculation
    // In a real implementation, you might store additional metadata
    if (features.length < 6) return null;

    return {
      systemMetrics: {
        cpuUsage: features[0] * 100,
        memoryUsage: features[1] * 100,
        diskUsage: features[2] * 100,
        networkLatency: features[3] * 1000,
        errorRate: features[4],
        requestRate: Math.exp(features[5] * 10) - 1
      },
      historicalPatterns: {
        timeOfDay: 12, // Default values
        dayOfWeek: 3,
        recentFailures: features[10] * 10,
        maintenanceScheduled: features[11] > 0.5
      },
      externalFactors: {
        deploymentRecent: features[12] > 0.5,
        highTrafficPeriod: features[13] > 0.5,
        dependencyIssues: features[14] * 5
      }
    };
  }
}