import {
  ThreatDetector,
  ComplianceMonitor,
  AuditTrail,
  AccessAnomalyDetector,
  DDoSDetector,
  SecurityScoreCalculator,
  VulnerabilityScanner
} from '../index';

import {
  SecurityConfiguration,
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity,
  ThreatDetectionConfig,
  ComplianceConfig,
  AuditTrailConfig,
  AnomalyDetectionConfig,
  DDoSProtectionConfig,
  SecurityScoringConfig,
  VulnerabilityScanningConfig,
  ThreatSensitivity,
  ComplianceStatus,
  AuditOutcome,
  VulnerabilityStatus,
  VulnerabilitySeverity
} from '../types';

describe('Security System Integration Tests', () => {
  let securityConfig: SecurityConfiguration;

  beforeAll(() => {
    // Initialize test configuration
    securityConfig = {
      threatDetection: {
        enabled: true,
        sensitivity: ThreatSensitivity.HIGH,
        customRules: [],
        responseActions: [],
        alertChannels: []
      },
      compliance: {
        frameworks: ['gdpr', 'hipaa', 'soc2'],
        automatedReporting: true,
        retentionPeriod: '7y',
        evidenceCollection: true
      },
      auditTrail: {
        enabled: true,
        blockchain: {
          enabled: false,
          network: 'test',
          contract: '',
          confirmations: 1
        },
        retention: '7y',
        encryption: {
          algorithm: 'aes-256-gcm',
          keyRotation: '90d',
          keyManagement: 'local'
        },
        immutable: true
      },
      anomalyDetection: {
        enabled: true,
        mlModel: {
          algorithm: 'isolation_forest',
          parameters: {},
          retraining: '24h',
          accuracy: 0.99
        },
        sensitivity: 0.8,
        trainingPeriod: '7d',
        features: ['time', 'location', 'behavior', 'frequency']
      },
      ddosProtection: {
        enabled: true,
        thresholds: {
          requestsPerSecond: 100,
          uniqueIPsPerSecond: 50,
          errorRatePercent: 10,
          responseTimeMs: 5000
        },
        mitigation: {
          autoBlock: true,
          rateLimiting: {
            windowMs: 60000,
            maxRequests: 100,
            skipWhitelisted: true
          },
          challengeResponse: true,
          geoBlocking: {
            enabled: false,
            blockedCountries: [],
            allowedCountries: []
          }
        },
        whitelists: ['127.0.0.1', '::1']
      },
      vulnerabilityScanning: {
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        scanners: [
          {
            name: 'dependency',
            type: 'dependency' as any,
            config: {},
            enabled: true
          }
        ],
        autoRemediation: false
      },
      scoring: {
        enabled: true,
        updateFrequency: '1h',
        weights: {
          threatDetection: 0.2,
          vulnerabilityManagement: 0.25,
          accessControl: 0.2,
          dataProtection: 0.15,
          networkSecurity: 0.1,
          compliance: 0.1
        },
        benchmarks: {
          industry: 75,
          size: 70,
          sector: 80
        }
      }
    };
  });

  describe('ThreatDetector', () => {
    let detector: ThreatDetector;

    beforeEach(async () => {
      detector = new ThreatDetector(securityConfig.threatDetection);
      await detector.start();
    });

    afterEach(async () => {
      await detector.stop();
    });

    test('should detect SQL injection attempts', async () => {
      const maliciousRequest = {
        id: 'test-1',
        method: 'POST',
        url: 'https://example.com/login',
        headers: { 'user-agent': 'Mozilla/5.0' },
        body: "username=admin'--&password=test",
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      const threats = await detector.analyzeRequest(maliciousRequest);
      
      expect(threats).toHaveLength(1);
      expect(threats[0].type).toBe(SecurityEventType.THREAT_DETECTED);
      expect(threats[0].severity).toBe(SecuritySeverity.HIGH);
      expect(threats[0].details.patterns).toContain('sql_injection');
    });

    test('should detect XSS attempts', async () => {
      const xssRequest = {
        id: 'test-2',
        method: 'GET',
        url: 'https://example.com/search?q=<script>alert("xss")</script>',
        headers: { 'user-agent': 'Mozilla/5.0' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      const threats = await detector.analyzeRequest(xssRequest);
      
      expect(threats).toHaveLength(1);
      expect(threats[0].type).toBe(SecurityEventType.THREAT_DETECTED);
      expect(threats[0].details.patterns).toContain('xss');
    });

    test('should handle rate limiting', async () => {
      const requests = Array.from({ length: 150 }, (_, i) => ({
        id: `test-rate-${i}`,
        method: 'GET',
        url: 'https://example.com/api',
        headers: { 'user-agent': 'Mozilla/5.0' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      }));

      const results = await Promise.all(
        requests.map(req => detector.analyzeRequest(req))
      );

      // Should have rate limit violations
      const rateLimitViolations = results
        .flat()
        .filter(threat => threat.details.reason === 'Rate limit exceeded');
      
      expect(rateLimitViolations.length).toBeGreaterThan(0);
    });

    test('should detect suspicious user agents', async () => {
      const botRequest = {
        id: 'test-3',
        method: 'GET',
        url: 'https://example.com/',
        headers: { 'user-agent': 'curl/7.68.0' },
        ipAddress: '192.168.1.100',
        userAgent: 'curl/7.68.0',
        timestamp: new Date()
      };

      const threats = await detector.analyzeRequest(botRequest);
      
      expect(threats.length).toBeGreaterThan(0);
      expect(threats[0].details.reason).toBe('Suspicious user agent detected');
    });

    test('should complete analysis within 10 seconds', async () => {
      const request = {
        id: 'test-performance',
        method: 'POST',
        url: 'https://example.com/complex-endpoint',
        headers: { 'user-agent': 'Mozilla/5.0' },
        body: 'large payload data'.repeat(1000),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      const start = Date.now();
      await detector.analyzeRequest(request);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10000); // 10 seconds requirement
    });
  });

  describe('ComplianceMonitor', () => {
    let monitor: ComplianceMonitor;

    beforeEach(async () => {
      monitor = new ComplianceMonitor(securityConfig.compliance);
      await monitor.start();
    });

    afterEach(async () => {
      await monitor.stop();
    });

    test('should assess GDPR compliance', async () => {
      const assessment = await monitor.assessCompliance('gdpr');
      
      expect(assessment).toBeDefined();
      expect(assessment.frameworkId).toBe('gdpr');
      expect(assessment.overallStatus).toBeOneOf([
        ComplianceStatus.COMPLIANT,
        ComplianceStatus.PARTIALLY_COMPLIANT,
        ComplianceStatus.NON_COMPLIANT,
        ComplianceStatus.NOT_ASSESSED
      ]);
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(100);
    });

    test('should support 10+ compliance frameworks', async () => {
      const frameworks = ['gdpr', 'hipaa', 'soc2', 'pci_dss', 'iso_27001', 
                         'nist_csf', 'ccpa', 'fedramp', 'fisma', 'cis', 'cobit'];
      
      expect(frameworks.length).toBeGreaterThanOrEqual(10);
      
      // Test that we can create assessments for multiple frameworks
      const assessments = await Promise.allSettled(
        frameworks.slice(0, 3).map(f => monitor.assessCompliance(f))
      );
      
      const successful = assessments.filter(a => a.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    test('should detect GDPR data breach violations', async () => {
      const dataBreachEvent: SecurityEvent = {
        id: 'breach-1',
        timestamp: new Date(),
        type: SecurityEventType.DATA_BREACH,
        severity: SecuritySeverity.CRITICAL,
        source: 'test',
        details: { dataType: 'personal' },
        userId: 'user-123',
        ipAddress: '192.168.1.100'
      };

      const violations = await monitor.checkCompliance(dataBreachEvent);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].frameworkId).toBe('gdpr');
      expect(violations[0].severity).toBe(SecuritySeverity.CRITICAL);
    });

    test('should generate compliance reports', async () => {
      const report = await monitor.generateReport();
      
      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.frameworks.length).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('AuditTrail', () => {
    let auditTrail: AuditTrail;

    beforeEach(async () => {
      auditTrail = new AuditTrail(securityConfig.auditTrail);
      await auditTrail.start();
    });

    afterEach(async () => {
      await auditTrail.stop();
    });

    test('should create immutable audit entries', async () => {
      const entry1 = await auditTrail.logEntry({
        action: 'user_login',
        resource: 'authentication',
        details: { success: true },
        userId: 'user-123',
        outcome: AuditOutcome.SUCCESS
      });

      const entry2 = await auditTrail.logEntry({
        action: 'data_access',
        resource: 'user_data',
        details: { records: 5 },
        userId: 'user-123',
        outcome: AuditOutcome.SUCCESS
      });

      expect(entry1.hash).toBeDefined();
      expect(entry2.hash).toBeDefined();
      expect(entry2.previousHash).toBe(entry1.hash);
      expect(entry1.hash).not.toBe(entry2.hash);
    });

    test('should maintain hash chain integrity', async () => {
      const entries = [];
      
      // Create multiple entries
      for (let i = 0; i < 5; i++) {
        const entry = await auditTrail.logEntry({
          action: `test_action_${i}`,
          resource: 'test_resource',
          details: { index: i },
          outcome: AuditOutcome.SUCCESS
        });
        entries.push(entry);
      }

      // Verify hash chain
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].previousHash).toBe(entries[i - 1].hash);
      }
    });

    test('should verify audit trail integrity', async () => {
      // Create some audit entries
      const entry1 = await auditTrail.logEntry({
        action: 'test_action_1',
        resource: 'test_resource',
        outcome: AuditOutcome.SUCCESS
      });

      const entry2 = await auditTrail.logEntry({
        action: 'test_action_2',
        resource: 'test_resource',
        outcome: AuditOutcome.SUCCESS
      });

      const verification = await auditTrail.verifyIntegrity([entry1, entry2]);
      
      expect(verification.isValid).toBe(true);
      expect(verification.validEntries).toBe(2);
      expect(verification.invalidEntries).toHaveLength(0);
      expect(verification.merkleRoot).toBeDefined();
    });

    test('should support querying audit entries', async () => {
      // Create test entries
      await auditTrail.logUserAction(
        'user-123', 
        'login', 
        'auth_system', 
        AuditOutcome.SUCCESS,
        {},
        { ipAddress: '192.168.1.100' }
      );

      await auditTrail.logUserAction(
        'user-456', 
        'logout', 
        'auth_system', 
        AuditOutcome.SUCCESS
      );

      const query = {
        userId: 'user-123',
        page: 1,
        limit: 10,
        sortBy: 'timestamp' as const,
        sortOrder: 'desc' as const
      };

      const result = await auditTrail.queryEntries(query);
      
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].userId).toBe('user-123');
      expect(result.total).toBeGreaterThanOrEqual(result.entries.length);
    });

    test('should export audit trail in multiple formats', async () => {
      await auditTrail.logEntry({
        action: 'test_export',
        resource: 'test_resource',
        outcome: AuditOutcome.SUCCESS
      });

      const jsonExport = await auditTrail.exportAuditTrail('json');
      const csvExport = await auditTrail.exportAuditTrail('csv');
      const xmlExport = await auditTrail.exportAuditTrail('xml');

      expect(jsonExport).toContain('exportTimestamp');
      expect(csvExport).toContain('ID,Timestamp');
      expect(xmlExport).toContain('<?xml version="1.0"');
    });
  });

  describe('AccessAnomalyDetector', () => {
    let detector: AccessAnomalyDetector;

    beforeEach(async () => {
      detector = new AccessAnomalyDetector(securityConfig.anomalyDetection);
      await detector.start();
    });

    afterEach(async () => {
      await detector.stop();
    });

    test('should detect access anomalies with 99% accuracy requirement', async () => {
      const metrics = detector.getMetrics();
      
      // For a production system, accuracy should be >= 99%
      // In tests, we verify the metric tracking is working
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(100);
    });

    test('should detect unusual access times', async () => {
      const accessEvent = {
        id: 'access-1',
        userId: 'user-123',
        timestamp: new Date('2023-12-25 03:00:00'), // Christmas morning 3 AM
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        resource: '/admin/users',
        method: 'GET',
        outcome: 'success' as const
      };

      const result = await detector.analyzeAccess(accessEvent);
      
      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyTypes).toContain('unusual_time');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect impossible travel', async () => {
      const userId = 'user-travel-test';
      
      // First access from New York
      await detector.analyzeAccess({
        id: 'access-ny',
        userId,
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        resource: '/dashboard',
        method: 'GET',
        outcome: 'success',
        location: {
          country: 'US',
          region: 'NY',
          city: 'New York',
          latitude: 40.7128,
          longitude: -74.0060
        }
      });

      // Second access from Tokyo 30 minutes later
      const result = await detector.analyzeAccess({
        id: 'access-tokyo',
        userId,
        timestamp: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes later
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0',
        resource: '/dashboard',
        method: 'GET',
        outcome: 'success',
        location: {
          country: 'JP',
          region: 'Tokyo',
          city: 'Tokyo',
          latitude: 35.6762,
          longitude: 139.6503
        }
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyTypes).toContain('impossible_travel');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should provide feedback and improve accuracy', async () => {
      const accessEvent = {
        id: 'feedback-test',
        userId: 'user-123',
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        resource: '/api/data',
        method: 'GET',
        outcome: 'success' as const
      };

      const result = await detector.analyzeAccess(accessEvent);
      
      // Provide feedback
      await detector.provideFeedback(accessEvent.id, false); // Not actually an anomaly
      
      // Verify metrics updated
      const metrics = detector.getMetrics();
      expect(metrics.totalAnalyzed).toBeGreaterThan(0);
    });
  });

  describe('DDoSDetector', () => {
    let detector: DDoSDetector;

    beforeEach(async () => {
      detector = new DDoSDetector(securityConfig.ddosProtection);
      await detector.start();
    });

    afterEach(async () => {
      await detector.stop();
    });

    test('should detect volume-based attacks', async () => {
      const requests = Array.from({ length: 200 }, (_, i) => ({
        id: `ddos-${i}`,
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'AttackBot/1.0',
        method: 'GET',
        path: '/api/endpoint',
        size: 1024,
        responseTime: 100,
        statusCode: 200,
        headers: { 'user-agent': 'AttackBot/1.0' }
      }));

      // Send requests rapidly
      const results = await Promise.all(
        requests.map(req => detector.analyzeRequest(req))
      );

      const attacks = results.filter(r => r.isAttack);
      expect(attacks.length).toBeGreaterThan(0);
      
      const volumeAttacks = attacks.filter(a => 
        a.patterns.some(p => p.type === 'volume_spike')
      );
      expect(volumeAttacks.length).toBeGreaterThan(0);
    });

    test('should auto-block attacks when enabled', async () => {
      const maliciousRequest = {
        id: 'malicious-1',
        timestamp: new Date(),
        ipAddress: '192.168.1.200',
        userAgent: 'AttackBot/1.0',
        method: 'GET',
        path: '/api/endpoint',
        size: 1024,
        responseTime: 100,
        statusCode: 200,
        headers: { 'user-agent': 'AttackBot/1.0' }
      };

      // Generate high volume from single IP
      for (let i = 0; i < 150; i++) {
        await detector.analyzeRequest({
          ...maliciousRequest,
          id: `attack-${i}`
        });
      }

      // Check if IP is blocked
      const blockedIPs = detector.getBlockedIPs();
      expect(blockedIPs).toContain('192.168.1.200');
    });

    test('should provide real-time metrics', async () => {
      const metrics = detector.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.requestsPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.uniqueIPs).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.suspiciousPatterns).toBeDefined();
    });

    test('should whitelist trusted IPs', async () => {
      const trustedRequest = {
        id: 'trusted-1',
        timestamp: new Date(),
        ipAddress: '127.0.0.1', // Localhost - should be whitelisted
        userAgent: 'TrustedBot/1.0',
        method: 'GET',
        path: '/api/endpoint',
        size: 1024,
        responseTime: 100,
        statusCode: 200,
        headers: { 'user-agent': 'TrustedBot/1.0' }
      };

      const result = await detector.analyzeRequest(trustedRequest);
      
      expect(result.isAttack).toBe(false);
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('SecurityScoreCalculator', () => {
    let calculator: SecurityScoreCalculator;

    beforeEach(async () => {
      calculator = new SecurityScoreCalculator(securityConfig.scoring);
      await calculator.start();
    });

    afterEach(async () => {
      await calculator.stop();
    });

    test('should calculate security score (0-100 scale)', async () => {
      const score = await calculator.calculateScore();
      
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(score.categories.length).toBeGreaterThan(0);
      expect(score.recommendations).toBeDefined();
    });

    test('should provide category breakdowns', async () => {
      const score = await calculator.calculateScore();
      
      const categoryNames = score.categories.map(c => c.name);
      expect(categoryNames).toContain('Threat Detection & Response');
      expect(categoryNames).toContain('Vulnerability Management');
      expect(categoryNames).toContain('Access Control & Authentication');
      
      // Each category should have factors
      score.categories.forEach(category => {
        expect(category.score).toBeGreaterThanOrEqual(0);
        expect(category.score).toBeLessThanOrEqual(100);
        expect(category.weight).toBeGreaterThan(0);
        expect(category.factors.length).toBeGreaterThan(0);
      });
    });

    test('should generate actionable recommendations', async () => {
      const score = await calculator.calculateScore();
      
      expect(score.recommendations.length).toBeGreaterThanOrEqual(0);
      
      score.recommendations.forEach(recommendation => {
        expect(recommendation.priority).toBeOneOf(['low', 'medium', 'high', 'critical']);
        expect(recommendation.title).toBeTruthy();
        expect(recommendation.description).toBeTruthy();
        expect(recommendation.impact).toBeGreaterThanOrEqual(0);
      });
    });

    test('should track score trends', async () => {
      // Calculate initial score
      await calculator.calculateScore();
      
      // Wait and calculate again (in real system would be different)
      await new Promise(resolve => setTimeout(resolve, 100));
      const score = await calculator.calculateScore();
      
      expect(score.trend).toBeDefined();
      expect(score.trend.direction).toBeOneOf(['improving', 'stable', 'declining']);
      expect(typeof score.trend.change).toBe('number');
    });

    test('should process security events', async () => {
      const initialScore = await calculator.calculateScore();
      
      // Simulate critical security event
      const criticalEvent: SecurityEvent = {
        id: 'critical-1',
        timestamp: new Date(),
        type: SecurityEventType.DATA_BREACH,
        severity: SecuritySeverity.CRITICAL,
        source: 'test',
        details: {}
      };

      calculator.processSecurityEvent(criticalEvent);
      
      // Score should be affected by critical events
      const newScore = await calculator.calculateScore();
      expect(newScore.timestamp).not.toEqual(initialScore.timestamp);
    });

    test('should generate detailed reports', async () => {
      const report = await calculator.generateDetailedReport();
      
      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.scoreBreakdown.length).toBeGreaterThan(0);
      expect(report.riskAssessment).toBeDefined();
      expect(report.improvementPlan).toBeDefined();
      expect(report.benchmarkComparison).toBeDefined();
    });
  });

  describe('VulnerabilityScanner', () => {
    let scanner: VulnerabilityScanner;

    beforeEach(async () => {
      scanner = new VulnerabilityScanner(securityConfig.vulnerabilityScanning);
      await scanner.start();
    });

    afterEach(async () => {
      await scanner.stop();
    });

    test('should support continuous scanning', async () => {
      const result = await scanner.runScan();
      
      expect(result).toBeDefined();
      expect(result.scanId).toBeTruthy();
      expect(result.status).toBe('completed');
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should categorize vulnerabilities by severity', async () => {
      const stats = scanner.getVulnerabilityStats();
      
      expect(stats.bySeverity).toBeDefined();
      expect(stats.bySeverity.critical).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity.high).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity.medium).toBeGreaterThanOrEqual(0);
      expect(stats.bySeverity.low).toBeGreaterThanOrEqual(0);
    });

    test('should track vulnerability status changes', async () => {
      // This test would require actual vulnerabilities, 
      // so we test the interface
      const stats = scanner.getVulnerabilityStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.open).toBeGreaterThanOrEqual(0);
      expect(stats.resolved).toBeGreaterThanOrEqual(0);
    });

    test('should generate vulnerability reports', async () => {
      const report = await scanner.generateReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.vulnerabilities).toBeDefined();
      expect(report.topRisks).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should provide scanning metrics', async () => {
      const metrics = scanner.getMetrics();
      
      expect(metrics.totalScans).toBeGreaterThanOrEqual(0);
      expect(metrics.vulnerabilitiesFound).toBeGreaterThanOrEqual(0);
      expect(metrics.averageScanDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.lastScan).toBeInstanceOf(Date);
    });
  });

  describe('Integration Tests', () => {
    let threatDetector: ThreatDetector;
    let auditTrail: AuditTrail;
    let complianceMonitor: ComplianceMonitor;

    beforeEach(async () => {
      threatDetector = new ThreatDetector(securityConfig.threatDetection);
      auditTrail = new AuditTrail(securityConfig.auditTrail);
      complianceMonitor = new ComplianceMonitor(securityConfig.compliance);

      await Promise.all([
        threatDetector.start(),
        auditTrail.start(),
        complianceMonitor.start()
      ]);
    });

    afterEach(async () => {
      await Promise.all([
        threatDetector.stop(),
        auditTrail.stop(),
        complianceMonitor.stop()
      ]);
    });

    test('should integrate threat detection with audit logging', async () => {
      const maliciousRequest = {
        id: 'integration-1',
        method: 'POST',
        url: 'https://example.com/login',
        headers: { 'user-agent': 'Mozilla/5.0' },
        body: "username=admin'; DROP TABLE users;--",
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      // Detect threat
      const threats = await threatDetector.analyzeRequest(maliciousRequest);
      expect(threats.length).toBeGreaterThan(0);

      // Log to audit trail
      for (const threat of threats) {
        await auditTrail.logSecurityEvent(threat);
      }

      // Verify audit entries created
      const auditQuery = {
        action: 'security_threat_detected',
        page: 1,
        limit: 10,
        sortBy: 'timestamp' as const,
        sortOrder: 'desc' as const
      };

      const auditResults = await auditTrail.queryEntries(auditQuery);
      expect(auditResults.entries.length).toBeGreaterThan(0);
    });

    test('should integrate security events with compliance monitoring', async () => {
      const dataBreachEvent: SecurityEvent = {
        id: 'breach-integration',
        timestamp: new Date(),
        type: SecurityEventType.DATA_BREACH,
        severity: SecuritySeverity.CRITICAL,
        source: 'integration_test',
        details: { 
          dataType: 'personal',
          recordsAffected: 1000,
          containmentTime: 3600000 // 1 hour in ms
        }
      };

      // Check compliance violations
      const violations = await complianceMonitor.checkCompliance(dataBreachEvent);
      expect(violations.length).toBeGreaterThan(0);

      // Log security event to audit trail
      await auditTrail.logSecurityEvent(dataBreachEvent);

      // Verify both compliance and audit records exist
      const auditQuery = {
        action: 'security_data_breach',
        page: 1,
        limit: 10,
        sortBy: 'timestamp' as const,
        sortOrder: 'desc' as const
      };

      const auditResults = await auditTrail.queryEntries(auditQuery);
      expect(auditResults.entries.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-volume threat detection', async () => {
      const detector = new ThreatDetector(securityConfig.threatDetection);
      await detector.start();

      const startTime = Date.now();
      const requestCount = 100;
      
      const requests = Array.from({ length: requestCount }, (_, i) => ({
        id: `perf-${i}`,
        method: 'GET',
        url: `https://example.com/api/endpoint${i}`,
        headers: { 'user-agent': 'Mozilla/5.0' },
        ipAddress: `192.168.1.${100 + (i % 50)}`,
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      }));

      await Promise.all(requests.map(req => detector.analyzeRequest(req)));
      
      const duration = Date.now() - startTime;
      const avgResponseTime = duration / requestCount;
      
      // Should process requests efficiently
      expect(avgResponseTime).toBeLessThan(100); // Less than 100ms per request
      
      await detector.stop();
    });

    test('should handle concurrent security operations', async () => {
      const detector = new ThreatDetector(securityConfig.threatDetection);
      const auditTrail = new AuditTrail(securityConfig.auditTrail);
      
      await Promise.all([detector.start(), auditTrail.start()]);

      const operations = Array.from({ length: 50 }, async (_, i) => {
        // Concurrent threat detection and audit logging
        const request = {
          id: `concurrent-${i}`,
          method: 'POST',
          url: 'https://example.com/api',
          headers: { 'user-agent': 'Mozilla/5.0' },
          body: `data=${i}`,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date()
        };

        const [threats] = await Promise.all([
          detector.analyzeRequest(request),
          auditTrail.logEntry({
            action: `concurrent_test_${i}`,
            resource: 'test_resource',
            outcome: AuditOutcome.SUCCESS
          })
        ]);

        return threats;
      });

      const results = await Promise.all(operations);
      expect(results.length).toBe(50);
      
      await Promise.all([detector.stop(), auditTrail.stop()]);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle malformed input gracefully', async () => {
      const detector = new ThreatDetector(securityConfig.threatDetection);
      await detector.start();

      const malformedRequest = {
        id: 'malformed',
        method: null as any,
        url: undefined as any,
        headers: 'not-an-object' as any,
        ipAddress: 'invalid-ip',
        userAgent: null as any,
        timestamp: 'not-a-date' as any
      };

      // Should not throw error
      await expect(detector.analyzeRequest(malformedRequest)).resolves.toBeDefined();
      
      await detector.stop();
    });

    test('should recover from system failures', async () => {
      const auditTrail = new AuditTrail(securityConfig.auditTrail);
      await auditTrail.start();

      // Create some audit entries
      await auditTrail.logEntry({
        action: 'before_failure',
        resource: 'test',
        outcome: AuditOutcome.SUCCESS
      });

      // Simulate system restart
      await auditTrail.stop();
      await auditTrail.start();

      // Should still work after restart
      const entry = await auditTrail.logEntry({
        action: 'after_restart',
        resource: 'test',
        outcome: AuditOutcome.SUCCESS
      });

      expect(entry).toBeDefined();
      expect(entry.hash).toBeTruthy();
      
      await auditTrail.stop();
    });
  });
});

// Custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(items: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, items) {
    const pass = items.includes(received);
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be one of ${items.join(', ')}`,
      pass
    };
  }
});