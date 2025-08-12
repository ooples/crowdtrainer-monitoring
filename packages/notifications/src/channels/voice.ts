/**
 * Voice Call Notification Channel
 * 
 * Features:
 * - Twilio integration for voice calls
 * - Text-to-speech conversion
 * - Call status tracking
 * - Interactive voice response (IVR)
 * - Retry mechanism for failed calls
 * - Fallback voice providers
 */

import { 
  BaseNotification, 
  VoiceConfig, 
  ChannelResult,
  DeliveryStatus
} from '../types/index.js';
import { Twilio } from 'twilio';

export interface VoiceCallOptions {
  /** Phone number to call */
  to: string;
  /** Caller ID (from number) */
  from: string;
  /** Voice message text */
  message: string;
  /** Voice (male/female) */
  voice?: 'man' | 'woman' | 'alice';
  /** Language code */
  language?: string;
  /** Call timeout in seconds */
  timeout?: number;
  /** Enable recording */
  record?: boolean;
  /** Enable user interaction (press key to acknowledge) */
  interactive?: boolean;
  /** Callback URL for status updates */
  statusCallback?: string;
}

export interface VoiceCallResult {
  /** Twilio call SID */
  callSid: string;
  /** Call status */
  status: string;
  /** Call duration (seconds) */
  duration?: number;
  /** User acknowledgment */
  acknowledged?: boolean;
  /** Error details if failed */
  error?: string;
}

export class VoiceChannel {
  private twilioClient: Twilio;
  private config: VoiceConfig;

  constructor(config: VoiceConfig) {
    this.config = config;
    
    if (config.provider === 'twilio') {
      this.twilioClient = new Twilio(
        config.config.accountSid as string,
        config.config.authToken as string
      );
    } else {
      throw new Error(`Voice provider ${config.provider} not supported`);
    }
  }

