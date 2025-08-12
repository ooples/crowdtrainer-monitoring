/**
 * Type definitions for the notifications system
 */

import { JSONValue, Timestamp, UUID, ErrorSeverity } from '@monitoring-service/core';

// Re-export commonly used types from core
export type { JSONValue, Timestamp, UUID, ErrorSeverity };

// Base notification types
export interface BaseNotification {
  /** Unique notification ID */
  id: UUID;
  /** Notification title */
  title: string;
  /** Notification message/body */
  message: string;
  /** Alert severity level */
  severity: NotificationSeverity;
  /** Notification priority (1-10, 1 = highest) */
  priority: number;
  /** Notification category */
  category: NotificationCategory;
  /** Source that triggered the notification */
  source: string;
  /** Timestamp when notification was created */
  timestamp: Timestamp;
  /** Expiry timestamp (optional) */
  expiresAt?: Timestamp;
  /** Tags for filtering and routing */
  tags: Record<string, string>;
  /** Custom metadata */
  metadata: Record<string, JSONValue>;
  /** Alert ID that triggered this notification */
  alertId?: UUID;
  /** User/team to notify */
  recipients: NotificationRecipient[];
  /** Notification delivery configuration */
  delivery: DeliveryConfig;
}

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';
export type NotificationCategory = 'alert' | 'system' | 'security' | 'performance' | 'business' | 'custom';
export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'acknowledged' | 'failed' | 'expired';

export interface NotificationRecipient {
  /** Recipient type */
  type: 'user' | 'team' | 'role';
  /** Recipient identifier */
  id: string;
  /** Display name */
  name: string;
  /** Contact preferences */
  channels: ChannelPreference[];
  /** Timezone for time-based routing */
  timezone?: string;
  /** On-call schedule reference */
  scheduleId?: string;
}

export interface ChannelPreference {
  /** Channel type */
  channel: NotificationChannel;
  /** Channel-specific contact info */
  contact: string;
  /** Minimum severity to use this channel */
  minSeverity: NotificationSeverity;
  /** Time-based rules */
  timeRules?: TimeRule[];
  /** Enable/disable channel */
  enabled: boolean;
}

export interface TimeRule {
  /** Rule name */
  name: string;
  /** Days of week (0-6, 0 = Sunday) */
  daysOfWeek: number[];
  /** Start time (HH:mm format) */
  startTime: string;
  /** End time (HH:mm format) */
  endTime: string;
  /** Timezone */
  timezone: string;
}

export interface DeliveryConfig {
  /** Channels to use for delivery */
  channels: NotificationChannel[];
  /** Retry configuration */
  retry: RetryConfig;
  /** Delivery timeout in milliseconds */
  timeout: number;
  /** Enable escalation on failure */
  escalation?: EscalationConfig;
  /** Rate limiting configuration */
  rateLimiting?: RateLimitConfig;
}

export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Jitter factor (0-1) */
  jitter: number;
}

export interface EscalationConfig {
  /** Enable escalation */
  enabled: boolean;
  /** Escalation delay in milliseconds */
  delay: number;
  /** Escalation recipients */
  recipients: NotificationRecipient[];
  /** Escalation channels */
  channels: NotificationChannel[];
}

export interface RateLimitConfig {
  /** Rate limit per channel */
  perChannel: Record<NotificationChannel, ChannelRateLimit>;
  /** Global rate limit */
  global?: RateLimit;
}

export interface ChannelRateLimit {
  /** Rate limit configuration */
  rateLimit: RateLimit;
  /** Burst allowance */
  burst?: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimit {
  /** Maximum requests */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
}

// Channel types
export type NotificationChannel = 
  | 'email' 
  | 'sms' 
  | 'voice' 
  | 'whatsapp' 
  | 'slack' 
  | 'teams' 
  | 'discord' 
  | 'telegram'
  | 'webhook'
  | 'push'
  | 'in-app'
  | 'desktop'
  | 'mobile'
  | 'pager'
  | 'custom';

// Channel-specific configurations
export interface EmailConfig {
  /** SMTP configuration */
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  /** Default sender */
  from: string;
  /** Reply-to address */
  replyTo?: string;
  /** Template configuration */
  templates: {
    /** Template directory */
    directory: string;
    /** Default template */
    default: string;
    /** Engine (handlebars, mustache, etc.) */
    engine: string;
  };
}

export interface SmsConfig {
  /** SMS provider */
  provider: 'twilio' | 'aws-sns' | 'custom';
  /** Provider configuration */
  config: {
    accountSid?: string;
    authToken?: string;
    from?: string;
    [key: string]: JSONValue;
  };
}

export interface VoiceConfig {
  /** Voice provider */
  provider: 'twilio' | 'custom';
  /** Provider configuration */
  config: {
    accountSid?: string;
    authToken?: string;
    from?: string;
    /** Voice message template */
    voiceUrl?: string;
    [key: string]: JSONValue;
  };
}

export interface SlackConfig {
  /** Slack bot token */
  token: string;
  /** Default channel */
  defaultChannel?: string;
  /** Enable interactive buttons */
  enableButtons: boolean;
  /** Custom blocks template */
  customBlocks?: boolean;
}

export interface TeamsConfig {
  /** Microsoft Graph client configuration */
  clientId: string;
  clientSecret: string;
  tenantId: string;
  /** Default team/channel */
  defaultTeam?: string;
  defaultChannel?: string;
}

export interface WebhookConfig {
  /** Webhook URL */
  url: string;
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Custom headers */
  headers: Record<string, string>;
  /** Authentication */
  auth?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  /** Request timeout */
  timeout: number;
  /** Custom payload template */
  template?: string;
}

// Template types
export interface NotificationTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Channel this template is for */
  channel: NotificationChannel;
  /** Template content */
  content: TemplateContent;
  /** Template variables */
  variables: TemplateVariable[];
  /** Created timestamp */
  createdAt: Timestamp;
  /** Updated timestamp */
  updatedAt: Timestamp;
}

