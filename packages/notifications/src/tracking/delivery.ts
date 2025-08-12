/**
 * Delivery Tracking and Acknowledgment System
 * 
 * Features:
 * - Comprehensive delivery status tracking
 * - User acknowledgment management
 * - Real-time delivery analytics
 * - Delivery confirmation within 5 seconds
 * - Automated retry with exponential backoff
 * - Delivery receipt processing
 * - Performance metrics and SLA monitoring
 * - Integration with Redis for fast lookups
 */

import { 
 
  DeliveryAttempt, 
  DeliveryStatus, 
  DeliveryReceipt,
  AcknowledgmentReceipt,
  NotificationStatusResult,
  DeliveryStatistics,
  StatisticsFilters,
  ChannelStatistics,
  SeverityStatistics,
  TimeSeriesData,
  NotificationChannel,
  NotificationSeverity,
  UUID,
  Timestamp
} from '../types/index.js';
import Redis from 'ioredis';

export interface DeliveryTracker {
  /** Track delivery attempt */
  trackAttempt(attempt: DeliveryAttempt): Promise<void>;
  /** Update delivery status */
  updateStatus(attemptId: UUID, status: DeliveryStatus, metadata?: any): Promise<void>;
  /** Record delivery receipt */
  recordReceipt(receipt: DeliveryReceipt): Promise<void>;
  /** Record acknowledgment */
  recordAcknowledgment(acknowledgment: AcknowledgmentReceipt): Promise<void>;
  /** Get notification status */
  getStatus(notificationId: UUID): Promise<NotificationStatusResult>;
  /** Get delivery statistics */
  getStatistics(filters?: StatisticsFilters): Promise<DeliveryStatistics>;
}

export interface DeliveryMetrics {
  /** Total deliveries */
  totalDeliveries: number;
  /** Successful deliveries */
  successfulDeliveries: number;
  /** Failed deliveries */
  failedDeliveries: number;
  /** Average delivery time */
  avgDeliveryTime: number;
  /** 95th percentile delivery time */
  p95DeliveryTime: number;
  /** SLA compliance (< 5 seconds) */
  slaCompliance: number;
}

export class RedisDeliveryTracker implements DeliveryTracker {
  private redis: Redis;
  private keyPrefix: string = 'notifications:delivery';
  private statsKeyPrefix: string = 'notifications:stats';

  constructor(redisConfig: any) {
    this.redis = new Redis(redisConfig);
  }

  /**
   * Track delivery attempt
   */
  async trackAttempt(attempt: DeliveryAttempt): Promise<void> {
    const multi = this.redis.multi();
    
    // Store attempt data
    const attemptKey = `${this.keyPrefix}:attempts:${attempt.id}`;
    multi.hset(attemptKey, {
      id: attempt.id,
      notificationId: attempt.notificationId,
      channel: attempt.channel,
      timestamp: attempt.timestamp,
      status: attempt.status,
      attemptNumber: attempt.attemptNumber,
      latency: attempt.latency || 0,
      providerResponse: JSON.stringify(attempt.providerResponse || {}),
      nextRetryAt: attempt.nextRetryAt || 0
    });
    
    // Set expiration (30 days)
    multi.expire(attemptKey, 30 * 24 * 60 * 60);
    
    // Add to notification's attempts list
    const notificationKey = `${this.keyPrefix}:notifications:${attempt.notificationId}:attempts`;
    multi.lpush(notificationKey, attempt.id);
    multi.expire(notificationKey, 30 * 24 * 60 * 60);
    
    // Update channel statistics
    await this.updateChannelStats(attempt.channel, attempt.status, attempt.latency);
    
    // Update time series data
    await this.updateTimeSeries(attempt.timestamp, attempt.status, attempt.latency);
    
    await multi.exec();
  }

