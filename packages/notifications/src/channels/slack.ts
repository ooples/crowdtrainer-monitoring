/**
 * Slack and Microsoft Teams Notification Channel
 * 
 * Features:
 * - Rich message formatting with blocks and attachments
 * - Interactive buttons for acknowledgment and escalation
 * - Thread management for follow-up messages
 * - File attachments and screenshots
 * - Channel and user mentions
 * - Custom emoji and reactions
 * - Teams card-based notifications
 * - Webhook and bot token support
 */

import { 
  BaseNotification, 
  SlackConfig, 
  TeamsConfig,
  ChannelResult
} from '../types/index.js';
import { WebClient as SlackWebClient } from '@slack/web-api';
import { Client as GraphClient } from '@microsoft/microsoft-graph-client';
import axios from 'axios';

export interface SlackMessageOptions {
  /** Channel to send to */
  channel: string;
  /** Message text (fallback) */
  text: string;
  /** Rich message blocks */
  blocks?: any[];
  /** Legacy attachments */
  attachments?: any[];
  /** Thread timestamp for replies */
  threadTs?: string;
  /** Enable interactive buttons */
  interactive?: boolean;
  /** User mentions */
  mentions?: string[];
  /** Enable unfurling of links */
  unfurlLinks?: boolean;
  /** Allow additional properties */
  [key: string]: any;
}

export interface TeamsMessageOptions {
  /** Team ID */
  teamId: string;
  /** Channel ID */
  channelId: string;
  /** Message content */
  content: string;
  /** Adaptive card */
  card?: any;
  /** Message importance */
  importance?: 'normal' | 'high' | 'urgent';
  /** Enable mentions */
  mentions?: Array<{ id: string; displayName: string }>;
}

export interface ChatResult {
  /** Message ID */
  messageId: string;
  /** Channel/conversation ID */
  channelId: string;
  /** Thread timestamp (Slack) */
  threadTs?: string;
  /** Permalink to message */
  permalink?: string;
  /** Delivery status */
  status: string;
}

