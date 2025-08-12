import { SimpleLinearRegression } from 'ml-regression';
import { mean, standardDeviation } from 'simple-statistics';
import { BudgetPredictionInput, BudgetPredictionOutput } from '../types';

interface CostProjection {
  category: string;
  currentCost: number;
  projectedCost: number;
  growthRate: number;
  confidence: number;
}

interface SpendingPattern {
  category: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: number;
  seasonality: number;
}

export class BudgetPredictor {
  private readonly forecastHorizonDays = 90; // 3 months
  private readonly alertThresholds = [0.7, 0.8, 0.9, 0.95]; // 70%, 80%, 90%, 95%
  
  constructor() {}

  async predictBudget(input: BudgetPredictionInput): Promise<BudgetPredictionOutput> {
    this.validateInput(input);

    // Analyze historical spending patterns
    const spendingPatterns = this.analyzeSpendingPatterns(input);
    
    // Project future spending
    const costProjections = this.projectCosts(input, spendingPatterns);
    
    // Generate projectedSpend timeline
    const projectedSpend = this.generateSpendingTimeline(costProjections, input);
    
    // Identify budget alerts
    const budgetAlerts = this.generateBudgetAlerts(projectedSpend, input.budgetConstraints);
    
    // Find optimization opportunities
    const optimizationOpportunities = this.identifyOptimizationOpportunities(input, spendingPatterns);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(input, budgetAlerts, optimizationOpportunities);

    return {
      projectedSpend,
      budgetAlerts,
      optimizationOpportunities,
      recommendations
    };
  }

  private validateInput(input: BudgetPredictionInput): void {
    if (!input.historicalSpend || input.historicalSpend.length < 30) {
      throw new Error('Need at least 30 days of historical spending data');
    }

    if (!input.currentUsage) {
      throw new Error('Current usage data is required');
    }

    if (!input.budgetConstraints.total || input.budgetConstraints.total <= 0) {
      throw new Error('Valid budget total is required');
    }

    // Check data quality
    const validSpendData = input.historicalSpend.filter(s => 
      s.amount >= 0 && 
      s.date instanceof Date && 
      s.category
    );

    if (validSpendData.length < input.historicalSpend.length * 0.9) {
      console.warn('Significant amount of invalid spending data detected');
    }
  }

  private analyzeSpendingPatterns(input: BudgetPredictionInput): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    
    // Group spending by category
    const categorizedSpending = this.groupByCategory(input.historicalSpend);
    
    for (const [category, spendingData] of Object.entries(categorizedSpending)) {
      if (spendingData.length < 7) continue; // Need at least a week of data
      
      // Sort by date
      const sortedData = spendingData.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Analyze trend
      const trend = this.analyzeTrend(sortedData);
      
      // Calculate volatility
      const volatility = this.calculateVolatility(sortedData);
      
      // Detect seasonality
      const seasonality = this.detectSeasonality(sortedData);
      
      patterns.push({
        category,
        trend,
        volatility,
        seasonality
      });
    }
    
