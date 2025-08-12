/**
 * Performance Profiling Implementation
 * 
 * Advanced performance profiling system for CPU, memory, and network
 * with sampling, flame graphs, and bottleneck detection.
 */

import { EventEmitter } from 'events';
import { PerformanceObserver } from 'perf_hooks';

export interface PerformanceProfilerConfig {
  /** Enable CPU profiling */
  enableCPUProfiling?: boolean;
  /** Enable memory profiling */
  enableMemoryProfiling?: boolean;
  /** Enable network profiling */
  enableNetworkProfiling?: boolean;
  /** Sampling interval in milliseconds */
  samplingInterval?: number;
  /** Maximum profile duration in milliseconds */
  maxProfileDuration?: number;
  /** Enable flame graph generation */
  generateFlameGraphs?: boolean;
  /** Stack trace depth */
  stackTraceDepth?: number;
  /** Memory snapshot interval */
  memorySnapshotInterval?: number;
}

export interface ProfilingSession {
  /** Session ID */
  id: string;
  /** Session start time */
  startTime: number;
  /** Session end time */
  endTime?: number;
  /** Session configuration */
  config: PerformanceProfilerConfig;
  /** Session metadata */
  metadata: {
    /** Node.js version */
    nodeVersion: string;
    /** Platform */
    platform: string;
    /** CPU architecture */
    arch: string;
    /** Memory limit */
    memoryLimit?: number;
  };
}

export interface CPUProfile {
  /** Profile session ID */
  sessionId: string;
  /** Samples */
  samples: CPUSample[];
  /** Call stack */
  callStack: CallStackFrame[];
  /** Total sampling time */
  totalTime: number;
  /** Hot functions */
  hotFunctions: Array<{
    /** Function name */
    name: string;
    /** File path */
    file?: string;
    /** Line number */
    line?: number;
    /** Self time percentage */
    selfTime: number;
    /** Total time percentage */
    totalTime: number;
    /** Call count */
    callCount: number;
  }>;
  /** Flame graph data */
  flameGraph?: FlameGraphNode;
}

export interface CPUSample {
  /** Sample timestamp */
  timestamp: number;
  /** Stack trace */
  stack: string[];
  /** CPU usage percentage */
  cpuUsage?: number;
}

export interface CallStackFrame {
  /** Function name */
  functionName: string;
  /** File path */
  fileName?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Script ID */
  scriptId?: string;
}

export interface MemoryProfile {
  /** Profile session ID */
  sessionId: string;
  /** Memory snapshots */
  snapshots: MemorySnapshot[];
  /** Memory leaks detected */
  memoryLeaks: MemoryLeak[];
  /** GC events */
  gcEvents: GCEvent[];
  /** Memory usage summary */
  summary: {
    /** Peak memory usage */
    peakUsage: number;
    /** Average memory usage */
    averageUsage: number;
    /** Memory growth rate */
    growthRate: number;
    /** GC frequency */
    gcFrequency: number;
  };
}

export interface MemorySnapshot {
  /** Snapshot timestamp */
  timestamp: number;
  /** Heap usage */
  heapUsed: number;
  /** Heap total */
  heapTotal: number;
  /** External memory */
  external: number;
  /** RSS memory */
  rss: number;
  /** Object counts */
  objectCounts?: Record<string, number>;
}

export interface MemoryLeak {
  /** Leak type */
  type: 'growing_object' | 'event_listener' | 'closure' | 'timer';
  /** Object type/name */
  objectType: string;
  /** Growth rate per second */
  growthRate: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Stack trace where leak likely originates */
  stackTrace?: string[];
}

export interface GCEvent {
  /** GC timestamp */
  timestamp: number;
  /** GC type */
  type: 'minor' | 'major' | 'incremental';
  /** Duration in milliseconds */
  duration: number;
  /** Memory before GC */
  before: number;
  /** Memory after GC */
  after: number;
  /** Memory reclaimed */
  reclaimed: number;
}

export interface NetworkProfile {
  /** Profile session ID */
  sessionId: string;
  /** Network requests */
  requests: NetworkRequest[];
  /** Connection pools */
  connectionPools: ConnectionPool[];
  /** Network bottlenecks */
  bottlenecks: NetworkBottleneck[];
  /** Summary statistics */
  summary: {
    /** Total requests */
    totalRequests: number;
    /** Average response time */
    avgResponseTime: number;
    /** Error rate */
    errorRate: number;
    /** Throughput (requests/sec) */
    throughput: number;
  };
}

