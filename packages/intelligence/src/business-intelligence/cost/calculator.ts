export interface CurrencyConversion {
  from: string;
  to: string;
  rate: number;
  lastUpdated: Date;
}

export interface CostModel {
  id: string;
  name: string;
  currency: string;
  
  // Revenue impact
  revenuePerMinute: number; // Average revenue per minute
  revenuePerTransaction: number; // Revenue per completed transaction
  
  // Cost structure
  infrastructureCostPerHour: number;
  staffCostPerHour: number; // On-call, incident response costs
  penaltyCostPerIncident: number; // SLA penalty costs
  
  // Customer impact
  customerAcquisitionCost: number;
  customerLifetimeValue: number;
  churnRatePerDowntimeHour: number; // % of customers lost per hour of downtime
  
  // Business metrics
  transactionsPerMinute: number;
  conversionRate: number; // % of users that convert during normal operations
  downtimeConversionPenalty: number; // Reduction in conversion rate during issues
}

export interface IncidentImpact {
  incidentId: string;
  startTime: Date;
  endTime?: Date; // undefined if ongoing
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  affectedUsers: number;
  affectedTransactions: number;
  
  // Calculated impacts
  directRevenueLoss: number;
  infrastructureCost: number;
  staffCost: number;
  penaltyCost: number;
  customerChurnCost: number;
  totalCost: number;
  
  currency: string;
  costBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface CostForecast {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  projectedDowntimeMinutes: number;
  projectedIncidents: number;
  estimatedCost: number;
  confidence: number; // 0-100%
  factors: {
    historical: number; // Weight of historical data
    seasonal: number; // Seasonal adjustments
    trend: number; // Trend-based adjustments
  };
}

export class CostCalculator {
  private costModels = new Map<string, CostModel>();
  private currencyRates = new Map<string, CurrencyConversion[]>();
  private incidents: IncidentImpact[] = [];

  constructor(private config: {
    baseCurrency: string;
    exchangeRateUpdateInterval: number; // minutes
    historicalDataRetentionDays: number;
  } = {
    baseCurrency: 'USD',
    exchangeRateUpdateInterval: 60,
    historicalDataRetentionDays: 365
  }) {
    this.initializeDefaultExchangeRates();
  }

  /**
   * Add or update a cost model
   */
  addCostModel(model: CostModel): void {
    this.costModels.set(model.id, model);
  }

