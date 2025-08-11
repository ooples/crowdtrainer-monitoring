// Test setup file

// Mock global objects for browser environment
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    getEntriesByType: jest.fn(() => []),
    mark: jest.fn(),
    measure: jest.fn(),
  },
});

Object.defineProperty(global, 'PerformanceObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
  })),
});

Object.defineProperty(global, 'localStorage', {
  value: {
    store: {} as Record<string, string>,
    getItem(key: string) {
      return this.store[key] || null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    },
  },
});

Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Jest Test Runner',
    sendBeacon: jest.fn(() => true),
    onLine: true,
  },
});

Object.defineProperty(global, 'fetch', {
  writable: true,
  value: jest.fn(),
});

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  status = 200;
  statusText = 'OK';
  responseText = '';
  
  open = jest.fn();
  send = jest.fn();
  setRequestHeader = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  getResponseHeader = jest.fn();
}

Object.defineProperty(global, 'XMLHttpRequest', {
  value: MockXMLHttpRequest,
});

// Mock Blob
Object.defineProperty(global, 'Blob', {
  value: jest.fn().mockImplementation((content, options) => ({
    size: content ? content.reduce((sum: number, item: any) => sum + String(item).length, 0) : 0,
    type: options?.type || '',
  })),
});

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};