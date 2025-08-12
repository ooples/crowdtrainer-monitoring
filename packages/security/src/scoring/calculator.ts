import { EventEmitter } from 'events';
import {
  SecurityScore,
  SecurityScoreCategory,
  SecurityFactor,
  SecurityRecommendation,
  RecommendationPriority,
  ScoreTrend,
  TrendDirection,
  SecurityScoringConfig,
  SecurityMetrics,
  VulnerabilityCount,
  SecurityEvent,
  SecuritySeverity
} from '../types';
import { CryptoUtils, ScoringUtils, TimeUtils, StatsUtils } from '../utils';

/**
 * Security posture scoring system (0-100 scale)
 * Provides comprehensive security assessment and recommendations
 */
export class SecurityScoreCalculator extends EventEmitter {
  private config: SecurityScoringConfig;
  private isRunning = false;
  private currentScore: SecurityScore | null = null;
  private scoreHistory: SecurityScore[] = [];
  private calculationInterval?: NodeJS.Timeout;
  private securityMetrics: SecurityMetrics;
  private benchmarks: SecurityBenchmarks;

  constructor(config: SecurityScoringConfig) {
    super();
    this.config = config;
    this.securityMetrics = this.initializeMetrics();
    this.benchmarks = this.initializeBenchmarks();
  }

  /**
   * Start security scoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Calculate initial score
    await this.calculateScore();
    
    // Start periodic calculations
    this.startPeriodicCalculation();

    this.emit('scoring:started');
  }

  /**
   * Stop security scoring
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.calculationInterval) {
      clearInterval(this.calculationInterval);
      this.calculationInterval = undefined;
    }

    this.emit('scoring:stopped');
  }

  /**
   * Calculate comprehensive security score
   */
  async calculateScore(): Promise<SecurityScore> {
    const timestamp = new Date();
    
    // Calculate category scores
    const categories = await this.calculateCategoryScores();
    
    // Calculate overall score using weighted average
    const overallScore = ScoringUtils.calculateWeightedScore(
      categories.map(category => ({
        value: category.score,
        weight: category.weight
      }))
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(categories);

    // Calculate trend
    const trend = this.calculateTrend(overallScore);

    const score: SecurityScore = {
      overall: Math.round(overallScore),
      categories,
      timestamp,
      recommendations,
      trend
    };

    // Store score
    this.currentScore = score;
    this.scoreHistory.push(score);
    
    // Keep only last 30 days of history
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.scoreHistory = this.scoreHistory.filter(s => s.timestamp > cutoff);

    this.emit('security:score_calculated', score);
    return score;
  }

  /**
   * Get current security score
   */
  getCurrentScore(): SecurityScore | null {
    return this.currentScore;
  }

  /**
   * Get score history
   */
  getScoreHistory(days?: number): SecurityScore[] {
    if (!days) return [...this.scoreHistory];
    
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.scoreHistory.filter(s => s.timestamp > cutoff);
  }

  /**
   * Update security metrics
   */
  updateMetrics(metrics: Partial<SecurityMetrics>): void {
    this.securityMetrics = { ...this.securityMetrics, ...metrics };
    this.emit('security:metrics_updated', this.securityMetrics);
  }

  /**
   * Process security event for scoring impact
   */
  processSecurityEvent(event: SecurityEvent): void {
    // Update metrics based on event
    switch (event.type) {
      case 'threat_detected':
        this.securityMetrics.threatsDetected++;
        if (event.details?.blocked) {
          this.securityMetrics.threatsBlocked++;
        }
        break;
      case 'vulnerability_found':
        this.updateVulnerabilityCount(event.severity);
        break;
      case 'ddos_attack':
        this.securityMetrics.ddosAttacks++;
        break;
      case 'access_anomaly':
        this.securityMetrics.anomaliesDetected++;
        break;
    }

    // Recalculate score if significant event
    if (event.severity === SecuritySeverity.CRITICAL || 
        event.severity === SecuritySeverity.HIGH) {
      this.scheduleScoreRecalculation();
    }
  }

  /**
   * Generate detailed security report
   */
  async generateDetailedReport(): Promise<SecurityReport> {
    const currentScore = this.currentScore || await this.calculateScore();
    const history = this.getScoreHistory(30); // Last 30 days
    
    return {
      id: CryptoUtils.generateSecureId(),
      timestamp: new Date(),
      overallScore: currentScore.overall,
      scoreBreakdown: currentScore.categories,
      trend: currentScore.trend,
      recommendations: currentScore.recommendations,
      metrics: this.securityMetrics,
      benchmarkComparison: this.compareToBenchmarks(currentScore),
      riskAssessment: this.assessRisk(currentScore),
      improvementPlan: this.generateImprovementPlan(currentScore),
      historicalData: {
        scores: history.map(s => ({ timestamp: s.timestamp, score: s.overall })),
        trends: this.calculateHistoricalTrends(history)
      }
    };
  }

  /**
   * Calculate category-specific scores
   */
  private async calculateCategoryScores(): Promise<SecurityScoreCategory[]> {
    const categories: SecurityScoreCategory[] = [];

    // Threat Detection & Response
    categories.push(await this.calculateThreatScore());

    // Vulnerability Management
    categories.push(await this.calculateVulnerabilityScore());

    // Access Control & Authentication
    categories.push(await this.calculateAccessControlScore());

    // Data Protection & Privacy
    categories.push(await this.calculateDataProtectionScore());

    // Network Security
    categories.push(await this.calculateNetworkSecurityScore());

    // Compliance & Governance
    categories.push(await this.calculateComplianceScore());

    // Incident Response
    categories.push(await this.calculateIncidentResponseScore());

    // Security Monitoring
    categories.push(await this.calculateMonitoringScore());

    return categories;
  }

  /**
   * Calculate threat detection score
   */
  private async calculateThreatScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];
    