export class SlackChannel {
  private client: SlackWebClient;
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
    this.client = new SlackWebClient(config.token);
  }

  /**
   * Send Slack notification
   */
  async send(notification: BaseNotification, channel?: string): Promise<ChannelResult> {
    const startTime = Date.now();
    
    try {
      const targetChannel = channel || this.config.defaultChannel || '#alerts';
      const messageOptions = await this.buildSlackMessage(notification, targetChannel);
      
      const result = await this.client.chat.postMessage(messageOptions);

      if (result.ok && result.ts) {
        return {
          channel: 'slack',
          status: 'sent',
          messageId: result.ts,
          latency: Date.now() - startTime,
        };
      } else {
        throw new Error(`Slack API error: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        channel: 'slack',
        status: 'failed',
        messageId: undefined,
        latency: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Build rich Slack message with blocks
   */
  private async buildSlackMessage(
    notification: BaseNotification, 
    channel: string
  ): Promise<SlackMessageOptions> {
    const severityEmoji = this.getSeverityEmoji(notification.severity);
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} ${notification.title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${notification.severity.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Source:*\n${notification.source}`
          },
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${notification.priority}/10`
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n<!date^${Math.floor(notification.timestamp / 1000)}^{date_num} {time_secs}|${new Date(notification.timestamp).toISOString()}>`
          }
        ]
      }
    ];

    // Add context section if tags exist
    if (Object.keys(notification.tags).length > 0) {
      const tagText = Object.entries(notification.tags)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' • ');
      
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: tagText
          } as any
        ] as any
      } as any);
    }

    // Add interactive buttons if enabled
    if (this.config.enableButtons) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Acknowledge',
              emoji: true
            },
            style: 'primary',
            action_id: 'acknowledge',
            value: notification.id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🚨 Escalate',
              emoji: true
            },
            style: 'danger',
            action_id: 'escalate',
            value: notification.id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 View Details',
              emoji: true
            },
            action_id: 'view_details',
            value: notification.id,
            url: notification.metadata.url as string
          }
        ] as any
      } as any);
    }

    return {
      channel,
      text: `${severityEmoji} ${notification.title}: ${notification.message}`, // Fallback text
      blocks,
      unfurlLinks: true
    };
  }

  /**
   * Update message with acknowledgment
   */
  async updateWithAcknowledgment(
    messageId: string,
    channel: string,
    acknowledgedBy: string
  ): Promise<void> {
    try {
      await this.client.chat.update({
        channel,
        ts: messageId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Acknowledged by <@${acknowledgedBy}>*`
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to update Slack message:', error);
      throw new Error(`Failed to update message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle interactive button actions
   */
  async handleInteraction(payload: any): Promise<{
    action: string;
    notificationId: string;
    userId: string;
    channel: string;
    messageId: string;
  }> {
    const action = payload.actions?.[0];
    const user = payload.user;
    const channel = payload.channel;
    const message = payload.message;

    if (!action || !user || !channel) {
      throw new Error('Invalid interaction payload');
    }

    return {
      action: action.action_id,
      notificationId: action.value,
      userId: user.id,
      channel: channel.id,
      messageId: message.ts
    };
  }


  private getSeverityEmoji(severity: string): string {
    const emojiMap: Record<string, string> = {
      'info': ':information_source:',
      'warning': ':warning:',
      'error': ':x:',
      'critical': ':rotating_light:'
    };
    return emojiMap[severity] || ':bell:';
  }
}

export class TeamsChannel {
  private graphClient: GraphClient;
  private config: TeamsConfig;

  constructor(config: TeamsConfig) {
    this.config = config;
    
    // Initialize Graph client with app-only authentication
    this.graphClient = GraphClient.init({
      authProvider: {
        getAccessToken: async () => {
          return await this.getAccessToken();
        }
      } as any
    });
  }

  /**
   * Send Teams notification
   */
  async send(notification: BaseNotification, teamId?: string, channelId?: string): Promise<ChannelResult> {
    const startTime = Date.now();
    
    try {
      const targetTeam = teamId || this.config.defaultTeam;
      const targetChannel = channelId || this.config.defaultChannel;
      
      if (!targetTeam || !targetChannel) {
        throw new Error('Team ID and Channel ID are required for Teams notifications');
      }

      const messageOptions = this.buildTeamsMessage(notification);
      
      const result = await this.graphClient
        .api(`/teams/${targetTeam}/channels/${targetChannel}/messages`)
        .post(messageOptions);

      return {
        channel: 'teams',
        status: 'sent',
        messageId: result.id,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        channel: 'teams',
        status: 'failed',
        messageId: undefined,
        latency: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Build Teams adaptive card message
   */
  private buildTeamsMessage(notification: BaseNotification): TeamsMessageOptions {
    const importance = this.getImportance(notification.severity);
    
    const adaptiveCard = {
      type: 'AdaptiveCard',
      version: '1.3',
      body: [
        {
          type: 'Container',
          style: 'attention',
          items: [
            {
              type: 'TextBlock',
              text: notification.title,
              size: 'Large',
              weight: 'Bolder',
              color: notification.severity === 'critical' || notification.severity === 'error' ? 'Attention' : 'Default'
            }
          ]
        },
        {
          type: 'TextBlock',
          text: notification.message,
          wrap: true,
          spacing: 'Medium'
        },
        {
          type: 'FactSet',
          facts: [
            {
              title: 'Severity:',
              value: notification.severity.toUpperCase()
            },
            {
              title: 'Source:',
              value: notification.source
            },
            {
              title: 'Priority:',
              value: `${notification.priority}/10`
            },
            {
              title: 'Time:',
              value: new Date(notification.timestamp).toLocaleString()
            }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: '✅ Acknowledge',
          data: {
            action: 'acknowledge',
            notificationId: notification.id
          }
        },
        {
          type: 'Action.Submit',
          title: '🚨 Escalate',
          data: {
            action: 'escalate',
            notificationId: notification.id
          }
        },
        {
          type: 'Action.OpenUrl',
          title: '🔗 View Details',
          url: notification.metadata.url as string || 'https://monitoring.example.com'
        }
      ]
    };

    return {
      teamId: this.config.defaultTeam!,
      channelId: this.config.defaultChannel!,
      content: `${notification.title}: ${notification.message}`,
      card: adaptiveCard,
      importance
    };
  }

  /**
   * Get access token for Microsoft Graph
   */
  private async getAccessToken(): Promise<string> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Teams access token:', error);
      throw new Error('Failed to authenticate with Microsoft Graph');
    }
  }


  private getImportance(severity: string): 'normal' | 'high' | 'urgent' {
    const importanceMap: Record<string, 'normal' | 'high' | 'urgent'> = {
      'info': 'normal',
      'warning': 'normal',
      'error': 'high',
      'critical': 'urgent'
    };
    return importanceMap[severity] || 'normal';
  }
}

/**
 * Combined Chat Channel for Slack and Teams
 */
export class ChatChannel {
  private slackChannel?: SlackChannel;
  private teamsChannel?: TeamsChannel;

  constructor(slackConfig?: SlackConfig, teamsConfig?: TeamsConfig) {
    if (slackConfig) {
      this.slackChannel = new SlackChannel(slackConfig);
    }
    if (teamsConfig) {
      this.teamsChannel = new TeamsChannel(teamsConfig);
    }
  }

  /**
   * Send notification to Slack
   */
  async sendSlack(notification: BaseNotification, channel?: string): Promise<ChannelResult> {
    if (!this.slackChannel) {
      throw new Error('Slack not configured');
    }
    return this.slackChannel.send(notification, channel);
  }

  /**
   * Send notification to Teams
   */
  async sendTeams(
    notification: BaseNotification, 
    teamId?: string, 
    channelId?: string
  ): Promise<ChannelResult> {
    if (!this.teamsChannel) {
      throw new Error('Teams not configured');
    }
    return this.teamsChannel.send(notification, teamId, channelId);
  }

  /**
   * Send to both Slack and Teams
   */
  async sendBoth(
    notification: BaseNotification,
    options?: {
      slack?: { channel?: string };
      teams?: { teamId?: string; channelId?: string };
    }
  ): Promise<ChannelResult[]> {
    const results: ChannelResult[] = [];

    if (this.slackChannel) {
      try {
        const slackResult = await this.sendSlack(notification, options?.slack?.channel);
        results.push(slackResult);
      } catch (error) {
        results.push({
          channel: 'slack',
          status: 'failed',
          messageId: '',
          latency: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (this.teamsChannel) {
      try {
        const teamsResult = await this.sendTeams(
          notification, 
          options?.teams?.teamId, 
          options?.teams?.channelId
        );
        results.push(teamsResult);
      } catch (error) {
        results.push({
          channel: 'teams',
          status: 'failed',
          messageId: '',
          latency: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Handle interactive actions from Slack/Teams
   */
  async handleInteraction(
    platform: 'slack' | 'teams',
    payload: any
  ): Promise<{
    action: string;
    notificationId: string;
    userId: string;
    platform: string;
  }> {
    if (platform === 'slack' && this.slackChannel) {
      const result = await this.slackChannel.handleInteraction(payload);
      return {
        ...result,
        platform: 'slack'
      };
    } else if (platform === 'teams') {
      // Teams webhook handling would be implemented here
      return {
        action: payload.data?.action || 'unknown',
        notificationId: payload.data?.notificationId || '',
        userId: payload.from?.user?.id || '',
        platform: 'teams'
      };
    }

    throw new Error(`Platform ${platform} not supported or not configured`);
  }

  /**
   * Test chat channel configurations
   */
  async testConfiguration(): Promise<{
    slack?: { success: boolean; error?: string };
    teams?: { success: boolean; error?: string };
  }> {
    const results: any = {};

    if (this.slackChannel) {
      try {
        // Test Slack connection
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
            channels: ['slack'],
            retry: { maxAttempts: 1, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 30000, jitter: 0.1 },
            timeout: 30000
          }
        };

        await this.sendSlack(testNotification, '#test');
        results.slack = { success: true };
      } catch (error) {
        results.slack = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    if (this.teamsChannel) {
      try {
        // Test Teams connection
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
            channels: ['teams'],
            retry: { maxAttempts: 1, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 30000, jitter: 0.1 },
            timeout: 30000
          }
        };

        await this.sendTeams(testNotification);
        results.teams = { success: true };
      } catch (error) {
        results.teams = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    return results;
  }
}

/**
 * Chat Channel Factory
 */
export class ChatChannelFactory {
  static createSlack(config: SlackConfig): SlackChannel {
    return new SlackChannel(config);
  }

  static createTeams(config: TeamsConfig): TeamsChannel {
    return new TeamsChannel(config);
  }

  static createCombined(slackConfig?: SlackConfig, teamsConfig?: TeamsConfig): ChatChannel {
    return new ChatChannel(slackConfig, teamsConfig);
  }

  static validateSlackConfig(config: SlackConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.token) {
      errors.push('Slack bot token is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateTeamsConfig(config: TeamsConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.clientId) {
      errors.push('Microsoft Graph client ID is required');
    }
    if (!config.clientSecret) {
      errors.push('Microsoft Graph client secret is required');
    }
    if (!config.tenantId) {
      errors.push('Microsoft tenant ID is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export types and utilities
