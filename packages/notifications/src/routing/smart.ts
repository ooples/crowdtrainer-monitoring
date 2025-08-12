/**
 * Smart Routing System for Notifications
 * 
 * Features:
 * - Severity-based routing
 * - Time-based routing with timezone support
 * - On-call schedule integration
 * - Escalation policies
 * - Rule-based routing engine
 */

import { 
  BaseNotification, 
  RoutingRule, 
  RoutingCondition, 
  RoutingAction, 
  OnCallSchedule, 
  NotificationRecipient, 
  NotificationChannel, 
  NotificationSeverity,
  EscalationPolicy,
  JSONValue
} from '../types/index.js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export interface SmartRoutingConfig {
  /** Default routing rules */
  rules: RoutingRule[];
  /** On-call schedules */
  schedules: OnCallSchedule[];
  /** Default channels for severity levels */
  severityChannels: Record<NotificationSeverity, NotificationChannel[]>;
  /** Business hours configuration */
  businessHours: {
    timezone: string;
    days: number[]; // 0-6, 0 = Sunday
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
  };
  /** Emergency contacts */
  emergencyContacts: NotificationRecipient[];
}

export class SmartRouter {
  private config: SmartRoutingConfig;
  private rules: Map<string, RoutingRule> = new Map();
  private schedules: Map<string, OnCallSchedule> = new Map();

  constructor(config: SmartRoutingConfig) {
    this.config = config;
    this.loadRules();
    this.loadSchedules();
  }

  /**
   * Route a notification based on smart rules
   */
  async route(notification: BaseNotification): Promise<BaseNotification> {
    // Create a copy to avoid mutating the original
    const routedNotification: BaseNotification = { ...notification };

    try {
      // Apply routing rules in priority order
      const applicableRules = this.findApplicableRules(notification);
      
      for (const rule of applicableRules) {
        this.applyRule(routedNotification, rule);
      }

      // Apply time-based routing
      await this.applyTimeBasedRouting(routedNotification);

      // Apply on-call schedule routing
      await this.applyOnCallRouting(routedNotification);

      // Apply severity-based routing
      this.applySeverityRouting(routedNotification);

      // Validate final routing
      this.validateRouting(routedNotification);

      return routedNotification;
    } catch (error) {
      console.error('Routing failed:', error);
      // Fallback to emergency routing
      return this.applyEmergencyRouting(notification);
    }
  }

  /**
   * Route multiple notifications in batch
   */
  async routeBulk(notifications: BaseNotification[]): Promise<BaseNotification[]> {
    return Promise.all(notifications.map(notification => this.route(notification)));
  }