    // Threat detection coverage
    const detectionCoverage = this.calculateDetectionCoverage();
    factors.push({
      name: 'Detection Coverage',
      value: detectionCoverage,
      weight: 0.3,
      impact: 0.3,
      description: 'Percentage of attack vectors covered by detection systems'
    });

    // Response time
    const avgResponseTime = this.calculateAverageResponseTime();
    const responseScore = Math.max(0, 100 - (avgResponseTime / 60)); // Penalize slow response
    factors.push({
      name: 'Response Time',
      value: responseScore,
      weight: 0.25,
      impact: 0.25,
      description: 'Speed of threat response and mitigation'
    });

    // False positive rate
    const fpRate = this.calculateFalsePositiveRate();
    const fpScore = Math.max(0, 100 - (fpRate * 2)); // Penalize false positives
    factors.push({
      name: 'Detection Accuracy',
      value: fpScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Accuracy of threat detection (low false positives)'
    });

    // Threat intelligence integration
    const tiScore = this.calculateThreatIntelligenceScore();
    factors.push({
      name: 'Threat Intelligence',
      value: tiScore,
      weight: 0.15,
      impact: 0.15,
      description: 'Integration with threat intelligence feeds'
    });

    // Automation level
    const automationScore = this.calculateAutomationScore();
    factors.push({
      name: 'Response Automation',
      value: automationScore,
      weight: 0.1,
      impact: 0.1,
      description: 'Level of automated threat response'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Threat Detection & Response',
      score: Math.round(categoryScore),
      weight: this.config.weights.threatDetection || 0.2,
      factors
    };
  }