export interface TemplateContent {
  /** Subject/title template */
  subject?: string;
  /** Body template */
  body: string;
  /** HTML body template (for email) */
  html?: string;
  /** Additional channel-specific content */
  extras?: Record<string, JSONValue>;
}

export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  /** Variable description */
  description: string;
  /** Required variable */
  required: boolean;
  /** Default value */
  default?: JSONValue;
}

// Delivery tracking types
export interface DeliveryAttempt {
  /** Attempt ID */
  id: UUID;
  /** Notification ID */
  notificationId: UUID;
  /** Channel used */
  channel: NotificationChannel;
  /** Attempt timestamp */
  timestamp: Timestamp;
  /** Attempt status */
  status: DeliveryStatus;
  /** Delivery latency in milliseconds */
  latency?: number;
  /** Provider response */
  providerResponse?: {
    messageId?: string;
    status?: string;
    error?: string;
    metadata?: Record<string, JSONValue>;
  };
  /** Retry attempt number */
  attemptNumber: number;
  /** Next retry timestamp */
  nextRetryAt?: Timestamp;
}

export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'expired';

export interface DeliveryReceipt {
  /** Receipt ID */
  id: UUID;
  /** Notification ID */
  notificationId: UUID;
  /** Delivery attempt ID */
  attemptId: UUID;
  /** Receipt timestamp */
  timestamp: Timestamp;
  /** Delivery status */
  status: DeliveryStatus;
  /** Provider-specific receipt data */
  providerData?: Record<string, JSONValue>;
}

export interface AcknowledgmentReceipt {
  /** Receipt ID */
  id: UUID;
  /** Notification ID */
  notificationId: UUID;
  /** User who acknowledged */
  acknowledgedBy: string;
  /** Acknowledgment timestamp */
  timestamp: Timestamp;
  /** Acknowledgment channel */
  channel: NotificationChannel;
  /** Acknowledgment notes */
  notes?: string;
}

// Smart routing types
export interface RoutingRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule priority (higher = more priority) */
  priority: number;
  /** Rule conditions */
  conditions: RoutingCondition[];
  /** Rule actions */
  actions: RoutingAction[];
  /** Enable/disable rule */
  enabled: boolean;
}

export interface RoutingCondition {
  /** Field to check */
  field: string;
  /** Comparison operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  /** Value to compare against */
  value: JSONValue;
}

export interface RoutingAction {
  /** Action type */
  type: 'route_to_channel' | 'add_recipient' | 'set_priority' | 'delay' | 'suppress' | 'escalate';
  /** Action parameters */
  params: Record<string, JSONValue>;
}

export interface OnCallSchedule {
  /** Schedule ID */
  id: string;
  /** Schedule name */
  name: string;
  /** Schedule description */
  description: string;
  /** Schedule entries */
  entries: OnCallEntry[];
  /** Timezone */
  timezone: string;
  /** Escalation policy */
  escalation?: EscalationPolicy;
}

export interface OnCallEntry {
  /** Entry ID */
  id: string;
  /** User/team on call */
  userId: string;
  /** Start time */
  startTime: Timestamp;
  /** End time */
  endTime: Timestamp;
  /** Contact override */
  contactOverride?: ContactOverride;
}

export interface ContactOverride {
  /** Override channels */
  channels: ChannelPreference[];
  /** Override until timestamp */
  until?: Timestamp;
}

export interface EscalationPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Escalation steps */
  steps: EscalationStep[];
}

export interface EscalationStep {
  /** Step number */
  step: number;
  /** Delay before escalation (milliseconds) */
  delay: number;
  /** Recipients for this step */
  recipients: NotificationRecipient[];
  /** Channels to use */
  channels: NotificationChannel[];
}

