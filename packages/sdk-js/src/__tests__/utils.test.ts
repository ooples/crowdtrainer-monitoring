import {
  generateUUID,
  now,
  isBrowser,
  hasPerformanceAPI,
  hasBeaconAPI,
  hasLocalStorage,
  safeStringify,
  throttle,
  debounce,
  getErrorDetails,
} from '../utils';

describe('utils', () => {
  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('now', () => {
    it('should return current timestamp', () => {
      const timestamp = now();
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
    });
  });

  describe('isBrowser', () => {
    it('should detect browser environment', () => {
      expect(isBrowser()).toBe(true); // In jsdom test environment
    });
  });

  describe('hasPerformanceAPI', () => {
    it('should detect Performance API availability', () => {
      expect(hasPerformanceAPI()).toBe(true);
    });
  });

  describe('hasBeaconAPI', () => {
    it('should detect Beacon API availability', () => {
      expect(hasBeaconAPI()).toBe(true);
    });
  });

  describe('hasLocalStorage', () => {
    it('should detect localStorage availability', () => {
      expect(hasLocalStorage()).toBe(true);
    });

    it('should handle localStorage exceptions', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(hasLocalStorage()).toBe(false);

      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple objects', () => {
      const obj = { name: 'test', value: 123 };
      expect(safeStringify(obj)).toBe(JSON.stringify(obj));
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Circular reference

      const result = safeStringify(obj);
      expect(result).toContain('[Circular]');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).toBe('null');
      expect(safeStringify(undefined)).toBe(undefined);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', (done) => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      setTimeout(() => {
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
        done();
      }, 150);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('getErrorDetails', () => {
    it('should extract details from Error object', () => {
      const error = new Error('Test error');
      error.name = 'TestError';

      const details = getErrorDetails(error);
      
      expect(details.message).toBe('Test error');
      expect(details.name).toBe('TestError');
      expect(details.stack).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const details = getErrorDetails('Simple string error');
      
      expect(details.message).toBe('Simple string error');
      expect(details.name).toBe('UnknownError');
      expect(details.stack).toBeUndefined();
    });

    it('should handle null/undefined errors', () => {
      const details = getErrorDetails(null);
      
      expect(details.message).toBe('null');
      expect(details.name).toBe('UnknownError');
    });
  });
});