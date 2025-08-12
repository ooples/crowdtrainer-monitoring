import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import { Logger } from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  Incident,
  PostMortem,
  PostMortemSection,
  TimelineEvent,
  MTTRMetrics,
  WarRoomMessage,
  IncidentManagementConfig,
} from '../types';

export interface PostMortemTemplate {
  id: string;
  name: string;
  description: string;
  sections: {
    title: string;
    prompt: string;
    required: boolean;
    order: number;
  }[];
}

export interface PostMortemAnalysis {
  rootCauseAnalysis: {
    primaryCause: string;
    contributingFactors: string[];
    confidence: number;
  };
  impactAssessment: {
    usersAffected: number;
    downtime: number;
    revenueImpact?: number;
    customerComplaints: number;
  };
  timelineAnalysis: {
    criticalEvents: TimelineEvent[];
    delays: {
      detection: number;
      acknowledgment: number;
      resolution: number;
    };
    escalationPoints: Date[];
  };
  lessonsLearned: string[];
  recommendedActions: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export class PostMortemGenerator {
  private redis: Redis;
  private logger: Logger;
  private config: IncidentManagementConfig;
  private templates: Map<string, PostMortemTemplate> = new Map();

  constructor(
    config: IncidentManagementConfig,
    redis: Redis,
    logger: Logger
  ) {
    this.config = config;
    this.redis = redis;
    this.logger = logger;
    
    this.setupDefaultTemplates();
  }

  /**
   * Generate a comprehensive post-mortem report
   */
  async generatePostMortem(
    incident: Incident,
    templateId?: string,
    customSections?: PostMortemSection[]
  ): Promise<PostMortem> {
    try {
      this.logger.info(`Generating post-mortem for incident: ${incident.id}`);

      // Get incident data
      const timeline = await this.getIncidentTimeline(incident.id);
      const warRoomMessages = await this.getWarRoomMessages(incident.id);
      const mttrMetrics = await this.getMTTRMetrics(incident.id);
      
      // Analyze incident data
      const analysis = await this.analyzeIncident(incident, timeline, warRoomMessages, mttrMetrics);
      
      // Get template or use default
      const template = templateId ? this.templates.get(templateId) : this.getDefaultTemplate();
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Generate sections
      const sections = customSections || await this.generateSections(incident, analysis, template);
      
      // Create post-mortem
      const postMortem: PostMortem = {
        id: uuidv4(),
        incidentId: incident.id,
        title: `Post-Mortem: ${incident.title}`,
        summary: await this.generateSummary(incident, analysis),
        timeline,
        rootCause: analysis.rootCauseAnalysis.primaryCause,
        impact: {
          usersAffected: analysis.impactAssessment.usersAffected,
          downtime: analysis.impactAssessment.downtime,
          revenueImpact: analysis.impactAssessment.revenueImpact,
        },
        contributingFactors: analysis.rootCauseAnalysis.contributingFactors,
        lessonsLearned: analysis.lessonsLearned,
        actionItems: await this.generateActionItems(analysis),
        sections,
        authors: [incident.assignedUser || 'System'],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store post-mortem
      await this.redis.hset('postmortems', postMortem.id, JSON.stringify(postMortem));
      
      this.logger.info(`Post-mortem generated: ${postMortem.id}`);
      return postMortem;

    } catch (error) {
      this.logger.error(`Error generating post-mortem for incident ${incident.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate post-mortem in Markdown format
   */
  async generateMarkdown(postMortem: PostMortem): Promise<string> {
    const markdown = `# ${postMortem.title}

**Incident ID:** ${postMortem.incidentId}  
**Date:** ${postMortem.createdAt.toLocaleDateString()}  
**Authors:** ${postMortem.authors.join(', ')}  

## Executive Summary

${postMortem.summary}

## Incident Details

- **Duration:** ${postMortem.impact.downtime} minutes
- **Users Affected:** ${postMortem.impact.usersAffected.toLocaleString()}
${postMortem.impact.revenueImpact ? `- **Revenue Impact:** $${postMortem.impact.revenueImpact.toLocaleString()}` : ''}

## Timeline

${postMortem.timeline.map(event => 
  `**${event.timestamp.toLocaleTimeString()}** - ${event.title}: ${event.description}`
).join('\n\n')}

## Root Cause Analysis

### Primary Cause
${postMortem.rootCause}

### Contributing Factors
${postMortem.contributingFactors.map(factor => `- ${factor}`).join('\n')}

## Impact Assessment

- **Users Affected:** ${postMortem.impact.usersAffected.toLocaleString()}
- **Downtime:** ${postMortem.impact.downtime} minutes
${postMortem.impact.revenueImpact ? `- **Revenue Impact:** $${postMortem.impact.revenueImpact.toLocaleString()}` : ''}

## Lessons Learned

${postMortem.lessonsLearned.map(lesson => `- ${lesson}`).join('\n')}

## Action Items

${postMortem.actionItems.map(item => 
  `- [ ] **${item.priority.toUpperCase()}**: ${item.description} (Assignee: ${item.assignee}${item.dueDate ? `, Due: ${item.dueDate.toLocaleDateString()}` : ''})`
).join('\n')}

## Additional Sections

${postMortem.sections.map(section => `### ${section.title}\n\n${section.content}`).join('\n\n')}

---

*This post-mortem was generated on ${postMortem.createdAt.toLocaleDateString()} and last updated on ${postMortem.updatedAt.toLocaleDateString()}.*
`;

    return markdown;
  }

  /**
   * Generate post-mortem as PDF
   */
  async generatePDF(postMortem: PostMortem): Promise<Buffer> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // Helper function to add text with word wrap
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
      
      // Check if we need a new page
      if (yPosition + lines.length * fontSize * 0.5 > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * fontSize * 0.5 + 5;
    };

    // Title page
    addText(postMortem.title, 20, true);
    addText(`Incident ID: ${postMortem.incidentId}`, 12);
    addText(`Date: ${postMortem.createdAt.toLocaleDateString()}`, 12);
    addText(`Authors: ${postMortem.authors.join(', ')}`, 12);
    
    yPosition += 10;

    // Executive Summary
    addText('Executive Summary', 16, true);
    addText(postMortem.summary, 12);

    // Incident Details
    addText('Incident Details', 16, true);
    addText(`Duration: ${postMortem.impact.downtime} minutes`, 12);
    addText(`Users Affected: ${postMortem.impact.usersAffected.toLocaleString()}`, 12);
    if (postMortem.impact.revenueImpact) {
      addText(`Revenue Impact: $${postMortem.impact.revenueImpact.toLocaleString()}`, 12);
    }

    // Timeline
    addText('Timeline', 16, true);
    postMortem.timeline.forEach(event => {
      addText(`${event.timestamp.toLocaleTimeString()} - ${event.title}: ${event.description}`, 10);
    });

    // Root Cause Analysis
    addText('Root Cause Analysis', 16, true);
    addText('Primary Cause:', 14, true);
    addText(postMortem.rootCause, 12);
    
    if (postMortem.contributingFactors.length > 0) {
      addText('Contributing Factors:', 14, true);
      postMortem.contributingFactors.forEach(factor => {
        addText(`• ${factor}`, 12);
      });
    }

    // Lessons Learned
    if (postMortem.lessonsLearned.length > 0) {
      addText('Lessons Learned', 16, true);
      postMortem.lessonsLearned.forEach(lesson => {
        addText(`• ${lesson}`, 12);
      });
    }

    // Action Items
    if (postMortem.actionItems.length > 0) {
      addText('Action Items', 16, true);
      postMortem.actionItems.forEach(item => {
        const dueText = item.dueDate ? `, Due: ${item.dueDate.toLocaleDateString()}` : '';
        addText(`• [${item.priority.toUpperCase()}] ${item.description} (${item.assignee}${dueText})`, 12);
      });
    }

    // Additional Sections
    postMortem.sections.forEach(section => {
      addText(section.title, 16, true);
      addText(section.content, 12);
    });

    // Footer
    addText(`Generated on ${new Date().toLocaleDateString()}`, 10);

    return Buffer.from(pdf.output('arraybuffer'));
  }

  /**
   * Update existing post-mortem
   */
  async updatePostMortem(
    postMortemId: string,
    updates: Partial<PostMortem>
  ): Promise<PostMortem> {
    const existing = await this.getPostMortem(postMortemId);
    if (!existing) {
      throw new Error(`Post-mortem not found: ${postMortemId}`);
    }

    const updated: PostMortem = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.redis.hset('postmortems', postMortemId, JSON.stringify(updated));
    
    this.logger.info(`Post-mortem updated: ${postMortemId}`);
    return updated;
  }

  /**
   * Get post-mortem by ID
   */
  async getPostMortem(postMortemId: string): Promise<PostMortem | null> {
    const data = await this.redis.hget('postmortems', postMortemId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get all post-mortems for an incident
   */
  async getPostMortemsForIncident(incidentId: string): Promise<PostMortem[]> {
    const allPostMortems = await this.redis.hgetall('postmortems');
    const postMortems: PostMortem[] = [];

    for (const [id, data] of Object.entries(allPostMortems)) {
      const postMortem: PostMortem = JSON.parse(data);
      if (postMortem.incidentId === incidentId) {
        postMortems.push(postMortem);
      }
    }

    return postMortems.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Analyze incident data for insights
   */
  private async analyzeIncident(
    incident: Incident,
    timeline: TimelineEvent[],
    warRoomMessages: WarRoomMessage[],
    mttrMetrics?: MTTRMetrics
  ): Promise<PostMortemAnalysis> {
    // Root Cause Analysis using message patterns and timeline
    const rootCauseAnalysis = await this.analyzeRootCause(incident, timeline, warRoomMessages);
    
    // Impact Assessment
    const impactAssessment = await this.assessImpact(incident, timeline, mttrMetrics);
    
    // Timeline Analysis
    const timelineAnalysis = this.analyzeTimeline(timeline, mttrMetrics);
    
    // Extract lessons learned from messages and patterns
    const lessonsLearned = await this.extractLessonsLearned(incident, warRoomMessages);
    
    // Generate recommended actions
    const recommendedActions = await this.generateRecommendedActions(
      rootCauseAnalysis,
      impactAssessment,
      timelineAnalysis
    );

    return {
      rootCauseAnalysis,
      impactAssessment,
      timelineAnalysis,
      lessonsLearned,
      recommendedActions,
    };
  }

  private async analyzeRootCause(
    incident: Incident,
    timeline: TimelineEvent[],
    messages: WarRoomMessage[]
  ) {
    // Simple pattern-based root cause analysis
    const allText = [
      incident.description,
      ...timeline.map(e => e.description),
      ...messages.map(m => m.content),
    ].join(' ').toLowerCase();

    const causePatterns = [
      { pattern: /database|db|query|connection/, cause: 'Database performance or connectivity issue' },
      { pattern: /memory|oom|out of memory/, cause: 'Memory exhaustion or leak' },
      { pattern: /disk|storage|filesystem/, cause: 'Storage capacity or I/O issue' },
      { pattern: /network|connectivity|timeout/, cause: 'Network connectivity issue' },
      { pattern: /deployment|deploy|release/, cause: 'Deployment or configuration issue' },
      { pattern: /api|service|endpoint/, cause: 'API or service failure' },
      { pattern: /load|traffic|capacity/, cause: 'Capacity or load-related issue' },
    ];

    let primaryCause = 'Unknown - requires manual analysis';
    let confidence = 0.3;

    for (const { pattern, cause } of causePatterns) {
      const matches = allText.match(pattern);
      if (matches && matches.length > 2) {
        primaryCause = cause;
        confidence = Math.min(0.9, 0.5 + matches.length * 0.1);
        break;
      }
    }

    // Extract contributing factors
    const contributingFactors: string[] = [];
    if (allText.includes('monitoring') && allText.includes('delay')) {
      contributingFactors.push('Delayed monitoring alerts');
    }
    if (allText.includes('escalation')) {
      contributingFactors.push('Escalation process delays');
    }
    if (allText.includes('documentation') || allText.includes('runbook')) {
      contributingFactors.push('Insufficient documentation or runbooks');
    }

    return {
      primaryCause,
      contributingFactors,
      confidence,
    };
  }

  private async assessImpact(
    incident: Incident,
    timeline: TimelineEvent[],
    mttrMetrics?: MTTRMetrics
  ) {
    // Calculate downtime
    const createdAt = new Date(incident.createdAt);
    const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt) : new Date();
    const downtime = Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60));

    // Estimate users affected based on severity
    let usersAffected = 0;
    switch (incident.severity) {
      case 'P1_CRITICAL':
        usersAffected = 100000; // Assume all users affected
        break;
      case 'P2_HIGH':
        usersAffected = 50000; // Major feature affecting most users
        break;
      case 'P3_MEDIUM':
        usersAffected = 10000; // Moderate impact
        break;
      case 'P4_LOW':
        usersAffected = 1000; // Minor impact
        break;
    }

    // Estimate revenue impact for P1/P2 incidents
    let revenueImpact: number | undefined;
    if (incident.severity === 'P1_CRITICAL' || incident.severity === 'P2_HIGH') {
      // Rough estimate: $1000 per minute of downtime for critical incidents
      const ratePerMinute = incident.severity === 'P1_CRITICAL' ? 1000 : 500;
      revenueImpact = downtime * ratePerMinute;
    }

    return {
      usersAffected,
      downtime,
      revenueImpact,
      customerComplaints: Math.round(usersAffected * 0.01), // Estimate 1% complaint rate
    };
  }

  private analyzeTimeline(timeline: TimelineEvent[], mttrMetrics?: MTTRMetrics) {
    // Find critical events
    const criticalEvents = timeline.filter(event =>
      event.type === 'status_change' || 
      event.type === 'escalation' ||
      event.title.toLowerCase().includes('critical') ||
      event.title.toLowerCase().includes('escalate')
    );

    // Calculate delays from MTTR metrics or timeline
    const delays = mttrMetrics ? {
      detection: mttrMetrics.durations.detectionTime / 1000 / 60, // Convert to minutes
      acknowledgment: mttrMetrics.durations.acknowledgmentTime / 1000 / 60,
      resolution: mttrMetrics.durations.resolutionTime / 1000 / 60,
    } : {
      detection: 5, // Default estimates
      acknowledgment: 10,
      resolution: 30,
    };

    // Find escalation points
    const escalationPoints = timeline
      .filter(event => event.type === 'escalation')
      .map(event => event.timestamp);

    return {
      criticalEvents,
      delays,
      escalationPoints,
    };
  }

  private async extractLessonsLearned(
    incident: Incident,
    messages: WarRoomMessage[]
  ): Promise<string[]> {
    const lessons: string[] = [];
    const messageText = messages.map(m => m.content.toLowerCase()).join(' ');

    // Pattern-based lesson extraction
    if (messageText.includes('monitor') && messageText.includes('alert')) {
      lessons.push('Need better monitoring and alerting coverage');
    }
    if (messageText.includes('document') || messageText.includes('runbook')) {
      lessons.push('Improve incident response documentation');
    }
    if (messageText.includes('communication') || messageText.includes('notify')) {
      lessons.push('Enhance communication processes during incidents');
    }
    if (messageText.includes('test') && messageText.includes('deploy')) {
      lessons.push('Strengthen deployment testing procedures');
    }

    // Add default lessons based on incident characteristics
    if (incident.severity === 'P1_CRITICAL') {
      lessons.push('Critical system requires additional redundancy');
    }

    return lessons;
  }

  private async generateRecommendedActions(
    rootCause: any,
    impact: any,
    timeline: any
  ) {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions
    immediate.push('Verify incident is fully resolved');
    immediate.push('Update status page and notify users');
    
    if (impact.downtime > 60) {
      immediate.push('Conduct immediate system health check');
    }

    // Short-term actions
    if (rootCause.primaryCause.includes('monitoring')) {
      shortTerm.push('Implement additional monitoring for early detection');
    }
    if (timeline.delays.detection > 10) {
      shortTerm.push('Review and improve alerting thresholds');
    }
    if (timeline.escalationPoints.length > 2) {
      shortTerm.push('Optimize escalation procedures');
    }

    // Long-term actions
    if (impact.revenueImpact && impact.revenueImpact > 10000) {
      longTerm.push('Conduct architecture review for high-availability');
    }
    if (rootCause.confidence < 0.7) {
      longTerm.push('Enhance incident analysis and root cause detection');
    }

    longTerm.push('Schedule quarterly incident response training');

    return {
      immediate,
      shortTerm,
      longTerm,
    };
  }

  private async generateSections(
    incident: Incident,
    analysis: PostMortemAnalysis,
    template: PostMortemTemplate
  ): Promise<PostMortemSection[]> {
    const sections: PostMortemSection[] = [];

    for (const templateSection of template.sections) {
      let content = '';

      switch (templateSection.title.toLowerCase()) {
        case 'technical details':
          content = `**Affected Systems:** ${incident.affectedComponents.join(', ') || 'Not specified'}
**Detection Method:** ${incident.source}
**Initial Assessment:** ${analysis.rootCauseAnalysis.primaryCause}
**Resolution Applied:** Manual intervention and system restoration`;
          break;

        case 'customer impact':
          content = `**Users Affected:** ${analysis.impactAssessment.usersAffected.toLocaleString()}
**Service Downtime:** ${analysis.impactAssessment.downtime} minutes
**Customer Complaints:** ${analysis.impactAssessment.customerComplaints}
${analysis.impactAssessment.revenueImpact ? `**Revenue Impact:** $${analysis.impactAssessment.revenueImpact.toLocaleString()}` : ''}`;
          break;

        case 'prevention measures':
          content = analysis.recommendedActions.longTerm.map(action => `• ${action}`).join('\n');
          break;

        default:
          content = `This section requires manual completion based on the specific details of the incident.`;
      }

      sections.push({
        title: templateSection.title,
        content,
        order: templateSection.order,
      });
    }

    return sections.sort((a, b) => a.order - b.order);
  }

  private async generateSummary(
    incident: Incident,
    analysis: PostMortemAnalysis
  ): Promise<string> {
    return `On ${incident.createdAt.toLocaleDateString()}, we experienced a ${incident.severity} incident affecting ${analysis.impactAssessment.usersAffected.toLocaleString()} users for approximately ${analysis.impactAssessment.downtime} minutes. The incident was caused by ${analysis.rootCauseAnalysis.primaryCause.toLowerCase()}. The issue has been fully resolved and preventive measures have been identified to reduce the likelihood of recurrence.`;
  }

  private async generateActionItems(analysis: PostMortemAnalysis): Promise<PostMortem['actionItems']> {
    const actionItems: PostMortem['actionItems'] = [];

    // Convert recommended actions to action items
    analysis.recommendedActions.immediate.forEach(action => {
      actionItems.push({
        id: uuidv4(),
        description: action,
        assignee: 'Incident Commander',
        priority: 'high' as const,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
        completed: false,
      });
    });

    analysis.recommendedActions.shortTerm.forEach(action => {
      actionItems.push({
        id: uuidv4(),
        description: action,
        assignee: 'Engineering Team',
        priority: 'medium' as const,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        completed: false,
      });
    });

    analysis.recommendedActions.longTerm.forEach(action => {
      actionItems.push({
        id: uuidv4(),
        description: action,
        assignee: 'Engineering Manager',
        priority: 'low' as const,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month
        completed: false,
      });
    });

    return actionItems;
  }

  private async getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]> {
    const timelineData = await this.redis.lrange(`timeline:${incidentId}`, 0, -1);
    return timelineData.map(data => JSON.parse(data));
  }

  private async getWarRoomMessages(incidentId: string): Promise<WarRoomMessage[]> {
    const messagesData = await this.redis.lrange(`messages:${incidentId}`, 0, -1);
    return messagesData.map(data => JSON.parse(data));
  }

  private async getMTTRMetrics(incidentId: string): Promise<MTTRMetrics | undefined> {
    const metricsData = await this.redis.hget('mttr_metrics', incidentId);
    return metricsData ? JSON.parse(metricsData) : undefined;
  }

  private getDefaultTemplate(): PostMortemTemplate {
    return {
      id: 'default',
      name: 'Default Post-Mortem Template',
      description: 'Standard template for incident post-mortems',
      sections: [
        {
          title: 'Technical Details',
          prompt: 'Provide technical details about the incident',
          required: true,
          order: 1,
        },
        {
          title: 'Customer Impact',
          prompt: 'Describe the impact on customers',
          required: true,
          order: 2,
        },
        {
          title: 'Prevention Measures',
          prompt: 'List measures to prevent similar incidents',
          required: true,
          order: 3,
        },
      ],
    };
  }

  private setupDefaultTemplates(): void {
    const templates: PostMortemTemplate[] = [
      this.getDefaultTemplate(),
      {
        id: 'security',
        name: 'Security Incident Template',
        description: 'Template for security-related incidents',
        sections: [
          {
            title: 'Security Impact Assessment',
            prompt: 'Assess security implications',
            required: true,
            order: 1,
          },
          {
            title: 'Data Exposure Analysis',
            prompt: 'Analyze potential data exposure',
            required: true,
            order: 2,
          },
          {
            title: 'Compliance Implications',
            prompt: 'Review compliance requirements',
            required: true,
            order: 3,
          },
        ],
      },
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });

    this.logger.info(`Loaded ${templates.length} post-mortem templates`);
  }
}