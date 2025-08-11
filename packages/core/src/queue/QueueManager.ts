/**
 * Queue management system for offline support and data buffering
 */

import {
  QueueItem,
  JSONValue,
  UUID,
  Timestamp,
  Storage,
  Logger
} from '../types/index.js';
import { generateId, getCurrentTimestamp } from '../utils/index.js';

export interface QueueManagerConfig {
  /** Maximum items in queue */
  maxSize?: number;
  /** Maximum age of items in milliseconds */
  maxAge?: number;
  /** Storage backend for persistence */
  storage?: Storage;
  /** Enable automatic cleanup of old items */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Default priority for items */
  defaultPriority?: number;
  /** Logger instance */
  logger?: Logger;
}

export interface QueueStats {
  /** Total items in queue */
  size: number;
  /** Oldest item timestamp */
  oldestTimestamp?: Timestamp;
  /** Newest item timestamp */
  newestTimestamp?: Timestamp;
  /** Priority distribution */
  priorityDistribution: Record<number, number>;
  /** Average age of items */
  averageAge: number;
}

export class QueueManager {
  private config: Required<QueueManagerConfig>;
  private queue: QueueItem[] = [];
  private cleanupTimer?: NodeJS.Timer;
  private isDestroyed = false;

  constructor(config: QueueManagerConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      maxAge: config.maxAge ?? 24 * 60 * 60 * 1000, // 24 hours
      storage: config.storage ?? new MemoryStorage(),
      autoCleanup: config.autoCleanup ?? true,
      cleanupInterval: config.cleanupInterval ?? 60 * 1000, // 1 minute
      defaultPriority: config.defaultPriority ?? 0,
      logger: config.logger ?? console
    };

    this.loadFromStorage();

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Add item to queue
   */
  async enqueue(data: JSONValue, priority?: number): Promise<UUID> {
    if (this.isDestroyed) {
      throw new Error('QueueManager is destroyed');
    }

    const item: QueueItem = {
      id: generateId(),
      data,
      retryCount: 0,
      createdAt: getCurrentTimestamp(),
      priority: priority ?? this.config.defaultPriority
    };

    // Insert item maintaining priority order
    this.insertByPriority(item);

    // Enforce size limit
    if (this.queue.length > this.config.maxSize) {
      const removed = this.queue.pop(); // Remove lowest priority item
      this.config.logger.debug('QueueManager: Removed item due to size limit', removed?.id);
    }

    await this.persistToStorage();
    
    this.config.logger.debug('QueueManager: Item enqueued', {
      id: item.id,
      priority: item.priority,
      queueSize: this.queue.length
    });

    return item.id;
  }

  /**
   * Remove and return highest priority item
   */
  async dequeue(): Promise<QueueItem | null> {
    if (this.isDestroyed || this.queue.length === 0) {
      return null;
    }

    const item = this.queue.shift()!;
    await this.persistToStorage();

    this.config.logger.debug('QueueManager: Item dequeued', {
      id: item.id,
      priority: item.priority,
      queueSize: this.queue.length
    });

    return item;
  }

  /**
   * Peek at next item without removing it
   */
  peek(): QueueItem | null {
    return this.queue.length > 0 ? { ...this.queue[0] } : null;
  }

  /**
   * Get item by ID
   */
  getById(id: UUID): QueueItem | null {
    const item = this.queue.find(item => item.id === id);
    return item ? { ...item } : null;
  }

  /**
   * Remove item by ID
   */
  async removeById(id: UUID): Promise<boolean> {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    await this.persistToStorage();

    this.config.logger.debug('QueueManager: Item removed by ID', {
      id,
      queueSize: this.queue.length
    });

    return true;
  }

  /**
   * Update item priority
   */
  async updatePriority(id: UUID, priority: number): Promise<boolean> {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }

    const item = this.queue.splice(index, 1)[0];
    item.priority = priority;
    this.insertByPriority(item);

    await this.persistToStorage();

    this.config.logger.debug('QueueManager: Item priority updated', {
      id,
      priority,
      queueSize: this.queue.length
    });