  /**
   * Add or update a routing rule
   */
  addRule(rule: RoutingRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a routing rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Add or update an on-call schedule
   */
  addSchedule(schedule: OnCallSchedule): void {
    this.schedules.set(schedule.id, schedule);
  }

  /**
   * Remove an on-call schedule
   */
  removeSchedule(scheduleId: string): void {
    this.schedules.delete(scheduleId);
  }

  /**
   * Get current on-call person for a schedule
   */
  getCurrentOnCall(scheduleId: string): NotificationRecipient | null {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return null;

    const now = Date.now();
    const currentEntry = schedule.entries.find(entry => 
      entry.startTime <= now && entry.endTime >= now
    );

    if (!currentEntry) return null;

    // Find recipient details
    return {
      type: 'user',
      id: currentEntry.userId,
      name: `On-call user ${currentEntry.userId}`,
      channels: currentEntry.contactOverride?.channels || [],
      timezone: schedule.timezone,
      scheduleId
    };
  }

  /**
   * Check if notification should be escalated
   */
  shouldEscalate(notification: BaseNotification, attemptCount: number): boolean {
    // Escalate critical alerts after 2 failed attempts
    if (notification.severity === 'critical' && attemptCount >= 2) {
      return true;
    }

    // Escalate error alerts after 5 failed attempts
    if (notification.severity === 'error' && attemptCount >= 5) {
      return true;
    }

    // Check for custom escalation rules
    return this.hasEscalationRule(notification, attemptCount);
  }

  /**
   * Get escalation recipients
   */
  getEscalationRecipients(notification: BaseNotification): NotificationRecipient[] {
    // Start with emergency contacts
    const recipients = [...this.config.emergencyContacts];

    // Add recipients from escalation policies
    const escalationPolicy = this.getEscalationPolicy(notification);
    if (escalationPolicy) {
      const currentStep = escalationPolicy.steps[0]; // Use first escalation step
      recipients.push(...currentStep.recipients);
    }

    return recipients;
  }

  private loadRules(): void {
    this.config.rules.forEach(rule => {
      if (rule.enabled) {
        this.rules.set(rule.id, rule);
      }
    });
  }

  private loadSchedules(): void {
    this.config.schedules.forEach(schedule => {
      this.schedules.set(schedule.id, schedule);
    });
  }

  private findApplicableRules(notification: BaseNotification): RoutingRule[] {
    const applicableRules: RoutingRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const matches = rule.conditions.every(condition => 
        this.evaluateCondition(condition, notification)
      );

      if (matches) {
        applicableRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    return applicableRules.sort((a, b) => b.priority - a.priority);
  }

  private evaluateCondition(condition: RoutingCondition, notification: BaseNotification): boolean {
    const value = this.getFieldValue(condition.field, notification);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return typeof value === 'string' && typeof condition.value === 'string' &&
               value.includes(condition.value);
      case 'not_contains':
        return typeof value === 'string' && typeof condition.value === 'string' &&
               !value.includes(condition.value);
      case 'greater_than':
        return typeof value === 'number' && typeof condition.value === 'number' &&
               value > condition.value;
      case 'less_than':
        return typeof value === 'number' && typeof condition.value === 'number' &&
               value < condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return false;
    }
  }

  private getFieldValue(field: string, notification: BaseNotification): JSONValue {
    const parts = field.split('.');
    let value: any = notification;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as any)[part];
      } else {
        return null;
      }
    }

    return value;
  }

  private applyRule(notification: BaseNotification, rule: RoutingRule): void {
    rule.actions.forEach(action => {
      switch (action.type) {
        case 'route_to_channel':
          this.applyRouteToChannelAction(notification, action);
          break;
        case 'add_recipient':
          this.applyAddRecipientAction(notification, action);
          break;
        case 'set_priority':
          this.applySetPriorityAction(notification, action);
          break;
        case 'delay':
          this.applyDelayAction(notification, action);
          break;
        case 'suppress':
          this.applySuppressAction(notification, action);
          break;
        case 'escalate':
          this.applyEscalateAction(notification, action);
          break;
      }
    });
  }

  private applyRouteToChannelAction(notification: BaseNotification, action: RoutingAction): void {
    const channels = action.params.channels as NotificationChannel[];
    if (channels && channels.length > 0) {
      notification.delivery.channels = [...notification.delivery.channels, ...channels];
    }
  }

  private applyAddRecipientAction(notification: BaseNotification, action: RoutingAction): void {
    const recipient = action.params.recipient as NotificationRecipient;
    if (recipient) {
      notification.recipients.push(recipient);
    }
  }

  private applySetPriorityAction(notification: BaseNotification, action: RoutingAction): void {
    const priority = action.params.priority as number;
    if (typeof priority === 'number' && priority >= 1 && priority <= 10) {
      notification.priority = priority;
    }
  }

  private applyDelayAction(notification: BaseNotification, action: RoutingAction): void {
    const delay = action.params.delay as number;
    if (typeof delay === 'number' && delay > 0) {
      // Add delay to delivery config
      notification.delivery.timeout += delay;
    }
  }

  private applySuppressAction(notification: BaseNotification, action: RoutingAction): void {
    const condition = action.params.condition as string;
    if (condition) {
      // Mark notification as suppressed
      notification.metadata.suppressed = true;
      notification.metadata.suppressionReason = condition;
    }
  }

  private applyEscalateAction(notification: BaseNotification, _action: RoutingAction): void {
    const escalationRecipients = this.getEscalationRecipients(notification);
    notification.recipients.push(...escalationRecipients);
    
    // Enable escalation in delivery config
    if (!notification.delivery.escalation) {
      notification.delivery.escalation = {
        enabled: true,
        delay: 300000, // 5 minutes
        recipients: escalationRecipients,
        channels: ['voice', 'sms']
      };
    }
  }

  private async applyTimeBasedRouting(notification: BaseNotification): Promise<void> {
    const now = new Date();
    const businessHours = this.config.businessHours;
    
    // Convert current time to business timezone
    const businessTime = utcToZonedTime(now, businessHours.timezone);
    const currentDay = businessTime.getDay();
    const currentTime = format(businessTime, 'HH:mm');

    const isBusinessHours = businessHours.days.includes(currentDay) &&
                           this.isTimeInRange(currentTime, businessHours.startTime, businessHours.endTime);

    if (!isBusinessHours) {
      // Outside business hours - use more aggressive channels
      this.addOutOfHoursChannels(notification);
    }

    // Apply recipient-specific time rules
    notification.recipients.forEach(recipient => {
      recipient.channels = recipient.channels.filter(channel => {
        if (!channel.timeRules || channel.timeRules.length === 0) {
          return true; // No time rules, always allow
        }

        return channel.timeRules.some(rule => {
          const recipientTime = recipient.timezone ? 
            utcToZonedTime(now, recipient.timezone) : now;
          const recipientDay = recipientTime.getDay();
          const recipientTimeStr = format(recipientTime, 'HH:mm');

          return rule.daysOfWeek.includes(recipientDay) &&
                 this.isTimeInRange(recipientTimeStr, rule.startTime, rule.endTime);
        });
      });
    });
  }

  private async applyOnCallRouting(notification: BaseNotification): Promise<void> {
    // Check if any recipients reference on-call schedules
    for (const recipient of notification.recipients) {
      if (recipient.scheduleId) {
        const onCallPerson = this.getCurrentOnCall(recipient.scheduleId);
        if (onCallPerson) {
          // Replace with current on-call person
          Object.assign(recipient, onCallPerson);
        }
      }
    }
  }

  private applySeverityRouting(notification: BaseNotification): void {
    const severityChannels = this.config.severityChannels[notification.severity] || [];
    
    // Ensure severity-appropriate channels are included
    severityChannels.forEach(channel => {
      if (!notification.delivery.channels.includes(channel)) {
        notification.delivery.channels.push(channel);
      }
    });

    // For critical alerts, ensure voice and SMS are included
    if (notification.severity === 'critical') {
      ['voice', 'sms'].forEach(channel => {
        if (!notification.delivery.channels.includes(channel as NotificationChannel)) {
          notification.delivery.channels.push(channel as NotificationChannel);
        }
      });
    }
  }

  private validateRouting(notification: BaseNotification): void {
    // Ensure we have recipients
    if (notification.recipients.length === 0) {
      notification.recipients.push(...this.config.emergencyContacts);
    }

    // Ensure we have channels
    if (notification.delivery.channels.length === 0) {
      notification.delivery.channels = ['email']; // Fallback to email
    }

    // Remove duplicate channels
    notification.delivery.channels = [...new Set(notification.delivery.channels)];

    // Validate recipients have appropriate channels
    notification.recipients.forEach(recipient => {
      recipient.channels = recipient.channels.filter(channel => 
        notification.delivery.channels.includes(channel.channel) &&
        this.isSeverityAppropriate(channel, notification.severity)
      );
    });
  }

  private applyEmergencyRouting(notification: BaseNotification): BaseNotification {
    console.warn('Applying emergency routing fallback');
    
    return {
      ...notification,
      recipients: this.config.emergencyContacts,
      delivery: {
        ...notification.delivery,
        channels: ['email', 'sms', 'voice'],
        retry: {
          maxAttempts: 5,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 30000,
          jitter: 0.1
        }
      }
    };
  }

  private addOutOfHoursChannels(notification: BaseNotification): void {
    const outOfHoursChannels: NotificationChannel[] = ['sms', 'voice'];
    
    outOfHoursChannels.forEach(channel => {
      if (!notification.delivery.channels.includes(channel)) {
        notification.delivery.channels.push(channel);
      }
    });
  }

  private isTimeInRange(time: string, start: string, end: string): boolean {
    const [timeHour, timeMin] = time.split(':').map(Number);
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const timeMinutes = timeHour * 60 + timeMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes < startMinutes) {
      // Spans midnight
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    } else {
      return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    }
  }

  private isSeverityAppropriate(channel: { minSeverity: NotificationSeverity }, severity: NotificationSeverity): boolean {
    const severityLevels = { info: 0, warning: 1, error: 2, critical: 3 };
    return severityLevels[severity] >= severityLevels[channel.minSeverity];
  }

  private hasEscalationRule(_notification: BaseNotification, _attemptCount: number): boolean {
    // Check for custom escalation rules
    return this.rules.has('escalation') && attemptCount >= 3;
  }

  private getEscalationPolicy(_notification: BaseNotification): EscalationPolicy | null {
    // Get escalation policy based on notification properties
    const escalationRules = Array.from(this.rules.values())
      .filter(rule => rule.actions.some(action => action.type === 'escalate'));

    if (escalationRules.length > 0) {
      const escalationData = escalationRules[0].actions
        .find(action => action.type === 'escalate')?.params.policy as EscalationPolicy;
      return escalationData || null;
    }

    return null;
  }

  /**
   * Get routing statistics
   */
  getRoutingStatistics(): {
    totalRules: number;
    activeRules: number;
    totalSchedules: number;
    activeSchedules: number;
  } {
    const activeRules = Array.from(this.rules.values()).filter(rule => rule.enabled);
    
    return {
      totalRules: this.rules.size,
      activeRules: activeRules.length,
      totalSchedules: this.schedules.size,
      activeSchedules: Array.from(this.schedules.values()).length
    };
  }
}

