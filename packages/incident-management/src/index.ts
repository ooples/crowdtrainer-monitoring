// Main entry point for the Incident Management System
export * from './types';

// Detection
export { AutomaticIncidentDetection } from './detection/auto';
export type { DetectionRule, AlertCorrelation } from './detection/auto';

// War Room
export { WarRoomCollaboration, WarRoomServer } from './warroom/collaboration';

// Post-Mortem
export { PostMortemGenerator } from './postmortem/generator';
export type { PostMortemTemplate, PostMortemAnalysis } from './postmortem/generator';

// Runbooks
export { RunbookIntegration } from './runbooks/integration';
export type { 
  RunbookExecution, 
  RunbookStepExecution, 
  RunbookMatch, 
  AutomationProvider 
} from './runbooks/integration';

// Status Page
export { StatusPage, StatusPageAPI } from './status/page';

// Timeline
export { default as TimelineReconstructionEngine } from './timeline/reconstruction';
export type { 
  TimelineReconstruction, 
  EnrichedTimelineEvent, 
  IncidentPhase, 
  TimelineMetrics, 
  TimelineGap, 
  TimelineInsight 
} from './timeline/reconstruction';

// MTTR
export { default as MTTRTracker } from './metrics/mttr';
export type { 
  MTTRAnalysis, 
  MTTRBenchmarks, 
  OptimizationSuggestions, 
  MTTRTrends, 
  MTTRBreakdown, 
  MTTRTargets 
} from './metrics/mttr';

// Main Incident Management System class
import { Logger } from 'winston';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

import { AutomaticIncidentDetection } from './detection/auto';
import { PostMortemGenerator } from './postmortem/generator';
import { RunbookIntegration } from './runbooks/integration';
import { StatusPageAPI } from './status/page';
import TimelineReconstructionEngine from './timeline/reconstruction';
import MTTRTracker from './metrics/mttr';
import { WarRoomServer } from './warroom/collaboration';

import type { IncidentManagementConfig, Incident, Alert } from './types';

export interface IncidentManagementSystemOptions {
  config: IncidentManagementConfig;
  redis: Redis;
  logger: Logger;
  socketIO?: any; // Socket.IO server instance
}

/**
 * Main Incident Management System
 * Orchestrates all incident management components
 */
export class IncidentManagementSystem extends EventEmitter {
  private config: IncidentManagementConfig;
  private redis: Redis;
  private logger: Logger;
  private socketIO?: any;

  // Components
  private detection: AutomaticIncidentDetection;
  private postMortem: PostMortemGenerator;
  private runbooks: RunbookIntegration;
  private statusPage: StatusPageAPI;
  private timeline: TimelineReconstructionEngine;
  private mttr: MTTRTracker;
  private warRoom?: WarRoomServer;

  private isInitialized = false;

  constructor(options: IncidentManagementSystemOptions) {
    super();
    
    this.config = options.config;
    this.redis = options.redis;
    this.logger = options.logger;
    this.socketIO = options.socketIO;

    // Initialize components
    this.detection = new AutomaticIncidentDetection(this.config, this.redis, this.logger);
    this.postMortem = new PostMortemGenerator(this.config, this.redis, this.logger);
    this.runbooks = new RunbookIntegration(this.config, this.redis, this.logger);
    this.statusPage = new StatusPageAPI(this.redis, this.config);
    this.timeline = new TimelineReconstructionEngine(this.config, this.redis, this.logger);
    this.mttr = new MTTRTracker(this.config, this.redis, this.logger);

    if (this.socketIO) {
      this.warRoom = new WarRoomServer(this.socketIO, this.redis);
    }

    this.setupEventHandlers();
  }

