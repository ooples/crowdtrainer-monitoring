import { hasLocalStorage } from '../utils';

/**
 * localStorage wrapper for storing monitoring data
 */
export class LocalStorage {
  private prefix: string;
  private available: boolean;

  constructor(prefix = 'monitor_') {
    this.prefix = prefix;
    this.available = hasLocalStorage();
  }

  /** Check if storage is available */
  isAvailable(): boolean {
    return this.available;
  }

  /** Get item from storage */
  get<T>(key: string): T | null {
    if (!this.available) return null;

    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  /** Set item in storage */
  set<T>(key: string, value: T): boolean {
    if (!this.available) return false;

    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /** Remove item from storage */
  remove(key: string): boolean {
    if (!this.available) return false;

    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch {
      return false;
    }
  }

  /** Clear all items with prefix */
  clear(): boolean {
    if (!this.available) return false;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Get all items with prefix */
  getAll<T>(): Record<string, T> {
    if (!this.available) return {};

    const result: Record<string, T> = {};
    
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const unprefixedKey = key.substring(this.prefix.length);
          const item = localStorage.getItem(key);
          if (item) {
            result[unprefixedKey] = JSON.parse(item);
          }
        }
      });
    } catch {
      // Return empty object on error
    }

    return result;
  }

  /** Get storage size in bytes (approximate) */
  getSize(): number {
    if (!this.available) return 0;

    let size = 0;
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const item = localStorage.getItem(key);
          if (item) {
            size += key.length + item.length;
          }
        }
      });
    } catch {
      // Return 0 on error
    }

    return size;
  }

  /** Check if storage is near capacity */
  isNearCapacity(): boolean {
    if (!this.available) return false;

    try {
      // Try to store a test item to check available space
      const testKey = this.prefix + '__capacity_test__';
      const testValue = 'x'.repeat(1024); // 1KB test
      localStorage.setItem(testKey, testValue);
      localStorage.removeItem(testKey);
      return false;
    } catch {
      return true;
    }
  }

  /** Get keys matching pattern */
  getKeys(pattern?: RegExp): string[] {
    if (!this.available) return [];

    const keys: string[] = [];
    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const unprefixedKey = key.substring(this.prefix.length);
          if (!pattern || pattern.test(unprefixedKey)) {
            keys.push(unprefixedKey);
          }
        }
      });
    } catch {
      // Return empty array on error
    }

    return keys;
  }
}