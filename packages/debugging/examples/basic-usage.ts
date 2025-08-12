/**
 * Basic Usage Examples for Debugging Package
 */

import { 
  DebugManager, 
  DistributedTracing, 
  SessionReplay, 
  ErrorClustering, 
  LogCorrelation,
  CodeInsights,
  PerformanceProfiler
} from '@monitoring-service/debugging';
import type { ErrorData } from '@monitoring-service/debugging';

// Example 1: Complete Debug Manager Setup
async function setupCompleteDebugging() {
  const debugManager = new DebugManager({
    tracing: {
      serviceName: 'my-app',
      endpoint: 'http://localhost:14268/api/traces',
      sampleRate: 1.0
    },
    sessionReplay: {
      enabled: true,
      maxSessionSize: 5 * 1024 * 1024, // 5MB
      maskSensitiveData: true
    },
    errorClustering: {
      enabled: true,
      minSimilarity: 0.85,
      algorithm: 'adaptive'
    },
    codeInsights: {
      enabled: true,
      gitRepository: './',
      includeBlame: true
    },
    profiling: {
      enabled: true,
      enableCPUProfiling: true,
      enableMemoryProfiling: true
    }
  });

  await debugManager.initialize();
  
  return debugManager;
}

// Example 2: Capturing and Debugging an Error
async function captureAndDebugError() {
  const debugManager = await setupCompleteDebugging();

  try {
    // Simulate an error
    throw new Error('Payment processing failed: Invalid credit card');
  } catch (error) {
    // Capture error with full debugging context
    const debugSession = await debugManager.captureError(error, {
      includeReplay: true,
      includeTrace: true,
      includeTimeline: true,
      includePerformance: true
    });

    console.log('Debug Session Created:', debugSession.sessionId);
    console.log('Error Cluster:', debugSession.cluster?.id);
    console.log('Code Insights:', debugSession.codeInsights?.suggestions.length, 'suggestions');
    
    return debugSession;
  } finally {
    await debugManager.shutdown();
  }
}

// Example 3: Individual Component Usage - Distributed Tracing
async function distributedTracingExample() {
  const tracing = new DistributedTracing({
    serviceName: 'payment-service',
    endpoint: 'http://localhost:14268/api/traces'
  });

  await tracing.initialize();

  // Start a trace
  const result = await tracing.withSpan('process-payment', async (span) => {
    span.setAttributes({
      'payment.amount': 99.99,
      'payment.currency': 'USD',
      'user.id': 'user123'
    });

    // Simulate payment processing
    await processPayment('user123', 99.99);
    
    // Add events
    tracing.addEvent('payment-validated');
    tracing.addEvent('charge-attempted');
    
    return { success: true, transactionId: 'txn_123' };
  });

  console.log('Payment processed:', result);
  
  await tracing.shutdown();
}

async function processPayment(userId: string, amount: number) {
  // Simulate async payment processing
  await new Promise(resolve => setTimeout(resolve, 100));
  return true;
}

// Example 4: Session Replay Usage
async function sessionReplayExample() {
  const replay = new SessionReplay({
    maxSessionSize: 2 * 1024 * 1024, // 2MB
    maskSensitiveData: true,
    sampleRate: 1.0
  });

  // Start recording
  const sessionId = await replay.startRecording();
  console.log('Recording started:', sessionId);

  // Simulate user interactions (would normally come from DOM events)
  replay.emit('eventRecorded', {
    type: 'mouse_click',
    timestamp: Date.now(),
    data: { clientX: 100, clientY: 200, target: 'button#submit' }
  });

  replay.emit('eventRecorded', {
    type: 'input',
    timestamp: Date.now(),
    data: { value: '[MASKED]', target: 'input[type="password"]' }
  });

  // Stop recording after some time
  setTimeout(async () => {
    const sessionData = await replay.stopRecording();
    console.log('Session recorded:', sessionData.events.length, 'events');
    console.log('Compressed size:', sessionData.compressedSize, 'bytes');
    
    // Replay the session
    await replay.replaySession(sessionData, {
      speed: 2.0, // 2x speed
      skipEvents: ['mouse_move'] // Skip mouse movements
    });
  }, 5000);
}