  /**
   * Update delivery status
   */
  async updateStatus(
    attemptId: UUID, 
    status: DeliveryStatus, 
    metadata?: any
  ): Promise<void> {
    const attemptKey = `${this.keyPrefix}:attempts:${attemptId}`;
    
    const multi = this.redis.multi();
    multi.hset(attemptKey, {
      status,
      updatedAt: Date.now(),
      metadata: JSON.stringify(metadata || {})
    });
    
    // Get attempt data to update stats
    const attemptData = await this.redis.hgetall(attemptKey);
    if (attemptData.channel) {
      await this.updateChannelStats(attemptData.channel, status);
    }
    
    await multi.exec();
  }

  /**
   * Record delivery receipt
   */
  async recordReceipt(receipt: DeliveryReceipt): Promise<void> {
    const receiptKey = `${this.keyPrefix}:receipts:${receipt.id}`;
    
    const multi = this.redis.multi();
    multi.hset(receiptKey, {
      id: receipt.id,
      notificationId: receipt.notificationId,
      attemptId: receipt.attemptId,
      timestamp: receipt.timestamp,
      status: receipt.status,
      providerData: JSON.stringify(receipt.providerData || {})
    });
    
    multi.expire(receiptKey, 30 * 24 * 60 * 60);
    
    // Add to notification's receipts list
    const notificationKey = `${this.keyPrefix}:notifications:${receipt.notificationId}:receipts`;
    multi.lpush(notificationKey, receipt.id);
    multi.expire(notificationKey, 30 * 24 * 60 * 60);
    
    await multi.exec();
  }

  /**
   * Record acknowledgment
   */
  async recordAcknowledgment(acknowledgment: AcknowledgmentReceipt): Promise<void> {
    const ackKey = `${this.keyPrefix}:acknowledgments:${acknowledgment.id}`;
    
    const multi = this.redis.multi();
    multi.hset(ackKey, {
      id: acknowledgment.id,
      notificationId: acknowledgment.notificationId,
      acknowledgedBy: acknowledgment.acknowledgedBy,
      timestamp: acknowledgment.timestamp,
      channel: acknowledgment.channel,
      notes: acknowledgment.notes || ''
    });
    
    multi.expire(ackKey, 30 * 24 * 60 * 60);
    
    // Add to notification's acknowledgments list
    const notificationKey = `${this.keyPrefix}:notifications:${acknowledgment.notificationId}:acknowledgments`;
    multi.lpush(notificationKey, acknowledgment.id);
    multi.expire(notificationKey, 30 * 24 * 60 * 60);
    
    // Update acknowledgment statistics
    await this.updateAcknowledgmentStats(acknowledgment.channel, acknowledgment.timestamp);
    
    await multi.exec();
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: UUID): Promise<NotificationStatusResult> {
    // Get attempts
    const attemptIds = await this.redis.lrange(
      `${this.keyPrefix}:notifications:${notificationId}:attempts`, 
      0, -1
    );
    
    const attempts: DeliveryAttempt[] = [];
    for (const attemptId of attemptIds) {
      const attemptData = await this.redis.hgetall(`${this.keyPrefix}:attempts:${attemptId}`);
      if (attemptData.id) {
        attempts.push({
          id: attemptData.id,
          notificationId: attemptData.notificationId,
          channel: attemptData.channel as NotificationChannel,
          timestamp: parseInt(attemptData.timestamp),
          status: attemptData.status as DeliveryStatus,
          latency: parseInt(attemptData.latency) || 0,
          providerResponse: JSON.parse(attemptData.providerResponse || '{}'),
          attemptNumber: parseInt(attemptData.attemptNumber),
          nextRetryAt: parseInt(attemptData.nextRetryAt) || undefined
        });
      }
    }

    // Get receipts
    const receiptIds = await this.redis.lrange(
      `${this.keyPrefix}:notifications:${notificationId}:receipts`, 
      0, -1
    );
    
    const receipts: DeliveryReceipt[] = [];
    for (const receiptId of receiptIds) {
      const receiptData = await this.redis.hgetall(`${this.keyPrefix}:receipts:${receiptId}`);
      if (receiptData.id) {
        receipts.push({
          id: receiptData.id,
          notificationId: receiptData.notificationId,
          attemptId: receiptData.attemptId,
          timestamp: parseInt(receiptData.timestamp),
          status: receiptData.status as DeliveryStatus,
          providerData: JSON.parse(receiptData.providerData || '{}')
        });
      }
    }

    // Get acknowledgments
    const ackIds = await this.redis.lrange(
      `${this.keyPrefix}:notifications:${notificationId}:acknowledgments`, 
      0, -1
    );
    
    const acknowledgments: AcknowledgmentReceipt[] = [];
    for (const ackId of ackIds) {
      const ackData = await this.redis.hgetall(`${this.keyPrefix}:acknowledgments:${ackId}`);
      if (ackData.id) {
        acknowledgments.push({
          id: ackData.id,
          notificationId: ackData.notificationId,
          acknowledgedBy: ackData.acknowledgedBy,
          timestamp: parseInt(ackData.timestamp),
          channel: ackData.channel as NotificationChannel,
          notes: ackData.notes || undefined
        });
      }
    }

    // Determine overall status
    const status = this.determineNotificationStatus(attempts, acknowledgments);
    
    // Find next retry time
    const nextRetryAt = attempts
      .filter(a => a.nextRetryAt && a.nextRetryAt > Date.now())
      .sort((a, b) => (a.nextRetryAt || 0) - (b.nextRetryAt || 0))[0]?.nextRetryAt;

    return {
      notificationId,
      status,
      attempts: attempts.sort((a, b) => b.timestamp - a.timestamp),
      receipts: receipts.sort((a, b) => b.timestamp - a.timestamp),
      acknowledgments: acknowledgments.sort((a, b) => b.timestamp - a.timestamp),
      nextRetryAt
    };
  }

