/**
 * Jest setup file for security tests
 */

// Set test timeout to 30 seconds for comprehensive tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console.log and console.error to reduce test output
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

// Global test utilities
global.testUtils = {
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateRandomIP: () => {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  },
  
  generateRandomUserAgent: () => {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'curl/7.68.0',
      'python-requests/2.25.1',
      'Go-http-client/1.1'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  },
  
  generateMaliciousPayload: (type: string) => {
    const payloads: Record<string, string> = {
      sql_injection: "admin'; DROP TABLE users; --",
      xss: '<script>alert("XSS")</script>',
      command_injection: '; cat /etc/passwd',
      path_traversal: '../../../etc/passwd',
      generic: 'malicious_payload'
    };
    return payloads[type] || payloads.generic;
  }
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidSecurityEvent(): R;
      toBeValidAuditEntry(): R;
    }
  }

  var testUtils: {
    sleep: (ms: number) => Promise<void>;
    generateRandomIP: () => string;
    generateRandomUserAgent: () => string;
    generateMaliciousPayload: (type: string) => string;
  };
}

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be within range ${floor} - ${ceiling}`,
      pass
    };
  },

  toBeValidSecurityEvent(received: any) {
    const requiredFields = ['id', 'timestamp', 'type', 'severity', 'source'];
    const missingFields = requiredFields.filter(field => !received || !received[field]);
    
    const pass = missingFields.length === 0;
    return {
      message: () => `expected security event ${pass ? 'not ' : ''}to have required fields. Missing: ${missingFields.join(', ')}`,
      pass
    };
  },

  toBeValidAuditEntry(received: any) {
    const requiredFields = ['id', 'timestamp', 'action', 'resource', 'outcome', 'hash'];
    const missingFields = requiredFields.filter(field => !received || !received[field]);
    
    const pass = missingFields.length === 0 && 
                 received.hash && 
                 received.hash.length > 0;
    
    return {
      message: () => `expected audit entry ${pass ? 'not ' : ''}to be valid. Missing: ${missingFields.join(', ')}`,
      pass
    };
  }
});

// Cleanup function to run after each test
afterEach(async () => {
  // Clean up any timers, intervals, or async operations
  jest.clearAllTimers();
  
  // Add any other cleanup logic here
});

export {};