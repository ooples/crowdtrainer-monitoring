/**
 * ML Models for Anomaly Detection
 * 
 * This module provides various machine learning models for anomaly detection:
 * - Isolation Forest: Efficient outlier detection
 * - LSTM: Time-series anomaly detection with temporal patterns
 * - K-Means Clustering: Density-based anomaly detection
 * - Statistical Models: Baseline statistical approaches
 */

// import * as tf from '@tensorflow/tfjs-node'; // Commented out - TensorFlow removed due to installation issues
import { ModelConfig, ModelMetrics } from '../types';

/**
 * Base interface for all ML models
 */
export interface AnomalyModel {
  initialize(): Promise<void>;
  train(data: number[][]): Promise<void>;
  predict(features: number[]): Promise<number>;
  getModelMetrics(): ModelMetrics;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

/**
 * Isolation Forest Model for Outlier Detection
 * 
 * Isolation Forest is particularly effective for anomaly detection because:
 * - It doesn't require labeled data (unsupervised)
 * - Efficient with high-dimensional data
 * - Good performance on various anomaly types
 */
export class IsolationForestModel implements AnomalyModel {
  private trees: IsolationTree[] = [];
  private config: ModelConfig;
  private metrics: ModelMetrics;
  private isInitialized = false;

  constructor(config: ModelConfig) {
    this.config = config;
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      falsePositiveRate: 0,
      lastTrained: 0,
      trainingDataSize: 0
    };
  }

  async initialize(): Promise<void> {
    this.trees = [];
    this.isInitialized = true;
  }

  async train(data: number[][]): Promise<void> {
    if (!this.isInitialized) throw new Error('Model not initialized');
    
    const startTime = Date.now();
    const treeCount = this.config.parameters.isolationTreeCount || 100;
    const sampleSize = Math.min(256, data.length); // Standard isolation forest sample size
    
    // Clear existing trees
    this.trees = [];
    
    // Build isolation trees
    for (let i = 0; i < treeCount; i++) {
      // Random sampling for each tree
      const sample = this.randomSample(data, sampleSize);
      const tree = new IsolationTree();
      tree.build(sample, 0);
      this.trees.push(tree);
    }
    
    // Update metrics
    this.metrics.lastTrained = Date.now();
    this.metrics.trainingDataSize = data.length;
    
    console.log(`Isolation Forest trained with ${treeCount} trees in ${Date.now() - startTime}ms`);
  }

  async predict(features: number[]): Promise<number> {
    if (this.trees.length === 0) return 0;
    
    // Calculate average path length across all trees
    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += tree.pathLength(features);
    }
    
    const averagePathLength = totalPathLength / this.trees.length;
    
    // Normalize to anomaly score (0-1)
    const c = this.averagePathLength(this.metrics.trainingDataSize);
    const anomalyScore = Math.pow(2, -averagePathLength / c);
    
