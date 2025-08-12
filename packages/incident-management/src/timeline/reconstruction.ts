import { Logger } from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  Incident,
  TimelineEvent,
  Alert,
  WarRoomMessage,
  IncidentManagementConfig,
  MTTRMetrics,
} from '../types';

export interface TimelineReconstruction {
  incidentId: string;
  events: EnrichedTimelineEvent[];
  phases: IncidentPhase[];
  keyMetrics: TimelineMetrics;
  gaps: TimelineGap[];
  insights: TimelineInsight[];
  reconstructedAt: Date;
}

export interface EnrichedTimelineEvent extends TimelineEvent {
  phase: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  source: 'alert' | 'manual' | 'system' | 'warroom' | 'automation';
  confidence: number;
  correlatedEvents: string[];
  enrichmentData: Record<string, any>;
}

export interface IncidentPhase {
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  events: string[]; // event IDs
  description: string;
  keyActions: string[];
  bottlenecks: string[];
}

export interface TimelineMetrics {
  totalDuration: number; // milliseconds
  detectionTime: number; // time from incident start to detection
  acknowledgmentTime: number; // time from detection to acknowledgment
  diagnosisTime: number; // time from acknowledgment to root cause identification
  resolutionTime: number; // time from identification to resolution
  escalationCount: number;
  automatedActions: number;
  manualActions: number;
  communicationEvents: number;
}

export interface TimelineGap {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  type: 'communication' | 'action' | 'monitoring' | 'unknown';
  description: string;
  impact: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export interface TimelineInsight {
  type: 'efficiency' | 'communication' | 'automation' | 'process' | 'monitoring';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  actionable: boolean;
  recommendations: string[];
  evidence: {
    eventIds: string[];
    metrics: Record<string, number>;
  };
}

export class TimelineReconstructionEngine {
  private redis: Redis;
  private logger: Logger;
  private config: IncidentManagementConfig;
  
