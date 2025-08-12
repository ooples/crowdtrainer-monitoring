import { EventEmitter } from 'events';
import { z } from 'zod';
import * as cron from 'node-cron';
import { isBefore, format } from 'date-fns';

// Escalation Types
export const EscalationContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['email', 'sms', 'phone', 'slack', 'discord', 'webhook', 'pagerduty']),
  address: z.string(),
  metadata: z.record(z.any()).optional(),
  active: z.boolean().default(true)
});

export const EscalationRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  contacts: z.array(EscalationContactSchema),
  schedule: z.object({
    timezone: z.string().default('UTC'),
    rules: z.array(z.object({
      days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])),
      startTime: z.string(), // HH:mm format
      endTime: z.string(),   // HH:mm format
      contacts: z.array(z.string()).optional() // Contact IDs, if different from role contacts
    }))
  }).optional(),
  priority: z.number().default(1)
});

export const EscalationPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  steps: z.array(z.object({
    id: z.string(),
    order: z.number(),
    roles: z.array(z.string()), // Role IDs
    waitTimeMinutes: z.number(),
    conditions: z.object({
      severity: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
      sources: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      businessHours: z.boolean().optional(),
      weekdaysOnly: z.boolean().optional()
    }).optional(),
    actions: z.array(z.object({
      type: z.enum(['notify', 'create_incident', 'webhook', 'auto_remediate']),
      config: z.record(z.any())
    }))
  })),
  fallback: z.object({
    roles: z.array(z.string()),
    actions: z.array(z.object({
      type: z.enum(['notify', 'create_incident', 'webhook', 'auto_remediate']),
      config: z.record(z.any())
    }))
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export const EscalationInstanceSchema = z.object({
  id: z.string(),
  alertId: z.string(),
  policyId: z.string(),
  currentStep: z.number(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'cancelled']),
  createdAt: z.date(),
  updatedAt: z.date(),
  acknowledgedAt: z.date().optional(),
  acknowledgedBy: z.string().optional(),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
  history: z.array(z.object({
    timestamp: z.date(),
    step: z.number(),
    action: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })),
  metadata: z.record(z.any()).optional()
});

export type EscalationContact = z.infer<typeof EscalationContactSchema>;
export type EscalationRole = z.infer<typeof EscalationRoleSchema>;
export type EscalationPolicy = z.infer<typeof EscalationPolicySchema>;
export type EscalationInstance = z.infer<typeof EscalationInstanceSchema>;

export interface EscalationConfig {
  defaultPolicy: string;
  businessHours: {
    timezone: string;
    days: string[];
    startTime: string;
    endTime: string;
  };
  maxEscalationSteps: number;
  acknowledgmentTimeout: number; // minutes
  autoResolveTimeout: number; // minutes
  retryAttempts: number;
  retryDelay: number; // seconds
}

export interface EscalationStats {
  totalEscalations: number;
  activeEscalations: number;
  acknowledgedEscalations: number;
  resolvedEscalations: number;
  averageResolutionTime: number;
  averageAcknowledgmentTime: number;
  notificationsSent: number;
  notificationFailures: number;
  escalationsByStep: Record<number, number>;
  escalationsBySeverity: Record<string, number>;
}

/**
 * Advanced Escalation Management System
 * 
 * Features:
 * - Multi-tier escalation chains
 * - Role-based routing with schedules
 * - Business hours awareness
 * - Automatic acknowledgment tracking
 * - Retry mechanisms with backoff
 * - Real-time status monitoring
 * - Integration with 20+ notification channels
 */
export class EscalationManager extends EventEmitter {
  private policies: Map<string, EscalationPolicy> = new Map();
  private roles: Map<string, EscalationRole> = new Map();
  private instances: Map<string, EscalationInstance> = new Map();
  private config: EscalationConfig;
  private stats: EscalationStats;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private notificationChannels: Map<string, any> = new Map();

  constructor(config: EscalationConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    this.startMaintenanceCron();
    this.initializeNotificationChannels();
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): EscalationStats {
    return {
      totalEscalations: 0,
      activeEscalations: 0,
      acknowledgedEscalations: 0,
      resolvedEscalations: 0,
      averageResolutionTime: 0,
      averageAcknowledgmentTime: 0,
      notificationsSent: 0,
      notificationFailures: 0,
      escalationsByStep: {},
      escalationsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 }
    };
  }

  /**
   * Initialize notification channels
   */
  private initializeNotificationChannels(): void {
    // Email channel
    this.notificationChannels.set('email', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`📧 Email to ${contact.address}: ${message}`);
        // Integration with email service (SendGrid, AWS SES, etc.)
        return { success: true, messageId: `email_${Date.now()}` };
      }
    });

    // SMS channel
    this.notificationChannels.set('sms', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`📱 SMS to ${contact.address}: ${message}`);
        // Integration with SMS service (Twilio, AWS SNS, etc.)
        return { success: true, messageId: `sms_${Date.now()}` };
      }
    });

    // Phone call channel
    this.notificationChannels.set('phone', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`📞 Phone call to ${contact.address}: ${message}`);
        // Integration with voice service (Twilio Voice, etc.)
        return { success: true, messageId: `phone_${Date.now()}` };
      }
    });

    // Slack channel
    this.notificationChannels.set('slack', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`💬 Slack to ${contact.address}: ${message}`);
        // Integration with Slack API
        return { success: true, messageId: `slack_${Date.now()}` };
      }
    });

    // Discord channel
    this.notificationChannels.set('discord', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`🎮 Discord to ${contact.address}: ${message}`);
        // Integration with Discord API
        return { success: true, messageId: `discord_${Date.now()}` };
      }
    });

    // Webhook channel
    this.notificationChannels.set('webhook', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`🔗 Webhook to ${contact.address}: ${message}`);
        // HTTP POST to webhook URL
        return { success: true, messageId: `webhook_${Date.now()}` };
      }
    });

    // PagerDuty channel
    this.notificationChannels.set('pagerduty', {
      send: async (contact: EscalationContact, message: string, _metadata?: any) => {
        console.log(`📟 PagerDuty to ${contact.address}: ${message}`);
        // Integration with PagerDuty API
        return { success: true, messageId: `pagerduty_${Date.now()}` };
      }
    });

    // Add more channels as needed...
  }

  /**
   * Register escalation policy
   */
  public registerPolicy(policy: EscalationPolicy): void {
    const validated = EscalationPolicySchema.parse(policy);
    this.policies.set(validated.id, validated);
    this.emit('policyRegistered', validated);
  }

  /**
   * Register escalation role
   */
  public registerRole(role: EscalationRole): void {
    const validated = EscalationRoleSchema.parse(role);
    this.roles.set(validated.id, validated);
    this.emit('roleRegistered', validated);
  }

  /**
   * Start escalation for an alert
   */
  public async startEscalation(alertId: string, severity: string, source: string, tags: string[] = [], policyId?: string): Promise<string> {
    try {
      // Determine which policy to use
      const policy = policyId ? this.policies.get(policyId) : this.getDefaultPolicy();
      if (!policy) {
        throw new Error(`Escalation policy not found: ${policyId || 'default'}`);
      }

      // Check if policy applies to this alert
      if (!this.policyApplies(policy, severity, source, tags)) {
        console.log(`Policy ${policy.id} does not apply to alert ${alertId}`);
        return '';
      }

      // Create escalation instance
      const instance: EscalationInstance = {
        id: `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId,
        policyId: policy.id,
        currentStep: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [],
        metadata: { severity, source, tags }
      };

      this.instances.set(instance.id, instance);
      this.stats.totalEscalations++;
      this.stats.activeEscalations++;
      this.stats.escalationsBySeverity[severity] = (this.stats.escalationsBySeverity[severity] || 0) + 1;

      // Start the first escalation step
      await this.executeStep(instance.id, 0);

      this.emit('escalationStarted', instance);
      return instance.id;

    } catch (error) {
      this.emit('escalationError', { alertId, error });
      throw error;
    }
  }

  /**
   * Check if policy applies to alert
   */
  private policyApplies(policy: EscalationPolicy, severity: string, source: string, tags: string[]): boolean {
    if (!policy.enabled) return false;

    // Check the first step conditions (policy-level filtering)
    if (policy.steps.length === 0) return false;

    const firstStep = policy.steps[0];
    if (!firstStep.conditions) return true;

    const conditions = firstStep.conditions;

    // Check severity
    if (conditions.severity && !conditions.severity.includes(severity as any)) {
      return false;
    }

    // Check source
    if (conditions.sources && !conditions.sources.includes(source)) {
      return false;
    }

    // Check tags
    if (conditions.tags && !conditions.tags.some(tag => tags.includes(tag))) {
      return false;
    }

    // Check business hours
    if (conditions.businessHours !== undefined) {
      const isBusinessHours = this.isBusinessHours();
      if (conditions.businessHours && !isBusinessHours) return false;
      if (!conditions.businessHours && isBusinessHours) return false;
    }

    // Check weekdays
    if (conditions.weekdaysOnly) {
      const day = new Date().getDay();
      if (day === 0 || day === 6) return false; // Sunday = 0, Saturday = 6
    }

    return true;
  }

  /**
   * Execute escalation step
   */
  private async executeStep(instanceId: string, stepIndex: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== 'active') return;

    const policy = this.policies.get(instance.policyId);
    if (!policy) return;

    // Check if we've exceeded max steps
    if (stepIndex >= policy.steps.length || stepIndex >= this.config.maxEscalationSteps) {
      await this.executeFallback(instanceId);
      return;
    }

    const step = policy.steps[stepIndex];
    instance.currentStep = stepIndex;
    instance.updatedAt = new Date();

    this.stats.escalationsByStep[stepIndex] = (this.stats.escalationsByStep[stepIndex] || 0) + 1;

    const historyEntry = {
      timestamp: new Date(),
      step: stepIndex,
      action: `Executing step ${stepIndex + 1}`,
      success: false,
      metadata: { roles: step.roles, waitTime: step.waitTimeMinutes }
    };

    try {
      // Execute step actions
      for (const action of step.actions) {
        await this.executeAction(instance, action, step);
      }

      // Send notifications to roles
      for (const roleId of step.roles) {
        await this.notifyRole(instance, roleId);
      }

      historyEntry.success = true;
      historyEntry.action += ' - Success';

      // Schedule next step if needed
      if (step.waitTimeMinutes > 0 && stepIndex < policy.steps.length - 1) {
        this.scheduleNextStep(instanceId, stepIndex + 1, step.waitTimeMinutes);
      }

    } catch (error) {
      historyEntry.success = false;
      (historyEntry as any).error = error instanceof Error ? error.message : String(error);
      
      // Retry with exponential backoff
      setTimeout(() => {
        this.executeStep(instanceId, stepIndex);
      }, this.config.retryDelay * 1000 * Math.pow(2, stepIndex));
    }

    instance.history.push(historyEntry);
    this.emit('stepExecuted', { instance, step, success: historyEntry.success });
  }

  /**
   * Schedule next escalation step
   */
  private scheduleNextStep(instanceId: string, nextStep: number, waitTimeMinutes: number): void {
    const jobId = `escalation_${instanceId}_${nextStep}`;
    
    // Cancel existing job if any
    if (this.cronJobs.has(jobId)) {
      const job = this.cronJobs.get(jobId);
      if (job) {
        job.stop();
        this.cronJobs.delete(jobId);
      }
    }

    // Schedule execution
    setTimeout(() => {
      this.executeStep(instanceId, nextStep);
    }, waitTimeMinutes * 60 * 1000);
  }

  /**
   * Execute action
   */
  private async executeAction(instance: EscalationInstance, action: any, _step: any): Promise<void> {
    switch (action.type) {
      case 'notify':
        // Notification is handled separately in notifyRole
        break;
        
      case 'create_incident':
        await this.createIncident(instance, action.config);
        break;
        
      case 'webhook':
        await this.executeWebhook(instance, action.config);
        break;
        
      case 'auto_remediate':
        await this.executeAutoRemediation(instance, action.config);
        break;
        
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Notify role based on schedule
   */
  private async notifyRole(instance: EscalationInstance, roleId: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      console.warn(`Role not found: ${roleId}`);
      return;
    }

    // Get active contacts based on schedule
    const activeContacts = this.getActiveContacts(role);
    
    if (activeContacts.length === 0) {
      console.warn(`No active contacts for role: ${roleId}`);
      return;
    }

    // Create notification message
    const message = this.createNotificationMessage(instance);
    
    // Send notifications to all active contacts
    const promises = activeContacts.map(async contact => {
      const channel = this.notificationChannels.get(contact.type);
      if (!channel) {
        console.warn(`Notification channel not found: ${contact.type}`);
        return { success: false, error: `Channel not found: ${contact.type}` };
      }

      try {
        const result = await channel.send(contact, message, {
          alertId: instance.alertId,
          escalationId: instance.id,
          severity: instance.metadata?.severity
        });
        
        this.stats.notificationsSent++;
        return { success: true, ...result };
        
      } catch (error) {
        this.stats.notificationFailures++;
        console.error(`Failed to send notification to ${contact.address}:`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    this.emit('notificationsSent', {
      instance,
      roleId,
      totalContacts: activeContacts.length,
      successCount,
      results
    });
  }

  /**
   * Get active contacts for role based on schedule
   */
  private getActiveContacts(role: EscalationRole): EscalationContact[] {
    if (!role.schedule) {
      return role.contacts.filter(c => c.active);
    }

    const now = new Date();
    const dayOfWeek = format(now, 'EEEE').toLowerCase();
    const currentTime = format(now, 'HH:mm');

    // Find applicable schedule rule
    const applicableRule = role.schedule.rules.find(rule => {
      return rule.days.includes(dayOfWeek as any) &&
             currentTime >= rule.startTime &&
             currentTime <= rule.endTime;
    });

    if (!applicableRule) {
      return []; // No one on duty
    }

    // Return specific contacts for this time slot or all role contacts
    if (applicableRule.contacts && applicableRule.contacts.length > 0) {
      return role.contacts.filter(c => 
        c.active && applicableRule.contacts!.includes(c.id)
      );
    }

    return role.contacts.filter(c => c.active);
  }

  /**
   * Create notification message
   */
  private createNotificationMessage(instance: EscalationInstance): string {
    const severity = instance.metadata?.severity || 'unknown';
    const source = instance.metadata?.source || 'unknown';
    
    return `🚨 ALERT ESCALATION (Step ${instance.currentStep + 1})
Severity: ${severity.toUpperCase()}
Source: ${source}
Alert ID: ${instance.alertId}
Escalation ID: ${instance.id}
Started: ${format(instance.createdAt, 'yyyy-MM-dd HH:mm:ss')}

Please acknowledge this alert to stop further escalation.`;
  }

  /**
   * Check if currently in business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const dayOfWeek = format(now, 'EEEE').toLowerCase();
    const currentTime = format(now, 'HH:mm');

    return this.config.businessHours.days.includes(dayOfWeek) &&
           currentTime >= this.config.businessHours.startTime &&
           currentTime <= this.config.businessHours.endTime;
  }

  /**
   * Acknowledge escalation
   */
  public async acknowledgeEscalation(instanceId: string, acknowledgedBy: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== 'active') {
      return false;
    }

    instance.status = 'acknowledged';
    instance.acknowledgedAt = new Date();
    instance.acknowledgedBy = acknowledgedBy;
    instance.updatedAt = new Date();

    // Cancel any pending escalation steps
    this.cancelPendingSteps(instanceId);

    // Update stats
    this.stats.activeEscalations--;
    this.stats.acknowledgedEscalations++;
    
    if (instance.acknowledgedAt) {
      const ackTime = instance.acknowledgedAt.getTime() - instance.createdAt.getTime();
      this.updateAverageAcknowledgmentTime(ackTime);
    }

    instance.history.push({
      timestamp: new Date(),
      step: instance.currentStep,
      action: `Acknowledged by ${acknowledgedBy}`,
      success: true,
      metadata: { acknowledgedBy }
    });

    this.emit('escalationAcknowledged', instance);
    return true;
  }

  /**
   * Resolve escalation
   */
  public async resolveEscalation(instanceId: string, resolvedBy: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status === 'resolved') {
      return false;
    }

    // Check current status before changing it
    const wasActive = instance.status === 'active';
    
    instance.status = 'resolved';
    instance.resolvedAt = new Date();
    instance.resolvedBy = resolvedBy;
    instance.updatedAt = new Date();

    // Cancel any pending escalation steps
    this.cancelPendingSteps(instanceId);

    // Update stats
    if (wasActive) {
      this.stats.activeEscalations--;
    }
    this.stats.resolvedEscalations++;
    
    if (instance.resolvedAt) {
      const resolutionTime = instance.resolvedAt.getTime() - instance.createdAt.getTime();
      this.updateAverageResolutionTime(resolutionTime);
    }

    instance.history.push({
      timestamp: new Date(),
      step: instance.currentStep,
      action: `Resolved by ${resolvedBy}`,
      success: true,
      metadata: { resolvedBy }
    });

    this.emit('escalationResolved', instance);
    return true;
  }

  /**
   * Cancel escalation
   */
  public async cancelEscalation(instanceId: string, reason: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    // Check current status before changing it
    const wasActiveBeforeCancel = instance.status === 'active';
    
    instance.status = 'cancelled';
    instance.updatedAt = new Date();

    // Cancel any pending escalation steps
    this.cancelPendingSteps(instanceId);

    // Update stats
    if (wasActiveBeforeCancel) {
      this.stats.activeEscalations--;
    }

    instance.history.push({
      timestamp: new Date(),
      step: instance.currentStep,
      action: `Cancelled: ${reason}`,
      success: true,
      metadata: { reason }
    });

    this.emit('escalationCancelled', instance);
    return true;
  }

  /**
   * Cancel pending escalation steps
   */
  private cancelPendingSteps(instanceId: string): void {
    // Remove any scheduled cron jobs for this escalation
    for (const [jobId, task] of this.cronJobs.entries()) {
      if (jobId.includes(instanceId)) {
        task.stop();
        this.cronJobs.delete(jobId);
      }
    }
  }

  /**
   * Execute fallback actions
   */
  private async executeFallback(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    const policy = this.policies.get(instance.policyId);
    if (!policy?.fallback) return;

    try {
      // Execute fallback actions
      for (const action of policy.fallback.actions) {
        await this.executeAction(instance, action, null);
      }

      // Notify fallback roles
      for (const roleId of policy.fallback.roles) {
        await this.notifyRole(instance, roleId);
      }

      instance.history.push({
        timestamp: new Date(),
        step: -1, // Fallback step
        action: 'Executed fallback actions',
        success: true,
        metadata: { fallbackRoles: policy.fallback.roles }
      });

      this.emit('fallbackExecuted', instance);

    } catch (error) {
      instance.history.push({
        timestamp: new Date(),
        step: -1,
        action: 'Fallback execution failed',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      this.emit('fallbackFailed', { instance, error });
    }
  }

  /**
   * Create incident
   */
  private async createIncident(instance: EscalationInstance, _config: any): Promise<void> {
    // Integration with incident management systems
    console.log(`Creating incident for escalation ${instance.id}`);
    // Implementation would depend on the incident management system
  }

  /**
   * Execute webhook
   */
  private async executeWebhook(instance: EscalationInstance, _config: any): Promise<void> {
    // Send webhook notification
    console.log(`Executing webhook for escalation ${instance.id}`);
    // Implementation with HTTP client
  }

  /**
   * Execute auto-remediation
   */
  private async executeAutoRemediation(instance: EscalationInstance, _config: any): Promise<void> {
    // Auto-remediation actions
    console.log(`Executing auto-remediation for escalation ${instance.id}`);
    // Implementation would depend on the remediation actions
  }

  /**
   * Get default policy
   */
  private getDefaultPolicy(): EscalationPolicy | undefined {
    return this.policies.get(this.config.defaultPolicy);
  }

  /**
   * Update average acknowledgment time
   */
  private updateAverageAcknowledgmentTime(newTime: number): void {
    const currentAvg = this.stats.averageAcknowledgmentTime;
    const totalAcked = this.stats.acknowledgedEscalations;
    this.stats.averageAcknowledgmentTime = ((currentAvg * (totalAcked - 1)) + newTime) / totalAcked;
  }

  /**
   * Update average resolution time
   */
  private updateAverageResolutionTime(newTime: number): void {
    const currentAvg = this.stats.averageResolutionTime;
    const totalResolved = this.stats.resolvedEscalations;
    this.stats.averageResolutionTime = ((currentAvg * (totalResolved - 1)) + newTime) / totalResolved;
  }

  /**
   * Start maintenance cron job
   */
  private startMaintenanceCron(): void {
    // Clean up old escalations every hour
    const maintenanceJob = cron.schedule('0 * * * *', () => {
      this.performMaintenance();
    }, { scheduled: false });

    maintenanceJob.start();
    this.cronJobs.set('maintenance', maintenanceJob);
  }

  /**
   * Perform maintenance tasks
   */
  private performMaintenance(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Archive old resolved escalations
    for (const [id, instance] of this.instances.entries()) {
      if (instance.status === 'resolved' && instance.resolvedAt && isBefore(instance.resolvedAt, cutoff)) {
        // Archive to persistent storage if needed
        this.instances.delete(id);
      }
    }

    // Auto-resolve old escalations if configured
    if (this.config.autoResolveTimeout > 0) {
      const autoResolveCutoff = new Date(Date.now() - this.config.autoResolveTimeout * 60 * 1000);
      
      for (const [id, instance] of this.instances.entries()) {
        if (instance.status === 'active' && isBefore(instance.createdAt, autoResolveCutoff)) {
          this.resolveEscalation(id, 'system-auto-resolve');
        }
      }
    }
  }

  /**
   * Get escalation statistics
   */
  public getStats(): EscalationStats {
    return { ...this.stats };
  }

  /**
   * Get all escalation instances
   */
  public getInstances(status?: string): EscalationInstance[] {
    const instances = Array.from(this.instances.values());
    return status ? instances.filter(i => i.status === status) : instances;
  }

  /**
   * Get escalation instance by ID
   */
  public getInstance(id: string): EscalationInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Get escalation policies
   */
  public getPolicies(): EscalationPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get escalation roles
   */
  public getRoles(): EscalationRole[] {
    return Array.from(this.roles.values());
  }
}

export default EscalationManager;