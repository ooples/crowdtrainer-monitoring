import { SimpleLinearRegression } from 'ml-regression';
import { mean, standardDeviation } from 'simple-statistics';
import { TrendAnalysisInput, TrendAnalysisOutput } from '../types';

interface TrendComponent {
  type: 'linear' | 'exponential' | 'logarithmic' | 'seasonal';
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number;
  startDate: Date;
  endDate?: Date;
  equation?: string;
  r2Score: number;
  slope?: number;
  intercept?: number;
}

interface SeasonalComponent {
  detected: boolean;
  period: number;
  strength: number;
  peaks: Date[];
  troughs: Date[];
  amplitude: number;
  phase: number;
}

interface AnomalyDetection {
  timestamp: Date;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'drop' | 'pattern_break';
  zScore: number;
}

export class TrendAnalyzer {
  private readonly minDataPoints = 10;
  private readonly seasonalityMinPoints = 20;
  private readonly anomalyThreshold = 2; // Standard deviations
  private readonly trendStrengthThreshold = 0.3;

  constructor() {}

  async analyzeTrends(input: TrendAnalysisInput): Promise<TrendAnalysisOutput> {
    this.validateInput(input);

    // Sort and clean data
    const cleanedData = this.prepareData(input.timeSeries);
    
    // Analyze different types of trends
    const trends = await this.detectTrends(cleanedData, input.analysisParams);
    
    // Analyze seasonality if enabled
    const seasonality = input.analysisParams.seasonalityDetection 
      ? await this.analyzeSeasonality(cleanedData)
      : { detected: false, period: 0, strength: 0, peaks: [], troughs: [], amplitude: 0, phase: 0 };
    
    // Detect anomalies if enabled
    const anomalies = input.analysisParams.anomalyDetection
      ? await this.detectAnomalies(cleanedData, trends, seasonality)
      : [];
    
    // Generate forecast
    const forecast = await this.generateForecast(
      cleanedData, 
      trends, 
      seasonality, 
      input.analysisParams.forecastHorizon
    );
    
    // Generate insights
    const insights = this.generateInsights(trends, seasonality, anomalies, forecast, cleanedData.length);

    return {
      trends,
      seasonality,
      anomalies,
      forecast,
      insights
    };
  }

  private validateInput(input: TrendAnalysisInput): void {
    if (!input.timeSeries || input.timeSeries.length < this.minDataPoints) {
      throw new Error(`Need at least ${this.minDataPoints} data points for trend analysis`);
    }

    if (!input.analysisParams) {
      throw new Error('Analysis parameters are required');
    }

    // Check data quality
    const validDataPoints = input.timeSeries.filter(point => 
      point.timestamp instanceof Date &&
      typeof point.value === 'number' &&
      !isNaN(point.value)
    );

    if (validDataPoints.length < input.timeSeries.length * 0.8) {
      throw new Error('Too many invalid data points');
    }

    // Check for reasonable time intervals
    const sortedData = input.timeSeries
      .filter(point => point.timestamp instanceof Date)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (sortedData.length >= 2) {
      const intervals = [];
      for (let i = 1; i < Math.min(10, sortedData.length); i++) {
        intervals.push(sortedData[i].timestamp.getTime() - sortedData[i-1].timestamp.getTime());
      }
      const avgInterval = mean(intervals);
      const maxGap = Math.max(...intervals);
      
      if (maxGap > avgInterval * 10) {
        console.warn('Large gaps detected in time series data');
      }
    }
  }

