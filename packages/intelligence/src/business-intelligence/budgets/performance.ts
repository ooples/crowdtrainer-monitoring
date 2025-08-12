import { EventEmitter } from 'events';

export interface PerformanceBudget {
  id: string;
  name: string;
  description: string;
  owner: string; // Team or individual responsible
  
  // Scope definition
  scope: {
    features: string[]; // Feature names or IDs
    endpoints: string[]; // API endpoints
    pages: string[]; // Web pages
    components: string[]; // Component names
    userSegments: string[]; // User groups (e.g., 'premium', 'free', 'mobile')
  };
  
  // Budget constraints
  budgets: {
    responseTime: { target: number; warning: number; critical: number }; // ms
    throughput: { target: number; warning: number; critical: number }; // req/s
    errorRate: { target: number; warning: number; critical: number }; // %
    availability: { target: number; warning: number; critical: number }; // %
    
    // Web Vitals (for frontend budgets)
    lcp?: { target: number; warning: number; critical: number }; // Largest Contentful Paint (ms)
    fid?: { target: number; warning: number; critical: number }; // First Input Delay (ms)
    cls?: { target: number; warning: number; critical: number }; // Cumulative Layout Shift (score)
    
    // Resource budgets
    cpuUsage?: { target: number; warning: number; critical: number }; // %
    memoryUsage?: { target: number; warning: number; critical: number }; // MB
    bundleSize?: { target: number; warning: number; critical: number }; // KB
    
    // Custom metrics
    customMetrics?: Record<string, { target: number; warning: number; critical: number }>;
  };
  
  // Time windows for evaluation
  evaluationWindow: {
    duration: number; // minutes
    sampleRate: number; // measurements per minute
  };
  
  // Alerting configuration
  alerting: {
    enabled: boolean;
    channels: string[]; // slack, email, webhook
    escalationPolicy: {
      warning: { delay: number; recipients: string[] }; // minutes
      critical: { delay: number; recipients: string[] };
    };
  };
  
  tags: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMeasurement {
  budgetId: string;
  timestamp: Date;
  source: string; // Feature, endpoint, page, etc.
  
  metrics: {
    responseTime?: number;
    throughput?: number;
    errorRate?: number;
    availability?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    bundleSize?: number;
    customMetrics?: Record<string, number>;
  };
  
  userSegment?: string;
  requestId?: string;
  sessionId?: string;
  tags: Record<string, string>;
}

export interface BudgetViolation {
  id: string;
  budgetId: string;
  budgetName: string;
  metric: string;
  severity: 'warning' | 'critical';
  
  actual: number;
  budget: number;
  deviation: number; // How much over budget (%)
  
  startTime: Date;
  endTime?: Date;
  duration?: number; // minutes
  
  affectedSources: string[];
  affectedUsers?: number;
  
  tags: Record<string, string>;
}

export interface BudgetStatus {
  budget: PerformanceBudget;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastEvaluated: Date;
  
  metricStatuses: Array<{
    metric: string;
    status: 'healthy' | 'warning' | 'critical';
    current: number;
    target: number;
    utilization: number; // % of budget used
    trend: 'improving' | 'stable' | 'degrading';
  }>;
  
  activeViolations: BudgetViolation[];
  violationHistory: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  
  recommendations: string[];
  riskScore: number; // 0-100
}

export interface TeamPerformanceReport {
  teamId: string;
  teamName: string;
  reportPeriod: { start: Date; end: Date };
  
  budgets: Array<{
    budgetId: string;
    budgetName: string;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    compliance: number; // % of time within budget
    violations: number;
    avgPerformance: Record<string, number>;
  }>;
  
  summary: {
    totalBudgets: number;
    healthyBudgets: number;
    budgetsInViolation: number;
    overallCompliance: number;
    performanceTrend: 'improving' | 'stable' | 'degrading';
  };
  
  topIssues: Array<{
    issue: string;
    impact: 'high' | 'medium' | 'low';
    affectedBudgets: string[];
    recommendation: string;
  }>;
  
