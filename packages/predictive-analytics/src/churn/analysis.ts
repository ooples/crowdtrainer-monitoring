import { mean } from 'simple-statistics';
import { ChurnAnalysisInput, ChurnAnalysisOutput } from '../types';

interface UserFeatures {
  userId: string;
  recency: number; // Days since last activity
  frequency: number; // Average sessions per week
  monetary: number; // Value score (0-1)
  engagement: number; // Engagement score (0-1)
  support: number; // Support interaction score
  risk_factors: string[];
}

interface ChurnScore {
  userId: string;
  score: number;
  confidence: number;
  factors: { factor: string; weight: number }[];
}

export class ChurnAnalyzer {
  private readonly churnThresholds = {
    low: 0.3,
    medium: 0.6,
    high: 0.8
  };

  private readonly featureWeights = {
    recency: 0.25,
    frequency: 0.20,
    monetary: 0.15,
    engagement: 0.20,
    support: 0.10,
    account_age: 0.10
  };

  constructor() {}

  async analyzeChurn(input: ChurnAnalysisInput): Promise<ChurnAnalysisOutput> {
    this.validateInput(input);

    // Extract user features
    const userFeatures = this.extractUserFeatures(input.userMetrics, input.engagementPatterns);
    
    // Calculate churn scores for individual users
    const userRiskScores = this.calculateUserRiskScores(userFeatures);
    
    // Analyze cohort behavior
    const cohortInsights = this.analyzeCohorts(input.cohortData, userRiskScores);
    
    // Calculate global metrics
    const globalMetrics = this.calculateGlobalMetrics(userRiskScores, input.cohortData);
    
    // Generate intervention strategies
    const interventionStrategies = this.generateInterventionStrategies(userRiskScores, cohortInsights);

    return {
      userRiskScores: userRiskScores.map(score => ({
        userId: score.userId,
        churnProbability: score.score,
        riskLevel: this.determineRiskLevel(score.score),
        keyFactors: score.factors.slice(0, 3).map(f => f.factor),
        recommendedActions: this.generateUserRecommendations(score)
      })),
      cohortInsights,
      globalMetrics,
      interventionStrategies
    };
  }

  private validateInput(input: ChurnAnalysisInput): void {
    if (!input.userMetrics || input.userMetrics.length === 0) {
      throw new Error('User metrics data is required');
    }

    if (!input.engagementPatterns || input.engagementPatterns.length === 0) {
      throw new Error('Engagement patterns data is required');
    }

    if (input.userMetrics.length !== input.engagementPatterns.length) {
      console.warn('Mismatch between user metrics and engagement patterns data length');
    }

    // Check for required fields
    const requiredFields = ['userId', 'accountAge', 'lastActivity', 'sessionsLastWeek'];
    const missingFields = input.userMetrics.filter(user => 
      requiredFields.some(field => user[field as keyof typeof user] === undefined)
    );

    if (missingFields.length > input.userMetrics.length * 0.1) {
      throw new Error('Too many users missing required data fields');
    }
  }

