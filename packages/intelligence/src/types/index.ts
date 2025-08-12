/**
 * Core types for AI-powered anomaly detection system
 */

// Core data types
export interface MetricData {
  timestamp: number;
  value: number;
  source: string;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface LogData {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  source: string;
  tags?: Record<string, string>;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface TraceData {
  timestamp: number;
  traceId: string;
  spanId: string;
  operation: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  source: string;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface ErrorData {
  timestamp: number;
  type: string;
  message: string;
  stackTrace?: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface UserBehaviorData {
  timestamp: number;
  userId?: string;
  sessionId: string;
  action: string;
  page: string;
  duration?: number;
  success: boolean;
  source: string;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

// Union type for all data types
export type MonitoringData = MetricData | LogData | TraceData | ErrorData | UserBehaviorData;

// Anomaly detection types
export interface AnomalyScore {
  score: number; // 0-100, where 100 is most anomalous
  confidence: number; // 0-1, confidence in the score
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

export interface Anomaly {
  id: string;
  type: 'metric' | 'log' | 'trace' | 'error' | 'behavior';
  score: AnomalyScore;
  data: MonitoringData;
  explanation: AnomalyExplanation;
  baseline?: BaselineData;
}

export interface AnomalyExplanation {
  reason: string;
  factors: Array<{
    name: string;
    impact: number; // 0-1
    description: string;
  }>;
  suggestions?: string[];
}

// Baseline learning types
export interface BaselineData {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: Record<string, number>; // e.g., p50, p95, p99
  seasonalPatterns?: SeasonalPattern[];
  trendData?: TrendData;
  lastUpdated: number;
  sampleSize: number;
}

export interface SeasonalPattern {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  pattern: number[];
  strength: number; // 0-1, how strong the seasonal pattern is
}

export interface TrendData {
  slope: number;
  intercept: number;
  correlation: number; // R-squared
  direction: 'increasing' | 'decreasing' | 'stable';
}

// ML Model types
export interface ModelConfig {
  type: 'isolation_forest' | 'lstm' | 'clustering' | 'ensemble';
  parameters: Record<string, any>;
  threshold: number;
  autoTune: boolean;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  lastTrained: number;
  trainingDataSize: number;
}

export interface TrainingData {
  features: number[][];
  labels: number[];
  timestamps: number[];
  metadata?: Record<string, any>[];
}

// Detector configuration
export interface DetectorConfig {
  models: ModelConfig[];
  thresholds: {
    anomalyScore: number; // 0-100
    confidence: number; // 0-1
  };
  autoTuning: {
    enabled: boolean;
    feedbackWindow: number; // minutes
    minSamples: number;
    adjustmentRate: number; // 0-1
  };
  performance: {
    maxLatency: number; // milliseconds
    batchSize: number;
    parallelProcessing: boolean;
  };
}

// Feedback system types
export interface Feedback {
  anomalyId: string;
  isActualAnomaly: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: string;
  comment?: string;
}

// Performance metrics
export interface PerformanceMetrics {
  processingTime: number; // milliseconds
  throughput: number; // items per second
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  accuracy: number; // 0-1
  falsePositiveRate: number; // 0-1
}

// Events
export interface AnomalyEvent {
  type: 'anomaly_detected' | 'baseline_updated' | 'model_retrained' | 'threshold_adjusted';
  data: any;
  timestamp: number;
  source: string;
}

// Data source types
export interface DataSource {
  id: string;
  type: 'metric' | 'log' | 'trace' | 'error' | 'behavior';
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
}

// Utility types
export type DataType = 'metric' | 'log' | 'trace' | 'error' | 'behavior';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type ModelType = 'isolation_forest' | 'lstm' | 'clustering' | 'ensemble';