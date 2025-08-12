/**
 * Debugging Package - Main Entry Point
 * 
 * Advanced debugging tools for monitoring service with comprehensive
 * error analysis, distributed tracing, session replay, and performance profiling.
 */

// Import types needed for interfaces
import type { ErrorData, ErrorCluster } from './clustering/errors';
import type { TraceJourney } from './tracing/distributed';
import type { SessionData } from './replay/session';
import type { CorrelationResult } from './correlation/logs';
import type { CodeInsight } from './insights/code';
import type { PerformanceProfile } from './profiling/performance';
import type { TimelineData } from './timeline/visualizer';

// Import classes for implementation
import { DistributedTracing } from './tracing/distributed';
import { SessionReplay } from './replay/session';
import { LogCorrelation } from './correlation/logs';
import { ErrorClustering } from './clustering/errors';
import { CodeInsights } from './insights/code';
import { PerformanceProfiler } from './profiling/performance';

// Core components
export { DistributedTracing } from './tracing/distributed';
export { SessionReplay } from './replay/session';
export { LogCorrelation } from './correlation/logs';
export { ErrorClustering } from './clustering/errors';
export { CodeInsights } from './insights/code';
export { PerformanceProfiler } from './profiling/performance';

// Timeline visualization
export { 
  TimelineVisualizer,
  createTimelineEventsFromTrace,
  createTimelineEventsFromSession,
  createTimelineEventsFromCorrelations,
  createTimelineEventsFromCodeInsights
} from './timeline/visualizer';

// Type exports
export type {
  TracingConfig,
  TraceContext,
  SpanData,
  TraceJourney
} from './tracing/distributed';

export type {
  SessionReplayConfig,
  SessionEvent,
  SessionData,
  SessionEventType,
  ReplayOptions
} from './replay/session';

export type {
  LogCorrelationConfig,
  LogEntry,
  LogLevel,
  MetricEntry,
  TraceEntry,
  CorrelationResult,
  CorrelationStrategy
} from './correlation/logs';

export type {
  ErrorClusteringConfig,
  ErrorData,
  ErrorCluster,
  ClusteringResult,
  SimilarityScore,
  ClusteringAlgorithm,
  FeatureExtractionStrategy,
  SimilarityWeights
} from './clustering/errors';

export type {
  CodeInsightsConfig,
  CommitInfo,
  BlameInfo,
  FileChangeInfo,
  CodeInsight,
  CodeHotspot
} from './insights/code';

export type {
  PerformanceProfilerConfig,
  ProfilingSession,
  CPUProfile,
  MemoryProfile,
  NetworkProfile,
  PerformanceProfile,
  FlameGraphNode
} from './profiling/performance';

export type {
  TimelineEvent,
  TimelineEventType,
  TimelineConfig,
  TimelineData,
  TimelineVisualizerProps
} from './timeline/visualizer';

/**
 * Main Debug Manager class that orchestrates all debugging components
 */
export interface DebugManagerConfig {
  /** Distributed tracing configuration */
  tracing?: {
    enabled?: boolean;
    serviceName: string;
    endpoint: string;
    sampleRate?: number;
  };
  /** Session replay configuration */
  sessionReplay?: {
    enabled?: boolean;
    maxSessionSize?: number;
    maskSensitiveData?: boolean;
  };
  /** Log correlation configuration */
  logCorrelation?: {
    enabled?: boolean;
    correlationWindow?: number;
    enableCaching?: boolean;
  };
  /** Error clustering configuration */
  errorClustering?: {
    enabled?: boolean;
    minSimilarity?: number;
    maxClusters?: number;
    algorithm?: 'kmeans' | 'dbscan' | 'hierarchical' | 'adaptive';
  };
  /** Code insights configuration */
  codeInsights?: {
    enabled?: boolean;
    gitRepository?: string;
    includeBlame?: boolean;
  };
  /** Performance profiling configuration */
  profiling?: {
    enabled?: boolean;
    enableCPUProfiling?: boolean;
    enableMemoryProfiling?: boolean;
    enableNetworkProfiling?: boolean;
  };
}

