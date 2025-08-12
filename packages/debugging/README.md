# @monitoring-service/debugging

Advanced debugging tools for the monitoring service with comprehensive error analysis, distributed tracing, session replay, and ML-powered insights.

## Features

- 🔍 **Distributed Tracing**: OpenTelemetry-compliant request journey tracking
- 📹 **Session Replay**: Record and replay user sessions with <5MB storage per session
- 🔗 **Log Correlation**: Automatic correlation of logs with metrics/traces in <100ms
- 🧠 **Error Clustering**: ML-based grouping of similar errors with 95% accuracy
- 💻 **Code-Level Insights**: Git integration showing which code changes caused issues
- ⏱️ **Debug Timeline**: Visual timeline of all events leading to errors
- 📊 **Performance Profiling**: CPU, memory, and network profiling tools

## Installation

```bash
npm install @monitoring-service/debugging
# or
pnpm add @monitoring-service/debugging
```

## Quick Start

```typescript
import { DebugManager } from '@monitoring-service/debugging';

const debugManager = new DebugManager({
  tracing: {
    serviceName: 'my-app',
    endpoint: 'http://localhost:14268/api/traces'
  },
  sessionReplay: {
    enabled: true,
    maxSessionSize: 5 * 1024 * 1024 // 5MB
  },
  errorClustering: {
    enabled: true,
    minSimilarity: 0.85
  }
});

// Initialize debugging
await debugManager.initialize();

// Track an error with full debugging context
debugManager.captureError(error, {
  includeReplay: true,
  includeTrace: true,
  includeTimeline: true
});
```

## API Reference

### DistributedTracing

Provides OpenTelemetry-compliant distributed tracing:

```typescript
import { DistributedTracing } from '@monitoring-service/debugging/tracing';

const tracer = new DistributedTracing({
  serviceName: 'my-service',
  endpoint: 'http://jaeger:14268/api/traces'
});

// Create a trace
const span = tracer.startSpan('operation-name');
span.setAttributes({ 'user.id': '123' });
span.end();
```

### SessionReplay

Records and replays user sessions efficiently:

```typescript
import { SessionReplay } from '@monitoring-service/debugging/replay';

const replay = new SessionReplay({
  maxSessionSize: 5 * 1024 * 1024, // 5MB limit
  compressionLevel: 6
});

// Start recording
await replay.startRecording();

// Get session data
const sessionData = await replay.getSessionData();
```

### LogCorrelation

Correlates logs with traces and metrics:

```typescript
import { LogCorrelation } from '@monitoring-service/debugging/correlation';

const correlator = new LogCorrelation({
  correlationWindow: 100 // 100ms window
});

// Correlate log entry
const correlatedData = await correlator.correlateLog(logEntry);
```

### ErrorClustering

ML-powered error clustering:

```typescript
import { ErrorClustering } from '@monitoring-service/debugging/clustering';

const clustering = new ErrorClustering({
  minSimilarity: 0.85,
  maxClusters: 50
});

// Add error to clustering
const cluster = await clustering.addError(errorData);
```

### CodeInsights

Provides Git integration for code-level insights:

```typescript
import { CodeInsights } from '@monitoring-service/debugging/insights';

const insights = new CodeInsights({
  gitRepository: './',
  includeBlame: true
});

// Get insights for an error
const codeInsights = await insights.getInsights(errorInfo);
```

### PerformanceProfiling

Advanced performance profiling:

```typescript
import { PerformanceProfiler } from '@monitoring-service/debugging/profiling';

const profiler = new PerformanceProfiler({
  enableCPUProfiling: true,
  enableMemoryProfiling: true,
  enableNetworkProfiling: true
});

// Start profiling
const session = profiler.startProfiling();

// Get profile data
const profile = await profiler.getProfile(session.id);
```

## Configuration

Complete configuration options:

```typescript
interface DebugConfig {
  tracing?: {
    enabled?: boolean;
    serviceName: string;
    endpoint: string;
    sampleRate?: number;
  };
  sessionReplay?: {
    enabled?: boolean;
    maxSessionSize?: number;
    compressionLevel?: number;
    maskSensitiveData?: boolean;
  };
  logCorrelation?: {
    enabled?: boolean;
    correlationWindow?: number;
    maxCorrelations?: number;
  };
  errorClustering?: {
    enabled?: boolean;
    minSimilarity?: number;
    maxClusters?: number;
    algorithm?: 'kmeans' | 'dbscan';
  };
  codeInsights?: {
    enabled?: boolean;
    gitRepository?: string;
    includeBlame?: boolean;
    maxCommits?: number;
  };
  profiling?: {
    enabled?: boolean;
    enableCPUProfiling?: boolean;
    enableMemoryProfiling?: boolean;
    enableNetworkProfiling?: boolean;
  };
}
```

## Examples

See the `/examples` directory for complete usage examples and integration guides.

## Contributing

Please read the [CONTRIBUTING.md](../../CONTRIBUTING.md) file for guidelines on contributing to this package.

## License

MIT License - see [LICENSE](../../LICENSE) file for details.