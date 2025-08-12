import { EventEmitter } from 'events';
import {
  DDoSMetrics,
  SuspiciousPattern,
  PatternType,
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity,
  DDoSProtectionConfig,
  DDoSThresholds,
  MitigationConfig,
  GeoLocation
} from '../types';
import {
  CryptoUtils,
  IPUtils,
  StatsUtils,
  TimeUtils,
  RateLimitUtils,
  PatternUtils
} from '../utils';

/**
 * Real-time DDoS detection and auto-mitigation system
 * Detects and blocks DDoS attacks automatically
 */
export class DDoSDetector extends EventEmitter {
  private config: DDoSProtectionConfig;
  private isRunning = false;
  private requestCounts: Map<string, RequestTracker> = new Map();
  private attackPatterns: Map<string, AttackPattern> = new Map();
  private blockedIPs: Set<string> = new Set();
  private challengeResponses: Map<string, ChallengeTracker> = new Map();
  private geolocationBlocks: Map<string, number> = new Map();
  private analysisInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: DDoSDetectionMetrics;

  constructor(config: DDoSProtectionConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      attacksDetected: 0,
      attacksBlocked: 0,
      averageResponseTime: 0,
      lastAnalysis: new Date()
    };
  }

  /**
   * Start DDoS detection
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startContinuousAnalysis();
    this.startCleanupTasks();

    this.emit('ddos:started');
  }

  /**
   * Stop DDoS detection
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.emit('ddos:stopped');
  }

  /**
   * Analyze incoming request for DDoS patterns
   */
  async analyzeRequest(request: {
    id: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    method: string;
    path: string;
    size: number;
    responseTime: number;
    statusCode: number;
    headers: Record<string, string>;
    location?: GeoLocation;
  }): Promise<DDoSAnalysisResult> {
    this.metrics.totalRequests++;
    this.metrics.averageResponseTime = this.updateAverageResponseTime(request.responseTime);

    const result: DDoSAnalysisResult = {
      isAttack: false,
      confidence: 0,
      patterns: [],
      severity: SecuritySeverity.LOW,
      recommendations: [],
      shouldBlock: false,
      shouldChallenge: false,
      shouldRateLimit: false
    };

    // Check if IP is already blocked
    if (this.blockedIPs.has(request.ipAddress)) {
      result.shouldBlock = true;
      result.isAttack = true;
      result.severity = SecuritySeverity.HIGH;
      this.metrics.blockedRequests++;
      return result;
    }

    // Check whitelist
    if (this.isWhitelisted(request.ipAddress)) {
      return result; // Allow whitelisted IPs
    }

    try {
      // Track request
      this.trackRequest(request);

      // Perform multiple analysis checks
      const volumeAnalysis = await this.analyzeVolume(request);
      const patternAnalysis = await this.analyzePatterns(request);
      const geoAnalysis = await this.analyzeGeolocation(request);
      const behaviorAnalysis = await this.analyzeBehavior(request);
      const rateLimitAnalysis = await this.analyzeRateLimit(request);

      // Combine results
      const analyses = [volumeAnalysis, patternAnalysis, geoAnalysis, behaviorAnalysis, rateLimitAnalysis];
      result.confidence = this.calculateOverallConfidence(analyses);
      result.patterns = analyses.flatMap(a => a.patterns);
      result.severity = this.calculateOverallSeverity(analyses);
      
      // Determine if attack
      result.isAttack = result.confidence >= 0.7;

      // Determine mitigation actions
      if (result.isAttack) {
        result.shouldBlock = this.shouldBlockIP(request, result);
        result.shouldChallenge = this.shouldChallengeIP(request, result);
        result.shouldRateLimit = this.shouldRateLimit(request, result);
        
        result.recommendations = this.generateMitigationRecommendations(result, request);
        
        // Execute mitigation if auto-block is enabled
        if (this.config.mitigation.autoBlock) {
          await this.executeMitigation(request, result);
        }

        // Record attack
        await this.recordAttack(request, result);
      }

    } catch (error) {
      console.error('Error during DDoS analysis:', error);
    }

    return result;
  }

  /**
   * Get current DDoS metrics
   */
  getCurrentMetrics(): DDoSMetrics {
    const now = new Date();
    const windowMs = 60000; // 1 minute window

    // Calculate current requests per second
    const recentRequests = Array.from(this.requestCounts.values())
      .flatMap(tracker => tracker.timestamps)
      .filter(timestamp => now.getTime() - timestamp <= windowMs);

    const requestsPerSecond = recentRequests.length / (windowMs / 1000);

    // Calculate unique IPs
    const uniqueIPs = new Set(
      Array.from(this.requestCounts.keys())
        .filter(ip => {
          const tracker = this.requestCounts.get(ip);
          return tracker && tracker.timestamps.some(t => now.getTime() - t <= windowMs);
        })
    ).size;

    // Calculate error rate
    const recentErrors = Array.from(this.requestCounts.values())
      .reduce((total, tracker) => total + tracker.errorCount, 0);
    const errorRate = this.metrics.totalRequests > 0 ? 
      (recentErrors / this.metrics.totalRequests) * 100 : 0;

    // Calculate bandwidth usage (simplified)
    const bandwidthUsage = Array.from(this.requestCounts.values())
      .reduce((total, tracker) => total + tracker.totalBytes, 0);

    return {
      requestsPerSecond,
      uniqueIPs,
      averageResponseTime: this.metrics.averageResponseTime,
      errorRate,
      bandwidthUsage,
      suspiciousPatterns: this.getSuspiciousPatterns()
    };
  }

  /**
   * Manually block IP address
   */
  async blockIP(ipAddress: string, duration?: number): Promise<void> {
    this.blockedIPs.add(ipAddress);
    
    if (duration) {
      setTimeout(() => {
        this.blockedIPs.delete(ipAddress);
        this.emit('ddos:ip_unblocked', { ipAddress });
      }, duration);
    }

    this.emit('ddos:ip_blocked', { ipAddress, duration });
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ipAddress: string): Promise<void> {
    this.blockedIPs.delete(ipAddress);
    this.emit('ddos:ip_unblocked', { ipAddress });
  }

  /**
   * Get blocked IPs
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  /**
   * Analyze volume-based attacks
   */
  private async analyzeVolume(request: any): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      confidence: 0,
      patterns: [],
      severity: SecuritySeverity.LOW
    };

    const tracker = this.requestCounts.get(request.ipAddress);
    if (!tracker) return result;

    const now = request.timestamp.getTime();
    const windowMs = 60000; // 1 minute

    // Count requests in window
    const recentRequests = tracker.timestamps.filter(t => now - t <= windowMs);
    const requestRate = recentRequests.length / (windowMs / 1000);

    // Check against thresholds
    if (requestRate > this.config.thresholds.requestsPerSecond) {
      result.confidence += 0.8;
      result.patterns.push({
        type: PatternType.VOLUME_SPIKE,
        confidence: 0.9,
        description: `High request rate: ${requestRate.toFixed(1)} req/sec`,
        sourceIPs: [request.ipAddress],
        requestCount: recentRequests.length,
        timeWindow: windowMs
      });
      result.severity = SecuritySeverity.HIGH;
    }

    return result;
  }

  /**
   * Analyze request patterns
   */
  private async analyzePatterns(request: any): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      confidence: 0,
      patterns: [],
      severity: SecuritySeverity.LOW
    };

    const tracker = this.requestCounts.get(request.ipAddress);
    if (!tracker) return result;

    // Analyze request pattern uniformity
    const pathVariance = this.calculatePathVariance(tracker.paths);
    if (pathVariance < 0.1) { // Very uniform requests
      result.confidence += 0.6;
      result.patterns.push({
        type: PatternType.REQUEST_PATTERN,
        confidence: 0.8,
        description: 'Highly uniform request patterns detected',
        sourceIPs: [request.ipAddress],
        requestCount: tracker.timestamps.length,
        timeWindow: 300000 // 5 minutes
      });
      result.severity = SecuritySeverity.MEDIUM;
    }

    // Analyze user agent patterns
    if (PatternUtils.isSuspiciousUserAgent(request.userAgent)) {
      result.confidence += 0.4;
      result.patterns.push({
        type: PatternType.USER_AGENT_ANOMALY,
        confidence: 0.7,
        description: 'Suspicious user agent detected',
        sourceIPs: [request.ipAddress],
        requestCount: 1,
        timeWindow: 0
      });
    }

    return result;
  }

  /**
   * Analyze geographical patterns
   */
  private async analyzeGeolocation(request: any): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      confidence: 0,
      patterns: [],
      severity: SecuritySeverity.LOW
    };

    if (!request.location) return result;

    // Check if country is blocked
    if (this.config.mitigation.geoBlocking.enabled) {
      const isBlocked = this.config.mitigation.geoBlocking.blockedCountries
        .includes(request.location.country);
      
      const isAllowed = this.config.mitigation.geoBlocking.allowedCountries.length === 0 ||
        this.config.mitigation.geoBlocking.allowedCountries
          .includes(request.location.country);

      if (isBlocked || !isAllowed) {
        result.confidence += 0.9;
        result.patterns.push({
          type: PatternType.GEOGRAPHICAL_ANOMALY,
          confidence: 1.0,
          description: `Request from blocked country: ${request.location.country}`,
          sourceIPs: [request.ipAddress],
          requestCount: 1,
          timeWindow: 0
        });
        result.severity = SecuritySeverity.HIGH;
      }
    }

    // Analyze geographical distribution
    const countryRequests = this.getCountryRequestCount(request.location.country);
    const totalRequests = Array.from(this.requestCounts.values())
      .reduce((sum, tracker) => sum + tracker.timestamps.length, 0);

    const countryPercentage = totalRequests > 0 ? (countryRequests / totalRequests) : 0;

    // If a single country represents >80% of recent traffic, it might be suspicious
    if (countryPercentage > 0.8 && totalRequests > 100) {
      result.confidence += 0.5;
      result.patterns.push({
        type: PatternType.GEOGRAPHICAL_ANOMALY,
        confidence: 0.6,
        description: `High concentration of requests from ${request.location.country}: ${(countryPercentage * 100).toFixed(1)}%`,
        sourceIPs: [request.ipAddress],
        requestCount: countryRequests,
        timeWindow: 300000
      });
      result.severity = SecuritySeverity.MEDIUM;
    }

    return result;
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzeBehavior(request: any): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      confidence: 0,
      patterns: [],
      severity: SecuritySeverity.LOW
    };

    const tracker = this.requestCounts.get(request.ipAddress);
    if (!tracker) return result;

    // Analyze request timing patterns
    if (tracker.timestamps.length >= 10) {
      const intervals = [];
      for (let i = 1; i < tracker.timestamps.length; i++) {
        intervals.push(tracker.timestamps[i] - tracker.timestamps[i - 1]);
      }

      const avgInterval = StatsUtils.mean(intervals);
      const stdDev = StatsUtils.standardDeviation(intervals);
      const coefficientOfVariation = stdDev / avgInterval;

      // Very regular intervals suggest bot behavior
      if (coefficientOfVariation < 0.1 && avgInterval < 1000) {
        result.confidence += 0.7;
        result.patterns.push({
          type: PatternType.RATE_ANOMALY,
          confidence: 0.8,
          description: `Highly regular request intervals: ${avgInterval.toFixed(0)}ms avg`,
          sourceIPs: [request.ipAddress],
          requestCount: tracker.timestamps.length,
          timeWindow: tracker.timestamps[tracker.timestamps.length - 1] - tracker.timestamps[0]
        });
        result.severity = SecuritySeverity.HIGH;
      }
    }

    // Analyze HTTP method distribution
    const methodDistribution = this.calculateMethodDistribution(tracker.methods);
    if (methodDistribution.dominantMethodPercentage > 0.95) {
      result.confidence += 0.3;
      result.patterns.push({
        type: PatternType.REQUEST_PATTERN,
        confidence: 0.5,
        description: `Single HTTP method dominance: ${methodDistribution.dominantMethod}`,
        sourceIPs: [request.ipAddress],
        requestCount: tracker.timestamps.length,
        timeWindow: 300000
      });
    }

    return result;
  }

  /**
   * Analyze rate limiting violations
   */
  private async analyzeRateLimit(request: any): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      confidence: 0,
      patterns: [],
      severity: SecuritySeverity.LOW
    };

    const config = this.config.mitigation.rateLimiting;
    const requestsInWindow = this.getRequestsInWindow(
      request.ipAddress,
      config.windowMs
    );

    if (requestsInWindow.length > config.maxRequests) {
      result.confidence += 0.6;
      result.patterns.push({
        type: PatternType.RATE_ANOMALY,
        confidence: 0.8,
        description: `Rate limit exceeded: ${requestsInWindow.length}/${config.maxRequests} in ${config.windowMs}ms`,
        sourceIPs: [request.ipAddress],
        requestCount: requestsInWindow.length,
        timeWindow: config.windowMs
      });
      result.severity = SecuritySeverity.MEDIUM;
    }

    return result;
  }

  /**
   * Track request data
   */
  private trackRequest(request: any): void {
    let tracker = this.requestCounts.get(request.ipAddress);
    
    if (!tracker) {
      tracker = {
        ipAddress: request.ipAddress,
        timestamps: [],
        paths: [],
        methods: [],
        userAgents: [],
        statusCodes: [],
        responseTimes: [],
        totalBytes: 0,
        errorCount: 0,
        firstSeen: request.timestamp,
        lastSeen: request.timestamp
      };
      this.requestCounts.set(request.ipAddress, tracker);
    }

    // Update tracker
    tracker.timestamps.push(request.timestamp.getTime());
    tracker.paths.push(request.path);
    tracker.methods.push(request.method);
    tracker.userAgents.push(request.userAgent);
    tracker.statusCodes.push(request.statusCode);
    tracker.responseTimes.push(request.responseTime);
    tracker.totalBytes += request.size;
    tracker.lastSeen = request.timestamp;

    if (request.statusCode >= 400) {
      tracker.errorCount++;
    }

    // Keep only recent data (last 1 hour)
    const cutoff = request.timestamp.getTime() - 3600000;
    tracker.timestamps = tracker.timestamps.filter(t => t > cutoff);
    
    // Keep arrays synchronized
    const keepCount = tracker.timestamps.length;
    tracker.paths = tracker.paths.slice(-keepCount);
    tracker.methods = tracker.methods.slice(-keepCount);
    tracker.userAgents = tracker.userAgents.slice(-keepCount);
    tracker.statusCodes = tracker.statusCodes.slice(-keepCount);
    tracker.responseTimes = tracker.responseTimes.slice(-keepCount);
  }

  /**
   * Execute mitigation actions
   */
  private async executeMitigation(request: any, result: DDoSAnalysisResult): Promise<void> {
    const actions: string[] = [];

    if (result.shouldBlock) {
      await this.blockIP(request.ipAddress, 3600000); // 1 hour
      actions.push('blocked');
      this.metrics.attacksBlocked++;
    }

    if (result.shouldChallenge) {
      await this.issueChallengeResponse(request.ipAddress);
      actions.push('challenged');
    }

    if (result.shouldRateLimit) {
      await this.applyRateLimit(request.ipAddress);
      actions.push('rate_limited');
    }

    this.emit('ddos:mitigation_executed', {
      ipAddress: request.ipAddress,
      actions,
      confidence: result.confidence,
      patterns: result.patterns.length
    });
  }

  /**
   * Record attack for analysis
   */
  private async recordAttack(request: any, result: DDoSAnalysisResult): Promise<void> {
    const attack: AttackRecord = {
      id: CryptoUtils.generateSecureId(),
      timestamp: request.timestamp,
      sourceIP: request.ipAddress,
      confidence: result.confidence,
      patterns: result.patterns,
      severity: result.severity,
      mitigated: result.shouldBlock || result.shouldChallenge || result.shouldRateLimit,
      duration: 0, // Will be updated when attack ends
      status: 'active'
    };

    this.attackPatterns.set(attack.id, {
      id: attack.id,
      sourceIP: attack.sourceIP,
      startTime: attack.timestamp,
      endTime: null,
      patterns: attack.patterns,
      mitigated: attack.mitigated
    });

    this.metrics.attacksDetected++;

    // Create security event
    const securityEvent: SecurityEvent = {
      id: CryptoUtils.generateSecureId(),
      timestamp: new Date(),
      type: SecurityEventType.DDOS_ATTACK,
      severity: result.severity,
      source: 'ddos_detector',
      details: {
        attackId: attack.id,
        confidence: result.confidence,
        patterns: result.patterns,
        requestsPerSecond: this.calculateCurrentRate(request.ipAddress),
        mitigationActions: [
          result.shouldBlock ? 'block' : null,
          result.shouldChallenge ? 'challenge' : null,
          result.shouldRateLimit ? 'rate_limit' : null
        ].filter(Boolean)
      },
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      location: request.location
    };

    this.emit('ddos:attack_detected', attack);
    this.emit('security_event', securityEvent);
  }

  /**
   * Start continuous analysis
   */
  private startContinuousAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.performContinuousAnalysis();
    }, 10000); // Every 10 seconds
  }

  /**
   * Start cleanup tasks
   */
  private startCleanupTasks(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform continuous analysis
   */
  private performContinuousAnalysis(): void {
    this.metrics.lastAnalysis = new Date();
    
    // Update attack patterns
    for (const [id, pattern] of this.attackPatterns) {
      if (pattern.endTime === null) {
        // Check if attack is still active
        const recentActivity = this.hasRecentActivity(pattern.sourceIP, 60000); // 1 minute
        if (!recentActivity) {
          pattern.endTime = new Date();
          this.emit('ddos:attack_ended', { attackId: id, duration: pattern.endTime.getTime() - pattern.startTime.getTime() });
        }
      }
    }

    // Emit current metrics
    this.emit('ddos:metrics', this.getCurrentMetrics());
  }

  /**
   * Perform cleanup tasks
   */
  private performCleanup(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago

    // Clean old request trackers
    for (const [ip, tracker] of this.requestCounts) {
      tracker.timestamps = tracker.timestamps.filter(t => t > cutoff);
      if (tracker.timestamps.length === 0) {
        this.requestCounts.delete(ip);
      }
    }

    // Clean old attack patterns
    for (const [id, pattern] of this.attackPatterns) {
      if (pattern.endTime && pattern.endTime.getTime() < cutoff) {
        this.attackPatterns.delete(id);
      }
    }

    // Clean challenge responses
    for (const [ip, challenge] of this.challengeResponses) {
      if (challenge.timestamp.getTime() < cutoff) {
        this.challengeResponses.delete(ip);
      }
    }
  }

  // Helper methods
  private isWhitelisted(ipAddress: string): boolean {
    return this.config.whitelists.includes(ipAddress) || 
           IPUtils.isPrivateIP(ipAddress);
  }

  private shouldBlockIP(request: any, result: DDoSAnalysisResult): boolean {
    return this.config.mitigation.autoBlock && 
           result.confidence >= 0.8 && 
           result.severity === SecuritySeverity.HIGH;
  }

  private shouldChallengeIP(request: any, result: DDoSAnalysisResult): boolean {
    return this.config.mitigation.challengeResponse && 
           result.confidence >= 0.6 && 
           !this.challengeResponses.has(request.ipAddress);
  }

  private shouldRateLimit(request: any, result: DDoSAnalysisResult): boolean {
    return result.confidence >= 0.5;
  }

  private calculateOverallConfidence(analyses: AnalysisResult[]): number {
    const weights = [0.3, 0.25, 0.2, 0.15, 0.1]; // Volume, Pattern, Geo, Behavior, RateLimit
    let weightedSum = 0;
    let totalWeight = 0;

    analyses.forEach((analysis, index) => {
      if (index < weights.length) {
        weightedSum += analysis.confidence * weights[index];
        totalWeight += weights[index];
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateOverallSeverity(analyses: AnalysisResult[]): SecuritySeverity {
    const maxSeverity = analyses.reduce((max, analysis) => {
      const severityValues = {
        [SecuritySeverity.LOW]: 1,
        [SecuritySeverity.MEDIUM]: 2,
        [SecuritySeverity.HIGH]: 3,
        [SecuritySeverity.CRITICAL]: 4
      };
      
      return severityValues[analysis.severity] > severityValues[max] ? analysis.severity : max;
    }, SecuritySeverity.LOW);

    return maxSeverity;
  }

  private updateAverageResponseTime(responseTime: number): number {
    const alpha = 0.1; // Exponential moving average factor
    return this.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  private getSuspiciousPatterns(): SuspiciousPattern[] {
    const patterns: SuspiciousPattern[] = [];
    
    for (const analysis of this.attackPatterns.values()) {
      patterns.push(...analysis.patterns);
    }

    return patterns;
  }

  private generateMitigationRecommendations(result: DDoSAnalysisResult, request: any): string[] {
    const recommendations: string[] = [];

    if (result.confidence >= 0.8) {
      recommendations.push('Immediately block source IP');
    } else if (result.confidence >= 0.6) {
      recommendations.push('Apply challenge-response mechanism');
    }

    if (result.patterns.some(p => p.type === PatternType.GEOGRAPHICAL_ANOMALY)) {
      recommendations.push('Consider geographical blocking');
    }

    if (result.patterns.some(p => p.type === PatternType.VOLUME_SPIKE)) {
      recommendations.push('Implement aggressive rate limiting');
    }

    return recommendations;
  }

  // Additional helper methods
  private calculatePathVariance(paths: string[]): number {
    const uniquePaths = new Set(paths);
    return uniquePaths.size / Math.max(paths.length, 1);
  }

  private getCountryRequestCount(country: string): number {
    // Simplified - in production would track by country
    return 0;
  }

  private calculateMethodDistribution(methods: string[]): { dominantMethod: string; dominantMethodPercentage: number } {
    const counts = new Map<string, number>();
    methods.forEach(method => counts.set(method, (counts.get(method) || 0) + 1));
    
    let dominantMethod = '';
    let maxCount = 0;
    
    for (const [method, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominantMethod = method;
      }
    }

    return {
      dominantMethod,
      dominantMethodPercentage: methods.length > 0 ? maxCount / methods.length : 0
    };
  }

  private getRequestsInWindow(ipAddress: string, windowMs: number): number[] {
    const tracker = this.requestCounts.get(ipAddress);
    if (!tracker) return [];
    
    const cutoff = Date.now() - windowMs;
    return tracker.timestamps.filter(t => t > cutoff);
  }

  private calculateCurrentRate(ipAddress: string): number {
    const requests = this.getRequestsInWindow(ipAddress, 60000);
    return requests.length / 60; // requests per second
  }

  private hasRecentActivity(ipAddress: string, windowMs: number): boolean {
    const requests = this.getRequestsInWindow(ipAddress, windowMs);
    return requests.length > 0;
  }

  private async issueChallengeResponse(ipAddress: string): Promise<void> {
    this.challengeResponses.set(ipAddress, {
      timestamp: new Date(),
      challenges: 0,
      responses: 0
    });
  }

  private async applyRateLimit(ipAddress: string): Promise<void> {
    // Rate limiting would be implemented here
  }
}

// Supporting interfaces and types
interface RequestTracker {
  ipAddress: string;
  timestamps: number[];
  paths: string[];
  methods: string[];
  userAgents: string[];
  statusCodes: number[];
  responseTimes: number[];
  totalBytes: number;
  errorCount: number;
  firstSeen: Date;
  lastSeen: Date;
}

interface AttackPattern {
  id: string;
  sourceIP: string;
  startTime: Date;
  endTime: Date | null;
  patterns: SuspiciousPattern[];
  mitigated: boolean;
}

interface AttackRecord {
  id: string;
  timestamp: Date;
  sourceIP: string;
  confidence: number;
  patterns: SuspiciousPattern[];
  severity: SecuritySeverity;
  mitigated: boolean;
  duration: number;
  status: 'active' | 'ended' | 'mitigated';
}

interface ChallengeTracker {
  timestamp: Date;
  challenges: number;
  responses: number;
}

interface DDoSAnalysisResult {
  isAttack: boolean;
  confidence: number;
  patterns: SuspiciousPattern[];
  severity: SecuritySeverity;
  recommendations: string[];
  shouldBlock: boolean;
  shouldChallenge: boolean;
  shouldRateLimit: boolean;
}

interface AnalysisResult {
  confidence: number;
  patterns: SuspiciousPattern[];
  severity: SecuritySeverity;
}

interface DDoSDetectionMetrics {
  totalRequests: number;
  blockedRequests: number;
  attacksDetected: number;
  attacksBlocked: number;
  averageResponseTime: number;
  lastAnalysis: Date;
}