export interface DebugSessionData {
  /** Session ID */
  sessionId: string;
  /** Primary error being debugged */
  error: ErrorData;
  /** Trace journey */
  traceJourney?: TraceJourney;
  /** Session replay data */
  sessionData?: SessionData;
  /** Log correlations */
  correlations?: CorrelationResult[];
  /** Error cluster */
  cluster?: ErrorCluster;
  /** Code insights */
  codeInsights?: CodeInsight;
  /** Performance profile */
  performanceProfile?: PerformanceProfile;
  /** Timeline data */
  timelineData?: TimelineData;
  /** Debug session metadata */
  metadata: {
    createdAt: number;
    updatedAt: number;
    debugDuration: number;
    componentsUsed: string[];
  };
}

/**
 * Main Debug Manager that orchestrates all debugging components
 */
export class DebugManager {
  private config: Required<DebugManagerConfig>;
  private tracing?: DistributedTracing;
  private sessionReplay?: SessionReplay;
  private logCorrelation?: LogCorrelation;
  private errorClustering?: ErrorClustering;
  private codeInsights?: CodeInsights;
  private profiler?: PerformanceProfiler;
  
  private sessions: Map<string, DebugSessionData> = new Map();

  constructor(config: DebugManagerConfig) {
    this.config = {
      tracing: {
        enabled: true,
        serviceName: 'debug-service',
        endpoint: 'http://localhost:14268/api/traces',
        sampleRate: 1.0,
        ...config.tracing
      },
      sessionReplay: {
        enabled: true,
        maxSessionSize: 5 * 1024 * 1024, // 5MB
        maskSensitiveData: true,
        ...config.sessionReplay
      },
      logCorrelation: {
        enabled: true,
        correlationWindow: 100,
        enableCaching: true,
        ...config.logCorrelation
      },
      errorClustering: {
        enabled: true,
        minSimilarity: 0.85,
        maxClusters: 50,
        algorithm: 'adaptive',
        ...config.errorClustering
      },
      codeInsights: {
        enabled: true,
        gitRepository: './',
        includeBlame: true,
        ...config.codeInsights
      },
      profiling: {
        enabled: true,
        enableCPUProfiling: true,
        enableMemoryProfiling: true,
        enableNetworkProfiling: true,
        ...config.profiling
      }
    };
  }

  /**
   * Initialize all enabled debugging components
   */
  async initialize(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.tracing.enabled) {
      this.tracing = new DistributedTracing({
        serviceName: this.config.tracing.serviceName,
        endpoint: this.config.tracing.endpoint,
        sampleRate: this.config.tracing.sampleRate
      });
      promises.push(this.tracing.initialize());
    }

    if (this.config.sessionReplay.enabled) {
      this.sessionReplay = new SessionReplay({
        maxSessionSize: this.config.sessionReplay.maxSessionSize,
        maskSensitiveData: this.config.sessionReplay.maskSensitiveData
      });
    }

    if (this.config.logCorrelation.enabled) {
      this.logCorrelation = new LogCorrelation({
        correlationWindow: this.config.logCorrelation.correlationWindow,
        enableCaching: this.config.logCorrelation.enableCaching
      });
    }

    if (this.config.errorClustering.enabled) {
      this.errorClustering = new ErrorClustering({
        minSimilarity: this.config.errorClustering.minSimilarity,
        maxClusters: this.config.errorClustering.maxClusters,
        algorithm: this.config.errorClustering.algorithm
      });
    }

    if (this.config.codeInsights.enabled && this.config.codeInsights.gitRepository) {
      this.codeInsights = new CodeInsights({
        gitRepository: this.config.codeInsights.gitRepository,
        includeBlame: this.config.codeInsights.includeBlame
      });
    }

    if (this.config.profiling.enabled) {
      this.profiler = new PerformanceProfiler({
        enableCPUProfiling: this.config.profiling.enableCPUProfiling,
        enableMemoryProfiling: this.config.profiling.enableMemoryProfiling,
        enableNetworkProfiling: this.config.profiling.enableNetworkProfiling
      });
    }

