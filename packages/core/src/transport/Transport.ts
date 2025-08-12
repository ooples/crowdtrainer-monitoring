/**
 * Transport layer abstraction for monitoring SDK
 * Handles sending data to monitoring endpoints with retry logic and offline support
 */

import {
  TransportConfig,
  TransportResponse,
  QueueItem,
  JSONValue,
  Logger,
  Plugin,
  Storage
} from '../types/index.js';
import { generateId, getCurrentTimestamp } from '../utils/index.js';

export interface Transport {
  /** Send data to endpoint */
  send(data: JSONValue): Promise<TransportResponse>;
  /** Send batch of data */
  sendBatch(items: JSONValue[]): Promise<TransportResponse>;
  /** Queue data for later sending */
  queue(data: JSONValue, priority?: number): Promise<void>;
  /** Flush queued data */
  flush(): Promise<TransportResponse[]>;
  /** Get queue size */
  getQueueSize(): number;
  /** Clear queue */
  clearQueue(): void;
  /** Destroy transport */
  destroy(): void;
}

export interface HTTPTransportConfig extends TransportConfig {
  /** API endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Use compression */
  useCompression?: boolean;
  /** Enable offline support */
  enableOfflineSupport?: boolean;
  /** Storage for offline data */
  storage?: Storage;
  /** Logger instance */
  logger?: Logger;
  /** Plugins */
  plugins?: Plugin[];
}

export class HTTPTransport implements Transport {
  private config: Required<HTTPTransportConfig>;
  private internalQueue: QueueItem[] = [];
  private isOnline = true;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isDestroyed = false;
  private flushInProgress = false;

  constructor(config: HTTPTransportConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 10000,
      batchSize: config.batchSize ?? 100,
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      headers: config.headers ?? {},
      useCompression: config.useCompression ?? true,
      enableOfflineSupport: config.enableOfflineSupport ?? true,
      storage: config.storage ?? new MemoryStorage(),
      logger: config.logger ?? console,
      plugins: config.plugins ?? []
    };

