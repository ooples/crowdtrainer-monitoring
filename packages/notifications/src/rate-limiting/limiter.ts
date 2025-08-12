/**
 * Rate Limiting System for Notification Channels
 * 
 * Features:
 * - Per-channel rate limiting with different algorithms
 * - Token bucket algorithm for burst handling
 * - Sliding window rate limiting
 * - Fixed window rate limiting
 * - Exponential backoff for failures
 * - Redis-based distributed rate limiting
 * - Rate limiting statistics and monitoring
 * - Dynamic rate limit adjustment
 */

import { 
  NotificationChannel, 
  RateLimitError
} from '../types/index.js';
import Redis from 'ioredis';

export interface RateLimiter {
  /** Check if request is allowed */
  isAllowed(channel: NotificationChannel, identifier: string): Promise<RateLimitResult>;
  /** Record rate limit hit */
  recordHit(channel: NotificationChannel, identifier: string): Promise<void>;
  /** Get current rate limit status */
  getStatus(channel: NotificationChannel, identifier: string): Promise<RateLimitStatus>;
  /** Reset rate limit for identifier */
  reset(channel: NotificationChannel, identifier: string): Promise<void>;
}

export interface RateLimitResult {
  /** Is request allowed */
  allowed: boolean;
  /** Remaining requests in window */
  remaining: number;
  /** Window reset time */
  resetTime: number;
  /** Retry after seconds (if not allowed) */
  retryAfter?: number;
}

export interface RateLimitStatus {
  /** Current request count */
  current: number;
  /** Maximum allowed requests */
  max: number;
  /** Remaining requests */
  remaining: number;
  /** Window reset time */
  resetTime: number;
  /** Time until reset (seconds) */
  resetIn: number;
}

export interface RateLimitStats {
  /** Total requests */
  totalRequests: number;
  /** Allowed requests */
  allowedRequests: number;
  /** Blocked requests */
  blockedRequests: number;
  /** Block rate */
  blockRate: number;
  /** Average requests per minute */
  avgRequestsPerMinute: number;
}

export type RateLimitAlgorithm = 'token-bucket' | 'sliding-window' | 'fixed-window';

export interface TokenBucketConfig {
  /** Maximum tokens in bucket */
  capacity: number;
  /** Token refill rate (per second) */
  refillRate: number;
  /** Initial token count */
  initialTokens?: number;
}

export interface SlidingWindowConfig {
  /** Window size in seconds */
  windowSize: number;
  /** Maximum requests in window */
  maxRequests: number;
  /** Sub-window precision */
  precision?: number;
}

