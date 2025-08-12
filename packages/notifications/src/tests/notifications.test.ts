/**
 * Comprehensive Test Suite for Notifications System
 * 
 * Test Coverage:
 * - Smart routing with all conditions and actions
 * - All notification channels (voice, SMS, email, Slack, Teams, webhooks)
 * - Delivery tracking and acknowledgments
 * - Rate limiting with different algorithms
 * - Template engine with multiple scenarios
 * - Error handling and edge cases
 * - Performance and load testing scenarios
 */

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';

// Import all modules to test
import { SmartRouter, RoutingRuleBuilder } from '../routing/smart.js';
import { VoiceChannel, VoiceChannelFactory } from '../channels/voice.js';
import { SmsChannel, SmsChannelFactory } from '../channels/sms.js';
import { ChatChannel, SlackChannel, TeamsChannel, ChatChannelFactory } from '../channels/slack.js';
import { EmailChannel, EmailChannelFactory } from '../channels/email.js';
import { WebhookManager, WebhookManagerFactory } from '../webhooks/manager.js';
import { RedisDeliveryTracker, MemoryDeliveryTracker, DeliveryTrackerFactory } from '../tracking/delivery.js';
import { HandlebarsTemplateEngine, TemplateEngineFactory } from '../templates/engine.js';
import { 
  TokenBucketLimiter, 
  SlidingWindowLimiter, 
  FixedWindowLimiter,
  RateLimitManager,
  RateLimitFactory 
} from '../rate-limiting/limiter.js';

// Import types
import {
  BaseNotification,
  NotificationSeverity,
  NotificationChannel,
  VoiceConfig,
  SmsConfig,
  SlackConfig,
  TeamsConfig,
  EmailConfig,
  WebhookConfig,
  SmartRoutingConfig,
  TemplateEngineConfig,
  DeliveryAttempt,
  DeliveryReceipt,
  AcknowledgmentReceipt
} from '../types/index.js';

// Mock dependencies
jest.mock('twilio');
jest.mock('nodemailer');
jest.mock('@slack/web-api');
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('ioredis');
jest.mock('axios');

// Test data factories
class TestDataFactory {
  static createNotification(overrides: Partial<BaseNotification> = {}): BaseNotification {
    return {
      id: 'test-notification-' + Date.now(),
      title: 'Test Alert',
      message: 'This is a test notification message for unit testing.',
      severity: 'error' as NotificationSeverity,
      priority: 7,
      category: 'system',
      source: 'test-suite',
      timestamp: Date.now(),
      tags: { test: 'true', environment: 'test' },
      metadata: { url: 'https://test.example.com' },
      recipients: [
        {
          type: 'user',
          id: 'test-user-1',
          name: 'Test User',
          channels: [
            {
              channel: 'email' as NotificationChannel,
              contact: 'test@example.com',
              minSeverity: 'info' as NotificationSeverity,
              enabled: true
            },
            {
              channel: 'sms' as NotificationChannel,
              contact: '+1234567890',
              minSeverity: 'warning' as NotificationSeverity,
              enabled: true
            }
          ],
          timezone: 'UTC'
        }
      ],
      delivery: {
        channels: ['email', 'sms'] as NotificationChannel[],
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 30000,
          jitter: 0.1
        },
        timeout: 30000
      },
      ...overrides
    };
  }

  static createVoiceConfig(): VoiceConfig {
    return {
      provider: 'twilio',
      config: {
        accountSid: 'test-account-sid',
        authToken: 'test-auth-token',
        from: '+1234567890',
        voiceUrl: 'https://test.example.com/voice'
      }
    };
  }

  static createSmsConfig(): SmsConfig {
    return {
      provider: 'twilio',
      config: {
        accountSid: 'test-account-sid',
        authToken: 'test-auth-token',
        from: '+1234567890'
      }
    };
  }

  static createSlackConfig(): SlackConfig {
    return {
      token: 'xoxb-test-token',
      defaultChannel: '#alerts',
      enableButtons: true
    };
  }

  static createTeamsConfig(): TeamsConfig {
    return {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
      defaultTeam: 'test-team-id',
      defaultChannel: 'test-channel-id'
    };
  }

  static createEmailConfig(): EmailConfig {
    return {
      smtp: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'test-password'
        }
      },
      from: 'alerts@example.com',
      replyTo: 'support@example.com',
      templates: {
        directory: './templates',
        default: 'default-notification',
        engine: 'handlebars'
      }
    };
  }

  static createWebhookConfig(): WebhookConfig {
    return {
      url: 'https://webhook.test.com/notifications',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      auth: {
        type: 'bearer',
        token: 'test-bearer-token'
      }
    };
  }

  static createDeliveryAttempt(overrides: Partial<DeliveryAttempt> = {}): DeliveryAttempt {
    return {
      id: 'attempt-' + Date.now(),
      notificationId: 'test-notification-123',
      channel: 'email' as NotificationChannel,
      timestamp: Date.now(),
      status: 'sent',
      latency: 150,
      attemptNumber: 1,
      providerResponse: { messageId: 'test-message-123' },
      ...overrides
    };
  }
}

