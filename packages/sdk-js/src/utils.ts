/**
 * Utility functions for the monitoring SDK
 */

/** Generate a random UUID v4 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Get current timestamp */
export function now(): number {
  return Date.now();
}

/** Check if we're in browser environment */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Check if Performance API is available */
export function hasPerformanceAPI(): boolean {
  return isBrowser() && 'performance' in window && 'getEntriesByType' in performance;
}

/** Check if Beacon API is available */
export function hasBeaconAPI(): boolean {
  return isBrowser() && 'navigator' in window && 'sendBeacon' in navigator;
}

/** Check if localStorage is available */
export function hasLocalStorage(): boolean {
  try {
    if (!isBrowser()) return false;
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/** Safely stringify JSON with circular reference handling */
export function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}

/** Throttle function calls */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

/** Debounce function calls */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  }) as T;
}

/** Get page URL */
export function getPageURL(): string {
  return isBrowser() ? window.location.href : '';
}

/** Get user agent */
export function getUserAgent(): string {
  return isBrowser() ? navigator.userAgent : '';
}

/** Get viewport size */
export function getViewportSize(): { width: number; height: number } {
  if (!isBrowser()) return { width: 0, height: 0 };
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  };
}

/** Check if value is a promise */
export function isPromise(value: any): value is Promise<any> {
  return value && typeof value.then === 'function';
}

/** Truncate string to max length */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/** Get error details from Error object */
export function getErrorDetails(error: Error | any): {
  message: string;
  stack?: string;
  name: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  
  return {
    message: String(error),
    name: 'UnknownError',
  };
}