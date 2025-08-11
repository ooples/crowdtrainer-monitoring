import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare global {
  namespace Vi {
    interface JestAssertion<T = any>
      extends jest.Matchers<void, T>,
        TestingLibraryMatchers<T, void> {}
  }
}

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  
  // Mock external services
  mockExternalServices();
});

afterAll(async () => {
  // Clean up any global resources
  await cleanupGlobalResources();
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  
  // Reset environment variables
  resetTestEnvironment();
});

afterEach(async () => {
  // Clean up test-specific resources
  await cleanupTestResources();
});

function mockExternalServices() {
  // Mock Redis
  vi.mock('redis', () => ({
    createClient: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
    })),
  }));

  // Mock PostgreSQL
  vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => ({
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    })),
  }));

  // Mock OpenTelemetry
  vi.mock('@opentelemetry/api', () => ({
    trace: {
      getTracer: vi.fn(() => ({
        startSpan: vi.fn(() => ({
          end: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn(),
        })),
      })),
    },
    metrics: {
      getMeter: vi.fn(() => ({
        createCounter: vi.fn(),
        createHistogram: vi.fn(),
        createGauge: vi.fn(),
      })),
    },
  }));

  // Mock external HTTP requests
  global.fetch = vi.fn();
}

function resetTestEnvironment() {
  // Reset environment variables to known test state
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.JWT_SECRET = 'test-secret';
}

async function cleanupGlobalResources() {
  // Close database connections, stop servers, etc.
  // This will be implemented by individual packages
}

async function cleanupTestResources() {
  // Clean up test-specific resources
  // Clear test databases, reset state, etc.
}

// Custom matchers for monitoring-specific assertions
expect.extend({
  toBeValidMetric(received) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      'name' in received &&
      'value' in received &&
      'timestamp' in received &&
      typeof received.name === 'string' &&
      typeof received.value === 'number' &&
      received.timestamp instanceof Date;

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid metric`
          : `Expected ${received} to be a valid metric with name, value, and timestamp`,
      pass,
    };
  },

  toBeValidAlert(received) {
    const pass =
      typeof received === 'object' &&
      received !== null &&
      'id' in received &&
      'severity' in received &&
      'message' in received &&
      'createdAt' in received &&
      typeof received.id === 'string' &&
      ['low', 'medium', 'high', 'critical'].includes(received.severity) &&
      typeof received.message === 'string' &&
      received.createdAt instanceof Date;

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid alert`
          : `Expected ${received} to be a valid alert with id, severity, message, and createdAt`,
      pass,
    };
  },
});