  /**
   * Calculate the cost impact of downtime/errors with multi-currency support
   */
  calculateIncidentCost(
    incidentId: string,
    startTime: Date,
    endTime: Date | undefined,
    severity: 'low' | 'medium' | 'high' | 'critical',
    affectedServices: string[],
    affectedUsers: number,
    modelId: string,
    targetCurrency?: string
  ): IncidentImpact {
    const model = this.costModels.get(modelId);
    if (!model) {
      throw new Error(`Cost model not found: ${modelId}`);
    }

    const durationMinutes = endTime 
      ? (endTime.getTime() - startTime.getTime()) / (1000 * 60)
      : (Date.now() - startTime.getTime()) / (1000 * 60);

    const durationHours = durationMinutes / 60;

    // Calculate severity multipliers
    const severityMultiplier = this.getSeverityMultiplier(severity);
    
    // Calculate direct revenue loss
    const lostTransactions = (model.transactionsPerMinute * durationMinutes) * severityMultiplier;
    const directRevenueLoss = (model.revenuePerMinute * durationMinutes * severityMultiplier) +
                             (lostTransactions * model.revenuePerTransaction * (1 - model.downtimeConversionPenalty));

    // Calculate infrastructure costs
    const infrastructureCost = model.infrastructureCostPerHour * durationHours;

    // Calculate staff costs (incident response)
    const staffCost = model.staffCostPerHour * durationHours * severityMultiplier;

    // Calculate penalty costs
    const penaltyCost = this.calculatePenaltyCosts(severity, durationMinutes, model);

    // Calculate customer churn cost
    const churnedCustomers = (affectedUsers * model.churnRatePerDowntimeHour * durationHours) / 100;
    const customerChurnCost = churnedCustomers * model.customerLifetimeValue;

    const totalCostBase = directRevenueLoss + infrastructureCost + staffCost + penaltyCost + customerChurnCost;

    // Convert to target currency if specified
    const currency = targetCurrency || model.currency;
    const exchangeRate = this.getExchangeRate(model.currency, currency);
    const totalCost = totalCostBase * exchangeRate;

    // Create cost breakdown
    const costBreakdown = [
      { category: 'Direct Revenue Loss', amount: directRevenueLoss * exchangeRate, percentage: (directRevenueLoss / totalCostBase) * 100 },
      { category: 'Infrastructure Cost', amount: infrastructureCost * exchangeRate, percentage: (infrastructureCost / totalCostBase) * 100 },
      { category: 'Staff Cost', amount: staffCost * exchangeRate, percentage: (staffCost / totalCostBase) * 100 },
      { category: 'Penalty Cost', amount: penaltyCost * exchangeRate, percentage: (penaltyCost / totalCostBase) * 100 },
      { category: 'Customer Churn Cost', amount: customerChurnCost * exchangeRate, percentage: (customerChurnCost / totalCostBase) * 100 }
    ].filter(item => item.amount > 0);

    const impact: IncidentImpact = {
      incidentId,
      startTime,
      endTime,
      severity,
      affectedServices,
      affectedUsers,
      affectedTransactions: Math.round(lostTransactions),
      directRevenueLoss: directRevenueLoss * exchangeRate,
      infrastructureCost: infrastructureCost * exchangeRate,
      staffCost: staffCost * exchangeRate,
      penaltyCost: penaltyCost * exchangeRate,
      customerChurnCost: customerChurnCost * exchangeRate,
      totalCost,
      currency,
      costBreakdown
    };

    this.incidents.push(impact);
    return impact;
  }

  /**
   * Calculate monthly/yearly cost projections based on historical data
   */
  calculateCostForecast(
    modelId: string,
    period: 'day' | 'week' | 'month' | 'quarter' | 'year',
    targetCurrency?: string
  ): CostForecast {
    const model = this.costModels.get(modelId);
    if (!model) {
      throw new Error(`Cost model not found: ${modelId}`);
    }

    const periodDays = this.getPeriodDays(period);
    const historicalIncidents = this.getHistoricalIncidents(periodDays * 3); // Use 3x period for better analysis

    // Calculate historical averages
    const avgIncidentsPerDay = historicalIncidents.length / (periodDays * 3);
    const avgDowntimePerIncident = this.calculateAverageDowntime(historicalIncidents);
    const avgCostPerIncident = this.calculateAverageCost(historicalIncidents, targetCurrency || model.currency);

    // Apply trend analysis
    const trendFactor = this.calculateTrendFactor(historicalIncidents);
    const seasonalFactor = this.calculateSeasonalFactor(period);

    // Project for the target period
    const projectedIncidents = Math.round(avgIncidentsPerDay * periodDays * trendFactor * seasonalFactor);
    const projectedDowntimeMinutes = projectedIncidents * avgDowntimePerIncident;
    const estimatedCost = projectedIncidents * avgCostPerIncident;

    // Calculate confidence based on data availability and consistency
    const confidence = this.calculateForecastConfidence(historicalIncidents, periodDays);

    return {
      period,
      projectedDowntimeMinutes,
      projectedIncidents,
      estimatedCost,
      confidence,
      factors: {
        historical: 0.6,
        seasonal: seasonalFactor,
        trend: trendFactor
      }
    };
  }