describe('Smart Routing System', () => {
  let smartRouter: SmartRouter;
  let routingConfig: SmartRoutingConfig;

  beforeEach(() => {
    routingConfig = {
      rules: [
        RoutingRuleBuilder.create('Critical Alerts')
          .priority(10)
          .when('severity', 'equals', 'critical')
          .routeTo('voice', 'sms', 'email')
          .setPriority(1)
          .build(),
        RoutingRuleBuilder.create('Business Hours')
          .priority(5)
          .when('metadata.businessHours', 'equals', true)
          .routeTo('email', 'slack')
          .build()
      ],
      schedules: [],
      severityChannels: {
        info: ['email'],
        warning: ['email', 'slack'],
        error: ['email', 'sms', 'slack'],
        critical: ['voice', 'sms', 'email', 'slack']
      },
      businessHours: {
        timezone: 'UTC',
        days: [1, 2, 3, 4, 5], // Monday to Friday
        startTime: '09:00',
        endTime: '17:00'
      },
      emergencyContacts: [
        {
          type: 'user',
          id: 'emergency-contact',
          name: 'Emergency Contact',
          channels: [
            {
              channel: 'voice' as NotificationChannel,
              contact: '+1234567890',
              minSeverity: 'critical' as NotificationSeverity,
              enabled: true
            }
          ]
        }
      ]
    };

    smartRouter = new SmartRouter(routingConfig);
  });

  test('should route critical alerts to voice, SMS, and email', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'critical',
      title: 'Critical Database Failure'
    });

    const routedNotification = await smartRouter.route(notification);

    expect(routedNotification.delivery.channels).toContain('voice');
    expect(routedNotification.delivery.channels).toContain('sms');
    expect(routedNotification.delivery.channels).toContain('email');
    expect(routedNotification.priority).toBe(1);
  });

  test('should apply severity-based routing', async () => {
    const infoNotification = TestDataFactory.createNotification({
      severity: 'info',
      delivery: { ...TestDataFactory.createNotification().delivery, channels: [] }
    });

    const routedNotification = await smartRouter.route(infoNotification);
    expect(routedNotification.delivery.channels).toEqual(['email']);
  });

  test('should handle emergency routing fallback', async () => {
    // Create a notification that will cause routing to fail
    const notification = TestDataFactory.createNotification();
    
    // Mock the routing to throw an error
    jest.spyOn(smartRouter as any, 'applyTimeBasedRouting').mockRejectedValueOnce(new Error('Routing error'));

    const routedNotification = await smartRouter.route(notification);

    expect(routedNotification.recipients).toContain(
      expect.objectContaining({ id: 'emergency-contact' })
    );
  });

  test('should validate routing rules', () => {
    const stats = smartRouter.getRoutingStatistics();
    expect(stats.totalRules).toBeGreaterThan(0);
    expect(stats.activeRules).toBeGreaterThan(0);
  });
});