  /**
   * Initialize the incident management system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Incident management system already initialized');
      return;
    }

    this.logger.info('Initializing incident management system...');

    try {
      // Initialize components
      await this.detection.start();
      await this.runbooks.initialize();
      await this.mttr.startRealtimeMonitoring();

      this.isInitialized = true;
      this.emit('initialized');
      
      this.logger.info('Incident management system initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize incident management system:', error);
      throw error;
    }
  }

  /**
   * Shutdown the incident management system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Shutting down incident management system...');

    try {
      await this.detection.stop();
      
      this.isInitialized = false;
      this.emit('shutdown');
      
      this.logger.info('Incident management system shut down successfully');
      
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  /**
   * Get detection component
   */
  getDetection(): AutomaticIncidentDetection {
    return this.detection;
  }

  /**
   * Get post-mortem generator
   */
  getPostMortem(): PostMortemGenerator {
    return this.postMortem;
  }

  /**
   * Get runbook integration
   */
  getRunbooks(): RunbookIntegration {
    return this.runbooks;
  }

  /**
   * Get status page API
   */
  getStatusPage(): StatusPageAPI {
    return this.statusPage;
  }

  /**
   * Get timeline reconstruction engine
   */
  getTimeline(): TimelineReconstructionEngine {
    return this.timeline;
  }

  /**
   * Get MTTR tracker
   */
  getMTTR(): MTTRTracker {
    return this.mttr;
  }