    return patterns;
  }

  private groupByCategory(historicalSpend: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const spend of historicalSpend) {
      if (!grouped[spend.category]) {
        grouped[spend.category] = [];
      }
      grouped[spend.category].push(spend);
    }
    
    return grouped;
  }

  private analyzeTrend(spendingData: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (spendingData.length < 2) return 'stable';
    
    const x = spendingData.map((_, i) => i);
    const y = spendingData.map(d => d.amount);
    
    const regression = new SimpleLinearRegression(x, y);
    const slope = regression.slope;
    
    // Consider trend significant if R² > 0.5 and slope magnitude > 5% of mean
    const r2 = regression.coefficientOfDetermination;
    const avgAmount = mean(y);
    const slopeThreshold = avgAmount * 0.05 / spendingData.length; // 5% over time period
    
    if (r2 < 0.5) return 'stable';
    
    if (slope > slopeThreshold) return 'increasing';
    if (slope < -slopeThreshold) return 'decreasing';
    return 'stable';
  }

  private calculateVolatility(spendingData: any[]): number {
    if (spendingData.length < 2) return 0;
    
    const amounts = spendingData.map(d => d.amount);
    const avgAmount = mean(amounts);
    const stdAmount = standardDeviation(amounts);
    
    // Return coefficient of variation (normalized volatility)
    return avgAmount > 0 ? stdAmount / avgAmount : 0;
  }

  private detectSeasonality(spendingData: any[]): number {
    if (spendingData.length < 14) return 0; // Need at least 2 weeks
    
    // Simple weekly seasonality detection
    const weeklyBuckets: { [dayOfWeek: number]: number[] } = {};
    
    for (const spend of spendingData) {
      const dayOfWeek = spend.date.getDay();
      if (!weeklyBuckets[dayOfWeek]) {
        weeklyBuckets[dayOfWeek] = [];
      }
      weeklyBuckets[dayOfWeek].push(spend.amount);
    }
    
    const weeklyAverages = Object.values(weeklyBuckets).map(amounts => mean(amounts));
    
    if (weeklyAverages.length < 7) return 0;
    
    const overallMean = mean(weeklyAverages);
    const seasonalVariance = standardDeviation(weeklyAverages);
    
    // Return normalized seasonal strength
    return overallMean > 0 ? Math.min(1, seasonalVariance / overallMean) : 0;
  }

  private projectCosts(input: BudgetPredictionInput, patterns: SpendingPattern[]): CostProjection[] {
    const projections: CostProjection[] = [];
    
    // Project each cost category
    for (const [category, currentCost] of Object.entries(input.currentUsage)) {
      const pattern = patterns.find(p => p.category === category);
      const growthMetrics = input.growthMetrics;
      
      let growthRate = 0;
      let confidence = 0.5;
      
      if (pattern) {
        // Base growth rate on historical trend
        const historicalData = input.historicalSpend.filter(s => s.category === category);
        if (historicalData.length >= 30) {
          const monthlyGrowth = this.calculateMonthlyGrowthRate(historicalData);
          growthRate = monthlyGrowth;
          confidence = Math.max(0.3, 1 - pattern.volatility); // Higher confidence for stable patterns
        }
      }
      
      // Adjust growth rate based on business metrics
      growthRate = this.adjustGrowthRateByCategory(category, growthRate, growthMetrics);
      
      // Calculate projected cost for forecast period (3 months)
      const projectedCost = currentCost * Math.pow(1 + growthRate, 3);
      
      projections.push({
        category,
        currentCost,
        projectedCost,
        growthRate,
        confidence
      });
    }
    
    return projections;
  }

  private calculateMonthlyGrowthRate(historicalData: any[]): number {
    if (historicalData.length < 60) return 0; // Need at least 2 months
    
    // Group by month
    const monthlyTotals: { [month: string]: number } = {};
    
    for (const spend of historicalData) {
      const monthKey = `${spend.date.getFullYear()}-${spend.date.getMonth()}`;
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = 0;
      }
      monthlyTotals[monthKey] += spend.amount;
    }
    
    const months = Object.keys(monthlyTotals).sort();
    if (months.length < 2) return 0;
    
    const amounts = months.map(month => monthlyTotals[month]);
    const x = amounts.map((_, i) => i);
    const y = amounts;
    
    const regression = new SimpleLinearRegression(x, y);
    const avgAmount = mean(amounts);
    
    // Convert slope to monthly growth rate
    return avgAmount > 0 ? regression.slope / avgAmount : 0;
  }

  private adjustGrowthRateByCategory(category: string, baseGrowthRate: number, growthMetrics: any): number {
    let adjustedRate = baseGrowthRate;
    
    switch (category.toLowerCase()) {
      case 'compute':
        // Compute costs scale with traffic and user growth
        adjustedRate += (growthMetrics.trafficGrowthRate * 0.8 + growthMetrics.userGrowthRate * 0.3);
        break;
        
      case 'storage':
        // Storage grows with user data and features
        adjustedRate += (growthMetrics.userGrowthRate * 0.5 + growthMetrics.featureGrowthRate * 0.4);
        break;
        
      case 'bandwidth':
        // Bandwidth scales directly with traffic
        adjustedRate += growthMetrics.trafficGrowthRate * 0.9;
        break;
        
      case 'database':
        // Database costs scale with data volume and queries
        adjustedRate += (growthMetrics.userGrowthRate * 0.4 + growthMetrics.trafficGrowthRate * 0.6);
        break;
        
      case 'thirdparty':
        // Third-party services often scale with user growth
        adjustedRate += growthMetrics.userGrowthRate * 0.7;
        break;
        
      default:
        // Use average of all growth metrics
        adjustedRate += (growthMetrics.userGrowthRate + growthMetrics.trafficGrowthRate + growthMetrics.featureGrowthRate) / 3 * 0.5;
    }
    
    // Cap growth rates at reasonable limits
    return Math.max(-0.5, Math.min(2.0, adjustedRate)); // -50% to +200%
  }

  private generateSpendingTimeline(projections: CostProjection[], _input: BudgetPredictionInput) {
    const timeline = [];
    const startDate = new Date();
    
    for (let day = 0; day <= this.forecastHorizonDays; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      
      const dayProgress = day / this.forecastHorizonDays;
      let totalAmount = 0;
      const breakdown: Record<string, number> = {};
      
      for (const projection of projections) {
        // Interpolate between current and projected cost
        const dailyCost = projection.currentCost + 
          (projection.projectedCost - projection.currentCost) * dayProgress;
        
        breakdown[projection.category] = dailyCost;
        totalAmount += dailyCost;
      }
      
      // Calculate confidence as weighted average of category confidences
      const totalCurrentCost = projections.reduce((sum, p) => sum + p.currentCost, 0);
      const confidence = projections.reduce((weightedSum, p) => {
        const weight = totalCurrentCost > 0 ? p.currentCost / totalCurrentCost : 1 / projections.length;
        return weightedSum + (p.confidence * weight);
      }, 0);
      
      timeline.push({
        date,
        amount: Math.round(totalAmount * 100) / 100,
        breakdown,
        confidence: Math.round(confidence * 100) / 100
      });
    }
    
    return timeline;
  }

  private generateBudgetAlerts(projectedSpend: any[], budgetConstraints: any) {
    const alerts = [];
    const { total, categories, alertThresholds } = budgetConstraints;
    
    // Check overall budget alerts
    for (const threshold of (alertThresholds || this.alertThresholds)) {
      const budgetLimit = total * threshold;
      const exceedingPoint = projectedSpend.find(p => p.amount >= budgetLimit);
      
      if (exceedingPoint) {
        alerts.push({
          threshold,
          estimatedDate: exceedingPoint.date,
          category: 'total',
          severity: threshold >= 0.9 ? 'critical' as const : 'warning' as const
        });
      }
    }
    
    // Check category-specific budget alerts
    for (const [category, categoryBudget] of Object.entries(categories || {})) {
      for (const threshold of this.alertThresholds) {
        const budgetLimit = (categoryBudget as number) * threshold;
        const exceedingPoint = projectedSpend.find(p => 
          p.breakdown[category] && p.breakdown[category] >= budgetLimit
        );
        
        if (exceedingPoint) {
          alerts.push({
            threshold,
            estimatedDate: exceedingPoint.date,
            category,
            severity: threshold >= 0.9 ? 'critical' as const : 'warning' as const
          });
        }
      }
    }
    
    // Sort by date and remove duplicates
    return alerts
      .sort((a, b) => a.estimatedDate.getTime() - b.estimatedDate.getTime())
      .filter((alert, index, arr) => 
        index === 0 || 
        alert.category !== arr[index - 1].category || 
        alert.threshold !== arr[index - 1].threshold
      )
      .slice(0, 10); // Limit to 10 most urgent alerts
  }

  private identifyOptimizationOpportunities(input: BudgetPredictionInput, patterns: SpendingPattern[]) {
    const opportunities = [];
    
    // Analyze each category for optimization potential
    for (const [category, currentCost] of Object.entries(input.currentUsage)) {
      const pattern = patterns.find(p => p.category === category);
      
      if (!pattern) continue;
      
      // High volatility indicates potential for optimization
      if (pattern.volatility > 0.3) {
        const potentialSavings = currentCost * pattern.volatility * 0.3; // Conservative estimate
        opportunities.push({
          category,
          potentialSavings,
          effort: 'medium' as const,
          description: `High cost volatility detected. Implement auto-scaling and resource optimization.`
        });
      }
      
      // Rapidly increasing costs
      if (pattern.trend === 'increasing') {
        const monthlyCostData = input.historicalSpend
          .filter(s => s.category === category)
          .slice(-30); // Last 30 days
        
        if (monthlyCostData.length > 0) {
          const avgDailyCost = mean(monthlyCostData.map(s => s.amount));
          if (avgDailyCost > currentCost * 0.8) { // Cost increased significantly
            opportunities.push({
              category,
              potentialSavings: currentCost * 0.15,
              effort: 'high' as const,
              description: `Rapid cost increase detected. Review resource allocation and usage patterns.`
            });
          }
        }
      }
      
      // Category-specific optimizations
      const categoryOpportunities = this.getCategorySpecificOptimizations(category, currentCost);
      opportunities.push(...categoryOpportunities);
    }
    
    // Sort by potential savings (highest first) and limit results
    return opportunities
      .sort((a, b) => b.potentialSavings - a.potentialSavings)
      .slice(0, 8);
  }

  private getCategorySpecificOptimizations(category: string, currentCost: number) {
    const opportunities = [];
    
    switch (category.toLowerCase()) {
      case 'compute':
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.20,
          effort: 'low' as const,
          description: 'Implement reserved instances or spot instances for predictable workloads'
        });
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.15,
          effort: 'medium' as const,
          description: 'Optimize container resource requests and implement horizontal pod autoscaling'
        });
        break;
        
      case 'storage':
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.25,
          effort: 'low' as const,
          description: 'Implement data lifecycle policies and move old data to cheaper storage tiers'
        });
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.10,
          effort: 'medium' as const,
          description: 'Enable compression and deduplication for storage systems'
        });
        break;
        
      case 'bandwidth':
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.18,
          effort: 'low' as const,
          description: 'Implement CDN caching and optimize asset delivery'
        });
        break;
        
      case 'database':
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.12,
          effort: 'medium' as const,
          description: 'Optimize database queries and implement connection pooling'
        });
        break;
        
      case 'thirdparty':
        opportunities.push({
          category,
          potentialSavings: currentCost * 0.08,
          effort: 'high' as const,
          description: 'Review third-party service usage and negotiate better rates or find alternatives'
        });
        break;
    }
    
    return opportunities.filter(opp => opp.potentialSavings >= currentCost * 0.05); // Only significant savings
  }

  private generateRecommendations(
    input: BudgetPredictionInput, 
    alerts: any[], 
    optimizations: any[]
  ): string[] {
    const recommendations = [];
    
    // Critical budget alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('URGENT: Critical budget thresholds will be exceeded soon. Immediate action required.');
      recommendations.push('Review and implement cost optimization measures immediately.');
    }
    
    // Warning alerts
    const warningAlerts = alerts.filter(a => a.severity === 'warning');
    if (warningAlerts.length > 0) {
      recommendations.push('Budget warning thresholds approaching. Plan cost optimization measures.');
    }
    
    // Top optimization opportunities
    const topOptimizations = optimizations.slice(0, 3);
    if (topOptimizations.length > 0) {
      recommendations.push(`Focus on optimizing ${topOptimizations.map(o => o.category).join(', ')} costs first.`);
      
      const lowEffortOpts = topOptimizations.filter(o => o.effort === 'low');
      if (lowEffortOpts.length > 0) {
        recommendations.push('Start with low-effort optimizations for quick wins.');
      }
    }
    
    // Growth-based recommendations
    const { userGrowthRate, trafficGrowthRate, featureGrowthRate } = input.growthMetrics;
    const avgGrowthRate = (userGrowthRate + trafficGrowthRate + featureGrowthRate) / 3;
    
    if (avgGrowthRate > 0.1) { // 10% growth
      recommendations.push('High growth detected. Consider implementing auto-scaling and reserved capacity.');
    }
    
    if (avgGrowthRate > 0.2) { // 20% growth
      recommendations.push('Very high growth. Review budget allocation and consider increasing limits proactively.');
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Current budget trajectory looks healthy. Continue monitoring.');
      recommendations.push('Consider implementing cost monitoring alerts for proactive management.');
    }
    
    return recommendations;
  }
}