    return true;
  }

  /**
   * Increment retry count for item
   */
  async incrementRetry(id: UUID): Promise<boolean> {
    const item = this.queue.find(item => item.id === id);
    if (!item) {
      return false;
    }

    item.retryCount++;
    await this.persistToStorage();

    this.config.logger.debug('QueueManager: Item retry count incremented', {
      id,
      retryCount: item.retryCount
    });

    return true;
  }

  /**
   * Get items by priority
   */
  getByPriority(priority: number): QueueItem[] {
    return this.queue
      .filter(item => item.priority === priority)
      .map(item => ({ ...item }));
  }

  /**
   * Get items older than specified age
   */
  getOlderThan(ageMs: number): QueueItem[] {
    const cutoffTime = getCurrentTimestamp() - ageMs;
    return this.queue
      .filter(item => item.createdAt < cutoffTime)
      .map(item => ({ ...item }));
  }

  /**
   * Get items with retry count above threshold
   */
  getHighRetryItems(minRetryCount: number): QueueItem[] {
    return this.queue
      .filter(item => item.retryCount >= minRetryCount)
      .map(item => ({ ...item }));
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    if (this.queue.length === 0) {
      return {
        size: 0,
        priorityDistribution: {},
        averageAge: 0
      };
    }

    const now = getCurrentTimestamp();
    const timestamps = this.queue.map(item => item.createdAt);
    const ages = this.queue.map(item => now - item.createdAt);
    
    const priorityDistribution: Record<number, number> = {};
    for (const item of this.queue) {
      priorityDistribution[item.priority!] = (priorityDistribution[item.priority!] || 0) + 1;
    }

    return {
      size: this.queue.length,
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps),
      priorityDistribution,
      averageAge: ages.reduce((sum, age) => sum + age, 0) / ages.length
    };
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.config.maxSize;
  }

  /**
   * Clear all items from queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persistToStorage();
    this.config.logger.debug('QueueManager: Queue cleared');
  }

  /**
   * Remove expired items
   */
  async cleanup(): Promise<number> {
    const beforeSize = this.queue.length;
    const cutoffTime = getCurrentTimestamp() - this.config.maxAge;
    
    this.queue = this.queue.filter(item => item.createdAt >= cutoffTime);
    
    const removedCount = beforeSize - this.queue.length;
    
    if (removedCount > 0) {
      await this.persistToStorage();
      this.config.logger.debug('QueueManager: Cleanup removed items', {
        removedCount,
        remainingSize: this.queue.length
      });
    }

    return removedCount;
  }

  /**
   * Batch operations: enqueue multiple items
   */
  async enqueueBatch(items: Array<{ data: JSONValue; priority?: number }>): Promise<UUID[]> {
    const ids: UUID[] = [];

    for (const { data, priority } of items) {
      const item: QueueItem = {
        id: generateId(),
        data,
        retryCount: 0,
        createdAt: getCurrentTimestamp(),
        priority: priority ?? this.config.defaultPriority
      };

      this.insertByPriority(item);
      ids.push(item.id);
    }

    // Enforce size limit
    while (this.queue.length > this.config.maxSize) {
      this.queue.pop();
    }

    await this.persistToStorage();

    this.config.logger.debug('QueueManager: Batch enqueued', {
      count: items.length,
      queueSize: this.queue.length
    });

    return ids;
  }

  /**
   * Batch operations: dequeue multiple items
   */
  async dequeueBatch(count: number): Promise<QueueItem[]> {
    const items: QueueItem[] = [];
    const actualCount = Math.min(count, this.queue.length);

    for (let i = 0; i < actualCount; i++) {
      const item = this.queue.shift();
      if (item) {
        items.push(item);
      }
    }

    if (items.length > 0) {
      await this.persistToStorage();
      this.config.logger.debug('QueueManager: Batch dequeued', {
        count: items.length,
        queueSize: this.queue.length
      });
    }

    return items;
  }

  /**
   * Export queue data
   */
  export(): QueueItem[] {
    return this.queue.map(item => ({ ...item }));
  }

  /**
   * Import queue data (replaces current queue)
   */
  async import(items: QueueItem[]): Promise<void> {
    this.queue = items.map(item => ({ ...item }));
    this.queue.sort((a, b) => a.priority! - b.priority!);

    // Enforce size limit
    if (this.queue.length > this.config.maxSize) {
      this.queue = this.queue.slice(0, this.config.maxSize);
    }

    await this.persistToStorage();

    this.config.logger.debug('QueueManager: Queue imported', {
      importedCount: items.length,
      queueSize: this.queue.length
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QueueManagerConfig>): void {
    const wasAutoCleanup = this.config.autoCleanup;
    this.config = { ...this.config, ...config };

    // Handle auto cleanup changes
    if (config.autoCleanup !== undefined && config.autoCleanup !== wasAutoCleanup) {
      if (wasAutoCleanup) {
        this.stopAutoCleanup();
      }
      if (this.config.autoCleanup) {
        this.startAutoCleanup();
      }
    }

    // Enforce new size limit if reduced
    if (config.maxSize && this.queue.length > config.maxSize) {
      this.queue = this.queue.slice(0, config.maxSize);
      this.persistToStorage().catch(error => {
        this.config.logger.error('QueueManager: Failed to persist after size reduction', error);
      });
    }
  }

  /**
   * Destroy queue manager
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.queue = [];
    this.isDestroyed = true;
    this.config.logger.debug('QueueManager: Destroyed');
  }

  /**
   * Insert item maintaining priority order (lower priority = higher precedence)
   */
  private insertByPriority(item: QueueItem): void {
    const insertIndex = this.queue.findIndex(existing => existing.priority! > item.priority!);
    
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }
  }

  /**
   * Load queue from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await this.config.storage.getItem('queue_data');
      if (stored) {
        const items: QueueItem[] = JSON.parse(stored);
        this.queue = items.sort((a, b) => a.priority! - b.priority!);
        
        this.config.logger.debug('QueueManager: Loaded from storage', {
          size: this.queue.length
        });
      }
    } catch (error) {
      this.config.logger.error('QueueManager: Failed to load from storage', error);
    }
  }

  /**
   * Persist queue to storage
   */
  private async persistToStorage(): Promise<void> {
    try {
      const data = JSON.stringify(this.queue);
      await this.config.storage.setItem('queue_data', data);
    } catch (error) {
      this.config.logger.error('QueueManager: Failed to persist to storage', error);
    }
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.config.logger.error('QueueManager: Auto cleanup failed', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

/**
 * Simple in-memory storage implementation
 */
class MemoryStorage implements Storage {
  private data: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}