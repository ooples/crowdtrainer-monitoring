/**
 * Utility functions for the monitoring SDK
 */

import { UUID, Timestamp, JSONValue, Logger } from '../types/index.js';

/**
 * Generate a unique identifier
 */
export function generateId(): UUID {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): Timestamp {
  return Date.now();
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentISOTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): T {
  let timeout: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(null, args);
    };
    
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(null, args);
  }) as T;
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
  }
  
  return result;
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && 
         typeof value === 'object' && 
         value.constructor === Object &&
         Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Safely stringify JSON with circular reference handling
 */
export function safeStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    
    // Handle special types
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }
    
    if (typeof value === 'function') {
      return '[Function]';
    }
    
    if (typeof value === 'undefined') {
      return '[Undefined]';
    }
    
    return value;
  }, space);
}

/**
 * Sanitize data for safe transmission
 */
export function sanitizeData(data: any, maxDepth = 10): any {
  if (maxDepth <= 0) {
    return '[Max Depth Exceeded]';
  }
  
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'string') {
    // Truncate long strings
    return data.length > 10000 ? data.substring(0, 10000) + '...' : data;
  }
  
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }
  
  if (data instanceof Date) {
    return data.toISOString();
  }
  
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack
    };
  }
  
  if (Array.isArray(data)) {
    // Limit array size
    const maxItems = 100;
    const sanitized = data.slice(0, maxItems).map(item => sanitizeData(item, maxDepth - 1));
    if (data.length > maxItems) {
      sanitized.push(`... ${data.length - maxItems} more items`);
    }
    return sanitized;
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    let count = 0;
    const maxProperties = 100;
    
    for (const key in data) {
      if (data.hasOwnProperty(key) && count < maxProperties) {
        sanitized[key] = sanitizeData(data[key], maxDepth - 1);
        count++;
      }
    }
    
    if (Object.keys(data).length > maxProperties) {
      sanitized['...'] = `${Object.keys(data).length - maxProperties} more properties`;
    }
    
    return sanitized;
  }
  
  return String(data);
}

/**
 * Get user agent information
 */
export function getUserAgent(): string {
  if (typeof window !== 'undefined' && window.navigator) {
    return window.navigator.userAgent;
  }
  
  if (typeof process !== 'undefined' && process.version) {
    return `Node.js/${process.version}`;
  }
  
  return 'Unknown';
}

/**
 * Get current URL
 */
export function getCurrentURL(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.href;
  }
  
  return '';
}

/**
 * Get page title
 */
export function getPageTitle(): string {
  if (typeof document !== 'undefined' && document.title) {
    return document.title;
  }
  
  return '';
}

/**
 * Detect environment
 */
export function getEnvironment(): 'browser' | 'node' | 'worker' | 'unknown' {
  if (typeof window !== 'undefined' && window.document) {
    return 'browser';
  }
  
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }
  
  if (typeof self !== 'undefined' && typeof importScripts === 'function') {
    return 'worker';
  }
  
  return 'unknown';
}

/**
 * Check if code is running in development mode
 */
export function isDevelopment(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }
  
  // Browser heuristics
  if (typeof window !== 'undefined') {
    return window.location?.hostname === 'localhost' ||
           window.location?.hostname === '127.0.0.1' ||
           window.location?.port !== '';
  }
  
  return false;
}

/**
 * Simple hash function for strings
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a fingerprint for error grouping
 */
export function generateErrorFingerprint(error: {
  message?: string;
  stack?: string;
  name?: string;
  filename?: string;
}): string {
  const components = [
    error.name || 'Unknown',
    error.message || 'No message',
    error.filename || 'Unknown file'
  ];
  
  // Extract first few lines of stack trace
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 3);
    components.push(...stackLines);
  }
  
  const fingerprint = components.join('|');
  return simpleHash(fingerprint).toString(36);
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration to human readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }
  
  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }
  
  if (milliseconds < 3600000) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
  
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Create a simple logger
 */
export function createLogger(prefix: string, debug = false): Logger {
  const log = (level: string, message: string, ...args: any[]) => {
    if (!debug && level === 'debug') {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${prefix}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        break;
      default:
        console.log(formattedMessage, ...args);
    }
  };
  
  return {
    debug: (message: string, ...args: JSONValue[]) => log('debug', message, ...args),
    info: (message: string, ...args: JSONValue[]) => log('info', message, ...args),
    warn: (message: string, ...args: JSONValue[]) => log('warn', message, ...args),
    error: (message: string, ...args: JSONValue[]) => log('error', message, ...args)
  };
}

/**
 * Wait for a specified amount of time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Truncate string to specified length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/**
 * Get nested property from object safely
 */
export function getNestedProperty(obj: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * Set nested property on object
 */
export function setNestedProperty(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;
  
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
}