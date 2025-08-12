// import * as tf from '@tensorflow/tfjs-node';
// import { regression } from 'ml-regression';

// Mock TensorFlow interfaces for compilation
interface MockTensor {
  dispose(): void;
  data(): Promise<Float32Array>;
}

interface MockLayersModel {
  predict(input: any): MockTensor;
  fit(xs: any, ys: any, config: any): Promise<void>;
  compile(config: any): void;
}

namespace tf {
  export interface LayersModel extends MockLayersModel {}
  
  export interface Tensor2D extends MockTensor {}
  
  export const sequential = (config: any): LayersModel => {
    return {
      predict: (input: any) => ({ dispose: () => {}, data: async () => new Float32Array() } as MockTensor),
      fit: async (xs: any, ys: any, config: any) => {},
      compile: (config: any) => {}
    } as LayersModel;
  };
  
  export const layers = {
    dense: (config: any) => config,
    dropout: (config: any) => config
  };
  
  export const train = {
    adam: (rate: number) => ({ rate })
  };
  
  export const tensor2d = (data: number[][]): Tensor2D => ({
    dispose: () => {},
    data: async () => new Float32Array()
  } as Tensor2D);
}

export interface ResourceMetric {
  timestamp: Date;
  cpu: number; // percentage 0-100
  memory: number; // percentage 0-100
  disk: number; // percentage 0-100
  network: number; // mbps
  requests: number; // requests per minute
  responseTime: number; // ms
  errorRate: number; // percentage 0-100
  activeUsers: number;
  tags: Record<string, string>;
}

export interface CapacityThreshold {
  metric: keyof ResourceMetric;
  warning: number;
  critical: number;
  unit: string;
}

export interface CapacityPrediction {
  metric: string;
  currentValue: number;
  predictedValues: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
  }>;
  thresholdBreaches: Array<{
    timestamp: Date;
    threshold: 'warning' | 'critical';
    predictedValue: number;
  }>;
  recommendations: string[];
  accuracy: number; // Model accuracy percentage
}

export interface ScalingRecommendation {
  service: string;
  action: 'scale_up' | 'scale_down' | 'optimize';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timeToAction: number; // hours until action needed
  currentCapacity: number;
  recommendedCapacity: number;
  estimatedCost: number;
  reasoning: string[];
  confidence: number;
}

export interface CapacityForecast {
  forecastPeriodDays: number;
  predictions: CapacityPrediction[];
  scalingRecommendations: ScalingRecommendation[];
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    bottleneckServices: string[];
    timeToCapacityExhaustion?: number; // days
  };
  costProjection: {
    currentMonthlyCost: number;
    projectedMonthlyCost: number;
    optimizationSavings: number;
  };
}

export class CapacityPlanner {
  private models = new Map<string, MockLayersModel>();
  private historicalData = new Map<string, ResourceMetric[]>();
  private thresholds: CapacityThreshold[] = [];
  private seasonalityModels = new Map<string, any>();

  constructor(private config: {
    predictionHorizonDays: number;
    minDataPointsForPrediction: number;
    modelRetrainingIntervalHours: number;
    confidenceThreshold: number;
  } = {
    predictionHorizonDays: 30,
    minDataPointsForPrediction: 100,
    modelRetrainingIntervalHours: 24,
    confidenceThreshold: 0.8
  }) {
    this.initializeDefaultThresholds();
  }

  /**
   * Add historical resource metrics for capacity planning
   */
  addMetrics(serviceId: string, metrics: ResourceMetric[]): void {
    if (!this.historicalData.has(serviceId)) {
      this.historicalData.set(serviceId, []);
    }

    const existingMetrics = this.historicalData.get(serviceId)!;
    existingMetrics.push(...metrics);

    // Sort by timestamp and remove duplicates
    existingMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const uniqueMetrics = this.removeDuplicateMetrics(existingMetrics);
    
    // Keep only recent data (configurable retention period)
    const retentionPeriod = this.config.predictionHorizonDays * 4; // Keep 4x prediction horizon
    const cutoffDate = new Date(Date.now() - retentionPeriod * 24 * 60 * 60 * 1000);
    const recentMetrics = uniqueMetrics.filter(m => m.timestamp >= cutoffDate);
    
    this.historicalData.set(serviceId, recentMetrics);
  }

