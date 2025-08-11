import type { ErrorCapture, Breadcrumb } from '../types';
import { now, isBrowser, getErrorDetails } from '../utils';

/**
 * Error capture functionality
 */
export class ErrorCapture {
  private isEnabled: boolean = false;
  private listeners: Array<(error: ErrorCapture) => void> = [];
  private originalWindowErrorHandler?: OnErrorEventHandler;
  private originalUnhandledRejectionHandler?: (event: PromiseRejectionEvent) => void;

  constructor() {
    this.handleWindowError = this.handleWindowError.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
  }

  /** Start capturing errors */
  start(): void {
    if (!isBrowser() || this.isEnabled) return;

    this.isEnabled = true;

    // Store original handlers
    this.originalWindowErrorHandler = window.onerror;
    this.originalUnhandledRejectionHandler = window.onunhandledrejection;

    // Set up error handlers
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);

    // Global error handler (fallback)
    window.onerror = this.handleWindowError;
    window.onunhandledrejection = this.handleUnhandledRejection;
  }

  /** Stop capturing errors */
  stop(): void {
    if (!isBrowser() || !this.isEnabled) return;

    this.isEnabled = false;

    // Remove event listeners
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);

    // Restore original handlers
    window.onerror = this.originalWindowErrorHandler || null;
    window.onunhandledrejection = this.originalUnhandledRejectionHandler || null;
  }

  /** Add error listener */
  addListener(listener: (error: ErrorCapture) => void): void {
    this.listeners.push(listener);
  }

  /** Remove error listener */
  removeListener(listener: (error: ErrorCapture) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /** Manually capture an error */
  captureError(error: Error | any, context?: Record<string, any>): void {
    const errorDetails = getErrorDetails(error);
    const errorCapture: ErrorCapture = {
      message: errorDetails.message,
      stack: errorDetails.stack,
      type: errorDetails.name,
      timestamp: now(),
      ...context,
    };

    this.notifyListeners(errorCapture);
  }

  /** Handle window error events */
  private handleWindowError(event: ErrorEvent | Event): void {
    let errorCapture: ErrorCapture;

    if (event instanceof ErrorEvent) {
      // Regular JavaScript error
      errorCapture = {
        message: event.message,
        stack: event.error?.stack,
        type: event.error?.name || 'Error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: now(),
      };
    } else {
      // Resource loading error
      const target = event.target as HTMLElement;
      const tagName = target?.tagName?.toLowerCase();
      const src = (target as any)?.src || (target as any)?.href;

      errorCapture = {
        message: `Failed to load ${tagName}: ${src}`,
        type: 'ResourceError',
        filename: src,
        timestamp: now(),
      };
    }

    this.notifyListeners(errorCapture);

    // Call original handler if it exists
    if (this.originalWindowErrorHandler && event instanceof ErrorEvent) {
      this.originalWindowErrorHandler.call(
        window,
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error
      );
    }
  }

  /** Handle unhandled promise rejections */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let stack: string | undefined;
    let type = 'UnhandledRejection';

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
      type = reason.name;
    } else if (typeof reason === 'string') {
      message = reason;
    } else if (reason && typeof reason === 'object') {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = String(reason);
      }
    }

    const errorCapture: ErrorCapture = {
      message,
      stack,
      type,
      timestamp: now(),
    };

    this.notifyListeners(errorCapture);

    // Call original handler if it exists
    if (this.originalUnhandledRejectionHandler) {
      this.originalUnhandledRejectionHandler.call(window, event);
    }
  }

  /** Notify all listeners of error */
  private notifyListeners(error: ErrorCapture): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        // Don't let listener errors break error capture
        console.warn('Monitor SDK: Error in error listener:', err);
      }
    });
  }

  /** Check if error capture is enabled */
  isActive(): boolean {
    return this.isEnabled;
  }

  /** Wrap a function to capture errors */
  wrapFunction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn.apply(this, args);
        
        // Handle promises
        if (result && typeof result.then === 'function') {
          return result.catch((error: any) => {
            this.captureError(error, { 
              context: 'wrapped_function',
              functionName: fn.name 
            });
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        this.captureError(error, { 
          context: 'wrapped_function',
          functionName: fn.name 
        });
        throw error;
      }
    }) as T;
  }

  /** Generate breadcrumb from error */
  static toBreadcrumb(error: ErrorCapture): Breadcrumb {
    return {
      timestamp: error.timestamp,
      type: 'error',
      message: error.message,
      data: {
        type: error.type,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
      },
    };
  }
}