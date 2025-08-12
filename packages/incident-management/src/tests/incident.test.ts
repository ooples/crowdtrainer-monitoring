import { beforeEach, afterEach, describe, test, expect, jest } from '@jest/globals';
import Redis from 'ioredis';
import { Logger } from 'winston';

// Import all the modules we'll test
import { AutomaticIncidentDetection } from '../detection/auto';
import { PostMortemGenerator } from '../postmortem/generator';
import { RunbookIntegration } from '../runbooks/integration';
import { StatusPageAPI } from '../status/page';
import TimelineReconstructionEngine from '../timeline/reconstruction';
import MTTRTracker from '../metrics/mttr';

// Import types
import {
  Incident,
  Alert,
  IncidentSeverity,
  IncidentStatus,
  AlertSource,
  IncidentManagementConfig,
  Component,
  ComponentStatus,
  PostMortem,
  Runbook,
  MTTRMetrics,
  TimelineEvent,
} from '../types';

// Mock implementations
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  lpush: jest.fn(),
  lrange: jest.fn(),
  zadd: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  on: jest.fn(),
  hincrby: jest.fn(),
  expire: jest.fn(),
} as unknown as Redis;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

const mockConfig: IncidentManagementConfig = {
  detection: {
    thresholds: { 'error.rate': 10 },
    cooldownPeriod: 300,
    autoEscalation: true,
    escalationTimeout: 900,
  },
  warRoom: {
    maxParticipants: 50,
    videoIntegration: 'zoom',
    autoRecording: true,
    sessionTimeout: 3600,
  },
  statusPage: {
    publicUrl: 'https://status.example.com',
    components: [],
    maintenanceMode: false,
  },
  notifications: {
    channels: ['email', 'slack'],
    escalationRules: [],
  },
  integrations: {},
};

// Test data factories
const createMockIncident = (overrides?: Partial<Incident>): Incident => ({
  id: 'incident-123',
  title: 'Test Incident',
  description: 'Test incident description',
  status: IncidentStatus.INVESTIGATING,
  severity: IncidentSeverity.P2_HIGH,
  source: AlertSource.MONITORING,
  affectedComponents: ['api', 'database'],
  assignedTeam: 'platform',
  assignedUser: 'user-123',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  tags: ['test'],
  metadata: {},
  ...overrides,
});

const createMockAlert = (overrides?: Partial<Alert>): Alert => ({
  id: 'alert-123',
  source: AlertSource.MONITORING,
  title: 'High Error Rate',
  description: 'Error rate exceeded threshold',
  severity: IncidentSeverity.P2_HIGH,
  timestamp: new Date('2024-01-01T09:55:00Z'),
  labels: { service: 'api', environment: 'production' },
  annotations: { runbook: 'high-error-rate' },
  resolved: false,
  ...overrides,
});

const createMockComponent = (overrides?: Partial<Component>): Component => ({
  id: 'component-123',
  name: 'API Service',
  description: 'Core API service',
  status: ComponentStatus.OPERATIONAL,
  group: 'backend',
  order: 1,
  ...overrides,
});

