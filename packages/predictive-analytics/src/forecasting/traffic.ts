import { SimpleLinearRegression } from 'ml-regression';
import { mean, standardDeviation, median } from 'simple-statistics';

import { TrafficForecastInput, TrafficForecastOutput } from '../types';

interface SeasonalityComponent {
  pattern: 'hourly' | 'daily' | 'weekly' | 'monthly';
  amplitude: number;
  phase: number;
  strength: number;
}

interface TrendComponent {
  slope: number;
  intercept: number;
  r2: number;
  type: 'linear' | 'exponential' | 'logarithmic';
}

export class TrafficForecastingEngine {
  private readonly maxForecastDays = 30;
  private readonly minDataPoints = 48; // Minimum 48 hours of data
  
  constructor(
    private readonly seasonalityThreshold = 0.3
  ) {}

  async generateForecast(input: TrafficForecastInput): Promise<TrafficForecastOutput> {
    this.validateInput(input);

    // Prepare time series data
    const timeSeries = this.prepareTimeSeries(input);
    
    // Decompose the time series
    const { trend, seasonality, residuals } = await this.decomposeTimeSeries(timeSeries);
    
    // Detect seasonality patterns
    const seasonalityDetected = await this.detectSeasonality(timeSeries, input.seasonality);
    
    // Generate predictions
    const predictions = await this.generatePredictions(
      timeSeries,
      trend,
      seasonality,
      residuals,
      input.externalEvents
    );
    
    // Calculate resource needs
    const predictionsWithResources = predictions.map(pred => ({
      ...pred,
      resourceNeeds: this.calculateResourceNeeds(pred.expectedRequests, timeSeries)
    }));
    
    // Generate scaling recommendations
    const recommendations = this.generateScalingRecommendations(
      predictionsWithResources,
      input.externalEvents
    );

    return {
      predictions: predictionsWithResources,
      seasonalityDetected,
      recommendations
    };
  }

  private validateInput(input: TrafficForecastInput): void {
    if (!input.historicalData || input.historicalData.length < this.minDataPoints) {
      throw new Error(`Insufficient historical data. Need at least ${this.minDataPoints} data points`);
    }

    // Check data quality
    const validDataPoints = input.historicalData.filter(d => 
      d.requestCount !== undefined && 
      d.requestCount >= 0 &&
      d.timestamp instanceof Date
    );

    if (validDataPoints.length < this.minDataPoints) {
      throw new Error('Insufficient valid data points after filtering');
    }

    // Check for reasonable time intervals
    const sortedData = input.historicalData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const intervals = [];
    for (let i = 1; i < sortedData.length; i++) {
      intervals.push(sortedData[i].timestamp.getTime() - sortedData[i - 1].timestamp.getTime());
    }
    
    const medianInterval = median(intervals);
    if (medianInterval > 4 * 60 * 60 * 1000) { // More than 4 hours
      console.warn('Large gaps detected in time series data');
    }
  }

  private prepareTimeSeries(input: TrafficForecastInput) {
    return input.historicalData
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((point, index) => ({
        timestamp: point.timestamp,
        value: point.requestCount,
        uniqueUsers: point.uniqueUsers || 0,
        responseTime: point.responseTime || 0,
        errorCount: point.errorCount || 0,
        index
      }));
  }

  private async decomposeTimeSeries(timeSeries: any[]) {
    // Simple trend extraction using linear regression
    const trend = this.extractTrend(timeSeries);
    
    // Extract seasonality by removing trend
    const detrended = timeSeries.map((point, i) => ({
      ...point,
      detrended: point.value - (trend.slope * i + trend.intercept)
    }));
    
    // Simple seasonal decomposition
    const seasonality = this.extractSeasonality(detrended);
    
    // Calculate residuals
    const residuals = timeSeries.map((point, i) => {
      const trendValue = trend.slope * i + trend.intercept;
      const seasonalValue = this.getSeasonalValue(point.timestamp, seasonality);
      return point.value - trendValue - seasonalValue;
    });

    return { trend, seasonality, residuals };
  }