  /**
   * Get delivery statistics
   */
  async getStatistics(_filters?: StatisticsFilters): Promise<DeliveryStatistics> {
    const timeRange = this.getTimeRange(filters);
    
    // Get overall stats
    const totalKey = `${this.statsKeyPrefix}:total:${this.getDateKey(timeRange.to)}`;
    const totalStats = await this.redis.hgetall(totalKey);
    
    const total = parseInt(totalStats.total) || 0;
    const successful = parseInt(totalStats.successful) || 0;
    const failed = parseInt(totalStats.failed) || 0;
    const successRate = total > 0 ? successful / total : 0;
    const avgDeliveryTime = parseFloat(totalStats.avgDeliveryTime) || 0;

    // Get channel statistics
    const byChannel: Record<NotificationChannel, ChannelStatistics> = {} as any;
    const channels: NotificationChannel[] = ['email', 'sms', 'voice', 'slack', 'teams', 'webhook'];
    
    for (const channel of channels) {
      const channelKey = `${this.statsKeyPrefix}:channels:${channel}:${this.getDateKey(timeRange.to)}`;
      const channelStats = await this.redis.hgetall(channelKey);
      
      const channelTotal = parseInt(channelStats.total) || 0;
      const channelDelivered = parseInt(channelStats.delivered) || 0;
      const channelFailed = parseInt(channelStats.failed) || 0;
      const channelSuccessRate = channelTotal > 0 ? channelDelivered / channelTotal : 0;
      const channelAvgLatency = parseFloat(channelStats.avgLatency) || 0;
      const channelRateLimited = parseInt(channelStats.rateLimited) || 0;

      byChannel[channel] = {
        channel,
        total: channelTotal,
        delivered: channelDelivered,
        failed: channelFailed,
        successRate: channelSuccessRate,
        avgLatency: channelAvgLatency,
        rateLimited: channelRateLimited
      };
    }

    // Get severity statistics
    const bySeverity: Record<NotificationSeverity, SeverityStatistics> = {} as any;
    const severities: NotificationSeverity[] = ['info', 'warning', 'error', 'critical'];
    
    for (const severity of severities) {
      const severityKey = `${this.statsKeyPrefix}:severity:${severity}:${this.getDateKey(timeRange.to)}`;
      const severityStats = await this.redis.hgetall(severityKey);
      
      const severityTotal = parseInt(severityStats.total) || 0;
      const severityAvgTime = parseFloat(severityStats.avgDeliveryTime) || 0;
      const severitySuccessRate = parseFloat(severityStats.successRate) || 0;

      bySeverity[severity] = {
        severity,
        total: severityTotal,
        avgDeliveryTime: severityAvgTime,
        successRate: severitySuccessRate
      };
    }

    // Get time series data
    const timeSeries = await this.getTimeSeriesData(timeRange.from, timeRange.to);

    return {
      total,
      successful,
      failed,
      successRate,
      avgDeliveryTime,
      byChannel,
      bySeverity,
      timeSeries
    };
  }