  achievements: Array<{
    achievement: string;
    budgets: string[];
    improvement: number; // % improvement
  }>;
}

export class PerformanceBudgetTracker extends EventEmitter {
  private budgets = new Map<string, PerformanceBudget>();
  private measurements = new Map<string, PerformanceMeasurement[]>();
  private violations = new Map<string, BudgetViolation[]>();
  private evaluationTimers = new Map<string, NodeJS.Timeout>();

  constructor(private config: {
    maxMeasurementsPerBudget: number;
    evaluationIntervalMinutes: number;
    violationRetentionDays: number;
  } = {
    maxMeasurementsPerBudget: 10000,
    evaluationIntervalMinutes: 5,
    violationRetentionDays: 90
  }) {
    super();
  }

  /**
   * Create a new performance budget
   */
  createBudget(budget: PerformanceBudget): void {
    budget.createdAt = new Date();
    budget.updatedAt = new Date();
    
    this.budgets.set(budget.id, budget);
    this.measurements.set(budget.id, []);
    this.violations.set(budget.id, []);
    
    // Start periodic evaluation
    this.startBudgetEvaluation(budget.id);
    
    this.emit('budget_created', { budget });
  }

  /**
   * Update an existing performance budget
   */
  updateBudget(budgetId: string, updates: Partial<PerformanceBudget>): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    const updatedBudget = { ...budget, ...updates, updatedAt: new Date() };
    this.budgets.set(budgetId, updatedBudget);
    
    // Restart evaluation with new configuration
    this.stopBudgetEvaluation(budgetId);
    this.startBudgetEvaluation(budgetId);
    
    this.emit('budget_updated', { budget: updatedBudget, changes: updates });
  }

  /**
   * Delete a performance budget
   */
  deleteBudget(budgetId: string): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    this.stopBudgetEvaluation(budgetId);
    this.budgets.delete(budgetId);
    this.measurements.delete(budgetId);
    this.violations.delete(budgetId);
    