describe('Voice Channel', () => {
  let voiceChannel: VoiceChannel;
  let mockTwilio: any;

  beforeEach(() => {
    const config = TestDataFactory.createVoiceConfig();
    voiceChannel = new VoiceChannel(config);
    
    // Mock Twilio client
    mockTwilio = {
      calls: {
        create: jest.fn().mockResolvedValue({
          sid: 'test-call-sid',
          status: 'queued',
          duration: null
        })
      }
    };
    (voiceChannel as any).twilioClient = mockTwilio;
  });

  test('should send voice notification successfully', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'critical',
      title: 'Critical System Alert'
    });

    const result = await voiceChannel.send(notification, '+1234567890');

    expect(result.channel).toBe('voice');
    expect(result.status).toBe('pending');
    expect(result.messageId).toBe('test-call-sid');
    expect(result.latency).toBeGreaterThan(0);
    expect(mockTwilio.calls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+1234567890',
        from: '+1234567890'
      })
    );
  });

  test('should generate proper TwiML for interactive calls', () => {
    const twiml = (voiceChannel as any).generateTwiML({
      message: 'Test alert message',
      voice: 'woman',
      language: 'en-US',
      interactive: true
    });

    expect(twiml).toContain('Test alert message');
    expect(twiml).toContain('Press 1 to acknowledge');
    expect(twiml).toContain('<Gather');
  });

  test('should handle Twilio errors gracefully', async () => {
    mockTwilio.calls.create.mockRejectedValueOnce(new Error('Twilio API error'));

    const notification = TestDataFactory.createNotification();

    await expect(voiceChannel.send(notification, '+1234567890'))
      .rejects.toThrow('Voice call failed: Twilio API error');
  });

  test('should validate voice configuration', () => {
    const validConfig = TestDataFactory.createVoiceConfig();
    const validation = VoiceChannelFactory.validateConfig(validConfig);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const invalidConfig = { ...validConfig, config: { ...validConfig.config, accountSid: '' } };
    const invalidValidation = VoiceChannelFactory.validateConfig(invalidConfig);
    
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors).toContain('Twilio Account SID is required');
  });
});

describe('SMS Channel', () => {
  let smsChannel: SmsChannel;
  let mockTwilio: any;

  beforeEach(() => {
    const config = TestDataFactory.createSmsConfig();
    smsChannel = new SmsChannel(config);
    
    mockTwilio = {
      messages: {
        create: jest.fn().mockResolvedValue({
          sid: 'test-sms-sid',
          status: 'queued',
          numSegments: '1',
          price: '0.0075',
          priceUnit: 'USD'
        })
      }
    };
    (smsChannel as any).twilioClient = mockTwilio;
  });

  test('should send SMS notification successfully', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'error',
      title: 'Database Connection Failed'
    });

    const result = await smsChannel.send(notification, '+1234567890', 'sms');

    expect(result.channel).toBe('sms');
    expect(result.status).toBe('pending');
    expect(result.messageId).toBe('test-sms-sid');
    expect(mockTwilio.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+1234567890',
        from: '+1234567890'
      })
    );
  });

  test('should send WhatsApp notification successfully', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'warning',
      title: 'High Memory Usage'
    });

    const result = await smsChannel.send(notification, '+1234567890', 'whatsapp');

    expect(result.channel).toBe('whatsapp');
    expect(mockTwilio.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+1234567890',
        from: 'whatsapp:+1234567890'
      })
    );
  });

  test('should format SMS message correctly', () => {
    const notification = TestDataFactory.createNotification({
      title: 'Test Alert',
      message: 'This is a test message that might be quite long and need truncation',
      severity: 'warning'
    });

    const formatted = (smsChannel as any).formatMessage(notification, 'sms');
    
    expect(formatted).toContain('⚠️ Test Alert');
    expect(formatted).toContain('Severity: WARNING');
    expect(formatted).toContain('Source: test-suite');
  });

  test('should handle bulk SMS sending', async () => {
    const notifications = [
      TestDataFactory.createNotification({ title: 'Alert 1' }),
      TestDataFactory.createNotification({ title: 'Alert 2' }),
      TestDataFactory.createNotification({ title: 'Alert 3' })
    ];
    const recipients = ['+1111111111', '+2222222222', '+3333333333'];

    const results = await smsChannel.sendBulk(notifications, recipients, 'sms');

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.channel).toBe('sms');
      expect(result.status).toBe('pending');
    });
    expect(mockTwilio.messages.create).toHaveBeenCalledTimes(3);
  });
});