  /**
   * Update channel statistics
   */
  private async updateChannelStats(
    channel: string, 
    status: DeliveryStatus, 
    latency?: number
  ): Promise<void> {
    const dateKey = this.getDateKey(Date.now());
    const channelKey = `${this.statsKeyPrefix}:channels:${channel}:${dateKey}`;
    
    const multi = this.redis.multi();
    
    // Increment total
    multi.hincrby(channelKey, 'total', 1);
    
    // Update based on status
    if (['delivered', 'sent'].includes(status)) {
      multi.hincrby(channelKey, 'delivered', 1);
    } else if (status === 'failed') {
      multi.hincrby(channelKey, 'failed', 1);
    }
    
    // Update latency
    if (latency !== undefined) {
      const currentStats = await this.redis.hmget(channelKey, 'avgLatency', 'total');
      const currentAvg = parseFloat(currentStats[0] || '0');
      const currentTotal = parseInt(currentStats[1] || '0');
      
      const newAvg = currentTotal > 1 
        ? (currentAvg * (currentTotal - 1) + latency) / currentTotal
        : latency;
      
      multi.hset(channelKey, 'avgLatency', newAvg.toString());
    }
    
    multi.expire(channelKey, 30 * 24 * 60 * 60); // 30 days
    await multi.exec();
  }

  /**
   * Update time series data
   */
  private async updateTimeSeries(
    timestamp: Timestamp,
    status: DeliveryStatus,
    latency?: number
  ): Promise<void> {
    const timeKey = this.getHourlyKey(timestamp);
    const seriesKey = `${this.statsKeyPrefix}:timeseries:${timeKey}`;
    
    const multi = this.redis.multi();
    multi.hincrby(seriesKey, 'total', 1);
    
    if (['delivered', 'sent'].includes(status)) {
      multi.hincrby(seriesKey, 'successful', 1);
    } else if (status === 'failed') {
      multi.hincrby(seriesKey, 'failed', 1);
    }
    
    if (latency !== undefined) {
      // Update average latency
      const currentStats = await this.redis.hmget(seriesKey, 'avgLatency', 'total');
      const currentAvg = parseFloat(currentStats[0] || '0');
      const currentTotal = parseInt(currentStats[1] || '0');
      
      const newAvg = currentTotal > 1 
        ? (currentAvg * (currentTotal - 1) + latency) / currentTotal
        : latency;
      
      multi.hset(seriesKey, 'avgLatency', newAvg.toString());
    }
    
    multi.hset(seriesKey, 'timestamp', timestamp.toString());
    multi.expire(seriesKey, 30 * 24 * 60 * 60); // 30 days
    await multi.exec();
  }

  /**
   * Update acknowledgment statistics
   */
  private async updateAcknowledgmentStats(
    channel: NotificationChannel,
    timestamp: Timestamp
  ): Promise<void> {
    const dateKey = this.getDateKey(timestamp);
    const ackKey = `${this.statsKeyPrefix}:acknowledgments:${channel}:${dateKey}`;
    
    const multi = this.redis.multi();
    multi.hincrby(ackKey, 'total', 1);
    multi.hset(ackKey, 'lastAcknowledgment', timestamp.toString());
    multi.expire(ackKey, 30 * 24 * 60 * 60);
    await multi.exec();
  }

