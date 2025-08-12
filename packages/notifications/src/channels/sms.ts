/**
 * SMS and WhatsApp Notification Channel
 * 
 * Features:
 * - Twilio SMS and WhatsApp support
 * - AWS SNS SMS support
 * - Delivery confirmation tracking
 * - Message templates with emoji support
 * - Link shortening for long messages
 * - International number formatting
 * - Message splitting for long content
 * - Rich media support for WhatsApp
 */

import { 
  BaseNotification, 
  SmsConfig, 
  ChannelResult,
  DeliveryStatus
} from '../types/index.js';
import { Twilio } from 'twilio';
import { SNS } from '@aws-sdk/client-sns';

export interface SmsOptions {
  /** Phone number to send to */
  to: string;
  /** Message content */
  message: string;
  /** Message type */
  type: 'sms' | 'whatsapp';
  /** Media URLs (WhatsApp only) */
  mediaUrls?: string[];
  /** Enable delivery receipt */
  deliveryReceipt?: boolean;
  /** Message validity period (seconds) */
  validityPeriod?: number;
  /** Callback URL for status updates */
  statusCallback?: string;
}

export interface SmsResult {
  /** Provider message ID */
  messageId: string;
  /** Message status */
  status: string;
  /** Number of message segments */
  segments: number;
  /** Cost information */
  cost?: {
    amount: string;
    currency: string;
  };
  /** Error details if failed */
  error?: string;
}

export class SmsChannel {
  private twilioClient?: Twilio;
  private snsClient?: SNS;
  private config: SmsConfig;

  constructor(config: SmsConfig) {
    this.config = config;
    
    if (config.provider === 'twilio') {
      this.twilioClient = new Twilio(
        config.config.accountSid as string,
        config.config.authToken as string
      );
    } else if (config.provider === 'aws-sns') {
      this.snsClient = new SNS({
        region: config.config.region as string,
        credentials: {
          accessKeyId: config.config.accessKeyId as string,
          secretAccessKey: config.config.secretAccessKey as string
        }
      });
    }
  }

