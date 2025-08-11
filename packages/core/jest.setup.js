// Jest setup file
// Mock performance API for tests
global.performance = global.performance || {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => [])
};

// Mock PerformanceObserver
global.PerformanceObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn()
}));

// Mock fetch for transport tests
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Jest Test Environment',
    onLine: true,
    language: 'en-US'
  },
  writable: true
});

// Suppress console logs in tests unless debugging
if (process.env.DEBUG_TESTS !== 'true') {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}