  private extractUserFeatures(userMetrics: any[], engagementPatterns: any[]): UserFeatures[] {
    return userMetrics.map((user, index) => {
      const engagement = engagementPatterns[index] || {};
      const now = new Date();
      
      // Recency: Days since last activity (higher = more likely to churn)
      const lastActivity = new Date(user.lastActivity);
      const recency = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));
      
      // Frequency: Sessions per week (higher = less likely to churn)
      const frequency = user.sessionsLastWeek || 0;
      
      // Monetary value estimation based on account age and engagement
      const monetary = this.calculateMonetaryScore(user, engagement);
      
      // Engagement score based on various activities
      const engagementScore = this.calculateEngagementScore(user, engagement);
      
      // Support interaction score (more support tickets = higher churn risk)
      const support = Math.min(1, (user.supportTickets || 0) / 10);
      
      // Identify risk factors
      const risk_factors = this.identifyRiskFactors(user, engagement);

      return {
        userId: user.userId,
        recency: Math.min(1, recency / 30), // Normalize to 30 days
        frequency: Math.min(1, frequency / 10), // Normalize to 10 sessions/week
        monetary,
        engagement: engagementScore,
        support,
        risk_factors
      };
    });
  }

  private calculateMonetaryScore(user: any, engagement: any): number {
    let score = 0;
    
    // Account age (longer accounts are more valuable)
    score += Math.min(0.4, user.accountAge / 365); // Max 0.4 for 1+ year accounts
    
    // Feature usage (more features = more investment)
    const featuresUsed = user.featuresUsed?.length || 0;
    score += Math.min(0.3, featuresUsed / 20); // Max 0.3 for 20+ features
    
    // Content creation (indicates investment)
    const contentCreated = engagement.contentCreated || 0;
    score += Math.min(0.2, contentCreated / 50); // Max 0.2 for 50+ pieces of content
    
    // Social interactions (network effects)
    const socialInteractions = engagement.socialInteractions || 0;
    score += Math.min(0.1, socialInteractions / 100); // Max 0.1 for 100+ interactions
    
    return Math.min(1, score);
  }

  private calculateEngagementScore(user: any, engagement: any): number {
    let score = 0;
    
    // Session frequency and duration
    const avgSessionDuration = user.avgSessionDuration || 0;
    const sessionsLastWeek = user.sessionsLastWeek || 0;
    
    score += Math.min(0.3, sessionsLastWeek / 7); // Daily usage gets 0.3
    score += Math.min(0.2, avgSessionDuration / 60); // 1-hour sessions get 0.2
    
    // Login frequency
    const loginFrequency = engagement.loginFrequency || 0;
    score += Math.min(0.2, loginFrequency / 30); // Daily logins get 0.2
    
    // Feature adoption
    const featureAdoption = engagement.featureAdoption || 0;
    score += Math.min(0.2, featureAdoption); // Already normalized 0-1
    
    // Content and social engagement
    const contentCreated = engagement.contentCreated || 0;
    const socialInteractions = engagement.socialInteractions || 0;
    
    score += Math.min(0.05, contentCreated / 20);
    score += Math.min(0.05, socialInteractions / 50);
    
    return Math.min(1, score);
  }

  private identifyRiskFactors(user: any, engagement: any): string[] {
    const factors = [];
    const now = new Date();
    const lastActivity = new Date(user.lastActivity);
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));
    
    // Inactivity risk factors
    if (daysSinceActivity > 7) factors.push('inactive_week');
    if (daysSinceActivity > 14) factors.push('inactive_two_weeks');
    if (daysSinceActivity > 30) factors.push('inactive_month');
    
    // Low engagement factors
    if ((user.sessionsLastWeek || 0) === 0) factors.push('no_recent_sessions');
    if ((user.sessionsLastWeek || 0) < 2) factors.push('low_session_frequency');
    if ((user.avgSessionDuration || 0) < 5) factors.push('short_sessions');
    
    // Support and payment issues
    if ((user.supportTickets || 0) > 3) factors.push('high_support_usage');
    if ((user.paymentIssues || 0) > 0) factors.push('payment_problems');
    
    // Feature adoption issues
    if ((user.featuresUsed?.length || 0) < 3) factors.push('low_feature_adoption');
    if ((engagement.featureAdoption || 0) < 0.3) factors.push('poor_feature_engagement');
    
    // Social engagement issues
    if ((engagement.socialInteractions || 0) === 0) factors.push('no_social_engagement');
    if ((engagement.contentCreated || 0) === 0) factors.push('no_content_creation');
    
    // Account age risk
    if (user.accountAge < 30) factors.push('new_user');
    
    return factors;
  }

  private calculateUserRiskScores(features: UserFeatures[]): ChurnScore[] {
    return features.map(feature => {
      // Calculate weighted churn score
      let score = 0;
      const factors: { factor: string; weight: number }[] = [];
      
      // Recency factor (higher recency = higher churn risk)
      const recencyWeight = this.featureWeights.recency * feature.recency;
      score += recencyWeight;
      factors.push({ factor: 'inactivity', weight: recencyWeight });
      
      // Frequency factor (higher frequency = lower churn risk)
      const frequencyWeight = this.featureWeights.frequency * (1 - feature.frequency);
      score += frequencyWeight;
      factors.push({ factor: 'low_usage_frequency', weight: frequencyWeight });
      
      // Monetary factor (higher value = lower churn risk)
      const monetaryWeight = this.featureWeights.monetary * (1 - feature.monetary);
      score += monetaryWeight;
      factors.push({ factor: 'low_investment', weight: monetaryWeight });
      
      // Engagement factor (higher engagement = lower churn risk)
      const engagementWeight = this.featureWeights.engagement * (1 - feature.engagement);
      score += engagementWeight;
      factors.push({ factor: 'low_engagement', weight: engagementWeight });
      
      // Support factor (more support issues = higher churn risk)
      const supportWeight = this.featureWeights.support * feature.support;
      score += supportWeight;
      factors.push({ factor: 'support_issues', weight: supportWeight });
      
      // Risk factor bonuses
      const riskBonus = feature.risk_factors.length * 0.05; // 5% per risk factor
      score += Math.min(0.2, riskBonus); // Cap at 20%
      
      // Normalize score to 0-1 range
      score = Math.max(0, Math.min(1, score));
      
      // Calculate confidence based on data completeness
      const confidence = this.calculateConfidence(feature);
      
      // Sort factors by weight
      factors.sort((a, b) => b.weight - a.weight);

      return {
        userId: feature.userId,
        score,
        confidence,
        factors: factors.slice(0, 5) // Top 5 factors
      };
    });
  }

  private calculateConfidence(feature: UserFeatures): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for users with more data
    if (feature.recency <= 0.1) confidence += 0.2; // Recent activity
    if (feature.frequency > 0.3) confidence += 0.1; // Regular usage
    if (feature.risk_factors.length >= 3) confidence += 0.1; // Clear risk profile
    if (feature.engagement > 0.2) confidence += 0.1; // Some engagement data
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= this.churnThresholds.high) return 'high';
    if (score >= this.churnThresholds.medium) return 'medium';
    return 'low';
  }

  private analyzeCohorts(cohortData: any[], userRiskScores: ChurnScore[]) {
    if (!cohortData || cohortData.length === 0) {
      return [];
    }

    return cohortData.map(cohort => {
      // Find users in this cohort (simplified - would need actual cohort-user mapping)
      const cohortUsers = userRiskScores.slice(0, Math.floor(userRiskScores.length / cohortData.length));
      
      const avgChurnProbability = mean(cohortUsers.map(u => u.score));
      
      // Identify key risk factors for this cohort
      const factorCounts: Record<string, number> = {};
      cohortUsers.forEach(user => {
        user.factors.forEach(factor => {
          factorCounts[factor.factor] = (factorCounts[factor.factor] || 0) + 1;
        });
      });
      
      const keyRiskFactors = Object.entries(factorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([factor]) => factor);

      return {
        cohortMonth: cohort.cohortMonth,
        predictedChurn: Math.round(avgChurnProbability * 100) / 100,
        keyRiskFactors
      };
    });
  }

  private calculateGlobalMetrics(userRiskScores: ChurnScore[], cohortData: any[]) {
    if (userRiskScores.length === 0) {
      return {
        overallChurnRate: 0,
        churnTrend: 'stable' as const,
        topChurnReasons: []
      };
    }

    const overallChurnRate = mean(userRiskScores.map(u => u.score));
    
    // Determine trend from cohort data
    let churnTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (cohortData && cohortData.length >= 3) {
      const recentCohorts = cohortData.slice(-3);
      const oldCohorts = cohortData.slice(0, 3);
      
      const recentAvgChurn = mean(recentCohorts.map(c => 1 - (c.retentionRates[0] || 0)));
      const oldAvgChurn = mean(oldCohorts.map(c => 1 - (c.retentionRates[0] || 0)));
      
      if (recentAvgChurn > oldAvgChurn * 1.1) churnTrend = 'increasing';
      else if (recentAvgChurn < oldAvgChurn * 0.9) churnTrend = 'decreasing';
    }
    
    // Identify top churn reasons
    const factorCounts: Record<string, number> = {};
    userRiskScores.forEach(user => {
      user.factors.forEach(factor => {
        factorCounts[factor.factor] = (factorCounts[factor.factor] || 0) + factor.weight;
      });
    });
    
    const topChurnReasons = Object.entries(factorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([reason]) => this.humanizeFactorName(reason));

    return {
      overallChurnRate: Math.round(overallChurnRate * 100) / 100,
      churnTrend,
      topChurnReasons
    };
  }

  private generateInterventionStrategies(userRiskScores: ChurnScore[], _cohortInsights: any[]) {
    const strategies = [];
    
    // High-risk users strategy
    const highRiskUsers = userRiskScores.filter(u => u.score >= this.churnThresholds.high);
    if (highRiskUsers.length > 0) {
      strategies.push({
        segment: 'High-risk users',
        strategy: 'Personal outreach and retention offers',
        expectedImpact: 0.4 // 40% retention improvement
      });
    }
    
    // Medium-risk users strategy
    const mediumRiskUsers = userRiskScores.filter(u => 
      u.score >= this.churnThresholds.medium && u.score < this.churnThresholds.high
    );
    if (mediumRiskUsers.length > 0) {
      strategies.push({
        segment: 'Medium-risk users',
        strategy: 'Automated engagement campaigns and feature recommendations',
        expectedImpact: 0.25 // 25% retention improvement
      });
    }
    
    // New users with low engagement
    const newLowEngagementUsers = userRiskScores.filter(u => 
      u.factors.some(f => f.factor === 'low_engagement') &&
      u.factors.some(f => f.factor === 'new_user')
    );
    if (newLowEngagementUsers.length > 0) {
      strategies.push({
        segment: 'New users with low engagement',
        strategy: 'Enhanced onboarding and early success programs',
        expectedImpact: 0.6 // 60% retention improvement for new users
      });
    }
    
    // Users with support issues
    const supportIssueUsers = userRiskScores.filter(u => 
      u.factors.some(f => f.factor === 'support_issues')
    );
    if (supportIssueUsers.length > 0) {
      strategies.push({
        segment: 'Users with support issues',
        strategy: 'Proactive customer success and issue resolution',
        expectedImpact: 0.5 // 50% retention improvement
      });
    }
    
    // Low feature adoption users
    const lowAdoptionUsers = userRiskScores.filter(u => 
      u.factors.some(f => f.factor === 'low_investment')
    );
    if (lowAdoptionUsers.length > 0) {
      strategies.push({
        segment: 'Low feature adoption users',
        strategy: 'Feature education and guided tours',
        expectedImpact: 0.3 // 30% retention improvement
      });
    }

    return strategies;
  }

  private generateUserRecommendations(churnScore: ChurnScore): string[] {
    const recommendations = [];
    const topFactors = churnScore.factors.slice(0, 3);
    
    for (const factor of topFactors) {
      switch (factor.factor) {
        case 'inactivity':
          recommendations.push('Send re-engagement email with personalized content');
          break;
        case 'low_usage_frequency':
          recommendations.push('Provide usage tips and feature recommendations');
          break;
        case 'low_engagement':
          recommendations.push('Offer guided product tour and success coaching');
          break;
        case 'low_investment':
          recommendations.push('Highlight value and provide feature adoption incentives');
          break;
        case 'support_issues':
          recommendations.push('Schedule customer success call to address concerns');
          break;
        default:
          recommendations.push('Monitor closely and provide proactive support');
      }
    }
    
    // Risk level specific recommendations
    if (churnScore.score >= this.churnThresholds.high) {
      recommendations.unshift('URGENT: Immediate personal outreach required');
    } else if (churnScore.score >= this.churnThresholds.medium) {
      recommendations.unshift('Include in targeted retention campaign');
    }
    
    return [...new Set(recommendations)].slice(0, 4); // Remove duplicates and limit
  }

  private humanizeFactorName(factor: string): string {
    const humanNames: Record<string, string> = {
      'inactivity': 'User Inactivity',
      'low_usage_frequency': 'Low Usage Frequency', 
      'low_engagement': 'Poor Engagement',
      'low_investment': 'Limited Feature Usage',
      'support_issues': 'Support Issues',
      'no_social_engagement': 'No Social Activity',
      'payment_problems': 'Payment Issues',
      'short_sessions': 'Short Session Duration',
      'new_user': 'New User Risk'
    };
    
    return humanNames[factor] || factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}