  /**
   * Get cost breakdown by time period
   */
  getCostBreakdownByPeriod(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' | 'month',
    targetCurrency?: string
  ): Array<{
    period: string;
    incidents: number;
    totalCost: number;
    avgCost: number;
    topCostCategories: { category: string; amount: number }[];
  }> {
    const incidents = this.incidents.filter(
      inc => inc.startTime >= startDate && inc.startTime <= endDate
    );

    const groupedData = new Map<string, IncidentImpact[]>();

    incidents.forEach(incident => {
      const periodKey = this.getPeriodKey(incident.startTime, groupBy);
      if (!groupedData.has(periodKey)) {
        groupedData.set(periodKey, []);
      }
      groupedData.get(periodKey)!.push(incident);
    });

    const result = Array.from(groupedData.entries()).map(([period, periodIncidents]) => {
      const totalCost = periodIncidents.reduce((sum, inc) => {
        const convertedCost = targetCurrency && targetCurrency !== inc.currency
          ? inc.totalCost * this.getExchangeRate(inc.currency, targetCurrency)
          : inc.totalCost;
        return sum + convertedCost;
      }, 0);

      const avgCost = periodIncidents.length > 0 ? totalCost / periodIncidents.length : 0;

      // Aggregate cost categories
      const categoryTotals = new Map<string, number>();
      periodIncidents.forEach(inc => {
        inc.costBreakdown.forEach(breakdown => {
          const convertedAmount = targetCurrency && targetCurrency !== inc.currency
            ? breakdown.amount * this.getExchangeRate(inc.currency, targetCurrency)
            : breakdown.amount;
          
          categoryTotals.set(
            breakdown.category,
            (categoryTotals.get(breakdown.category) || 0) + convertedAmount
          );
        });
      });

      const topCostCategories = Array.from(categoryTotals.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return {
        period,
        incidents: periodIncidents.length,
        totalCost,
        avgCost,
        topCostCategories
      };
    }).sort((a, b) => a.period.localeCompare(b.period));

    return result;
  }

  /**
   * Update currency exchange rates
   */
  updateExchangeRates(rates: CurrencyConversion[]): void {
    rates.forEach(rate => {
      const key = `${rate.from}-${rate.to}`;
      if (!this.currencyRates.has(key)) {
        this.currencyRates.set(key, []);
      }
      this.currencyRates.get(key)!.push(rate);
      
      // Keep only recent rates (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.currencyRates.set(key, 
        this.currencyRates.get(key)!.filter(r => r.lastUpdated >= thirtyDaysAgo)
      );
    });
  }

  /**
   * Get ROI of monitoring/reliability investments
   */
  calculateMonitoringROI(
    investmentCost: number,
    investmentPeriodDays: number,
    preventedIncidents: number,
    avgPreventedIncidentCost: number,
    currency: string = this.config.baseCurrency
  ): {
    investment: number;
    savings: number;
    netBenefit: number;
    roi: number; // Return on Investment percentage
    paybackPeriodDays: number;
    currency: string;
  } {
    const savings = preventedIncidents * avgPreventedIncidentCost;
    const netBenefit = savings - investmentCost;
    const roi = (netBenefit / investmentCost) * 100;
    const paybackPeriodDays = investmentCost > 0 ? (investmentCost / (savings / investmentPeriodDays)) : 0;

    return {
      investment: investmentCost,
      savings,
      netBenefit,
      roi,
      paybackPeriodDays,
      currency
    };
  }

  private getSeverityMultiplier(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    const multipliers = {
      low: 0.1,
      medium: 0.3,
      high: 0.7,
      critical: 1.0
    };
    return multipliers[severity];
  }

  private calculatePenaltyCosts(severity: string, durationMinutes: number, model: CostModel): number {
    // SLA penalty costs based on severity and duration
    const basePenalty = model.penaltyCostPerIncident;
    const severityMultiplier = this.getSeverityMultiplier(severity as any);
    const durationMultiplier = Math.min(durationMinutes / 60, 24); // Cap at 24 hours
    
    return basePenalty * severityMultiplier * durationMultiplier;
  }

