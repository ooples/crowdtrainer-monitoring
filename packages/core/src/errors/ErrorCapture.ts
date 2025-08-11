/**
 * Error capturing and handling system for monitoring SDK
 */

import { 
  ErrorInfo, 
  ErrorSeverity, 
  ErrorCategory,
  Context,
  UUID,
  Timestamp,
  JSONValue,
  Logger,
  Plugin
} from '../types/index.js';
import { generateId, getCurrentTimestamp } from '../utils/index.js';

export interface ErrorCaptureConfig {
  /** Maximum errors in buffer before forcing flush */
  maxBufferSize?: number;
  /** Enable automatic error capturing */
  autoCapture?: boolean;
  /** Enable unhandled promise rejection capturing */
  captureUnhandledRejections?: boolean;
  /** Enable console error capturing */
  captureConsoleErrors?: boolean;
  /** Maximum stack trace frames */
  maxStackFrames?: number;
  /** Ignored error patterns */
  ignorePatterns?: RegExp[];
  /** Error sampling rate (0-1) */
  sampleRate?: number;
  /** Default error severity */
  defaultSeverity?: ErrorSeverity;
  /** Logger instance */
  logger?: Logger;
  /** Plugins to apply to errors */
  plugins?: Plugin[];
}

export interface CapturedError extends ErrorInfo {
  /** Error ID */
  id: UUID;
  /** Error timestamp */
  timestamp: Timestamp;
  /** Error context */
  context?: Context;
  /** User agent */
  userAgent?: string;
  /** URL where error occurred */
  url?: string;
  /** Additional breadcrumbs */
  breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
  /** Breadcrumb timestamp */
  timestamp: Timestamp;
  /** Breadcrumb message */
  message: string;
  /** Breadcrumb category */
  category: string;
  /** Breadcrumb level */
  level: 'debug' | 'info' | 'warning' | 'error';
  /** Breadcrumb data */
  data?: Record<string, JSONValue>;
}

export class ErrorCapture {
  private config: Required<ErrorCaptureConfig>;
  private errorBuffer: CapturedError[] = [];
  private context: Context = {};
  private breadcrumbs: Breadcrumb[] = [];
  private originalHandlers: {
    onError?: ((event: ErrorEvent) => any) | null;
    onUnhandledRejection?: ((event: PromiseRejectionEvent) => any) | null;
    consoleError?: Console['error'];
  } = {};
  private isDestroyed = false;

  constructor(config: ErrorCaptureConfig = {}) {
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 50,
      autoCapture: config.autoCapture ?? true,
      captureUnhandledRejections: config.captureUnhandledRejections ?? true,
      captureConsoleErrors: config.captureConsoleErrors ?? false,
      maxStackFrames: config.maxStackFrames ?? 50,
      ignorePatterns: config.ignorePatterns ?? [],
      sampleRate: config.sampleRate ?? 1.0,
      defaultSeverity: config.defaultSeverity ?? 'medium',
      logger: config.logger ?? console,
      plugins: config.plugins ?? []
    };

