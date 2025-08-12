/**
 * Explainable AI System for Anomaly Detection
 * 
 * Provides clear, human-readable explanations for why something was
 * flagged as anomalous. Includes:
 * - Factor analysis and impact scoring
 * - Natural language explanations
 * - Actionable recommendations
 * - Confidence indicators
 * - Visual explanation data
 */

import {
  MonitoringData,
  AnomalyScore,
  AnomalyExplanation,
  BaselineData,
  DataType
} from '../types';

interface ExplanationFactor {
  name: string;
  impact: number; // 0-1, how much this factor contributed to the anomaly
  description: string;
  evidence: string[];
  confidence: number; // 0-1, confidence in this explanation
}

interface VisualExplanationData {
  chartType: 'line' | 'bar' | 'scatter' | 'heatmap';
  data: any[];
  highlights: any[];
  annotations: string[];
}

export class AnomalyExplainer {
  private isInitialized = false;
  private explanationTemplates: Map<string, string> = new Map();
  private factorWeights: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    console.log('Initializing Anomaly Explainer...');
    
    // Load explanation templates
    this.loadExplanationTemplates();
    
    // Set factor importance weights
    this.initializeFactorWeights();
    
    this.isInitialized = true;
    console.log('Anomaly Explainer initialized');
  }

  /**
   * Generate explanation for an anomaly
   */
  async explain(
    data: MonitoringData,
    anomalyScore: AnomalyScore,
    baseline: BaselineData | null,
    modelScores: Map<string, number>
  ): Promise<AnomalyExplanation> {
    if (!this.isInitialized) {
      throw new Error('Explainer not initialized');
    }

    try {
      // Analyze contributing factors
      const factors = await this.analyzeFactors(data, anomalyScore, baseline, modelScores);
      
      // Generate primary explanation
      const reason = await this.generatePrimaryExplanation(data, factors, anomalyScore);
      
      // Generate actionable suggestions
      const suggestions = await this.generateSuggestions(data, factors, anomalyScore);
      
      return {
        reason,
        factors: factors.map(f => ({
          name: f.name,
          impact: f.impact,
          description: f.description
        })),
        suggestions
      };

    } catch (error) {
      console.error('Error generating anomaly explanation:', error);
      
      // Fallback explanation
      return {
        reason: `Anomaly detected with score ${anomalyScore.score.toFixed(1)}/100`,
        factors: [{
          name: 'Statistical Deviation',
          impact: 1.0,
          description: 'The value significantly deviates from expected patterns'
        }],
        suggestions: ['Investigate the underlying cause', 'Check for system issues']
      };
    }
  }

  /**
   * Generate detailed explanation with visual data
   */
  async explainDetailed(
    data: MonitoringData,
    anomalyScore: AnomalyScore,
    baseline: BaselineData | null,
    modelScores: Map<string, number>,
    historicalData?: MonitoringData[]
  ): Promise<{
    explanation: AnomalyExplanation;
    visualData: VisualExplanationData[];
    confidence: number;
    alternativeExplanations: string[];
  }> {
    const explanation = await this.explain(data, anomalyScore, baseline, modelScores);
    
    // Generate visual explanation data
    const visualData = await this.generateVisualExplanations(data, baseline, historicalData);
    
    // Calculate overall explanation confidence
    const confidence = this.calculateExplanationConfidence(explanation, anomalyScore, baseline);
    
    // Generate alternative explanations
    const alternativeExplanations = await this.generateAlternativeExplanations(data, anomalyScore, baseline);
    
    return {
      explanation,
      visualData,
      confidence,
      alternativeExplanations
    };
  }

  private async analyzeFactors(
    data: MonitoringData,
    anomalyScore: AnomalyScore,
    baseline: BaselineData | null,
    modelScores: Map<string, number>
  ): Promise<ExplanationFactor[]> {
    const factors: ExplanationFactor[] = [];
    const dataType = this.getDataType(data);
    const primaryValue = this.extractPrimaryValue(data);

    // Statistical deviation factor
    if (baseline) {
      const statFactor = this.analyzeStatisticalDeviation(primaryValue, baseline, anomalyScore);
      if (statFactor.impact > 0.1) {
        factors.push(statFactor);
      }
    }

    // Temporal pattern factor
    const temporalFactor = this.analyzeTemporalPatterns(data, baseline, anomalyScore);
    if (temporalFactor.impact > 0.1) {
      factors.push(temporalFactor);
    }

    // Model consensus factor
    const consensusFactor = this.analyzeModelConsensus(modelScores, anomalyScore);
    if (consensusFactor.impact > 0.1) {
      factors.push(consensusFactor);
    }

    // Data type specific factors
    const specificFactors = await this.analyzeDataTypeSpecificFactors(data, dataType, anomalyScore, baseline);
    factors.push(...specificFactors.filter(f => f.impact > 0.1));

    // Context factors (tags, metadata)
    const contextFactors = this.analyzeContextualFactors(data, anomalyScore);
    factors.push(...contextFactors.filter(f => f.impact > 0.1));

    // Sort by impact and take top factors
    return factors
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5); // Limit to top 5 factors
  }

  private analyzeStatisticalDeviation(
    value: number,
    baseline: BaselineData,
    anomalyScore: AnomalyScore
  ): ExplanationFactor {
    // Consider anomaly score severity for impact weighting
    const severityMultiplier = anomalyScore.severity === 'critical' ? 1.2 : anomalyScore.severity === 'high' ? 1.1 : 1.0;
    const zScore = Math.abs(value - baseline.mean) / (baseline.stdDev || 1);
    const percentilePosition = this.calculatePercentilePosition(value, baseline);
    
    const evidence: string[] = [];
    let description = '';
    let impact = 0;

    if (zScore > 3) {
      impact = 0.9 * severityMultiplier;
      description = `Value is ${zScore.toFixed(1)} standard deviations from the normal range`;
      evidence.push(`Z-score: ${zScore.toFixed(2)}`);
      evidence.push(`Normal range: ${(baseline.mean - 2 * baseline.stdDev).toFixed(2)} - ${(baseline.mean + 2 * baseline.stdDev).toFixed(2)}`);
    } else if (zScore > 2) {
      impact = 0.7 * severityMultiplier;
      description = `Value significantly exceeds normal variation (${zScore.toFixed(1)} σ)`;
      evidence.push(`Z-score: ${zScore.toFixed(2)}`);
    } else if (percentilePosition < 0.05 || percentilePosition > 0.95) {
      impact = 0.6 * severityMultiplier;
      description = `Value is in the extreme ${percentilePosition < 0.5 ? 'low' : 'high'} range (${(percentilePosition * 100).toFixed(1)}th percentile)`;
      evidence.push(`Percentile position: ${(percentilePosition * 100).toFixed(1)}%`);
    } else {
      impact = Math.min(0.5, zScore / 3) * severityMultiplier;
      description = `Value shows moderate deviation from baseline`;
    }

    evidence.push(`Current value: ${value.toFixed(2)}`);
    evidence.push(`Baseline mean: ${baseline.mean.toFixed(2)}`);

    return {
      name: 'Statistical Deviation',
      impact,
      description,
      evidence,
      confidence: baseline.sampleSize > 100 ? 0.9 : Math.min(0.8, baseline.sampleSize / 100)
    };
  }

  private analyzeTemporalPatterns(
    data: MonitoringData,
    baseline: BaselineData | null,
    anomalyScore: AnomalyScore
  ): ExplanationFactor {
    // Use anomaly score to weight temporal pattern significance
    const scoreWeight = anomalyScore.score / 100;
    const timestamp = data.timestamp;
    const hour = new Date(timestamp).getHours();
    const dayOfWeek = new Date(timestamp).getDay();
    const evidence: string[] = [];
    let impact = 0;
    let description = '';

    if (baseline?.seasonalPatterns) {
      for (const pattern of baseline.seasonalPatterns) {
        if (pattern.strength > 0.3) { // Significant seasonal pattern
          let expectedValue = 0;
          let patternName = '';

          if (pattern.period === 'hourly' && pattern.pattern.length >= 24) {
            expectedValue = pattern.pattern[hour] || 0;
            patternName = 'hourly pattern';
            evidence.push(`Expected for hour ${hour}: ${expectedValue.toFixed(2)}`);
          } else if (pattern.period === 'daily' && pattern.pattern.length >= 7) {
            expectedValue = pattern.pattern[dayOfWeek] || 0;
            patternName = 'weekly pattern';
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            evidence.push(`Expected for ${dayNames[dayOfWeek]}: ${expectedValue.toFixed(2)}`);
          }

          if (expectedValue > 0) {
            const currentValue = this.extractPrimaryValue(data);
            const deviation = Math.abs(currentValue - expectedValue) / expectedValue;
            
            if (deviation > 0.5) {
              impact = Math.max(impact, pattern.strength * 0.8 * scoreWeight);
              description = `Value deviates significantly from expected ${patternName}`;
              evidence.push(`Pattern strength: ${(pattern.strength * 100).toFixed(1)}%`);
              evidence.push(`Deviation: ${(deviation * 100).toFixed(1)}%`);
            }
          }
        }
      }
    }

    // Check for unusual timing
    if (hour < 6 || hour > 22) {
      impact = Math.max(impact, 0.3);
      description = description || 'Anomaly occurred during unusual hours';
      evidence.push(`Time: ${new Date(timestamp).toLocaleTimeString()}`);
    }

    return {
      name: 'Temporal Pattern',
      impact,
      description: description || 'Normal temporal pattern',
      evidence,
      confidence: baseline?.seasonalPatterns?.length ? 0.8 : 0.4
    };
  }

  private analyzeModelConsensus(
    modelScores: Map<string, number>,
    anomalyScore: AnomalyScore
  ): ExplanationFactor {
    // Use anomaly score severity to weight consensus importance
    const consensusWeight = anomalyScore.confidence;
    const scores = Array.from(modelScores.values());
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const consensus = 1 - (stdDev / mean || 0);

    const evidence: string[] = [];
    let description = '';
    let impact = 0;

    if (consensus > 0.8) {
      impact = 0.8 * consensusWeight;
      description = 'Multiple detection models agree on anomaly';
      evidence.push(`Model consensus: ${(consensus * 100).toFixed(1)}%`);
    } else if (consensus > 0.6) {
      impact = 0.6 * consensusWeight;
      description = 'Moderate agreement between detection models';
      evidence.push(`Model consensus: ${(consensus * 100).toFixed(1)}%`);
    } else {
      impact = 0.3 * consensusWeight;
      description = 'Mixed signals from different detection models';
      evidence.push(`Model consensus: ${(consensus * 100).toFixed(1)}%`);
    }

    // Add individual model contributions
    let i = 0;
    for (const [modelName, score] of modelScores) {
      evidence.push(`${modelName}: ${(score * 100).toFixed(1)}`);
      if (++i >= 3) break; // Limit to top 3
    }

    return {
      name: 'Model Consensus',
      impact,
      description,
      evidence,
      confidence: scores.length >= 2 ? 0.9 : 0.5
    };
  }

  private async analyzeDataTypeSpecificFactors(
    data: MonitoringData,
    dataType: DataType,
    anomalyScore: AnomalyScore,
    baseline: BaselineData | null
  ): Promise<ExplanationFactor[]> {
    const factors: ExplanationFactor[] = [];

    switch (dataType) {
      case 'metric':
        factors.push(...this.analyzeMetricFactors(data as any, anomalyScore, baseline));
        break;
      case 'log':
        factors.push(...this.analyzeLogFactors(data as any, anomalyScore));
        break;
      case 'trace':
        factors.push(...this.analyzeTraceFactors(data as any, anomalyScore));
        break;
      case 'error':
        factors.push(...this.analyzeErrorFactors(data as any, anomalyScore));
        break;
      case 'behavior':
        factors.push(...this.analyzeBehaviorFactors(data as any, anomalyScore));
        break;
    }

    return factors;
  }

  private analyzeMetricFactors(data: any, anomalyScore: AnomalyScore, baseline: BaselineData | null): ExplanationFactor[] {
    // Use anomaly score for factor weighting
    const severityFactor = anomalyScore.severity === 'critical' ? 1.0 : 0.8;
    // Use baseline for statistical comparison if available
    const hasBaseline = baseline !== null;
    const factors: ExplanationFactor[] = [];
    
    // Rapid change factor
    if (data.previousValue !== undefined) {
      const changeRate = Math.abs((data.value - data.previousValue) / (data.previousValue || 1));
      if (changeRate > 0.5) {
        factors.push({
          name: 'Rapid Change',
          impact: Math.min(0.8, changeRate) * severityFactor,
          description: `Metric changed by ${(changeRate * 100).toFixed(1)}% from previous value`,
          evidence: [
            `Current: ${data.value}`,
            `Previous: ${data.previousValue}`,
            `Change rate: ${(changeRate * 100).toFixed(1)}%`
          ],
          confidence: hasBaseline ? 0.9 : 0.7
        });
      }
    }

    return factors;
  }

  private analyzeLogFactors(data: any, anomalyScore: AnomalyScore): ExplanationFactor[] {
    // Weight factors based on anomaly score
    const scoreMultiplier = Math.max(0.5, anomalyScore.confidence);
    const factors: ExplanationFactor[] = [];
    
    // Log level severity
    const severityLevels = { debug: 1, info: 2, warn: 3, error: 4, critical: 5 };
    const severity = severityLevels[data.level as keyof typeof severityLevels] || 1;
    
    if (severity >= 4) {
      factors.push({
        name: 'High Severity Log',
        impact: (severity / 5) * scoreMultiplier,
        description: `${data.level.toUpperCase()} level log detected`,
        evidence: [
          `Log level: ${data.level}`,
          `Message: ${data.message?.substring(0, 100)}...`,
          `Source: ${data.source}`
        ],
        confidence: 0.95
      });
    }

    return factors;
  }

  private analyzeTraceFactors(data: any, anomalyScore: AnomalyScore): ExplanationFactor[] {
    // Consider anomaly score confidence for trace analysis
    const confidenceWeight = anomalyScore.confidence;
    const factors: ExplanationFactor[] = [];
    
    // Duration anomaly
    if (data.duration > 5000) { // > 5 seconds
      factors.push({
        name: 'High Latency',
        impact: Math.min(0.9, data.duration / 10000) * confidenceWeight,
        description: `Operation took ${data.duration}ms to complete`,
        evidence: [
          `Duration: ${data.duration}ms`,
          `Operation: ${data.operation}`,
          `Status: ${data.status}`
        ],
        confidence: 0.85
      });
    }

    // Error status
    if (data.status === 'error' || data.status === 'timeout') {
      factors.push({
        name: 'Failed Operation',
        impact: 0.8,
        description: `Operation failed with status: ${data.status}`,
        evidence: [
          `Status: ${data.status}`,
          `Operation: ${data.operation}`,
          `Trace ID: ${data.traceId}`
        ],
        confidence: 0.95
      });
    }

    return factors;
  }

  private analyzeErrorFactors(data: any, anomalyScore: AnomalyScore): ExplanationFactor[] {
    // Use score severity to weight error factor importance
    const severityBoost = anomalyScore.severity === 'critical' ? 1.2 : 1.0;
    const factors: ExplanationFactor[] = [];
    
    // Error severity
    const severities = { low: 1, medium: 2, high: 3, critical: 4 };
    const severity = severities[data.severity as keyof typeof severities] || 1;
    
    factors.push({
      name: 'Error Severity',
      impact: (severity / 4) * severityBoost,
      description: `${data.severity.toUpperCase()} severity error occurred`,
      evidence: [
        `Error type: ${data.type}`,
        `Severity: ${data.severity}`,
        `Message: ${data.message?.substring(0, 100)}...`
      ],
      confidence: 0.9
    });

    return factors;
  }

  private analyzeBehaviorFactors(data: any, anomalyScore: AnomalyScore): ExplanationFactor[] {
    // Apply anomaly score to behavior factor analysis
    const behaviorWeight = anomalyScore.score / 100;
    const factors: ExplanationFactor[] = [];
    
    // Failed user action
    if (!data.success) {
      factors.push({
        name: 'Failed User Action',
        impact: 0.7 * behaviorWeight,
        description: `User action "${data.action}" failed`,
        evidence: [
          `Action: ${data.action}`,
          `Page: ${data.page}`,
          `Success: ${data.success}`,
          `Duration: ${data.duration || 0}ms`
        ],
        confidence: 0.8
      });
    }

    return factors;
  }

  private analyzeContextualFactors(data: MonitoringData, anomalyScore: AnomalyScore): ExplanationFactor[] {
    // Context importance weighted by anomaly score
    const contextWeight = anomalyScore.confidence * (anomalyScore.score / 100);
    const factors: ExplanationFactor[] = [];
    const tags = data.tags || {};
    const evidence: string[] = [];
    
    // Check for problematic tags
    const problematicTags = ['error', 'timeout', 'failure', 'critical', 'alert'];
    let problematicCount = 0;
    
    for (const [key, value] of Object.entries(tags)) {
      evidence.push(`${key}: ${value}`);
      
      if (problematicTags.some(tag => 
        key.toLowerCase().includes(tag) || 
        value.toString().toLowerCase().includes(tag)
      )) {
        problematicCount++;
      }
    }
    
    if (problematicCount > 0) {
      factors.push({
        name: 'Context Indicators',
        impact: Math.min(0.6, problematicCount * 0.2) * contextWeight,
        description: 'Contextual data suggests problematic conditions',
        evidence: evidence.slice(0, 5), // Limit evidence
        confidence: 0.7
      });
    }

    return factors;
  }

  private async generatePrimaryExplanation(
    data: MonitoringData,
    factors: ExplanationFactor[],
    anomalyScore: AnomalyScore
  ): Promise<string> {
    if (factors.length === 0) {
      return `Anomaly detected with ${anomalyScore.score.toFixed(1)}/100 score, but cause is unclear`;
    }

    const primaryFactor = factors[0];
    const dataType = this.getDataType(data);
    const severity = anomalyScore.severity;
    
    // Use template-based explanation generation
    const template = this.explanationTemplates.get(`${dataType}_${primaryFactor.name.toLowerCase().replace(' ', '_')}`) ||
                    this.explanationTemplates.get(`generic_${primaryFactor.name.toLowerCase().replace(' ', '_')}`) ||
                    this.explanationTemplates.get('generic_default');

    if (template) {
      return template
        .replace('{{score}}', anomalyScore.score.toFixed(1))
        .replace('{{severity}}', severity)
        .replace('{{factor}}', primaryFactor.description)
        .replace('{{confidence}}', (anomalyScore.confidence * 100).toFixed(0));
    }

    // Fallback to structured explanation
    return `${severity.toUpperCase()} anomaly detected (${anomalyScore.score.toFixed(1)}/100): ${primaryFactor.description}`;
  }

  private async generateSuggestions(
    data: MonitoringData,
    factors: ExplanationFactor[],
    anomalyScore: AnomalyScore
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const dataType = this.getDataType(data);
    const severity = anomalyScore.severity;

    // Severity-based suggestions
    if (severity === 'critical') {
      suggestions.push('Immediate investigation required - potential system impact');
      suggestions.push('Check system health and recent deployments');
    } else if (severity === 'high') {
      suggestions.push('Investigate within the next hour');
      suggestions.push('Review system logs and metrics');
    }

    // Factor-based suggestions
    for (const factor of factors.slice(0, 2)) { // Top 2 factors
      switch (factor.name) {
        case 'Statistical Deviation':
          suggestions.push('Compare with historical data to identify pattern changes');
          break;
        case 'Temporal Pattern':
          suggestions.push('Check for scheduled operations or unusual load patterns');
          break;
        case 'High Latency':
          suggestions.push('Investigate database and network performance');
          break;
        case 'Failed Operation':
          suggestions.push('Check error logs and system dependencies');
          break;
        case 'High Severity Log':
          suggestions.push('Review application logs for error details');
          break;
      }
    }

    // Data type specific suggestions
    switch (dataType) {
      case 'metric':
        suggestions.push('Monitor related metrics for cascading effects');
        break;
      case 'error':
        suggestions.push('Check if error is recurring and affects multiple users');
        break;
      case 'behavior':
        suggestions.push('Analyze user journey and identify friction points');
        break;
    }

    // General suggestions
    suggestions.push('Set up alerts for similar patterns');
    suggestions.push('Consider updating baseline if this represents new normal');

    // Remove duplicates and limit
    return [...new Set(suggestions)].slice(0, 5);
  }

  private async generateVisualExplanations(
    data: MonitoringData,
    baseline: BaselineData | null,
    historicalData?: MonitoringData[]
  ): Promise<VisualExplanationData[]> {
    const visualData: VisualExplanationData[] = [];

    // Time series chart
    if (historicalData && historicalData.length > 0) {
      const timeSeriesData = historicalData.map(d => ({
        timestamp: d.timestamp,
        value: this.extractPrimaryValue(d)
      }));

      visualData.push({
        chartType: 'line',
        data: timeSeriesData,
        highlights: [{
          timestamp: data.timestamp,
          value: this.extractPrimaryValue(data),
          type: 'anomaly'
        }],
        annotations: ['Current anomalous point highlighted in red']
      });
    }

    // Statistical distribution chart
    if (baseline) {
      visualData.push({
        chartType: 'bar',
        data: [
          { label: 'Min', value: baseline.min },
          { label: 'P25', value: baseline.percentiles.p25 },
          { label: 'Mean', value: baseline.mean },
          { label: 'P75', value: baseline.percentiles.p75 },
          { label: 'Max', value: baseline.max },
          { label: 'Current', value: this.extractPrimaryValue(data) }
        ],
        highlights: [{ label: 'Current', type: 'anomaly' }],
        annotations: ['Current value compared to baseline distribution']
      });
    }

    return visualData;
  }

  private async generateAlternativeExplanations(
    data: MonitoringData,
    anomalyScore: AnomalyScore,
    baseline: BaselineData | null
  ): Promise<string[]> {
    const alternatives: string[] = [];

    // Data-specific alternative explanations based on data type
    const dataType = this.getDataType(data);
    
    // Consider different scenarios
    alternatives.push('Data quality issue or measurement error');
    alternatives.push('Expected variation due to external factors');
    alternatives.push('System change or configuration update');
    
    if (baseline && baseline.sampleSize < 100) {
      alternatives.push('Insufficient baseline data for accurate detection');
    }
    
    // Type-specific alternatives
    if (dataType === 'metric') {
      alternatives.push('Normal business cycle variation');
    } else if (dataType === 'log') {
      alternatives.push('Temporary increase in log verbosity');
    }

    if (anomalyScore.confidence < 0.7) {
      alternatives.push('Low confidence detection - may be false positive');
    }

    return alternatives.slice(0, 3);
  }

  private calculateExplanationConfidence(
    explanation: AnomalyExplanation,
    anomalyScore: AnomalyScore,
    baseline: BaselineData | null
  ): number {
    let confidence = anomalyScore.confidence;
    
    // Factor in baseline quality
    if (baseline) {
      const baselineQuality = Math.min(1, baseline.sampleSize / 1000);
      confidence *= 0.7 + 0.3 * baselineQuality;
    } else {
      confidence *= 0.5; // Lower confidence without baseline
    }

    // Factor in number of contributing factors
    const factorContribution = Math.min(1, explanation.factors.length / 3);
    confidence *= 0.6 + 0.4 * factorContribution;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private loadExplanationTemplates(): void {
    this.explanationTemplates.set('generic_default', 
      '{{severity}} anomaly ({{score}}/100, {{confidence}}% confidence): {{factor}}');
    
    this.explanationTemplates.set('metric_statistical_deviation',
      'Metric shows {{severity}} statistical deviation ({{score}}/100): {{factor}}');
    
    this.explanationTemplates.set('log_high_severity_log',
      '{{severity}} severity log anomaly detected ({{score}}/100): {{factor}}');
    
    this.explanationTemplates.set('trace_high_latency',
      'Performance anomaly detected ({{score}}/100): {{factor}}');
    
    this.explanationTemplates.set('error_error_severity',
      'Error anomaly detected ({{score}}/100): {{factor}}');
    
    this.explanationTemplates.set('behavior_failed_user_action',
      'User behavior anomaly ({{score}}/100): {{factor}}');
  }

  private initializeFactorWeights(): void {
    this.factorWeights.set('Statistical Deviation', 1.0);
    this.factorWeights.set('Model Consensus', 0.9);
    this.factorWeights.set('Temporal Pattern', 0.8);
    this.factorWeights.set('High Severity Log', 0.9);
    this.factorWeights.set('Failed Operation', 0.8);
    this.factorWeights.set('High Latency', 0.7);
    this.factorWeights.set('Context Indicators', 0.6);
  }

  private calculatePercentilePosition(value: number, baseline: BaselineData): number {
    const percentiles = Object.values(baseline.percentiles).sort((a, b) => a - b);
    
    for (let i = 0; i < percentiles.length; i++) {
      if (value <= percentiles[i]) {
        return (i + 1) / (percentiles.length + 1);
      }
    }
    
    return 1.0; // Above all percentiles
  }

  private getDataType(data: MonitoringData): DataType {
    if ('value' in data) return 'metric';
    if ('level' in data) return 'log';
    if ('traceId' in data) return 'trace';
    if ('stackTrace' in data) return 'error';
    if ('action' in data) return 'behavior';
    return 'metric';
  }

  private extractPrimaryValue(data: MonitoringData): number {
    if ('value' in data) return (data as any).value || 0;
    if ('duration' in data) return (data as any).duration || 0;
    if ('level' in data) return this.getLogLevelNumeric((data as any).level);
    if ('severity' in data) return this.getSeverityNumeric((data as any).severity);
    return 0;
  }

  private getLogLevelNumeric(level: string): number {
    const levels: Record<string, number> = { debug: 1, info: 2, warn: 3, error: 4, critical: 5 };
    return levels[level] || 0;
  }

  private getSeverityNumeric(severity: string): number {
    const severities: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    return severities[severity] || 0;
  }
}