  /**
   * Set capacity thresholds for alerting and recommendations
   */
  setThresholds(thresholds: CapacityThreshold[]): void {
    this.thresholds = thresholds;
  }

  /**
   * Generate 30-day capacity forecast using ML models
   */
  async generateForecast(serviceId: string): Promise<CapacityForecast> {
    const metrics = this.historicalData.get(serviceId);
    if (!metrics || metrics.length < this.config.minDataPointsForPrediction) {
      throw new Error(`Insufficient data for service ${serviceId}. Need at least ${this.config.minDataPointsForPrediction} data points.`);
    }

    // Train or update models for this service
    await this.trainModels(serviceId, metrics);

    // Generate predictions for key metrics
    const predictions: CapacityPrediction[] = [];
    const keyMetrics: (keyof ResourceMetric)[] = ['cpu', 'memory', 'disk', 'requests', 'responseTime', 'activeUsers'];

    for (const metricName of keyMetrics) {
      if (typeof metrics[0][metricName] === 'number') {
        const prediction = await this.generateMetricPrediction(serviceId, metricName, metrics);
        if (prediction) {
          predictions.push(prediction);
        }
      }
    }

    // Generate scaling recommendations
    const scalingRecommendations = this.generateScalingRecommendations(serviceId, predictions, metrics);

    // Assess risk
    const riskAssessment = this.assessCapacityRisk(predictions, scalingRecommendations);

    // Calculate cost projections
    const costProjection = this.calculateCostProjection(serviceId, scalingRecommendations, metrics);

    return {
      forecastPeriodDays: this.config.predictionHorizonDays,
      predictions,
      scalingRecommendations,
      riskAssessment,
      costProjection
    };
  }

  /**
   * Get real-time capacity status
   */
  getCurrentCapacityStatus(serviceId: string): {
    service: string;
    timestamp: Date;
    status: 'healthy' | 'warning' | 'critical';
    metrics: Array<{
      name: string;
      current: number;
      threshold: number;
      utilization: number;
    }>;
    timeToThreshold?: number; // hours
  } | null {
    const metrics = this.historicalData.get(serviceId);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const latestMetric = metrics[metrics.length - 1];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    const statusMetrics: Array<{
      name: string;
      current: number;
      threshold: number;
      utilization: number;
    }> = [];

    for (const threshold of this.thresholds) {
      const currentValue = latestMetric[threshold.metric] as number;
      if (typeof currentValue === 'number') {
        const utilization = (currentValue / threshold.critical) * 100;
        
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (currentValue >= threshold.critical) {
          status = 'critical';
          overallStatus = 'critical';
        } else if (currentValue >= threshold.warning) {
          status = 'warning';
          if (overallStatus === 'healthy') overallStatus = 'warning';
        }

        statusMetrics.push({
          name: threshold.metric,
          current: currentValue,
          threshold: status === 'critical' ? threshold.critical : threshold.warning,
          utilization
        });
      }
    }

    return {
      service: serviceId,
      timestamp: latestMetric.timestamp,
      status: overallStatus,
      metrics: statusMetrics
    };
  }

