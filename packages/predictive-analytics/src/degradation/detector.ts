import { SimpleLinearRegression } from 'ml-regression';
import { mean, median } from 'simple-statistics';
import { PerformanceDegradationInput, PerformanceDegradationOutput } from '../types';

interface MetricTrend {
  metric: string;
  slope: number;
  r2: number;
  significance: 'high' | 'medium' | 'low';
  direction: 'improving' | 'stable' | 'degrading';
}

export class PerformanceDegradationDetector {
  private readonly trendSignificanceThreshold = 0.5; // R² threshold

  constructor() {}

  async detectDegradation(input: PerformanceDegradationInput): Promise<PerformanceDegradationOutput> {
    this.validateInput(input);

    // Prepare and clean data
    const cleanedData = this.cleanAndSortData(input.metrics);
    
    // Analyze trends for each metric
    const trends = this.analyzeTrends(cleanedData, input.baselines);
    
    // Calculate overall degradation score
    const degradationScore = this.calculateDegradationScore(trends, input.thresholds);
    
    // Determine overall trend
    const overallTrend = this.determineOverallTrend(trends);
    
    // Identify affected metrics
    const affectedMetrics = this.identifyAffectedMetrics(cleanedData, input.baselines, input.thresholds);
    
    // Find root causes
    const rootCauses = this.identifyRootCauses(trends, affectedMetrics, cleanedData);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(degradationScore, affectedMetrics, rootCauses);

    return {
      degradationScore,
      trend: overallTrend,
      affectedMetrics,
      rootCauses,
      recommendations
    };
  }

  private validateInput(input: PerformanceDegradationInput): void {
    if (!input.metrics || input.metrics.length < 24) {
      throw new Error('Need at least 24 hours of performance metrics data');
    }

    if (!input.baselines) {
      throw new Error('Baseline performance metrics are required');
    }

    if (!input.thresholds) {
      throw new Error('Degradation thresholds are required');
    }

    // Check for required baseline metrics
    const requiredBaselines = ['responseTime', 'throughput', 'errorRate'];
    const missingBaselines = requiredBaselines.filter(metric => 
      input.baselines[metric as keyof typeof input.baselines] === undefined
    );

    if (missingBaselines.length > 0) {
      throw new Error(`Missing baseline metrics: ${missingBaselines.join(', ')}`);
    }

    // Validate data quality
    const validDataPoints = input.metrics.filter(m => 
      m.timestamp instanceof Date &&
      typeof m.responseTime === 'number' &&
      typeof m.throughput === 'number' &&
      typeof m.errorRate === 'number' &&
      m.resourceUtilization
    );

    if (validDataPoints.length < input.metrics.length * 0.8) {
      throw new Error('Too many invalid data points. Need at least 80% valid data.');
    }
  }