    await Promise.all(promises);
  }

  /**
   * Start comprehensive debugging for an error
   */
  async startDebugging(error: ErrorData, options: {
    includeReplay?: boolean;
    includeTrace?: boolean;
    includeTimeline?: boolean;
    startProfiling?: boolean;
  } = {}): Promise<string> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();
    
    const debugSession: DebugSessionData = {
      sessionId,
      error,
      metadata: {
        createdAt: startTime,
        updatedAt: startTime,
        debugDuration: 0,
        componentsUsed: []
      }
    };

    this.sessions.set(sessionId, debugSession);

    const tasks: Promise<void>[] = [];

    // Start session replay if requested and available
    if (options.includeReplay && this.sessionReplay) {
      tasks.push(this.captureSessionReplay(debugSession));
    }

    // Get trace journey if requested and available
    if (options.includeTrace && this.tracing) {
      tasks.push(this.captureTraceJourney(debugSession));
    }

    // Start profiling if requested
    if (options.startProfiling && this.profiler) {
      tasks.push(this.startProfiling(debugSession));
    }

    // Cluster error
    if (this.errorClustering) {
      tasks.push(this.clusterError(debugSession));
    }

    // Get code insights
    if (this.codeInsights) {
      tasks.push(this.getCodeInsights(debugSession));
    }

    // Correlate logs
    if (this.logCorrelation) {
      tasks.push(this.correlateLogs(debugSession));
    }

    await Promise.all(tasks);

    // Generate timeline if requested
    if (options.includeTimeline) {
      await this.generateTimeline(debugSession);
    }

    debugSession.metadata.updatedAt = Date.now();
    debugSession.metadata.debugDuration = Date.now() - startTime;

    return sessionId;
  }

  /**
   * Capture error with full debugging context
   */
  async captureError(error: Error | ErrorData, options: {
    includeReplay?: boolean;
    includeTrace?: boolean;
    includeTimeline?: boolean;
    includePerformance?: boolean;
  } = {}): Promise<DebugSessionData> {
    const errorData: ErrorData = error instanceof Error ? {
      id: this.generateErrorId(),
      message: error.message,
      type: error.name,
      timestamp: Date.now(),
      stackTrace: error.stack,
      filename: this.extractFilename(error.stack),
      lineno: this.extractLineNumber(error.stack)
    } : error;

    const sessionId = await this.startDebugging(errorData, options);
    
    // Wait a bit for data collection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.getDebugSession(sessionId)!;
  }

  /**
   * Get debug session data
   */
  getDebugSession(sessionId: string): DebugSessionData | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active debug sessions
   */
  getActiveSessions(): DebugSessionData[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Cleanup debug session
   */
  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Shutdown all debugging components
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.tracing) {
      promises.push(this.tracing.shutdown());
    }

    if (this.profiler) {
      this.profiler.cleanup();
    }

    await Promise.all(promises);
    this.sessions.clear();
  }

  // Private methods
  private async captureSessionReplay(session: DebugSessionData): Promise<void> {
    if (!this.sessionReplay) return;

    try {
      await this.sessionReplay.startRecording();
      
      // Record for a bit, then stop
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      session.sessionData = await this.sessionReplay.stopRecording();
      session.metadata.componentsUsed.push('sessionReplay');
    } catch (error) {
      console.warn('Failed to capture session replay:', error);
    }
  }

  private async captureTraceJourney(session: DebugSessionData): Promise<void> {
    if (!this.tracing) return;

    try {
      // Look for existing trace journey
      const context = this.tracing.getCurrentContext();
      if (context?.traceId) {
        const journey = await this.tracing.getTraceJourney(context.traceId);
        if (journey) {
          session.traceJourney = journey;
        }
      }
      session.metadata.componentsUsed.push('tracing');
    } catch (error) {
      console.warn('Failed to capture trace journey:', error);
    }
  }

  private async startProfiling(session: DebugSessionData): Promise<void> {
    if (!this.profiler) return;

    try {
      const profilingSession = this.profiler.startProfiling(`debug-${session.sessionId}`);
      
      // Profile for a bit, then get results
      setTimeout(async () => {
        try {
          session.performanceProfile = await this.profiler!.stopProfiling(profilingSession.id);
          session.metadata.componentsUsed.push('profiling');
        } catch (error) {
          console.warn('Failed to stop profiling:', error);
        }
      }, 10000); // Profile for 10 seconds
    } catch (error) {
      console.warn('Failed to start profiling:', error);
    }
  }

  private async clusterError(session: DebugSessionData): Promise<void> {
    if (!this.errorClustering) return;

    try {
      session.cluster = await this.errorClustering.addError(session.error);
      session.metadata.componentsUsed.push('errorClustering');
    } catch (error) {
      console.warn('Failed to cluster error:', error);
    }
  }

  private async getCodeInsights(session: DebugSessionData): Promise<void> {
    if (!this.codeInsights) return;

    try {
      session.codeInsights = await this.codeInsights.getInsights(session.error);
      session.metadata.componentsUsed.push('codeInsights');
    } catch (error) {
      console.warn('Failed to get code insights:', error);
    }
  }

  private async correlateLogs(session: DebugSessionData): Promise<void> {
    if (!this.logCorrelation) return;

    try {
      // Create a log entry from the error
      const logEntry = {
        id: `error-log-${session.error.id}`,
        timestamp: session.error.timestamp,
        level: 'error' as const,
        message: session.error.message,
        metadata: { errorId: session.error.id }
      };

      this.logCorrelation.addLogEntry(logEntry);
      const correlation = await this.logCorrelation.correlateLog(logEntry);
      session.correlations = [correlation];
      session.metadata.componentsUsed.push('logCorrelation');
    } catch (error) {
      console.warn('Failed to correlate logs:', error);
    }
  }

  private async generateTimeline(session: DebugSessionData): Promise<void> {
    const events: import('./timeline/visualizer').TimelineEvent[] = [];
    
    // Add events from different sources
    if (session.traceJourney && this.tracing) {
      const { createTimelineEventsFromTrace } = await import('./timeline/visualizer');
      events.push(...createTimelineEventsFromTrace(session.traceJourney));
    }
    
    if (session.sessionData) {
      const { createTimelineEventsFromSession } = await import('./timeline/visualizer');
      events.push(...createTimelineEventsFromSession(session.sessionData));
    }
    
    if (session.correlations) {
      const { createTimelineEventsFromCorrelations } = await import('./timeline/visualizer');
      events.push(...createTimelineEventsFromCorrelations(session.correlations));
    }
    
    if (session.codeInsights) {
      const { createTimelineEventsFromCodeInsights } = await import('./timeline/visualizer');
      events.push(...createTimelineEventsFromCodeInsights(session.codeInsights));
    }

    // Add error event
    events.push({
      id: `error-${session.error.id}`,
      timestamp: session.error.timestamp,
      type: 'error',
      source: 'error',
      title: 'Error Occurred',
      description: session.error.message,
      severity: 'critical',
      metadata: { error: session.error }
    });

    const timeRange = events.length > 0 ? {
      start: Math.min(...events.map(e => e.timestamp)),
      end: Math.max(...events.map(e => e.timestamp))
    } : {
      start: session.error.timestamp - 5000,
      end: session.error.timestamp + 1000
    };

    session.timelineData = {
      error: session.error,
      traceJourney: session.traceJourney,
      sessionData: session.sessionData,
      correlations: session.correlations,
      codeInsights: session.codeInsights,
      events,
      timeRange
    };

    session.metadata.componentsUsed.push('timeline');
  }

  private generateSessionId(): string {
    return `debug_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractFilename(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    const match = stack.match(/at\s+.*?\(([^:]+):/);
    return match ? match[1] : undefined;
  }

  private extractLineNumber(stack?: string): number | undefined {
    if (!stack) return undefined;
    
    const match = stack.match(/at\s+.*?:(\d+):/);
    return match ? parseInt(match[1], 10) : undefined;
  }
}

export default DebugManager;