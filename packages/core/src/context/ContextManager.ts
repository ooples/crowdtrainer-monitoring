/**
 * Context management system for monitoring SDK
 */

import { 
  Context, 
  UserContext, 
  DeviceContext, 
  AppContext,
  JSONValue,
  Logger 
} from '../types/index.js';
import { getUserAgent, getEnvironment } from '../utils/index.js';

export interface ContextManagerConfig {
  /** Enable automatic device context detection */
  autoDetectDevice?: boolean;
  /** Enable automatic app context detection */
  autoDetectApp?: boolean;
  /** Application name */
  appName?: string;
  /** Application version */
  appVersion?: string;
  /** Environment */
  environment?: string;
  /** Logger instance */
  logger?: Logger;
}

export class ContextManager {
  private context: Context = {};
  private config: Required<ContextManagerConfig>;

  constructor(config: ContextManagerConfig = {}) {
    this.config = {
      autoDetectDevice: config.autoDetectDevice ?? true,
      autoDetectApp: config.autoDetectApp ?? true,
      appName: config.appName ?? 'Unknown App',
      appVersion: config.appVersion ?? '1.0.0',
      environment: config.environment ?? 'production',
      logger: config.logger ?? console
    };

    if (this.config.autoDetectDevice) {
      this.detectDeviceContext();
    }

    if (this.config.autoDetectApp) {
      this.detectAppContext();
    }
  }

  /**
   * Set user context
   */
  setUser(user: UserContext): void {
    this.context.user = { ...this.context.user, ...user };
    this.config.logger.debug('ContextManager: User context updated', this.context.user as unknown as JSONValue);
  }

  /**
   * Get user context
   */
  getUser(): UserContext | undefined {
    return this.context.user;
  }

  /**
   * Set device context
   */
  setDevice(device: Partial<DeviceContext>): void {
    this.context.device = { ...this.context.device, ...device };
    this.config.logger.debug('ContextManager: Device context updated', this.context.device as unknown as JSONValue);
  }

  /**
   * Get device context
   */
  getDevice(): DeviceContext | undefined {
    return this.context.device;
  }

  /**
   * Set app context
   */
  setApp(app: Partial<AppContext>): void {
    this.context.app = { ...this.context.app, ...app } as AppContext;
    this.config.logger.debug('ContextManager: App context updated', this.context.app as unknown as JSONValue);
  }

  /**
   * Get app context
   */
  getApp(): AppContext | undefined {
    return this.context.app;
  }

  /**
   * Set custom context data
   */
  setCustom(key: string, value: JSONValue): void {
    if (!this.context.custom) {
      this.context.custom = {};
    }
    this.context.custom[key] = value;
    this.config.logger.debug(`ContextManager: Custom context '${key}' updated`, value);
  }

  /**
   * Get custom context data
   */
  getCustom(key?: string): JSONValue | Record<string, JSONValue> | undefined {
    if (!this.context.custom) {
      return undefined;
    }
    
    if (key) {
      return this.context.custom[key];
    }
    
    return this.context.custom;
  }

  /**
   * Remove custom context data
   */
  removeCustom(key: string): void {
    if (this.context.custom && key in this.context.custom) {
      delete this.context.custom[key];
      this.config.logger.debug(`ContextManager: Custom context '${key}' removed`);
    }
  }

  /**
   * Get full context
   */
  getContext(): Context {
    const result: Context = {};
    if (this.context.user) {
      result.user = { ...this.context.user };
    }
    if (this.context.device) {
      result.device = { ...this.context.device };
    }
    if (this.context.app) {
      result.app = { ...this.context.app };
    }
    if (this.context.custom) {
      result.custom = { ...this.context.custom };
    }
    return result;
  }

  /**
   * Set full context (merge with existing)
   */
  setContext(context: Partial<Context>): void {
    if (context.user) {
      this.setUser(context.user);
    }
    
    if (context.device) {
      this.setDevice(context.device);
    }
    
    if (context.app) {
      this.setApp(context.app);
    }
    
    if (context.custom) {
      Object.entries(context.custom).forEach(([key, value]) => {
        this.setCustom(key, value);
      });
    }
  }

  /**
   * Clear all context
   */
  clearContext(): void {
    this.context = {};
    this.config.logger.debug('ContextManager: All context cleared');
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    delete this.context.user;
    this.config.logger.debug('ContextManager: User context cleared');
  }

  /**
   * Get context for specific scope (returns only relevant context)
   */
  getContextForScope(scope: 'user' | 'session' | 'app' | 'all' = 'all'): Context {
    const fullContext = this.getContext();
    
    switch (scope) {
      case 'user': {
        const result: Context = {};
        if (fullContext.user) result.user = fullContext.user;
        return result;
      }
      case 'session': {
        const result: Context = {};
        if (fullContext.user) result.user = fullContext.user;
        if (fullContext.custom) result.custom = fullContext.custom;
        return result;
      }
      case 'app': {
        const result: Context = {};
        if (fullContext.app) result.app = fullContext.app;
        if (fullContext.device) result.device = fullContext.device;
        return result;
      }
      case 'all':
      default:
        return fullContext;
    }
  }

  /**
   * Create a snapshot of current context
   */
  snapshot(): Context {
    return JSON.parse(JSON.stringify(this.getContext()));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...config };

    // Re-detect contexts if auto-detection settings changed
    if (config.autoDetectDevice && !this.context.device) {
      this.detectDeviceContext();
    }