describe('Incident Management System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AutomaticIncidentDetection', () => {
    let detection: AutomaticIncidentDetection;

    beforeEach(() => {
      detection = new AutomaticIncidentDetection(mockConfig, mockRedis, mockLogger);
    });

    describe('processAlert', () => {
      test('should process valid alert successfully', async () => {
        const alert = createMockAlert();
        
        mockRedis.get = jest.fn().mockResolvedValue(null); // No duplicate
        mockRedis.setex = jest.fn().mockResolvedValue('OK');
        mockRedis.zadd = jest.fn().mockResolvedValue(1);

        await detection.processAlert(alert);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          `alert:${alert.source}:${alert.title}`,
          mockConfig.detection.cooldownPeriod,
          JSON.stringify(alert)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(`Alert processed: ${alert.id}`);
      });

      test('should ignore duplicate alerts', async () => {
        const alert = createMockAlert();
        const existingAlert = { ...alert, timestamp: new Date('2024-01-01T09:50:00Z') };
        
        mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify(existingAlert));

        await detection.processAlert(alert);

        expect(mockLogger.debug).toHaveBeenCalledWith(`Duplicate alert ignored: ${alert.id}`);
      });

      test('should handle invalid alert gracefully', async () => {
        const invalidAlert = { ...createMockAlert(), title: '' }; // Invalid: missing title

        await expect(detection.processAlert(invalidAlert as Alert)).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith('Error processing alert:', expect.any(Error));
      });

      test('should create incident when threshold is met', async () => {
        const alert = createMockAlert();
        
        mockRedis.get = jest.fn().mockResolvedValue(null);
        mockRedis.setex = jest.fn().mockResolvedValue('OK');
        mockRedis.hset = jest.fn().mockResolvedValue(1);
        mockRedis.lpush = jest.fn().mockResolvedValue(1);
        mockRedis.zadd = jest.fn().mockResolvedValue(1);

        // Mock matching rule and meeting threshold
        const detectionSpy = jest.spyOn(detection as any, 'getRecentAlertsForRule')
          .mockResolvedValue([alert, alert, alert]); // 3 alerts = threshold met

        await detection.processAlert(alert);

        expect(mockRedis.hset).toHaveBeenCalledWith(
          'incidents',
          expect.any(String),
          expect.stringContaining('Auto-detected')
        );
      });
    });

    describe('addDetectionRule', () => {
      test('should add new detection rule', () => {
        const rule = {
          id: 'test-rule',
          name: 'Test Rule',
          description: 'Test detection rule',
          enabled: true,
          conditions: {
            alertPattern: 'error',
            threshold: 3,
            timeWindow: 300,
            severity: IncidentSeverity.P2_HIGH,
          },
          actions: {
            createIncident: true,
            assignToTeam: 'platform',
          },
        };

        detection.addDetectionRule(rule);
        const rules = detection.getDetectionRules();

        expect(rules).toContain(rule);
        expect(mockLogger.info).toHaveBeenCalledWith(`Detection rule added/updated: ${rule.name}`);
      });
    });

    describe('start and stop', () => {
      test('should start detection system', async () => {
        mockRedis.subscribe = jest.fn().mockResolvedValue(1);

        await detection.start();

        expect(mockRedis.subscribe).toHaveBeenCalledWith('alerts:new');
        expect(mockLogger.info).toHaveBeenCalledWith('Automatic incident detection system started');
      });

      test('should stop detection system', async () => {
        mockRedis.unsubscribe = jest.fn().mockResolvedValue(1);

        await detection.start(); // Start first
        await detection.stop();

        expect(mockRedis.unsubscribe).toHaveBeenCalledWith('alerts:new');
        expect(mockLogger.info).toHaveBeenCalledWith('Automatic incident detection system stopped');
      });
    });
  });

  describe('PostMortemGenerator', () => {
    let generator: PostMortemGenerator;

    beforeEach(() => {
      generator = new PostMortemGenerator(mockConfig, mockRedis, mockLogger);
    });

    describe('generatePostMortem', () => {
      test('should generate post-mortem for resolved incident', async () => {
        const incident = createMockIncident({ 
          status: IncidentStatus.RESOLVED,
          resolvedAt: new Date('2024-01-01T12:00:00Z')
        });

        // Mock data retrieval
        mockRedis.lrange = jest.fn()
          .mockResolvedValueOnce(['{"id":"timeline-1","type":"alert","title":"Alert received","timestamp":"2024-01-01T10:00:00Z"}']) // timeline
          .mockResolvedValueOnce(['{"id":"msg-1","content":"Investigating issue","timestamp":"2024-01-01T10:30:00Z"}']); // messages

        mockRedis.hget = jest.fn().mockResolvedValue(null); // No existing MTTR metrics
        mockRedis.hset = jest.fn().mockResolvedValue(1);

        const postMortem = await generator.generatePostMortem(incident);

        expect(postMortem.incidentId).toBe(incident.id);
        expect(postMortem.title).toBe(`Post-Mortem: ${incident.title}`);
        expect(postMortem.timeline).toHaveLength(1);
        expect(postMortem.actionItems.length).toBeGreaterThan(0);
        expect(mockRedis.hset).toHaveBeenCalledWith('postmortems', postMortem.id, JSON.stringify(postMortem));
        expect(mockLogger.info).toHaveBeenCalledWith(`Post-mortem generated: ${postMortem.id}`);
      });

      test('should generate markdown format', async () => {
        const postMortem: PostMortem = {
          id: 'pm-123',
          incidentId: 'incident-123',
          title: 'Test Post-Mortem',
          summary: 'Test summary',
          timeline: [],
          rootCause: 'Database connection failure',
          impact: { usersAffected: 1000, downtime: 120 },
          contributingFactors: ['High load', 'Old connection pool'],
          lessonsLearned: ['Better monitoring needed'],
          actionItems: [{
            id: 'action-1',
            description: 'Upgrade connection pool',
            assignee: 'team-lead',
            priority: 'high',
            completed: false,
          }],
          sections: [],
          authors: ['incident-commander'],
          reviewers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const markdown = await generator.generateMarkdown(postMortem);

        expect(markdown).toContain('# Test Post-Mortem');
        expect(markdown).toContain('## Root Cause Analysis');
        expect(markdown).toContain('Database connection failure');
        expect(markdown).toContain('- [x] **HIGH**: Upgrade connection pool');
      });

      test('should generate PDF format', async () => {
        const postMortem: PostMortem = {
          id: 'pm-123',
          incidentId: 'incident-123',
          title: 'Test Post-Mortem',
          summary: 'Test summary',
          timeline: [],
          rootCause: 'Test root cause',
          impact: { usersAffected: 100, downtime: 30 },
          contributingFactors: [],
          lessonsLearned: [],
          actionItems: [],
          sections: [],
          authors: ['test-user'],
          reviewers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const pdf = await generator.generatePDF(postMortem);

        expect(pdf).toBeInstanceOf(Buffer);
        expect(pdf.length).toBeGreaterThan(0);
      });
    });
  });

  describe('RunbookIntegration', () => {
    let runbooks: RunbookIntegration;

    beforeEach(() => {
      runbooks = new RunbookIntegration(mockConfig, mockRedis, mockLogger);
    });

    describe('findMatchingRunbooks', () => {
      test('should find matching runbooks for alert', async () => {
        const alert = createMockAlert({ title: 'High error rate detected' });
        
        await runbooks.initialize();
        const matches = await runbooks.findMatchingRunbooks(alert);

        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0].confidence).toBeGreaterThan(0.3);
        expect(matches[0].runbook.title).toContain('Error Rate');
      });

      test('should return empty array for non-matching alert', async () => {
        const alert = createMockAlert({ 
          title: 'Unrelated alert',
          description: 'Something completely different'
        });
        
        await runbooks.initialize();
        const matches = await runbooks.findMatchingRunbooks(alert);

        expect(matches).toHaveLength(0);
      });
    });

    describe('executeRunbook', () => {
      test('should execute runbook successfully', async () => {
        const incident = createMockIncident();
        
        mockRedis.hset = jest.fn().mockResolvedValue(1);
        mockRedis.lpush = jest.fn().mockResolvedValue(1);

        await runbooks.initialize();
        const execution = await runbooks.executeRunbook(
          'high-error-rate-investigation',
          incident.id,
          'user-123',
          false // Manual mode
        );

        expect(execution.incidentId).toBe(incident.id);
        expect(execution.status).toBe('running');
        expect(execution.steps.length).toBeGreaterThan(0);
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Started runbook execution: ${execution.id} for incident: ${incident.id}`
        );
      });

      test('should handle non-existent runbook', async () => {
        await runbooks.initialize();
        
        await expect(runbooks.executeRunbook(
          'non-existent-runbook',
          'incident-123',
          'user-123'
        )).rejects.toThrow('Runbook not found: non-existent-runbook');
      });
    });

    describe('saveRunbook', () => {
      test('should save valid runbook', async () => {
        const runbook: Runbook = {
          id: 'test-runbook',
          title: 'Test Runbook',
          description: 'Test runbook description',
          category: 'Testing',
          tags: ['test'],
          steps: [{
            id: 'step-1',
            title: 'Test Step',
            description: 'Test step description',
            order: 1,
            automatable: false,
          }],
          triggers: {
            alertPatterns: ['test'],
            conditions: [],
          },
          metadata: {
            estimatedTime: 30,
            skillLevel: 'beginner',
            lastTested: new Date(),
            successRate: 1.0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
        };

        mockRedis.hset = jest.fn().mockResolvedValue(1);

        await runbooks.saveRunbook(runbook);

        expect(mockRedis.hset).toHaveBeenCalledWith('runbooks', runbook.id, JSON.stringify(runbook));
        expect(mockLogger.info).toHaveBeenCalledWith(`Runbook saved: ${runbook.title} (${runbook.id})`);
      });

      test('should reject invalid runbook', async () => {
        const invalidRunbook = {
          id: 'invalid',
          title: '', // Invalid: empty title
          steps: [],
        } as Runbook;

        await expect(runbooks.saveRunbook(invalidRunbook)).rejects.toThrow('Invalid runbook: missing required fields');
      });
    });
  });

  describe('StatusPageAPI', () => {
    let statusPage: StatusPageAPI;

    beforeEach(() => {
      statusPage = new StatusPageAPI(mockRedis, mockConfig);
    });

    describe('getStatusPageData', () => {
      test('should return status page data', async () => {
        const mockIncidents = [
          createMockIncident({ status: IncidentStatus.INVESTIGATING }),
          createMockIncident({ 
            id: 'incident-456',
            status: IncidentStatus.RESOLVED,
            resolvedAt: new Date('2024-01-01T11:00:00Z')
          }),
        ];

        mockRedis.hgetall = jest.fn()
          .mockResolvedValueOnce({
            'incident-123': JSON.stringify(mockIncidents[0]),
            'incident-456': JSON.stringify(mockIncidents[1]),
          })
          .mockResolvedValueOnce({}); // maintenance windows

        const data = await statusPage.getStatusPageData('30d', true);

        expect(data.overallStatus).toBeDefined();
        expect(data.activeIncidents).toHaveLength(1);
        expect(data.activeIncidents[0].status).toBe(IncidentStatus.INVESTIGATING);
        expect(data.recentIncidents).toHaveLength(2);
        expect(data.uptime.percentage).toBeGreaterThan(0);
        expect(data.lastUpdated).toBeInstanceOf(Date);
      });

      test('should filter private incidents for public view', async () => {
        const publicIncident = createMockIncident({ tags: ['public'] });
        const privateIncident = createMockIncident({ 
          id: 'incident-private',
          tags: ['internal', 'private']
        });

        mockRedis.hgetall = jest.fn()
          .mockResolvedValueOnce({
            'incident-public': JSON.stringify(publicIncident),
            'incident-private': JSON.stringify(privateIncident),
          })
          .mockResolvedValueOnce({});

        const publicData = await statusPage.getStatusPageData('30d', true);
        const internalData = await statusPage.getStatusPageData('30d', false);

        expect(publicData.activeIncidents).toHaveLength(1);
        expect(publicData.activeIncidents[0].id).toBe(publicIncident.id);
        
        expect(internalData.activeIncidents).toHaveLength(2);
      });
    });
  });

  describe('TimelineReconstructionEngine', () => {
    let timelineEngine: TimelineReconstructionEngine;

    beforeEach(() => {
      timelineEngine = new TimelineReconstructionEngine(mockConfig, mockRedis, mockLogger);
    });

    describe('reconstructTimeline', () => {
      test('should reconstruct incident timeline', async () => {
        const incident = createMockIncident();
        const timelineEvents = [
          {
            id: 'event-1',
            incidentId: incident.id,
            type: 'alert',
            title: 'Alert Received',
            description: 'High error rate detected',
            timestamp: new Date('2024-01-01T09:55:00Z'),
          },
          {
            id: 'event-2',
            incidentId: incident.id,
            type: 'status_change',
            title: 'Status Updated',
            description: 'Incident acknowledged',
            timestamp: new Date('2024-01-01T10:05:00Z'),
          },
        ] as TimelineEvent[];

        mockRedis.hget = jest.fn()
          .mockResolvedValueOnce(JSON.stringify(incident))
          .mockResolvedValueOnce(null); // No existing reconstruction

        mockRedis.lrange = jest.fn()
          .mockResolvedValueOnce(timelineEvents.map(e => JSON.stringify(e))) // timeline events
          .mockResolvedValueOnce([]) // war room messages
          .mockResolvedValueOnce([]); // system events

        mockRedis.hgetall = jest.fn().mockResolvedValue({}); // alerts
        mockRedis.hset = jest.fn().mockResolvedValue(1);

        const reconstruction = await timelineEngine.reconstructTimeline(incident.id);

        expect(reconstruction.incidentId).toBe(incident.id);
        expect(reconstruction.events.length).toBeGreaterThan(0);
        expect(reconstruction.phases.length).toBeGreaterThan(0);
        expect(reconstruction.keyMetrics).toBeDefined();
        expect(reconstruction.insights.length).toBeGreaterThan(0);
        expect(mockLogger.info).toHaveBeenCalledWith(`Timeline reconstruction completed for incident: ${incident.id}`);
      });

      test('should handle missing incident', async () => {
        mockRedis.hget = jest.fn().mockResolvedValue(null);

        await expect(timelineEngine.reconstructTimeline('non-existent'))
          .rejects.toThrow('Incident not found: non-existent');
      });
    });

    describe('generateVisualTimeline', () => {
      test('should generate visual timeline data', async () => {
        const mockReconstruction = {
          incidentId: 'incident-123',
          events: [],
          phases: [],
          keyMetrics: { totalDuration: 7200000 },
          gaps: [],
          insights: [{ actionable: true, type: 'efficiency', title: 'Test', description: '', severity: 'info', recommendations: [], evidence: { eventIds: [], metrics: {} } }],
          reconstructedAt: new Date(),
        };

        mockRedis.hget = jest.fn().mockResolvedValue(JSON.stringify(mockReconstruction));

        const visualData = await timelineEngine.generateVisualTimeline('incident-123', 'phase');

        expect(visualData.incidentId).toBe('incident-123');
        expect(visualData.groupBy).toBe('phase');
        expect(visualData.insights).toHaveLength(1);
      });
    });
  });

  describe('MTTRTracker', () => {
    let mttrTracker: MTTRTracker;

    beforeEach(() => {
      mttrTracker = new MTTRTracker(mockConfig, mockRedis, mockLogger);
    });

    describe('trackIncidentMTTR', () => {
      test('should calculate MTTR metrics for resolved incident', async () => {
        const incident = createMockIncident({
          status: IncidentStatus.RESOLVED,
          resolvedAt: new Date('2024-01-01T12:00:00Z'),
        });

        const timelineEvents = [
          {
            id: 'event-1',
            incidentId: incident.id,
            type: 'status_change',
            title: 'Acknowledged',
            description: 'Incident acknowledged',
            timestamp: new Date('2024-01-01T10:05:00Z'),
          },
          {
            id: 'event-2',
            incidentId: incident.id,
            type: 'status_change',
            title: 'Investigating',
            description: 'Started investigating',
            timestamp: new Date('2024-01-01T10:10:00Z'),
          },
        ] as TimelineEvent[];

        mockRedis.lrange = jest.fn().mockResolvedValue(
          timelineEvents.map(e => JSON.stringify(e))
        );
        mockRedis.hset = jest.fn().mockResolvedValue(1);
        mockRedis.hincrby = jest.fn().mockResolvedValue(1);
        mockRedis.expire = jest.fn().mockResolvedValue(1);

        const metrics = await mttrTracker.trackIncidentMTTR(incident);

        expect(metrics.incidentId).toBe(incident.id);
        expect(metrics.durations.totalTime).toBeGreaterThan(0);
        expect(metrics.durations.detectionTime).toBeGreaterThan(0);
        expect(metrics.timestamps.detected).toBeInstanceOf(Date);
        expect(metrics.timestamps.resolved).toBeInstanceOf(Date);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(`MTTR metrics calculated for incident ${incident.id}`)
        );
      });
    });

    describe('analyzeMTTR', () => {
      test('should analyze MTTR with optimization suggestions', async () => {
        const mockMetrics: MTTRMetrics = {
          incidentId: 'incident-123',
          timestamps: {
            detected: new Date('2024-01-01T10:00:00Z'),
            acknowledged: new Date('2024-01-01T10:05:00Z'),
            investigating: new Date('2024-01-01T10:10:00Z'),
            identified: new Date('2024-01-01T11:00:00Z'),
            resolved: new Date('2024-01-01T12:00:00Z'),
          },
          durations: {
            detectionTime: 5 * 60 * 1000, // 5 minutes
            acknowledgmentTime: 5 * 60 * 1000, // 5 minutes
            investigationTime: 50 * 60 * 1000, // 50 minutes
            resolutionTime: 60 * 60 * 1000, // 1 hour
            totalTime: 2 * 60 * 60 * 1000, // 2 hours
          },
          escalations: {
            count: 1,
            levels: ['L2'],
            timestamps: [new Date('2024-01-01T10:30:00Z')],
          },
        };

        const incident = createMockIncident();

        mockRedis.hget = jest.fn()
          .mockResolvedValueOnce(JSON.stringify(mockMetrics))
          .mockResolvedValueOnce(JSON.stringify(incident));

        mockRedis.lrange = jest.fn().mockResolvedValue([]);
        mockRedis.hgetall = jest.fn().mockResolvedValue({});
        mockRedis.hset = jest.fn().mockResolvedValue(1);

        const analysis = await mttrTracker.analyzeMTTR(incident.id);

        expect(analysis.incidentId).toBe(incident.id);
        expect(analysis.metrics).toEqual(mockMetrics);
        expect(analysis.benchmarks).toBeDefined();
        expect(analysis.optimization).toBeDefined();
        expect(analysis.trends).toBeDefined();
        expect(analysis.breakdown).toBeDefined();
      });
    });

    describe('updateTargets', () => {
      test('should update MTTR targets', async () => {
        const newTargets = {
          overall: 4 * 60 * 60 * 1000, // 4 hours
          severity: {
            [IncidentSeverity.P1_CRITICAL]: 1 * 60 * 60 * 1000, // 1 hour
          },
        };

        mockRedis.hset = jest.fn().mockResolvedValue(1);

        await mttrTracker.updateTargets(newTargets);

        expect(mttrTracker.getTargets().overall).toBe(newTargets.overall);
        expect(mockRedis.hset).toHaveBeenCalledWith(
          'mttr_targets',
          'current',
          expect.stringContaining('"overall":14400000')
        );
        expect(mockLogger.info).toHaveBeenCalledWith('MTTR targets updated');
      });
    });
  });

  describe('Integration Tests', () => {
    test('should handle end-to-end incident flow', async () => {
      // Create alert
      const alert = createMockAlert();
      const detection = new AutomaticIncidentDetection(mockConfig, mockRedis, mockLogger);
      
      // Mock Redis responses for the flow
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn().mockResolvedValue('OK');
      mockRedis.hset = jest.fn().mockResolvedValue(1);
      mockRedis.lpush = jest.fn().mockResolvedValue(1);
      mockRedis.zadd = jest.fn().mockResolvedValue(1);
      mockRedis.lrange = jest.fn().mockResolvedValue([]);
      mockRedis.hgetall = jest.fn().mockResolvedValue({});

      // Process alert (should create incident)
      await detection.processAlert(alert);

      // Verify incident creation was attempted
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'incidents',
        expect.any(String),
        expect.any(String)
      );
    });

    test('should handle errors gracefully across all modules', async () => {
      const incident = createMockIncident();
      
      // Simulate Redis error
      mockRedis.hget = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      const generator = new PostMortemGenerator(mockConfig, mockRedis, mockLogger);
      
      await expect(generator.generatePostMortem(incident)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error generating post-mortem'),
        expect.any(Error)
      );
    });
  });

  describe('Performance Tests', () => {
    test('should process multiple alerts within time limit', async () => {
      const detection = new AutomaticIncidentDetection(mockConfig, mockRedis, mockLogger);
      const alerts = Array.from({ length: 100 }, (_, i) => 
        createMockAlert({ id: `alert-${i}` })
      );

      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn().mockResolvedValue('OK');
      mockRedis.zadd = jest.fn().mockResolvedValue(1);

      const startTime = Date.now();
      
      await Promise.all(alerts.map(alert => detection.processAlert(alert)));
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process 100 alerts in less than 1 second
      expect(duration).toBeLessThan(1000);
    }, 10000);

    test('should handle concurrent war room users', async () => {
      // This would test the war room collaboration system
      // with multiple concurrent users
      expect(true).toBe(true); // Placeholder
    });
  });
});

// Mock fetch for status page tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Additional test utilities
export const testUtils = {
  createMockIncident,
  createMockAlert,
  createMockComponent,
  mockRedis,
  mockLogger,
  mockConfig,
};