import '@testing-library/jest-dom';

// Mock Performance API for testing
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
  writable: true,
});

// Mock PerformanceObserver
global.PerformanceObserver = class PerformanceObserver {
  callback: PerformanceObserverCallback;
  
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }
  
  observe() {
    // Mock implementation
  }
  
  disconnect() {
    // Mock implementation
  }
  
  takeRecords() {
    return [];
  }
};

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
  })
) as jest.Mock;

// Mock console methods to reduce noise in tests
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

// Mock window.location
delete (window as any).location;
window.location = {
  ...window.location,
  pathname: '/',
  href: 'http://localhost/',
  origin: 'http://localhost',
  search: '',
  hash: '',
} as any;

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Jest Test Runner',
  },
  writable: true,
});

// Mock document.referrer
Object.defineProperty(document, 'referrer', {
  value: '',
  writable: true,
});

// Mock history API
const mockHistoryPushState = jest.fn();
const mockHistoryReplaceState = jest.fn();

Object.defineProperty(window, 'history', {
  value: {
    pushState: mockHistoryPushState,
    replaceState: mockHistoryReplaceState,
    back: jest.fn(),
    forward: jest.fn(),
    go: jest.fn(),
    length: 1,
    state: null,
  },
  writable: true,
});

// Export mocks for use in tests
export {
  mockHistoryPushState,
  mockHistoryReplaceState,
};