    if (config.autoDetectApp && !this.context.app) {
      this.detectAppContext();
    }
  }

  /**
   * Detect device context automatically
   */
  private detectDeviceContext(): void {
    const environment = getEnvironment();
    const userAgent = getUserAgent();
    
    const device: DeviceContext = {
      userAgent,
      platform: this.detectPlatform(userAgent)
    };
    
    const timezone = this.detectTimezone();
    if (timezone !== undefined) {
      device.timezone = timezone;
    }
    
    const locale = this.detectLocale();
    if (locale !== undefined) {
      device.locale = locale;
    }

    if (environment === 'browser') {
      this.detectBrowserDeviceContext(device);
    } else if (environment === 'node') {
      this.detectNodeDeviceContext(device);
    }

    this.setDevice(device);
  }

  /**
   * Detect browser-specific device context
   */
  private detectBrowserDeviceContext(device: DeviceContext): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Screen information
    if (window.screen) {
      device.screenResolution = `${window.screen.width}x${window.screen.height}`;
    }

    // Viewport information
    device.viewport = {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };

    // Parse user agent for detailed info
    const ua = device.userAgent || '';
    const os = this.parseOSFromUserAgent(ua);
    if (os) {
      device.os = os;
    }
    const osVersion = this.parseOSVersionFromUserAgent(ua);
    if (osVersion !== undefined) {
      device.osVersion = osVersion;
    }
  }

  /**
   * Detect Node.js-specific device context
   */
  private detectNodeDeviceContext(device: DeviceContext): void {
    if (typeof process === 'undefined') {
      return;
    }

    device.os = process.platform;
    device.osVersion = process.version;
    device.platform = 'server';
  }

  /**
   * Detect app context automatically
   */
  private detectAppContext(): void {
    const app: AppContext = {
      name: this.config.appName,
      version: this.config.appVersion,
      environment: this.config.environment
    };

    // Try to detect from package.json or other sources
    if (typeof window !== 'undefined') {
      // Browser: try to get from meta tags or global variables
      const metaName = document.querySelector('meta[name="application-name"]')?.getAttribute('content');
      const metaVersion = document.querySelector('meta[name="version"]')?.getAttribute('content');
      
      if (metaName) app.name = metaName;
      if (metaVersion) app.version = metaVersion;

      // Check for common global variables
      const global = window as any;
      if (global.APP_NAME) app.name = global.APP_NAME;
      if (global.APP_VERSION) app.version = global.APP_VERSION;
      if (global.NODE_ENV) app.environment = global.NODE_ENV;
    } else if (typeof process !== 'undefined') {
      // Node.js: try to get from environment or package.json
      if (process.env.APP_NAME) app.name = process.env.APP_NAME;
      if (process.env.APP_VERSION) app.version = process.env.APP_VERSION;
      if (process.env.NODE_ENV) app.environment = process.env.NODE_ENV;
    }

    this.setApp(app);
  }

  /**
   * Detect platform from user agent
   */
  private detectPlatform(userAgent: string): string {
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Node.js')) return 'Node.js';
    return 'Unknown';
  }

  /**
   * Parse OS from user agent
   */
  private parseOSFromUserAgent(userAgent: string): string {
    const osPatterns = [
      { pattern: /Android ([0-9\.]+)/, os: 'Android' },
      { pattern: /iPhone OS ([0-9_]+)/, os: 'iOS' },
      { pattern: /iPad.*OS ([0-9_]+)/, os: 'iPadOS' },
      { pattern: /Windows NT ([0-9\.]+)/, os: 'Windows' },
      { pattern: /Mac OS X ([0-9_\.]+)/, os: 'macOS' },
      { pattern: /Linux/, os: 'Linux' }
    ];

    for (const { pattern, os } of osPatterns) {
      if (pattern.test(userAgent)) {
        return os;
      }
    }

    return 'Unknown';
  }

  /**
   * Parse OS version from user agent
   */
  private parseOSVersionFromUserAgent(userAgent: string): string | undefined {
    const versionPatterns = [
      { pattern: /Android ([0-9\.]+)/, transform: (match: string) => match },
      { pattern: /iPhone OS ([0-9_]+)/, transform: (match: string) => match.replace(/_/g, '.') },
      { pattern: /iPad.*OS ([0-9_]+)/, transform: (match: string) => match.replace(/_/g, '.') },
      { pattern: /Windows NT ([0-9\.]+)/, transform: (match: string) => match },
      { pattern: /Mac OS X ([0-9_\.]+)/, transform: (match: string) => match.replace(/_/g, '.') }
    ];

    for (const { pattern, transform } of versionPatterns) {
      const match = userAgent.match(pattern);
      if (match && match[1]) {
        return transform(match[1]);
      }
    }

    return undefined;
  }

  /**
   * Detect timezone
   */
  private detectTimezone(): string | undefined {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        // Fallback
      }
    }

    if (typeof window !== 'undefined') {
      // Fallback: use timezone offset
      const offset = new Date().getTimezoneOffset();
      return `UTC${offset > 0 ? '-' : '+'}${Math.abs(offset / 60)}`;
    }

    return undefined;
  }

  /**
   * Detect locale
   */
  private detectLocale(): string | undefined {
    if (typeof navigator !== 'undefined') {
      return navigator.language || (navigator as any).userLanguage;
    }

    if (typeof process !== 'undefined' && process.env.LANG) {
      return process.env.LANG.split('.')[0];
    }

    return undefined;
  }
}