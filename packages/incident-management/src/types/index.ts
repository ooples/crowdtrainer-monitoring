import { z } from 'zod';

// Incident Status Enum
export enum IncidentStatus {
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  MONITORING = 'monitoring',
  RESOLVED = 'resolved',
}

// Incident Severity Enum
export enum IncidentSeverity {
  P1_CRITICAL = 'P1_CRITICAL', // Service completely down, affects all users
  P2_HIGH = 'P2_HIGH',         // Major feature degraded, affects most users
  P3_MEDIUM = 'P3_MEDIUM',     // Minor feature issue, affects some users
  P4_LOW = 'P4_LOW',           // Cosmetic issue, minimal user impact
}

// Alert Source Types
export enum AlertSource {
  MONITORING = 'monitoring',
  PAGERDUTY = 'pagerduty',
  OPSGENIE = 'opsgenie',
  DATADOG = 'datadog',
  SENTRY = 'sentry',
  MANUAL = 'manual',
}

// Component Status for Status Page
export enum ComponentStatus {
  OPERATIONAL = 'operational',
  DEGRADED_PERFORMANCE = 'degraded_performance',
  PARTIAL_OUTAGE = 'partial_outage',
  MAJOR_OUTAGE = 'major_outage',
}

// Zod Schemas for Validation
export const IncidentSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.nativeEnum(IncidentStatus),
  severity: z.nativeEnum(IncidentSeverity),
  source: z.nativeEnum(AlertSource),
  affectedComponents: z.array(z.string()),
  assignedTeam: z.string().optional(),
  assignedUser: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional(),
  acknowledgedAt: z.date().optional(),
  escalatedAt: z.date().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

export const AlertSchema = z.object({
  id: z.string(),
  source: z.nativeEnum(AlertSource),
  title: z.string(),
  description: z.string(),
  severity: z.nativeEnum(IncidentSeverity),
  timestamp: z.date(),
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({}),
  resolved: z.boolean().default(false),
});

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.nativeEnum(ComponentStatus),
  group: z.string().optional(),
  order: z.number().default(0),
});

// Types derived from schemas
export type Incident = z.infer<typeof IncidentSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Component = z.infer<typeof ComponentSchema>;

// War Room Types
export interface WarRoomParticipant {
  id: string;
  name: string;
  email: string;
  role: 'incident_commander' | 'responder' | 'observer';
  joinedAt: Date;
  lastActive: Date;
  avatar?: string;
}

export interface WarRoomMessage {
  id: string;
  incidentId: string;
  userId: string;
  content: string;
  type: 'message' | 'status_update' | 'system' | 'action';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface WarRoomState {
  id: string;
  incidentId: string;
  participants: WarRoomParticipant[];
  messages: WarRoomMessage[];
  videoCallUrl?: string;
  documentsShared: string[];
  activeActions: string[];
  createdAt: Date;
}

// Timeline Event Types
export interface TimelineEvent {
  id: string;
  incidentId: string;
  type: 'alert' | 'status_change' | 'assignment' | 'escalation' | 'comment' | 'resolution' | 'action';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

// Post-Mortem Types
export interface PostMortemSection {
  title: string;
  content: string;
  order: number;
}

export interface PostMortem {
  id: string;
  incidentId: string;
  title: string;
  summary: string;
  timeline: TimelineEvent[];
  rootCause: string;
  impact: {
    usersAffected: number;
    downtime: number; // in minutes
    revenueImpact?: number;
  };
  contributingFactors: string[];
  lessonsLearned: string[];
  actionItems: {
    id: string;
    description: string;
    assignee: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: Date;
    completed: boolean;
  }[];
  sections: PostMortemSection[];
  authors: string[];
  reviewers: string[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

// Runbook Types
export interface RunbookStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  expectedOutput?: string;
  order: number;
  automatable: boolean;
}

export interface Runbook {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  steps: RunbookStep[];
  triggers: {
    alertPatterns: string[];
    conditions: string[];
  };
  metadata: {
    estimatedTime: number; // in minutes
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
    lastTested: Date;
    successRate: number; // 0-1
  };
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

// MTTR Metrics Types
export interface MTTRMetrics {
  incidentId: string;
  timestamps: {
    detected: Date;
    acknowledged: Date;
    investigating: Date;
    identified: Date;
    resolved: Date;
  };
  durations: {
    detectionTime: number; // ms from incident start to detection
    acknowledgmentTime: number; // ms from detection to acknowledgment
    investigationTime: number; // ms from acknowledgment to identification
    resolutionTime: number; // ms from identification to resolution
    totalTime: number; // total MTTR
  };
  escalations: {
    count: number;
    levels: string[];
    timestamps: Date[];
  };
}

// Integration Types
export interface PagerDutyConfig {
  apiKey: string;
  serviceId: string;
  escalationPolicyId: string;
  webhookUrl: string;
}

export interface OpsGenieConfig {
  apiKey: string;
  teamId: string;
  escalationId: string;
  webhookUrl: string;
}

export interface IntegrationConfig {
  pagerDuty?: PagerDutyConfig;
  opsGenie?: OpsGenieConfig;
  slack?: {
    webhookUrl: string;
    channel: string;
    token: string;
  };
  email?: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    templates: Record<string, string>;
  };
}

// Configuration Types
export interface IncidentManagementConfig {
  detection: {
    thresholds: Record<string, number>;
    cooldownPeriod: number; // seconds
    autoEscalation: boolean;
    escalationTimeout: number; // seconds
  };
  warRoom: {
    maxParticipants: number;
    videoIntegration: 'zoom' | 'teams' | 'meet' | 'none';
    autoRecording: boolean;
    sessionTimeout: number; // seconds
  };
  statusPage: {
    publicUrl: string;
    components: Component[];
    maintenanceMode: boolean;
    customCSS?: string;
  };
  notifications: {
    channels: ('email' | 'slack' | 'sms' | 'webhook')[];
    escalationRules: {
      severity: IncidentSeverity;
      timeout: number; // seconds
      recipients: string[];
    }[];
  };
  integrations: IntegrationConfig;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    timestamp: Date;
  };
}

// Search and Filter Types
export interface IncidentFilters {
  status?: IncidentStatus[];
  severity?: IncidentSeverity[];
  assignedTeam?: string;
  assignedUser?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  components?: string[];
  tags?: string[];
  search?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Event Types for Real-time Updates
export interface IncidentEventPayload {
  type: 'incident_created' | 'incident_updated' | 'incident_resolved' | 'status_changed';
  incident: Incident;
  changes?: Partial<Incident>;
  userId?: string;
  timestamp: Date;
}

export interface WarRoomEventPayload {
  type: 'participant_joined' | 'participant_left' | 'message_sent' | 'action_triggered';
  warRoomId: string;
  incidentId: string;
  data: any;
  userId?: string;
  timestamp: Date;
}

// Error Types
export class IncidentManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'IncidentManagementError';
  }
}

export class ValidationError extends IncidentManagementError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends IncidentManagementError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends IncidentManagementError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;