  private cleanAndSortData(metrics: any[]) {
    return metrics
      .filter(m => 
        m.timestamp instanceof Date &&
        !isNaN(m.responseTime) &&
        !isNaN(m.throughput) &&
        !isNaN(m.errorRate) &&
        m.resourceUtilization
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((metric, index) => ({
        ...metric,
        index
      }));
  }

  private analyzeTrends(data: any[], baselines: any): MetricTrend[] {
    const trends: MetricTrend[] = [];
    
    // Analyze response time trend
    const responseTimeTrend = this.calculateMetricTrend(
      data.map(d => d.responseTime),
      'responseTime',
      baselines.responseTime
    );
    trends.push(responseTimeTrend);
    
    // Analyze throughput trend
    const throughputTrend = this.calculateMetricTrend(
      data.map(d => d.throughput),
      'throughput',
      baselines.throughput,
      true // Higher is better for throughput
    );
    trends.push(throughputTrend);
    
    // Analyze error rate trend
    const errorRateTrend = this.calculateMetricTrend(
      data.map(d => d.errorRate),
      'errorRate',
      baselines.errorRate
    );
    trends.push(errorRateTrend);
    
    // Analyze resource utilization trends
    const cpuTrend = this.calculateMetricTrend(
      data.map(d => d.resourceUtilization.cpu),
      'cpu',
      50 // Assume 50% baseline
    );
    trends.push(cpuTrend);
    
    const memoryTrend = this.calculateMetricTrend(
      data.map(d => d.resourceUtilization.memory),
      'memory',
      50 // Assume 50% baseline
    );
    trends.push(memoryTrend);

    return trends;
  }

  private calculateMetricTrend(values: number[], metricName: string, _baseline: number, higherIsBetter = false): MetricTrend {
    if (values.length < 2) {
      return {
        metric: metricName,
        slope: 0,
        r2: 0,
        significance: 'low',
        direction: 'stable'
      };
    }

    const x = values.map((_, i) => i);
    const y = values;
    
    const regression = new SimpleLinearRegression(x, y);
    const slope = regression.slope;
    const r2 = regression.coefficientOfDetermination;
    
    // Determine significance based on R²
    let significance: 'high' | 'medium' | 'low';
    if (r2 >= 0.7) significance = 'high';
    else if (r2 >= this.trendSignificanceThreshold) significance = 'medium';
    else significance = 'low';
    
    // Determine direction based on slope and whether higher is better
    let direction: 'improving' | 'stable' | 'degrading';
    const avgValue = mean(values);
    const slopeThreshold = avgValue * 0.001; // 0.1% threshold
    
    if (Math.abs(slope) < slopeThreshold) {
      direction = 'stable';
    } else if (higherIsBetter) {
      direction = slope > 0 ? 'improving' : 'degrading';
    } else {
      direction = slope > 0 ? 'degrading' : 'improving';
    }
    
    return {
      metric: metricName,
      slope,
      r2,
      significance,
      direction
    };
  }

  private calculateDegradationScore(trends: MetricTrend[], _thresholds: any): number {
    let score = 0;
    const weights = {
      responseTime: 0.3,
      throughput: 0.25,
      errorRate: 0.3,
      cpu: 0.075,
      memory: 0.075
    };

    for (const trend of trends) {
      const weight = weights[trend.metric as keyof typeof weights] || 0.1;
      
      if (trend.direction === 'degrading') {
        let impact = 0;
        
        // Base impact on significance
        if (trend.significance === 'high') impact = 1.0;
        else if (trend.significance === 'medium') impact = 0.6;
        else impact = 0.3;
        
        // Adjust impact based on R²
        impact *= Math.min(1, trend.r2 * 1.5);
        
        score += weight * impact;
      } else if (trend.direction === 'improving') {
        // Slight negative contribution for improving metrics
        score -= weight * 0.1 * Math.min(1, trend.r2);
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private determineOverallTrend(trends: MetricTrend[]): 'improving' | 'stable' | 'degrading' {
    const significantTrends = trends.filter(t => t.significance !== 'low');
    
    if (significantTrends.length === 0) {
      return 'stable';
    }
    
    const degradingCount = significantTrends.filter(t => t.direction === 'degrading').length;
    const improvingCount = significantTrends.filter(t => t.direction === 'improving').length;
    
    if (degradingCount > improvingCount * 1.5) {
      return 'degrading';
    } else if (improvingCount > degradingCount * 1.5) {
      return 'improving';
    } else {
      return 'stable';
    }
  }

  private identifyAffectedMetrics(data: any[], baselines: any, thresholds: any) {
    const affectedMetrics: Array<{
      metric: string;
      currentValue: number;
      baselineValue: number;
      degradationPercentage: number;
      severity: 'low' | 'medium' | 'high';
    }> = [];
    
    if (data.length === 0) return affectedMetrics;
    
    // Get recent values (last 10% of data or last 24 points, whichever is smaller)
    const recentDataSize = Math.min(24, Math.max(1, Math.floor(data.length * 0.1)));
    const recentData = data.slice(-recentDataSize);
    
    // Response Time
    const avgResponseTime = mean(recentData.map(d => d.responseTime));
    const responseTimeDegradation = (avgResponseTime - baselines.responseTime) / baselines.responseTime;
    
    if (responseTimeDegradation > thresholds.responseTimeDegradation) {
      affectedMetrics.push({
        metric: 'Response Time',
        currentValue: Math.round(avgResponseTime * 100) / 100,
        baselineValue: baselines.responseTime,
        degradationPercentage: Math.round(responseTimeDegradation * 10000) / 100,
        severity: this.categorizeSeverity(responseTimeDegradation, thresholds.responseTimeDegradation)
      });
    }
    
    // Throughput
    const avgThroughput = mean(recentData.map(d => d.throughput));
    const throughputDegradation = (baselines.throughput - avgThroughput) / baselines.throughput;
    
    if (throughputDegradation > thresholds.throughputDegradation) {
      affectedMetrics.push({
        metric: 'Throughput',
        currentValue: Math.round(avgThroughput * 100) / 100,
        baselineValue: baselines.throughput,
        degradationPercentage: Math.round(throughputDegradation * 10000) / 100,
        severity: this.categorizeSeverity(throughputDegradation, thresholds.throughputDegradation)
      });
    }
    
    // Error Rate
    const avgErrorRate = mean(recentData.map(d => d.errorRate));
    const errorRateIncrease = (avgErrorRate - baselines.errorRate) / (baselines.errorRate || 0.001);
    
    if (avgErrorRate > baselines.errorRate + thresholds.errorRateIncrease) {
      affectedMetrics.push({
        metric: 'Error Rate',
        currentValue: Math.round(avgErrorRate * 10000) / 100, // Percentage
        baselineValue: Math.round(baselines.errorRate * 10000) / 100,
        degradationPercentage: Math.round(errorRateIncrease * 10000) / 100,
        severity: this.categorizeSeverity(errorRateIncrease, 1.0) // 100% increase threshold
      });
    }
    
    // Resource utilization
    const avgCpu = mean(recentData.map(d => d.resourceUtilization.cpu));
    const avgMemory = mean(recentData.map(d => d.resourceUtilization.memory));
    
    if (avgCpu > 80) {
      affectedMetrics.push({
        metric: 'CPU Utilization',
        currentValue: Math.round(avgCpu * 100) / 100,
        baselineValue: 50, // Assume 50% baseline
        degradationPercentage: Math.round((avgCpu - 50) * 100) / 100,
        severity: avgCpu > 95 ? 'high' as const : avgCpu > 85 ? 'medium' as const : 'low' as const
      });
    }
    
    if (avgMemory > 80) {
      affectedMetrics.push({
        metric: 'Memory Utilization',
        currentValue: Math.round(avgMemory * 100) / 100,
        baselineValue: 50, // Assume 50% baseline
        degradationPercentage: Math.round((avgMemory - 50) * 100) / 100,
        severity: avgMemory > 95 ? 'high' as const : avgMemory > 85 ? 'medium' as const : 'low' as const
      });
    }

    return affectedMetrics;
  }

  private categorizeSeverity(degradationRatio: number, threshold: number): 'low' | 'medium' | 'high' {
    if (degradationRatio >= threshold * 3) return 'high';
    if (degradationRatio >= threshold * 2) return 'medium';
    return 'low';
  }

  private identifyRootCauses(trends: MetricTrend[], _affectedMetrics: any[], data: any[]) {
    const rootCauses = [];
    
    // Check for resource exhaustion
    const cpuTrend = trends.find(t => t.metric === 'cpu');
    const memoryTrend = trends.find(t => t.metric === 'memory');
    
    if (cpuTrend?.direction === 'degrading' && cpuTrend.significance !== 'low') {
      rootCauses.push({
        cause: 'CPU resource exhaustion',
        probability: Math.min(0.9, cpuTrend.r2 * 1.2),
        evidence: [
          'Increasing CPU utilization trend detected',
          `R² confidence: ${Math.round(cpuTrend.r2 * 100)}%`
        ]
      });
    }
    
    if (memoryTrend?.direction === 'degrading' && memoryTrend.significance !== 'low') {
      rootCauses.push({
        cause: 'Memory leak or increased memory pressure',
        probability: Math.min(0.9, memoryTrend.r2 * 1.2),
        evidence: [
          'Increasing memory utilization trend detected',
          `R² confidence: ${Math.round(memoryTrend.r2 * 100)}%`
        ]
      });
    }
    
    // Check for error rate correlation
    const errorRateTrend = trends.find(t => t.metric === 'errorRate');
    const responseTimeTrend = trends.find(t => t.metric === 'responseTime');
    
    if (errorRateTrend?.direction === 'degrading' && responseTimeTrend?.direction === 'degrading') {
      rootCauses.push({
        cause: 'Application errors causing performance degradation',
        probability: Math.min(0.8, (errorRateTrend.r2 + responseTimeTrend.r2) / 2),
        evidence: [
          'Both error rate and response time are trending worse',
          'Correlation suggests application-level issues'
        ]
      });
    }
    
    // Check for throughput vs response time inverse correlation
    const throughputTrend = trends.find(t => t.metric === 'throughput');
    
    if (throughputTrend?.direction === 'degrading' && responseTimeTrend?.direction === 'degrading') {
      rootCauses.push({
        cause: 'System overload or bottleneck',
        probability: 0.7,
        evidence: [
          'Decreasing throughput with increasing response time',
          'Classic signs of system saturation'
        ]
      });
    }
    
    // Check for external factors based on patterns
    const recentData = data.slice(-Math.min(48, data.length)); // Last 48 data points
    if (recentData.length >= 24) {
      const timeGroups = this.groupByTimeOfDay(recentData);
      const worstPerformingHours = this.findWorstPerformingHours(timeGroups);
      
      if (worstPerformingHours.length > 0) {
        rootCauses.push({
          cause: 'Time-based performance patterns (possibly traffic-related)',
          probability: 0.6,
          evidence: [
            `Performance worst during hours: ${worstPerformingHours.join(', ')}`,
            'Suggests load or external dependency issues'
          ]
        });
      }
    }
    
    // Check for gradual vs sudden degradation
    if (data.length >= 48) {
      const firstHalf = data.slice(0, Math.floor(data.length / 2));
      const secondHalf = data.slice(Math.floor(data.length / 2));
      
      const firstHalfAvgResponse = mean(firstHalf.map(d => d.responseTime));
      const secondHalfAvgResponse = mean(secondHalf.map(d => d.responseTime));
      
      const suddenChange = (secondHalfAvgResponse - firstHalfAvgResponse) / firstHalfAvgResponse;
      
      if (suddenChange > 0.5) {
        rootCauses.push({
          cause: 'Sudden performance change (deployment or configuration)',
          probability: 0.8,
          evidence: [
            `Performance changed by ${Math.round(suddenChange * 100)}% between periods`,
            'Suggests recent deployment or configuration change'
          ]
        });
      }
    }

    return rootCauses
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5); // Top 5 most likely causes
  }

  private groupByTimeOfDay(data: any[]) {
    const groups: { [hour: number]: any[] } = {};
    
    for (const point of data) {
      const hour = point.timestamp.getHours();
      if (!groups[hour]) {
        groups[hour] = [];
      }
      groups[hour].push(point);
    }
    
    return groups;
  }

  private findWorstPerformingHours(timeGroups: { [hour: number]: any[] }): number[] {
    const hourlyAvgResponse: { hour: number; avgResponse: number }[] = [];
    
    for (const [hour, points] of Object.entries(timeGroups)) {
      if (points.length >= 2) { // Need at least 2 data points
        const avgResponse = mean(points.map(p => p.responseTime));
        hourlyAvgResponse.push({ hour: parseInt(hour), avgResponse });
      }
    }
    
    if (hourlyAvgResponse.length < 3) return [];
    
    // Find hours with response time > 1.5x the median
    const medianResponse = median(hourlyAvgResponse.map(h => h.avgResponse));
    const threshold = medianResponse * 1.5;
    
    return hourlyAvgResponse
      .filter(h => h.avgResponse > threshold)
      .map(h => h.hour)
      .sort();
  }

  private generateRecommendations(
    degradationScore: number, 
    affectedMetrics: any[], 
    rootCauses: any[]
  ) {
    const recommendations = [];
    
    // High degradation score recommendations
    if (degradationScore > 0.7) {
      recommendations.push({
        action: 'Immediate investigation and intervention required',
        priority: 'high' as const,
        estimatedImpact: 0.8
      });
    } else if (degradationScore > 0.4) {
      recommendations.push({
        action: 'Monitor closely and prepare remediation plans',
        priority: 'medium' as const,
        estimatedImpact: 0.6
      });
    }
    
    // Metric-specific recommendations
    for (const metric of affectedMetrics) {
      switch (metric.metric) {
        case 'Response Time':
          if (metric.severity === 'high') {
            recommendations.push({
              action: 'Scale up application instances or optimize slow queries',
              priority: 'high' as const,
              estimatedImpact: 0.7
            });
          }
          break;
          
        case 'Throughput':
          recommendations.push({
            action: 'Investigate bottlenecks in request processing pipeline',
            priority: 'medium' as const,
            estimatedImpact: 0.6
          });
          break;
          
        case 'Error Rate':
          recommendations.push({
            action: 'Review application logs and fix error sources',
            priority: 'high' as const,
            estimatedImpact: 0.8
          });
          break;
          
        case 'CPU Utilization':
          recommendations.push({
            action: 'Scale CPU resources or optimize CPU-intensive operations',
            priority: metric.severity === 'high' ? 'high' as const : 'medium' as const,
            estimatedImpact: 0.7
          });
          break;
          
        case 'Memory Utilization':
          recommendations.push({
            action: 'Investigate memory leaks and optimize memory usage',
            priority: metric.severity === 'high' ? 'high' as const : 'medium' as const,
            estimatedImpact: 0.6
          });
          break;
      }
    }
    
    // Root cause specific recommendations
    for (const cause of rootCauses.slice(0, 3)) { // Top 3 causes
      switch (cause.cause) {
        case 'CPU resource exhaustion':
          recommendations.push({
            action: 'Implement CPU auto-scaling and optimize CPU-bound operations',
            priority: 'high' as const,
            estimatedImpact: 0.8
          });
          break;
          
        case 'Memory leak or increased memory pressure':
          recommendations.push({
            action: 'Profile memory usage and implement memory monitoring alerts',
            priority: 'high' as const,
            estimatedImpact: 0.7
          });
          break;
          
        case 'Application errors causing performance degradation':
          recommendations.push({
            action: 'Implement comprehensive error tracking and fix high-impact errors',
            priority: 'high' as const,
            estimatedImpact: 0.9
          });
          break;
          
        case 'System overload or bottleneck':
          recommendations.push({
            action: 'Implement load balancing and identify system bottlenecks',
            priority: 'medium' as const,
            estimatedImpact: 0.7
          });
          break;
          
        case 'Sudden performance change (deployment or configuration)':
          recommendations.push({
            action: 'Review recent deployments and consider rollback if necessary',
            priority: 'high' as const,
            estimatedImpact: 0.9
          });
          break;
      }
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        action: 'Continue monitoring performance trends',
        priority: 'low' as const,
        estimatedImpact: 0.3
      });
    }
    
    // Remove duplicates and sort by priority and impact
    const uniqueRecommendations = recommendations.filter((rec, index, arr) => 
      index === arr.findIndex(r => r.action === rec.action)
    );
    
    return uniqueRecommendations
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.estimatedImpact - a.estimatedImpact;
      })
      .slice(0, 6); // Limit to 6 recommendations
  }
}