// Configuration types
export interface NotificationConfig {
  /** Notification channels configuration */
  channels: {
    email?: EmailConfig;
    sms?: SmsConfig;
    voice?: VoiceConfig;
    slack?: SlackConfig;
    teams?: TeamsConfig;
    webhook?: WebhookConfig;
  };
  /** Default delivery configuration */
  defaults: {
    retry: RetryConfig;
    timeout: number;
    rateLimiting: RateLimitConfig;
  };
  /** Smart routing rules */
  routing: {
    rules: RoutingRule[];
    schedules: OnCallSchedule[];
  };
  /** Template configuration */
  templates: {
    directory: string;
    engine: string;
    cache: boolean;
  };
  /** Delivery tracking */
  tracking: {
    enabled: boolean;
    retentionDays: number;
    webhook?: string;
  };
}

// Service interfaces
export interface NotificationService {
  /** Send a notification */
  send(notification: BaseNotification): Promise<NotificationResult>;
  /** Send bulk notifications */
  sendBulk(notifications: BaseNotification[]): Promise<NotificationResult[]>;
  /** Get notification status */
  getStatus(notificationId: UUID): Promise<NotificationStatusResult>;
  /** Acknowledge notification */
  acknowledge(notificationId: UUID, userId: string, notes?: string): Promise<void>;
  /** Get delivery statistics */
  getStatistics(filters?: StatisticsFilters): Promise<DeliveryStatistics>;
}

export interface NotificationResult {
  /** Notification ID */
  notificationId: UUID;
  /** Overall status */
  status: 'sent' | 'partial' | 'failed';
  /** Channel results */
  channels: ChannelResult[];
  /** Delivery attempts */
  attempts: DeliveryAttempt[];
  /** Error messages */
  errors: string[];
}

export interface ChannelResult {
  /** Channel name */
  channel: NotificationChannel;
  /** Channel status */
  status: DeliveryStatus;
  /** Provider message ID */
  messageId?: string;
  /** Delivery latency */
  latency: number;
  /** Error message */
  error?: string;
}

export interface NotificationStatusResult {
  /** Notification ID */
  notificationId: UUID;
  /** Current status */
  status: NotificationStatus;
  /** Delivery attempts */
  attempts: DeliveryAttempt[];
  /** Delivery receipts */
  receipts: DeliveryReceipt[];
  /** Acknowledgment receipts */
  acknowledgments: AcknowledgmentReceipt[];
  /** Next retry timestamp */
  nextRetryAt?: Timestamp;
}

export interface StatisticsFilters {
  /** Date range start */
  from?: Timestamp;
  /** Date range end */
  to?: Timestamp;
  /** Filter by channels */
  channels?: NotificationChannel[];
  /** Filter by severity */
  severities?: NotificationSeverity[];
  /** Filter by status */
  statuses?: NotificationStatus[];
  /** Filter by category */
  categories?: NotificationCategory[];
}

export interface DeliveryStatistics {
  /** Total notifications */
  total: number;
  /** Successful deliveries */
  successful: number;
  /** Failed deliveries */
  failed: number;
  /** Success rate percentage */
  successRate: number;
  /** Average delivery time (milliseconds) */
  avgDeliveryTime: number;
  /** Channel statistics */
  byChannel: Record<NotificationChannel, ChannelStatistics>;
  /** Severity statistics */
  bySeverity: Record<NotificationSeverity, SeverityStatistics>;
  /** Time series data */
  timeSeries: TimeSeriesData[];
}

export interface ChannelStatistics {
  /** Channel name */
  channel: NotificationChannel;
  /** Total sent */
  total: number;
  /** Successfully delivered */
  delivered: number;
  /** Failed deliveries */
  failed: number;
  /** Success rate */
  successRate: number;
  /** Average latency */
  avgLatency: number;
  /** Rate limited count */
  rateLimited: number;
}

export interface SeverityStatistics {
  /** Severity level */
  severity: NotificationSeverity;
  /** Total count */
  total: number;
  /** Average delivery time */
  avgDeliveryTime: number;
  /** Success rate */
  successRate: number;
}

export interface TimeSeriesData {
  /** Timestamp */
  timestamp: Timestamp;
  /** Total notifications */
  total: number;
  /** Successful deliveries */
  successful: number;
  /** Failed deliveries */
  failed: number;
  /** Average latency */
  avgLatency: number;
}

// Error types
export class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public channel?: NotificationChannel,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class ChannelError extends NotificationError {
  constructor(
    message: string,
    code: string,
    channel: NotificationChannel,
    originalError?: Error
  ) {
    super(message, code, channel, originalError);
    this.name = 'ChannelError';
  }
}

export class RateLimitError extends NotificationError {
  constructor(
    message: string,
    channel: NotificationChannel,
    public retryAfter: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', channel);
    this.name = 'RateLimitError';
  }
}

export class TemplateError extends NotificationError {
  constructor(
    message: string,
    public templateId?: string,
    originalError?: Error
  ) {
    super(message, 'TEMPLATE_ERROR', undefined, originalError);
    this.name = 'TemplateError';
  }
}