describe('Email Channel', () => {
  let emailChannel: EmailChannel;
  let mockTransporter: any;

  beforeEach(() => {
    const config = TestDataFactory.createEmailConfig();
    emailChannel = new EmailChannel(config);
    
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'test-email-id',
        accepted: ['test@example.com'],
        rejected: [],
        response: '250 OK'
      }),
      verify: jest.fn().mockResolvedValue(true)
    };
    (emailChannel as any).transporter = mockTransporter;
  });

  test('should send email notification successfully', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'error',
      title: 'Application Error'
    });

    const result = await emailChannel.send(notification, 'test@example.com');

    expect(result.channel).toBe('email');
    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('test-email-id');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: '[ERROR] Application Error'
      })
    );
  });

  test('should build HTML content with template', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'critical',
      title: 'System Down'
    });

    const htmlContent = await (emailChannel as any).buildHtmlContent(notification);

    expect(htmlContent).toContain('System Down');
    expect(htmlContent).toContain('🚨'); // Critical severity icon
    expect(htmlContent).toContain('#9C27B0'); // Critical severity color
  });

  test('should handle template variables correctly', () => {
    const notification = TestDataFactory.createNotification({
      severity: 'warning',
      title: 'High CPU Usage',
      tags: { server: 'web-01', cpu: '85%' }
    });

    const variables = (emailChannel as any).buildTemplateVariables(notification);

    expect(variables.title).toBe('High CPU Usage');
    expect(variables.severity).toBe('warning');
    expect(variables.severityUpper).toBe('WARNING');
    expect(variables.severityIcon).toBe('⚠️');
    expect(variables.hasTags).toBe(true);
    expect(variables.tags).toEqual({ server: 'web-01', cpu: '85%' });
  });

  test('should validate email configuration', () => {
    const validConfig = TestDataFactory.createEmailConfig();
    const validation = EmailChannelFactory.validateConfig(validConfig);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const invalidConfig = { ...validConfig, smtp: { ...validConfig.smtp, host: '' } };
    const invalidValidation = EmailChannelFactory.validateConfig(invalidConfig);
    
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors).toContain('SMTP host is required');
  });
});

describe('Slack/Teams Channel', () => {
  let slackChannel: SlackChannel;
  let chatChannel: ChatChannel;
  let mockSlackClient: any;

  beforeEach(() => {
    const slackConfig = TestDataFactory.createSlackConfig();
    slackChannel = new SlackChannel(slackConfig);
    chatChannel = new ChatChannel(slackConfig);
    
    mockSlackClient = {
      chat: {
        postMessage: jest.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123456',
          message: { text: 'Test message' }
        }),
        update: jest.fn().mockResolvedValue({ ok: true })
      }
    };
    (slackChannel as any).client = mockSlackClient;
  });

  test('should send Slack notification successfully', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'error',
      title: 'API Gateway Error'
    });

    const result = await slackChannel.send(notification, '#alerts');

    expect(result.channel).toBe('slack');
    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('1234567890.123456');
    expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: '#alerts',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: expect.stringContaining('API Gateway Error')
            })
          })
        ])
      })
    );
  });

  test('should build rich Slack message with blocks', async () => {
    const notification = TestDataFactory.createNotification({
      severity: 'critical',
      title: 'Database Failover',
      tags: { database: 'primary', region: 'us-east-1' }
    });

    const messageOptions = await (slackChannel as any).buildSlackMessage(notification, '#alerts');

    expect(messageOptions.blocks).toBeDefined();
    expect(messageOptions.blocks).toContainEqual(
      expect.objectContaining({
        type: 'header',
        text: expect.objectContaining({
          text: expect.stringContaining('Database Failover')
        })
      })
    );

    // Should have interactive buttons
    const actionsBlock = messageOptions.blocks.find((block: any) => block.type === 'actions');
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock.elements).toContainEqual(
      expect.objectContaining({
        action_id: 'acknowledge'
      })
    );
  });

  test('should handle Slack interaction webhooks', async () => {
    const mockPayload = {
      actions: [{ action_id: 'acknowledge', value: 'test-notification-123' }],
      user: { id: 'U123456' },
      channel: { id: 'C123456' },
      message: { ts: '1234567890.123456' }
    };

    const interaction = await slackChannel.handleInteraction(mockPayload);

    expect(interaction.action).toBe('acknowledge');
    expect(interaction.notificationId).toBe('test-notification-123');
    expect(interaction.userId).toBe('U123456');
    expect(interaction.channel).toBe('C123456');
  });

  test('should update message with acknowledgment', async () => {
    await slackChannel.updateWithAcknowledgment('1234567890.123456', '#alerts', 'U123456');

    expect(mockSlackClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: '#alerts',
        ts: '1234567890.123456',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('Acknowledged by <@U123456>')
            })
          })
        ])
      })
    );
  });
});

