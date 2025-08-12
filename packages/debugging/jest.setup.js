// Jest setup file for debugging package tests

import 'jest-extended';

// Mock browser APIs for Node.js testing environment
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  }
});

Object.defineProperty(window, 'PerformanceObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    takeRecords: jest.fn(() => [])
  }))
});

// Mock LZ-String for compression testing
jest.mock('lz-string', () => ({
  compressToUTF16: jest.fn((str) => `compressed:${str.length}`),
  decompressFromUTF16: jest.fn((compressed) => {
    if (compressed.startsWith('compressed:')) {
      const length = parseInt(compressed.split(':')[1]);
      return JSON.stringify({ test: 'data', length });
    }
    return null;
  })
}));

// Mock OpenTelemetry APIs
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        spanContext: () => ({ traceId: 'test-trace', spanId: 'test-span' }),
        setAttributes: jest.fn(),
        setStatus: jest.fn(),
        addEvent: jest.fn(),
        end: jest.fn()
      }))
    })),
    getActiveSpan: jest.fn(() => ({
      spanContext: () => ({ traceId: 'test-trace', spanId: 'test-span' }),
      setAttributes: jest.fn(),
      addEvent: jest.fn()
    })),
    setSpanContext: jest.fn()
  },
  context: {
    active: jest.fn(() => ({}))
  },
  SpanKind: {
    INTERNAL: 0,
    SERVER: 1,
    CLIENT: 2,
    PRODUCER: 3,
    CONSUMER: 4
  },
  SpanStatusCode: {
    UNSET: 0,
    OK: 1,
    ERROR: 2
  }
}));

// Mock simple-git
jest.mock('simple-git', () => ({
  simpleGit: jest.fn(() => ({
    log: jest.fn().mockResolvedValue({ all: [] }),
    show: jest.fn().mockResolvedValue(''),
    raw: jest.fn().mockResolvedValue(''),
    diffSummary: jest.fn().mockResolvedValue({ files: [] })
  }))
}));

// Mock ML libraries
jest.mock('ml-kmeans', () => ({
  kmeans: jest.fn((data, k) => ({
    clusters: data.map((_, i) => i % k),
    centroids: Array.from({ length: k }, () => data[0] || [])
  }))
}));

jest.mock('similarity', () => jest.fn((a, b) => {
  // Simple similarity calculation for testing
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const intersection = wordsA.filter(word => wordsB.includes(word));
  const union = [...new Set([...wordsA, ...wordsB])];
  return union.length > 0 ? intersection.length / union.length : 0;
}));

// Mock Node.js performance hooks
jest.mock('perf_hooks', () => ({
  performance: {
    now: jest.fn(() => Date.now())
  },
  PerformanceObserver: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn()
  }))
}));

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-90ab-cdef')
}));

// Global test utilities
global.mockFetch = (response, options = {}) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      ...options
    })
  );
};

global.restoreFetch = () => {
  if (global.fetch && global.fetch.mockRestore) {
    global.fetch.mockRestore();
  }
};

// Console output suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  jest.clearAllTimers();
  jest.resetAllMocks();
});