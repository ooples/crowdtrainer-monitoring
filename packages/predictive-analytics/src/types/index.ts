// Core ML Types
export interface MLModel<TInput = any, TOutput = any> {
  id: string;
  type: ModelType;
  version: string;
  accuracy: number;
  createdAt: Date;
  updatedAt: Date;
  train(data: TInput[]): Promise<void>;
  predict(input: TInput): Promise<TOutput>;
  evaluate(testData: { input: TInput; expected: TOutput }[]): Promise<ModelMetrics>;
  serialize(): string;
  deserialize(data: string): void;
}

export type ModelType = 
  | 'failure_prediction'
  | 'traffic_forecasting'
  | 'budget_prediction'
  | 'churn_analysis'
  | 'performance_degradation'
  | 'trend_analysis'
  | 'anomaly_detection';

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rmse?: number;
  mae?: number;
  r2Score?: number;
  confusionMatrix?: number[][];
  rocAuc?: number;
}

// Failure Prediction Types
export interface FailurePredictionInput {
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    errorRate: number;
    requestRate: number;
  };
  historicalPatterns: {
    timeOfDay: number;
    dayOfWeek: number;
    recentFailures: number;
    maintenanceScheduled: boolean;
  };
  externalFactors: {
    deploymentRecent: boolean;
    highTrafficPeriod: boolean;
    dependencyIssues: number;
  };
}

export interface FailurePredictionOutput {
  probability: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timeToFailure?: number; // minutes
  confidence: number;
  factors: {
    factor: string;
    impact: number;
    description: string;
  }[];
  recommendations: string[];
}

// Traffic Forecasting Types
export interface TrafficForecastInput {
  historicalData: {
    timestamp: Date;
    requestCount: number;
    uniqueUsers: number;
    responseTime: number;
    errorCount: number;
  }[];
  seasonality: {
    hourly: number[];
    daily: number[];
    weekly: number[];
    monthly?: number[];
  };
  externalEvents: {
    holidays: Date[];
    promotions: { start: Date; end: Date; impact: number }[];
    deployments: Date[];
  };
}

export interface TrafficForecastOutput {
  predictions: {
    timestamp: Date;
    expectedRequests: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    resourceNeeds: {
      cpu: number;
      memory: number;
      bandwidth: number;
    };
  }[];
  seasonalityDetected: {
    pattern: string;
    strength: number;
    period: number;
  }[];
  recommendations: {
    scaleUp: Date[];
    scaleDown: Date[];
    preloadCache: Date[];
  };
}

// Budget Prediction Types
export interface BudgetPredictionInput {
  currentUsage: {
    compute: number;
    storage: number;
    bandwidth: number;
    database: number;
    thirdParty: number;
  };
  historicalSpend: {
    date: Date;
    amount: number;
    category: string;
  }[];
  growthMetrics: {
    userGrowthRate: number;
    trafficGrowthRate: number;
    featureGrowthRate: number;
  };
  budgetConstraints: {
    total: number;
    categories: Record<string, number>;
    alertThresholds: number[];
  };
}

export interface BudgetPredictionOutput {
  projectedSpend: {
    date: Date;
    amount: number;
    breakdown: Record<string, number>;
    confidence: number;
  }[];
  budgetAlerts: {
    threshold: number;
    estimatedDate: Date;
    category: string;
    severity: 'warning' | 'critical';
  }[];
  optimizationOpportunities: {
    category: string;
    potentialSavings: number;
    effort: 'low' | 'medium' | 'high';
    description: string;
  }[];
  recommendations: string[];
}

// Churn Analysis Types
export interface ChurnAnalysisInput {
  userMetrics: {
    userId: string;
    accountAge: number; // days
    lastActivity: Date;
    sessionsLastWeek: number;
    avgSessionDuration: number; // minutes
    featuresUsed: string[];
    supportTickets: number;
    paymentIssues: number;
  }[];
  engagementPatterns: {
    loginFrequency: number;
    featureAdoption: number;
    socialInteractions: number;
    contentCreated: number;
  }[];
  cohortData: {
    cohortMonth: string;
    userCount: number;
    retentionRates: number[];
  }[];
}

export interface ChurnAnalysisOutput {
  userRiskScores: {
    userId: string;
    churnProbability: number;
    riskLevel: 'low' | 'medium' | 'high';
    keyFactors: string[];
    recommendedActions: string[];
  }[];
  cohortInsights: {
    cohortMonth: string;
    predictedChurn: number;
    keyRiskFactors: string[];
  }[];
  globalMetrics: {
    overallChurnRate: number;
    churnTrend: 'increasing' | 'stable' | 'decreasing';
    topChurnReasons: string[];
  };
  interventionStrategies: {
    segment: string;
    strategy: string;
    expectedImpact: number;
  }[];
}