describe('Webhook Manager', () => {
  let webhookManager: WebhookManager;

  beforeEach(() => {
    webhookManager = new WebhookManager();
  });

  test('should register webhook endpoint', () => {
    const webhook = webhookManager.register({
      name: 'Test Webhook',
      description: 'Test webhook for unit testing',
      config: TestDataFactory.createWebhookConfig(),
      enabled: true,
      filters: [
        {
          field: 'severity',
          operator: 'equals',
          value: 'critical'
        }
      ]
    });

    expect(webhook.id).toBeDefined();
    expect(webhook.name).toBe('Test Webhook');
    expect(webhook.enabled).toBe(true);
    expect(webhook.stats).toBeDefined();
  });

  test('should filter notifications based on webhook filters', async () => {
    const webhook = webhookManager.register({
      name: 'Critical Alerts Only',
      description: 'Only receive critical alerts',
      config: TestDataFactory.createWebhookConfig(),
      enabled: true,
      filters: [
        {
          field: 'severity',
          operator: 'equals',
          value: 'critical'
        }
      ]
    });

    // Mock HTTP request
    jest.spyOn(webhookManager as any, 'sendHttpRequest').mockResolvedValueOnce({
      status: 200,
      data: { success: true }
    });

    const criticalNotification = TestDataFactory.createNotification({ severity: 'critical' });
    const infoNotification = TestDataFactory.createNotification({ severity: 'info' });

    const criticalResult = await webhookManager.sendToWebhook(webhook, criticalNotification);
    const infoResult = await webhookManager.sendToWebhook(webhook, infoNotification);

    expect(criticalResult.status).toBe('success');
    expect(infoResult.status).toBe('success');
    expect(infoResult.error).toBe('Filtered out');
  });

  test('should handle webhook authentication', async () => {
    const webhook = webhookManager.register({
      name: 'Authenticated Webhook',
      description: 'Webhook with bearer auth',
      config: {
        ...TestDataFactory.createWebhookConfig(),
        auth: {
          type: 'bearer',
          token: 'secret-bearer-token'
        }
      },
      enabled: true
    });

    const mockRequestConfig = (webhookManager as any).buildRequestConfig(
      webhook.config,
      { event: 'test', timestamp: Date.now(), notification: TestDataFactory.createNotification() }
    );

    expect(mockRequestConfig.headers['Authorization']).toBe('Bearer secret-bearer-token');
  });

  test('should validate webhook configuration', () => {
    const validConfig = TestDataFactory.createWebhookConfig();
    const validation = WebhookManagerFactory.validateWebhookConfig(validConfig);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const invalidConfig = { ...validConfig, url: 'invalid-url' };
    const invalidValidation = WebhookManagerFactory.validateWebhookConfig(invalidConfig);
    
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors).toContain('Invalid webhook URL format');
  });
});

