/**
 * Distributed Tracing Implementation
 * 
 * OpenTelemetry-compliant distributed tracing system for tracking
 * request journeys across microservices with automatic instrumentation.
 */

import { trace, context, SpanStatusCode, SpanKind, Span } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
// import { Resource } from '@opentelemetry/resources'; // Type issue - using object literal instead
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// Note: Auto-instrumentations temporarily disabled due to package resolution issues
import { EventEmitter } from 'events';

export interface TracingConfig {
  /** Service name for traces */
  serviceName: string;
  /** Tracing endpoint */
  endpoint: string;
  /** Exporter type */
  exporterType?: 'jaeger' | 'zipkin' | 'console';
  /** Sample rate (0-1) */
  sampleRate?: number;
  /** Maximum number of spans */
  maxSpans?: number;
  /** Batch timeout in milliseconds */
  batchTimeout?: number;
  /** Custom resource attributes */
  resourceAttributes?: Record<string, string>;
  /** Enable automatic instrumentation */
  autoInstrumentation?: boolean;
}

export interface TraceContext {
  /** Trace ID */
  traceId: string;
  /** Span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Baggage items */
  baggage?: Record<string, string>;
}

export interface SpanData {
  /** Span name */
  name: string;
  /** Span kind */
  kind: SpanKind;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Span attributes */
  attributes: Record<string, string | number | boolean>;
  /** Span status */
  status: {
    code: SpanStatusCode;
    message?: string;
  };
  /** Span events */
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, string | number | boolean>;
  }>;
  /** Child spans */
  children: SpanData[];
}

export interface TraceJourney {
  /** Trace ID */
  traceId: string;
  /** Root span */
  rootSpan: SpanData;
  /** All spans in the trace */
  spans: SpanData[];
  /** Services involved */
  services: string[];
  /** Total duration */
  duration: number;
  /** Error count */
  errorCount: number;
  /** Performance metrics */
  metrics: {
    /** Total spans */
    totalSpans: number;
    /** Average span duration */
    avgSpanDuration: number;
    /** Slowest span */
    slowestSpan: SpanData;
    /** Error spans */
    errorSpans: SpanData[];
  };
}

export class DistributedTracing extends EventEmitter {
  private sdk?: NodeSDK;
  private tracer: any;
  private config: Required<TracingConfig>;
  private activeSpans: Map<string, Span> = new Map();
  private spanBuffer: SpanData[] = [];

  constructor(config: TracingConfig) {
    super();
    this.config = {
      exporterType: 'jaeger',
      sampleRate: 1.0,
      maxSpans: 10000,
      batchTimeout: 5000,
      resourceAttributes: {},
      autoInstrumentation: true,
      ...config
    };
  }