    this.setupNetworkMonitoring();
    this.loadQueueFromStorage();
  }

  /**
   * Send single item
   */
  async send(data: JSONValue): Promise<TransportResponse> {
    if (this.isDestroyed) {
      return { status: 'error', message: 'Transport is destroyed' };
    }

    // Apply plugins
    const processedData = this.applyBeforeSendPlugins(data);
    if (processedData === null) {
      return { status: 'success', message: 'Data filtered by plugin' };
    }

    if (!this.isOnline && this.config.enableOfflineSupport) {
      await this.queueItem(processedData);
      return { status: 'success', message: 'Queued for offline sending' };
    }

    try {
      const response = await this.sendRequest([processedData]);
      this.applyAfterSendPlugins(response);
      return response;
    } catch (error) {
      this.config.logger.error('HTTPTransport: Send failed', error as unknown as JSONValue);
      
      if (this.config.enableOfflineSupport) {
        await this.queueItem(processedData);
        return { status: 'success', message: 'Queued after send failure' };
      }
      
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send batch of items
   */
  async sendBatch(items: JSONValue[]): Promise<TransportResponse> {
    if (this.isDestroyed) {
      return { status: 'error', message: 'Transport is destroyed' };
    }

    if (items.length === 0) {
      return { status: 'success', message: 'No items to send' };
    }

    // Apply plugins to each item
    const processedItems = items
      .map(item => this.applyBeforeSendPlugins(item))
      .filter((item): item is JSONValue => item !== null);

    if (processedItems.length === 0) {
      return { status: 'success', message: 'All items filtered by plugins' };
    }

    if (!this.isOnline && this.config.enableOfflineSupport) {
      for (const item of processedItems) {
        await this.queueItem(item);
      }
      return { status: 'success', message: 'Batch queued for offline sending' };
    }

    try {
      const response = await this.sendRequest(processedItems);
      this.applyAfterSendPlugins(response);
      return response;
    } catch (error) {
      this.config.logger.error('HTTPTransport: Batch send failed', error as unknown as JSONValue);
      
      if (this.config.enableOfflineSupport) {
        for (const item of processedItems) {
          await this.queueItem(item);
        }
        return { status: 'success', message: 'Batch queued after send failure' };
      }
      
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Queue data for later sending
   */
  async queue(data: JSONValue, priority?: number): Promise<void> {
    await this.queueItem(data, priority);
  }

  /**
   * Internal queue implementation
   */
  private async queueItem(data: JSONValue, priority: number = 0): Promise<void> {
    const item: QueueItem = {
      id: generateId(),
      data,
      retryCount: 0,
      createdAt: getCurrentTimestamp(),
      priority
    };

    this.internalQueue.push(item);
    
    // Sort by priority (lower number = higher priority)
    this.internalQueue.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    // Save to storage
    if (this.config.enableOfflineSupport) {
      await this.saveQueueToStorage();
    }

    this.config.logger.debug('HTTPTransport: Item queued', { id: item.id, queueSize: this.internalQueue.length });
  }

  /**
   * Flush queued data
   */
  async flush(): Promise<TransportResponse[]> {
    if (this.isDestroyed || this.flushInProgress) {
      return [];
    }

    if (this.internalQueue.length === 0) {
      return [];
    }

    this.flushInProgress = true;
    const responses: TransportResponse[] = [];

    try {
      // Process queue in batches
      while (this.internalQueue.length > 0) {
        const batch = this.internalQueue.splice(0, this.config.batchSize);
        const items = batch.map(item => item.data);

        try {
          const response = await this.sendRequest(items);
          responses.push(response);
          
          // Remove items from retry timeouts
          batch.forEach(item => {
            const timeout = this.retryTimeouts.get(item.id);
            if (timeout) {
              clearTimeout(timeout);
              this.retryTimeouts.delete(item.id);
            }
          });

          this.applyAfterSendPlugins(response);
        } catch (error) {
          // Re-queue failed items with retry logic
          for (const item of batch) {
            if (item.retryCount < this.config.maxRetries) {
              item.retryCount++;
              await this.scheduleRetry(item);
            } else {
              this.config.logger.error('HTTPTransport: Item exceeded max retries', { id: item.id });
            }
          }

          responses.push({ 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // Save updated queue to storage
      if (this.config.enableOfflineSupport) {
        await this.saveQueueToStorage();
      }

    } finally {
      this.flushInProgress = false;
    }

    this.config.logger.debug(`HTTPTransport: Flush completed, ${responses.length} responses`);
    return responses;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.internalQueue.length;
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    // Clear retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    // Clear queue
    this.internalQueue = [];
    
    // Clear storage
    if (this.config.enableOfflineSupport) {
      this.config.storage.removeItem('transport_queue').catch(error => {
        this.config.logger.error('HTTPTransport: Failed to clear queue from storage', error);
      });
    }

    this.config.logger.debug('HTTPTransport: Queue cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HTTPTransportConfig>): void {
    this.config = { ...this.config, ...config };
    this.config.logger.debug('HTTPTransport: Configuration updated');
  }

  /**
   * Destroy transport
   */
  destroy(): void {
    this.clearQueue();
    this.teardownNetworkMonitoring();
    this.isDestroyed = true;
    this.config.logger.debug('HTTPTransport: Destroyed');
  }

  /**
   * Send HTTP request
   */
  private async sendRequest(items: JSONValue[]): Promise<TransportResponse> {
    const payload = {
      timestamp: getCurrentTimestamp(),
      items,
      sdk: {
        name: '@monitoring-service/core',
        version: '1.0.0'
      }
    };

    const requestBody = JSON.stringify(payload);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'MonitoringSDK/1.0.0',
      ...this.config.headers
    };

    // Add compression header if enabled
    if (this.config.useCompression) {
      headers['Content-Encoding'] = 'gzip';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const responseData = await response.json().catch(() => ({}));
        return {
          status: 'success',
          data: responseData
        };
      } else {
        const errorData = await response.text().catch(() => 'Unknown error');
        
        // Determine if we should retry
        const shouldRetry = response.status >= 500 || response.status === 429;
        
        return {
          status: shouldRetry ? 'retry' : 'error',
          message: `HTTP ${response.status}: ${errorData}`
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return { status: 'error', message: 'Request timeout' };
      }
      
      return { 
        status: 'retry', 
        message: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Schedule retry for failed item
   */
  private async scheduleRetry(item: QueueItem): Promise<void> {
    const delay = this.config.retryDelay * Math.pow(2, item.retryCount - 1); // Exponential backoff
    
    const timeoutId = setTimeout(async () => {
      this.retryTimeouts.delete(item.id);
      
      try {
        const response = await this.sendRequest([item.data]);
        if (response.status === 'success') {
          this.config.logger.debug('HTTPTransport: Retry succeeded', { id: item.id });
          this.applyAfterSendPlugins(response);
        } else {
          // Schedule another retry if not at max retries
          if (item.retryCount < this.config.maxRetries) {
            item.retryCount++;
            await this.scheduleRetry(item);
          } else {
            this.config.logger.error('HTTPTransport: Item exceeded max retries after scheduled retry', { id: item.id });
          }
        }
      } catch (error) {
        // Schedule another retry if not at max retries
        if (item.retryCount < this.config.maxRetries) {
          item.retryCount++;
          await this.scheduleRetry(item);
        } else {
          this.config.logger.error('HTTPTransport: Item exceeded max retries after scheduled retry', { id: item.id });
        }
      }
    }, delay);

    this.retryTimeouts.set(item.id, timeoutId);
  }

  /**
   * Apply before send plugins
   */
  private applyBeforeSendPlugins(data: JSONValue): JSONValue | null {
    let processedData = data;

    for (const plugin of this.config.plugins) {
      if (plugin.handlers?.onBeforeSend) {
        const result = plugin.handlers.onBeforeSend(processedData);
        if (result === null) {
          return null; // Plugin filtered out the data
        }
        processedData = result;
      }
    }

    return processedData;
  }

  /**
   * Apply after send plugins
   */
  private applyAfterSendPlugins(response: TransportResponse): void {
    for (const plugin of this.config.plugins) {
      if (plugin.handlers?.onAfterSend) {
        plugin.handlers.onAfterSend(response);
      }
    }
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    if (typeof window === 'undefined' || !window.navigator) {
      return;
    }

    // Initial online status
    this.isOnline = navigator.onLine;

    // Listen for online/offline events
    const handleOnline = () => {
      this.isOnline = true;
      this.config.logger.debug('HTTPTransport: Network online, flushing queue');
      this.flush().catch(error => {
        this.config.logger.error('HTTPTransport: Failed to flush queue on network online', error);
      });
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.config.logger.debug('HTTPTransport: Network offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Store handlers for cleanup
    (this as any)._networkHandlers = { handleOnline, handleOffline };
  }

  /**
   * Teardown network monitoring
   */
  private teardownNetworkMonitoring(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const handlers = (this as any)._networkHandlers;
    if (handlers) {
      window.removeEventListener('online', handlers.handleOnline);
      window.removeEventListener('offline', handlers.handleOffline);
      delete (this as any)._networkHandlers;
    }
  }

  /**
   * Load queue from storage
   */
  private async loadQueueFromStorage(): Promise<void> {
    if (!this.config.enableOfflineSupport) {
      return;
    }

    try {
      const queueData = await this.config.storage.getItem('transport_queue');
      if (queueData) {
        const parsedQueue = JSON.parse(queueData) as QueueItem[];
        this.internalQueue = parsedQueue;
        this.config.logger.debug(`HTTPTransport: Loaded ${this.internalQueue.length} items from storage`);
      }
    } catch (error) {
      this.config.logger.error('HTTPTransport: Failed to load queue from storage', error as unknown as JSONValue);
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      const queueData = JSON.stringify(this.internalQueue);
      await this.config.storage.setItem('transport_queue', queueData);
    } catch (error) {
      this.config.logger.error('HTTPTransport: Failed to save queue to storage', error as unknown as JSONValue);
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

/**
 * LocalStorage-based storage implementation for browsers
 */
export class LocalStorageAdapter implements Storage {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage quota exceeded or other error
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      localStorage.removeItem(key);
    } catch {
      // Error removing item
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      localStorage.clear();
    } catch {
      // Error clearing storage
    }
  }
}