  private extractTrend(timeSeries: any[]): TrendComponent {
    const x = timeSeries.map((_, i) => i);
    const y = timeSeries.map(point => point.value);
    
    const regression = new SimpleLinearRegression(x, y);
    
    return {
      slope: regression.slope,
      intercept: regression.intercept,
      r2: regression.coefficientOfDetermination,
      type: 'linear'
    };
  }

  private extractSeasonality(detrended: any[]): SeasonalityComponent[] {
    const components: SeasonalityComponent[] = [];
    
    // Hourly seasonality (24-hour pattern)
    const hourlyPattern = this.extractHourlySeasonality(detrended);
    if (hourlyPattern.strength > this.seasonalityThreshold) {
      components.push(hourlyPattern);
    }
    
    // Daily seasonality (7-day pattern)
    const dailyPattern = this.extractDailySeasonality(detrended);
    if (dailyPattern.strength > this.seasonalityThreshold) {
      components.push(dailyPattern);
    }
    
    // Weekly seasonality
    const weeklyPattern = this.extractWeeklySeasonality(detrended);
    if (weeklyPattern.strength > this.seasonalityThreshold) {
      components.push(weeklyPattern);
    }
    
    return components;
  }

  private extractHourlySeasonality(detrended: any[]): SeasonalityComponent {
    const hourlyBuckets: { [hour: number]: number[] } = {};
    
    // Group by hour of day
    for (const point of detrended) {
      const hour = point.timestamp.getHours();
      if (!hourlyBuckets[hour]) {
        hourlyBuckets[hour] = [];
      }
      hourlyBuckets[hour].push(point.detrended);
    }
    
    // Calculate average for each hour
    const hourlyAverages: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const values = hourlyBuckets[hour] || [0];
      hourlyAverages.push(mean(values));
    }
    
    // Calculate amplitude and strength
    const amplitude = Math.max(...hourlyAverages) - Math.min(...hourlyAverages);
    const overallMean = mean(Object.values(hourlyBuckets).flat());
    const strength = amplitude / (Math.abs(overallMean) || 1);
    