    if (this.config.autoCapture) {
      this.setupAutoCapture();
    }
  }

  /**
   * Capture an error manually
   */
  captureError(error: Error | ErrorInfo | string, context?: Context): UUID {
    if (this.isDestroyed) {
      this.config.logger.warn('ErrorCapture: Cannot capture error - capture is destroyed');
      return '';
    }

    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return '';
    }

    const errorInfo = this.normalizeError(error);

    // Check if error should be ignored
    if (this.shouldIgnoreError(errorInfo)) {
      return '';
    }

    const capturedError: CapturedError = {
      id: generateId(),
      timestamp: getCurrentTimestamp(),
      context: { ...this.context, ...context },
      userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location?.href : undefined,
      breadcrumbs: [...this.breadcrumbs],
      ...errorInfo
    };

    // Apply plugins
    const processedError = this.applyPlugins(capturedError);
    if (!processedError) {
      return ''; // Error was filtered out by plugins
    }

    this.config.logger.debug('ErrorCapture: Capturing error', processedError);
    this.errorBuffer.push(processedError);

    // Add breadcrumb for captured error
    this.addBreadcrumb(`Error captured: ${processedError.message}`, 'error', 'error', {
      errorId: processedError.id,
      severity: processedError.severity
    });

    if (this.errorBuffer.length >= this.config.maxBufferSize) {
      this.flush();
    }

    return processedError.id;
  }

  /**
   * Capture exception with additional context
   */
  captureException(error: Error, options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    tags?: Record<string, string>;
    context?: Context;
    fingerprint?: string;
  } = {}): UUID {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: this.cleanStackTrace(error.stack),
      name: error.name,
      severity: options.severity ?? this.config.defaultSeverity,
      category: options.category,
      data: {
        ...options.tags,
        fingerprint: options.fingerprint
      }
    };

    return this.captureError(errorInfo, options.context);
  }

  /**
   * Capture a message as an error
   */
  captureMessage(message: string, options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    context?: Context;
    data?: Record<string, JSONValue>;
  } = {}): UUID {
    const errorInfo: ErrorInfo = {
      message,
      severity: options.severity ?? 'low',
      category: options.category ?? 'user',
      data: options.data
    };

    return this.captureError(errorInfo, options.context);
  }

  /**
   * Set global context for all captured errors
   */
  setContext(context: Partial<Context>): void {
    this.context = { ...this.context, ...context };
    this.config.logger.debug('ErrorCapture: Context updated', this.context);
  }

  /**
   * Add breadcrumb for debugging context
   */
  addBreadcrumb(message: string, category: string = 'default', level: Breadcrumb['level'] = 'info', data?: Record<string, JSONValue>): void {
    const breadcrumb: Breadcrumb = {
      timestamp: getCurrentTimestamp(),
      message,
      category,
      level,
      data
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only the last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }

    this.config.logger.debug('ErrorCapture: Breadcrumb added', breadcrumb);
  }

  /**
   * Clear all breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
    this.config.logger.debug('ErrorCapture: Breadcrumbs cleared');
  }

  /**
   * Get current breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Wrap a function to automatically capture errors
   */
  wrapFunction<T extends (...args: any[]) => any>(fn: T, context?: Context): T {
    const self = this;
    return ((...args: any[]) => {
      try {
        const result = fn.apply(this, args);
        
        // Handle promises
        if (result && typeof result.catch === 'function') {
          return result.catch((error: Error) => {
            self.captureException(error, { context });
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        self.captureException(error as Error, { context });
        throw error;
      }
    }) as T;
  }

  /**
   * Get errors from buffer
   */
  getErrors(): CapturedError[] {
    return [...this.errorBuffer];
  }

  /**
   * Flush errors from buffer
   */
  flush(): CapturedError[] {
    const errors = [...this.errorBuffer];
    this.errorBuffer = [];
    this.config.logger.debug(`ErrorCapture: Flushed ${errors.length} errors`);
    return errors;
  }

  /**
   * Clear error buffer and breadcrumbs
   */
  clear(): void {
    this.errorBuffer = [];
    this.breadcrumbs = [];
    this.config.logger.debug('ErrorCapture: Cleared errors and breadcrumbs');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorCaptureConfig>): void {
    const wasAutoCapture = this.config.autoCapture;
    this.config = { ...this.config, ...config };

    // Re-setup auto capture if configuration changed
    if (config.autoCapture !== undefined && config.autoCapture !== wasAutoCapture) {
      if (wasAutoCapture) {
        this.teardownAutoCapture();
      }
      if (this.config.autoCapture) {
        this.setupAutoCapture();
      }
    }
  }

  /**
   * Destroy error capture
   */
  destroy(): void {
    this.teardownAutoCapture();
    this.errorBuffer = [];
    this.breadcrumbs = [];
    this.context = {};
    this.isDestroyed = true;
    this.config.logger.debug('ErrorCapture: Destroyed');
  }

  /**
   * Normalize error to ErrorInfo
   */
  private normalizeError(error: Error | ErrorInfo | string): ErrorInfo {
    if (typeof error === 'string') {
      return {
        message: error,
        severity: this.config.defaultSeverity,
        category: 'user'
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: this.cleanStackTrace(error.stack),
        name: error.name,
        severity: this.config.defaultSeverity,
        category: 'javascript'
      };
    }

    return {
      severity: this.config.defaultSeverity,
      category: 'javascript',
      ...error
    };
  }

  /**
   * Clean and limit stack trace
   */
  private cleanStackTrace(stack?: string): string | undefined {
    if (!stack) {
      return undefined;
    }

    const lines = stack.split('\n');
    const relevantLines = lines
      .slice(0, this.config.maxStackFrames)
      .filter(line => line.trim() && !this.isInternalStackFrame(line));

    return relevantLines.join('\n');
  }

  /**
   * Check if stack frame is internal (SDK code)
   */
  private isInternalStackFrame(line: string): boolean {
    return line.includes('@monitoring-service/core') ||
           line.includes('ErrorCapture.ts') ||
           line.includes('__monitoring__');
  }

  /**
   * Check if error should be ignored
   */
  private shouldIgnoreError(error: ErrorInfo): boolean {
    return this.config.ignorePatterns.some(pattern => 
      pattern.test(error.message) || 
      (error.stack && pattern.test(error.stack))
    );
  }

  /**
   * Apply plugins to error
   */
  private applyPlugins(error: CapturedError): CapturedError | null {
    let processedError = error;

    for (const plugin of this.config.plugins) {
      if (plugin.handlers?.onError) {
        const result = plugin.handlers.onError(processedError);
        if (result === null) {
          return null; // Plugin filtered out the error
        }
        processedError = { ...processedError, ...result };
      }
    }

    return processedError;
  }

  /**
   * Setup automatic error capture
   */
  private setupAutoCapture(): void {
    if (typeof window === 'undefined') {
      return; // Not in browser environment
    }

    // Capture unhandled JavaScript errors
    this.originalHandlers.onError = window.onerror;
    window.onerror = (message, filename, lineno, colno, error) => {
      const errorInfo: ErrorInfo = {
        message: typeof message === 'string' ? message : 'Unknown error',
        filename,
        lineno,
        colno,
        stack: error?.stack,
        name: error?.name,
        severity: 'high',
        category: 'javascript'
      };

      this.captureError(errorInfo);

      // Call original handler
      if (this.originalHandlers.onError) {
        return this.originalHandlers.onError.call(window, message, filename, lineno, colno, error);
      }
    };

    // Capture unhandled promise rejections
    if (this.config.captureUnhandledRejections) {
      this.originalHandlers.onUnhandledRejection = window.onunhandledrejection;
      window.onunhandledrejection = (event) => {
        const error = event.reason;
        let errorInfo: ErrorInfo;

        if (error instanceof Error) {
          errorInfo = {
            message: `Unhandled Promise Rejection: ${error.message}`,
            stack: error.stack,
            name: error.name,
            severity: 'high',
            category: 'javascript'
          };
        } else {
          errorInfo = {
            message: `Unhandled Promise Rejection: ${String(error)}`,
            severity: 'high',
            category: 'javascript'
          };
        }

        this.captureError(errorInfo);

        // Call original handler
        if (this.originalHandlers.onUnhandledRejection) {
          return this.originalHandlers.onUnhandledRejection.call(window, event);
        }
      };
    }

    // Capture console errors
    if (this.config.captureConsoleErrors && typeof console !== 'undefined') {
      this.originalHandlers.consoleError = console.error;
      console.error = (...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        this.captureError({
          message: `Console Error: ${message}`,
          severity: 'medium',
          category: 'javascript'
        });

        // Call original console.error
        if (this.originalHandlers.consoleError) {
          this.originalHandlers.consoleError.apply(console, args);
        }
      };
    }

    this.config.logger.debug('ErrorCapture: Auto capture setup complete');
  }

  /**
   * Teardown automatic error capture
   */
  private teardownAutoCapture(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Restore original handlers
    if (this.originalHandlers.onError !== undefined) {
      window.onerror = this.originalHandlers.onError;
    }

    if (this.originalHandlers.onUnhandledRejection !== undefined) {
      window.onunhandledrejection = this.originalHandlers.onUnhandledRejection;
    }

    if (this.originalHandlers.consoleError && typeof console !== 'undefined') {
      console.error = this.originalHandlers.consoleError;
    }

    this.originalHandlers = {};
    this.config.logger.debug('ErrorCapture: Auto capture torn down');
  }
}