describe('Delivery Tracking', () => {
  let deliveryTracker: MemoryDeliveryTracker;

  beforeEach(() => {
    deliveryTracker = new MemoryDeliveryTracker();
  });

  test('should track delivery attempts', async () => {
    const attempt = TestDataFactory.createDeliveryAttempt({
      channel: 'email',
      status: 'sent',
      latency: 250
    });

    await deliveryTracker.trackAttempt(attempt);

    const status = await deliveryTracker.getStatus(attempt.notificationId);
    expect(status.attempts).toContainEqual(attempt);
  });

  test('should record delivery receipts', async () => {
    const receipt: DeliveryReceipt = {
      id: 'receipt-123',
      notificationId: 'test-notification-123',
      attemptId: 'attempt-123',
      timestamp: Date.now(),
      status: 'delivered',
      providerData: { messageId: 'provider-msg-123' }
    };

    await deliveryTracker.recordReceipt(receipt);

    const status = await deliveryTracker.getStatus(receipt.notificationId);
    expect(status.receipts).toContainEqual(receipt);
  });

  test('should record acknowledgments', async () => {
    const acknowledgment: AcknowledgmentReceipt = {
      id: 'ack-123',
      notificationId: 'test-notification-123',
      acknowledgedBy: 'user-123',
      timestamp: Date.now(),
      channel: 'slack',
      notes: 'Issue resolved'
    };

    await deliveryTracker.recordAcknowledgment(acknowledgment);

    const status = await deliveryTracker.getStatus(acknowledgment.notificationId);
    expect(status.acknowledgments).toContainEqual(acknowledgment);
  });

  test('should update delivery status', async () => {
    const attempt = TestDataFactory.createDeliveryAttempt({ status: 'sending' });
    await deliveryTracker.trackAttempt(attempt);

    await deliveryTracker.updateStatus(attempt.id, 'delivered', { providerId: 'updated-id' });

    const status = await deliveryTracker.getStatus(attempt.notificationId);
    const updatedAttempt = status.attempts.find(a => a.id === attempt.id);
    expect(updatedAttempt?.status).toBe('delivered');
  });

  test('should calculate delivery statistics', async () => {
    // Track multiple attempts
    const attempts = [
      TestDataFactory.createDeliveryAttempt({ status: 'delivered', channel: 'email' }),
      TestDataFactory.createDeliveryAttempt({ status: 'delivered', channel: 'sms' }),
      TestDataFactory.createDeliveryAttempt({ status: 'failed', channel: 'email' }),
    ];

    for (const attempt of attempts) {
      await deliveryTracker.trackAttempt(attempt);
    }

    const stats = await deliveryTracker.getStatistics();
    expect(stats.total).toBe(3);
    expect(stats.successful).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.successRate).toBeCloseTo(2/3);
  });
});

