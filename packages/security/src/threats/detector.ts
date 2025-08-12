import { EventEmitter } from 'events';
import { 
  SecurityEvent, 
  SecurityEventType, 
  SecuritySeverity, 
  ThreatSignature, 
  ThreatType,
  ThreatDetectionConfig,
  ResponseAction,
  ActionType,
  AlertChannel,
  GeoLocation,
  ThreatDetectedHandler
} from '../types';
import { 
  CryptoUtils, 
  IPUtils, 
  PatternUtils, 
  TimeUtils, 
  GeoUtils,
  ValidationUtils,
  RateLimitUtils
} from '../utils';

/**
 * Real-time threat detection system
 * Detects security threats within 10 seconds as per requirements
 */
export class ThreatDetector extends EventEmitter {
  private config: ThreatDetectionConfig;
  private signatures: Map<string, ThreatSignature> = new Map();
  private recentRequests: Map<string, number[]> = new Map();
  private isRunning = false;
  private metricsInterval?: NodeJS.Timeout;
  private readonly detectionQueue: SecurityEvent[] = [];
  private processingQueue = false;

  constructor(config: ThreatDetectionConfig) {
    super();
    this.config = config;
    this.loadDefaultSignatures();
    this.loadCustomSignatures();
  }

  /**
   * Start threat detection
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startMetricsCollection();
    this.processDetectionQueue();
    
    this.emit('detector:started');
  }

  /**
   * Stop threat detection
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    
    this.emit('detector:stopped');
  }

  /**
   * Analyze incoming request for threats
   */
  async analyzeRequest(request: {
    id: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    query?: Record<string, string>;
    cookies?: Record<string, string>;
    ipAddress: string;
    userAgent: string;
    userId?: string;
    timestamp: Date;
  }): Promise<SecurityEvent[]> {
    const threats: SecurityEvent[] = [];
    const analysisStart = Date.now();

    try {
      // 1. Rate limiting check
      const rateLimitThreat = this.checkRateLimit(request);
      if (rateLimitThreat) threats.push(rateLimitThreat);

      // 2. IP reputation check
      const ipThreat = this.checkIPReputation(request);
      if (ipThreat) threats.push(ipThreat);

      // 3. Pattern-based detection
      const patternThreats = this.checkPatterns(request);
      threats.push(...patternThreats);

      // 4. Behavioral analysis
      const behavioralThreat = await this.analyzeBehavior(request);
      if (behavioralThreat) threats.push(behavioralThreat);

      // 5. Geolocation analysis
      const geoThreat = await this.analyzeGeolocation(request);
      if (geoThreat) threats.push(geoThreat);

      // 6. User agent analysis
      const uaThreat = this.analyzeUserAgent(request);
      if (uaThreat) threats.push(uaThreat);

      // Process detected threats
      for (const threat of threats) {
        await this.processThreat(threat);
      }

      // Ensure detection completes within 10 seconds
      const analysisTime = Date.now() - analysisStart;
      if (analysisTime > 10000) {
        console.warn(`Threat analysis took ${analysisTime}ms, exceeding 10s requirement`);
      }

    } catch (error) {
      console.error('Error during threat analysis:', error);
      
      // Create error event
      const errorEvent: SecurityEvent = {
        id: CryptoUtils.generateSecureId(),
        timestamp: new Date(),
        type: SecurityEventType.UNUSUAL_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM,
        source: 'threat_detector',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: request.id
        },
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        userId: request.userId
      };
      
      threats.push(errorEvent);
    }