  /**
   * Process incoming alert (main entry point)
   */
  async processAlert(alert: Alert): Promise<void> {
    this.logger.info(`Processing alert: ${alert.id}`);
    
    try {
      await this.detection.processAlert(alert);
      this.emit('alert_processed', alert);
      
    } catch (error) {
      this.logger.error(`Error processing alert ${alert.id}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create incident manually
   */
  async createIncident(incident: Incident): Promise<void> {
    this.logger.info(`Creating incident manually: ${incident.id}`);
    
    try {
      // Store incident
      await this.redis.hset('incidents', incident.id, JSON.stringify(incident));
      
      // Create initial timeline event
      const timelineEvent = {
        id: require('uuid').v4(),
        incidentId: incident.id,
        type: 'status_change',
        title: 'Incident Created',
        description: 'Incident created manually',
        timestamp: new Date(),
        userId: incident.assignedUser,
      };
      
      await this.redis.lpush(`timeline:${incident.id}`, JSON.stringify(timelineEvent));
      
      this.emit('incident_created', incident);
      
    } catch (error) {
      this.logger.error(`Error creating incident ${incident.id}:`, error);
      throw error;
    }
  }

  /**
   * Update incident status
   */
  async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident> {
    this.logger.info(`Updating incident: ${incidentId}`);
    
    try {
      // Get existing incident
      const existingData = await this.redis.hget('incidents', incidentId);
      if (!existingData) {
        throw new Error(`Incident not found: ${incidentId}`);
      }
      
      const existing = JSON.parse(existingData) as Incident;
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      
      // Store updated incident
      await this.redis.hset('incidents', incidentId, JSON.stringify(updated));
      
      // Create timeline event for status change
      if (updates.status && updates.status !== existing.status) {
        const timelineEvent = {
          id: require('uuid').v4(),
          incidentId,
          type: 'status_change',
          title: 'Status Updated',
          description: `Status changed from ${existing.status} to ${updates.status}`,
          timestamp: new Date(),
          userId: updates.assignedUser || existing.assignedUser,
        };
        
        await this.redis.lpush(`timeline:${incidentId}`, JSON.stringify(timelineEvent));
      }
      
      // If resolved, calculate MTTR
      if (updates.status === 'resolved' && !existing.resolvedAt) {
        updated.resolvedAt = new Date();
        await this.redis.hset('incidents', incidentId, JSON.stringify(updated));
        
        // Calculate MTTR metrics
        await this.mttr.trackIncidentMTTR(updated);
      }
      
      this.emit('incident_updated', updated);
      
      return updated;
      
    } catch (error) {
      this.logger.error(`Error updating incident ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Generate comprehensive incident report
   */
  async generateIncidentReport(incidentId: string): Promise<IncidentReport> {
    this.logger.info(`Generating comprehensive report for incident: ${incidentId}`);
    
    try {
      // Get incident
      const incidentData = await this.redis.hget('incidents', incidentId);
      if (!incidentData) {
        throw new Error(`Incident not found: ${incidentId}`);
      }
      
      const incident = JSON.parse(incidentData) as Incident;
      
      // Generate all components
      const [
        postMortem,
        timelineReconstruction,
        mttrAnalysis,
        runbookExecutions,
      ] = await Promise.all([
        this.postMortem.generatePostMortem(incident),
        this.timeline.reconstructTimeline(incidentId),
        this.mttr.analyzeMTTR(incidentId),
        this.runbooks.getExecutionHistory(incidentId),
      ]);

      const report: IncidentReport = {
        incident,
        postMortem,
        timeline: timelineReconstruction,
        mttr: mttrAnalysis,
        runbookExecutions,
        generatedAt: new Date(),
      };

      // Store report
      await this.redis.hset('incident_reports', incidentId, JSON.stringify(report));
      
      this.logger.info(`Comprehensive report generated for incident: ${incidentId}`);
      
      return report;
      
    } catch (error) {
      this.logger.error(`Error generating report for incident ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Get system health and metrics
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      components: {
        detection: await this.checkComponentHealth('detection'),
        runbooks: await this.checkComponentHealth('runbooks'),
        statusPage: await this.checkComponentHealth('statusPage'),
        timeline: await this.checkComponentHealth('timeline'),
        mttr: await this.checkComponentHealth('mttr'),
      },
      metrics: {
        activeIncidents: await this.getActiveIncidentCount(),
        alertsProcessedToday: await this.getAlertsProcessedToday(),
        averageMTTR: await this.getAverageMTTR(),
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Setup event handlers between components
   */
  private setupEventHandlers(): void {
    // Detection -> Runbooks
    this.detection.on('incident_created', async (incident: Incident) => {
      this.logger.info(`Auto-created incident: ${incident.id}`);
      
      // Find and suggest matching runbooks
      try {
        const alert = { /* would be the triggering alert */ } as Alert;
        const matches = await this.runbooks.findMatchingRunbooks(alert, incident);
        
        if (matches.length > 0) {
          this.emit('runbook_suggestions', { incident, matches });
        }
      } catch (error) {
        this.logger.error('Error finding runbook matches:', error);
      }
    });

    // MTTR -> Alerts
    this.mttr.on('mttr_exceeded', (alert: any) => {
      this.logger.warn(`MTTR target exceeded: ${JSON.stringify(alert)}`);
      this.emit('mttr_alert', alert);
    });

    // Forward all component events
    this.detection.on('error', (error) => this.emit('detection_error', error));
    this.runbooks.on('error', (error) => this.emit('runbooks_error', error));
  }

  /**
   * Check component health
   */
  private async checkComponentHealth(component: string): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      // Simple health check - ping Redis
      await this.redis.ping();
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  /**
   * Get active incident count
   */
  private async getActiveIncidentCount(): Promise<number> {
    try {
      const incidents = await this.redis.hgetall('incidents');
      let count = 0;
      
      for (const data of Object.values(incidents)) {
        const incident = JSON.parse(data) as Incident;
        if (incident.status !== 'resolved') {
          count++;
        }
      }
      
      return count;
    } catch (error) {
      this.logger.error('Error getting active incident count:', error);
      return 0;
    }
  }

  /**
   * Get alerts processed today
   */
  private async getAlertsProcessedToday(): Promise<number> {
    // This would query metrics collected by the detection system
    return 0; // Placeholder
  }

  /**
   * Get average MTTR
   */
  private async getAverageMTTR(): Promise<number> {
    // This would be calculated by the MTTR tracker
    return 0; // Placeholder
  }
}

// Supporting interfaces
export interface IncidentReport {
  incident: Incident;
  postMortem: any; // PostMortem type from generator
  timeline: any; // TimelineReconstruction type
  mttr: any; // MTTRAnalysis type
  runbookExecutions: any[];
  generatedAt: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  metrics: {
    activeIncidents: number;
    alertsProcessedToday: number;
    averageMTTR: number;
  };
  lastUpdated: Date;
}

// Default export
export default IncidentManagementSystem;