// Performance Degradation Types
export interface PerformanceDegradationInput {
  metrics: {
    timestamp: Date;
    responseTime: number;
    throughput: number;
    errorRate: number;
    resourceUtilization: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  }[];
  baselines: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
  thresholds: {
    responseTimeDegradation: number;
    throughputDegradation: number;
    errorRateIncrease: number;
  };
}

export interface PerformanceDegradationOutput {
  degradationScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  affectedMetrics: {
    metric: string;
    currentValue: number;
    baselineValue: number;
    degradationPercentage: number;
    severity: 'low' | 'medium' | 'high';
  }[];
  rootCauses: {
    cause: string;
    probability: number;
    evidence: string[];
  }[];
  recommendations: {
    action: string;
    priority: 'low' | 'medium' | 'high';
    estimatedImpact: number;
  }[];
}

// Trend Analysis Types
export interface TrendAnalysisInput {
  timeSeries: {
    timestamp: Date;
    value: number;
    metadata?: Record<string, any>;
  }[];
  analysisParams: {
    trendDetectionSensitivity: number;
    seasonalityDetection: boolean;
    anomalyDetection: boolean;
    forecastHorizon: number; // days
  };
}

export interface TrendAnalysisOutput {
  trends: {
    type: 'linear' | 'exponential' | 'logarithmic' | 'seasonal';
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number; // 0-1
    startDate: Date;
    endDate?: Date;
    equation?: string;
    r2Score: number;
  }[];
  seasonality: {
    detected: boolean;
    period: number; // hours/days
    strength: number;
    peaks: Date[];
    troughs: Date[];
  };
  anomalies: {
    timestamp: Date;
    value: number;
    expectedValue: number;
    severity: 'low' | 'medium' | 'high';
    type: 'spike' | 'drop' | 'pattern_break';
  }[];
  forecast: {
    timestamp: Date;
    predictedValue: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  }[];
  insights: {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
  };
}

// What-If Scenario Types
export interface WhatIfScenarioInput {
  baselineMetrics: Record<string, number>;
  scenarios: {
    id: string;
    name: string;
    changes: {
      parameter: string;
      value: number;
      type: 'absolute' | 'percentage' | 'multiplier';
    }[];
    duration?: number; // days
  }[];
  constraints: {
    parameter: string;
    min?: number;
    max?: number;
    dependencies?: string[];
  }[];
}

export interface WhatIfScenarioOutput {
  scenarios: {
    id: string;
    name: string;
    projectedOutcome: {
      parameter: string;
      currentValue: number;
      projectedValue: number;
      change: number;
      changePercentage: number;
    }[];
    risks: {
      risk: string;
      probability: number;
      impact: 'low' | 'medium' | 'high';
      mitigation: string;
    }[];
    costs: {
      category: string;
      currentCost: number;
      projectedCost: number;
      difference: number;
    }[];
    timeline: {
      phase: string;
      duration: number;
      milestones: string[];
    }[];
  }[];
  comparisons: {
    scenarioIds: string[];
    bestCase: string;
    worstCase: string;
    mostLikely: string;
    recommendations: string[];
  };
}

// Configuration Types
export interface PredictiveAnalyticsConfig {
  models: {
    [K in ModelType]: {
      enabled: boolean;
      updateFrequency: number; // hours
      retrainThreshold: number; // accuracy drop threshold
      maxDataAge: number; // days
    };
  };
  dataRetention: {
    raw: number; // days
    aggregated: number; // days
    predictions: number; // days
  };
  alerting: {
    failurePrediction: {
      highRiskThreshold: number;
      criticalRiskThreshold: number;
      recipients: string[];
    };
    budgetPrediction: {
      warningThreshold: number; // percentage
      criticalThreshold: number; // percentage
      recipients: string[];
    };
    churnPrediction: {
      highRiskThreshold: number;
      recipients: string[];
    };
  };
  performance: {
    maxConcurrentPredictions: number;
    predictionTimeout: number; // seconds
    cacheResults: boolean;
    cacheTtl: number; // seconds
  };
}

// Event Types
export interface PredictiveAnalyticsEvent {
  type: 'prediction_completed' | 'model_retrained' | 'alert_triggered' | 'anomaly_detected';
  timestamp: Date;
  modelType: ModelType;
  data: any;
  metadata?: Record<string, any>;
}

export interface AlertEvent extends PredictiveAnalyticsEvent {
  type: 'alert_triggered';
  severity: 'warning' | 'critical';
  message: string;
  recommendedActions: string[];
}