export interface NetworkRequest {
  /** Request ID */
  id: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** Response status */
  status: number;
  /** Request size */
  requestSize: number;
  /** Response size */
  responseSize: number;
  /** DNS lookup time */
  dnsLookup?: number;
  /** Connection time */
  connectionTime?: number;
  /** TLS handshake time */
  tlsTime?: number;
  /** Time to first byte */
  ttfb?: number;
  /** Error information */
  error?: string;
}

export interface ConnectionPool {
  /** Pool name/host */
  host: string;
  /** Active connections */
  activeConnections: number;
  /** Idle connections */
  idleConnections: number;
  /** Pending requests */
  pendingRequests: number;
  /** Pool utilization */
  utilization: number;
}

export interface NetworkBottleneck {
  /** Bottleneck type */
  type: 'dns' | 'connection' | 'ssl' | 'server_response' | 'bandwidth';
  /** Affected URLs */
  affectedUrls: string[];
  /** Impact score (0-1) */
  impact: number;
  /** Suggested fix */
  suggestion: string;
}

export interface FlameGraphNode {
  /** Function name */
  name: string;
  /** File path */
  file?: string;
  /** Self time */
  selfTime: number;
  /** Total time */
  totalTime: number;
  /** Children nodes */
  children: FlameGraphNode[];
}

export interface PerformanceProfile {
  /** Profiling session */
  session: ProfilingSession;
  /** CPU profile */
  cpuProfile?: CPUProfile;
  /** Memory profile */
  memoryProfile?: MemoryProfile;
  /** Network profile */
  networkProfile?: NetworkProfile;
  /** Performance bottlenecks */
  bottlenecks: Array<{
    /** Bottleneck type */
    type: 'cpu' | 'memory' | 'network' | 'io';
    /** Severity (0-1) */
    severity: number;
    /** Description */
    description: string;
    /** Recommendations */
    recommendations: string[];
  }>;
  /** Profile generation time */
  generatedAt: number;
}