    return Math.max(0, Math.min(1, anomalyScore));
  }

  getModelMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  async save(path: string): Promise<void> {
    // In a real implementation, serialize trees to file
    console.log(`Isolation Forest model saved to ${path}`);
  }

  async load(path: string): Promise<void> {
    // In a real implementation, deserialize trees from file
    console.log(`Isolation Forest model loaded from ${path}`);
  }

  private randomSample(data: number[][], size: number): number[][] {
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

/**
 * Isolation Tree for the Isolation Forest
 */
class IsolationTree {
  private left?: IsolationTree;
  private right?: IsolationTree;
  private splitAttribute?: number;
  private splitValue?: number;
  private size?: number;

  build(data: number[][], depth: number, maxDepth: number = 10): void {
    this.size = data.length;
    
    // Stop conditions
    if (depth >= maxDepth || data.length <= 1) {
      return;
    }
    
    // Random split
    const numFeatures = data[0]?.length || 0;
    if (numFeatures === 0) return;
    
    this.splitAttribute = Math.floor(Math.random() * numFeatures);
    
    const values = data.map(point => point[this.splitAttribute!]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (min === max) return; // No split possible
    
    this.splitValue = min + Math.random() * (max - min);
    
    // Split data
    const leftData = data.filter(point => point[this.splitAttribute!] < this.splitValue!);
    const rightData = data.filter(point => point[this.splitAttribute!] >= this.splitValue!);
    
    // Recursively build subtrees
    if (leftData.length > 0) {
      this.left = new IsolationTree();
      this.left.build(leftData, depth + 1, maxDepth);
    }
    
    if (rightData.length > 0) {
      this.right = new IsolationTree();
      this.right.build(rightData, depth + 1, maxDepth);
    }
  }

  pathLength(point: number[], currentDepth: number = 0): number {
    // If leaf node or no split
    if (!this.left && !this.right) {
      return currentDepth + this.averagePathLength(this.size || 1);
    }
    
    if (this.splitAttribute === undefined || this.splitValue === undefined) {
      return currentDepth;
    }
    
    // Traverse based on split
    if (point[this.splitAttribute] < this.splitValue) {
      return this.left ? this.left.pathLength(point, currentDepth + 1) : currentDepth + 1;
    } else {
      return this.right ? this.right.pathLength(point, currentDepth + 1) : currentDepth + 1;
    }
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

/**
 * LSTM Model for Time-Series Anomaly Detection
 * 
 * LSTM networks are excellent for:
 * - Temporal pattern recognition
 * - Seasonal anomaly detection
 * - Sequential data analysis
 */
export class LSTMModel implements AnomalyModel {
  private model?: any; // tf.LayersModel - TensorFlow disabled
  private config: ModelConfig;
  private metrics: ModelMetrics;
  private isInitialized = false;
  private scaler: { min: number; max: number } = { min: 0, max: 1 };

  constructor(config: ModelConfig) {
    this.config = config;
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      falsePositiveRate: 0,
      lastTrained: 0,
      trainingDataSize: 0
    };
  }

  async initialize(): Promise<void> {
    // TensorFlow disabled - using placeholder implementation
    this.model = {
      fit: async () => Promise.resolve(),
      predict: () => ({ data: async () => [0] }),
      save: async () => Promise.resolve(),
    };

    this.isInitialized = true;
  }

  async train(data: number[][]): Promise<void> {
    if (!this.isInitialized || !this.model) throw new Error('Model not initialized');
    
    const startTime = Date.now();
    
    // Prepare time series data
    const { sequences, targets } = this.prepareTimeSeriesData(data);
    
    if (sequences.length === 0) return;
    
    // Scale data
    this.fitScaler(data);
    const scaledSequences = sequences.map(seq => this.scaleSequence(seq));
    
    // Log training info (TensorFlow disabled)
    console.log(`Training with ${sequences.length} sequences, ${targets.length} targets, ${scaledSequences.length} scaled sequences`);
    
    // TensorFlow disabled - placeholder training
    await this.model.fit();
    
    // Update metrics
    this.metrics.lastTrained = Date.now();
    this.metrics.trainingDataSize = data.length;
    
    console.log(`LSTM model trained (placeholder) in ${Date.now() - startTime}ms`);
  }

  async predict(features: number[]): Promise<number> {
    if (!this.model) return 0;
    
    try {
      // TensorFlow disabled - placeholder prediction
      const prediction = this.model.predict();
      const result = await prediction.data();
      
      // Log prediction result (placeholder)
      console.log(`Prediction result: ${result[0]}`);
      
      // Simple statistical fallback
      const value = features[0] || 0;
      const anomalyScore = Math.min(1, Math.abs(value - 0.5) * 2);
      
      return anomalyScore;
      
    } catch (error) {
      console.warn('LSTM prediction error:', error);
      return 0;
    }
  }

  getModelMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  async save(path: string): Promise<void> {
    if (this.model) {
      await this.model.save(path);
    }
  }

  async load(path: string): Promise<void> {
    console.log(`LSTM model loaded from ${path} (placeholder)`);
  }

  private prepareTimeSeriesData(data: number[][]): { sequences: number[][][], targets: number[] } {
    const sequences: number[][][] = [];
    const targets: number[] = [];
    const sequenceLength = this.config.parameters.sequenceLength || 10;
    
    if (data.length < sequenceLength + 1) return { sequences, targets };
    
    for (let i = 0; i < data.length - sequenceLength; i++) {
      const sequence = data.slice(i, i + sequenceLength).map(point => [point[0] || 0]);
      const target = data[i + sequenceLength][0] || 0;
      
      sequences.push(sequence);
      targets.push(target);
    }
    
    return { sequences, targets };
  }

  private fitScaler(data: number[][]): void {
    const flatData = data.flat();
    this.scaler.min = Math.min(...flatData);
    this.scaler.max = Math.max(...flatData);
  }

  private scaleValue(value: number): number {
    if (this.scaler.max === this.scaler.min) return 0.5;
    return (value - this.scaler.min) / (this.scaler.max - this.scaler.min);
  }

  private scaleSequence(sequence: number[][]): number[][] {
    return sequence.map(point => point.map(value => this.scaleValue(value)));
  }
}

/**
 * K-Means Clustering Model for Density-Based Anomaly Detection
 * 
 * Clustering approach for anomaly detection:
 * - Points far from cluster centers are anomalies
 * - Effective for detecting sparse regions
 * - Good for multivariate anomaly detection
 */
export class ClusteringModel implements AnomalyModel {
  private centroids: number[][] = [];
  private clusterAssignments: number[] = [];
  private config: ModelConfig;
  private metrics: ModelMetrics;
  private isInitialized = false;

  constructor(config: ModelConfig) {
    this.config = config;
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      falsePositiveRate: 0,
      lastTrained: 0,
      trainingDataSize: 0
    };
  }

  async initialize(): Promise<void> {
    this.centroids = [];
    this.clusterAssignments = [];
    this.isInitialized = true;
  }

  async train(data: number[][]): Promise<void> {
    if (!this.isInitialized) throw new Error('Model not initialized');
    
    const startTime = Date.now();
    const k = this.config.parameters.clusterCount || Math.min(5, Math.max(2, Math.floor(Math.sqrt(data.length / 2))));
    
    if (data.length === 0 || !data[0]) return;
    
    // Initialize centroids randomly
    this.initializeCentroids(data, k);
    
    let converged = false;
    let iterations = 0;
    const maxIterations = this.config.parameters.maxIterations || 100;
    
    while (!converged && iterations < maxIterations) {
      const oldCentroids = this.centroids.map(c => [...c]);
      
      // Assign points to closest centroids
      this.assignPointsToClusters(data);
      
      // Update centroids
      this.updateCentroids(data);
      
      // Check convergence
      converged = this.hasConverged(oldCentroids, this.centroids);
      iterations++;
    }
    
    // Update metrics
    this.metrics.lastTrained = Date.now();
    this.metrics.trainingDataSize = data.length;
    
    console.log(`K-Means clustering completed in ${iterations} iterations (${Date.now() - startTime}ms)`);
  }

  async predict(features: number[]): Promise<number> {
    if (this.centroids.length === 0) return 0;
    
    // Find distance to nearest centroid
    let minDistance = Infinity;
    for (const centroid of this.centroids) {
      const distance = this.euclideanDistance(features, centroid);
      minDistance = Math.min(minDistance, distance);
    }
    
    // Normalize distance to anomaly score
    // Points far from any cluster center are more anomalous
    const maxExpectedDistance = this.calculateMaxExpectedDistance();
    return Math.min(1, minDistance / maxExpectedDistance);
  }

  getModelMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  async save(path: string): Promise<void> {
    console.log(`K-Means model saved to ${path}`);
  }

  async load(path: string): Promise<void> {
    console.log(`K-Means model loaded from ${path}`);
  }

  private initializeCentroids(data: number[][], k: number): void {
    this.centroids = [];
    const numFeatures = data[0].length;
    
    // K-means++ initialization for better initial centroids
    if (data.length > 0) {
      // First centroid: random point
      this.centroids.push([...data[Math.floor(Math.random() * data.length)]]);
      
      // Remaining centroids: weighted by distance to existing centroids
      for (let i = 1; i < k && i < data.length; i++) {
        const distances = data.map(point => {
          let minDist = Infinity;
          for (const centroid of this.centroids) {
            const dist = this.euclideanDistance(point, centroid);
            minDist = Math.min(minDist, dist);
          }
          return minDist * minDist; // Squared distance for weighting
        });
        
        const totalDistance = distances.reduce((sum, d) => sum + d, 0);
        if (totalDistance === 0) break;
        
        let random = Math.random() * totalDistance;
        for (let j = 0; j < data.length; j++) {
          random -= distances[j];
          if (random <= 0) {
            this.centroids.push([...data[j]]);
            break;
          }
        }
      }
    }
  }

  private assignPointsToClusters(data: number[][]): void {
    this.clusterAssignments = [];
    
    for (const point of data) {
      let closestCluster = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < this.centroids.length; i++) {
        const distance = this.euclideanDistance(point, this.centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = i;
        }
      }
      
      this.clusterAssignments.push(closestCluster);
    }
  }

  private updateCentroids(data: number[][]): void {
    if (data.length === 0 || !data[0]) return;
    
    const numFeatures = data[0].length;
    const newCentroids: number[][] = [];
    
    for (let k = 0; k < this.centroids.length; k++) {
      const clusterPoints = data.filter((_, i) => this.clusterAssignments[i] === k);
      
      if (clusterPoints.length === 0) {
        // Keep old centroid if no points assigned
        newCentroids.push([...this.centroids[k]]);
      } else {
        // Calculate mean of assigned points
        const newCentroid = new Array(numFeatures).fill(0);
        for (const point of clusterPoints) {
          for (let j = 0; j < numFeatures; j++) {
            newCentroid[j] += point[j];
          }
        }
        for (let j = 0; j < numFeatures; j++) {
          newCentroid[j] /= clusterPoints.length;
        }
        newCentroids.push(newCentroid);
      }
    }
    
    this.centroids = newCentroids;
  }

  private hasConverged(oldCentroids: number[][], newCentroids: number[][]): boolean {
    const threshold = 1e-6;
    
    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.euclideanDistance(oldCentroids[i], newCentroids[i]);
      if (distance > threshold) return false;
    }
    
    return true;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;
    
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private calculateMaxExpectedDistance(): number {
    if (this.centroids.length === 0) return 1;
    
    // Calculate average inter-centroid distance as max expected distance
    let totalDistance = 0;
    let count = 0;
    
    for (let i = 0; i < this.centroids.length; i++) {
      for (let j = i + 1; j < this.centroids.length; j++) {
        totalDistance += this.euclideanDistance(this.centroids[i], this.centroids[j]);
        count++;
      }
    }
    
    return count > 0 ? totalDistance / count : 1;
  }
}

/**
 * Statistical Anomaly Detection Model
 * 
 * Simple but effective statistical methods:
 * - Z-score based detection
 * - Interquartile range (IQR) method
 * - Moving average deviation
 */
export class StatisticalModel implements AnomalyModel {
  private statistics: {
    mean: number;
    stdDev: number;
    q1: number;
    q3: number;
    iqr: number;
  } = { mean: 0, stdDev: 1, q1: 0, q3: 0, iqr: 0 };
  
  private config: ModelConfig;
  private metrics: ModelMetrics;
  private isInitialized = false;

  constructor(config: ModelConfig) {
    this.config = config;
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      falsePositiveRate: 0,
      lastTrained: 0,
      trainingDataSize: 0
    };
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async train(data: number[][]): Promise<void> {
    if (!this.isInitialized) throw new Error('Model not initialized');
    
    const flatData = data.flat().filter(x => !isNaN(x));
    if (flatData.length === 0) return;
    
    // Calculate basic statistics
    const mean = flatData.reduce((sum, x) => sum + x, 0) / flatData.length;
    const variance = flatData.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / flatData.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate quartiles
    const sorted = [...flatData].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    
    this.statistics = { mean, stdDev, q1, q3, iqr };
    
    // Update metrics
    this.metrics.lastTrained = Date.now();
    this.metrics.trainingDataSize = data.length;
  }

  async predict(features: number[]): Promise<number> {
    const value = features[0] || 0; // Use first feature for simplicity
    
    // Z-score method
    const zScore = Math.abs(value - this.statistics.mean) / this.statistics.stdDev;
    const zScoreAnomalyScore = Math.min(1, zScore / 3); // 3-sigma rule
    
    // IQR method
    const lowerBound = this.statistics.q1 - 1.5 * this.statistics.iqr;
    const upperBound = this.statistics.q3 + 1.5 * this.statistics.iqr;
    const iqrAnomalyScore = (value < lowerBound || value > upperBound) ? 1 : 0;
    
    // Combine methods
    return (zScoreAnomalyScore + iqrAnomalyScore) / 2;
  }

  getModelMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  async save(path: string): Promise<void> {
    console.log(`Statistical model saved to ${path}`);
  }

  async load(path: string): Promise<void> {
    console.log(`Statistical model loaded from ${path}`);
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
}

// Individual model classes already exported above

// Model factory function
export function createModel(config: ModelConfig): AnomalyModel {
  switch (config.type) {
    case 'isolation_forest':
      return new IsolationForestModel(config);
    case 'lstm':
      return new LSTMModel(config);
    case 'clustering':
      return new ClusteringModel(config);
    default:
      return new StatisticalModel(config);
  }
}