// Example 5: Error Clustering
async function errorClusteringExample() {
  const clustering = new ErrorClustering({
    minSimilarity: 0.8,
    maxClusters: 20,
    algorithm: 'adaptive'
  });

  // Add similar errors
  const errors: ErrorData[] = [
    {
      id: 'err1',
      message: 'Cannot read property "name" of undefined',
      type: 'TypeError',
      timestamp: Date.now(),
      filename: 'user.js',
      lineno: 42
    },
    {
      id: 'err2', 
      message: 'Cannot read property "email" of undefined',
      type: 'TypeError',
      timestamp: Date.now(),
      filename: 'user.js',
      lineno: 45
    },
    {
      id: 'err3',
      message: 'Network request failed: timeout',
      type: 'NetworkError',
      timestamp: Date.now(),
      filename: 'api.js',
      lineno: 10
    }
  ];

  for (const error of errors) {
    const cluster = await clustering.addError(error);
    console.log(`Error ${error.id} added to cluster ${cluster.id}`);
  }

  // Get clustering statistics
  const stats = clustering.getStatistics();
  console.log('Clustering stats:', {
    totalClusters: stats.totalClusters,
    totalErrors: stats.totalErrors,
    accuracyEstimate: `${(stats.accuracyEstimate * 100).toFixed(1)}%`
  });

  // Get top clusters
  const topClusters = clustering.getClusters({
    sortBy: 'count',
    limit: 5
  });

  topClusters.forEach(cluster => {
    console.log(`Cluster ${cluster.id}:`, {
      errorCount: cluster.stats.count,
      representative: cluster.representative.message,
      confidence: `${(cluster.confidence * 100).toFixed(1)}%`
    });
  });
}

// Example 6: Log Correlation
async function logCorrelationExample() {
  const correlator = new LogCorrelation({
    correlationWindow: 1000, // 1 second window
    enableCaching: true
  });

  const timestamp = Date.now();
  
  // Add related events within time window
  correlator.addLogEntry({
    id: 'log1',
    timestamp: timestamp,
    level: 'error',
    message: 'Payment processing failed',
    traceContext: { traceId: 'trace123', spanId: 'span1' }
  });

  correlator.addTraceEntry({
    traceId: 'trace123',
    spanId: 'span1',
    operationName: 'process-payment',
    startTime: timestamp - 100,
    endTime: timestamp + 50,
    status: 'error'
  });

  correlator.addMetricEntry({
    name: 'payment.errors',
    timestamp: timestamp + 10,
    value: 1,
    type: 'counter'
  });

  // Correlate the log
  const logEntry = {
    id: 'log1',
    timestamp: timestamp,
    level: 'error' as const,
    message: 'Payment processing failed'
  };

  const result = await correlator.correlateLog(logEntry);
  
  console.log('Correlation result:', {
    confidence: `${(result.confidence * 100).toFixed(1)}%`,
    tracesFound: result.traces.length,
    metricsFound: result.metrics.length,
    correlationTime: `${result.metadata.correlationDuration}ms`
  });
}

// Example 7: Code Insights
async function codeInsightsExample() {
  const insights = new CodeInsights({
    gitRepository: './',
    includeBlame: true,
    maxCommits: 50
  });

  const errorData: ErrorData = {
    id: 'error1',
    message: 'TypeError: Cannot read property of undefined',
    type: 'TypeError',
    timestamp: Date.now(),
    filename: 'src/payment/processor.js',
    lineno: 127,
    colno: 15
  };

  const codeInsights = await insights.getInsights(errorData);
  
  console.log('Code insights:', {
    relatedCommits: codeInsights.relatedCommits.length,
    riskScore: `${(codeInsights.riskAssessment.overallRisk * 100).toFixed(1)}%`,
    suggestions: codeInsights.suggestions.length,
    recentChanges: codeInsights.recentChanges.length
  });

  // Show risk factors
  codeInsights.riskAssessment.factors.forEach(factor => {
    console.log(`Risk factor: ${factor.name} (${(factor.score * 100).toFixed(1)}%) - ${factor.description}`);
  });

  // Show suggestions
  codeInsights.suggestions.forEach((suggestion, index) => {
    console.log(`Suggestion ${index + 1} (Priority ${suggestion.priority}): ${suggestion.text}`);
  });

  // Get code hotspots
  const hotspots = insights.getHotspots({
    minScore: 0.3,
    limit: 5
  });

  console.log('\nCode hotspots:');
  hotspots.forEach(hotspot => {
    console.log(`${hotspot.file} (Score: ${(hotspot.score * 100).toFixed(1)}%)`, {
      errors: hotspot.errorCount,
      commits: hotspot.commitCount,
      authors: hotspot.authors.length
    });
  });
}

// Example 8: Performance Profiling
async function performanceProfilingExample() {
  const profiler = new PerformanceProfiler({
    enableCPUProfiling: true,
    enableMemoryProfiling: true,
    samplingInterval: 10 // 10ms sampling
  });

  // Start profiling
  const session = profiler.startProfiling('performance-test');
  console.log('Profiling started:', session.id);

  // Simulate CPU-intensive work
  await simulateCPUWork();

  // Simulate memory-intensive work
  await simulateMemoryWork();

  // Stop profiling and get results
  const profile = await profiler.stopProfiling(session.id);
  
  console.log('Performance profile:', {
    sessionDuration: profile.session.endTime! - profile.session.startTime,
    cpuSamples: profile.cpuProfile?.samples.length,
    memorySamples: profile.memoryProfile?.snapshots.length,
    bottlenecks: profile.bottlenecks.length
  });

  // Show CPU hotspots
  if (profile.cpuProfile) {
    console.log('\nCPU hotspots:');
    profile.cpuProfile.hotFunctions.slice(0, 5).forEach(func => {
      console.log(`${func.name}: ${func.selfTime.toFixed(1)}% CPU time`);
    });
  }

  // Show memory info
  if (profile.memoryProfile) {
    console.log('\nMemory usage:', {
      peak: `${(profile.memoryProfile.summary.peakUsage / 1024 / 1024).toFixed(1)} MB`,
      average: `${(profile.memoryProfile.summary.averageUsage / 1024 / 1024).toFixed(1)} MB`,
      growthRate: `${(profile.memoryProfile.summary.growthRate / 1024).toFixed(1)} KB/s`
    });
  }

  // Show bottlenecks
  profile.bottlenecks.forEach(bottleneck => {
    console.log(`${bottleneck.type.toUpperCase()} bottleneck (${(bottleneck.severity * 100).toFixed(1)}%): ${bottleneck.description}`);
  });

  profiler.cleanup();
}

