/**
 * Log Correlation System
 * 
 * High-performance log correlation system that automatically correlates logs
 * with metrics and traces within 100ms for comprehensive debugging context.
 */

import { EventEmitter } from 'events';
import { TraceContext } from '../tracing/distributed';

export interface LogCorrelationConfig {
  /** Correlation time window in milliseconds */
  correlationWindow?: number;
  /** Maximum correlations to store in memory */
  maxCorrelations?: number;
  /** Enable correlation caching */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Index size for fast lookups */
  indexSize?: number;
  /** Enable real-time correlation */
  realTimeCorrelation?: boolean;
}

export interface LogEntry {
  /** Log ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Logger name/source */
  logger?: string;
  /** Trace context if available */
  traceContext?: TraceContext;
  /** Log metadata */
  metadata?: Record<string, any>;
  /** Tags */
  tags?: Record<string, string>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface MetricEntry {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Timestamp */
  timestamp: number;
  /** Tags */
  tags?: Record<string, string>;
  /** Metric type */
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface TraceEntry {
  /** Trace ID */
  traceId: string;
  /** Span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Operation name */
  operationName: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Tags */
  tags?: Record<string, string>;
  /** Status */
  status?: 'ok' | 'error' | 'timeout';
}

export interface CorrelationResult {
  /** Primary log entry */
  logEntry: LogEntry;
  /** Correlated traces */
  traces: TraceEntry[];
  /** Correlated metrics */
  metrics: MetricEntry[];
  /** Related log entries */
  relatedLogs: LogEntry[];
  /** Correlation confidence score (0-1) */
  confidence: number;
  /** Correlation timestamp */
  correlatedAt: number;
  /** Correlation metadata */
  metadata: {
    /** Correlation duration in ms */
    correlationDuration: number;
    /** Number of items checked */
    itemsChecked: number;
    /** Correlation strategy used */
    strategy: CorrelationStrategy;
  };
}

export type CorrelationStrategy = 
  | 'trace_id'
  | 'time_window'
  | 'metadata_match'
  | 'pattern_match'
  | 'ml_similarity';

interface TimeIndex {
  /** Time bucket (rounded timestamp) */
  bucket: number;
  /** Entries in this time bucket */
  entries: Array<{
    id: string;
    timestamp: number;
    type: 'log' | 'trace' | 'metric';
  }>;
}

interface CorrelationCache {
  /** Cache key */
  key: string;
  /** Cached result */
  result: CorrelationResult;
  /** Cache timestamp */
  timestamp: number;
  /** Cache TTL */
  ttl: number;
}

export class LogCorrelation extends EventEmitter {
  private config: Required<LogCorrelationConfig>;
  private logEntries: Map<string, LogEntry> = new Map();
  private traceEntries: Map<string, TraceEntry> = new Map();
  private metricEntries: Map<string, MetricEntry> = new Map();
  private timeIndex: Map<number, TimeIndex> = new Map();
  private correlationCache: Map<string, CorrelationCache> = new Map();
  private performanceMetrics = {
    correlationsPerformed: 0,
    averageCorrelationTime: 0,
    cacheHitRate: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0
  };

  constructor(config: LogCorrelationConfig = {}) {
    super();
    this.config = {
      correlationWindow: 100, // 100ms
      maxCorrelations: 10000,
      enableCaching: true,
      cacheTtl: 5 * 60 * 1000, // 5 minutes
      indexSize: 1000,
      realTimeCorrelation: true,
      ...config
    };

    // Setup cleanup interval
    this.setupCleanupInterval();
  }

  /**
   * Add log entry for correlation
   */
  addLogEntry(logEntry: LogEntry): void {
    this.logEntries.set(logEntry.id, logEntry);
    this.addToTimeIndex(logEntry.id, logEntry.timestamp, 'log');
    
    if (this.config.realTimeCorrelation) {
      // Trigger immediate correlation for high-priority logs
      if (logEntry.level === 'error' || logEntry.level === 'fatal') {
        setImmediate(() => this.correlateLog(logEntry));
      }
    }

    this.emit('logAdded', logEntry);
  }

  /**
   * Add trace entry for correlation
   */
  addTraceEntry(traceEntry: TraceEntry): void {
    this.traceEntries.set(`${traceEntry.traceId}:${traceEntry.spanId}`, traceEntry);
    this.addToTimeIndex(`${traceEntry.traceId}:${traceEntry.spanId}`, traceEntry.startTime, 'trace');
    
    this.emit('traceAdded', traceEntry);
  }

  /**
   * Add metric entry for correlation
   */
  addMetricEntry(metricEntry: MetricEntry): void {
    const id = `${metricEntry.name}:${metricEntry.timestamp}`;
    this.metricEntries.set(id, metricEntry);
    this.addToTimeIndex(id, metricEntry.timestamp, 'metric');
    
    this.emit('metricAdded', metricEntry);
  }

  /**
   * Correlate a log entry with traces and metrics
   */
  async correlateLog(logEntry: LogEntry): Promise<CorrelationResult> {
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedCorrelation(logEntry.id);
      if (cached) {
        this.performanceMetrics.totalCacheHits++;
        this.updateCacheHitRate();
        return cached;
      }
      this.performanceMetrics.totalCacheMisses++;
    }

    const result = await this.performCorrelation(logEntry);
    
    const correlationDuration = Date.now() - startTime;
    result.metadata.correlationDuration = correlationDuration;
    result.correlatedAt = Date.now();

    // Update performance metrics
    this.performanceMetrics.correlationsPerformed++;
    this.performanceMetrics.averageCorrelationTime = 
      (this.performanceMetrics.averageCorrelationTime + correlationDuration) / 2;

    // Cache result
    if (this.config.enableCaching) {
      this.cacheCorrelation(logEntry.id, result);
    }

    this.emit('correlationCompleted', result);
    
    return result;
  }

  /**
   * Correlate multiple log entries in batch
   */
  async correlateLogsBatch(logEntries: LogEntry[]): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];
    
