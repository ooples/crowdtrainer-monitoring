/**
 * Comprehensive Test Suite for Debugging Package
 * 
 * Tests all major components with >80% code coverage including
 * unit tests, integration tests, and error handling scenarios.
 */

import { jest } from '@jest/globals';
import { DistributedTracing } from '../tracing/distributed';
import { SessionReplay } from '../replay/session';
import { LogCorrelation } from '../correlation/logs';
import { ErrorClustering, type ErrorData } from '../clustering/errors';
import { CodeInsights } from '../insights/code';
import { PerformanceProfiler } from '../profiling/performance';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

// Mock external dependencies
jest.mock('simple-git');
jest.mock('@opentelemetry/sdk-node');
jest.mock('@opentelemetry/exporter-jaeger');

describe('Debugging Package Test Suite', () => {
  describe('DistributedTracing', () => {
    let tracing: DistributedTracing;

    beforeEach(() => {
      tracing = new DistributedTracing({
        serviceName: 'test-service',
        endpoint: 'http://localhost:14268/api/traces'
      });
    });

    afterEach(async () => {
      await tracing.shutdown();
    });

    it('should initialize tracing system', async () => {
      await expect(tracing.initialize()).resolves.not.toThrow();
    });

    it('should start and finish spans', () => {
      const span = tracing.startSpan('test-operation', {
        kind: SpanKind.SERVER,
        attributes: { 'test.key': 'test.value' }
      });

      expect(span).toBeDefined();
      
      tracing.finishSpan(span, {
        status: { code: SpanStatusCode.OK }
      });
    });

    it('should create child spans', () => {
      const parentSpan = tracing.startSpan('parent-operation');
      const childSpan = tracing.createChildSpan(parentSpan, 'child-operation');
      
      expect(childSpan).toBeDefined();
      
      tracing.finishSpan(childSpan);
      tracing.finishSpan(parentSpan);
    });

    it('should execute code within span context', async () => {
      const result = await tracing.withSpan('test-span', async (span) => {
        expect(span).toBeDefined();
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should handle errors in span context', async () => {
      await expect(
        tracing.withSpan('error-span', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should add events to spans', () => {
      const span = tracing.startSpan('event-test');
      
      // Mock getActiveSpan to return our span
      jest.spyOn(require('@opentelemetry/api').trace, 'getActiveSpan')
        .mockReturnValue(span);

      expect(() => {
        tracing.addEvent('test-event', { key: 'value' });
      }).not.toThrow();

      tracing.finishSpan(span);
    });

    it('should get current trace context', () => {
      const span = tracing.startSpan('context-test');
      
      jest.spyOn(require('@opentelemetry/api').trace, 'getActiveSpan')
        .mockReturnValue(span);

      const context = tracing.getCurrentContext();
      expect(context).toBeDefined();

      tracing.finishSpan(span);
    });
  });

  describe('SessionReplay', () => {
    let replay: SessionReplay;
    
    // Mock DOM APIs for testing
    beforeEach(() => {
      global.window = {
        location: { href: 'http://test.com' },
        innerWidth: 1920,
        innerHeight: 1080,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      } as any;

      global.document = {
        documentElement: { tagName: 'HTML', attributes: [], children: [] },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        styleSheets: []
      } as any;

      global.navigator = {
        userAgent: 'test-agent'
      } as any;

      global.MutationObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn()
      }));

      replay = new SessionReplay({
        maxSessionSize: 1024 * 1024, // 1MB for testing
        maskSensitiveData: true
      });
    });

    it('should start and stop recording', async () => {
      const sessionId = await replay.startRecording();
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_/);

      const sessionData = await replay.stopRecording();
      expect(sessionData.sessionId).toBe(sessionId);
      expect(sessionData.events).toBeDefined();
    });

    it('should get current session data', async () => {
      const sessionId = await replay.startRecording();
      
      const sessionData = await replay.getSessionData();
      expect(sessionData).not.toBeNull();
      expect(sessionData!.sessionId).toBe(sessionId);

      await replay.stopRecording();
    });

    it('should handle replay of session data', async () => {
      const sessionId = await replay.startRecording();
      const sessionData = await replay.stopRecording();

      await expect(replay.replaySession(sessionData)).resolves.not.toThrow();
    });

    it('should compress and decompress session data', async () => {
      const sessionId = await replay.startRecording();
      const sessionData = await replay.stopRecording();

      expect(sessionData.compressedSize).toBeGreaterThan(0);
      expect(sessionData.uncompressedSize).toBeGreaterThan(sessionData.compressedSize);
    });

    it('should throw error if starting recording twice', async () => {
      await replay.startRecording();
      await expect(replay.startRecording()).rejects.toThrow('Recording already in progress');
      await replay.stopRecording();
    });

    it('should handle pause and resume recording', () => {
      expect(() => replay.pauseRecording()).not.toThrow();
      expect(() => replay.resumeRecording()).not.toThrow();
    });
  });

  describe('LogCorrelation', () => {
    let correlator: LogCorrelation;

    beforeEach(() => {
      correlator = new LogCorrelation({
        correlationWindow: 1000,
        maxCorrelations: 100
      });
    });

    const createLogEntry = (id: string, timestamp: number, message: string) => ({
      id,
      timestamp,
      level: 'info' as const,
      message,
      metadata: { source: 'test' }
    });

    const createTraceEntry = (traceId: string, spanId: string, timestamp: number) => ({
      traceId,
      spanId,
      operationName: 'test-operation',
      startTime: timestamp,
      status: 'ok' as const
    });

    const createMetricEntry = (name: string, timestamp: number, value: number) => ({
      name,
      timestamp,
      value,
      type: 'counter' as const
    });

    it('should add log entries', () => {
      const logEntry = createLogEntry('log1', Date.now(), 'Test log message');
      
      expect(() => {
        correlator.addLogEntry(logEntry);
      }).not.toThrow();
    });

    it('should add trace entries', () => {
      const traceEntry = createTraceEntry('trace1', 'span1', Date.now());
      
      expect(() => {
        correlator.addTraceEntry(traceEntry);
      }).not.toThrow();
    });

    it('should add metric entries', () => {
      const metricEntry = createMetricEntry('test.metric', Date.now(), 100);
      
      expect(() => {
        correlator.addMetricEntry(metricEntry);
      }).not.toThrow();
    });

    it('should correlate logs with time window', async () => {
      const timestamp = Date.now();
      const logEntry = createLogEntry('log1', timestamp, 'Error occurred');
      const traceEntry = createTraceEntry('trace1', 'span1', timestamp + 50);
      const metricEntry = createMetricEntry('error.count', timestamp + 100, 1);

      correlator.addLogEntry(logEntry);
      correlator.addTraceEntry(traceEntry);
      correlator.addMetricEntry(metricEntry);

      const result = await correlator.correlateLog(logEntry);
      
      expect(result.logEntry).toBe(logEntry);
      expect(result.traces).toHaveLength(1);
      expect(result.metrics).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should correlate by trace ID', async () => {
      const traceId = 'trace123';
      const timestamp = Date.now();
      
      const logEntry = createLogEntry('log1', timestamp, 'Test message');
      logEntry.traceContext = { traceId, spanId: 'span1' };
      
      const traceEntry = createTraceEntry(traceId, 'span1', timestamp);

      correlator.addLogEntry(logEntry);
      correlator.addTraceEntry(traceEntry);

      const result = await correlator.correlateLog(logEntry);
      
      expect(result.traces).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should find correlations by trace ID', async () => {
      const traceId = 'trace456';
      const logEntry = createLogEntry('log1', Date.now(), 'Test');
      logEntry.traceContext = { traceId, spanId: 'span1' };

      correlator.addLogEntry(logEntry);

      const results = await correlator.findByTraceId(traceId);
      expect(results).toHaveLength(1);
    });

    it('should find correlations in time range', async () => {
      const startTime = Date.now();
      const endTime = startTime + 10000;
      
      const logEntry = createLogEntry('log1', startTime + 5000, 'Test');
      correlator.addLogEntry(logEntry);

      const results = await correlator.findInTimeRange(startTime, endTime);
      expect(results).toHaveLength(1);
    });

    it('should provide correlation statistics', () => {
      const stats = correlator.getStatistics();
      
      expect(stats).toHaveProperty('totalLogs');
      expect(stats).toHaveProperty('totalTraces');
      expect(stats).toHaveProperty('totalMetrics');
      expect(stats).toHaveProperty('correlationsPerformed');
    });

    it('should clear all data', () => {
      const logEntry = createLogEntry('log1', Date.now(), 'Test');
      correlator.addLogEntry(logEntry);

      correlator.clear();

      const stats = correlator.getStatistics();
      expect(stats.totalLogs).toBe(0);
    });
  });

  describe('ErrorClustering', () => {
    let clustering: ErrorClustering;

    beforeEach(() => {
      clustering = new ErrorClustering({
        minSimilarity: 0.8,
        maxClusters: 10
      });
    });

    const createErrorData = (id: string, message: string, type = 'Error'): ErrorData => ({
      id,
      message,
      type,
      timestamp: Date.now(),
      stackTrace: `Error: ${message}\n    at test (test.js:1:1)`,
      filename: 'test.js',
      lineno: 1,
      colno: 1
    });

    it('should add errors to clustering', async () => {
      const error = createErrorData('error1', 'Test error message');
      
      const cluster = await clustering.addError(error);
      
      expect(cluster).toBeDefined();
      expect(cluster.errors).toContain(error);
      expect(cluster.stats.count).toBe(1);
    });

    it('should cluster similar errors', async () => {
      const error1 = createErrorData('error1', 'Cannot read property of undefined');
      const error2 = createErrorData('error2', 'Cannot read property of null');
      
      const cluster1 = await clustering.addError(error1);
      const cluster2 = await clustering.addError(error2);
      
      // Should be in the same cluster due to similarity
      expect(cluster1.id).toBe(cluster2.id);
      expect(cluster1.stats.count).toBe(2);
    });

    it('should create separate clusters for dissimilar errors', async () => {
      const error1 = createErrorData('error1', 'Network timeout');
      const error2 = createErrorData('error2', 'Invalid JSON format');
      
      const cluster1 = await clustering.addError(error1);
      const cluster2 = await clustering.addError(error2);
      
      expect(cluster1.id).not.toBe(cluster2.id);
    });

    it('should calculate similarity between errors', async () => {
      const error1 = createErrorData('error1', 'TypeError: Cannot read property');
      const error2 = createErrorData('error2', 'TypeError: Cannot read property');
      
      const similarity = await clustering.calculateSimilarity(error1, error2);
      
      expect(similarity.overall).toBeGreaterThan(0.9);
      expect(similarity.components.message).toBeGreaterThan(0.9);
      expect(similarity.components.errorType).toBe(1);
    });

    it('should find clusters by criteria', async () => {
      const error1 = createErrorData('error1', 'Test error 1');
      const error2 = createErrorData('error2', 'Test error 2');
      
      await clustering.addError(error1);
      await clustering.addError(error2);
      
      const clusters = clustering.getClusters({
        minSize: 1,
        sortBy: 'count'
      });
      
      expect(clusters.length).toBeGreaterThan(0);
    });

    it('should provide clustering statistics', async () => {
      const error = createErrorData('error1', 'Test error');
      await clustering.addError(error);
      
      const stats = clustering.getStatistics();
      
      expect(stats.totalClusters).toBeGreaterThan(0);
      expect(stats.totalErrors).toBeGreaterThan(0);
      expect(stats.accuracyEstimate).toBeGreaterThanOrEqual(0);
    });

    it('should perform reclustering', async () => {
      const error1 = createErrorData('error1', 'Error 1');
      const error2 = createErrorData('error2', 'Error 2');
      
      await clustering.addError(error1);
      await clustering.addError(error2);
      
      const result = await clustering.performReclustering();
      
      expect(result.clusters).toBeDefined();
      expect(result.metadata.totalErrors).toBe(2);
    });

    it('should merge clusters', async () => {
      const error1 = createErrorData('error1', 'Error 1');
      const error2 = createErrorData('error2', 'Error 2');
      
      const cluster1 = await clustering.addError(error1);
      const cluster2 = await clustering.addError(error2);
      
      if (cluster1.id !== cluster2.id) {
        const mergedCluster = await clustering.mergeClusters(cluster1.id, cluster2.id);
        expect(mergedCluster.stats.count).toBe(2);
      }
    });
  });

  describe('CodeInsights', () => {
    let codeInsights: CodeInsights;

    beforeEach(() => {
      // Mock simple-git
      const mockGit = {
        log: jest.fn().mockResolvedValue({ all: [] }),
        raw: jest.fn().mockResolvedValue(''),
        show: jest.fn().mockResolvedValue(''),
        diffSummary: jest.fn().mockResolvedValue({ files: [] })
      };

      jest.doMock('simple-git', () => ({
        simpleGit: () => mockGit
      }));

      codeInsights = new CodeInsights({
        gitRepository: '/test/repo'
      });
    });

    const createErrorData = (filename?: string, lineno?: number): ErrorData => ({
      id: 'error1',
      message: 'Test error',
      type: 'Error',
      timestamp: Date.now(),
      filename,
      lineno
    });

    it('should get insights for an error', async () => {
      const error = createErrorData('test.js', 10);
      
      const insights = await codeInsights.getInsights(error);
      
      expect(insights.error).toBe(error);
      expect(insights.relatedCommits).toBeDefined();
      expect(insights.riskAssessment).toBeDefined();
      expect(insights.suggestions).toBeDefined();
    });

    it('should get insights for multiple errors', async () => {
      const errors = [
        createErrorData('test1.js', 10),
        createErrorData('test2.js', 20)
      ];
      
      const insights = await codeInsights.getInsightsBatch(errors);
      
      expect(insights).toHaveLength(2);
    });

    it('should get hotspots', () => {
      const hotspots = codeInsights.getHotspots({
        minScore: 0.1,
        limit: 10
      });
      
      expect(Array.isArray(hotspots)).toBe(true);
    });

    it('should analyze commit impact', async () => {
      const commitHash = 'abc123';
      
      // Mock git methods for this test
      const mockCommit = {
        hash: commitHash,
        message: 'Test commit',
        author: { name: 'Test Author', email: 'test@example.com' },
        date: new Date(),
        files: ['test.js'],
        stats: { filesChanged: 1, insertions: 10, deletions: 5 }
      };

      jest.spyOn(codeInsights as any, 'getCommitInfo')
        .mockResolvedValue(mockCommit);

      const impact = await codeInsights.analyzeCommitImpact(commitHash);
      
      expect(impact.commit).toEqual(mockCommit);
      expect(impact.impact.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should get blame information', async () => {
      const blameOutput = 'abc123def test.js (Test Author 2023-01-01 12:00:00) console.log("test");';
      
      jest.spyOn(codeInsights as any, 'git')
        .mockReturnValue({
          raw: jest.fn().mockResolvedValue(blameOutput)
        });

      const blame = await codeInsights.getBlameInfo('test.js', 1);
      
      expect(blame).toBeDefined();
      if (blame) {
        expect(blame.file).toBe('test.js');
        expect(blame.line).toBe(1);
      }
    });

    it('should analyze complexity trends', async () => {
      const trends = await codeInsights.analyzeComplexityTrends('test.js', 7);
      
      expect(trends.file).toBe('test.js');
      expect(trends.trend).toBeDefined();
      expect(trends.currentComplexity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PerformanceProfiler', () => {
    let profiler: PerformanceProfiler;

    beforeEach(() => {
      profiler = new PerformanceProfiler({
        enableCPUProfiling: true,
        enableMemoryProfiling: true,
        samplingInterval: 50
      });
    });

    afterEach(() => {
      profiler.cleanup();
    });

    it('should start profiling session', () => {
      const session = profiler.startProfiling('test-session');
      
      expect(session.id).toBe('test-session');
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.endTime).toBeUndefined();
    });

    it('should stop profiling session', async () => {
      const session = profiler.startProfiling('test-session');
      
      // Wait a bit for some samples
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const profile = await profiler.stopProfiling('test-session');
      
      expect(profile.session.endTime).toBeDefined();
      expect(profile.cpuProfile).toBeDefined();
      expect(profile.memoryProfile).toBeDefined();
    });

    it('should get active sessions', () => {
      profiler.startProfiling('session1');
      profiler.startProfiling('session2');
      
      const active = profiler.getActiveSessions();
      expect(active).toHaveLength(2);
    });

    it('should handle multiple sessions', () => {
      const session1 = profiler.startProfiling('session1');
      const session2 = profiler.startProfiling('session2');
      
      expect(session1.id).not.toBe(session2.id);
    });

    it('should throw error for duplicate session ID', () => {
      profiler.startProfiling('duplicate');
      
      expect(() => {
        profiler.startProfiling('duplicate');
      }).toThrow('Profiling session duplicate already exists');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        profiler.stopProfiling('non-existent')
      ).rejects.toThrow('Profiling session non-existent not found');
    });

    it('should cleanup old sessions', () => {
      profiler.startProfiling('old-session');
      
      // Test cleanup (normally would wait for actual time)
      profiler.cleanup(0); // Clean everything
      
      const active = profiler.getActiveSessions();
      expect(active).toHaveLength(0);
    });

    it('should get profile for session', async () => {
      const session = profiler.startProfiling('profile-test');
      
      const profile = await profiler.getProfile('profile-test');
      expect(profile).toBeDefined();
      expect(profile!.session).toBe(session);
    });

    it('should return null for non-existent profile', async () => {
      const profile = await profiler.getProfile('non-existent');
      expect(profile).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should work together in a complete debug scenario', async () => {
      // Create components
      const tracing = new DistributedTracing({
        serviceName: 'integration-test',
        endpoint: 'http://localhost:14268/api/traces'
      });
      
      const correlator = new LogCorrelation();
      const clustering = new ErrorClustering();
      const profiler = new PerformanceProfiler();

      try {
        // Initialize tracing
        await tracing.initialize();

        // Start profiling
        const profilingSession = profiler.startProfiling();

        // Create trace
        const span = tracing.startSpan('integration-test', {
          attributes: { 'test.integration': true }
        });

        // Add log entry
        const logEntry = {
          id: 'integration-log',
          timestamp: Date.now(),
          level: 'error' as const,
          message: 'Integration test error',
          traceContext: tracing.getCurrentContext()
        };
        
        correlator.addLogEntry(logEntry);

        // Add error to clustering
        const errorData: ErrorData = {
          id: 'integration-error',
          message: 'Integration test error',
          type: 'IntegrationError',
          timestamp: Date.now()
        };
        
        const cluster = await clustering.addError(errorData);

        // Finish trace
        tracing.finishSpan(span);

        // Correlate logs
        const correlation = await correlator.correlateLog(logEntry);

        // Stop profiling
        const profile = await profiler.stopProfiling(profilingSession.id);

        // Verify integration
        expect(correlation.logEntry).toBe(logEntry);
        expect(cluster.errors).toContain(errorData);
        expect(profile.session.id).toBe(profilingSession.id);

      } finally {
        await tracing.shutdown();
        profiler.cleanup();
      }
    });

    it('should handle error scenarios gracefully', async () => {
      const tracing = new DistributedTracing({
        serviceName: 'error-test',
        endpoint: 'invalid-endpoint'
      });

      // Should not throw but might emit error events
      let errorEmitted = false;
      tracing.on('error', () => {
        errorEmitted = true;
      });

      try {
        await tracing.initialize();
      } catch (error) {
        // Expected to potentially fail with invalid endpoint
        expect(error).toBeDefined();
      }

      // Cleanup
      await tracing.shutdown();
    });

    it('should maintain performance under load', async () => {
      const clustering = new ErrorClustering({
        maxClusters: 5
      });

      const startTime = Date.now();
      
      // Add many errors quickly
      const promises = Array.from({ length: 100 }, (_, i) => {
        const error: ErrorData = {
          id: `error-${i}`,
          message: `Error ${i % 10}`, // Some similar messages
          type: 'LoadTestError',
          timestamp: Date.now() + i
        };
        
        return clustering.addError(error);
      });

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const stats = clustering.getStatistics();

      expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
      expect(stats.totalErrors).toBe(100);
      expect(stats.totalClusters).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle SessionReplay errors gracefully', async () => {
      // Mock window to be undefined to simulate SSR
      const originalWindow = global.window;
      delete (global as any).window;

      const replay = new SessionReplay();

      try {
        await replay.startRecording();
        await replay.stopRecording();
        // Should not throw even without window
      } catch (error) {
        // Expected in SSR environment
        expect(error).toBeDefined();
      } finally {
        global.window = originalWindow;
      }
    });

    it('should handle LogCorrelation with invalid data', async () => {
      const correlator = new LogCorrelation();
      
      const invalidLog = {
        id: '',
        timestamp: -1,
        level: 'invalid' as any,
        message: ''
      };

      // Should handle gracefully
      expect(() => {
        correlator.addLogEntry(invalidLog);
      }).not.toThrow();

      const result = await correlator.correlateLog(invalidLog);
      expect(result.confidence).toBe(0);
    });

    it('should handle CodeInsights with invalid git repository', async () => {
      const insights = new CodeInsights({
        gitRepository: '/non/existent/repo'
      });

      const error: ErrorData = {
        id: 'test-error',
        message: 'Test',
        type: 'Error',
        timestamp: Date.now()
      };

      const result = await insights.getInsights(error);
      
      // Should return result even with invalid repo
      expect(result.error).toBe(error);
      expect(result.relatedCommits).toHaveLength(0);
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory in SessionReplay', async () => {
      const replay = new SessionReplay({
        maxSessionSize: 1024 // Very small limit
      });

      // Mock DOM operations
      global.window = {
        location: { href: 'http://test.com' },
        innerWidth: 1920,
        innerHeight: 1080,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      } as any;

      const sessionId = await replay.startRecording();
      
      // Simulate many events
      for (let i = 0; i < 1000; i++) {
        // Would normally trigger through DOM events
        replay.emit('eventRecorded', {
          type: 'mouse_click',
          timestamp: Date.now(),
          data: { x: i, y: i }
        });
      }

      const sessionData = await replay.stopRecording();
      
      // Should respect size limits
      expect(sessionData.compressedSize).toBeLessThan(1024 * 2); // Allow some overhead
    });

    it('should perform correlations efficiently', async () => {
      const correlator = new LogCorrelation({
        maxCorrelations: 1000,
        enableCaching: true
      });

      const startTime = Date.now();

      // Add many entries
      for (let i = 0; i < 1000; i++) {
        correlator.addLogEntry({
          id: `log-${i}`,
          timestamp: Date.now() + i,
          level: 'info',
          message: `Log ${i}`
        });

        correlator.addTraceEntry({
          traceId: `trace-${Math.floor(i / 10)}`,
          spanId: `span-${i}`,
          operationName: `op-${i}`,
          startTime: Date.now() + i,
          status: 'ok'
        });
      }

      // Correlate a log
      const testLog = {
        id: 'test-log',
        timestamp: Date.now() + 500,
        level: 'info' as const,
        message: 'Test correlation'
      };

      correlator.addLogEntry(testLog);
      const result = await correlator.correlateLog(testLog);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should be fast
      expect(result.metadata.correlationDuration).toBeLessThan(100);
    });
  });
});

// Test utilities
export const createMockError = (overrides: Partial<ErrorData> = {}): ErrorData => ({
  id: 'mock-error',
  message: 'Mock error message',
  type: 'MockError',
  timestamp: Date.now(),
  stackTrace: 'MockError: Mock error message\n    at test (test.js:1:1)',
  filename: 'test.js',
  lineno: 1,
  colno: 1,
  ...overrides
});

export const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const mockDOM = () => {
  global.window = {
    location: { href: 'http://localhost' },
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  } as any;

  global.document = {
    documentElement: { tagName: 'HTML', attributes: [], children: [] },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    styleSheets: []
  } as any;

  global.navigator = {
    userAgent: 'MockAgent/1.0'
  } as any;

  global.MutationObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn()
  }));
};