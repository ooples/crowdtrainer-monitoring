import Redis from 'ioredis';
import { RedisConfig } from '../types';

export class RedisManager {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected = false;
  private eventCallbacks: Map<string, Function[]> = new Map();

  constructor(config: RedisConfig) {
    const redisOptions: Redis.RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryDelayOnFailover: config.retryDelayOnFailover,
      enableReadyCheck: config.enableReadyCheck,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnClusterDown: 300,
      retryDelayOnReconnect: function (times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);
    this.publisher = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (ms) => {
      console.log(`Redis client reconnecting in ${ms}ms`);
    });

    // Subscriber events
    this.subscriber.on('connect', () => {
      console.log('Redis subscriber connected');
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      this.handleMessage(channel, message, pattern);
    });

    // Publisher events
    this.publisher.on('connect', () => {
      console.log('Redis publisher connected');
    });

    this.publisher.on('error', (err) => {
      console.error('Redis publisher error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);

      // Test connection
      await this.client.ping();
      console.log('Redis connections established successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
    this.isConnected = false;
    console.log('Redis connections closed');
  }

  private handleMessage(channel: string, message: string, pattern?: string): void {
    try {
      const data = JSON.parse(message);
      const callbacks = this.eventCallbacks.get(channel) || [];
      
      callbacks.forEach(callback => {
        try {
          callback(data, channel, pattern);
        } catch (error) {
          console.error(`Error in Redis message callback for channel ${channel}:`, error);
        }
      });
    } catch (error) {
      console.error(`Error parsing Redis message from channel ${channel}:`, error);
    }
  }

  // Basic Redis operations
  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    if (ttl) {
      return this.client.setex(key, ttl, value);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client.ttl(key);
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hmset(key: string, hash: Record<string, string>): Promise<'OK'> {
    return this.client.hmset(key, hash);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.client.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    if (withScores) {
      return this.client.zrange(key, start, stop, 'WITHSCORES');
    }
    return this.client.zrange(key, start, stop);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<number> {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    return this.publisher.publish(channel, messageStr);
  }

  async subscribe(channel: string, callback: Function): Promise<void> {
    if (!this.eventCallbacks.has(channel)) {
      this.eventCallbacks.set(channel, []);
      await this.subscriber.subscribe(channel);
    }
    
    this.eventCallbacks.get(channel)!.push(callback);
  }

  async unsubscribe(channel: string, callback?: Function): Promise<void> {
    const callbacks = this.eventCallbacks.get(channel);
    if (!callbacks) return;

    if (callback) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      callbacks.length = 0;
    }

    if (callbacks.length === 0) {
      this.eventCallbacks.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  async psubscribe(pattern: string, callback: Function): Promise<void> {
    if (!this.eventCallbacks.has(pattern)) {
      this.eventCallbacks.set(pattern, []);
      await this.subscriber.psubscribe(pattern);
    }
    
    this.eventCallbacks.get(pattern)!.push(callback);
  }

  // Cache utilities
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error(`Error parsing JSON from Redis key ${key}:`, error);
      return null;
    }
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<'OK'> {
    const jsonValue = JSON.stringify(value);
    return this.set(key, jsonValue, ttl);
  }

  // Rate limiting support
  async checkRateLimit(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - window;

    // Use Redis transaction for atomic operations
    const multi = this.client.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, now);
    multi.zcard(key);
    multi.expire(key, Math.ceil(window / 1000));

    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const count = results[2][1] as number;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetTime = now + window;

    return { allowed, remaining, resetTime };
  }

  // Session support
  async getSession(sessionId: string): Promise<any> {
    return this.getJSON(`session:${sessionId}`);
  }

  async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<'OK'> {
    return this.setJSON(`session:${sessionId}`, data, ttl);
  }

  async deleteSession(sessionId: string): Promise<number> {
    return this.del(`session:${sessionId}`);
  }

  // WebSocket connection tracking
  async addWebSocketConnection(connectionId: string, metadata: any): Promise<'OK'> {
    return this.setJSON(`ws:${connectionId}`, metadata);
  }

  async removeWebSocketConnection(connectionId: string): Promise<number> {
    return this.del(`ws:${connectionId}`);
  }

  async getWebSocketConnections(): Promise<string[]> {
    const keys = await this.client.keys('ws:*');
    return keys.map(key => key.replace('ws:', ''));
  }

  // Metrics aggregation support
  async incrementMetric(metric: string, value: number = 1): Promise<number> {
    return this.client.incrby(`metric:${metric}`, value);
  }

  async getMetricValue(metric: string): Promise<number> {
    const value = await this.get(`metric:${metric}`);
    return value ? parseInt(value, 10) : 0;
  }

  // Event queuing
  async queueEvent(event: any): Promise<number> {
    return this.lpush('events:queue', JSON.stringify(event));
  }

  async dequeueEvent(): Promise<any | null> {
    const event = await this.rpop('events:queue');
    return event ? JSON.parse(event) : null;
  }

  async getQueueLength(): Promise<number> {
    return this.llen('events:queue');
  }

  // Health check
  async ping(): Promise<string> {
    return this.client.ping();
  }

  async info(): Promise<string> {
    return this.client.info();
  }
}

let redisManager: RedisManager;

export async function initRedis(config: RedisConfig): Promise<RedisManager> {
  if (!redisManager) {
    redisManager = new RedisManager(config);
    await redisManager.connect();
  }
  return redisManager;
}

export function getRedis(): RedisManager {
  if (!redisManager) {
    throw new Error('Redis not initialized. Call initRedis first.');
  }
  return redisManager;
}