  private getExchangeRate(fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return 1.0;

    const key = `${fromCurrency}-${toCurrency}`;
    const rates = this.currencyRates.get(key);
    
    if (rates && rates.length > 0) {
      // Get the most recent rate
      const latestRate = rates.reduce((latest, current) => 
        current.lastUpdated > latest.lastUpdated ? current : latest
      );
      return latestRate.rate;
    }

    // Try reverse rate
    const reverseKey = `${toCurrency}-${fromCurrency}`;
    const reverseRates = this.currencyRates.get(reverseKey);
    if (reverseRates && reverseRates.length > 0) {
      const latestRate = reverseRates.reduce((latest, current) => 
        current.lastUpdated > latest.lastUpdated ? current : latest
      );
      return 1 / latestRate.rate;
    }

    console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}, using 1.0`);
    return 1.0;
  }

  private getPeriodDays(period: 'day' | 'week' | 'month' | 'quarter' | 'year'): number {
    const days = {
      day: 1,
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    };
    return days[period];
  }

  private getHistoricalIncidents(days: number): IncidentImpact[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.incidents.filter(inc => inc.startTime >= cutoffDate);
  }

  private calculateAverageDowntime(incidents: IncidentImpact[]): number {
    if (incidents.length === 0) return 30; // Default 30 minutes

    const totalDowntime = incidents.reduce((sum, inc) => {
      if (!inc.endTime) return sum; // Skip ongoing incidents
      return sum + (inc.endTime.getTime() - inc.startTime.getTime()) / (1000 * 60);
    }, 0);

    const completedIncidents = incidents.filter(inc => inc.endTime).length;
    return completedIncidents > 0 ? totalDowntime / completedIncidents : 30;
  }

  private calculateAverageCost(incidents: IncidentImpact[], currency: string): number {
    if (incidents.length === 0) return 0;

    const totalCost = incidents.reduce((sum, inc) => {
      const convertedCost = currency !== inc.currency
        ? inc.totalCost * this.getExchangeRate(inc.currency, currency)
        : inc.totalCost;
      return sum + convertedCost;
    }, 0);

    return totalCost / incidents.length;
  }

  private calculateTrendFactor(incidents: IncidentImpact[]): number {
    if (incidents.length < 4) return 1.0;

    // Split incidents into two halves and compare
    const midPoint = Math.floor(incidents.length / 2);
    const earlierIncidents = incidents.slice(0, midPoint);
    const laterIncidents = incidents.slice(midPoint);

    const earlierRate = earlierIncidents.length;
    const laterRate = laterIncidents.length;

    if (earlierRate === 0) return 1.0;
    
    const trend = laterRate / earlierRate;
    // Cap trend factor between 0.5 and 2.0
    return Math.max(0.5, Math.min(2.0, trend));
  }

  private calculateSeasonalFactor(period: string): number {
    // Simplified seasonal adjustments
    const currentMonth = new Date().getMonth();
    const seasonalFactors = {
      0: 0.9,  // January - post-holiday lower activity
      1: 1.0,  // February - normal
      2: 1.1,  // March - increased activity
      3: 1.0,  // April - normal
      4: 1.0,  // May - normal
      5: 1.1,  // June - increased activity
      6: 0.9,  // July - summer slowdown
      7: 0.9,  // August - summer slowdown
      8: 1.1,  // September - back to work/school
      9: 1.0,  // October - normal
      10: 1.2, // November - holiday shopping
      11: 1.3  // December - holiday peak
    };

    return seasonalFactors[currentMonth as keyof typeof seasonalFactors] || 1.0;
  }

  private calculateForecastConfidence(incidents: IncidentImpact[], periodDays: number): number {
    // Base confidence on data availability and consistency
    const dataPoints = incidents.length;
    const requiredDataPoints = Math.max(4, periodDays / 7); // At least 4 incidents or 1 per week

    let confidence = Math.min(100, (dataPoints / requiredDataPoints) * 100);
    
    // Reduce confidence if data is too sparse
    if (dataPoints < 2) confidence *= 0.3;
    else if (dataPoints < requiredDataPoints) confidence *= 0.7;

    // Reduce confidence for high variance in incident costs
    if (incidents.length > 1) {
      const costs = incidents.map(inc => inc.totalCost);
      const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
      const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / mean;

      if (coefficientOfVariation > 1.0) confidence *= 0.8;
      else if (coefficientOfVariation > 0.5) confidence *= 0.9;
    }

    return Math.round(Math.max(10, confidence));
  }

  private getPeriodKey(date: Date, groupBy: 'hour' | 'day' | 'week' | 'month'): string {
    switch (groupBy) {
      case 'hour':
        return date.toISOString().substring(0, 13) + ':00';
      case 'day':
        return date.toISOString().substring(0, 10);
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().substring(0, 10);
      case 'month':
        return date.toISOString().substring(0, 7);
    }
  }

  private initializeDefaultExchangeRates(): void {
    // Initialize with some common exchange rates (in production, these would come from an API)
    const defaultRates: CurrencyConversion[] = [
      { from: 'USD', to: 'EUR', rate: 0.85, lastUpdated: new Date() },
      { from: 'USD', to: 'GBP', rate: 0.73, lastUpdated: new Date() },
      { from: 'USD', to: 'JPY', rate: 110, lastUpdated: new Date() },
      { from: 'USD', to: 'CAD', rate: 1.25, lastUpdated: new Date() },
      { from: 'USD', to: 'AUD', rate: 1.35, lastUpdated: new Date() },
    ];

    this.updateExchangeRates(defaultRates);
  }
}

// Factory functions for common cost models
export const createSaaSCostModel = (
  id: string,
  name: string,
  monthlyRevenue: number,
  monthlyUsers: number,
  currency: string = 'USD'
): CostModel => {
  const revenuePerMinute = monthlyRevenue / (30 * 24 * 60);
  const transactionsPerMinute = monthlyUsers / (30 * 24 * 60) * 0.1; // Assume 10% of users transact daily

  return {
    id,
    name,
    currency,
    revenuePerMinute,
    revenuePerTransaction: monthlyRevenue / (monthlyUsers * 0.3), // Assume 30% conversion
    infrastructureCostPerHour: monthlyRevenue * 0.02 / (30 * 24), // 2% of revenue
    staffCostPerHour: 100, // $100/hour for incident response
    penaltyCostPerIncident: monthlyRevenue * 0.001, // 0.1% of monthly revenue
    customerAcquisitionCost: monthlyRevenue / monthlyUsers * 12, // 12 months payback
    customerLifetimeValue: monthlyRevenue / monthlyUsers * 24, // 24 months LTV
    churnRatePerDowntimeHour: 0.5, // 0.5% churn per hour
    transactionsPerMinute,
    conversionRate: 0.3, // 30% conversion rate
    downtimeConversionPenalty: 0.8 // 80% reduction during downtime
  };
};

export const createEcommerceCostModel = (
  id: string,
  name: string,
  dailyRevenue: number,
  dailyOrders: number,
  currency: string = 'USD'
): CostModel => {
  const revenuePerMinute = dailyRevenue / (24 * 60);
  const transactionsPerMinute = dailyOrders / (24 * 60);

  return {
    id,
    name,
    currency,
    revenuePerMinute,
    revenuePerTransaction: dailyRevenue / dailyOrders,
    infrastructureCostPerHour: dailyRevenue * 0.03 / 24, // 3% of daily revenue
    staffCostPerHour: 150, // Higher for e-commerce
    penaltyCostPerIncident: dailyRevenue * 0.01, // 1% of daily revenue
    customerAcquisitionCost: (dailyRevenue / dailyOrders) * 5, // 5 orders to break even
    customerLifetimeValue: (dailyRevenue / dailyOrders) * 50, // 50 orders lifetime
    churnRatePerDowntimeHour: 1.0, // 1% churn per hour (higher for e-commerce)
    transactionsPerMinute,
    conversionRate: 0.05, // 5% conversion rate
    downtimeConversionPenalty: 0.9 // 90% reduction during downtime
  };
};

export default CostCalculator;