/**
 * Webhook Manager for Custom Notification Endpoints
 * 
 * Features:
 * - Custom webhook configuration and management
 * - Multiple authentication methods (Bearer, Basic, API Key)
 * - Webhook payload transformation and templating
 * - Retry mechanism with exponential backoff
 * - Webhook health monitoring and alerting
 * - Signature verification for security
 * - Bulk webhook delivery
 * - Webhook event filtering
 */

import { 
  BaseNotification, 
  WebhookConfig, 
  ChannelResult,
  RetryConfig
} from '../types/index.js';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import handlebars from 'handlebars';

export interface WebhookEndpoint {
  /** Unique webhook ID */
  id: string;
  /** Webhook name */
  name: string;
  /** Webhook description */
  description: string;
  /** Webhook configuration */
  config: WebhookConfig;
  /** Enable/disable webhook */
  enabled: boolean;
  /** Event filters */
  filters?: WebhookFilter[];
  /** Webhook statistics */
  stats?: WebhookStats;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

export interface WebhookFilter {
  /** Filter field path */
  field: string;
  /** Filter operator */
  operator: 'equals' | 'contains' | 'in' | 'greater_than' | 'less_than';
  /** Filter value */
  value: any;
}

export interface WebhookStats {
  /** Total attempts */
  totalAttempts: number;
  /** Successful deliveries */
  successful: number;
  /** Failed deliveries */
  failed: number;
  /** Success rate */
  successRate: number;
  /** Average response time */
  avgResponseTime: number;
  /** Last attempt timestamp */
  lastAttempt?: number;
  /** Last success timestamp */
  lastSuccess?: number;
}

export interface WebhookPayload {
  /** Webhook event type */
  event: string;
  /** Event timestamp */
  timestamp: number;
  /** Notification data */
  notification: BaseNotification;
  /** Webhook metadata */
  webhook: {
    id: string;
    name: string;
    attempt: number;
  };
  /** Signature for verification */
  signature?: string;
}

export interface WebhookDeliveryResult {
  /** Webhook ID */
  webhookId: string;
  /** Delivery status */
  status: 'success' | 'failed' | 'retry';
  /** HTTP status code */
  statusCode?: number;
  /** Response body */
  response?: any;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error message if failed */
  error?: string;
  /** Next retry timestamp */
  nextRetry?: number;
}

export class WebhookManager {
  private webhooks: Map<string, WebhookEndpoint> = new Map();
  // private deliveryQueue: Map<string, WebhookDeliveryAttempt[]> = new Map();
  private templateCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.registerHandlebarsHelpers();
  }

  /**
   * Register a new webhook endpoint
   */
  register(webhook: Omit<WebhookEndpoint, 'id' | 'stats' | 'createdAt' | 'updatedAt'>): WebhookEndpoint {
    const id = this.generateWebhookId();
    const now = Date.now();
    
    const newWebhook: WebhookEndpoint = {
      id,
      ...webhook,
      stats: {
        totalAttempts: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        avgResponseTime: 0
      },
      createdAt: now,
      updatedAt: now
    };

    this.webhooks.set(id, newWebhook);
    return newWebhook;
  }

  /**
   * Update webhook configuration
   */
  update(id: string, updates: Partial<WebhookEndpoint>): WebhookEndpoint | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    const updatedWebhook = {
      ...webhook,
      ...updates,
      id, // Prevent ID changes
      updatedAt: Date.now()
    };