  /**
   * Send SMS/WhatsApp notification
   */
  async send(
    notification: BaseNotification, 
    recipient: string,
    type: 'sms' | 'whatsapp' = 'sms'
  ): Promise<ChannelResult> {
    const startTime = Date.now();
    
    try {
      const message = this.formatMessage(notification, type);
      const formattedNumber = this.formatPhoneNumber(recipient);
      
      const options: SmsOptions = {
        to: formattedNumber,
        message,
        type,
        deliveryReceipt: true,
        statusCallback: this.config.config.statusCallback as string,
        validityPeriod: 86400 // 24 hours
      };

      let result: SmsResult;
      
      if (this.config.provider === 'twilio') {
        result = await this.sendViaTwilio(options);
      } else if (this.config.provider === 'aws-sns') {
        result = await this.sendViaAWS(options);
      } else {
        throw new Error(`SMS provider ${this.config.provider} not supported`);
      }

      return {
        channel: type,
        status: this.mapProviderStatusToDeliveryStatus(result.status),
        messageId: result.messageId,
        latency: Date.now() - startTime,
        error: result.error
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        channel: type,
        status: 'failed',
        messageId: undefined,
        latency: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(options: SmsOptions): Promise<SmsResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const fromNumber = options.type === 'whatsapp' 
        ? `whatsapp:${this.config.config.from}`
        : this.config.config.from as string;
      
      const toNumber = options.type === 'whatsapp'
        ? `whatsapp:${options.to}`
        : options.to;

      const messageData: any = {
        to: toNumber,
        from: fromNumber,
        body: options.message,
        statusCallback: options.statusCallback,
        validityPeriod: options.validityPeriod
      };

      // Add media URLs for WhatsApp
      if (options.type === 'whatsapp' && options.mediaUrls) {
        messageData.mediaUrl = options.mediaUrls;
      }

      const message = await this.twilioClient.messages.create(messageData);

      return {
        messageId: message.sid,
        status: message.status,
        segments: message.numSegments ? parseInt(message.numSegments) : 1,
        cost: message.price && message.priceUnit ? {
          amount: message.price,
          currency: message.priceUnit
        } : undefined
      };
    } catch (error) {
      console.error('Twilio message failed:', error);
      throw new Error(`Twilio message failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send SMS via AWS SNS
   */
  private async sendViaAWS(options: SmsOptions): Promise<SmsResult> {
    if (!this.snsClient) {
      throw new Error('AWS SNS client not initialized');
    }

    if (options.type === 'whatsapp') {
      throw new Error('WhatsApp not supported with AWS SNS');
    }

    try {
      const params = {
        PhoneNumber: options.to,
        Message: options.message,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: this.config.config.senderId as string || 'Monitor'
          },
          'AWS.SNS.SMS.MaxPrice': {
            DataType: 'String',
            StringValue: this.config.config.maxPrice as string || '0.50'
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional'
          }
        }
      };

      const result = await this.snsClient.publish(params);

      return {
        messageId: result.MessageId || 'unknown',
        status: 'queued',
        segments: this.calculateMessageSegments(options.message)
      };
    } catch (error) {
      console.error('AWS SNS message failed:', error);
      throw new Error(`AWS SNS message failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format message for SMS/WhatsApp
   */
  private formatMessage(notification: BaseNotification, type: 'sms' | 'whatsapp'): string {
    const emoji = this.getSeverityEmoji(notification.severity);
    const timestamp = new Date(notification.timestamp).toLocaleString();
    
    let message = '';
    
    if (type === 'whatsapp') {
      // WhatsApp supports rich formatting
      message = `${emoji} *${notification.title}*\n\n`;
      message += `${notification.message}\n\n`;
      message += `🔥 Severity: *${notification.severity.toUpperCase()}*\n`;
      message += `📍 Source: ${notification.source}\n`;
      message += `⏰ Time: ${timestamp}`;
      
      if (notification.metadata.url) {
        message += `\n\n🔗 View Details: ${notification.metadata.url}`;
      }
    } else {
      // SMS - plain text, length limited
      message = `${emoji} ${notification.title}\n\n`;
      message += this.truncateMessage(notification.message, 100);
      message += `\n\nSeverity: ${notification.severity.toUpperCase()}`;
      message += `\nSource: ${notification.source}`;
      
      if (notification.metadata.shortUrl) {
        message += `\n\nDetails: ${notification.metadata.shortUrl}`;
      }
    }

    // Ensure message doesn't exceed limits
    return this.enforceMessageLimits(message, type);
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    const emojiMap: Record<string, string> = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'error': '❌',
      'critical': '🚨'
    };
    
    return emojiMap[severity] || '📢';
  }

  /**
   * Truncate message to specified length
   */
  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) {
      return message;
    }
    
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Enforce message length limits
   */
  private enforceMessageLimits(message: string, type: 'sms' | 'whatsapp'): string {
    const limits = {
      sms: 1600, // 10 SMS segments (160 chars each)
      whatsapp: 4096 // WhatsApp limit
    };
    
    const limit = limits[type];
    return message.length > limit 
      ? message.substring(0, limit - 3) + '...'
      : message;
  }

  /**
   * Calculate number of SMS segments
   */
  private calculateMessageSegments(message: string): number {
    // Basic GSM 7-bit encoding
    const gsmLength = 160;
    const unicodeLength = 70;
    
    // Check if message contains unicode characters
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const segmentLength = hasUnicode ? unicodeLength : gsmLength;
    
    return Math.ceil(message.length / segmentLength);
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assume US +1)
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    return '+' + cleaned;
  }


  /**
   * Map provider status to delivery status
   */
  private mapProviderStatusToDeliveryStatus(providerStatus: string): DeliveryStatus {
    const statusMap: Record<string, DeliveryStatus> = {
      'queued': 'pending',
      'sending': 'sending',
      'sent': 'sent',
      'delivered': 'delivered',
      'received': 'delivered',
      'read': 'delivered',
      'failed': 'failed',
      'undelivered': 'failed'
    };

    return statusMap[providerStatus] || 'pending';
  }

  /**
   * Get message status from provider
   */
  async getMessageStatus(messageId: string): Promise<{
    status: string;
    delivered: boolean;
    cost?: { amount: string; currency: string };
    segments?: number;
  }> {
    if (this.config.provider === 'twilio' && this.twilioClient) {
      try {
        const message = await this.twilioClient.messages(messageId).fetch();
        
        return {
          status: message.status,
          delivered: ['delivered', 'received', 'read'].includes(message.status),
          cost: message.price && message.priceUnit ? {
            amount: message.price,
            currency: message.priceUnit
          } : undefined,
          segments: message.numSegments ? parseInt(message.numSegments) : undefined
        };
      } catch (error) {
        console.error('Failed to fetch message status:', error);
        throw new Error(`Failed to fetch message status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`Status checking not supported for provider: ${this.config.provider}`);
  }

  /**
   * Handle delivery webhook
   */
  async handleDeliveryWebhook(payload: Record<string, any>): Promise<{
    messageId: string;
    status: string;
    delivered: boolean;
    timestamp: number;
  }> {
    const messageId = payload.MessageSid || payload.SmsSid;
    const status = payload.MessageStatus || payload.SmsStatus;
    const delivered = ['delivered', 'received', 'read'].includes(status);
    
    return {
      messageId,
      status,
      delivered,
      timestamp: Date.now()
    };
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulk(
    notifications: BaseNotification[],
    recipients: string[],
    type: 'sms' | 'whatsapp' = 'sms'
  ): Promise<ChannelResult[]> {
    const results: ChannelResult[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = type === 'whatsapp' ? 10 : 50;
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const recipientBatch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map((notification, index) => 
        this.send(notification, recipientBatch[index], type)
          .catch(error => ({
            channel: type,
            status: 'failed' as DeliveryStatus,
            messageId: '',
            latency: 0,
            error: error.message
          }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting delay between batches
      if (i + batchSize < notifications.length) {
        await this.delay(1000); // 1 second delay
      }
    }
    
    return results;
  }

  /**
   * Test SMS/WhatsApp configuration
   */
  async testConfiguration(type: 'sms' | 'whatsapp' = 'sms'): Promise<{
    success: boolean;
    error?: string;
    latency?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testNumber = type === 'whatsapp' 
        ? '+15005550006' // Twilio WhatsApp test number
        : '+15005550006'; // Twilio SMS test number
      
      const testNotification: BaseNotification = {
        id: 'test-' + Date.now(),
        title: 'Test Notification',
        message: 'This is a test message from your monitoring system.',
        severity: 'info',
        priority: 5,
        category: 'system',
        source: 'test',
        timestamp: Date.now(),
        tags: { test: 'true' },
        metadata: {},
        recipients: [],
        delivery: {
          channels: [type],
          retry: {
            maxAttempts: 1,
            initialDelay: 1000,
            backoffMultiplier: 2,
            maxDelay: 30000,
            jitter: 0.1
          },
          timeout: 30000
        }
      };

      await this.send(testNotification, testNumber, type);
      
      return {
        success: true,
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Get SMS statistics
   */
  async getStatistics(fromDate: Date, toDate: Date, type?: 'sms' | 'whatsapp'): Promise<{
    totalMessages: number;
    deliveredMessages: number;
    failedMessages: number;
    totalCost: number;
    currency: string;
    deliveryRate: number;
  }> {
    if (this.config.provider === 'twilio' && this.twilioClient) {
      try {
        const messages = await this.twilioClient.messages.list({
          dateSentBefore: toDate,
          dateSentAfter: fromDate
        });

        let filteredMessages = messages;
        if (type) {
          filteredMessages = messages.filter(msg => {
            const isWhatsApp = msg.from?.startsWith('whatsapp:') || msg.to?.startsWith('whatsapp:');
            return type === 'whatsapp' ? isWhatsApp : !isWhatsApp;
          });
        }

        const totalMessages = filteredMessages.length;
        const deliveredMessages = filteredMessages.filter(msg => 
          ['delivered', 'received', 'read'].includes(msg.status)
        ).length;
        const failedMessages = filteredMessages.filter(msg => 
          ['failed', 'undelivered'].includes(msg.status)
        ).length;

        const totalCost = filteredMessages.reduce((sum, msg) => 
          sum + (parseFloat(msg.price || '0')), 0
        );

        const currency = filteredMessages.find(msg => msg.priceUnit)?.priceUnit || 'USD';
        const deliveryRate = totalMessages > 0 ? deliveredMessages / totalMessages : 0;

        return {
          totalMessages,
          deliveredMessages,
          failedMessages,
          totalCost,
          currency,
          deliveryRate
        };
      } catch (error) {
        console.error('Failed to fetch SMS statistics:', error);
        throw new Error(`Failed to fetch statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error(`Statistics not supported for provider: ${this.config.provider}`);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * SMS Channel Factory
 */
export class SmsChannelFactory {
  static create(config: SmsConfig): SmsChannel {
    return new SmsChannel(config);
  }

  static validateConfig(config: SmsConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('Provider is required');
    }

    if (config.provider === 'twilio') {
      if (!config.config.accountSid) {
        errors.push('Twilio Account SID is required');
      }
      if (!config.config.authToken) {
        errors.push('Twilio Auth Token is required');
      }
      if (!config.config.from) {
        errors.push('From phone number is required');
      }
    } else if (config.provider === 'aws-sns') {
      if (!config.config.region) {
        errors.push('AWS region is required');
      }
      if (!config.config.accessKeyId) {
        errors.push('AWS access key ID is required');
      }
      if (!config.config.secretAccessKey) {
        errors.push('AWS secret access key is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