  /**
   * Calculate vulnerability management score
   */
  private async calculateVulnerabilityScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];
    
    // Critical vulnerability count
    const criticalVulns = this.securityMetrics.vulnerabilities.critical;
    const criticalScore = Math.max(0, 100 - (criticalVulns * 10));
    factors.push({
      name: 'Critical Vulnerabilities',
      value: criticalScore,
      weight: 0.4,
      impact: 0.4,
      description: 'Number of unpatched critical vulnerabilities'
    });

    // High vulnerability count
    const highVulns = this.securityMetrics.vulnerabilities.high;
    const highScore = Math.max(0, 100 - (highVulns * 5));
    factors.push({
      name: 'High Vulnerabilities',
      value: highScore,
      weight: 0.3,
      impact: 0.3,
      description: 'Number of unpatched high-severity vulnerabilities'
    });

    // Patch management efficiency
    const patchScore = this.calculatePatchManagementScore();
    factors.push({
      name: 'Patch Management',
      value: patchScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Efficiency of vulnerability patching process'
    });

    // Scanning coverage
    const scanCoverage = this.calculateScanningCoverage();
    factors.push({
      name: 'Scanning Coverage',
      value: scanCoverage,
      weight: 0.1,
      impact: 0.1,
      description: 'Percentage of assets covered by vulnerability scanning'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Vulnerability Management',
      score: Math.round(categoryScore),
      weight: this.config.weights.vulnerabilityManagement || 0.25,
      factors
    };
  }

  /**
   * Calculate access control score
   */
  private async calculateAccessControlScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];

    // Multi-factor authentication coverage
    const mfaCoverage = this.calculateMFACoverage();
    factors.push({
      name: 'MFA Coverage',
      value: mfaCoverage,
      weight: 0.3,
      impact: 0.3,
      description: 'Percentage of accounts protected by MFA'
    });

    // Privileged access management
    const pamScore = this.calculatePAMScore();
    factors.push({
      name: 'Privileged Access Management',
      value: pamScore,
      weight: 0.25,
      impact: 0.25,
      description: 'Management of privileged user accounts'
    });

    // Access review compliance
    const accessReviewScore = this.calculateAccessReviewScore();
    factors.push({
      name: 'Access Reviews',
      value: accessReviewScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Regular review and certification of user access'
    });

    // Principle of least privilege
    const polpScore = this.calculatePrincipleOfLeastPrivilegeScore();
    factors.push({
      name: 'Least Privilege',
      value: polpScore,
      weight: 0.15,
      impact: 0.15,
      description: 'Implementation of least privilege principle'
    });

    // Session management
    const sessionScore = this.calculateSessionManagementScore();
    factors.push({
      name: 'Session Management',
      value: sessionScore,
      weight: 0.1,
      impact: 0.1,
      description: 'Secure session handling and timeout controls'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Access Control & Authentication',
      score: Math.round(categoryScore),
      weight: this.config.weights.accessControl || 0.2,
      factors
    };
  }

  /**
   * Calculate data protection score
   */
  private async calculateDataProtectionScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];

    // Encryption coverage
    const encryptionCoverage = this.calculateEncryptionCoverage();
    factors.push({
      name: 'Data Encryption',
      value: encryptionCoverage,
      weight: 0.3,
      impact: 0.3,
      description: 'Percentage of sensitive data encrypted'
    });

    // Data classification
    const classificationScore = this.calculateDataClassificationScore();
    factors.push({
      name: 'Data Classification',
      value: classificationScore,
      weight: 0.25,
      impact: 0.25,
      description: 'Proper classification and labeling of data'
    });

    // Backup and recovery
    const backupScore = this.calculateBackupScore();
    factors.push({
      name: 'Backup & Recovery',
      value: backupScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Data backup and disaster recovery capabilities'
    });

    // Data loss prevention
    const dlpScore = this.calculateDLPScore();
    factors.push({
      name: 'Data Loss Prevention',
      value: dlpScore,
      weight: 0.15,
      impact: 0.15,
      description: 'Prevention of unauthorized data exfiltration'
    });

    // Privacy controls
    const privacyScore = this.calculatePrivacyControlsScore();
    factors.push({
      name: 'Privacy Controls',
      value: privacyScore,
      weight: 0.1,
      impact: 0.1,
      description: 'Implementation of privacy protection measures'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Data Protection & Privacy',
      score: Math.round(categoryScore),
      weight: this.config.weights.dataProtection || 0.15,
      factors
    };
  }

  /**
   * Calculate network security score
   */
  private async calculateNetworkSecurityScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];

    // Firewall coverage
    const firewallScore = this.calculateFirewallScore();
    factors.push({
      name: 'Firewall Protection',
      value: firewallScore,
      weight: 0.3,
      impact: 0.3,
      description: 'Network firewall coverage and configuration'
    });

    // Network segmentation
    const segmentationScore = this.calculateNetworkSegmentationScore();
    factors.push({
      name: 'Network Segmentation',
      value: segmentationScore,
      weight: 0.25,
      impact: 0.25,
      description: 'Proper network segmentation and isolation'
    });

    // Intrusion detection/prevention
    const idsScore = this.calculateIDSScore();
    factors.push({
      name: 'Intrusion Detection',
      value: idsScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Network intrusion detection and prevention'
    });

    // DDoS protection
    const ddosScore = this.calculateDDoSProtectionScore();
    factors.push({
      name: 'DDoS Protection',
      value: ddosScore,
      weight: 0.15,
      impact: 0.15,
      description: 'DDoS attack detection and mitigation'
    });

    // Network monitoring
    const monitoringScore = this.calculateNetworkMonitoringScore();
    factors.push({
      name: 'Network Monitoring',
      value: monitoringScore,
      weight: 0.1,
      impact: 0.1,
      description: 'Continuous network traffic monitoring'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Network Security',
      score: Math.round(categoryScore),
      weight: this.config.weights.networkSecurity || 0.1,
      factors
    };
  }

  /**
   * Calculate compliance score
   */
  private async calculateComplianceScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];

    // Regulatory compliance
    const regulatoryScore = this.securityMetrics.complianceScore;
    factors.push({
      name: 'Regulatory Compliance',
      value: regulatoryScore,
      weight: 0.4,
      impact: 0.4,
      description: 'Compliance with applicable regulations'
    });

    // Policy compliance
    const policyScore = this.calculatePolicyComplianceScore();
    factors.push({
      name: 'Policy Compliance',
      value: policyScore,
      weight: 0.3,
      impact: 0.3,
      description: 'Adherence to internal security policies'
    });

    // Audit readiness
    const auditScore = this.calculateAuditReadinessScore();
    factors.push({
      name: 'Audit Readiness',
      value: auditScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Preparedness for security audits'
    });

    // Documentation completeness
    const docScore = this.calculateDocumentationScore();
    factors.push({
      name: 'Documentation',
      value: docScore,
      weight: 0.1,
      impact: 0.1,
      description: 'Completeness of security documentation'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Compliance & Governance',
      score: Math.round(categoryScore),
      weight: this.config.weights.compliance || 0.1,
      factors
    };
  }

  /**
   * Calculate incident response score
   */
  private async calculateIncidentResponseScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];

    // Response plan maturity
    const planScore = this.calculateResponsePlanScore();
    factors.push({
      name: 'Response Plan',
      value: planScore,
      weight: 0.3,
      impact: 0.3,
      description: 'Maturity of incident response plan'
    });

    // Team readiness
    const teamScore = this.calculateResponseTeamScore();
    factors.push({
      name: 'Team Readiness',
      value: teamScore,
      weight: 0.25,
      impact: 0.25,
      description: 'Incident response team training and availability'
    });

    // Mean time to detection
    const mttdScore = this.calculateMTTDScore();
    factors.push({
      name: 'Detection Speed',
      value: mttdScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Speed of incident detection'
    });

    // Mean time to response
    const mttrScore = this.calculateMTTRScore();
    factors.push({
      name: 'Response Speed',
      value: mttrScore,
      weight: 0.15,
      impact: 0.15,
      description: 'Speed of incident response'
    });

    // Communication effectiveness
    const commScore = this.calculateCommunicationScore();
    factors.push({
      name: 'Communication',
      value: commScore,
      weight: 0.1,
      impact: 0.1,
      description: 'Effectiveness of incident communication'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Incident Response',
      score: Math.round(categoryScore),
      weight: this.config.weights.incidentResponse || 0.05,
      factors
    };
  }

  /**
   * Calculate monitoring score
   */
  private async calculateMonitoringScore(): Promise<SecurityScoreCategory> {
    const factors: SecurityFactor[] = [];

    // Monitoring coverage
    const coverageScore = this.calculateMonitoringCoverage();
    factors.push({
      name: 'Monitoring Coverage',
      value: coverageScore,
      weight: 0.35,
      impact: 0.35,
      description: 'Percentage of assets under security monitoring'
    });

    // Alert quality
    const alertScore = this.calculateAlertQualityScore();
    factors.push({
      name: 'Alert Quality',
      value: alertScore,
      weight: 0.25,
      impact: 0.25,
      description: 'Quality and relevance of security alerts'
    });

    // Log management
    const logScore = this.calculateLogManagementScore();
    factors.push({
      name: 'Log Management',
      value: logScore,
      weight: 0.2,
      impact: 0.2,
      description: 'Centralized logging and log analysis'
    });

    // Analytics capability
    const analyticsScore = this.calculateAnalyticsScore();
    factors.push({
      name: 'Security Analytics',
      value: analyticsScore,
      weight: 0.15,
      impact: 0.15,
      description: 'Advanced security analytics and correlation'
    });

    // Reporting effectiveness
    const reportingScore = this.calculateReportingScore();
    factors.push({
      name: 'Reporting',
      value: reportingScore,
      weight: 0.05,
      impact: 0.05,
      description: 'Quality and timeliness of security reporting'
    });

    const categoryScore = ScoringUtils.calculateWeightedScore(factors);

    return {
      name: 'Security Monitoring',
      score: Math.round(categoryScore),
      weight: this.config.weights.monitoring || 0.05,
      factors
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(categories: SecurityScoreCategory[]): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];

    for (const category of categories) {
      // Find low-scoring factors
      const lowFactors = category.factors.filter(f => f.value < 70);
      
      for (const factor of lowFactors) {
        const priority = this.determinePriority(factor.value, factor.impact);
        const recommendation: SecurityRecommendation = {
          priority,
          category: category.name,
          title: `Improve ${factor.name}`,
          description: `Current score: ${factor.value.toFixed(1)}%. ${factor.description}`,
          impact: factor.impact * category.weight * 100,
          effort: this.estimateEffort(factor.value, factor.impact),
          resources: this.getRecommendedResources(category.name, factor.name)
        };

        recommendations.push(recommendation);
      }
    }

    // Sort by impact and priority
    recommendations.sort((a, b) => {
      const priorityOrder = {
        [RecommendationPriority.CRITICAL]: 4,
        [RecommendationPriority.HIGH]: 3,
        [RecommendationPriority.MEDIUM]: 2,
        [RecommendationPriority.LOW]: 1
      };
      
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0 ? priorityDiff : b.impact - a.impact;
    });

    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  /**
   * Calculate score trend
   */
  private calculateTrend(currentScore: number): ScoreTrend {
    if (this.scoreHistory.length < 2) {
      return {
        direction: TrendDirection.STABLE,
        change: 0,
        period: '0d',
        confidence: 0
      };
    }

    // Compare with score from 7 days ago
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const historicalScore = this.scoreHistory
      .filter(s => s.timestamp <= weekAgo)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!historicalScore) {
      return {
        direction: TrendDirection.STABLE,
        change: 0,
        period: '0d',
        confidence: 0
      };
    }

    const change = currentScore - historicalScore.overall;
    const direction = change > 2 ? TrendDirection.IMPROVING :
                     change < -2 ? TrendDirection.DECLINING :
                     TrendDirection.STABLE;

    return {
      direction,
      change,
      period: '7d',
      confidence: 0.8
    };
  }

  /**
   * Start periodic score calculation
   */
  private startPeriodicCalculation(): void {
    const interval = this.parseUpdateFrequency();
    this.calculationInterval = setInterval(async () => {
      await this.calculateScore();
    }, interval);
  }

  /**
   * Schedule immediate score recalculation
   */
  private scheduleScoreRecalculation(): void {
    // Debounce rapid recalculations
    setTimeout(async () => {
      await this.calculateScore();
    }, 5000);
  }

  // Helper methods and calculations
  private initializeMetrics(): SecurityMetrics {
    return {
      threatsDetected: 0,
      threatsBlocked: 0,
      complianceScore: 85,
      vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      auditEvents: 0,
      anomaliesDetected: 0,
      ddosAttacks: 0,
      securityScore: 0
    };
  }

  private initializeBenchmarks(): SecurityBenchmarks {
    return {
      industry: this.config.benchmarks?.industry || 75,
      size: this.config.benchmarks?.size || 70,
      sector: this.config.benchmarks?.sector || 80
    };
  }

  private updateVulnerabilityCount(severity: SecuritySeverity): void {
    switch (severity) {
      case SecuritySeverity.CRITICAL:
        this.securityMetrics.vulnerabilities.critical++;
        break;
      case SecuritySeverity.HIGH:
        this.securityMetrics.vulnerabilities.high++;
        break;
      case SecuritySeverity.MEDIUM:
        this.securityMetrics.vulnerabilities.medium++;
        break;
      case SecuritySeverity.LOW:
        this.securityMetrics.vulnerabilities.low++;
        break;
    }
    this.securityMetrics.vulnerabilities.total++;
  }

  private compareToBenchmarks(score: SecurityScore): BenchmarkComparison {
    return {
      industry: score.overall - this.benchmarks.industry,
      size: score.overall - this.benchmarks.size,
      sector: score.overall - this.benchmarks.sector
    };
  }

  private assessRisk(score: SecurityScore): RiskAssessment {
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    
    if (score.overall >= 80) riskLevel = 'low';
    else if (score.overall >= 60) riskLevel = 'medium';
    else if (score.overall >= 40) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      level: riskLevel,
      score: 100 - score.overall,
      factors: score.categories
        .filter(c => c.score < 60)
        .map(c => c.name)
    };
  }

  private generateImprovementPlan(score: SecurityScore): ImprovementPlan {
    const lowCategories = score.categories
      .filter(c => c.score < 70)
      .sort((a, b) => a.score - b.score);

    return {
      phases: lowCategories.map((category, index) => ({
        phase: index + 1,
        focus: category.name,
        duration: '30-90 days',
        expectedImprovement: Math.min(20, 70 - category.score),
        keyActions: category.factors
          .filter(f => f.value < 60)
          .slice(0, 3)
          .map(f => f.name)
      })),
      estimatedTimeline: `${lowCategories.length * 2}-${lowCategories.length * 3} months`,
      expectedFinalScore: score.overall + Math.min(30, lowCategories.length * 5)
    };
  }

  private calculateHistoricalTrends(history: SecurityScore[]): HistoricalTrend[] {
    if (history.length < 7) return [];

    const weeklyAverage = (scores: SecurityScore[]) => 
      scores.reduce((sum, s) => sum + s.overall, 0) / scores.length;

    const trends: HistoricalTrend[] = [];
    
    for (let i = 6; i < history.length; i += 7) {
      const weekScores = history.slice(i - 6, i + 1);
      const prevWeekScores = history.slice(Math.max(0, i - 13), i - 6);
      
      if (prevWeekScores.length > 0) {
        const currentAvg = weeklyAverage(weekScores);
        const prevAvg = weeklyAverage(prevWeekScores);
        
        trends.push({
          period: weekScores[weekScores.length - 1].timestamp,
          score: currentAvg,
          change: currentAvg - prevAvg
        });
      }
    }

    return trends;
  }

  private parseUpdateFrequency(): number {
    const frequency = this.config.updateFrequency;
    if (frequency.endsWith('h')) return parseInt(frequency) * 60 * 60 * 1000;
    if (frequency.endsWith('d')) return parseInt(frequency) * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000; // Default 24 hours
  }

  private determinePriority(score: number, impact: number): RecommendationPriority {
    const severity = score * impact;
    if (severity < 0.2) return RecommendationPriority.CRITICAL;
    if (severity < 0.4) return RecommendationPriority.HIGH;
    if (severity < 0.6) return RecommendationPriority.MEDIUM;
    return RecommendationPriority.LOW;
  }

  private estimateEffort(score: number, impact: number): number {
    // Lower scores and higher impact require more effort
    return Math.round((1 - score / 100) * impact * 100);
  }

  private getRecommendedResources(category: string, factor: string): string[] {
    // Simplified resource mapping - in production would be more sophisticated
    const resourceMap: Record<string, string[]> = {
      'Threat Detection & Response': ['Security Team', 'SOC Analysts', 'Threat Intel'],
      'Vulnerability Management': ['Security Team', 'IT Operations', 'DevOps'],
      'Access Control & Authentication': ['IAM Team', 'IT Security', 'DevOps'],
      'Data Protection & Privacy': ['Data Protection Team', 'Legal', 'Compliance'],
      'Network Security': ['Network Team', 'Security Architects', 'Cloud Team'],
      'Compliance & Governance': ['Compliance Team', 'Legal', 'Risk Management'],
      'Incident Response': ['CSIRT', 'Security Team', 'Communications'],
      'Security Monitoring': ['SOC Team', 'Security Engineers', 'Data Analytics']
    };

    return resourceMap[category] || ['Security Team'];
  }

  // Placeholder calculation methods (would be implemented with real data)
  private calculateDetectionCoverage(): number { return 75; }
  private calculateAverageResponseTime(): number { return 45; } // minutes
  private calculateFalsePositiveRate(): number { return 15; } // percent
  private calculateThreatIntelligenceScore(): number { return 80; }
  private calculateAutomationScore(): number { return 60; }
  private calculatePatchManagementScore(): number { return 70; }
  private calculateScanningCoverage(): number { return 85; }
  private calculateMFACoverage(): number { return 90; }
  private calculatePAMScore(): number { return 65; }
  private calculateAccessReviewScore(): number { return 70; }
  private calculatePrincipleOfLeastPrivilegeScore(): number { return 75; }
  private calculateSessionManagementScore(): number { return 80; }
  private calculateEncryptionCoverage(): number { return 85; }
  private calculateDataClassificationScore(): number { return 60; }
  private calculateBackupScore(): number { return 90; }
  private calculateDLPScore(): number { return 55; }
  private calculatePrivacyControlsScore(): number { return 70; }
  private calculateFirewallScore(): number { return 85; }
  private calculateNetworkSegmentationScore(): number { return 70; }
  private calculateIDSScore(): number { return 75; }
  private calculateDDoSProtectionScore(): number { return 80; }
  private calculateNetworkMonitoringScore(): number { return 85; }
  private calculatePolicyComplianceScore(): number { return 80; }
  private calculateAuditReadinessScore(): number { return 75; }
  private calculateDocumentationScore(): number { return 70; }
  private calculateResponsePlanScore(): number { return 85; }
  private calculateResponseTeamScore(): number { return 80; }
  private calculateMTTDScore(): number { return 75; }
  private calculateMTTRScore(): number { return 70; }
  private calculateCommunicationScore(): number { return 85; }
  private calculateMonitoringCoverage(): number { return 90; }
  private calculateAlertQualityScore(): number { return 75; }
  private calculateLogManagementScore(): number { return 85; }
  private calculateAnalyticsScore(): number { return 70; }
  private calculateReportingScore(): number { return 80; }
}

// Supporting interfaces
interface SecurityBenchmarks {
  industry: number;
  size: number;
  sector: number;
}

interface SecurityReport {
  id: string;
  timestamp: Date;
  overallScore: number;
  scoreBreakdown: SecurityScoreCategory[];
  trend: ScoreTrend;
  recommendations: SecurityRecommendation[];
  metrics: SecurityMetrics;
  benchmarkComparison: BenchmarkComparison;
  riskAssessment: RiskAssessment;
  improvementPlan: ImprovementPlan;
  historicalData: {
    scores: Array<{ timestamp: Date; score: number }>;
    trends: HistoricalTrend[];
  };
}

interface BenchmarkComparison {
  industry: number;
  size: number;
  sector: number;
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: string[];
}

interface ImprovementPlan {
  phases: Array<{
    phase: number;
    focus: string;
    duration: string;
    expectedImprovement: number;
    keyActions: string[];
  }>;
  estimatedTimeline: string;
  expectedFinalScore: number;
}

interface HistoricalTrend {
  period: Date;
  score: number;
  change: number;
}