export interface FixedWindowConfig {
  /** Window size in seconds */
  windowSize: number;
  /** Maximum requests in window */
  maxRequests: number;
}

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketLimiter implements RateLimiter {
  private redis: Redis;
  private config: Record<NotificationChannel, TokenBucketConfig>;
  private keyPrefix = 'notifications:rate-limit:token-bucket';

  constructor(
    redisConfig: any,
    config: Record<NotificationChannel, TokenBucketConfig>
  ) {
    this.redis = new Redis(redisConfig);
    this.config = config;
  }

  async isAllowed(channel: NotificationChannel, identifier: string): Promise<RateLimitResult> {
    const bucketConfig = this.config[channel];
    if (!bucketConfig) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const key = `${this.keyPrefix}:${channel}:${identifier}`;
    const now = Date.now() / 1000; // Unix timestamp in seconds

    // Use Lua script for atomic token bucket operation
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local tokens_requested = tonumber(ARGV[4]) or 1

      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now

      -- Calculate tokens to add
      local time_passed = math.max(0, now - last_refill)
      local new_tokens = math.min(capacity, tokens + (time_passed * refill_rate))

      if new_tokens >= tokens_requested then
        -- Allow request
        new_tokens = new_tokens - tokens_requested
        redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600) -- 1 hour expiry
        return {1, new_tokens, now}
      else
        -- Deny request
        redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)
        local retry_after = (tokens_requested - new_tokens) / refill_rate
        return {0, new_tokens, now, retry_after}
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      key,
      bucketConfig.capacity.toString(),
      bucketConfig.refillRate.toString(),
      now.toString(),
      '1' // Request 1 token
    ) as number[];

    const allowed = result[0] === 1;
    const remaining = Math.floor(result[1]);
    const retryAfter = result[3] ? Math.ceil(result[3]) : undefined;

    return {
      allowed,
      remaining,
      resetTime: now + (bucketConfig.capacity / bucketConfig.refillRate),
      retryAfter
    };
  }

  async recordHit(_channel: NotificationChannel, _identifier: string): Promise<void> {
    // Already handled in isAllowed for token bucket
  }

  async getStatus(channel: NotificationChannel, identifier: string): Promise<RateLimitStatus> {
    const bucketConfig = this.config[channel];
    if (!bucketConfig) {
      return {
        current: 0,
        max: Infinity,
        remaining: Infinity,
        resetTime: 0,
        resetIn: 0
      };
    }

    const key = `${this.keyPrefix}:${channel}:${identifier}`;
    const bucket = await this.redis.hmget(key, 'tokens', 'last_refill');
    
    const tokens = parseInt(bucket[0] || bucketConfig.capacity.toString());
    const resetTime = Date.now() / 1000 + (bucketConfig.capacity / bucketConfig.refillRate);

    return {
      current: bucketConfig.capacity - tokens,
      max: bucketConfig.capacity,
      remaining: tokens,
      resetTime,
      resetIn: Math.max(0, resetTime - Date.now() / 1000)
    };
  }

  async reset(channel: NotificationChannel, identifier: string): Promise<void> {
    const key = `${this.keyPrefix}:${channel}:${identifier}`;
    await this.redis.del(key);
  }
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowLimiter implements RateLimiter {
  private redis: Redis;
  private config: Record<NotificationChannel, SlidingWindowConfig>;
  private keyPrefix = 'notifications:rate-limit:sliding-window';

  constructor(
    redisConfig: any,
    config: Record<NotificationChannel, SlidingWindowConfig>
  ) {
    this.redis = new Redis(redisConfig);
    this.config = config;
  }

  async isAllowed(channel: NotificationChannel, identifier: string): Promise<RateLimitResult> {
    const windowConfig = this.config[channel];
    if (!windowConfig) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const key = `${this.keyPrefix}:${channel}:${identifier}`;
    const now = Date.now() / 1000;
    const windowStart = now - windowConfig.windowSize;

    // Use Lua script for atomic sliding window operation
    const luaScript = `
      local key = KEYS[1]
      local window_start = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local max_requests = tonumber(ARGV[3])

      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

      -- Count current requests in window
      local current_count = redis.call('ZCARD', key)

      if current_count < max_requests then
        -- Allow request
        redis.call('ZADD', key, now, now .. ':' .. math.random())
        redis.call('EXPIRE', key, math.ceil(ARGV[4])) -- Window size
        return {1, max_requests - current_count - 1, now}
      else
        -- Deny request
        return {0, 0, now}
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      key,
      windowStart.toString(),
      now.toString(),
      windowConfig.maxRequests.toString(),
      windowConfig.windowSize.toString()
    ) as number[];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const resetTime = now + windowConfig.windowSize;

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil(windowConfig.windowSize / 4) // Estimate
    };
  }

  async recordHit(_channel: NotificationChannel, _identifier: string): Promise<void> {
    // Already handled in isAllowed for sliding window
  }

  async getStatus(channel: NotificationChannel, identifier: string): Promise<RateLimitStatus> {
    const windowConfig = this.config[channel];
    if (!windowConfig) {
      return {
        current: 0,
        max: Infinity,
        remaining: Infinity,
        resetTime: 0,
        resetIn: 0
      };
    }

    const key = `${this.keyPrefix}:${channel}:${identifier}`;
    const now = Date.now() / 1000;
    const windowStart = now - windowConfig.windowSize;

    // Clean old entries and count current
    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const current = await this.redis.zcard(key);
    const resetTime = now + windowConfig.windowSize;

    return {
      current,
      max: windowConfig.maxRequests,
      remaining: Math.max(0, windowConfig.maxRequests - current),
      resetTime,
      resetIn: Math.max(0, resetTime - now)
    };
  }

  async reset(channel: NotificationChannel, identifier: string): Promise<void> {
    const key = `${this.keyPrefix}:${channel}:${identifier}`;
    await this.redis.del(key);
  }
}

/**
 * Fixed Window Rate Limiter
 */
export class FixedWindowLimiter implements RateLimiter {
  private redis: Redis;
  private config: Record<NotificationChannel, FixedWindowConfig>;
  private keyPrefix = 'notifications:rate-limit:fixed-window';

  constructor(
    redisConfig: any,
    config: Record<NotificationChannel, FixedWindowConfig>
  ) {
    this.redis = new Redis(redisConfig);
    this.config = config;
  }

  async isAllowed(channel: NotificationChannel, identifier: string): Promise<RateLimitResult> {
    const windowConfig = this.config[channel];
    if (!windowConfig) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const now = Date.now() / 1000;
    const windowStart = Math.floor(now / windowConfig.windowSize) * windowConfig.windowSize;
    const windowEnd = windowStart + windowConfig.windowSize;
    const key = `${this.keyPrefix}:${channel}:${identifier}:${windowStart}`;

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      // First request in window, set expiry
      await this.redis.expire(key, windowConfig.windowSize);
    }

    const allowed = current <= windowConfig.maxRequests;
    const remaining = Math.max(0, windowConfig.maxRequests - current);

    return {
      allowed,
      remaining,
      resetTime: windowEnd,
      retryAfter: allowed ? undefined : Math.ceil(windowEnd - now)
    };
  }

  async recordHit(_channel: NotificationChannel, _identifier: string): Promise<void> {
    // Already handled in isAllowed for fixed window
  }

  async getStatus(channel: NotificationChannel, identifier: string): Promise<RateLimitStatus> {
    const windowConfig = this.config[channel];
    if (!windowConfig) {
      return {
        current: 0,
        max: Infinity,
        remaining: Infinity,
        resetTime: 0,
        resetIn: 0
      };
    }

    const now = Date.now() / 1000;
    const windowStart = Math.floor(now / windowConfig.windowSize) * windowConfig.windowSize;
    const windowEnd = windowStart + windowConfig.windowSize;
    const key = `${this.keyPrefix}:${channel}:${identifier}:${windowStart}`;

    const current = await this.redis.get(key);
    const currentCount = parseInt(current || '0');

    return {
      current: currentCount,
      max: windowConfig.maxRequests,
      remaining: Math.max(0, windowConfig.maxRequests - currentCount),
      resetTime: windowEnd,
      resetIn: Math.max(0, windowEnd - now)
    };
  }

  async reset(channel: NotificationChannel, identifier: string): Promise<void> {
    const now = Date.now() / 1000;
    const windowConfig = this.config[channel];
    const windowStart = Math.floor(now / windowConfig.windowSize) * windowConfig.windowSize;
    const key = `${this.keyPrefix}:${channel}:${identifier}:${windowStart}`;
    
    await this.redis.del(key);
  }
}

/**
 * Composite Rate Limiter Manager
 */
export class RateLimitManager {
  private limiters: Map<NotificationChannel, RateLimiter> = new Map();
  // private stats: Map<string, RateLimitStats> = new Map();
  private redis: Redis;
  private statsKeyPrefix = 'notifications:rate-limit:stats';

  constructor(redisConfig: any) {
    this.redis = new Redis(redisConfig);
  }

  /**
   * Add rate limiter for channel
   */
  addLimiter(channel: NotificationChannel, limiter: RateLimiter): void {
    this.limiters.set(channel, limiter);
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(
    channel: NotificationChannel, 
    identifier: string
  ): Promise<RateLimitResult> {
    const limiter = this.limiters.get(channel);
    if (!limiter) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const result = await limiter.isAllowed(channel, identifier);
    
    // Update statistics
    await this.updateStats(channel, result.allowed);
    
    if (!result.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded for ${channel}`,
        channel,
        result.retryAfter || 60
      );
    }

    return result;
  }

  /**
   * Get rate limit status for channel
   */
  async getStatus(
    channel: NotificationChannel, 
    identifier: string
  ): Promise<RateLimitStatus> {
    const limiter = this.limiters.get(channel);
    if (!limiter) {
      return {
        current: 0,
        max: Infinity,
        remaining: Infinity,
        resetTime: 0,
        resetIn: 0
      };
    }

    return limiter.getStatus(channel, identifier);
  }

  /**
   * Reset rate limits for identifier
   */
  async reset(channel: NotificationChannel, identifier: string): Promise<void> {
    const limiter = this.limiters.get(channel);
    if (limiter) {
      await limiter.reset(channel, identifier);
    }
  }

  /**
   * Get rate limiting statistics
   */
  async getStats(channel?: NotificationChannel): Promise<Record<string, RateLimitStats>> {
    const pattern = channel 
      ? `${this.statsKeyPrefix}:${channel}:*`
      : `${this.statsKeyPrefix}:*`;
    
    const keys = await this.redis.keys(pattern);
    const stats: Record<string, RateLimitStats> = {};

    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      const channelName = key.split(':')[3];
      
      if (data.total) {
        const total = parseInt(data.total);
        const allowed = parseInt(data.allowed || '0');
        const blocked = total - allowed;

        stats[channelName] = {
          totalRequests: total,
          allowedRequests: allowed,
          blockedRequests: blocked,
          blockRate: total > 0 ? blocked / total : 0,
          avgRequestsPerMinute: parseFloat(data.avgPerMinute || '0')
        };
      }
    }

    return stats;
  }

  /**
   * Update rate limiting statistics
   */
  private async updateStats(channel: NotificationChannel, allowed: boolean): Promise<void> {
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${this.statsKeyPrefix}:${channel}:${dateKey}`;
    
    const multi = this.redis.multi();
    multi.hincrby(key, 'total', 1);
    
    if (allowed) {
      multi.hincrby(key, 'allowed', 1);
    } else {
      multi.hincrby(key, 'blocked', 1);
    }
    
    multi.expire(key, 30 * 24 * 60 * 60); // 30 days
    await multi.exec();
  }

  /**
   * Clean up old statistics
   */
  async cleanup(olderThan: number): Promise<void> {
    const pattern = `${this.statsKeyPrefix}:*`;
    const keys = await this.redis.keys(pattern);
    
    for (const key of keys) {
      const parts = key.split(':');
      const dateStr = parts[parts.length - 1];
      const date = new Date(dateStr);
      
      if (date.getTime() < olderThan) {
        await this.redis.del(key);
      }
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{
    activeChannels: number;
    totalLimiters: number;
    redisConnected: boolean;
  }> {
    let redisConnected = true;
    try {
      await this.redis.ping();
    } catch {
      redisConnected = false;
    }

    return {
      activeChannels: this.limiters.size,
      totalLimiters: this.limiters.size,
      redisConnected
    };
  }
}

/**
 * Rate Limit Factory
 */
export class RateLimitFactory {
  static createTokenBucket(
    redisConfig: any,
    config: Record<NotificationChannel, TokenBucketConfig>
  ): TokenBucketLimiter {
    return new TokenBucketLimiter(redisConfig, config);
  }

  static createSlidingWindow(
    redisConfig: any,
    config: Record<NotificationChannel, SlidingWindowConfig>
  ): SlidingWindowLimiter {
    return new SlidingWindowLimiter(redisConfig, config);
  }

  static createFixedWindow(
    redisConfig: any,
    config: Record<NotificationChannel, FixedWindowConfig>
  ): FixedWindowLimiter {
    return new FixedWindowLimiter(redisConfig, config);
  }

  static createManager(redisConfig: any): RateLimitManager {
    return new RateLimitManager(redisConfig);
  }
}

