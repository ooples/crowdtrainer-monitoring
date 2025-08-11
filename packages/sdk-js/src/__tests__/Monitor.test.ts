import { Monitor } from '../Monitor';
import type { MonitorConfig } from '../types';

describe('Monitor', () => {
  let monitor: Monitor;
  let config: MonitorConfig;

  beforeEach(() => {
    config = {
      projectId: 'test-project',
      apiUrl: 'https://api.test.com',
      environment: 'test',
      debug: true,
    };
    
    monitor = new Monitor(config);
    
    // Mock fetch for tests
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    monitor.stop();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create monitor with default config', () => {
      const simpleMonitor = new Monitor({ projectId: 'test' });
      expect(simpleMonitor.isActive()).toBe(true);
    });

    it('should merge user config with defaults', () => {
      expect(monitor.isActive()).toBe(true);
    });
  });

  describe('user context', () => {
    it('should set user context', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      monitor.setUser(user);
      expect(monitor.getUser()).toEqual(user);
    });

    it('should clear user context', () => {
      monitor.setUser({ id: 'user-123' });
      expect(monitor.getUser()).toBeDefined();

      monitor.clearUser();
      expect(monitor.getUser()).toBeUndefined();
    });
  });

  describe('custom context', () => {
    it('should set custom context', () => {
      monitor.setContext('theme', 'dark');
      monitor.setContext('feature_flag_x', true);

      const context = monitor.getContext();
      expect(context.theme).toBe('dark');
      expect(context.feature_flag_x).toBe(true);
    });

    it('should clear specific context key', () => {
      monitor.setContext('key1', 'value1');
      monitor.setContext('key2', 'value2');

      monitor.clearContext('key1');
      
      const context = monitor.getContext();
      expect(context.key1).toBeUndefined();
      expect(context.key2).toBe('value2');
    });

    it('should clear all context', () => {
      monitor.setContext('key1', 'value1');
      monitor.setContext('key2', 'value2');

      monitor.clearContext();
      
      const context = monitor.getContext();
      expect(Object.keys(context)).toHaveLength(0);
    });
  });

  describe('breadcrumbs', () => {
    it('should add breadcrumb', () => {
      const breadcrumb = {
        timestamp: Date.now(),
        type: 'info' as const,
        message: 'Test breadcrumb',
        data: { test: true },
      };

      monitor.addBreadcrumb(breadcrumb);
      const breadcrumbs = monitor.getBreadcrumbs();
      
      expect(breadcrumbs).toHaveLength(2); // +1 for initial SDK breadcrumb
      expect(breadcrumbs[1]).toEqual(breadcrumb);
    });

    it('should limit breadcrumbs to max count', () => {
      const smallMonitor = new Monitor({
        projectId: 'test',
        maxBreadcrumbs: 3,
      });

      // Add more breadcrumbs than the limit
      for (let i = 0; i < 5; i++) {
        smallMonitor.addBreadcrumb({
          timestamp: Date.now(),
          type: 'info',
          message: `Breadcrumb ${i}`,
        });
      }

      const breadcrumbs = smallMonitor.getBreadcrumbs();
      expect(breadcrumbs.length).toBeLessThanOrEqual(3);
    });
  });

  describe('event tracking', () => {
    it('should track custom event', () => {
      const flushSpy = jest.spyOn(monitor, 'flush');
      
      monitor.track('button_click', {
        button_id: 'submit',
        page: '/checkout',
      });

      // Should debounce flush
      expect(flushSpy).not.toHaveBeenCalled();
    });

    it('should track page view', () => {
      monitor.trackPageView('/test-page', 'Test Page');
      
      const session = monitor.getSession();
      expect(session.pageViews).toBe(1);
    });

    it('should track interaction', () => {
      monitor.trackInteraction('button', 'click', {
        element_id: 'submit-btn',
      });

      const breadcrumbs = monitor.getBreadcrumbs();
      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
      
      expect(lastBreadcrumb.type).toBe('user');
      expect(lastBreadcrumb.message).toBe('click on button');
    });
  });

  describe('session management', () => {
    it('should create session with UUID', () => {
      const session = monitor.getSession();
      
      expect(session.id).toMatch(/^[a-f0-9-]{36}$/);
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.pageViews).toBe(0);
      expect(session.duration).toBe(0);
    });
  });

  describe('lifecycle', () => {
    it('should start monitoring', () => {
      monitor.start();
      expect(monitor.isActive()).toBe(true);
    });

    it('should stop monitoring', () => {
      monitor.start();
      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('flush', () => {
    it('should flush events successfully', async () => {
      monitor.track('test_event');
      const result = await monitor.flush();
      
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalled();
    });

    it('should handle flush failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      monitor.track('test_event');
      const result = await monitor.flush();
      
      expect(result).toBe(false);
    });
  });
});