  /**
   * Train ML models for capacity prediction
   */
  private async trainModels(serviceId: string, metrics: ResourceMetric[]): Promise<void> {
    try {
      // Prepare time series data
      const timeSeriesData = this.prepareTimeSeriesData(metrics);
      
      // Create and train neural network model
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 6 }) // Predict 6 metrics: cpu, memory, disk, requests, responseTime, activeUsers
        ]
      });

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Train the model
      const { xs, ys } = timeSeriesData;
      await model.fit(xs, ys, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });

      this.models.set(serviceId, model);

      // Clean up tensors
      xs.dispose();
      ys.dispose();

    } catch (error) {
      console.error(`Error training model for service ${serviceId}:`, error);
    }
  }

  /**
   * Prepare time series data for ML training
   */
  private prepareTimeSeriesData(metrics: ResourceMetric[]): { xs: MockTensor; ys: MockTensor } {
    const windowSize = 10;
    const inputFeatures: number[][] = [];
    const outputs: number[][] = [];

    for (let i = windowSize; i < metrics.length; i++) {
      // Create input window
      const input: number[] = [];
      for (let j = i - windowSize; j < i; j++) {
        const metric = metrics[j];
        input.push(
          metric.cpu,
          metric.memory,
          metric.requests / 1000, // Normalize requests
          metric.responseTime / 1000, // Normalize response time
          metric.activeUsers / 1000, // Normalize active users
          metric.errorRate
        );
      }

      // Flatten the input window
      const flatInput = input.reduce((acc, val) => acc.concat(Array.isArray(val) ? val : [val]), [] as number[]);
      
      // Take average of window for simpler model
      const avgInput = [];
      for (let k = 0; k < 6; k++) {
        const sum = flatInput.filter((_, idx) => idx % 6 === k).reduce((a, b) => a + b, 0);
        avgInput.push(sum / windowSize);
      }

      inputFeatures.push(avgInput);

      // Target output (next metric values)
      const currentMetric = metrics[i];
      outputs.push([
        currentMetric.cpu,
        currentMetric.memory,
        currentMetric.requests / 1000,
        currentMetric.responseTime / 1000,
        currentMetric.activeUsers / 1000,
        currentMetric.errorRate
      ]);
    }

    const xs = tf.tensor2d(inputFeatures);
    const ys = tf.tensor2d(outputs);

    return { xs, ys };
  }

  /**
   * Generate prediction for a specific metric
   */
  private async generateMetricPrediction(
    serviceId: string, 
    metricName: keyof ResourceMetric, 
    metrics: ResourceMetric[]
  ): Promise<CapacityPrediction | null> {
    const model = this.models.get(serviceId);
    if (!model) {
      return null;
    }

    const metricIndex = this.getMetricIndex(metricName);
    if (metricIndex === -1) {
      return null;
    }

    const currentValue = metrics[metrics.length - 1][metricName] as number;
    const predictionPoints = Math.min(30, this.config.predictionHorizonDays); // Daily predictions
    const predictedValues: Array<{ timestamp: Date; value: number; confidence: number }> = [];
    const thresholdBreaches: Array<{ timestamp: Date; threshold: 'warning' | 'critical'; predictedValue: number }> = [];

    try {
      // Generate predictions for the next 30 days
      let currentInput = this.createInputFromRecentMetrics(metrics.slice(-10));
      
      for (let day = 1; day <= predictionPoints; day++) {
        const prediction = model.predict(tf.tensor2d([currentInput])) as MockTensor;
        const predictionData = await prediction.data();
        const predictedValue = this.denormalizeMetric(metricName, predictionData[metricIndex]);
        
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() + day);
        
        // Calculate confidence based on model performance and prediction stability
        const confidence = this.calculatePredictionConfidence(metrics, metricName, predictedValue, day);
        
        predictedValues.push({
          timestamp,
          value: predictedValue,
          confidence
        });

        // Check for threshold breaches
        const threshold = this.thresholds.find(t => t.metric === metricName);
        if (threshold) {
          if (predictedValue >= threshold.critical) {
            thresholdBreaches.push({
              timestamp,
              threshold: 'critical',
              predictedValue
            });
          } else if (predictedValue >= threshold.warning) {
            thresholdBreaches.push({
              timestamp,
              threshold: 'warning',
              predictedValue
            });
          }
        }

        // Update input for next prediction
        currentInput = this.updateInputForNextPrediction(currentInput, predictionData);
        prediction.dispose();
      }

      // Generate recommendations
      const recommendations = this.generateMetricRecommendations(metricName, currentValue, predictedValues, thresholdBreaches);

      // Calculate model accuracy
      const accuracy = this.calculateModelAccuracy(serviceId, metricName, metrics);

      return {
        metric: metricName,
        currentValue,
        predictedValues,
        thresholdBreaches,
        recommendations,
        accuracy
      };

    } catch (error) {
      console.error(`Error generating prediction for metric ${metricName}:`, error);
      return null;
    }
  }

  private generateScalingRecommendations(
    serviceId: string,
    predictions: CapacityPrediction[],
    metrics: ResourceMetric[]
  ): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];
    const latestMetric = metrics[metrics.length - 1];

    // Analyze CPU predictions
    const cpuPrediction = predictions.find(p => p.metric === 'cpu');
    if (cpuPrediction) {
      const criticalBreaches = cpuPrediction.thresholdBreaches.filter(b => b.threshold === 'critical');
      if (criticalBreaches.length > 0) {
        const earliestBreach = criticalBreaches[0];
        const timeToAction = (earliestBreach.timestamp.getTime() - Date.now()) / (1000 * 60 * 60); // hours

        recommendations.push({
          service: serviceId,
          action: 'scale_up',
          urgency: timeToAction < 24 ? 'critical' : timeToAction < 72 ? 'high' : 'medium',
          timeToAction,
          currentCapacity: latestMetric.cpu,
          recommendedCapacity: Math.ceil(earliestBreach.predictedValue * 1.2), // 20% headroom
          estimatedCost: this.estimateScalingCost(serviceId, 'cpu', 1.5),
          reasoning: [
            `CPU utilization predicted to exceed critical threshold (${earliestBreach.predictedValue}%) in ${Math.round(timeToAction)} hours`,
            'Recommend scaling up compute resources to maintain performance'
          ],
          confidence: cpuPrediction.accuracy / 100
        });
      }
    }

    // Analyze Memory predictions
    const memoryPrediction = predictions.find(p => p.metric === 'memory');
    if (memoryPrediction) {
      const criticalBreaches = memoryPrediction.thresholdBreaches.filter(b => b.threshold === 'critical');
      if (criticalBreaches.length > 0) {
        const earliestBreach = criticalBreaches[0];
        const timeToAction = (earliestBreach.timestamp.getTime() - Date.now()) / (1000 * 60 * 60);

        recommendations.push({
          service: serviceId,
          action: 'scale_up',
          urgency: timeToAction < 12 ? 'critical' : timeToAction < 48 ? 'high' : 'medium',
          timeToAction,
          currentCapacity: latestMetric.memory,
          recommendedCapacity: Math.ceil(earliestBreach.predictedValue * 1.3), // 30% headroom for memory
          estimatedCost: this.estimateScalingCost(serviceId, 'memory', 1.5),
          reasoning: [
            `Memory utilization predicted to exceed critical threshold (${earliestBreach.predictedValue}%) in ${Math.round(timeToAction)} hours`,
            'Memory exhaustion can cause service instability and requires immediate scaling'
          ],
          confidence: memoryPrediction.accuracy / 100
        });
      }
    }

    // Analyze optimization opportunities
    const responseTimePrediction = predictions.find(p => p.metric === 'responseTime');
    if (responseTimePrediction && responseTimePrediction.predictedValues.some(p => p.value > latestMetric.responseTime * 1.5)) {
      recommendations.push({
        service: serviceId,
        action: 'optimize',
        urgency: 'medium',
        timeToAction: 168, // 1 week
        currentCapacity: latestMetric.responseTime,
        recommendedCapacity: latestMetric.responseTime * 0.8, // Target 20% improvement
        estimatedCost: -this.estimateOptimizationSavings(serviceId), // Negative cost = savings
        reasoning: [
          'Response time trends indicate potential performance degradation',
          'Consider code optimization, caching improvements, or database tuning'
        ],
        confidence: responseTimePrediction.accuracy / 100
      });
    }

    return recommendations;
  }

  private assessCapacityRisk(
    predictions: CapacityPrediction[],
    recommendations: ScalingRecommendation[]
  ): CapacityForecast['riskAssessment'] {
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const bottleneckServices: string[] = [];
    let timeToCapacityExhaustion: number | undefined;

    // Analyze critical threshold breaches
    const criticalBreaches = predictions.flatMap(p => 
      p.thresholdBreaches.filter(b => b.threshold === 'critical')
    );

    if (criticalBreaches.length > 0) {
      overallRisk = 'critical';
      const earliestBreach = criticalBreaches.reduce((earliest, current) => 
        current.timestamp < earliest.timestamp ? current : earliest
      );
      timeToCapacityExhaustion = (earliestBreach.timestamp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    } else {
      const warningBreaches = predictions.flatMap(p => 
        p.thresholdBreaches.filter(b => b.threshold === 'warning')
      );
      
      if (warningBreaches.length > 3) {
        overallRisk = 'high';
      } else if (warningBreaches.length > 0) {
        overallRisk = 'medium';
      }
    }

    // Identify bottleneck services
    recommendations.forEach(rec => {
      if (rec.urgency === 'critical' || rec.urgency === 'high') {
        bottleneckServices.push(rec.service);
      }
    });

    return {
      overallRisk,
      bottleneckServices: Array.from(new Set(bottleneckServices)),
      timeToCapacityExhaustion
    };
  }

  private calculateCostProjection(
    serviceId: string,
    recommendations: ScalingRecommendation[],
    metrics: ResourceMetric[]
  ): CapacityForecast['costProjection'] {
    const currentMonthlyCost = this.estimateCurrentMonthlyCost(serviceId, metrics);
    
    const scalingCosts = recommendations
      .filter(r => r.action === 'scale_up')
      .reduce((sum, rec) => sum + rec.estimatedCost, 0);
    
    const optimizationSavings = Math.abs(recommendations
      .filter(r => r.action === 'optimize' || r.estimatedCost < 0)
      .reduce((sum, rec) => sum + rec.estimatedCost, 0));

    const projectedMonthlyCost = currentMonthlyCost + scalingCosts - optimizationSavings;

    return {
      currentMonthlyCost,
      projectedMonthlyCost,
      optimizationSavings
    };
  }

  // Helper methods
  private getMetricIndex(metricName: keyof ResourceMetric): number {
    const metricMap: Record<string, number> = {
      cpu: 0,
      memory: 1,
      requests: 2,
      responseTime: 3,
      activeUsers: 4,
      errorRate: 5
    };
    return metricMap[metricName] ?? -1;
  }

  private denormalizeMetric(metricName: keyof ResourceMetric, value: number): number {
    // Reverse the normalization applied during training
    switch (metricName) {
      case 'requests':
      case 'activeUsers':
        return value * 1000;
      case 'responseTime':
        return value * 1000;
      default:
        return value;
    }
  }

  private createInputFromRecentMetrics(metrics: ResourceMetric[]): number[] {
    const latest = metrics[metrics.length - 1];
    return [
      latest.cpu,
      latest.memory,
      latest.requests / 1000,
      latest.responseTime / 1000,
      latest.activeUsers / 1000,
      latest.errorRate
    ];
  }

  private updateInputForNextPrediction(currentInput: number[], predictionData: Float32Array): number[] {
    // Use the prediction as the new current state
    return Array.from(predictionData);
  }

  private calculatePredictionConfidence(
    metrics: ResourceMetric[],
    metricName: keyof ResourceMetric,
    predictedValue: number,
    daysAhead: number
  ): number {
    // Base confidence decreases with time
    let confidence = Math.max(0.5, 1 - (daysAhead * 0.02));
    
    // Reduce confidence for extreme predictions
    const recentValues = metrics.slice(-30).map(m => m[metricName] as number);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length
    );
    
    const zScore = Math.abs((predictedValue - mean) / stdDev);
    if (zScore > 2) confidence *= 0.7; // Reduce confidence for values > 2 std devs
    if (zScore > 3) confidence *= 0.5; // Further reduce for values > 3 std devs
    
    return Math.max(0.1, confidence);
  }

  private generateMetricRecommendations(
    metricName: keyof ResourceMetric,
    currentValue: number,
    predictions: Array<{ timestamp: Date; value: number; confidence: number }>,
    breaches: Array<{ timestamp: Date; threshold: 'warning' | 'critical'; predictedValue: number }>
  ): string[] {
    const recommendations: string[] = [];
    
    if (breaches.length > 0) {
      const earliestBreach = breaches[0];
      const daysUntilBreach = (earliestBreach.timestamp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      
      recommendations.push(
        `${metricName} is predicted to exceed ${earliestBreach.threshold} threshold in ${Math.round(daysUntilBreach)} days`
      );
      
      switch (metricName) {
        case 'cpu':
          recommendations.push('Consider scaling compute resources or optimizing CPU-intensive operations');
          break;
        case 'memory':
          recommendations.push('Plan memory scaling or investigate memory leaks');
          break;
        case 'disk':
          recommendations.push('Increase disk capacity or implement data archival');
          break;
        case 'requests':
          recommendations.push('Prepare for increased traffic with load balancing and auto-scaling');
          break;
        case 'responseTime':
          recommendations.push('Optimize application performance or scale infrastructure');
          break;
      }
    }
    
    // Check for positive trends
    const trend = this.calculateMetricTrend(predictions);
    if (trend === 'decreasing' && breaches.length === 0) {
      recommendations.push(`${metricName} is trending favorably - current configuration appears adequate`);
    }
    
    return recommendations;
  }

  private calculateMetricTrend(predictions: Array<{ value: number }>): 'increasing' | 'decreasing' | 'stable' {
    if (predictions.length < 2) return 'stable';
    
    const first = predictions[0].value;
    const last = predictions[predictions.length - 1].value;
    const change = (last - first) / first;
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  private calculateModelAccuracy(serviceId: string, metricName: keyof ResourceMetric, metrics: ResourceMetric[]): number {
    // Simple accuracy calculation based on recent predictions vs actual values
    // In a real implementation, this would track prediction accuracy over time
    return Math.max(70, 95 - (metrics.length < 200 ? 10 : 0)); // Placeholder accuracy
  }

  private estimateScalingCost(serviceId: string, resource: string, scalingFactor: number): number {
    // Simplified cost estimation - would integrate with cloud provider APIs
    const baseCosts = {
      cpu: 100, // $100/month per additional CPU unit
      memory: 50, // $50/month per additional GB
      disk: 20   // $20/month per additional GB
    };
    
    return (baseCosts[resource as keyof typeof baseCosts] || 100) * scalingFactor;
  }

  private estimateOptimizationSavings(serviceId: string): number {
    // Placeholder for optimization savings calculation
    return 200; // $200/month in potential savings
  }

  private estimateCurrentMonthlyCost(serviceId: string, metrics: ResourceMetric[]): number {
    // Simplified current cost estimation
    const latestMetric = metrics[metrics.length - 1];
    const baseCost = 1000; // $1000 base cost
    const utilizationFactor = (latestMetric.cpu + latestMetric.memory) / 200; // Average utilization
    
    return baseCost * (1 + utilizationFactor);
  }

  private removeDuplicateMetrics(metrics: ResourceMetric[]): ResourceMetric[] {
    const seen = new Set<string>();
    return metrics.filter(metric => {
      const key = metric.timestamp.toISOString();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private initializeDefaultThresholds(): void {
    this.thresholds = [
      { metric: 'cpu', warning: 70, critical: 85, unit: '%' },
      { metric: 'memory', warning: 80, critical: 90, unit: '%' },
      { metric: 'disk', warning: 75, critical: 90, unit: '%' },
      { metric: 'responseTime', warning: 1000, critical: 2000, unit: 'ms' },
      { metric: 'errorRate', warning: 1, critical: 5, unit: '%' }
    ];
  }
}

export default CapacityPlanner;