  private prepareData(timeSeries: any[]) {
    return timeSeries
      .filter(point => 
        point.timestamp instanceof Date &&
        typeof point.value === 'number' &&
        !isNaN(point.value)
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((point, index) => ({
        ...point,
        index,
        normalizedIndex: index / (timeSeries.length - 1) // 0 to 1
      }));
  }

  private async detectTrends(data: any[], analysisParams: any): Promise<TrendComponent[]> {
    const trends: TrendComponent[] = [];
    
    // Linear trend detection
    const linearTrend = this.detectLinearTrend(data, analysisParams.trendDetectionSensitivity);
    if (linearTrend.strength >= this.trendStrengthThreshold) {
      trends.push(linearTrend);
    }
    
    // Exponential trend detection
    const exponentialTrend = this.detectExponentialTrend(data, analysisParams.trendDetectionSensitivity);
    if (exponentialTrend.strength >= this.trendStrengthThreshold) {
      trends.push(exponentialTrend);
    }
    
    // Logarithmic trend detection
    const logarithmicTrend = this.detectLogarithmicTrend(data, analysisParams.trendDetectionSensitivity);
    if (logarithmicTrend.strength >= this.trendStrengthThreshold) {
      trends.push(logarithmicTrend);
    }
    
    // Piecewise trend detection (multiple trend segments)
    const piecewiseTrends = this.detectPiecewiseTrends(data, analysisParams.trendDetectionSensitivity);
    trends.push(...piecewiseTrends);

    return trends.sort((a, b) => b.strength - a.strength); // Sort by strength
  }

  private detectLinearTrend(data: any[], sensitivity: number): TrendComponent {
    const x = data.map(d => d.index);
    const y = data.map(d => d.value);
    
    const regression = new SimpleLinearRegression(x, y);
    const slope = regression.slope;
    const r2 = regression.coefficientOfDetermination;
    
    let direction: 'increasing' | 'decreasing' | 'stable';
    const avgValue = mean(y);
    const slopeThreshold = avgValue * sensitivity * 0.001; // Sensitivity-based threshold
    
    if (Math.abs(slope) < slopeThreshold) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    const equation = `y = ${slope.toFixed(4)}x + ${regression.intercept.toFixed(4)}`;
    
    return {
      type: 'linear',
      direction,
      strength: Math.min(1, r2 * (Math.abs(slope) / (Math.abs(slope) + slopeThreshold))),
      startDate: data[0].timestamp,
      endDate: data[data.length - 1].timestamp,
      equation,
      r2Score: r2,
      slope,
      intercept: regression.intercept
    };
  }

  private detectExponentialTrend(data: any[], sensitivity: number): TrendComponent {
    // Transform to log scale for exponential trend detection
    const positiveData = data.filter(d => d.value > 0);
    
    if (positiveData.length < this.minDataPoints) {
      return {
        type: 'exponential',
        direction: 'stable',
        strength: 0,
        startDate: data[0].timestamp,
        r2Score: 0
      };
    }
    
    const x = positiveData.map(d => d.index);
    const y = positiveData.map(d => Math.log(d.value));
    
    const regression = new SimpleLinearRegression(x, y);
    const r2 = regression.coefficientOfDetermination;
    const slope = regression.slope;
    
    let direction: 'increasing' | 'decreasing' | 'stable';
    const slopeThreshold = sensitivity * 0.01;
    
    if (Math.abs(slope) < slopeThreshold) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    const a = Math.exp(regression.intercept);
    const b = slope;
    const equation = `y = ${a.toFixed(4)} * exp(${b.toFixed(4)}x)`;
    
    return {
      type: 'exponential',
      direction,
      strength: Math.min(1, r2 * Math.min(2, Math.abs(slope) / slopeThreshold)),
      startDate: positiveData[0].timestamp,
      endDate: positiveData[positiveData.length - 1].timestamp,
      equation,
      r2Score: r2
    };
  }

  private detectLogarithmicTrend(data: any[], sensitivity: number): TrendComponent {
    // Transform x to log scale for logarithmic trend detection
    const validData = data.filter(d => d.index > 0);
    
    if (validData.length < this.minDataPoints) {
      return {
        type: 'logarithmic',
        direction: 'stable',
        strength: 0,
        startDate: data[0].timestamp,
        r2Score: 0
      };
    }
    
    const x = validData.map(d => Math.log(d.index + 1)); // Add 1 to avoid log(0)
    const y = validData.map(d => d.value);
    
    const regression = new SimpleLinearRegression(x, y);
    const r2 = regression.coefficientOfDetermination;
    const slope = regression.slope;
    
    let direction: 'increasing' | 'decreasing' | 'stable';
    const avgValue = mean(y);
    const slopeThreshold = avgValue * sensitivity * 0.001;
    
    if (Math.abs(slope) < slopeThreshold) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    const equation = `y = ${slope.toFixed(4)} * log(x + 1) + ${regression.intercept.toFixed(4)}`;
    
    return {
      type: 'logarithmic',
      direction,
      strength: Math.min(1, r2 * Math.min(2, Math.abs(slope) / slopeThreshold)),
      startDate: validData[0].timestamp,
      endDate: validData[validData.length - 1].timestamp,
      equation,
      r2Score: r2
    };
  }

  private detectPiecewiseTrends(data: any[], sensitivity: number): TrendComponent[] {
    const trends: TrendComponent[] = [];
    
    if (data.length < 20) return trends; // Need sufficient data for segmentation
    
    // Simple sliding window approach for trend change detection
    const windowSize = Math.max(10, Math.floor(data.length / 5));
    const stepSize = Math.max(5, Math.floor(windowSize / 2));
    
    for (let start = 0; start + windowSize < data.length; start += stepSize) {
      const segment = data.slice(start, start + windowSize);
      const linearTrend = this.detectLinearTrend(segment, sensitivity);
      
      if (linearTrend.strength >= this.trendStrengthThreshold && linearTrend.r2Score > 0.5) {
        trends.push({
          ...linearTrend,
          startDate: segment[0].timestamp,
          endDate: segment[segment.length - 1].timestamp
        });
      }
    }
    
    // Merge overlapping or adjacent trends with similar characteristics
    return this.mergeSimilarTrends(trends);
  }

  private mergeSimilarTrends(trends: TrendComponent[]): TrendComponent[] {
    if (trends.length <= 1) return trends;
    
    const merged: TrendComponent[] = [];
    let current = trends[0];
    
    for (let i = 1; i < trends.length; i++) {
      const next = trends[i];
      
      // Check if trends are similar and adjacent/overlapping
      const slopeDiff = Math.abs((current.slope || 0) - (next.slope || 0));
      const avgSlope = (Math.abs(current.slope || 0) + Math.abs(next.slope || 0)) / 2;
      const relativeDiff = avgSlope > 0 ? slopeDiff / avgSlope : 0;
      
      if (relativeDiff < 0.3 && current.direction === next.direction) {
        // Merge trends
        current = {
          ...current,
          endDate: next.endDate,
          strength: Math.max(current.strength, next.strength),
          r2Score: (current.r2Score + next.r2Score) / 2
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  private async analyzeSeasonality(data: any[]): Promise<SeasonalComponent> {
    if (data.length < this.seasonalityMinPoints) {
      return {
        detected: false,
        period: 0,
        strength: 0,
        peaks: [],
        troughs: [],
        amplitude: 0,
        phase: 0
      };
    }

    // Try different potential periods (in data points)
    const potentialPeriods = this.getPotentialPeriods(data);
    let bestPeriod = 0;
    let bestStrength = 0;
    let bestAmplitude = 0;
    let bestPhase = 0;
    
    for (const period of potentialPeriods) {
      const { strength, amplitude, phase } = this.calculateSeasonalStrength(data, period);
      
      if (strength > bestStrength) {
        bestStrength = strength;
        bestPeriod = period;
        bestAmplitude = amplitude;
        bestPhase = phase;
      }
    }
    
    const detected = bestStrength > 0.3; // Minimum strength threshold
    
    if (!detected) {
      return {
        detected: false,
        period: 0,
        strength: 0,
        peaks: [],
        troughs: [],
        amplitude: 0,
        phase: 0
      };
    }
    
    // Find peaks and troughs
    const { peaks, troughs } = this.findPeaksAndTroughs(data, bestPeriod);
    
    return {
      detected,
      period: bestPeriod,
      strength: bestStrength,
      peaks,
      troughs,
      amplitude: bestAmplitude,
      phase: bestPhase
    };
  }

  private getPotentialPeriods(data: any[]): number[] {
    const periods = [];
    const maxPeriod = Math.floor(data.length / 4); // Need at least 4 cycles
    
    // Common periods based on time intervals
    const timeSpan = data[data.length - 1].timestamp.getTime() - data[0].timestamp.getTime();
    const avgInterval = timeSpan / (data.length - 1);
    
    // Daily pattern (24 hours)
    const dailyPeriod = Math.round((24 * 60 * 60 * 1000) / avgInterval);
    if (dailyPeriod <= maxPeriod && dailyPeriod >= 4) {
      periods.push(dailyPeriod);
    }
    
    // Weekly pattern (7 days)
    const weeklyPeriod = Math.round((7 * 24 * 60 * 60 * 1000) / avgInterval);
    if (weeklyPeriod <= maxPeriod && weeklyPeriod >= 4) {
      periods.push(weeklyPeriod);
    }
    
    // Additional periods to test
    for (let period = 4; period <= Math.min(maxPeriod, 50); period++) {
      if (!periods.includes(period)) {
        periods.push(period);
      }
    }
    
    return periods.sort((a, b) => a - b);
  }

  private calculateSeasonalStrength(data: any[], period: number): { strength: number; amplitude: number; phase: number } {
    if (period >= data.length / 2) {
      return { strength: 0, amplitude: 0, phase: 0 };
    }
    
    // Calculate autocorrelation at the given period
    const autocorrelation = this.calculateAutocorrelation(data.map(d => d.value), period);
    
    // Calculate seasonal component strength using Fourier analysis approximation
    let sumCos = 0;
    let sumSin = 0;
    
    for (let i = 0; i < data.length; i++) {
      const angle = (2 * Math.PI * i) / period;
      sumCos += data[i].value * Math.cos(angle);
      sumSin += data[i].value * Math.sin(angle);
    }
    
    const amplitude = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / data.length;
    const phase = Math.atan2(sumSin, sumCos);
    
    // Strength is combination of autocorrelation and amplitude relative to mean
    const meanValue = mean(data.map(d => d.value));
    const relativeAmplitude = meanValue > 0 ? amplitude / meanValue : 0;
    const strength = Math.min(1, (Math.abs(autocorrelation) + relativeAmplitude) / 2);
    
    return { strength, amplitude, phase };
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;
    
    const n = values.length - lag;
    const mean1 = mean(values.slice(0, n));
    const mean2 = mean(values.slice(lag));
    
    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;
    
    for (let i = 0; i < n; i++) {
      const x = values[i] - mean1;
      const y = values[i + lag] - mean2;
      numerator += x * y;
      denom1 += x * x;
      denom2 += y * y;
    }
    
    const denominator = Math.sqrt(denom1 * denom2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private findPeaksAndTroughs(data: any[], period: number): { peaks: Date[]; troughs: Date[] } {
    const peaks: Date[] = [];
    const troughs: Date[] = [];
    
    if (period < 3) return { peaks, troughs };
    
    // Use a simple local maxima/minima detection within each period
    const halfPeriod = Math.floor(period / 2);
    
    for (let center = halfPeriod; center < data.length - halfPeriod; center += period) {
      const window = data.slice(Math.max(0, center - halfPeriod), 
                                Math.min(data.length, center + halfPeriod + 1));
      
      if (window.length < 3) continue;
      
      const values = window.map(d => d.value);
      const maxIndex = values.indexOf(Math.max(...values));
      const minIndex = values.indexOf(Math.min(...values));
      
      peaks.push(window[maxIndex].timestamp);
      troughs.push(window[minIndex].timestamp);
    }
    
    return { peaks, troughs };
  }

  private async detectAnomalies(
    data: any[], 
    trends: TrendComponent[], 
    seasonality: SeasonalComponent
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    
    // Calculate expected values based on trends and seasonality
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      let expectedValue = point.value; // Default to actual value
      
      // Apply dominant trend
      const dominantTrend = trends[0]; // Strongest trend
      if (dominantTrend && dominantTrend.slope !== undefined) {
        expectedValue = (dominantTrend.slope * i) + (dominantTrend.intercept || 0);
      }
      
      // Apply seasonality if detected
      if (seasonality.detected) {
        const seasonalAdjustment = seasonality.amplitude * 
          Math.sin((2 * Math.PI * i) / seasonality.period + seasonality.phase);
        expectedValue += seasonalAdjustment;
      }
      
      // Calculate deviation
      const deviation = point.value - expectedValue;
      
      // Calculate z-score using moving window
      const windowStart = Math.max(0, i - 10);
      const windowEnd = Math.min(data.length, i + 11);
      const windowValues = data.slice(windowStart, windowEnd).map(d => d.value - expectedValue);
      const windowStd = standardDeviation(windowValues) || 1;
      const zScore = Math.abs(deviation / windowStd);
      
      // Classify anomaly
      if (zScore >= this.anomalyThreshold) {
        let severity: 'low' | 'medium' | 'high';
        if (zScore >= 4) severity = 'high';
        else if (zScore >= 3) severity = 'medium';
        else severity = 'low';
        
        let type: 'spike' | 'drop' | 'pattern_break';
        if (deviation > 0) type = 'spike';
        else type = 'drop';
        
        // Check for pattern break (consecutive anomalies)
        const consecutiveAnomalies = this.countConsecutiveAnomalies(data, i, expectedValue, windowStd);
        if (consecutiveAnomalies >= 3) {
          type = 'pattern_break';
          severity = 'high';
        }
        
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: Math.round(expectedValue * 100) / 100,
          severity,
          type,
          zScore: Math.round(zScore * 100) / 100
        });
      }
    }
    
    return anomalies;
  }

  private countConsecutiveAnomalies(data: any[], startIndex: number, expectedBase: number, std: number): number {
    let count = 0;
    
    for (let i = startIndex; i < Math.min(data.length, startIndex + 5); i++) {
      const deviation = Math.abs(data[i].value - expectedBase);
      const zScore = deviation / std;
      
      if (zScore >= this.anomalyThreshold) {
        count++;
      } else {
        break;
      }
    }
    
    return count;
  }

  private async generateForecast(
    data: any[], 
    trends: TrendComponent[], 
    seasonality: SeasonalComponent,
    forecastHorizon: number
  ) {
    const forecast = [];
    const lastTimestamp = data[data.length - 1].timestamp;
    const avgInterval = this.calculateAverageInterval(data);
    
    const dominantTrend = trends[0]; // Use strongest trend for forecasting
    
    for (let i = 1; i <= forecastHorizon; i++) {
      const forecastTimestamp = new Date(lastTimestamp.getTime() + i * avgInterval);
      const timeIndex = data.length - 1 + i;
      
      let predictedValue = 0;
      
      // Apply trend
      if (dominantTrend && dominantTrend.slope !== undefined) {
        switch (dominantTrend.type) {
          case 'linear':
            predictedValue = (dominantTrend.slope * timeIndex) + (dominantTrend.intercept || 0);
            break;
          case 'exponential':
            // Simplified exponential forecast
            const lastValue = data[data.length - 1].value;
            const growthRate = dominantTrend.slope;
            predictedValue = lastValue * Math.exp(growthRate * i);
            break;
          case 'logarithmic':
            predictedValue = (dominantTrend.slope * Math.log(timeIndex + 1)) + (dominantTrend.intercept || 0);
            break;
          default:
            predictedValue = (dominantTrend.slope * timeIndex) + (dominantTrend.intercept || 0);
        }
      } else {
        // No strong trend, use mean of recent data
        const recentData = data.slice(-Math.min(20, data.length));
        predictedValue = mean(recentData.map(d => d.value));
      }
      
      // Apply seasonality
      if (seasonality.detected) {
        const seasonalComponent = seasonality.amplitude * 
          Math.sin((2 * Math.PI * timeIndex) / seasonality.period + seasonality.phase);
        predictedValue += seasonalComponent;
      }
      
      // Ensure non-negative values (adjust based on domain knowledge)
      predictedValue = Math.max(0, predictedValue);
      
      // Calculate confidence interval based on historical volatility
      const recentValues = data.slice(-Math.min(30, data.length)).map(d => d.value);
      const historicalStd = standardDeviation(recentValues) || 0;
      const confidenceMargin = historicalStd * 1.96 * Math.sqrt(i); // Increases with forecast distance
      
      forecast.push({
        timestamp: forecastTimestamp,
        predictedValue: Math.round(predictedValue * 100) / 100,
        confidenceInterval: {
          lower: Math.max(0, Math.round((predictedValue - confidenceMargin) * 100) / 100),
          upper: Math.round((predictedValue + confidenceMargin) * 100) / 100
        }
      });
    }
    
    return forecast;
  }

  private calculateAverageInterval(data: any[]): number {
    if (data.length < 2) return 60 * 60 * 1000; // Default 1 hour
    
    const intervals = [];
    for (let i = 1; i < Math.min(10, data.length); i++) {
      intervals.push(data[i].timestamp.getTime() - data[i-1].timestamp.getTime());
    }
    
    return mean(intervals);
  }

  private generateInsights(
    trends: TrendComponent[], 
    seasonality: SeasonalComponent, 
    anomalies: AnomalyDetection[], 
    forecast: any[],
    originalDataLength?: number
  ) {
    const insights = {
      summary: '',
      keyFindings: [] as string[],
      recommendations: [] as string[]
    };
    
    // Generate summary
    const dominantTrend = trends[0];
    if (dominantTrend) {
      const trendDesc = `${dominantTrend.direction} ${dominantTrend.type} trend`;
      const strengthDesc = dominantTrend.strength > 0.7 ? 'strong' : dominantTrend.strength > 0.4 ? 'moderate' : 'weak';
      insights.summary = `Data shows a ${strengthDesc} ${trendDesc} with R² of ${(dominantTrend.r2Score * 100).toFixed(1)}%.`;
    } else {
      insights.summary = 'Data shows no significant trends.';
    }
    
    // Key findings
    if (dominantTrend && dominantTrend.strength > 0.5) {
      insights.keyFindings.push(`Strong ${dominantTrend.direction} ${dominantTrend.type} trend detected (strength: ${(dominantTrend.strength * 100).toFixed(1)}%)`);
    }
    
    if (seasonality.detected) {
      insights.keyFindings.push(`Seasonal pattern detected with period of ${seasonality.period} data points (strength: ${(seasonality.strength * 100).toFixed(1)}%)`);
    }
    
    if (anomalies.length > 0) {
      const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high').length;
      if (highSeverityAnomalies > 0) {
        insights.keyFindings.push(`${highSeverityAnomalies} high-severity anomalies detected`);
      } else {
        insights.keyFindings.push(`${anomalies.length} anomalies detected in the data`);
      }
    }
    
    if (trends.length > 1) {
      insights.keyFindings.push(`Multiple trend patterns detected - data may have regime changes`);
    }
    
    // Recommendations
    if (dominantTrend && dominantTrend.direction === 'increasing' && dominantTrend.strength > 0.6) {
      insights.recommendations.push('Monitor for continued growth and plan for capacity scaling');
    }
    
    if (dominantTrend && dominantTrend.direction === 'decreasing' && dominantTrend.strength > 0.6) {
      insights.recommendations.push('Investigate causes of declining trend and implement corrective measures');
    }
    
    if (seasonality.detected) {
      insights.recommendations.push('Leverage seasonal patterns for predictive planning and resource allocation');
    }
    
    if (originalDataLength && anomalies.length > originalDataLength * 0.1) { // More than 10% anomalies
      insights.recommendations.push('High anomaly rate detected - review data quality and investigate root causes');
    }
    
    const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');
    if (highSeverityAnomalies.length > 0) {
      insights.recommendations.push('Address high-severity anomalies immediately as they may indicate system issues');
    }
    
    if (forecast.some(f => f.predictedValue <= 0)) {
      insights.recommendations.push('Forecast predicts potential zero or negative values - review model assumptions');
    }
    
    if (insights.keyFindings.length === 0) {
      insights.keyFindings.push('No significant patterns detected in the data');
    }
    
    if (insights.recommendations.length === 0) {
      insights.recommendations.push('Continue monitoring data for emerging patterns');
    }
    
    return insights;
  }
}