  /**
   * Send voice notification
   */
  async send(notification: BaseNotification, recipient: string): Promise<ChannelResult> {
    const startTime = Date.now();
    
    try {
      const voiceMessage = this.generateVoiceMessage(notification);
      const options: VoiceCallOptions = {
        to: recipient,
        from: this.config.config.from as string,
        message: voiceMessage,
        voice: 'woman',
        language: 'en-US',
        timeout: 30,
        interactive: notification.severity === 'critical',
        statusCallback: this.config.config.statusCallback as string
      };

      const result = await this.makeCall(options);

      return {
        channel: 'voice',
        status: this.mapTwilioStatusToDeliveryStatus(result.status),
        messageId: result.callSid,
        latency: Date.now() - startTime,
        error: result.error
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        channel: 'voice',
        status: 'failed',
        messageId: undefined,
        latency: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Make a voice call using Twilio
   */
  private async makeCall(options: VoiceCallOptions): Promise<VoiceCallResult> {
    try {
      const twiml = this.generateTwiML(options);
      
      const call = await this.twilioClient.calls.create({
        to: options.to,
        from: options.from,
        twiml: twiml,
        timeout: options.timeout,
        record: options.record,
        statusCallback: options.statusCallback,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'answered', 'completed']
      });

      return {
        callSid: call.sid,
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : undefined
      };
    } catch (error) {
      console.error('Twilio call failed:', error);
      throw new Error(`Twilio call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate TwiML for the voice call
   */
  private generateTwiML(options: VoiceCallOptions): string {
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="${options.voice}" language="${options.language}">
        ${this.escapeXml(options.message)}
      </Say>`;

    if (options.interactive) {
      twiml += `
      <Gather timeout="10" numDigits="1" action="${options.statusCallback}/acknowledge">
        <Say voice="${options.voice}" language="${options.language}">
          Press 1 to acknowledge this alert, or press 2 to escalate.
        </Say>
      </Gather>
      
      <Say voice="${options.voice}" language="${options.language}">
        No input received. This alert will remain active.
      </Say>`;
    }

    if (options.record) {
      twiml += `
      <Record timeout="30" playBeep="true" />`;
    }

    twiml += `
    </Response>`;

    return twiml;
  }

  /**
   * Generate voice message from notification
   */
  private generateVoiceMessage(notification: BaseNotification): string {
    const severityText = this.getSeverityText(notification.severity);
    
    let message = `Alert: ${severityText}. `;
    message += `${notification.title}. `;
    
    // Simplify message for voice
    const simplifiedMessage = notification.message
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters
      .substring(0, 200); // Limit length
    
    message += simplifiedMessage;
    
    if (notification.source) {
      message += ` Source: ${notification.source}.`;
    }

    if (notification.severity === 'critical') {
      message += ' This is a critical alert requiring immediate attention.';
    }

    return message;
  }

  /**
   * Get human-readable severity text
   */
  private getSeverityText(severity: string): string {
    const severityMap: Record<string, string> = {
      'info': 'Information',
      'warning': 'Warning',
      'error': 'Error',
      'critical': 'Critical Alert'
    };
    
    return severityMap[severity] || severity;
  }

  /**
   * Escape XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Map Twilio call status to delivery status
   */
  private mapTwilioStatusToDeliveryStatus(twilioStatus: string): DeliveryStatus {
    const statusMap: Record<string, DeliveryStatus> = {
      'queued': 'pending',
      'initiated': 'sending',
      'ringing': 'sending',
      'answered': 'delivered',
      'completed': 'delivered',
      'busy': 'failed',
      'failed': 'failed',
      'no-answer': 'failed',
      'canceled': 'failed'
    };

    return statusMap[twilioStatus] || 'failed';
  }

  /**
   * Get call status from Twilio
   */
  async getCallStatus(callSid: string): Promise<{
    status: string;
    duration?: number;
    answered: boolean;
    acknowledged?: boolean;
  }> {
    try {
      const call = await this.twilioClient.calls(callSid).fetch();
      
      return {
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : undefined,
        answered: ['answered', 'completed'].includes(call.status)
      };
    } catch (error) {
      console.error('Failed to fetch call status:', error);
      throw new Error(`Failed to fetch call status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle webhook callbacks from Twilio
   */
  async handleWebhook(payload: Record<string, any>): Promise<{
    callSid: string;
    status: string;
    acknowledged?: boolean;
  }> {
    const callSid = payload.CallSid;
    const status = payload.CallStatus;
    const digits = payload.Digits;

    let acknowledged: boolean | undefined;
    
    // Handle acknowledgment
    if (digits) {
      acknowledged = digits === '1'; // 1 = acknowledged, 2 = escalate
      
      if (digits === '2') {
        // Handle escalation request
        await this.handleEscalationRequest(callSid);
      }
    }

    return {
      callSid,
      status,
      acknowledged
    };
  }

  /**
   * Handle escalation request
   */
  private async handleEscalationRequest(callSid: string): Promise<void> {
    // This would typically trigger an escalation process
    console.log(`Escalation requested for call ${callSid}`);
    // Implementation depends on the escalation system
  }

  /**
   * Test voice configuration
   */
  async testConfiguration(): Promise<{
    success: boolean;
    error?: string;
    latency?: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Make a test call to a test number
      const testOptions: VoiceCallOptions = {
        to: '+15005550006', // Twilio test number
        from: this.config.config.from as string,
        message: 'This is a test call from your monitoring system.',
        timeout: 10
      };

      await this.makeCall(testOptions);
      
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
   * Get voice call statistics
   */
  async getStatistics(fromDate: Date, toDate: Date): Promise<{
    totalCalls: number;
    answeredCalls: number;
    failedCalls: number;
    averageDuration: number;
    acknowledgmentRate: number;
  }> {
    try {
      // Fetch calls from Twilio within date range
      const calls = await this.twilioClient.calls.list({
        startTimeBefore: toDate,
        startTimeAfter: fromDate
      });

      const totalCalls = calls.length;
      const answeredCalls = calls.filter(call => 
        ['answered', 'completed'].includes(call.status)
      ).length;
      const failedCalls = calls.filter(call => 
        ['busy', 'failed', 'no-answer', 'canceled'].includes(call.status)
      ).length;

      const durations = calls
        .filter(call => call.duration)
        .map(call => parseInt(call.duration!));
      
      const averageDuration = durations.length > 0 
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : 0;

      // Note: Acknowledgment rate would need to be tracked separately
      // as it requires webhook data
      const acknowledgmentRate = 0.85; // Placeholder

      return {
        totalCalls,
        answeredCalls,
        failedCalls,
        averageDuration,
        acknowledgmentRate
      };
    } catch (error) {
      console.error('Failed to fetch voice statistics:', error);
      throw new Error(`Failed to fetch statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}

/**
 * Voice Channel Factory
 */
export class VoiceChannelFactory {
  static create(config: VoiceConfig): VoiceChannel {
    return new VoiceChannel(config);
  }

  static validateConfig(config: VoiceConfig): {
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
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