// Utility functions for building routing rules
export class RoutingRuleBuilder {
  private rule: Partial<RoutingRule> = {
    conditions: [],
    actions: [],
    enabled: true,
    priority: 1
  };

  static create(name: string): RoutingRuleBuilder {
    const builder = new RoutingRuleBuilder();
    builder.rule.name = name;
    builder.rule.id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return builder;
  }

  description(description: string): RoutingRuleBuilder {
    this.rule.description = description;
    return this;
  }

  priority(priority: number): RoutingRuleBuilder {
    this.rule.priority = priority;
    return this;
  }

  when(field: string, operator: RoutingCondition['operator'], value: JSONValue): RoutingRuleBuilder {
    this.rule.conditions!.push({ field, operator, value });
    return this;
  }

  routeTo(...channels: NotificationChannel[]): RoutingRuleBuilder {
    this.rule.actions!.push({
      type: 'route_to_channel',
      params: { channels }
    });
    return this;
  }

  addRecipient(recipient: NotificationRecipient): RoutingRuleBuilder {
    this.rule.actions!.push({
      type: 'add_recipient',
      params: { recipient }
    });
    return this;
  }

  setPriority(priority: number): RoutingRuleBuilder {
    this.rule.actions!.push({
      type: 'set_priority',
      params: { priority }
    });
    return this;
  }

  delay(milliseconds: number): RoutingRuleBuilder {
    this.rule.actions!.push({
      type: 'delay',
      params: { delay: milliseconds }
    });
    return this;
  }

  suppress(condition: string): RoutingRuleBuilder {
    this.rule.actions!.push({
      type: 'suppress',
      params: { condition }
    });
    return this;
  }

  escalate(): RoutingRuleBuilder {
    this.rule.actions!.push({
      type: 'escalate',
      params: {}
    });
    return this;
  }

  build(): RoutingRule {
    if (!this.rule.name || !this.rule.id) {
      throw new Error('Rule name and ID are required');
    }

    return this.rule as RoutingRule;
  }
}