    this.emit('budget_deleted', { budgetId, budget });
  }

  /**
   * Record a performance measurement
   */
  recordMeasurement(measurement: PerformanceMeasurement): void {
    const budget = this.budgets.get(measurement.budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${measurement.budgetId}`);
    }

    // Validate measurement scope
    if (!this.isValidMeasurement(measurement, budget)) {
      return; // Silently ignore out-of-scope measurements
    }

    const measurements = this.measurements.get(measurement.budgetId) || [];
    measurements.push(measurement);
    
    // Maintain measurement history limit
    if (measurements.length > this.config.maxMeasurementsPerBudget) {
      measurements.shift();
    }
    
    this.measurements.set(measurement.budgetId, measurements);
    
    // Immediate evaluation for critical metrics
    this.evaluateRealTimeViolations(measurement.budgetId, measurement);
    
    this.emit('measurement_recorded', { budgetId: measurement.budgetId, measurement });
  }

  /**
   * Get current status of a performance budget
   */
  getBudgetStatus(budgetId: string): BudgetStatus | null {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return null;
    }

    return this.calculateBudgetStatus(budgetId);
  }

  /**
   * Get all budget statuses
   */
  getAllBudgetStatuses(): Map<string, BudgetStatus> {
    const statuses = new Map<string, BudgetStatus>();
    
    for (const budgetId of Array.from(this.budgets.keys())) {
      const status = this.calculateBudgetStatus(budgetId);
      if (status) {
        statuses.set(budgetId, status);
      }
    }
    
    return statuses;
  }

  /**
   * Get performance report for a specific team
   */
  getTeamPerformanceReport(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): TeamPerformanceReport {
    // Find budgets owned by this team
    const teamBudgets = Array.from(this.budgets.values()).filter(
      budget => budget.owner === teamId || budget.tags.team === teamId
    );

    const budgetReports = teamBudgets.map(budget => {
      const status = this.calculateBudgetStatus(budget.id);
      const measurements = this.getMeasurementsInPeriod(budget.id, startDate, endDate);
      const violations = this.getViolationsInPeriod(budget.id, startDate, endDate);
      
      const compliance = this.calculateCompliance(measurements, budget);
      const avgPerformance = this.calculateAveragePerformance(measurements);
      
      return {
        budgetId: budget.id,
        budgetName: budget.name,
        status: status?.status || 'unknown',
        compliance,
        violations: violations.length,
        avgPerformance
      };
    });

    // Calculate summary statistics
    const summary = {
      totalBudgets: budgetReports.length,
      healthyBudgets: budgetReports.filter(b => b.status === 'healthy').length,
      budgetsInViolation: budgetReports.filter(b => b.violations > 0).length,
      overallCompliance: budgetReports.reduce((sum, b) => sum + b.compliance, 0) / budgetReports.length || 0,
      performanceTrend: this.calculateTeamPerformanceTrend(teamId, startDate, endDate)
    };

    // Identify top issues and achievements
    const topIssues = this.identifyTopIssues(teamBudgets, startDate, endDate);
    const achievements = this.identifyAchievements(teamBudgets, startDate, endDate);

    return {
      teamId,
      teamName: teamId, // In a real system, this would be resolved from a team service
      reportPeriod: { start: startDate, end: endDate },
      budgets: budgetReports,
      summary,
      topIssues,
      achievements
    };
  }

  /**
   * Get budget compliance over time
   */
  getBudgetCompliance(
    budgetId: string,
    startDate: Date,
    endDate: Date,
    intervalMinutes: number = 60
  ): Array<{
    timestamp: Date;
    compliance: number;
    violations: number;
    avgPerformance: Record<string, number>;
  }> {
    const measurements = this.getMeasurementsInPeriod(budgetId, startDate, endDate);
    const budget = this.budgets.get(budgetId);
    
    if (!budget || measurements.length === 0) {
      return [];
    }

    const intervals = this.groupMeasurementsByInterval(measurements, intervalMinutes);
    
    return intervals.map(interval => ({
      timestamp: interval.start,
      compliance: this.calculateCompliance(interval.measurements, budget),
      violations: this.countViolationsInMeasurements(interval.measurements, budget),
      avgPerformance: this.calculateAveragePerformance(interval.measurements)
    }));
  }

  /**
   * Get feature-level performance breakdown
   */
  getFeaturePerformanceBreakdown(
    budgetId: string,
    feature: string,
    startDate: Date,
    endDate: Date
  ): {
    feature: string;
    totalMeasurements: number;
    avgPerformance: Record<string, number>;
    violations: BudgetViolation[];
    compliance: number;
    trend: 'improving' | 'stable' | 'degrading';
  } | null {
    const measurements = this.getMeasurementsInPeriod(budgetId, startDate, endDate)
      .filter(m => m.source === feature || m.tags.feature === feature);
    
    const budget = this.budgets.get(budgetId);
    if (!budget || measurements.length === 0) {
      return null;
    }

    const violations = this.getViolationsInPeriod(budgetId, startDate, endDate)
      .filter(v => v.affectedSources.includes(feature));

    const avgPerformance = this.calculateAveragePerformance(measurements);
    const compliance = this.calculateCompliance(measurements, budget);
    const trend = this.calculatePerformanceTrend(measurements);

    return {
      feature,
      totalMeasurements: measurements.length,
      avgPerformance,
      violations,
      compliance,
      trend
    };
  }

  private calculateBudgetStatus(budgetId: string): BudgetStatus | null {
    const budget = this.budgets.get(budgetId);
    const measurements = this.measurements.get(budgetId) || [];
    const violations = this.violations.get(budgetId) || [];
    
    if (!budget) {
      return null;
    }

    // Get recent measurements for current status
    const recentCutoff = new Date(Date.now() - budget.evaluationWindow.duration * 60 * 1000);
    const recentMeasurements = measurements.filter(m => m.timestamp >= recentCutoff);
    
    // Calculate metric statuses
    const metricStatuses = this.calculateMetricStatuses(recentMeasurements, budget);
    
    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    if (metricStatuses.some(m => m.status === 'critical')) {
      overallStatus = 'critical';
    } else if (metricStatuses.some(m => m.status === 'warning')) {
      overallStatus = 'warning';
    } else if (recentMeasurements.length === 0) {
      overallStatus = 'unknown';
    }

    // Get active violations
    const activeViolations = violations.filter(v => !v.endTime);
    
    // Calculate violation history
    const now = new Date();
    const violationHistory = {
      last24h: violations.filter(v => v.startTime >= new Date(now.getTime() - 24 * 60 * 60 * 1000)).length,
      last7d: violations.filter(v => v.startTime >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length,
      last30d: violations.filter(v => v.startTime >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(budget, metricStatuses, violations);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(metricStatuses, violationHistory, activeViolations.length);

    return {
      budget,
      status: overallStatus,
      lastEvaluated: new Date(),
      metricStatuses,
      activeViolations,
      violationHistory,
      recommendations,
      riskScore
    };
  }

  private calculateMetricStatuses(
    measurements: PerformanceMeasurement[],
    budget: PerformanceBudget
  ): BudgetStatus['metricStatuses'] {
    const statuses: BudgetStatus['metricStatuses'] = [];
    
    if (measurements.length === 0) {
      return statuses;
    }

    // Calculate averages for each metric
    const avgMetrics = this.calculateAveragePerformance(measurements);
    
    // Evaluate each budget constraint
    Object.entries(budget.budgets).forEach(([metricName, constraint]) => {
      if (typeof constraint === 'object' && 'target' in constraint) {
        const currentValue = avgMetrics[metricName];
        if (currentValue !== undefined) {
          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          
          // Determine status based on thresholds (logic depends on metric type)
          const isLowerBetter = ['responseTime', 'errorRate', 'lcp', 'fid', 'cls', 'cpuUsage', 'memoryUsage'].includes(metricName);
          
          if (isLowerBetter) {
            if (currentValue >= (constraint as any).critical) status = 'critical';
            else if (currentValue >= (constraint as any).warning) status = 'warning';
          } else {
            if (currentValue <= (constraint as any).critical) status = 'critical';
            else if (currentValue <= (constraint as any).warning) status = 'warning';
          }
          
          const utilization = isLowerBetter 
            ? (currentValue / (constraint as any).target) * 100
            : ((constraint as any).target / currentValue) * 100;
          
          const trend = this.calculateMetricTrend(measurements, metricName);
          
          statuses.push({
            metric: metricName,
            status,
            current: currentValue,
            target: (constraint as any).target,
            utilization: Math.min(200, Math.max(0, utilization)), // Cap at 200%
            trend
          });
        }
      }
    });

    return statuses;
  }

  private calculateMetricTrend(
    measurements: PerformanceMeasurement[],
    metricName: string
  ): 'improving' | 'stable' | 'degrading' {
    if (measurements.length < 4) return 'stable';

    // Split measurements into two halves and compare
    const midPoint = Math.floor(measurements.length / 2);
    const earlierMeasurements = measurements.slice(0, midPoint);
    const laterMeasurements = measurements.slice(midPoint);
    
    const earlierAvg = this.calculateAverageForMetric(earlierMeasurements, metricName);
    const laterAvg = this.calculateAverageForMetric(laterMeasurements, metricName);
    
    if (earlierAvg === 0 || laterAvg === 0) return 'stable';
    
    const changePercent = ((laterAvg - earlierAvg) / earlierAvg) * 100;
    
    // For metrics where lower is better
    const isLowerBetter = ['responseTime', 'errorRate', 'lcp', 'fid', 'cls', 'cpuUsage', 'memoryUsage'].includes(metricName);
    
    if (Math.abs(changePercent) < 5) return 'stable'; // Less than 5% change
    
    if (isLowerBetter) {
      return changePercent < 0 ? 'improving' : 'degrading';
    } else {
      return changePercent > 0 ? 'improving' : 'degrading';
    }
  }

  private calculateAverageForMetric(measurements: PerformanceMeasurement[], metricName: string): number {
    const values = measurements
      .map(m => m.metrics[metricName as keyof typeof m.metrics])
      .filter((val): val is number => typeof val === 'number' && !isNaN(val));
    
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private isValidMeasurement(measurement: PerformanceMeasurement, budget: PerformanceBudget): boolean {
    const { scope } = budget;
    
    // Check if measurement source matches budget scope
    return (
      scope.features.length === 0 || scope.features.includes(measurement.source) ||
      scope.endpoints.length === 0 || scope.endpoints.includes(measurement.source) ||
      scope.pages.length === 0 || scope.pages.includes(measurement.source) ||
      scope.components.length === 0 || scope.components.includes(measurement.source) ||
      scope.userSegments.length === 0 || scope.userSegments.includes(measurement.userSegment || '')
    );
  }

  private evaluateRealTimeViolations(budgetId: string, measurement: PerformanceMeasurement): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    const violations: BudgetViolation[] = [];

    // Check each metric against its budget
    Object.entries(measurement.metrics).forEach(([metricName, value]) => {
      if (typeof value === 'number') {
        const constraint = budget.budgets[metricName as keyof typeof budget.budgets];
        if (constraint && typeof constraint === 'object' && 'critical' in constraint) {
          const isLowerBetter = ['responseTime', 'errorRate', 'lcp', 'fid', 'cls', 'cpuUsage', 'memoryUsage'].includes(metricName);
          
          let severity: 'warning' | 'critical' | null = null;
          
          if (isLowerBetter) {
            if (value >= (constraint as any).critical) severity = 'critical';
            else if (value >= (constraint as any).warning) severity = 'warning';
          } else {
            if (value <= (constraint as any).critical) severity = 'critical';
            else if (value <= (constraint as any).warning) severity = 'warning';
          }
          
          if (severity) {
            const budgetValue = severity === 'critical' ? (constraint as any).critical : (constraint as any).warning;
            const deviation = Math.abs((value - budgetValue) / budgetValue) * 100;
            
            violations.push({
              id: `${budgetId}-${metricName}-${Date.now()}`,
              budgetId,
              budgetName: budget.name,
              metric: metricName,
              severity,
              actual: value,
              budget: budgetValue,
              deviation,
              startTime: measurement.timestamp,
              affectedSources: [measurement.source],
              tags: measurement.tags
            });
          }
        }
      }
    });

    // Store violations
    if (violations.length > 0) {
      const existingViolations = this.violations.get(budgetId) || [];
      existingViolations.push(...violations);
      this.violations.set(budgetId, existingViolations);
      
      violations.forEach(violation => {
        this.emit('budget_violation', { violation, budget });
      });
    }
  }

  private startBudgetEvaluation(budgetId: string): void {
    const timer = setInterval(() => {
      this.evaluateBudget(budgetId);
    }, this.config.evaluationIntervalMinutes * 60 * 1000);
    
    this.evaluationTimers.set(budgetId, timer);
  }

  private stopBudgetEvaluation(budgetId: string): void {
    const timer = this.evaluationTimers.get(budgetId);
    if (timer) {
      clearInterval(timer);
      this.evaluationTimers.delete(budgetId);
    }
  }

  private evaluateBudget(budgetId: string): void {
    const status = this.calculateBudgetStatus(budgetId);
    if (status) {
      this.emit('budget_evaluated', { budgetId, status });
      
      // Clean up old violations
      this.cleanupOldViolations(budgetId);
    }
  }

  private cleanupOldViolations(budgetId: string): void {
    const violations = this.violations.get(budgetId) || [];
    const cutoffDate = new Date(Date.now() - this.config.violationRetentionDays * 24 * 60 * 60 * 1000);
    
    const recentViolations = violations.filter(v => v.startTime >= cutoffDate);
    this.violations.set(budgetId, recentViolations);
  }

  // Additional helper methods for reports and analysis...
  private getMeasurementsInPeriod(budgetId: string, start: Date, end: Date): PerformanceMeasurement[] {
    const measurements = this.measurements.get(budgetId) || [];
    return measurements.filter(m => m.timestamp >= start && m.timestamp <= end);
  }

  private getViolationsInPeriod(budgetId: string, start: Date, end: Date): BudgetViolation[] {
    const violations = this.violations.get(budgetId) || [];
    return violations.filter(v => v.startTime >= start && v.startTime <= end);
  }

  private calculateCompliance(measurements: PerformanceMeasurement[], budget: PerformanceBudget): number {
    if (measurements.length === 0) return 100;

    let compliantMeasurements = 0;
    measurements.forEach(measurement => {
      let isCompliant = true;
      
      Object.entries(measurement.metrics).forEach(([metricName, value]) => {
        if (typeof value === 'number') {
          const constraint = budget.budgets[metricName as keyof typeof budget.budgets];
          if (constraint && typeof constraint === 'object' && 'target' in constraint) {
            const isLowerBetter = ['responseTime', 'errorRate', 'lcp', 'fid', 'cls', 'cpuUsage', 'memoryUsage'].includes(metricName);
            
            if (isLowerBetter && value > (constraint as any).target) {
              isCompliant = false;
            } else if (!isLowerBetter && value < (constraint as any).target) {
              isCompliant = false;
            }
          }
        }
      });
      
      if (isCompliant) compliantMeasurements++;
    });

    return (compliantMeasurements / measurements.length) * 100;
  }

  private calculateAveragePerformance(measurements: PerformanceMeasurement[]): Record<string, number> {
    if (measurements.length === 0) return {};

    const metricTotals: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};

    measurements.forEach(measurement => {
      Object.entries(measurement.metrics).forEach(([metricName, value]) => {
        if (typeof value === 'number' && !isNaN(value)) {
          metricTotals[metricName] = (metricTotals[metricName] || 0) + value;
          metricCounts[metricName] = (metricCounts[metricName] || 0) + 1;
        }
      });
    });

    const averages: Record<string, number> = {};
    Object.keys(metricTotals).forEach(metricName => {
      averages[metricName] = metricTotals[metricName] / metricCounts[metricName];
    });

    return averages;
  }

  private calculatePerformanceTrend(measurements: PerformanceMeasurement[]): 'improving' | 'stable' | 'degrading' {
    if (measurements.length < 4) return 'stable';

    // Simple trend calculation based on overall performance score
    const midPoint = Math.floor(measurements.length / 2);
    const earlierMeasurements = measurements.slice(0, midPoint);
    const laterMeasurements = measurements.slice(midPoint);

    const earlierScore = this.calculateOverallPerformanceScore(earlierMeasurements);
    const laterScore = this.calculateOverallPerformanceScore(laterMeasurements);

    const changePercent = ((laterScore - earlierScore) / Math.max(earlierScore, 1)) * 100;

    if (Math.abs(changePercent) < 5) return 'stable';
    return changePercent > 0 ? 'improving' : 'degrading';
  }

  private calculateOverallPerformanceScore(measurements: PerformanceMeasurement[]): number {
    // Simplified performance score calculation
    // In reality, this would be weighted based on business importance
    const avg = this.calculateAveragePerformance(measurements);
    
    let score = 100;
    
    // Penalize based on response time
    if (avg.responseTime) {
      score -= Math.min(50, avg.responseTime / 100); // Penalty for high response times
    }
    
    // Penalize based on error rate
    if (avg.errorRate) {
      score -= avg.errorRate * 10; // Heavy penalty for errors
    }
    
    return Math.max(0, score);
  }

  private calculateTeamPerformanceTrend(teamId: string, start: Date, end: Date): 'improving' | 'stable' | 'degrading' {
    // Simplified implementation
    return 'stable';
  }

  private identifyTopIssues(budgets: PerformanceBudget[], start: Date, end: Date): TeamPerformanceReport['topIssues'] {
    // Simplified implementation - would analyze patterns in violations
    return [];
  }

  private identifyAchievements(budgets: PerformanceBudget[], start: Date, end: Date): TeamPerformanceReport['achievements'] {
    // Simplified implementation - would identify improvements
    return [];
  }

  private groupMeasurementsByInterval(measurements: PerformanceMeasurement[], intervalMinutes: number) {
    // Group measurements by time intervals
    const intervals: Array<{ start: Date; measurements: PerformanceMeasurement[] }> = [];
    // Implementation would group measurements into time buckets
    return intervals;
  }

  private countViolationsInMeasurements(measurements: PerformanceMeasurement[], budget: PerformanceBudget): number {
    // Count how many measurements violate budget constraints
    return 0; // Simplified
  }

  private generateRecommendations(
    budget: PerformanceBudget,
    metricStatuses: BudgetStatus['metricStatuses'],
    violations: BudgetViolation[]
  ): string[] {
    const recommendations: string[] = [];
    
    metricStatuses.forEach(status => {
      if (status.status === 'critical' || status.status === 'warning') {
        switch (status.metric) {
          case 'responseTime':
            recommendations.push('Consider optimizing database queries or adding caching for improved response times');
            break;
          case 'throughput':
            recommendations.push('Review system capacity and consider horizontal scaling');
            break;
          case 'errorRate':
            recommendations.push('Investigate recent deployments and error patterns');
            break;
          case 'lcp':
            recommendations.push('Optimize image loading and reduce render-blocking resources');
            break;
          case 'bundleSize':
            recommendations.push('Consider code splitting and removing unused dependencies');
            break;
        }
      }
    });

    return recommendations;
  }

  private calculateRiskScore(
    metricStatuses: BudgetStatus['metricStatuses'],
    violationHistory: BudgetStatus['violationHistory'],
    activeViolations: number
  ): number {
    let riskScore = 0;
    
    // Base risk from current metric statuses
    metricStatuses.forEach(status => {
      if (status.status === 'critical') riskScore += 30;
      else if (status.status === 'warning') riskScore += 15;
      
      // Add risk based on utilization
      if (status.utilization > 90) riskScore += 20;
      else if (status.utilization > 80) riskScore += 10;
      
      // Add risk based on trend
      if (status.trend === 'degrading') riskScore += 10;
    });
    
    // Add risk from violation history
    riskScore += violationHistory.last24h * 5;
    riskScore += violationHistory.last7d * 2;
    riskScore += activeViolations * 10;
    
    return Math.min(100, riskScore);
  }
}

// Factory functions for common budget types
export const createWebPageBudget = (
  id: string,
  name: string,
  pages: string[],
  owner: string
): PerformanceBudget => ({
  id,
  name,
  description: `Performance budget for web pages: ${pages.join(', ')}`,
  owner,
  scope: {
    features: [],
    endpoints: [],
    pages,
    components: [],
    userSegments: []
  },
  budgets: {
    responseTime: { target: 200, warning: 500, critical: 1000 },
    throughput: { target: 1000, warning: 500, critical: 100 },
    errorRate: { target: 0.1, warning: 1, critical: 5 },
    availability: { target: 99.9, warning: 99, critical: 95 },
    lcp: { target: 2500, warning: 4000, critical: 6000 },
    fid: { target: 100, warning: 300, critical: 500 },
    cls: { target: 0.1, warning: 0.25, critical: 0.5 }
  },
  evaluationWindow: { duration: 60, sampleRate: 1 },
  alerting: {
    enabled: true,
    channels: ['slack', 'email'],
    escalationPolicy: {
      warning: { delay: 15, recipients: [owner] },
      critical: { delay: 5, recipients: [owner] }
    }
  },
  tags: { type: 'web-page' },
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createAPIBudget = (
  id: string,
  name: string,
  endpoints: string[],
  owner: string
): PerformanceBudget => ({
  id,
  name,
  description: `Performance budget for API endpoints: ${endpoints.join(', ')}`,
  owner,
  scope: {
    features: [],
    endpoints,
    pages: [],
    components: [],
    userSegments: []
  },
  budgets: {
    responseTime: { target: 100, warning: 200, critical: 500 },
    throughput: { target: 5000, warning: 2000, critical: 500 },
    errorRate: { target: 0.01, warning: 0.1, critical: 1 },
    availability: { target: 99.99, warning: 99.9, critical: 99 }
  },
  evaluationWindow: { duration: 30, sampleRate: 2 },
  alerting: {
    enabled: true,
    channels: ['slack'],
    escalationPolicy: {
      warning: { delay: 10, recipients: [owner] },
      critical: { delay: 2, recipients: [owner] }
    }
  },
  tags: { type: 'api' },
  createdAt: new Date(),
  updatedAt: new Date()
});

export default PerformanceBudgetTracker;