    // Process in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < logEntries.length; i += concurrency) {
      const batch = logEntries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(logEntry => this.correlateLog(logEntry))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Find correlations by trace ID
   */
  async findByTraceId(traceId: string): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];
    
    // Find all logs with this trace ID
    for (const [, logEntry] of this.logEntries) {
      if (logEntry.traceContext?.traceId === traceId) {
        const correlation = await this.correlateLog(logEntry);
        results.push(correlation);
      }
    }

    return results;
  }

  /**
   * Find correlations in time range
   */
  async findInTimeRange(
    startTime: number, 
    endTime: number
  ): Promise<CorrelationResult[]> {
    // Find all logs in time range
    const logsInRange: LogEntry[] = [];
    for (const [, logEntry] of this.logEntries) {
      if (logEntry.timestamp >= startTime && logEntry.timestamp <= endTime) {
        logsInRange.push(logEntry);
      }
    }

    // Correlate all logs in batch
    return this.correlateLogsBatch(logsInRange);
  }

  /**
   * Get correlation statistics
   */
  getStatistics(): {
    totalLogs: number;
    totalTraces: number;
    totalMetrics: number;
    correlationsPerformed: number;
    averageCorrelationTime: number;
    cacheHitRate: number;
    memoryUsage: {
      logs: number;
      traces: number;
      metrics: number;
      cache: number;
    };
  } {
    return {
      totalLogs: this.logEntries.size,
      totalTraces: this.traceEntries.size,
      totalMetrics: this.metricEntries.size,
      correlationsPerformed: this.performanceMetrics.correlationsPerformed,
      averageCorrelationTime: this.performanceMetrics.averageCorrelationTime,
      cacheHitRate: this.performanceMetrics.cacheHitRate,
      memoryUsage: {
        logs: this.estimateMapSize(this.logEntries),
        traces: this.estimateMapSize(this.traceEntries),
        metrics: this.estimateMapSize(this.metricEntries),
        cache: this.estimateMapSize(this.correlationCache)
      }
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.logEntries.clear();
    this.traceEntries.clear();
    this.metricEntries.clear();
    this.timeIndex.clear();
    this.correlationCache.clear();
    
    // Reset metrics
    this.performanceMetrics = {
      correlationsPerformed: 0,
      averageCorrelationTime: 0,
      cacheHitRate: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0
    };

    this.emit('cleared');
  }

  // Private methods
  private async performCorrelation(logEntry: LogEntry): Promise<CorrelationResult> {
    const strategies: CorrelationStrategy[] = [
      'trace_id',
      'time_window', 
      'metadata_match',
      'pattern_match'
    ];

    let bestResult: CorrelationResult | null = null;
    let bestConfidence = 0;
    let itemsChecked = 0;

    for (const strategy of strategies) {
      const result = await this.correlateWithStrategy(logEntry, strategy);
      itemsChecked += result.metadata.itemsChecked;
      
      if (result.confidence > bestConfidence) {
        bestResult = result;
        bestConfidence = result.confidence;
      }

      // If we have high confidence, no need to try other strategies
      if (result.confidence > 0.9) {
        break;
      }
    }

    if (!bestResult) {
      // Create empty result
      bestResult = {
        logEntry,
        traces: [],
        metrics: [],
        relatedLogs: [],
        confidence: 0,
        correlatedAt: Date.now(),
        metadata: {
          correlationDuration: 0,
          itemsChecked: 0,
          strategy: 'time_window'
        }
      };
    }

    bestResult.metadata.itemsChecked = itemsChecked;
    return bestResult;
  }

  private async correlateWithStrategy(
    logEntry: LogEntry,
    strategy: CorrelationStrategy
  ): Promise<CorrelationResult> {
    switch (strategy) {
      case 'trace_id':
        return this.correlateByTraceId(logEntry);
      case 'time_window':
        return this.correlateByTimeWindow(logEntry);
      case 'metadata_match':
        return this.correlateByMetadata(logEntry);
      case 'pattern_match':
        return this.correlateByPattern(logEntry);
      default:
        throw new Error(`Unknown correlation strategy: ${strategy}`);
    }
  }

  private correlateByTraceId(logEntry: LogEntry): CorrelationResult {
    const traces: TraceEntry[] = [];
    const metrics: MetricEntry[] = [];
    const relatedLogs: LogEntry[] = [];
    let itemsChecked = 0;

    if (logEntry.traceContext?.traceId) {
      const traceId = logEntry.traceContext.traceId;
      
      // Find traces with same trace ID
      for (const [, traceEntry] of this.traceEntries) {
        itemsChecked++;
        if (traceEntry.traceId === traceId) {
          traces.push(traceEntry);
        }
      }

      // Find related logs with same trace ID
      for (const [, otherLog] of this.logEntries) {
        itemsChecked++;
        if (otherLog.id !== logEntry.id && 
            otherLog.traceContext?.traceId === traceId) {
          relatedLogs.push(otherLog);
        }
      }
    }

    return {
      logEntry,
      traces,
      metrics,
      relatedLogs,
      confidence: traces.length > 0 ? 0.95 : 0,
      correlatedAt: Date.now(),
      metadata: {
        correlationDuration: 0,
        itemsChecked,
        strategy: 'trace_id'
      }
    };
  }

  private correlateByTimeWindow(logEntry: LogEntry): CorrelationResult {
    const traces: TraceEntry[] = [];
    const metrics: MetricEntry[] = [];
    const relatedLogs: LogEntry[] = [];
    const startTime = logEntry.timestamp - this.config.correlationWindow;
    const endTime = logEntry.timestamp + this.config.correlationWindow;
    let itemsChecked = 0;

    // Use time index for efficient lookup
    const relevantBuckets = this.getRelevantTimeBuckets(startTime, endTime);
    
    for (const bucket of relevantBuckets) {
      const timeIndex = this.timeIndex.get(bucket);
      if (!timeIndex) continue;

      for (const entry of timeIndex.entries) {
        itemsChecked++;
        
        if (entry.timestamp >= startTime && entry.timestamp <= endTime) {
          switch (entry.type) {
            case 'trace':
              const trace = this.traceEntries.get(entry.id);
              if (trace) traces.push(trace);
              break;
            case 'metric':
              const metric = this.metricEntries.get(entry.id);
              if (metric) metrics.push(metric);
              break;
            case 'log':
              if (entry.id !== logEntry.id) {
                const log = this.logEntries.get(entry.id);
                if (log) relatedLogs.push(log);
              }
              break;
          }
        }
      }
    }

    const totalCorrelations = traces.length + metrics.length + relatedLogs.length;
    const confidence = Math.min(0.8, totalCorrelations * 0.1);

    return {
      logEntry,
      traces,
      metrics,
      relatedLogs,
      confidence,
      correlatedAt: Date.now(),
      metadata: {
        correlationDuration: 0,
        itemsChecked,
        strategy: 'time_window'
      }
    };
  }

  private correlateByMetadata(logEntry: LogEntry): CorrelationResult {
    const traces: TraceEntry[] = [];
    const metrics: MetricEntry[] = [];
    const relatedLogs: LogEntry[] = [];
    let itemsChecked = 0;

    if (!logEntry.metadata && !logEntry.tags) {
      return {
        logEntry,
        traces,
        metrics,
        relatedLogs,
        confidence: 0,
        correlatedAt: Date.now(),
        metadata: {
          correlationDuration: 0,
          itemsChecked,
          strategy: 'metadata_match'
        }
      };
    }

    // Find matching traces by tags
    for (const [, traceEntry] of this.traceEntries) {
      itemsChecked++;
      if (this.hasMatchingTags(logEntry.tags, traceEntry.tags)) {
        traces.push(traceEntry);
      }
    }

    // Find matching metrics by tags
    for (const [, metricEntry] of this.metricEntries) {
      itemsChecked++;
      if (this.hasMatchingTags(logEntry.tags, metricEntry.tags)) {
        metrics.push(metricEntry);
      }
    }

    const matchCount = traces.length + metrics.length;
    const confidence = Math.min(0.7, matchCount * 0.15);

    return {
      logEntry,
      traces,
      metrics,
      relatedLogs,
      confidence,
      correlatedAt: Date.now(),
      metadata: {
        correlationDuration: 0,
        itemsChecked,
        strategy: 'metadata_match'
      }
    };
  }

  private correlateByPattern(logEntry: LogEntry): CorrelationResult {
    const traces: TraceEntry[] = [];
    const metrics: MetricEntry[] = [];
    const relatedLogs: LogEntry[] = [];
    let itemsChecked = 0;

    // Extract patterns from log message
    const patterns = this.extractPatterns(logEntry.message);
    
    if (patterns.length === 0) {
      return {
        logEntry,
        traces,
        metrics,
        relatedLogs,
        confidence: 0,
        correlatedAt: Date.now(),
        metadata: {
          correlationDuration: 0,
          itemsChecked,
          strategy: 'pattern_match'
        }
      };
    }

    // Find related logs with similar patterns
    for (const [, otherLog] of this.logEntries) {
      itemsChecked++;
      if (otherLog.id !== logEntry.id) {
        const otherPatterns = this.extractPatterns(otherLog.message);
        const similarity = this.calculatePatternSimilarity(patterns, otherPatterns);
        
        if (similarity > 0.6) {
          relatedLogs.push(otherLog);
        }
      }
    }

    const confidence = Math.min(0.6, relatedLogs.length * 0.1);

    return {
      logEntry,
      traces,
      metrics,
      relatedLogs,
      confidence,
      correlatedAt: Date.now(),
      metadata: {
        correlationDuration: 0,
        itemsChecked,
        strategy: 'pattern_match'
      }
    };
  }

  private addToTimeIndex(id: string, timestamp: number, type: 'log' | 'trace' | 'metric'): void {
    // Round timestamp to bucket (e.g., 1-second buckets)
    const bucket = Math.floor(timestamp / 1000) * 1000;
    
    let timeIndex = this.timeIndex.get(bucket);
    if (!timeIndex) {
      timeIndex = { bucket, entries: [] };
      this.timeIndex.set(bucket, timeIndex);
    }

    timeIndex.entries.push({ id, timestamp, type });

    // Limit index size
    if (timeIndex.entries.length > this.config.indexSize) {
      timeIndex.entries = timeIndex.entries.slice(-this.config.indexSize);
    }
  }

  private getRelevantTimeBuckets(startTime: number, endTime: number): number[] {
    const buckets: number[] = [];
    const startBucket = Math.floor(startTime / 1000) * 1000;
    const endBucket = Math.floor(endTime / 1000) * 1000;
    
    for (let bucket = startBucket; bucket <= endBucket; bucket += 1000) {
      if (this.timeIndex.has(bucket)) {
        buckets.push(bucket);
      }
    }
    
    return buckets;
  }

  private getCachedCorrelation(logId: string): CorrelationResult | null {
    const cached = this.correlationCache.get(logId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.correlationCache.delete(logId);
      return null;
    }
    
    return cached.result;
  }

  private cacheCorrelation(logId: string, result: CorrelationResult): void {
    const cached: CorrelationCache = {
      key: logId,
      result,
      timestamp: Date.now(),
      ttl: this.config.cacheTtl
    };
    
    this.correlationCache.set(logId, cached);
    
    // Limit cache size
    if (this.correlationCache.size > this.config.maxCorrelations) {
      const oldest = Array.from(this.correlationCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.correlationCache.delete(oldest[0]);
    }
  }

  private hasMatchingTags(
    tags1?: Record<string, string>, 
    tags2?: Record<string, string>
  ): boolean {
    if (!tags1 || !tags2) return false;
    
    const keys1 = Object.keys(tags1);
    const keys2 = Object.keys(tags2);
    
    const commonKeys = keys1.filter(key => keys2.includes(key));
    if (commonKeys.length === 0) return false;
    
    return commonKeys.some(key => tags1[key] === tags2[key]);
  }

  private extractPatterns(message: string): string[] {
    const patterns: string[] = [];
    
    // Extract common patterns
    const regexes = [
      /\b\d+\b/g, // Numbers
      /\b[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\b/gi, // UUIDs
      /\b\w+Error\b/g, // Error types
      /\b\w+Exception\b/g, // Exception types
      /\b(GET|POST|PUT|DELETE|PATCH)\b/g, // HTTP methods
      /\b\d{3}\b/g // HTTP status codes
    ];
    
    regexes.forEach(regex => {
      const matches = message.match(regex);
      if (matches) {
        patterns.push(...matches);
      }
    });
    
    return patterns;
  }

  private calculatePatternSimilarity(patterns1: string[], patterns2: string[]): number {
    if (patterns1.length === 0 && patterns2.length === 0) return 1;
    if (patterns1.length === 0 || patterns2.length === 0) return 0;
    
    const set1 = new Set(patterns1);
    const set2 = new Set(patterns2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private updateCacheHitRate(): void {
    const total = this.performanceMetrics.totalCacheHits + this.performanceMetrics.totalCacheMisses;
    this.performanceMetrics.cacheHitRate = 
      total > 0 ? this.performanceMetrics.totalCacheHits / total : 0;
  }

  private estimateMapSize(map: Map<string, any>): number {
    // Rough estimation of memory usage
    return map.size * 1000; // Assume 1KB per entry on average
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldData();
      this.cleanupExpiredCache();
    }, 60000); // Cleanup every minute
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
    
    // Cleanup logs
    for (const [id, logEntry] of this.logEntries) {
      if (logEntry.timestamp < cutoff) {
        this.logEntries.delete(id);
      }
    }
    
    // Cleanup traces
    for (const [id, traceEntry] of this.traceEntries) {
      if (traceEntry.startTime < cutoff) {
        this.traceEntries.delete(id);
      }
    }
    
    // Cleanup metrics
    for (const [id, metricEntry] of this.metricEntries) {
      if (metricEntry.timestamp < cutoff) {
        this.metricEntries.delete(id);
      }
    }
    
    // Cleanup time index
    for (const [bucket] of this.timeIndex) {
      if (bucket < cutoff) {
        this.timeIndex.delete(bucket);
      }
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.correlationCache) {
      if (now - cached.timestamp > cached.ttl) {
        this.correlationCache.delete(key);
      }
    }
  }
}

export default LogCorrelation;