  constructor(
    config: IncidentManagementConfig,
    redis: Redis,
    logger: Logger
  ) {
    this.config = config;
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Reconstruct complete incident timeline with analysis
   */
  async reconstructTimeline(incidentId: string): Promise<TimelineReconstruction> {
    try {
      this.logger.info(`Starting timeline reconstruction for incident: ${incidentId}`);

      // Gather all data sources
      const incident = await this.getIncident(incidentId);
      if (!incident) {
        throw new Error(`Incident not found: ${incidentId}`);
      }

      const rawEvents = await this.gatherTimelineEvents(incidentId);
      const alerts = await this.getRelatedAlerts(incidentId);
      const warRoomMessages = await this.getWarRoomMessages(incidentId);
      const systemEvents = await this.getSystemEvents(incidentId);

      // Enrich and correlate events
      const enrichedEvents = await this.enrichEvents(
        rawEvents, 
        alerts, 
        warRoomMessages, 
        systemEvents, 
        incident
      );

      // Identify incident phases
      const phases = this.identifyPhases(enrichedEvents, incident);

      // Calculate metrics
      const keyMetrics = this.calculateTimelineMetrics(enrichedEvents, phases, incident);

      // Detect gaps in timeline
      const gaps = this.detectTimelineGaps(enrichedEvents, incident);

      // Generate insights
      const insights = await this.generateInsights(
        enrichedEvents, 
        phases, 
        keyMetrics, 
        gaps, 
        incident
      );

      const reconstruction: TimelineReconstruction = {
        incidentId,
        events: enrichedEvents,
        phases,
        keyMetrics,
        gaps,
        insights,
        reconstructedAt: new Date(),
      };

      // Store reconstruction
      await this.redis.hset(
        'timeline_reconstructions', 
        incidentId, 
        JSON.stringify(reconstruction)
      );

      this.logger.info(`Timeline reconstruction completed for incident: ${incidentId}`);
      return reconstruction;

    } catch (error) {
      this.logger.error(`Error reconstructing timeline for incident ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Get existing timeline reconstruction
   */
  async getReconstruction(incidentId: string): Promise<TimelineReconstruction | null> {
    const data = await this.redis.hget('timeline_reconstructions', incidentId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update timeline reconstruction
   */
  async updateReconstruction(incidentId: string): Promise<TimelineReconstruction> {
    // Re-run reconstruction with latest data
    return await this.reconstructTimeline(incidentId);
  }

  /**
   * Generate visual timeline data for UI
   */
  async generateVisualTimeline(
    incidentId: string,
    groupBy: 'phase' | 'hour' | 'minute' = 'phase'
  ): Promise<VisualTimelineData> {
    const reconstruction = await this.getReconstruction(incidentId);
    if (!reconstruction) {
      throw new Error(`No timeline reconstruction found for incident: ${incidentId}`);
    }

    return {
      incidentId,
      groupBy,
      timeline: this.formatForVisualization(reconstruction, groupBy),
      phases: reconstruction.phases,
      metrics: reconstruction.keyMetrics,
      insights: reconstruction.insights.filter(i => i.actionable),
    };
  }

  /**
   * Gather all timeline events from various sources
   */
  private async gatherTimelineEvents(incidentId: string): Promise<TimelineEvent[]> {
    const timelineData = await this.redis.lrange(`timeline:${incidentId}`, 0, -1);
    return timelineData.map(data => JSON.parse(data));
  }

  /**
   * Get related alerts for the incident
   */
  private async getRelatedAlerts(incidentId: string): Promise<Alert[]> {
    // Get alerts from incident metadata or search by time/pattern
    const incident = await this.getIncident(incidentId);
    if (!incident) return [];

    const allAlerts = await this.redis.hgetall('alerts');
    const relatedAlerts: Alert[] = [];

    const incidentStart = new Date(incident.createdAt);
    const searchWindow = new Date(incidentStart.getTime() - 30 * 60 * 1000); // 30 min before

    for (const [id, data] of Object.entries(allAlerts)) {
      const alert: Alert = JSON.parse(data);
      
      // Check if alert is within time window and potentially related
      if (alert.timestamp >= searchWindow && alert.timestamp <= incidentStart) {
        relatedAlerts.push(alert);
      }
    }

    return relatedAlerts;
  }

  /**
   * Get war room messages for the incident
   */
  private async getWarRoomMessages(incidentId: string): Promise<WarRoomMessage[]> {
    const messagesData = await this.redis.lrange(`messages:${incidentId}`, 0, -1);
    return messagesData.map(data => JSON.parse(data));
  }

  /**
   * Get system events (deployments, scaling, etc.)
   */
  private async getSystemEvents(incidentId: string): Promise<SystemEvent[]> {
    // In a real implementation, this would query various system logs
    // For now, return empty array
    return [];
  }

  /**
   * Get incident details
   */
  private async getIncident(incidentId: string): Promise<Incident | null> {
    const data = await this.redis.hget('incidents', incidentId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Enrich timeline events with additional context
   */
  private async enrichEvents(
    rawEvents: TimelineEvent[],
    alerts: Alert[],
    messages: WarRoomMessage[],
    systemEvents: SystemEvent[],
    incident: Incident
  ): Promise<EnrichedTimelineEvent[]> {
    const enrichedEvents: EnrichedTimelineEvent[] = [];

    // Process raw timeline events
    for (const event of rawEvents) {
      const enriched = await this.enrichSingleEvent(event, {
        alerts,
        messages,
        systemEvents,
        incident,
      });
      enrichedEvents.push(enriched);
    }

    // Add alert events
    for (const alert of alerts) {
      const timelineEvent: TimelineEvent = {
        id: uuidv4(),
        incidentId: incident.id,
        type: 'alert',
        title: `Alert: ${alert.title}`,
        description: alert.description,
        timestamp: alert.timestamp,
        metadata: { alertId: alert.id, source: alert.source },
      };

      const enriched = await this.enrichSingleEvent(timelineEvent, {
        alerts,
        messages,
        systemEvents,
        incident,
      });
      enrichedEvents.push(enriched);
    }

    // Add significant war room messages
    const significantMessages = messages.filter(msg => 
      msg.type === 'status_update' || 
      msg.type === 'action' ||
      msg.content.toLowerCase().includes('escalat') ||
      msg.content.toLowerCase().includes('resolv')
    );

    for (const message of significantMessages) {
      const timelineEvent: TimelineEvent = {
        id: uuidv4(),
        incidentId: incident.id,
        type: 'comment',
        title: 'Team Communication',
        description: message.content,
        timestamp: message.timestamp,
        userId: message.userId,
        metadata: { messageId: message.id, messageType: message.type },
      };

      const enriched = await this.enrichSingleEvent(timelineEvent, {
        alerts,
        messages,
        systemEvents,
        incident,
      });
      enrichedEvents.push(enriched);
    }

    // Sort by timestamp
    return enrichedEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Enrich a single event with context
   */
  private async enrichSingleEvent(
    event: TimelineEvent,
    context: {
      alerts: Alert[];
      messages: WarRoomMessage[];
      systemEvents: SystemEvent[];
      incident: Incident;
    }
  ): Promise<EnrichedTimelineEvent> {
    const enriched: EnrichedTimelineEvent = {
      ...event,
      phase: this.determineEventPhase(event, context.incident),
      impact: this.assessEventImpact(event, context),
      source: this.determineEventSource(event),
      confidence: this.calculateEventConfidence(event, context),
      correlatedEvents: await this.findCorrelatedEvents(event, context),
      enrichmentData: await this.gatherEnrichmentData(event, context),
    };

    return enriched;
  }

  /**
   * Determine which phase an event belongs to
   */
  private determineEventPhase(event: TimelineEvent, incident: Incident): string {
    const eventTime = new Date(event.timestamp);
    const incidentStart = new Date(incident.createdAt);
    
    // Simple phase determination based on event type and timing
    if (event.type === 'alert' || eventTime <= incidentStart) {
      return 'detection';
    }
    
    if (event.type === 'status_change' && event.description.includes('acknowledged')) {
      return 'acknowledgment';
    }
    
    if (event.type === 'status_change' && event.description.includes('identified')) {
      return 'diagnosis';
    }
    
    if (event.type === 'resolution' || 
        (event.type === 'status_change' && event.description.includes('resolved'))) {
      return 'resolution';
    }
    
    if (event.type === 'escalation') {
      return 'escalation';
    }
    
    // Default to investigation phase
    return 'investigation';
  }

  /**
   * Assess the impact level of an event
   */
  private assessEventImpact(
    event: TimelineEvent, 
    context: { incident: Incident }
  ): 'low' | 'medium' | 'high' | 'critical' {
    // High impact events
    if (event.type === 'alert' || 
        event.type === 'escalation' || 
        event.type === 'status_change') {
      return 'high';
    }

    // Critical impact for resolution events
    if (event.type === 'resolution') {
      return 'critical';
    }

    // Medium for comments and actions
    if (event.type === 'comment' || event.type === 'action') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Determine the source of an event
   */
  private determineEventSource(event: TimelineEvent): EnrichedTimelineEvent['source'] {
    if (event.metadata?.alertId) return 'alert';
    if (event.metadata?.messageId) return 'warroom';
    if (event.metadata?.automated) return 'automation';
    if (event.userId) return 'manual';
    return 'system';
  }

  /**
   * Calculate confidence score for event accuracy
   */
  private calculateEventConfidence(
    event: TimelineEvent,
    context: any
  ): number {
    let confidence = 0.8; // Base confidence

    // Higher confidence for system-generated events
    if (event.type === 'alert' || event.type === 'status_change') {
      confidence = 0.95;
    }

    // Lower confidence for manual entries
    if (event.type === 'comment' && !event.metadata?.automated) {
      confidence = 0.7;
    }

    // Adjust based on metadata richness
    if (event.metadata && Object.keys(event.metadata).length > 2) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Find correlated events
   */
  private async findCorrelatedEvents(
    event: TimelineEvent,
    context: any
  ): Promise<string[]> {
    const correlatedIds: string[] = [];
    
    // Simple correlation based on timing and keywords
    const eventTime = new Date(event.timestamp);
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    // Check alerts within time window
    for (const alert of context.alerts) {
      const alertTime = new Date(alert.timestamp);
      if (Math.abs(alertTime.getTime() - eventTime.getTime()) < timeWindow) {
        correlatedIds.push(alert.id);
      }
    }

    return correlatedIds;
  }

  /**
   * Gather additional enrichment data
   */
  private async gatherEnrichmentData(
    event: TimelineEvent,
    context: any
  ): Promise<Record<string, any>> {
    const enrichment: Record<string, any> = {};

    // Add system metrics if available
    if (event.type === 'alert') {
      enrichment.systemMetrics = await this.getSystemMetricsAtTime(event.timestamp);
    }

    // Add user context
    if (event.userId) {
      enrichment.userInfo = await this.getUserInfo(event.userId);
    }

    // Add external context
    enrichment.externalFactors = await this.getExternalFactors(event.timestamp);

    return enrichment;
  }

  /**
   * Identify distinct phases of the incident
   */
  private identifyPhases(
    events: EnrichedTimelineEvent[],
    incident: Incident
  ): IncidentPhase[] {
    const phases: IncidentPhase[] = [];
    
    const phaseMap = new Map<string, EnrichedTimelineEvent[]>();
    
    // Group events by phase
    for (const event of events) {
      if (!phaseMap.has(event.phase)) {
        phaseMap.set(event.phase, []);
      }
      phaseMap.get(event.phase)!.push(event);
    }

    // Create phase objects
    const phaseOrder = ['detection', 'acknowledgment', 'investigation', 'diagnosis', 'escalation', 'resolution'];
    
    for (const phaseName of phaseOrder) {
      const phaseEvents = phaseMap.get(phaseName);
      if (!phaseEvents || phaseEvents.length === 0) continue;

      const sortedEvents = phaseEvents.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const startTime = new Date(sortedEvents[0].timestamp);
      const endTime = new Date(sortedEvents[sortedEvents.length - 1].timestamp);
      const duration = endTime.getTime() - startTime.getTime();

      phases.push({
        name: phaseName,
        startTime,
        endTime,
        duration,
        events: sortedEvents.map(e => e.id),
        description: this.getPhaseDescription(phaseName, sortedEvents),
        keyActions: this.extractKeyActions(sortedEvents),
        bottlenecks: this.identifyPhaseBottlenecks(sortedEvents, duration),
      });
    }

    return phases;
  }

  /**
   * Calculate timeline metrics
   */
  private calculateTimelineMetrics(
    events: EnrichedTimelineEvent[],
    phases: IncidentPhase[],
    incident: Incident
  ): TimelineMetrics {
    const incidentStart = new Date(incident.createdAt);
    const incidentEnd = incident.resolvedAt ? new Date(incident.resolvedAt) : new Date();

    // Find key timestamps
    const detectionEvent = events.find(e => e.phase === 'detection');
    const acknowledgmentEvent = events.find(e => e.phase === 'acknowledgment');
    const diagnosisEvent = events.find(e => e.phase === 'diagnosis');
    const resolutionEvent = events.find(e => e.phase === 'resolution');

    const detectionTime = detectionEvent ? 
      new Date(detectionEvent.timestamp).getTime() - incidentStart.getTime() : 0;
    
    const acknowledgmentTime = acknowledgmentEvent && detectionEvent ?
      new Date(acknowledgmentEvent.timestamp).getTime() - new Date(detectionEvent.timestamp).getTime() : 0;
    
    const diagnosisTime = diagnosisEvent && acknowledgmentEvent ?
      new Date(diagnosisEvent.timestamp).getTime() - new Date(acknowledgmentEvent.timestamp).getTime() : 0;
    
    const resolutionTime = resolutionEvent && diagnosisEvent ?
      new Date(resolutionEvent.timestamp).getTime() - new Date(diagnosisEvent.timestamp).getTime() : 0;

    return {
      totalDuration: incidentEnd.getTime() - incidentStart.getTime(),
      detectionTime,
      acknowledgmentTime,
      diagnosisTime,
      resolutionTime,
      escalationCount: events.filter(e => e.type === 'escalation').length,
      automatedActions: events.filter(e => e.source === 'automation').length,
      manualActions: events.filter(e => e.source === 'manual').length,
      communicationEvents: events.filter(e => e.source === 'warroom').length,
    };
  }

  /**
   * Detect gaps in the timeline
   */
  private detectTimelineGaps(
    events: EnrichedTimelineEvent[],
    incident: Incident
  ): TimelineGap[] {
    const gaps: TimelineGap[] = [];
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Look for significant time gaps between events
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEvent = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];
      
      const currentTime = new Date(currentEvent.timestamp);
      const nextTime = new Date(nextEvent.timestamp);
      const gapDuration = nextTime.getTime() - currentTime.getTime();
      
      // Flag gaps longer than 15 minutes during active incident
      if (gapDuration > 15 * 60 * 1000) {
        gaps.push({
          id: uuidv4(),
          startTime: currentTime,
          endTime: nextTime,
          duration: gapDuration,
          type: this.classifyGapType(currentEvent, nextEvent),
          description: `${Math.round(gapDuration / 60000)} minute gap between ${currentEvent.title} and ${nextEvent.title}`,
          impact: this.assessGapImpact(gapDuration, currentEvent.phase),
          suggestions: this.generateGapSuggestions(currentEvent, nextEvent, gapDuration),
        });
      }
    }

    return gaps;
  }

  /**
   * Generate insights from timeline analysis
   */
  private async generateInsights(
    events: EnrichedTimelineEvent[],
    phases: IncidentPhase[],
    metrics: TimelineMetrics,
    gaps: TimelineGap[],
    incident: Incident
  ): Promise<TimelineInsight[]> {
    const insights: TimelineInsight[] = [];

    // Detection time insight
    if (metrics.detectionTime > 5 * 60 * 1000) { // >5 minutes
      insights.push({
        type: 'monitoring',
        title: 'Delayed Incident Detection',
        description: `Incident was detected ${Math.round(metrics.detectionTime / 60000)} minutes after it started`,
        severity: 'warning',
        actionable: true,
        recommendations: [
          'Review monitoring coverage and alert thresholds',
          'Consider implementing additional health checks',
          'Evaluate synthetic monitoring for critical user journeys'
        ],
        evidence: {
          eventIds: events.filter(e => e.phase === 'detection').map(e => e.id),
          metrics: { detectionTime: metrics.detectionTime },
        },
      });
    }

    // Communication efficiency
    if (metrics.communicationEvents < 3 && metrics.totalDuration > 60 * 60 * 1000) {
      insights.push({
        type: 'communication',
        title: 'Limited Team Communication',
        description: 'Few communication events detected during extended incident',
        severity: 'warning',
        actionable: true,
        recommendations: [
          'Establish regular status updates during incidents',
          'Use war room for coordinated response',
          'Document key decisions and actions taken'
        ],
        evidence: {
          eventIds: events.filter(e => e.source === 'warroom').map(e => e.id),
          metrics: { communicationEvents: metrics.communicationEvents },
        },
      });
    }

    // Automation opportunities
    if (metrics.manualActions > metrics.automatedActions && metrics.manualActions > 5) {
      insights.push({
        type: 'automation',
        title: 'Automation Opportunity',
        description: 'Many manual actions performed that could potentially be automated',
        severity: 'info',
        actionable: true,
        recommendations: [
          'Identify common manual actions for automation',
          'Create runbooks for frequent procedures',
          'Implement automated remediation for known issues'
        ],
        evidence: {
          eventIds: events.filter(e => e.source === 'manual').map(e => e.id),
          metrics: { 
            manualActions: metrics.manualActions,
            automatedActions: metrics.automatedActions 
          },
        },
      });
    }

    // Timeline gaps
    const significantGaps = gaps.filter(g => g.impact === 'high');
    if (significantGaps.length > 0) {
      insights.push({
        type: 'process',
        title: 'Timeline Gaps Detected',
        description: `${significantGaps.length} significant gaps found in incident timeline`,
        severity: 'warning',
        actionable: true,
        recommendations: [
          'Implement more frequent status updates',
          'Use automated status tracking tools',
          'Establish clear escalation procedures'
        ],
        evidence: {
          eventIds: significantGaps.map(g => g.id),
          metrics: { gapCount: significantGaps.length },
        },
      });
    }

    return insights;
  }

  // Helper methods for insights generation
  private getPhaseDescription(phaseName: string, events: EnrichedTimelineEvent[]): string {
    const descriptions: Record<string, string> = {
      detection: 'Initial detection and alerting of the incident',
      acknowledgment: 'Incident acknowledged by response team',
      investigation: 'Active investigation and information gathering',
      diagnosis: 'Root cause identification and analysis',
      escalation: 'Escalation to additional resources or management',
      resolution: 'Incident resolution and recovery activities',
    };
    
    return descriptions[phaseName] || `${events.length} events in ${phaseName} phase`;
  }

  private extractKeyActions(events: EnrichedTimelineEvent[]): string[] {
    return events
      .filter(e => e.type === 'action' || e.impact === 'high')
      .map(e => e.title)
      .slice(0, 5); // Top 5 key actions
  }

  private identifyPhaseBottlenecks(events: EnrichedTimelineEvent[], duration: number): string[] {
    const bottlenecks: string[] = [];
    
    if (duration > 30 * 60 * 1000) { // >30 minutes
      bottlenecks.push('Extended phase duration');
    }

    const gaps = events.length > 1 ? this.findInternalGaps(events) : [];
    if (gaps.length > 0) {
      bottlenecks.push('Communication gaps within phase');
    }

    return bottlenecks;
  }

  private findInternalGaps(events: EnrichedTimelineEvent[]): any[] {
    // Simplified gap detection within phase
    return [];
  }

  private classifyGapType(
    beforeEvent: EnrichedTimelineEvent, 
    afterEvent: EnrichedTimelineEvent
  ): TimelineGap['type'] {
    if (beforeEvent.source === 'warroom' || afterEvent.source === 'warroom') {
      return 'communication';
    }
    if (beforeEvent.type === 'action' || afterEvent.type === 'action') {
      return 'action';
    }
    return 'unknown';
  }

  private assessGapImpact(duration: number, phase: string): 'low' | 'medium' | 'high' {
    if (duration > 60 * 60 * 1000) return 'high'; // >1 hour
    if (duration > 30 * 60 * 1000) return 'medium'; // >30 minutes
    return 'low';
  }

  private generateGapSuggestions(
    beforeEvent: EnrichedTimelineEvent,
    afterEvent: EnrichedTimelineEvent,
    duration: number
  ): string[] {
    const suggestions = [];
    
    if (duration > 30 * 60 * 1000) {
      suggestions.push('Consider regular status updates during long operations');
    }
    
    if (beforeEvent.source === 'manual' && afterEvent.source === 'manual') {
      suggestions.push('Document intermediate steps for better tracking');
    }
    
    return suggestions;
  }

  // Mock helper methods (implement based on your system)
  private async getSystemMetricsAtTime(timestamp: Date): Promise<any> {
    // Return system metrics at given time
    return {};
  }

  private async getUserInfo(userId: string): Promise<any> {
    // Return user information
    return { id: userId };
  }

  private async getExternalFactors(timestamp: Date): Promise<any> {
    // Check for external factors (deployments, maintenance, etc.)
    return {};
  }

  private formatForVisualization(
    reconstruction: TimelineReconstruction,
    groupBy: 'phase' | 'hour' | 'minute'
  ): any {
    // Format timeline data for visualization components
    return {
      events: reconstruction.events,
      grouping: groupBy,
      // Add visualization-specific formatting
    };
  }
}

// Supporting interfaces
interface SystemEvent {
  id: string;
  type: string;
  timestamp: Date;
  description: string;
  metadata?: Record<string, any>;
}

interface VisualTimelineData {
  incidentId: string;
  groupBy: string;
  timeline: any;
  phases: IncidentPhase[];
  metrics: TimelineMetrics;
  insights: TimelineInsight[];
}

export default TimelineReconstructionEngine;