    return threats;
  }

  /**
   * Check for rate limiting violations
   */
  private checkRateLimit(request: any): SecurityEvent | null {
    const key = `${request.ipAddress}:${request.method}:${new URL(request.url).pathname}`;
    const windowMs = 60000; // 1 minute
    const limit = 100; // requests per minute
    
    const { allowed, resetTime } = RateLimitUtils.checkRateLimit(
      key, 
      limit, 
      windowMs, 
      this.recentRequests
    );

    if (!allowed) {
      return {
        id: CryptoUtils.generateSecureId(),
        timestamp: new Date(),
        type: SecurityEventType.MALICIOUS_REQUEST,
        severity: SecuritySeverity.HIGH,
        source: 'rate_limiter',
        details: {
          reason: 'Rate limit exceeded',
          limit,
          window: windowMs,
          resetTime: resetTime.toISOString()
        },
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        userId: request.userId
      };
    }

    return null;
  }

  /**
   * Check IP reputation
   */
  private checkIPReputation(request: any): SecurityEvent | null {
    const ip = request.ipAddress;
    
    // Check if IP is private (usually safe)
    if (IPUtils.isPrivateIP(ip)) {
      return null;
    }

    // Check for suspicious patterns in IP
    const ipClass = IPUtils.getIPClass(ip);
    if (ipClass === 'invalid') {
      return {
        id: CryptoUtils.generateSecureId(),
        timestamp: new Date(),
        type: SecurityEventType.MALICIOUS_REQUEST,
        severity: SecuritySeverity.MEDIUM,
        source: 'ip_analyzer',
        details: {
          reason: 'Invalid IP address format',
          ip
        },
        ipAddress: ip,
        userAgent: request.userAgent
      };
    }

    return null;
  }

  /**
   * Check for attack patterns in request
   */
  private checkPatterns(request: any): SecurityEvent[] {
    const threats: SecurityEvent[] = [];
    const inputs = this.extractInputs(request);

    for (const [location, value] of inputs) {
      const analysis = PatternUtils.checkForAttackPatterns(value);
      
      if (analysis.isMatch) {
        const threat: SecurityEvent = {
          id: CryptoUtils.generateSecureId(),
          timestamp: new Date(),
          type: SecurityEventType.THREAT_DETECTED,
          severity: this.getSeverityFromConfidence(analysis.confidence),
          source: 'pattern_matcher',
          details: {
            location,
            value: ValidationUtils.sanitizeInput(value),
            patterns: analysis.patterns,
            confidence: analysis.confidence,
            entropy: PatternUtils.calculateEntropy(value)
          },
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          userId: request.userId
        };

        threats.push(threat);
      }
    }

    return threats;
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzeBehavior(request: any): Promise<SecurityEvent | null> {
    // Check for suspicious timing patterns
    const hour = request.timestamp.getHours();
    const isOffHours = !TimeUtils.isBusinessHours(request.timestamp);
    const isWeekend = TimeUtils.isWeekend(request.timestamp);
    
    let suspicionScore = 0;
    const reasons: string[] = [];

    if (isOffHours) {
      suspicionScore += 0.2;
      reasons.push('Off-hours access');
    }

    if (isWeekend) {
      suspicionScore += 0.1;
      reasons.push('Weekend access');
    }

    // Check request frequency
    const userKey = request.userId || request.ipAddress;
    const userRequests = this.recentRequests.get(userKey) || [];
    const recentRequests = userRequests.filter(t => Date.now() - t < 300000); // 5 minutes
    
    if (recentRequests.length > 50) {
      suspicionScore += 0.4;
      reasons.push('High request frequency');
    }

    if (suspicionScore >= 0.5) {
      return {
        id: CryptoUtils.generateSecureId(),
        timestamp: new Date(),
        type: SecurityEventType.UNUSUAL_BEHAVIOR,
        severity: this.getSeverityFromScore(suspicionScore),
        source: 'behavior_analyzer',
        details: {
          reasons,
          suspicionScore,
          isOffHours,
          isWeekend,
          recentRequestCount: recentRequests.length
        },
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        userId: request.userId
      };
    }

    return null;
  }

  /**
   * Analyze geolocation patterns
   */
  private async analyzeGeolocation(request: any): Promise<SecurityEvent | null> {
    // This would integrate with a GeoIP service in production
    // For now, we'll do basic validation
    
    const ip = request.ipAddress;
    if (IPUtils.isPrivateIP(ip)) {
      return null; // Skip geo analysis for private IPs
    }

    // Mock geo data - in production this would come from MaxMind or similar
    const mockGeo: GeoLocation = {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194
    };

    // Check for impossible travel (would need previous location data)
    // This is a simplified implementation
    
    return null;
  }

  /**
   * Analyze user agent for suspicious patterns
   */
  private analyzeUserAgent(request: any): SecurityEvent | null {
    const userAgent = request.userAgent || '';
    
    if (PatternUtils.isSuspiciousUserAgent(userAgent)) {
      return {
        id: CryptoUtils.generateSecureId(),
        timestamp: new Date(),
        type: SecurityEventType.MALICIOUS_REQUEST,
        severity: SecuritySeverity.MEDIUM,
        source: 'user_agent_analyzer',
        details: {
          reason: 'Suspicious user agent detected',
          userAgent: ValidationUtils.sanitizeInput(userAgent)
        },
        ipAddress: request.ipAddress,
        userAgent
      };
    }

    return null;
  }

  /**
   * Process detected threat
   */
  private async processThreat(threat: SecurityEvent): Promise<void> {
    // Add to detection queue for async processing
    this.detectionQueue.push(threat);
    
    // Emit threat event
    this.emit('threat', threat);
    
    // Execute response actions
    await this.executeResponseActions(threat);
    
    // Send alerts
    await this.sendAlerts(threat);
  }

  /**
   * Execute automated response actions
   */
  private async executeResponseActions(threat: SecurityEvent): Promise<void> {
    const applicableActions = this.config.responseActions.filter(
      action => action.enabled && action.trigger === threat.type
    );

    for (const action of applicableActions) {
      try {
        await this.executeAction(action, threat);
      } catch (error) {
        console.error(`Failed to execute action ${action.action}:`, error);
      }
    }
  }

  /**
   * Execute individual response action
   */
  private async executeAction(action: ResponseAction, threat: SecurityEvent): Promise<void> {
    switch (action.action) {
      case ActionType.ALERT:
        // Already handled by sendAlerts
        break;
        
      case ActionType.BLOCK_IP:
        await this.blockIP(threat.ipAddress!, action.parameters);
        break;
        
      case ActionType.RATE_LIMIT:
        await this.applyRateLimit(threat, action.parameters);
        break;
        
      case ActionType.QUARANTINE:
        await this.quarantineUser(threat.userId, action.parameters);
        break;
        
      case ActionType.LOG_ENHANCED:
        await this.logEnhanced(threat, action.parameters);
        break;
        
      case ActionType.TRIGGER_WORKFLOW:
        await this.triggerWorkflow(threat, action.parameters);
        break;
    }
  }

  /**
   * Send alerts through configured channels
   */
  private async sendAlerts(threat: SecurityEvent): Promise<void> {
    const applicableChannels = this.config.alertChannels.filter(
      channel => channel.enabled && channel.severity.includes(threat.severity)
    );

    for (const channel of applicableChannels) {
      try {
        await this.sendAlert(channel, threat);
      } catch (error) {
        console.error(`Failed to send alert via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Load default threat signatures
   */
  private loadDefaultSignatures(): void {
    const defaultSignatures: ThreatSignature[] = [
      {
        id: 'sql_injection_basic',
        name: 'SQL Injection - Basic',
        pattern: /('|(\\')|(;)|(\-\-)|(\s+(or|and)\s+))/i,
        type: ThreatType.SQL_INJECTION,
        severity: SecuritySeverity.HIGH,
        description: 'Basic SQL injection patterns',
        mitigation: 'Use parameterized queries',
        enabled: true,
        lastUpdated: new Date()
      },
      {
        id: 'xss_script_tags',
        name: 'XSS - Script Tags',
        pattern: /<script[^>]*>.*?<\/script>/gi,
        type: ThreatType.XSS,
        severity: SecuritySeverity.HIGH,
        description: 'Script tag injection attempts',
        mitigation: 'Sanitize input and use CSP',
        enabled: true,
        lastUpdated: new Date()
      },
      {
        id: 'command_injection',
        name: 'Command Injection',
        pattern: /;|\||&|`|\$\(|\${/,
        type: ThreatType.COMMAND_INJECTION,
        severity: SecuritySeverity.CRITICAL,
        description: 'Command injection attempts',
        mitigation: 'Validate and sanitize input',
        enabled: true,
        lastUpdated: new Date()
      },
      {
        id: 'path_traversal',
        name: 'Path Traversal',
        pattern: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/i,
        type: ThreatType.PATH_TRAVERSAL,
        severity: SecuritySeverity.HIGH,
        description: 'Directory traversal attempts',
        mitigation: 'Validate file paths',
        enabled: true,
        lastUpdated: new Date()
      }
    ];

    for (const signature of defaultSignatures) {
      this.signatures.set(signature.id, signature);
    }
  }

  /**
   * Load custom threat signatures
   */
  private loadCustomSignatures(): void {
    for (const signature of this.config.customRules) {
      this.signatures.set(signature.id, signature);
    }
  }

  /**
   * Extract inputs from request for analysis
   */
  private extractInputs(request: any): Array<[string, string]> {
    const inputs: Array<[string, string]> = [];

    // URL parameters
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) {
        inputs.push([`query.${key}`, String(value)]);
      }
    }

    // Request body
    if (request.body) {
      if (typeof request.body === 'string') {
        inputs.push(['body', request.body]);
      } else if (typeof request.body === 'object') {
        for (const [key, value] of Object.entries(request.body)) {
          inputs.push([`body.${key}`, String(value)]);
        }
      }
    }

    // Headers (selective)
    const suspiciousHeaders = ['referer', 'x-forwarded-for', 'x-real-ip'];
    for (const header of suspiciousHeaders) {
      if (request.headers[header]) {
        inputs.push([`header.${header}`, request.headers[header]]);
      }
    }

    // Cookies
    if (request.cookies) {
      for (const [key, value] of Object.entries(request.cookies)) {
        inputs.push([`cookie.${key}`, String(value)]);
      }
    }

    // URL path
    try {
      const url = new URL(request.url);
      inputs.push(['path', url.pathname]);
    } catch {
      inputs.push(['path', request.url]);
    }

    return inputs;
  }

  /**
   * Get severity from confidence score
   */
  private getSeverityFromConfidence(confidence: number): SecuritySeverity {
    if (confidence >= 0.8) return SecuritySeverity.CRITICAL;
    if (confidence >= 0.6) return SecuritySeverity.HIGH;
    if (confidence >= 0.4) return SecuritySeverity.MEDIUM;
    return SecuritySeverity.LOW;
  }

  /**
   * Get severity from suspicion score
   */
  private getSeverityFromScore(score: number): SecuritySeverity {
    if (score >= 0.8) return SecuritySeverity.HIGH;
    if (score >= 0.6) return SecuritySeverity.MEDIUM;
    return SecuritySeverity.LOW;
  }

  /**
   * Process detection queue asynchronously
   */
  private async processDetectionQueue(): Promise<void> {
    if (this.processingQueue || !this.isRunning) return;
    
    this.processingQueue = true;
    
    while (this.detectionQueue.length > 0 && this.isRunning) {
      const threat = this.detectionQueue.shift();
      if (threat) {
        try {
          // Additional processing if needed
          await this.enhanceThreat(threat);
        } catch (error) {
          console.error('Error processing threat:', error);
        }
      }
    }
    
    this.processingQueue = false;
    
    // Schedule next processing cycle
    if (this.isRunning) {
      setTimeout(() => this.processDetectionQueue(), 1000);
    }
  }

  /**
   * Enhance threat with additional context
   */
  private async enhanceThreat(threat: SecurityEvent): Promise<void> {
    // Add threat signature information
    const matchingSignatures = Array.from(this.signatures.values())
      .filter(sig => {
        if (typeof sig.pattern === 'string') {
          return threat.details.value?.includes(sig.pattern);
        } else {
          return sig.pattern.test(threat.details.value || '');
        }
      });

    if (matchingSignatures.length > 0) {
      threat.details.matchedSignatures = matchingSignatures.map(sig => ({
        id: sig.id,
        name: sig.name,
        type: sig.type,
        severity: sig.severity
      }));
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics', metrics);
    }, 30000); // Every 30 seconds
  }

  /**
   * Get current metrics
   */
  private getMetrics(): Record<string, any> {
    return {
      isRunning: this.isRunning,
      signaturesLoaded: this.signatures.size,
      queueLength: this.detectionQueue.length,
      recentRequestsTracked: this.recentRequests.size,
      timestamp: new Date().toISOString()
    };
  }

  // Placeholder methods for actions (would be implemented based on infrastructure)
  private async blockIP(ip: string, params: any): Promise<void> {
    console.log(`Blocking IP: ${ip}`, params);
  }

  private async applyRateLimit(threat: SecurityEvent, params: any): Promise<void> {
    console.log(`Applying rate limit for threat: ${threat.id}`, params);
  }

  private async quarantineUser(userId?: string, params?: any): Promise<void> {
    console.log(`Quarantining user: ${userId}`, params);
  }

  private async logEnhanced(threat: SecurityEvent, params: any): Promise<void> {
    console.log(`Enhanced logging for threat: ${threat.id}`, params);
  }

  private async triggerWorkflow(threat: SecurityEvent, params: any): Promise<void> {
    console.log(`Triggering workflow for threat: ${threat.id}`, params);
  }

  private async sendAlert(channel: AlertChannel, threat: SecurityEvent): Promise<void> {
    console.log(`Sending alert via ${channel.type} for threat: ${threat.id}`);
  }
}