    return {
      pattern: 'hourly',
      amplitude,
      phase: hourlyAverages.indexOf(Math.max(...hourlyAverages)),
      strength: Math.min(1, strength)
    };
  }

  private extractDailySeasonality(detrended: any[]): SeasonalityComponent {
    const dailyBuckets: { [day: number]: number[] } = {};
    
    // Group by day of week
    for (const point of detrended) {
      const day = point.timestamp.getDay();
      if (!dailyBuckets[day]) {
        dailyBuckets[day] = [];
      }
      dailyBuckets[day].push(point.detrended);
    }
    
    // Calculate average for each day
    const dailyAverages: number[] = [];
    for (let day = 0; day < 7; day++) {
      const values = dailyBuckets[day] || [0];
      dailyAverages.push(mean(values));
    }
    
    const amplitude = Math.max(...dailyAverages) - Math.min(...dailyAverages);
    const overallMean = mean(Object.values(dailyBuckets).flat());
    const strength = amplitude / (Math.abs(overallMean) || 1);
    
    return {
      pattern: 'daily',
      amplitude,
      phase: dailyAverages.indexOf(Math.max(...dailyAverages)),
      strength: Math.min(1, strength)
    };
  }

  private extractWeeklySeasonality(detrended: any[]): SeasonalityComponent {
    // Similar to daily but looking at week-over-week patterns
    const weeklyBuckets: { [week: number]: number[] } = {};
    
    for (const point of detrended) {
      const week = Math.floor(point.timestamp.getTime() / (7 * 24 * 60 * 60 * 1000));
      if (!weeklyBuckets[week]) {
        weeklyBuckets[week] = [];
      }
      weeklyBuckets[week].push(point.detrended);
    }
    
    const weeklyAverages = Object.values(weeklyBuckets).map(values => mean(values));
    
    if (weeklyAverages.length < 4) {
      return {
        pattern: 'weekly',
        amplitude: 0,
        phase: 0,
        strength: 0
      };
    }
    
    const amplitude = Math.max(...weeklyAverages) - Math.min(...weeklyAverages);
    const overallMean = mean(weeklyAverages);
    const strength = amplitude / (Math.abs(overallMean) || 1);
    
    return {
      pattern: 'weekly',
      amplitude,
      phase: 0,
      strength: Math.min(1, strength)
    };
  }

  private async detectSeasonality(_timeSeries: any[], inputSeasonality: any) {
    const detected = [];
    
    // Validate input seasonality patterns
    if (inputSeasonality.hourly && inputSeasonality.hourly.length === 24) {
      const hourlyStrength = standardDeviation(inputSeasonality.hourly) / (mean(inputSeasonality.hourly) || 1);
      detected.push({
        pattern: 'hourly',
        strength: Math.min(1, hourlyStrength),
        period: 24
      });
    }
    
    if (inputSeasonality.daily && inputSeasonality.daily.length === 7) {
      const dailyStrength = standardDeviation(inputSeasonality.daily) / (mean(inputSeasonality.daily) || 1);
      detected.push({
        pattern: 'daily',
        strength: Math.min(1, dailyStrength),
        period: 7
      });
    }
    
    if (inputSeasonality.weekly && inputSeasonality.weekly.length === 52) {
      const weeklyStrength = standardDeviation(inputSeasonality.weekly) / (mean(inputSeasonality.weekly) || 1);
      detected.push({
        pattern: 'weekly',
        strength: Math.min(1, weeklyStrength),
        period: 52
      });
    }
    
    return detected;
  }

  private getSeasonalValue(timestamp: Date, seasonalComponents: SeasonalityComponent[]): number {
    let seasonalValue = 0;
    
    for (const component of seasonalComponents) {
      switch (component.pattern) {
        case 'hourly':
          const hour = timestamp.getHours();
          seasonalValue += component.amplitude * Math.sin(2 * Math.PI * (hour - component.phase) / 24);
          break;
        case 'daily':
          const day = timestamp.getDay();
          seasonalValue += component.amplitude * Math.sin(2 * Math.PI * (day - component.phase) / 7);
          break;
        case 'weekly':
          const week = Math.floor(timestamp.getTime() / (7 * 24 * 60 * 60 * 1000));
          seasonalValue += component.amplitude * Math.sin(2 * Math.PI * week / 52);
          break;
      }
    }
    
    return seasonalValue;
  }

  private async generatePredictions(
    timeSeries: any[],
    trend: TrendComponent,
    seasonalComponents: SeasonalityComponent[],
    residuals: number[],
    externalEvents: any
  ) {
    const predictions = [];
    const lastTimestamp = timeSeries[timeSeries.length - 1].timestamp;
    const residualStd = standardDeviation(residuals) || 0;
    
    // Generate predictions for next 30 days (hourly intervals)
    for (let hours = 1; hours <= this.maxForecastDays * 24; hours++) {
      const predictionTime = new Date(lastTimestamp.getTime() + hours * 60 * 60 * 1000);
      const timeIndex = timeSeries.length + hours - 1;
      
      // Trend component
      let prediction = trend.slope * timeIndex + trend.intercept;
      
      // Seasonal component
      prediction += this.getSeasonalValue(predictionTime, seasonalComponents);
      
      // Apply external events impact
      prediction *= this.getExternalEventImpact(predictionTime, externalEvents);
      
      // Ensure non-negative predictions
      prediction = Math.max(0, prediction);
      
      // Calculate confidence intervals
      const confidenceMargin = this.getConfidenceMargin(residualStd, hours);
      
      predictions.push({
        timestamp: predictionTime,
        expectedRequests: Math.round(prediction),
        confidenceInterval: {
          lower: Math.max(0, Math.round(prediction - confidenceMargin)),
          upper: Math.round(prediction + confidenceMargin)
        },
        resourceNeeds: {
          cpu: 0, // Will be calculated later
          memory: 0,
          bandwidth: 0
        }
      });
    }
    
    return predictions;
  }

  private getExternalEventImpact(timestamp: Date, externalEvents: any): number {
    let impact = 1.0;
    
    // Check holidays
    const isHoliday = externalEvents.holidays?.some((holiday: Date) => {
      const dayDiff = Math.abs(timestamp.getTime() - holiday.getTime()) / (24 * 60 * 60 * 1000);
      return dayDiff < 1;
    });
    
    if (isHoliday) {
      impact *= 0.7; // 30% reduction on holidays
    }
    
    // Check promotions
    const activePromotion = externalEvents.promotions?.find((promo: any) => {
      return timestamp >= promo.start && timestamp <= promo.end;
    });
    
    if (activePromotion) {
      impact *= (1 + activePromotion.impact);
    }
    
    // Check recent deployments (24-hour impact)
    const recentDeployment = externalEvents.deployments?.some((deployment: Date) => {
      const hoursDiff = (timestamp.getTime() - deployment.getTime()) / (60 * 60 * 1000);
      return hoursDiff >= 0 && hoursDiff <= 24;
    });
    
    if (recentDeployment) {
      impact *= 1.2; // 20% increase due to deployment activity
    }
    
    return impact;
  }

  private getConfidenceMargin(residualStd: number, hoursAhead: number): number {
    // Confidence margin increases with time
    const baseMargin = residualStd * 1.96; // 95% confidence interval
    const timeDecay = Math.sqrt(hoursAhead / 24); // Increases with sqrt of days ahead
    return baseMargin * timeDecay;
  }

  private calculateResourceNeeds(expectedRequests: number, historicalData: any[]) {
    if (historicalData.length === 0) {
      return { cpu: 0, memory: 0, bandwidth: 0 };
    }
    
    // Calculate resource usage per request based on historical data
    const avgResourcePerRequest = {
      cpu: 0.1, // 0.1 CPU cores per 1000 requests
      memory: 50, // 50MB per 1000 requests
      bandwidth: 1 // 1Mbps per 1000 requests
    };
    
    const requestsInThousands = expectedRequests / 1000;
    
    return {
      cpu: Math.ceil(requestsInThousands * avgResourcePerRequest.cpu * 100) / 100,
      memory: Math.ceil(requestsInThousands * avgResourcePerRequest.memory),
      bandwidth: Math.ceil(requestsInThousands * avgResourcePerRequest.bandwidth)
    };
  }

  private generateScalingRecommendations(predictions: any[], externalEvents: any) {
    const scaleUp: Date[] = [];
    const scaleDown: Date[] = [];
    const preloadCache: Date[] = [];
    
    // Analyze predictions for scaling opportunities
    for (let i = 1; i < predictions.length; i++) {
      const current = predictions[i];
      const previous = predictions[i - 1];
      
      const requestsIncrease = (current.expectedRequests - previous.expectedRequests) / previous.expectedRequests;
      
      // Scale up recommendations
      if (requestsIncrease > 0.5 || current.expectedRequests > 10000) {
        scaleUp.push(new Date(current.timestamp.getTime() - 60 * 60 * 1000)); // 1 hour before
      }
      
      // Scale down recommendations
      if (requestsIncrease < -0.3 && current.expectedRequests < 1000) {
        scaleDown.push(new Date(current.timestamp.getTime() + 60 * 60 * 1000)); // 1 hour after
      }
      
      // Preload cache recommendations
      if (requestsIncrease > 0.3) {
        preloadCache.push(new Date(current.timestamp.getTime() - 30 * 60 * 1000)); // 30 minutes before
      }
    }
    
    // Add external event-based recommendations
    externalEvents.promotions?.forEach((promo: any) => {
      scaleUp.push(new Date(promo.start.getTime() - 2 * 60 * 60 * 1000)); // 2 hours before promotion
      preloadCache.push(new Date(promo.start.getTime() - 60 * 60 * 1000)); // 1 hour before promotion
    });
    
    return {
      scaleUp: this.removeDuplicateDates(scaleUp).slice(0, 20), // Limit recommendations
      scaleDown: this.removeDuplicateDates(scaleDown).slice(0, 20),
      preloadCache: this.removeDuplicateDates(preloadCache).slice(0, 20)
    };
  }

  private removeDuplicateDates(dates: Date[]): Date[] {
    const unique = new Map();
    dates.forEach(date => {
      const key = Math.floor(date.getTime() / (60 * 60 * 1000)); // Group by hour
      if (!unique.has(key)) {
        unique.set(key, date);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.getTime() - b.getTime());
  }
}