export class PerformanceProfiler extends EventEmitter {
  private config: Required<PerformanceProfilerConfig>;
  private sessions: Map<string, ProfilingSession> = new Map();
  private cpuSamples: Map<string, CPUSample[]> = new Map();
  private memorySnapshots: Map<string, MemorySnapshot[]> = new Map();
  private networkRequests: Map<string, NetworkRequest[]> = new Map();
  private performanceObserver?: PerformanceObserver;
  private samplingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: PerformanceProfilerConfig = {}) {
    super();
    this.config = {
      enableCPUProfiling: true,
      enableMemoryProfiling: true,
      enableNetworkProfiling: true,
      samplingInterval: 100, // 100ms
      maxProfileDuration: 5 * 60 * 1000, // 5 minutes
      generateFlameGraphs: true,
      stackTraceDepth: 50,
      memorySnapshotInterval: 1000, // 1 second
      ...config
    };

    this.setupPerformanceObserver();
    this.setupNetworkInterception();
  }

  /**
   * Start profiling session
   */
  startProfiling(sessionId?: string): ProfilingSession {
    const id = sessionId || this.generateSessionId();
    
    if (this.sessions.has(id)) {
      throw new Error(`Profiling session ${id} already exists`);
    }

    const session: ProfilingSession = {
      id,
      startTime: Date.now(),
      config: { ...this.config },
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryLimit: this.getMemoryLimit()
      }
    };

    this.sessions.set(id, session);
    
    // Initialize profiling arrays
    this.cpuSamples.set(id, []);
    this.memorySnapshots.set(id, []);
    this.networkRequests.set(id, []);

    // Start sampling
    if (this.config.enableCPUProfiling) {
      this.startCPUSampling(id);
    }

    if (this.config.enableMemoryProfiling) {
      this.startMemorySampling(id);
    }

    // Setup auto-stop timer
    setTimeout(() => {
      if (this.sessions.has(id) && !this.sessions.get(id)!.endTime) {
        this.stopProfiling(id);
      }
    }, this.config.maxProfileDuration);

    this.emit('profilingStarted', session);
    
    return session;
  }

  /**
   * Stop profiling session
   */
  async stopProfiling(sessionId: string): Promise<PerformanceProfile> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Profiling session ${sessionId} not found`);
    }

    if (session.endTime) {
      throw new Error(`Profiling session ${sessionId} already stopped`);
    }

    session.endTime = Date.now();

    // Stop sampling
    this.stopSampling(sessionId);

    // Generate profiles
    const profile = await this.generateProfile(session);

    this.emit('profilingStopped', { session, profile });
    
    return profile;
  }

  /**
   * Get profile for session
   */
  async getProfile(sessionId: string): Promise<PerformanceProfile | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return this.generateProfile(session);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ProfilingSession[] {
    return Array.from(this.sessions.values())
      .filter(session => !session.endTime);
  }

  /**
   * Clear old sessions and data
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    
    for (const [sessionId, session] of this.sessions) {
      if (session.startTime < cutoff) {
        this.sessions.delete(sessionId);
        this.cpuSamples.delete(sessionId);
        this.memorySnapshots.delete(sessionId);
        this.networkRequests.delete(sessionId);
      }
    }
  }

  // Private methods
  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        // Process performance entries
        this.processPerformanceEntry(entry);
      }
    });

    this.performanceObserver.observe({ 
      entryTypes: ['measure', 'resource'] // Note: 'navigation' and 'gc' not available in Node.js 
    });
  }

  private setupNetworkInterception(): void {
    if (!this.config.enableNetworkProfiling) return;

    // Intercept HTTP requests (simplified implementation)
    const originalRequest = require('http').request;
    
    require('http').request = (...args: any[]) => {
      const req = originalRequest.apply(this, args);
      
      // Track network requests for all active sessions
      for (const sessionId of this.sessions.keys()) {
        if (!this.sessions.get(sessionId)!.endTime) {
          this.trackNetworkRequest(sessionId, req);
        }
      }
      
      return req;
    };
  }

  private startCPUSampling(sessionId: string): void {
    const timer = setInterval(() => {
      this.sampleCPU(sessionId);
    }, this.config.samplingInterval);

    this.samplingTimers.set(`cpu-${sessionId}`, timer);
  }

  private startMemorySampling(sessionId: string): void {
    const timer = setInterval(() => {
      this.sampleMemory(sessionId);
    }, this.config.memorySnapshotInterval);

    this.samplingTimers.set(`memory-${sessionId}`, timer);
  }

  private stopSampling(sessionId: string): void {
    const cpuTimer = this.samplingTimers.get(`cpu-${sessionId}`);
    if (cpuTimer) {
      clearInterval(cpuTimer);
      this.samplingTimers.delete(`cpu-${sessionId}`);
    }

    const memoryTimer = this.samplingTimers.get(`memory-${sessionId}`);
    if (memoryTimer) {
      clearInterval(memoryTimer);
      this.samplingTimers.delete(`memory-${sessionId}`);
    }
  }

  private sampleCPU(sessionId: string): void {
    const samples = this.cpuSamples.get(sessionId);
    if (!samples) return;

    // Capture stack trace
    const stack = this.captureStackTrace();
    
    const sample: CPUSample = {
      timestamp: Date.now(),
      stack,
      cpuUsage: process.cpuUsage().user / 1000 // Convert to ms
    };

    samples.push(sample);
  }

  private sampleMemory(sessionId: string): void {
    const snapshots = this.memorySnapshots.get(sessionId);
    if (!snapshots) return;

    const memUsage = process.memoryUsage();
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };

    snapshots.push(snapshot);
  }

  private captureStackTrace(): string[] {
    const stack: string[] = [];
    const originalPrepareStackTrace = Error.prepareStackTrace;
    
    Error.prepareStackTrace = (_, structuredStack) => structuredStack;
    
    const err = new Error();
    const structuredStack = err.stack as any;
    
    Error.prepareStackTrace = originalPrepareStackTrace;

    if (Array.isArray(structuredStack)) {
      for (let i = 0; i < Math.min(structuredStack.length, this.config.stackTraceDepth); i++) {
        const frame = structuredStack[i];
        const functionName = frame.getFunctionName() || '<anonymous>';
        const fileName = frame.getFileName() || '<unknown>';
        const lineNumber = frame.getLineNumber() || 0;
        
        stack.push(`${functionName} (${fileName}:${lineNumber})`);
      }
    }

    return stack;
  }

  private trackNetworkRequest(sessionId: string, req: any): void {
    const requests = this.networkRequests.get(sessionId);
    if (!requests) return;

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    const networkRequest: NetworkRequest = {
      id: requestId,
      startTime,
      endTime: 0,
      method: req.method || 'GET',
      url: req.url || '',
      status: 0,
      requestSize: 0,
      responseSize: 0
    };

    req.on('response', (res: any) => {
      networkRequest.status = res.statusCode || 0;
      networkRequest.endTime = Date.now();
    });

    req.on('error', (error: Error) => {
      networkRequest.error = error.message;
      networkRequest.endTime = Date.now();
    });

    requests.push(networkRequest);
  }

  private processPerformanceEntry(entry: any): void {
    // Process different types of performance entries
    if (entry.entryType === 'gc') {
      this.processGCEntry(entry);
    }
  }

  private processGCEntry(_entry: any): void {
    // Process garbage collection entries for all active sessions
    for (const sessionId of this.sessions.keys()) {
      const session = this.sessions.get(sessionId);
      if (!session || session.endTime) continue;

      // TODO: Process GC events
      // const gcEvent: GCEvent = {
      //   timestamp: Date.now(),
      //   type: entry.kind === 1 ? 'minor' : 'major',
      //   duration: entry.duration,
      //   before: 0, // Would need more detailed GC info
      //   after: 0,
      //   reclaimed: 0
      // };
      // Store GC event (simplified)
    }
  }

  private async generateProfile(session: ProfilingSession): Promise<PerformanceProfile> {
    const profile: PerformanceProfile = {
      session,
      bottlenecks: [],
      generatedAt: Date.now()
    };

    // Generate CPU profile
    if (this.config.enableCPUProfiling) {
      profile.cpuProfile = await this.generateCPUProfile(session.id);
    }

    // Generate memory profile
    if (this.config.enableMemoryProfiling) {
      profile.memoryProfile = await this.generateMemoryProfile(session.id);
    }

    // Generate network profile
    if (this.config.enableNetworkProfiling) {
      profile.networkProfile = await this.generateNetworkProfile(session.id);
    }

    // Analyze bottlenecks
    profile.bottlenecks = await this.analyzeBottlenecks(profile);

    return profile;
  }

  private async generateCPUProfile(sessionId: string): Promise<CPUProfile> {
    const samples = this.cpuSamples.get(sessionId) || [];
    
    // Analyze samples to find hot functions
    const functionCounts = new Map<string, { count: number; totalTime: number }>();
    
    samples.forEach(sample => {
      sample.stack.forEach(frame => {
        const existing = functionCounts.get(frame) || { count: 0, totalTime: 0 };
        existing.count++;
        existing.totalTime += this.config.samplingInterval;
        functionCounts.set(frame, existing);
      });
    });

    const hotFunctions = Array.from(functionCounts.entries())
      .map(([name, stats]) => ({
        name,
        selfTime: (stats.totalTime / samples.length) * 100,
        totalTime: (stats.totalTime / samples.length) * 100,
        callCount: stats.count
      }))
      .sort((a, b) => b.selfTime - a.selfTime)
      .slice(0, 20); // Top 20 hot functions

    const profile: CPUProfile = {
      sessionId,
      samples,
      callStack: [], // Would need more detailed call stack analysis
      totalTime: samples.length * this.config.samplingInterval,
      hotFunctions
    };

    // Generate flame graph if enabled
    if (this.config.generateFlameGraphs) {
      profile.flameGraph = this.generateFlameGraph(samples);
    }

    return profile;
  }

  private async generateMemoryProfile(sessionId: string): Promise<MemoryProfile> {
    const snapshots = this.memorySnapshots.get(sessionId) || [];
    
    if (snapshots.length === 0) {
      return {
        sessionId,
        snapshots,
        memoryLeaks: [],
        gcEvents: [],
        summary: {
          peakUsage: 0,
          averageUsage: 0,
          growthRate: 0,
          gcFrequency: 0
        }
      };
    }

    // Calculate summary statistics
    const heapUsages = snapshots.map(s => s.heapUsed);
    const peakUsage = Math.max(...heapUsages);
    const averageUsage = heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length;
    
    // Calculate growth rate
    const firstUsage = heapUsages[0];
    const lastUsage = heapUsages[heapUsages.length - 1];
    const timeSpan = (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp) / 1000; // seconds
    const growthRate = timeSpan > 0 ? (lastUsage - firstUsage) / timeSpan : 0;

    // Detect memory leaks (simplified)
    const memoryLeaks = await this.detectMemoryLeaks(snapshots);

    return {
      sessionId,
      snapshots,
      memoryLeaks,
      gcEvents: [], // Would need GC event tracking
      summary: {
        peakUsage,
        averageUsage,
        growthRate,
        gcFrequency: 0 // Would calculate from GC events
      }
    };
  }

  private async generateNetworkProfile(sessionId: string): Promise<NetworkProfile> {
    const requests = this.networkRequests.get(sessionId) || [];
    
    const totalRequests = requests.length;
    const completedRequests = requests.filter(r => r.endTime > 0);
    const responseTimes = completedRequests.map(r => r.endTime - r.startTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
    
    const errorRequests = requests.filter(r => r.status >= 400 || r.error);
    const errorRate = totalRequests > 0 ? errorRequests.length / totalRequests : 0;
    
    const timeSpan = requests.length > 1 
      ? (requests[requests.length - 1].startTime - requests[0].startTime) / 1000
      : 1;
    const throughput = totalRequests / timeSpan;

    return {
      sessionId,
      requests,
      connectionPools: [], // Would need connection pool monitoring
      bottlenecks: [], // Would analyze for network bottlenecks
      summary: {
        totalRequests,
        avgResponseTime,
        errorRate,
        throughput
      }
    };
  }

  private generateFlameGraph(samples: CPUSample[]): FlameGraphNode {
    const root: FlameGraphNode = {
      name: 'root',
      selfTime: 0,
      totalTime: samples.length * this.config.samplingInterval,
      children: []
    };

    // Build flame graph from samples (simplified implementation)
    samples.forEach(sample => {
      let currentNode = root;
      
      for (const frame of sample.stack.reverse()) {
        let child = currentNode.children.find(c => c.name === frame);
        
        if (!child) {
          child = {
            name: frame,
            selfTime: 0,
            totalTime: 0,
            children: []
          };
          currentNode.children.push(child);
        }
        
        child.totalTime += this.config.samplingInterval;
        currentNode = child;
      }
      
      if (sample.stack.length > 0) {
        currentNode.selfTime += this.config.samplingInterval;
      }
    });

    return root;
  }

  private async detectMemoryLeaks(snapshots: MemorySnapshot[]): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];
    
    if (snapshots.length < 3) return leaks;

    // Simple memory leak detection based on heap growth
    const windowSize = Math.min(10, snapshots.length);
    const recentSnapshots = snapshots.slice(-windowSize);
    
    const heapGrowth = recentSnapshots[recentSnapshots.length - 1].heapUsed - 
                      recentSnapshots[0].heapUsed;
    const timeSpan = (recentSnapshots[recentSnapshots.length - 1].timestamp - 
                     recentSnapshots[0].timestamp) / 1000;
    
    const growthRate = timeSpan > 0 ? heapGrowth / timeSpan : 0;
    
    // If memory is growing consistently over 1MB/second, flag as potential leak
    if (growthRate > 1024 * 1024) {
      leaks.push({
        type: 'growing_object',
        objectType: 'unknown',
        growthRate,
        confidence: 0.7,
        stackTrace: []
      });
    }

    return leaks;
  }

  private async analyzeBottlenecks(profile: PerformanceProfile): Promise<PerformanceProfile['bottlenecks']> {
    const bottlenecks: PerformanceProfile['bottlenecks'] = [];

    // Analyze CPU bottlenecks
    if (profile.cpuProfile) {
      const topFunction = profile.cpuProfile.hotFunctions[0];
      if (topFunction && topFunction.selfTime > 30) {
        bottlenecks.push({
          type: 'cpu',
          severity: topFunction.selfTime / 100,
          description: `High CPU usage in ${topFunction.name} (${topFunction.selfTime.toFixed(1)}%)`,
          recommendations: [
            'Optimize hot function',
            'Consider caching',
            'Profile with more detail'
          ]
        });
      }
    }

    // Analyze memory bottlenecks
    if (profile.memoryProfile) {
      if (profile.memoryProfile.summary.growthRate > 1024 * 1024) {
        bottlenecks.push({
          type: 'memory',
          severity: Math.min(1, profile.memoryProfile.summary.growthRate / (10 * 1024 * 1024)),
          description: `High memory growth rate: ${(profile.memoryProfile.summary.growthRate / 1024 / 1024).toFixed(1)} MB/s`,
          recommendations: [
            'Check for memory leaks',
            'Review object lifecycle',
            'Enable heap snapshots'
          ]
        });
      }
    }

    // Analyze network bottlenecks
    if (profile.networkProfile) {
      if (profile.networkProfile.summary.avgResponseTime > 1000) {
        bottlenecks.push({
          type: 'network',
          severity: Math.min(1, profile.networkProfile.summary.avgResponseTime / 5000),
          description: `High average response time: ${profile.networkProfile.summary.avgResponseTime.toFixed(0)}ms`,
          recommendations: [
            'Optimize API calls',
            'Implement request caching',
            'Check network connectivity'
          ]
        });
      }
    }

    return bottlenecks.sort((a, b) => b.severity - a.severity);
  }

  private generateSessionId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMemoryLimit(): number | undefined {
    // Try to get V8 heap limit
    try {
      return require('v8').getHeapStatistics().heap_size_limit;
    } catch {
      return undefined;
    }
  }
}

export default PerformanceProfiler;