    this.webhooks.set(id, updatedWebhook);
    return updatedWebhook;
  }

  /**
   * Remove webhook endpoint
   */
  remove(id: string): boolean {
    return this.webhooks.delete(id);
  }

  /**
   * Get webhook by ID
   */
  get(id: string): WebhookEndpoint | null {
    return this.webhooks.get(id) || null;
  }

  /**
   * List all webhooks
   */
  list(filters?: { enabled?: boolean; name?: string }): WebhookEndpoint[] {
    let webhooks = Array.from(this.webhooks.values());

    if (filters) {
      if (filters.enabled !== undefined) {
        webhooks = webhooks.filter(w => w.enabled === filters.enabled);
      }
      if (filters.name) {
        webhooks = webhooks.filter(w => 
          w.name.toLowerCase().includes(filters.name!.toLowerCase())
        );
      }
    }

    return webhooks;
  }

  /**
   * Send notification to all matching webhooks
   */
  async sendNotification(notification: BaseNotification): Promise<ChannelResult[]> {
    const matchingWebhooks = this.findMatchingWebhooks(notification);
    const results: ChannelResult[] = [];

    for (const webhook of matchingWebhooks) {
      try {
        const result = await this.sendToWebhook(webhook, notification);
        results.push({
          channel: 'webhook',
          status: result.status === 'success' ? 'sent' : 'failed',
          messageId: `${webhook.id}-${Date.now()}`,
          latency: result.responseTime,
          error: result.error
        });
      } catch (error) {
        results.push({
          channel: 'webhook',
          status: 'failed',
          messageId: `${webhook.id}-${Date.now()}`,
          latency: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Send notification to specific webhook
   */
  async sendToWebhook(
    webhook: WebhookEndpoint, 
    notification: BaseNotification
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    
    try {
      // Check if webhook passes filters
      if (!this.passesFilters(notification, webhook.filters)) {
        return {
          webhookId: webhook.id,
          status: 'success',
          responseTime: 0,
          error: 'Filtered out'
        };
      }

      // Build webhook payload
      const payload = await this.buildPayload(webhook, notification);
      
      // Create HTTP request config
      const requestConfig = this.buildRequestConfig(webhook.config, payload);
      
      // Send webhook
      const response = await this.sendHttpRequest(requestConfig);
      const responseTime = Date.now() - startTime;

      // Update statistics
      this.updateWebhookStats(webhook.id, true, responseTime);

      return {
        webhookId: webhook.id,
        status: 'success',
        statusCode: response.status,
        response: response.data,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update statistics
      this.updateWebhookStats(webhook.id, false, responseTime);

      return {
        webhookId: webhook.id,
        status: 'failed',
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Send notification to webhook with retry
   */
  async sendWithRetry(
    webhook: WebhookEndpoint,
    notification: BaseNotification,
    retryConfig: RetryConfig
  ): Promise<WebhookDeliveryResult> {
    let lastResult: WebhookDeliveryResult | null = null;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await this.sendToWebhook(webhook, notification);
        
        if (result.status === 'success') {
          return result;
        }
        
        lastResult = result;
        
        // Calculate retry delay with exponential backoff
        if (attempt < retryConfig.maxAttempts) {
          const delay = Math.min(
            retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxDelay
          );
          
          // Add jitter
          const jitter = delay * retryConfig.jitter * Math.random();
          const totalDelay = delay + jitter;
          
          await this.delay(totalDelay);
        }
      } catch (error) {
        lastResult = {
          webhookId: webhook.id,
          status: 'failed',
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return lastResult || {
      webhookId: webhook.id,
      status: 'failed',
      responseTime: 0,
      error: 'Max retries exceeded'
    };
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(id: string): Promise<{
    success: boolean;
    responseTime: number;
    statusCode?: number;
    error?: string;
  }> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testNotification: BaseNotification = {
      id: 'test-' + Date.now(),
      title: 'Test Webhook Notification',
      message: 'This is a test notification to verify webhook delivery.',
      severity: 'info',
      priority: 5,
      category: 'system',
      source: 'webhook-test',
      timestamp: Date.now(),
      tags: { test: 'true' },
      metadata: {},
      recipients: [],
      delivery: {
        channels: ['webhook'],
        retry: { maxAttempts: 1, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 30000, jitter: 0.1 },
        timeout: 30000
      }
    };

    const result = await this.sendToWebhook(webhook, testNotification);
    
    return {
      success: result.status === 'success',
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      error: result.error
    };
  }

  /**
   * Find webhooks matching notification filters
   */
  private findMatchingWebhooks(notification: BaseNotification): WebhookEndpoint[] {
    return Array.from(this.webhooks.values()).filter(webhook => {
      return webhook.enabled && this.passesFilters(notification, webhook.filters);
    });
  }

  /**
   * Check if notification passes webhook filters
   */
  private passesFilters(
    notification: BaseNotification, 
    filters?: WebhookFilter[]
  ): boolean {
    if (!filters || filters.length === 0) {
      return true;
    }

    return filters.every(filter => {
      const value = this.getFieldValue(notification, filter.field);
      return this.evaluateFilter(value, filter.operator, filter.value);
    });
  }

  /**
   * Get field value from notification
   */
  private getFieldValue(notification: BaseNotification, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value: any = notification;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate filter condition
   */
  private evaluateFilter(value: any, operator: string, filterValue: any): boolean {
    switch (operator) {
      case 'equals':
        return value === filterValue;
      case 'contains':
        return typeof value === 'string' && value.includes(filterValue);
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'greater_than':
        return typeof value === 'number' && value > filterValue;
      case 'less_than':
        return typeof value === 'number' && value < filterValue;
      default:
        return false;
    }
  }

  /**
   * Build webhook payload
   */
  private async buildPayload(
    webhook: WebhookEndpoint, 
    notification: BaseNotification
  ): Promise<WebhookPayload> {
    const payload: WebhookPayload = {
      event: 'notification',
      timestamp: Date.now(),
      notification,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        attempt: 1
      }
    };

    // Apply custom template if configured
    if (webhook.config.template) {
      const template = await this.getTemplate(webhook.config.template);
      const customPayload = template({ notification, webhook: payload.webhook });
      return JSON.parse(customPayload);
    }

    // Add signature if secret is configured
    if (webhook.config.auth?.type === 'api-key' && webhook.config.auth.apiKey) {
      payload.signature = this.generateSignature(JSON.stringify(payload), webhook.config.auth.apiKey);
    }

    return payload;
  }

  /**
   * Build HTTP request configuration
   */
  private buildRequestConfig(config: WebhookConfig, payload: WebhookPayload): AxiosRequestConfig {
    const requestConfig: AxiosRequestConfig = {
      method: config.method,
      url: config.url,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MonitoringService-Webhooks/1.0',
        ...config.headers
      },
      timeout: config.timeout,
      validateStatus: (status) => status < 500 // Retry on 5xx errors
    };

    // Add authentication
    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          requestConfig.headers!['Authorization'] = `Bearer ${config.auth.token}`;
          break;
        case 'basic':
          const credentials = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
          requestConfig.headers!['Authorization'] = `Basic ${credentials}`;
          break;
        case 'api-key':
          const headerName = config.auth.apiKeyHeader || 'X-API-Key';
          requestConfig.headers![headerName] = config.auth.apiKey;
          break;
      }
    }

    return requestConfig;
  }

  /**
   * Send HTTP request
   */
  private async sendHttpRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return axios(config);
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Update webhook statistics
   */
  private updateWebhookStats(
    webhookId: string, 
    success: boolean, 
    responseTime: number
  ): void {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook || !webhook.stats) return;

    const stats = webhook.stats;
    stats.totalAttempts++;
    
    if (success) {
      stats.successful++;
      stats.lastSuccess = Date.now();
    } else {
      stats.failed++;
    }
    
    stats.successRate = stats.successful / stats.totalAttempts;
    stats.avgResponseTime = (stats.avgResponseTime * (stats.totalAttempts - 1) + responseTime) / stats.totalAttempts;
    stats.lastAttempt = Date.now();

    webhook.updatedAt = Date.now();
  }

  /**
   * Get compiled template
   */
  private async getTemplate(templateString: string): Promise<handlebars.TemplateDelegate> {
    const templateKey = crypto.createHash('md5').update(templateString).digest('hex');
    
    if (this.templateCache.has(templateKey)) {
      return this.templateCache.get(templateKey)!;
    }

    const template = handlebars.compile(templateString);
    this.templateCache.set(templateKey, template);
    return template;
  }

  /**
   * Register Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj);
    });

    handlebars.registerHelper('formatDate', (timestamp: number) => {
      return new Date(timestamp).toISOString();
    });

    handlebars.registerHelper('upper', (str: string) => {
      return str ? str.toUpperCase() : '';
    });
  }

  /**
   * Generate unique webhook ID
   */
  private generateWebhookId(): string {
    return 'webhook-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get webhook health status
   */
  getHealth(): {
    totalWebhooks: number;
    enabledWebhooks: number;
    avgSuccessRate: number;
    recentErrors: number;
  } {
    const webhooks = Array.from(this.webhooks.values());
    const enabledWebhooks = webhooks.filter(w => w.enabled);
    
    const totalSuccess = enabledWebhooks.reduce((sum, w) => sum + (w.stats?.successRate || 0), 0);
    const avgSuccessRate = enabledWebhooks.length > 0 ? totalSuccess / enabledWebhooks.length : 0;
    
    // Count recent errors (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = enabledWebhooks.filter(w => 
      w.stats?.lastAttempt && 
      w.stats.lastAttempt > oneHourAgo && 
      (!w.stats.lastSuccess || w.stats.lastSuccess < w.stats.lastAttempt)
    ).length;

    return {
      totalWebhooks: webhooks.length,
      enabledWebhooks: enabledWebhooks.length,
      avgSuccessRate,
      recentErrors
    };
  }
}

interface WebhookDeliveryAttempt {
  id: string;
  webhookId: string;
  notification: BaseNotification;
  attempt: number;
  scheduledAt: number;
  result?: WebhookDeliveryResult;
}

/**
 * Webhook Manager Factory
 */
export class WebhookManagerFactory {
  static create(): WebhookManager {
    return new WebhookManager();
  }

  static validateWebhookConfig(config: WebhookConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.url) {
      errors.push('Webhook URL is required');
    } else {
      try {
        new URL(config.url);
      } catch {
        errors.push('Invalid webhook URL format');
      }
    }

    if (!config.method || !['POST', 'PUT', 'PATCH'].includes(config.method)) {
      errors.push('Valid HTTP method (POST, PUT, PATCH) is required');
    }

    if (!config.timeout || config.timeout <= 0) {
      errors.push('Timeout must be a positive number');
    }

    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          if (!config.auth.token) {
            errors.push('Bearer token is required for bearer authentication');
          }
          break;
        case 'basic':
          if (!config.auth.username || !config.auth.password) {
            errors.push('Username and password are required for basic authentication');
          }
          break;
        case 'api-key':
          if (!config.auth.apiKey) {
            errors.push('API key is required for API key authentication');
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export types