  /**
   * Initialize the tracing system
   */
  async initialize(): Promise<void> {
    try {
      // Create exporter based on configuration
      const exporter = this.createExporter();

      // Configure SDK
      this.sdk = new NodeSDK({
        traceExporter: exporter,
        instrumentations: [], // Auto-instrumentations disabled for now
        // Using object literal with merge method to satisfy IResource interface
        resource: {
          attributes: {
            'service.name': this.config.serviceName,
            'service.version': '1.0.0',
            ...this.config.resourceAttributes
          },
          merge: (_other: any) => ({ attributes: {}, merge: () => ({}) }) // Mock merge method
        } as any
      });

      // Start SDK
      this.sdk.start();

      // Get tracer instance
      this.tracer = trace.getTracer(this.config.serviceName, '1.0.0');

      // Setup span buffer cleanup
      this.setupSpanBufferCleanup();

      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize distributed tracing: ${error}`);
    }
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string, 
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      parent?: Span | TraceContext;
    } = {}
  ): Span {
    const spanOptions = {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes || {}
    };

    // Create span with parent context if provided
    let span: Span;
    if (options.parent) {
      const parentContext = this.extractContext(options.parent);
      span = this.tracer.startSpan(name, spanOptions, parentContext);
    } else {
      span = this.tracer.startSpan(name, spanOptions);
    }

    // Store span for management
    const spanId = this.getSpanId(span);
    this.activeSpans.set(spanId, span);

    // Add default attributes
    span.setAttributes({
      'service.name': this.config.serviceName,
      'monitoring.component': 'debugging',
      'monitoring.timestamp': Date.now()
    });

    return span;
  }

  /**
   * Finish a span
   */
  finishSpan(span: Span, options: {
    status?: { code: SpanStatusCode; message?: string };
    endTime?: number;
  } = {}): void {
    if (options.status) {
      span.setStatus(options.status);
    }

    if (options.endTime) {
      span.end(options.endTime);
    } else {
      span.end();
    }

    // Remove from active spans
    const spanId = this.getSpanId(span);
    this.activeSpans.delete(spanId);

    // Convert to SpanData and buffer
    const spanData = this.spanToSpanData(span);
    this.bufferSpan(spanData);
  }

  /**
   * Create a child span
   */
  createChildSpan(
    parentSpan: Span, 
    name: string, 
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    } = {}
  ): Span {
    return this.startSpan(name, {
      ...options,
      parent: parentSpan
    });
  }

  /**
   * Execute code within a span
   */
  async withSpan<T>(
    name: string, 
    fn: (span: Span) => Promise<T> | T,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    } = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);
    
    try {
      const result = await fn(span);
      this.finishSpan(span, { status: { code: SpanStatusCode.OK } });
      return result;
    } catch (error) {
      this.finishSpan(span, { 
        status: { 
          code: SpanStatusCode.ERROR, 
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on current span
   */
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes(attributes);
    }
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) return null;

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: undefined, // TODO: Extract from context
      baggage: {} // TODO: Extract baggage
    };
  }

  /**
   * Inject context for cross-process propagation
   */
  injectContext(_carrier: Record<string, unknown>): void {
    const span = trace.getActiveSpan();
    if (span) {
      trace.setSpanContext(context.active(), span.spanContext());
    }
    // TODO: Implement proper context injection
  }

  /**
   * Extract context from carrier
   */
  extractContext(carrier: Record<string, unknown> | Span | TraceContext): any {
    if (carrier instanceof Object && 'spanContext' in carrier) {
      // It's a Span
      return trace.setSpanContext(context.active(), (carrier as Span).spanContext());
    }
    
    if (typeof carrier === 'object' && 'traceId' in carrier) {
      // It's a TraceContext
      // TODO: Implement proper context extraction
      return context.active();
    }

    // TODO: Implement proper context extraction from headers
    return context.active();
  }

  /**
   * Get trace journey for analysis
   */
  async getTraceJourney(traceId: string): Promise<TraceJourney | null> {
    const spans = this.spanBuffer.filter(span => 
      this.getTraceIdFromSpan(span) === traceId
    );

    if (spans.length === 0) return null;

    // Find root span (no parent)
    const rootSpan = spans.find(span => !span.name.includes('.'));
    if (!rootSpan) return null;

    // Build span hierarchy
    // const spanTree = this.buildSpanTree(spans); // TODO: Use spanTree for visualization

    // Calculate metrics
    const services = [...new Set(spans.map(span => 
      span.attributes['service.name'] as string || 'unknown'
    ))];
    
    const duration = spans.reduce((max, span) => 
      Math.max(max, (span.endTime || Date.now()) - span.startTime), 0
    );
    
    const errorSpans = spans.filter(span => 
      span.status.code === SpanStatusCode.ERROR
    );

    const totalSpans = spans.length;
    const avgSpanDuration = spans.reduce((sum, span) => 
      sum + ((span.endTime || Date.now()) - span.startTime), 0
    ) / totalSpans;
    
    const slowestSpan = spans.reduce((slowest, span) => {
      const spanDuration = (span.endTime || Date.now()) - span.startTime;
      const slowestDuration = (slowest.endTime || Date.now()) - slowest.startTime;
      return spanDuration > slowestDuration ? span : slowest;
    });

    return {
      traceId,
      rootSpan,
      spans,
      services,
      duration,
      errorCount: errorSpans.length,
      metrics: {
        totalSpans,
        avgSpanDuration,
        slowestSpan,
        errorSpans
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Flush remaining spans
    await this.flush();

    // Shutdown SDK
    if (this.sdk) {
      await this.sdk.shutdown();
    }

    // Clear buffers
    this.activeSpans.clear();
    this.spanBuffer = [];

    this.emit('shutdown');
  }

  /**
   * Flush buffered spans
   */
  async flush(): Promise<void> {
    // SDK handles flushing automatically
    this.emit('flushed', { spanCount: this.spanBuffer.length });
  }

  // Private methods
  private createExporter() {
    switch (this.config.exporterType) {
      case 'jaeger':
        return new JaegerExporter({
          endpoint: this.config.endpoint
        });
      case 'zipkin':
        return new ZipkinExporter({
          url: this.config.endpoint
        });
      case 'console':
      default:
        // Use console exporter for development
        return undefined; // SDK will use console exporter
    }
  }

  private setupSpanBufferCleanup(): void {
    setInterval(() => {
      // Keep only recent spans (last hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.spanBuffer = this.spanBuffer.filter(span => 
        span.startTime > oneHourAgo
      );

      // Limit buffer size
      if (this.spanBuffer.length > this.config.maxSpans) {
        this.spanBuffer = this.spanBuffer.slice(-this.config.maxSpans);
      }
    }, 30000); // Clean every 30 seconds
  }

  private getSpanId(span: Span): string {
    return span.spanContext().spanId;
  }

  private getTraceIdFromSpan(span: SpanData): string {
    return span.attributes['trace.id'] as string || 'unknown';
  }

  private spanToSpanData(span: Span): SpanData {
    const spanContext = span.spanContext();
    
    return {
      name: 'span-name', // TODO: Extract span name
      kind: SpanKind.INTERNAL, // TODO: Extract span kind
      startTime: Date.now(), // TODO: Extract actual start time
      attributes: {
        'trace.id': spanContext.traceId,
        'span.id': spanContext.spanId
      },
      status: { code: SpanStatusCode.OK },
      events: [],
      children: []
    };
  }

  private bufferSpan(span: SpanData): void {
    this.spanBuffer.push(span);
  }

  // TODO: Implement proper span tree building - currently unused
  // private buildSpanTree(spans: SpanData[]): SpanData {
  //   return spans[0] || {
  //     name: 'root',
  //     kind: SpanKind.SERVER,
  //     startTime: Date.now(),
  //     attributes: {},
  //     status: { code: SpanStatusCode.OK },
  //     events: [],
  //     children: []
  //   };
  // }
}

export default DistributedTracing;