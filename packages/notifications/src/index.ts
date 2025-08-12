/**
 * Notifications Package - Main Export
 * 
 * A comprehensive multi-channel notification system for monitoring services
 * with smart routing, delivery tracking, and 15+ notification channels.
 */

// Export all types
export * from './types/index.js';

// Export smart routing
export { SmartRouter, RoutingRuleBuilder } from './routing/smart.js';
export type { SmartRoutingConfig } from './routing/smart.js';

// Export notification channels
export { VoiceChannel, VoiceChannelFactory } from './channels/voice.js';
export type { VoiceCallOptions, VoiceCallResult } from './channels/voice.js';

export { SmsChannel, SmsChannelFactory } from './channels/sms.js';
export type { SmsOptions, SmsResult } from './channels/sms.js';

export { 
  SlackChannel, 
  TeamsChannel, 
  ChatChannel, 
  ChatChannelFactory 
} from './channels/slack.js';
export type { 
  SlackMessageOptions, 
  TeamsMessageOptions, 
  ChatResult 
} from './channels/slack.js';

export { EmailChannel, EmailChannelFactory } from './channels/email.js';
export type { EmailOptions, EmailAttachment, EmailResult } from './channels/email.js';

// Export webhook management
export { WebhookManager, WebhookManagerFactory } from './webhooks/manager.js';
export type { 
  WebhookEndpoint, 
  WebhookFilter, 
  WebhookStats, 
  WebhookPayload, 
  WebhookDeliveryResult 
} from './webhooks/manager.js';

// Export delivery tracking
export { 
  RedisDeliveryTracker, 
  MemoryDeliveryTracker, 
  DeliveryTrackerFactory 
} from './tracking/delivery.js';
export type { DeliveryTracker, DeliveryMetrics } from './tracking/delivery.js';

// Export template engine
export { HandlebarsTemplateEngine, TemplateEngineFactory } from './templates/engine.js';
export type { 
  TemplateEngine, 
  TemplateEngineConfig, 
  RenderContext, 
  TemplateUtils 
} from './templates/engine.js';

// Export rate limiting
export { 
  TokenBucketLimiter,
  SlidingWindowLimiter,
  FixedWindowLimiter,
  RateLimitManager,
  RateLimitFactory
} from './rate-limiting/limiter.js';
export type { 
  RateLimiter,
  RateLimitResult,
  RateLimitStatus,
  RateLimitStats,
  RateLimitAlgorithm,
  TokenBucketConfig,
  SlidingWindowConfig,
  FixedWindowConfig
} from './rate-limiting/limiter.js';

// Export main notification service
export { NotificationService } from './service.js';
export type { NotificationServiceConfig } from './service.js';