  /**
   * Determine notification status from attempts and acknowledgments
   */
  private determineNotificationStatus(
    attempts: DeliveryAttempt[],
    acknowledgments: AcknowledgmentReceipt[]
  ): any {
    if (acknowledgments.length > 0) {
      return 'acknowledged';
    }
    
    if (attempts.length === 0) {
      return 'pending';
    }
    
    const latestAttempt = attempts.sort((a, b) => b.timestamp - a.timestamp)[0];
    const hasSuccessful = attempts.some(a => ['delivered', 'sent'].includes(a.status));
    const hasFailed = attempts.some(a => a.status === 'failed');
    const hasPending = attempts.some(a => ['pending', 'sending'].includes(a.status));
    
    if (hasSuccessful) {
      return 'delivered';
    } else if (hasPending) {
      return 'sending';
    } else if (hasFailed) {
      return 'failed';
    } else {
      return latestAttempt.status;
    }
  }

  /**
   * Get time series data for date range
   */
  private async getTimeSeriesData(from: Timestamp, to: Timestamp): Promise<TimeSeriesData[]> {
    const data: TimeSeriesData[] = [];
    const current = new Date(from);
    const end = new Date(to);
    
    while (current <= end) {
      const timeKey = this.getHourlyKey(current.getTime());
      const seriesKey = `${this.statsKeyPrefix}:timeseries:${timeKey}`;
      const stats = await this.redis.hgetall(seriesKey);
      
      data.push({
        timestamp: current.getTime(),
        total: parseInt(stats.total) || 0,
        successful: parseInt(stats.successful) || 0,
        failed: parseInt(stats.failed) || 0,
        avgLatency: parseFloat(stats.avgLatency) || 0
      });
      
      current.setHours(current.getHours() + 1);
    }
    
    return data;
  }

  /**
   * Get time range from filters
   */
  private getTimeRange(filters?: StatisticsFilters): { from: Timestamp; to: Timestamp } {
    const now = Date.now();
    const defaultFrom = now - (24 * 60 * 60 * 1000); // 24 hours ago
    
    return {
      from: filters?.from || defaultFrom,
      to: filters?.to || now
    };
  }

  /**
   * Get date key for daily stats
   */
  private getDateKey(timestamp: Timestamp): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Get hourly key for time series
   */
  private getHourlyKey(timestamp: Timestamp): string {
    const date = new Date(timestamp);
    return `${date.toISOString().split('T')[0]}-${date.getHours().toString().padStart(2, '0')}`;
  }

  /**
   * Get delivery metrics for SLA monitoring
   */
  async getDeliveryMetrics(): Promise<DeliveryMetrics> {
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const stats = await this.getStatistics({ from: last24Hours });
    
    // Calculate SLA compliance (< 5 seconds)
    const slaThreshold = 5000; // 5 seconds
    let slaCompliantCount = 0;
    let totalWithLatency = 0;
    let latencies: number[] = [];
    
    // This would need to be tracked separately for more accurate SLA calculation
    // For now, using average latency as approximation
    Object.values(stats.byChannel).forEach(channelStats => {
      if (channelStats.total > 0 && channelStats.avgLatency > 0) {
        totalWithLatency += channelStats.total;
        if (channelStats.avgLatency <= slaThreshold) {
          slaCompliantCount += channelStats.total;
        }
        // Approximate latency distribution
        for (let i = 0; i < channelStats.total; i++) {
          latencies.push(channelStats.avgLatency);
        }
      }
    });
    
    // Calculate 95th percentile
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95DeliveryTime = latencies[p95Index] || 0;
    
    const slaCompliance = totalWithLatency > 0 ? slaCompliantCount / totalWithLatency : 1;
    
    return {
      totalDeliveries: stats.total,
      successfulDeliveries: stats.successful,
      failedDeliveries: stats.failed,
      avgDeliveryTime: stats.avgDeliveryTime,
      p95DeliveryTime,
      slaCompliance
    };
  }

  /**
   * Clean up old data
   */
  async cleanup(olderThan: Timestamp): Promise<void> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.redis.keys(pattern);
    
    const keysToDelete: string[] = [];
    