describe('Rate Limiting', () => {
  let tokenBucketLimiter: TokenBucketLimiter;
  let slidingWindowLimiter: SlidingWindowLimiter;
  let fixedWindowLimiter: FixedWindowLimiter;

  beforeEach(() => {
    // Mock Redis for tests
    const mockRedis = {
      eval: jest.fn(),
      hmget: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      zremrangebyscore: jest.fn(),
      zcard: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn()
    };

    const redisConfig = {};
    
    tokenBucketLimiter = new TokenBucketLimiter(redisConfig, {
      email: { capacity: 10, refillRate: 1, initialTokens: 10 },
      sms: { capacity: 5, refillRate: 0.5, initialTokens: 5 }
    });
    (tokenBucketLimiter as any).redis = mockRedis;

    slidingWindowLimiter = new SlidingWindowLimiter(redisConfig, {
      email: { windowSize: 60, maxRequests: 100 },
      sms: { windowSize: 60, maxRequests: 20 }
    });
    (slidingWindowLimiter as any).redis = mockRedis;

    fixedWindowLimiter = new FixedWindowLimiter(redisConfig, {
      email: { windowSize: 60, maxRequests: 100 },
      sms: { windowSize: 60, maxRequests: 20 }
    });
    (fixedWindowLimiter as any).redis = mockRedis;
  });

  describe('Token Bucket Limiter', () => {
    test('should allow request when tokens available', async () => {
      const mockRedis = (tokenBucketLimiter as any).redis;
      mockRedis.eval.mockResolvedValueOnce([1, 9, Date.now() / 1000]); // Allow, 9 tokens remaining

      const result = await tokenBucketLimiter.isAllowed('email', 'user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    test('should deny request when no tokens available', async () => {
      const mockRedis = (tokenBucketLimiter as any).redis;
      mockRedis.eval.mockResolvedValueOnce([0, 0, Date.now() / 1000, 5]); // Deny, 0 tokens, retry after 5s

      const result = await tokenBucketLimiter.isAllowed('email', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(5);
    });
  });

  describe('Sliding Window Limiter', () => {
    test('should allow request within window limit', async () => {
      const mockRedis = (slidingWindowLimiter as any).redis;
      mockRedis.eval.mockResolvedValueOnce([1, 99, Date.now() / 1000]); // Allow, 99 remaining

      const result = await slidingWindowLimiter.isAllowed('email', 'user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    test('should deny request when window limit exceeded', async () => {
      const mockRedis = (slidingWindowLimiter as any).redis;
      mockRedis.eval.mockResolvedValueOnce([0, 0, Date.now() / 1000]); // Deny, 0 remaining

      const result = await slidingWindowLimiter.isAllowed('email', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Fixed Window Limiter', () => {
    test('should allow request within window limit', async () => {
      const mockRedis = (fixedWindowLimiter as any).redis;
      mockRedis.incr.mockResolvedValueOnce(1); // First request

      const result = await fixedWindowLimiter.isAllowed('email', 'user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    test('should deny request when window limit exceeded', async () => {
      const mockRedis = (fixedWindowLimiter as any).redis;
      mockRedis.incr.mockResolvedValueOnce(101); // Over limit

      const result = await fixedWindowLimiter.isAllowed('email', 'user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Rate Limit Manager', () => {
    test('should throw RateLimitError when limit exceeded', async () => {
      const manager = new RateLimitManager({});
      const mockLimiter = {
        isAllowed: jest.fn().mockResolvedValue({
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 60000,
          retryAfter: 60
        })
      } as any;

      manager.addLimiter('email', mockLimiter);

      await expect(manager.isAllowed('email', 'user-123'))
        .rejects.toThrow('Rate limit exceeded for email');
    });
  });
});

describe('Template Engine', () => {
  let templateEngine: HandlebarsTemplateEngine;
  let config: TemplateEngineConfig;

  beforeEach(() => {
    config = {
      directory: './templates',
      engine: 'handlebars',
      cache: true,
      hotReload: false,
      defaultLanguage: 'en',
      languages: ['en', 'es'],
      themes: {
        default: { directory: './themes/default' },
        corporate: { directory: './themes/corporate' }
      }
    };

    templateEngine = new HandlebarsTemplateEngine(config);
  });

  test('should compile template from string', async () => {
    const template = 'Hello {{notification.title}}! Severity: {{upper notification.severity}}';
    const variables = {
      notification: TestDataFactory.createNotification({
        title: 'Test Alert',
        severity: 'warning'
      })
    };

    const result = await templateEngine.compile(template, variables);

    expect(result).toContain('Hello Test Alert!');
    expect(result).toContain('Severity: WARNING');
  });

  test('should validate template syntax', () => {
    const validTemplate = 'Hello {{name}}!';
    const invalidTemplate = 'Hello {{unclosed}';

    const validResult = templateEngine.validate(validTemplate);
    const invalidResult = templateEngine.validate(invalidTemplate);

    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  test('should handle custom helpers', async () => {
    const template = `
      Date: {{formatDate notification.timestamp "relative"}}
      Severity Color: {{severityColor notification.severity}}
      Is Critical: {{eq notification.severity "critical"}}
      Truncated: {{truncate notification.message 20}}
    `;

    const variables = {
      notification: TestDataFactory.createNotification({
        severity: 'critical',
        message: 'This is a very long message that should be truncated'
      })
    };

    const result = await templateEngine.compile(template, variables);

    expect(result).toContain('Severity Color: #9C27B0');
    expect(result).toContain('Is Critical: true');
    expect(result).toContain('Truncated: This is a very long ...');
  });

  test('should register and render named templates', () => {
    const template = {
      id: 'test-template',
      name: 'Test Template',
      description: 'Test template for unit testing',
      channel: 'email' as NotificationChannel,
      content: {
        subject: 'Alert: {{notification.title}}',
        body: 'Message: {{notification.message}}'
      },
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    templateEngine.register('test-template', template);

    const templates = templateEngine.list();
    expect(templates).toContainEqual(template);
  });

  test('should handle template errors gracefully', async () => {
    const invalidTemplate = '{{undefined.property.chain}}';

    await expect(templateEngine.compile(invalidTemplate, {}))
      .rejects.toThrow(/Template compilation failed/);
  });
});

describe('Performance and Integration Tests', () => {
  test('should handle high volume of notifications', async () => {
    const deliveryTracker = new MemoryDeliveryTracker();
    const startTime = Date.now();
    
    // Track 1000 delivery attempts
    const promises = Array.from({ length: 1000 }, (_, i) => {
      const attempt = TestDataFactory.createDeliveryAttempt({
        id: `attempt-${i}`,
        notificationId: `notification-${Math.floor(i / 10)}`, // 10 attempts per notification
        latency: Math.random() * 1000
      });
      return deliveryTracker.trackAttempt(attempt);
    });

    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    const stats = await deliveryTracker.getStatistics();

    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(stats.total).toBe(1000);
  });

  test('should handle concurrent webhook deliveries', async () => {
    const webhookManager = new WebhookManager();
    
    // Mock successful HTTP responses
    jest.spyOn(webhookManager as any, 'sendHttpRequest').mockResolvedValue({
      status: 200,
      data: { success: true }
    });

    // Register multiple webhooks
    const webhooks = Array.from({ length: 10 }, (_, i) => 
      webhookManager.register({
        name: `Webhook ${i}`,
        description: `Test webhook ${i}`,
        config: TestDataFactory.createWebhookConfig(),
        enabled: true
      })
    );

    const notification = TestDataFactory.createNotification();
    const startTime = Date.now();

    // Send notification to all webhooks concurrently
    const promises = webhooks.map(webhook => 
      webhookManager.sendToWebhook(webhook, notification)
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.status).toBe('success');
    });
    expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
  });

  test('should maintain accuracy under load', async () => {
    const smartRouter = new SmartRouter({
      rules: [],
      schedules: [],
      severityChannels: {
        info: ['email'],
        warning: ['email', 'slack'],
        error: ['email', 'sms', 'slack'],
        critical: ['voice', 'sms', 'email', 'slack']
      },
      businessHours: {
        timezone: 'UTC',
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00'
      },
      emergencyContacts: []
    });

    // Route 100 notifications of different severities
    const notifications = Array.from({ length: 100 }, (_, i) => {
      const severities: NotificationSeverity[] = ['info', 'warning', 'error', 'critical'];
      return TestDataFactory.createNotification({
        id: `load-test-${i}`,
        severity: severities[i % severities.length]
      });
    });

    const routedNotifications = await Promise.all(
      notifications.map(n => smartRouter.route(n))
    );

    // Verify routing accuracy
    routedNotifications.forEach((routed, i) => {
      const originalSeverity = notifications[i].severity;
      const expectedChannels = {
        info: ['email'],
        warning: ['email', 'slack'],
        error: ['email', 'sms', 'slack'],
        critical: ['voice', 'sms', 'email', 'slack']
      }[originalSeverity];

      expectedChannels.forEach(channel => {
        expect(routed.delivery.channels).toContain(channel);
      });
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  test('should handle network timeouts gracefully', async () => {
    const webhookManager = new WebhookManager();
    
    // Mock network timeout
    jest.spyOn(webhookManager as any, 'sendHttpRequest').mockRejectedValueOnce(
      new Error('TIMEOUT: Request timed out')
    );

    const webhook = webhookManager.register({
      name: 'Timeout Test',
      description: 'Test webhook timeout handling',
      config: TestDataFactory.createWebhookConfig(),
      enabled: true
    });

    const notification = TestDataFactory.createNotification();
    const result = await webhookManager.sendToWebhook(webhook, notification);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('TIMEOUT');
  });

  test('should handle malformed notification data', async () => {
    const smartRouter = new SmartRouter({
      rules: [],
      schedules: [],
      severityChannels: {},
      businessHours: {
        timezone: 'UTC',
        days: [],
        startTime: '09:00',
        endTime: '17:00'
      },
      emergencyContacts: []
    });

    // Create malformed notification
    const malformedNotification = {
      ...TestDataFactory.createNotification(),
      severity: 'invalid-severity' as any,
      recipients: null as any
    };

    // Should fallback to emergency routing
    const routed = await smartRouter.route(malformedNotification);
    
    expect(routed).toBeDefined();
    expect(routed.delivery.channels).toContain('email'); // Fallback channel
  });

  test('should handle Redis connection failures', async () => {
    const mockRedis = {
      eval: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      ping: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
    };

    const rateLimitManager = new RateLimitManager({});
    (rateLimitManager as any).redis = mockRedis;

    const health = await rateLimitManager.getHealth();
    expect(health.redisConnected).toBe(false);
  });

  test('should validate configuration objects', () => {
    // Test various invalid configurations
    const invalidEmailConfig = {
      smtp: {
        host: '',
        port: 0,
        auth: { user: '', pass: '' }
      },
      from: ''
    } as any;

    const validation = EmailChannelFactory.validateConfig(invalidEmailConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should handle empty or null data gracefully', async () => {
    const deliveryTracker = new MemoryDeliveryTracker();
    
    // Test with empty notification ID
    const status = await deliveryTracker.getStatus('');
    expect(status.attempts).toHaveLength(0);
    expect(status.receipts).toHaveLength(0);
    expect(status.acknowledgments).toHaveLength(0);
  });
});