async function simulateCPUWork() {
  // Simulate CPU-intensive computation
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.sqrt(i) * Math.sin(i);
  }
  return result;
}

async function simulateMemoryWork() {
  // Simulate memory allocation
  const arrays: number[][] = [];
  for (let i = 0; i < 100; i++) {
    arrays.push(new Array(10000).fill(Math.random()));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return arrays.length;
}

// Example 9: Complete Debug Session with Timeline
async function completeDebugSessionExample() {
  const debugManager = await setupCompleteDebugging();

  // Create a more complex error scenario
  const errorData: ErrorData = {
    id: 'complex-error-1',
    message: 'Payment processing failed: Card declined',
    type: 'PaymentError',
    timestamp: Date.now(),
    filename: 'src/payment/processor.ts',
    lineno: 156,
    colno: 23,
    userId: 'user456',
    sessionId: 'session789',
    context: {
      paymentAmount: 299.99,
      cardLast4: '1234',
      merchantId: 'merchant123'
    }
  };

  const sessionId = await debugManager.startDebugging(errorData, {
    includeReplay: true,
    includeTrace: true,
    includeTimeline: true,
    startProfiling: true
  });

  // Wait for data collection
  await new Promise(resolve => setTimeout(resolve, 3000));

  const debugSession = debugManager.getDebugSession(sessionId);
  
  if (debugSession) {
    console.log('\n=== Debug Session Summary ===');
    console.log(`Session ID: ${debugSession.sessionId}`);
    console.log(`Error: ${debugSession.error.message}`);
    console.log(`Components used: ${debugSession.metadata.componentsUsed.join(', ')}`);
    console.log(`Debug duration: ${debugSession.metadata.debugDuration}ms`);
    
    if (debugSession.cluster) {
      console.log(`\nError Cluster: ${debugSession.cluster.id}`);
      console.log(`Similar errors: ${debugSession.cluster.stats.count}`);
      console.log(`Cluster confidence: ${(debugSession.cluster.confidence * 100).toFixed(1)}%`);
    }

    if (debugSession.codeInsights) {
      console.log(`\nCode Insights:`);
      console.log(`Risk score: ${(debugSession.codeInsights.riskAssessment.overallRisk * 100).toFixed(1)}%`);
      console.log(`Suggestions: ${debugSession.codeInsights.suggestions.length}`);
      console.log(`Recent commits analyzed: ${debugSession.codeInsights.relatedCommits.length}`);
    }

    if (debugSession.timelineData) {
      console.log(`\nTimeline:`);
      console.log(`Total events: ${debugSession.timelineData.events.length}`);
      console.log(`Time range: ${debugSession.timelineData.timeRange.end - debugSession.timelineData.timeRange.start}ms`);
    }

    if (debugSession.sessionData) {
      console.log(`\nSession Replay:`);
      console.log(`Events recorded: ${debugSession.sessionData.events.length}`);
      console.log(`Session duration: ${debugSession.sessionData.duration}ms`);
      console.log(`Compressed size: ${debugSession.sessionData.compressedSize} bytes`);
    }
  }

  await debugManager.shutdown();
  return debugSession;
}

// Run examples
async function runExamples() {
  console.log('=== Debugging Package Examples ===\n');

  try {
    console.log('1. Basic Error Capture:');
    await captureAndDebugError();

    console.log('\n2. Error Clustering:');
    await errorClusteringExample();

    console.log('\n3. Log Correlation:');
    await logCorrelationExample();

    console.log('\n4. Performance Profiling:');
    await performanceProfilingExample();

    console.log('\n5. Complete Debug Session:');
    await completeDebugSessionExample();

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other files
export {
  setupCompleteDebugging,
  captureAndDebugError,
  distributedTracingExample,
  sessionReplayExample,
  errorClusteringExample,
  logCorrelationExample,
  codeInsightsExample,
  performanceProfilingExample,
  completeDebugSessionExample,
  runExamples
};

// Run examples if called directly
if (require.main === module) {
  runExamples().catch(console.error);
}