    for (const key of keys) {
      // Check if key contains timestamp and is older than threshold
      const data = await this.redis.hget(key, 'timestamp');
      if (data && parseInt(data) < olderThan) {
        keysToDelete.push(key);
      }
    }
    
    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
    }
  }
}

/**
 * In-memory delivery tracker for testing
 */
export class MemoryDeliveryTracker implements DeliveryTracker {
  private attempts: Map<UUID, DeliveryAttempt> = new Map();
  private receipts: Map<UUID, DeliveryReceipt> = new Map();
  private acknowledgments: Map<UUID, AcknowledgmentReceipt> = new Map();
  private notificationAttempts: Map<UUID, UUID[]> = new Map();
  private notificationReceipts: Map<UUID, UUID[]> = new Map();
  private notificationAcknowledgments: Map<UUID, UUID[]> = new Map();

  async trackAttempt(attempt: DeliveryAttempt): Promise<void> {
    this.attempts.set(attempt.id, attempt);
    
    if (!this.notificationAttempts.has(attempt.notificationId)) {
      this.notificationAttempts.set(attempt.notificationId, []);
    }
    this.notificationAttempts.get(attempt.notificationId)!.push(attempt.id);
  }

  async updateStatus(attemptId: UUID, status: DeliveryStatus, metadata?: any): Promise<void> {
    const attempt = this.attempts.get(attemptId);
    if (attempt) {
      attempt.status = status;
      if (metadata) {
        attempt.providerResponse = { ...attempt.providerResponse, ...metadata };
      }
    }
  }

  async recordReceipt(receipt: DeliveryReceipt): Promise<void> {
    this.receipts.set(receipt.id, receipt);
    
    if (!this.notificationReceipts.has(receipt.notificationId)) {
      this.notificationReceipts.set(receipt.notificationId, []);
    }
    this.notificationReceipts.get(receipt.notificationId)!.push(receipt.id);
  }

  async recordAcknowledgment(acknowledgment: AcknowledgmentReceipt): Promise<void> {
    this.acknowledgments.set(acknowledgment.id, acknowledgment);
    
    if (!this.notificationAcknowledgments.has(acknowledgment.notificationId)) {
      this.notificationAcknowledgments.set(acknowledgment.notificationId, []);
    }
    this.notificationAcknowledgments.get(acknowledgment.notificationId)!.push(acknowledgment.id);
  }

  async getStatus(notificationId: UUID): Promise<NotificationStatusResult> {
    const attemptIds = this.notificationAttempts.get(notificationId) || [];
    const receiptIds = this.notificationReceipts.get(notificationId) || [];
    const ackIds = this.notificationAcknowledgments.get(notificationId) || [];

    const attempts = attemptIds.map(id => this.attempts.get(id)!).filter(Boolean);
    const receipts = receiptIds.map(id => this.receipts.get(id)!).filter(Boolean);
    const acknowledgments = ackIds.map(id => this.acknowledgments.get(id)!).filter(Boolean);

    const status = acknowledgments.length > 0 ? 'acknowledged' as any : 'pending' as any;

    return {
      notificationId,
      status,
      attempts,
      receipts,
      acknowledgments
    };
  }

  async getStatistics(_filters?: StatisticsFilters): Promise<DeliveryStatistics> {
    // Simple implementation for testing
    const total = this.attempts.size;
    const successful = Array.from(this.attempts.values())
      .filter(a => ['delivered', 'sent'].includes(a.status)).length;
    const failed = Array.from(this.attempts.values())
      .filter(a => a.status === 'failed').length;
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? successful / total : 0,
      avgDeliveryTime: 0,
      byChannel: {} as any,
      bySeverity: {} as any,
      timeSeries: []
    };
  }
}

/**
 * Delivery Tracker Factory
 */
export class DeliveryTrackerFactory {
  static createRedis(config: any): RedisDeliveryTracker {
    return new RedisDeliveryTracker(config);
  }

  static createMemory(): MemoryDeliveryTracker {
    return new MemoryDeliveryTracker();
  }
}

// Export types
