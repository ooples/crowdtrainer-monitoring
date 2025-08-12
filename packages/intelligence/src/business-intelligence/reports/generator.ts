import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// Types for report system
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'executive' | 'operational' | 'technical' | 'business' | 'custom';
  
  // Report content configuration
  sections: ReportSection[];
  
  // Output format options
  formats: ReportFormat[];
  
  // Metadata
  owner: string;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'kpi_summary' | 'chart' | 'table' | 'text' | 'image' | 'alert_summary' | 'trend_analysis';
  
  // Data configuration
  dataSource?: {
    type: 'kpi' | 'metrics' | 'sla' | 'cost' | 'custom_query';
    configuration: Record<string, any>;
  };
  
  // Visualization settings
  visualization?: {
    chartType?: 'line' | 'bar' | 'pie' | 'gauge' | 'heatmap';
    dimensions?: { width: number; height: number };
    colors?: string[];
    showLegend?: boolean;
    showDataLabels?: boolean;
  };
  
  // Filtering and grouping
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  
  // Conditional rendering
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
    action: 'show' | 'hide' | 'highlight';
  }>;
  
  order: number;
}

export interface ReportFormat {
  type: 'pdf' | 'html' | 'csv' | 'excel' | 'powerpoint' | 'json';
  configuration: {
    pageSize?: 'A4' | 'letter' | 'legal';
    orientation?: 'portrait' | 'landscape';
    includeCharts?: boolean;
    includeRawData?: boolean;
    template?: string; // Template file path
    branding?: {
      logo?: string;
      colors?: { primary: string; secondary: string };
      fonts?: { heading: string; body: string };
    };
  };
}

export interface ReportSchedule {
  id: string;
  name: string;
  templateId: string;
  
  // Schedule configuration
  schedule: {
    type: 'cron' | 'interval';
    expression: string; // Cron expression or interval (e.g., "5m", "1h", "1d")
    timezone?: string;
    enabled: boolean;
  };
  
  // Data range for each report
  dataRange: {
    type: 'relative' | 'absolute';
    value: string; // e.g., "last_7_days", "last_month"
    endDate?: Date; // For absolute ranges
  };
  
  // Distribution settings
  distribution: {
    channels: ReportChannel[];
    formats: ReportFormat['type'][];
  };
  
  // Conditional sending
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
    action: 'send' | 'skip' | 'escalate';
  }>;
  
  // Metadata
  owner: string;
  createdAt: Date;
  lastExecuted?: Date;
  nextExecution: Date;
  isActive: boolean;
}

export interface ReportChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'file_system';
  
  configuration: {
    // Email configuration
    recipients?: string[];
    subject?: string;
    bodyTemplate?: string;
    
    // Slack configuration
    webhook?: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
    
    // Teams configuration
    webhookUrl?: string;
    
    // Webhook configuration
    url?: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
    
    // File system configuration
    directory?: string;
    filename?: string;
  };
  
  // Retry configuration
  retryPolicy?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
  };
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  scheduleId?: string;
  
  // Report metadata
  title: string;
  generatedAt: Date;
  dataRange: { start: Date; end: Date };
  
  // Generated content
  sections: GeneratedReportSection[];
  
  // Output files
  outputs: Array<{
    format: ReportFormat['type'];
    filePath?: string;
    buffer?: Buffer;
    metadata: {
      sizeBytes: number;
      generationTimeMs: number;
    };
  }>;
  
  // Execution metadata
  executionMetadata: {
    totalExecutionTimeMs: number;
    dataSourcesUsed: string[];
    recordsProcessed: number;
    errors: string[];
    warnings: string[];
  };
}

export interface GeneratedReportSection {
  id: string;
  title: string;
  type: ReportSection['type'];
  
  // Processed data
  data: {
    kpis?: Array<{ name: string; value: number; formattedValue: string; trend: string }>;
    chartData?: any;
    tableData?: Array<Record<string, any>>;
    textContent?: string;
    imageUrl?: string;
    alerts?: Array<{ severity: string; message: string; timestamp: Date }>;
  };
  
  // Rendered content
  renderedContent: {
    html?: string;
    chartImage?: Buffer;
    tableHtml?: string;
  };
}

export interface ReportDeliveryResult {
  reportId: string;
  channel: ReportChannel;
  success: boolean;
  deliveredAt?: Date;
  error?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

// Main Report Generator class
export class ReportGenerator extends EventEmitter {
  private templates = new Map<string, ReportTemplate>();
  private schedules = new Map<string, ReportSchedule>();
  private scheduledJobs = new Map<string, NodeJS.Timeout>();
  private generatedReports = new Map<string, GeneratedReport>();

  constructor(private config: {
    outputDirectory: string;
    maxReportsRetention: number;
    defaultTimezone: string;
    enableParallelGeneration: boolean;
  } = {
    outputDirectory: './reports',
    maxReportsRetention: 100,
    defaultTimezone: 'UTC',
    enableParallelGeneration: true
  }) {
    super();
    this.ensureOutputDirectory();
    this.initializeBuiltInTemplates();
  }

  /**
   * Create a new report template
   */
  createTemplate(template: ReportTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template_created', { template });
  }

  /**
   * Update an existing report template
   */
  updateTemplate(templateId: string, updates: Partial<ReportTemplate>): void {
    const existing = this.templates.get(templateId);
    if (!existing) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.templates.set(templateId, updated);
    this.emit('template_updated', { template: updated, changes: updates });
  }

  /**
   * Schedule a report for automated generation and delivery
   */
  scheduleReport(schedule: ReportSchedule): void {
    if (!this.templates.has(schedule.templateId)) {
      throw new Error(`Template not found: ${schedule.templateId}`);
    }

    this.schedules.set(schedule.id, schedule);
    
    if (schedule.schedule.enabled) {
      this.startReportSchedule(schedule.id);
    }

    this.emit('report_scheduled', { schedule });
  }

  /**
   * Update a report schedule
   */
  updateSchedule(scheduleId: string, updates: Partial<ReportSchedule>): void {
    const existing = this.schedules.get(scheduleId);
    if (!existing) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const updated = { ...existing, ...updates };
    this.schedules.set(scheduleId, updated);

    // Restart scheduling if schedule configuration changed
    if (updates.schedule) {
      this.stopReportSchedule(scheduleId);
      if (updated.schedule.enabled) {
        this.startReportSchedule(scheduleId);
      }
    }

    this.emit('schedule_updated', { schedule: updated, changes: updates });
  }

  /**
   * Generate a report immediately
   */
  async generateReport(
    templateId: string,
    dataRange: { start: Date; end: Date },
    formats: ReportFormat['type'][] = ['pdf'],
    customData?: Record<string, any>
  ): Promise<GeneratedReport> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const startTime = Date.now();
    const reportId = this.generateReportId();
    
    try {
      this.emit('report_generation_started', { reportId, templateId });

      // Process each section
      const sections = await this.processSections(template.sections, dataRange, customData);
      
      // Generate outputs in requested formats
      const outputs = await this.generateOutputs(template, sections, formats);

      const report: GeneratedReport = {
        id: reportId,
        templateId,
        title: template.name,
        generatedAt: new Date(),
        dataRange,
        sections,
        outputs,
        executionMetadata: {
          totalExecutionTimeMs: Date.now() - startTime,
          dataSourcesUsed: this.extractDataSources(template.sections),
          recordsProcessed: this.countProcessedRecords(sections),
          errors: [],
          warnings: []
        }
      };

      // Store the generated report
      this.storeGeneratedReport(report);

      this.emit('report_generated', { report });
      return report;

    } catch (error) {
      this.emit('report_generation_error', { 
        reportId, 
        templateId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Deliver a generated report through specified channels
   */
  async deliverReport(
    reportId: string,
    channels: ReportChannel[],
    formatPreferences?: Record<string, ReportFormat['type']>
  ): Promise<ReportDeliveryResult[]> {
    const report = this.generatedReports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const deliveryResults: ReportDeliveryResult[] = [];

    for (const channel of channels) {
      try {
        const preferredFormat = formatPreferences?.[channel.type] || 'pdf';
        const output = report.outputs.find(o => o.format === preferredFormat);
        
        if (!output) {
          throw new Error(`Format ${preferredFormat} not available for report`);
        }

        const result = await this.deliverToChannel(report, channel, output);
        deliveryResults.push(result);

      } catch (error) {
        const errorResult: ReportDeliveryResult = {
          reportId,
          channel,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 0
        };
        deliveryResults.push(errorResult);
      }
    }

    this.emit('report_delivered', { reportId, results: deliveryResults });
    return deliveryResults;
  }

  /**
   * Get all report templates
   */
  getTemplates(filters?: {
    category?: string;
    owner?: string;
    tags?: string[];
  }): ReportTemplate[] {
    let templates = Array.from(this.templates.values());

    if (filters) {
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category);
      }
      if (filters.owner) {
        templates = templates.filter(t => t.owner === filters.owner);
      }
      if (filters.tags?.length) {
        templates = templates.filter(t => 
          filters.tags!.some(tag => t.tags.includes(tag))
        );
      }
    }

    return templates;
  }

  /**
   * Get all report schedules
   */
  getSchedules(activeOnly: boolean = false): ReportSchedule[] {
    const schedules = Array.from(this.schedules.values());
    return activeOnly ? schedules.filter(s => s.isActive) : schedules;
  }

  /**
   * Get generated reports with optional filtering
   */
  getGeneratedReports(filters?: {
    templateId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): GeneratedReport[] {
    let reports = Array.from(this.generatedReports.values());

    if (filters) {
      if (filters.templateId) {
        reports = reports.filter(r => r.templateId === filters.templateId);
      }
      if (filters.startDate) {
        reports = reports.filter(r => r.generatedAt >= filters.startDate!);
      }
      if (filters.endDate) {
        reports = reports.filter(r => r.generatedAt <= filters.endDate!);
      }
    }

    // Sort by generation date (newest first)
    reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    if (filters?.limit) {
      reports = reports.slice(0, filters.limit);
    }

    return reports;
  }

  // Private methods for report processing
  private async processSections(
    sections: ReportSection[],
    dataRange: { start: Date; end: Date },
    customData?: Record<string, any>
  ): Promise<GeneratedReportSection[]> {
    const processedSections: GeneratedReportSection[] = [];

    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    for (const section of sortedSections) {
      try {
        const processed = await this.processSection(section, dataRange, customData);
        processedSections.push(processed);
      } catch (error) {
        console.error(`Error processing section ${section.id}:`, error);
        // Continue with other sections
      }
    }

    return processedSections;
  }

  private async processSection(
    section: ReportSection,
    dataRange: { start: Date; end: Date },
    customData?: Record<string, any>
  ): Promise<GeneratedReportSection> {
    let data: GeneratedReportSection['data'] = {};
    let renderedContent: GeneratedReportSection['renderedContent'] = {};

    switch (section.type) {
      case 'kpi_summary':
        data = await this.processKPISummarySection(section, dataRange);
        renderedContent = await this.renderKPISummary(data.kpis || []);
        break;
        
      case 'chart':
        data = await this.processChartSection(section, dataRange);
        renderedContent = await this.renderChart(data.chartData, section.visualization);
        break;
        
      case 'table':
        data = await this.processTableSection(section, dataRange);
        renderedContent = await this.renderTable(data.tableData || []);
        break;
        
      case 'alert_summary':
        data = await this.processAlertSummarySection(section, dataRange);
        renderedContent = await this.renderAlertSummary(data.alerts || []);
        break;
        
      case 'text':
        data = { textContent: section.dataSource?.configuration.content || '' };
        renderedContent = { html: `<div class="text-section">${data.textContent}</div>` };
        break;
    }

    return {
      id: section.id,
      title: section.title,
      type: section.type,
      data,
      renderedContent
    };
  }

  private async generateOutputs(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    formats: ReportFormat['type'][]
  ): Promise<GeneratedReport['outputs']> {
    const outputs: GeneratedReport['outputs'] = [];

    for (const formatType of formats) {
      const formatConfig = template.formats.find(f => f.type === formatType);
      if (!formatConfig) {
        console.warn(`Format ${formatType} not configured for template`);
        continue;
      }

      const startTime = Date.now();
      
      try {
        let output: { buffer?: Buffer; filePath?: string };

        switch (formatType) {
          case 'pdf':
            output = await this.generatePDFOutput(template, sections, formatConfig);
            break;
          case 'html':
            output = await this.generateHTMLOutput(template, sections, formatConfig);
            break;
          case 'excel':
            output = await this.generateExcelOutput(template, sections, formatConfig);
            break;
          case 'csv':
            output = await this.generateCSVOutput(template, sections, formatConfig);
            break;
          case 'powerpoint':
            output = await this.generatePowerPointOutput(template, sections, formatConfig);
            break;
          default:
            output = await this.generateJSONOutput(template, sections, formatConfig);
        }

        outputs.push({
          format: formatType,
          ...output,
          metadata: {
            sizeBytes: output.buffer?.length || 0,
            generationTimeMs: Date.now() - startTime
          }
        });

      } catch (error) {
        console.error(`Error generating ${formatType} output:`, error);
      }
    }

    return outputs;
  }

  private async deliverToChannel(
    report: GeneratedReport,
    channel: ReportChannel,
    output: GeneratedReport['outputs'][0]
  ): Promise<ReportDeliveryResult> {
    const startTime = Date.now();
    
    try {
      switch (channel.type) {
        case 'email':
          await this.deliverViaEmail(report, channel, output);
          break;
        case 'slack':
          await this.deliverViaSlack(report, channel, output);
          break;
        case 'teams':
          await this.deliverViaTeams(report, channel, output);
          break;
        case 'webhook':
          await this.deliverViaWebhook(report, channel, output);
          break;
        case 'file_system':
          await this.deliverViaFileSystem(report, channel, output);
          break;
      }

      return {
        reportId: report.id,
        channel,
        success: true,
        deliveredAt: new Date(),
        retryCount: 0,
        metadata: {
          deliveryTimeMs: Date.now() - startTime,
          outputSize: output.metadata.sizeBytes
        }
      };

    } catch (error) {
      return {
        reportId: report.id,
        channel,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      };
    }
  }

  // Mock implementations for different output formats
  private async generatePDFOutput(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    format: ReportFormat
  ): Promise<{ buffer: Buffer; filePath: string }> {
    // Would use a PDF library like puppeteer, jsPDF, or PDFKit
    const buffer = Buffer.from('Mock PDF content');
    const filePath = path.join(this.config.outputDirectory, `report_${Date.now()}.pdf`);
    await fs.writeFile(filePath, buffer);
    return { buffer, filePath };
  }

  private async generateHTMLOutput(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    format: ReportFormat
  ): Promise<{ buffer: Buffer; filePath: string }> {
    const html = this.generateHTMLContent(template, sections, format);
    const buffer = Buffer.from(html, 'utf-8');
    const filePath = path.join(this.config.outputDirectory, `report_${Date.now()}.html`);
    await fs.writeFile(filePath, buffer);
    return { buffer, filePath };
  }

  private async generateExcelOutput(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    format: ReportFormat
  ): Promise<{ buffer: Buffer; filePath: string }> {
    // Would use a library like exceljs
    const buffer = Buffer.from('Mock Excel content');
    const filePath = path.join(this.config.outputDirectory, `report_${Date.now()}.xlsx`);
    await fs.writeFile(filePath, buffer);
    return { buffer, filePath };
  }

  private async generateCSVOutput(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    format: ReportFormat
  ): Promise<{ buffer: Buffer; filePath: string }> {
    const csvContent = this.generateCSVContent(sections);
    const buffer = Buffer.from(csvContent, 'utf-8');
    const filePath = path.join(this.config.outputDirectory, `report_${Date.now()}.csv`);
    await fs.writeFile(filePath, buffer);
    return { buffer, filePath };
  }

  private async generatePowerPointOutput(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    format: ReportFormat
  ): Promise<{ buffer: Buffer; filePath: string }> {
    // Would use a library like pptxgenjs
    const buffer = Buffer.from('Mock PowerPoint content');
    const filePath = path.join(this.config.outputDirectory, `report_${Date.now()}.pptx`);
    await fs.writeFile(filePath, buffer);
    return { buffer, filePath };
  }

  private async generateJSONOutput(
    template: ReportTemplate,
    sections: GeneratedReportSection[],
    format: ReportFormat
  ): Promise<{ buffer: Buffer; filePath: string }> {
    const jsonContent = JSON.stringify({ template: template.name, sections }, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');
    const filePath = path.join(this.config.outputDirectory, `report_${Date.now()}.json`);
    await fs.writeFile(filePath, buffer);
    return { buffer, filePath };
  }

  // Mock delivery implementations
  private async deliverViaEmail(
    report: GeneratedReport,
    channel: ReportChannel,
    output: GeneratedReport['outputs'][0]
  ): Promise<void> {
    // Would integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`Delivering report ${report.id} via email to ${channel.configuration.recipients?.join(', ')}`);
  }

  private async deliverViaSlack(
    report: GeneratedReport,
    channel: ReportChannel,
    output: GeneratedReport['outputs'][0]
  ): Promise<void> {
    // Would use Slack Web API or webhook
    console.log(`Delivering report ${report.id} to Slack channel ${channel.configuration.channel}`);
  }

  private async deliverViaTeams(
    report: GeneratedReport,
    channel: ReportChannel,
    output: GeneratedReport['outputs'][0]
  ): Promise<void> {
    // Would use Teams webhook
    console.log(`Delivering report ${report.id} to Teams`);
  }

  private async deliverViaWebhook(
    report: GeneratedReport,
    channel: ReportChannel,
    output: GeneratedReport['outputs'][0]
  ): Promise<void> {
    // Would make HTTP request
    console.log(`Delivering report ${report.id} via webhook to ${channel.configuration.url}`);
  }

  private async deliverViaFileSystem(
    report: GeneratedReport,
    channel: ReportChannel,
    output: GeneratedReport['outputs'][0]
  ): Promise<void> {
    // Copy file to specified directory
    if (output.filePath && channel.configuration.directory) {
      const filename = channel.configuration.filename || path.basename(output.filePath);
      const targetPath = path.join(channel.configuration.directory, filename);
      await fs.copyFile(output.filePath, targetPath);
    }
  }

  // Helper methods
  private startReportSchedule(scheduleId: string): void {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;

    let interval: number;
    
    if (schedule.schedule.type === 'interval') {
      interval = this.parseInterval(schedule.schedule.expression);
    } else {
      // For cron, calculate next execution time
      interval = this.calculateCronInterval(schedule.schedule.expression);
    }

    const timer = setInterval(async () => {
      await this.executeScheduledReport(scheduleId);
    }, interval);

    this.scheduledJobs.set(scheduleId, timer);
  }

  private stopReportSchedule(scheduleId: string): void {
    const timer = this.scheduledJobs.get(scheduleId);
    if (timer) {
      clearInterval(timer);
      this.scheduledJobs.delete(scheduleId);
    }
  }

  private async executeScheduledReport(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.isActive) return;

    try {
      // Calculate data range
      const dataRange = this.calculateDataRange(schedule.dataRange);
      
      // Generate report
      const report = await this.generateReport(
        schedule.templateId,
        dataRange,
        schedule.distribution.formats
      );

      // Deliver report
      await this.deliverReport(
        report.id,
        schedule.distribution.channels
      );

      // Update schedule metadata
      schedule.lastExecuted = new Date();
      schedule.nextExecution = new Date(Date.now() + this.parseInterval(schedule.schedule.expression));

    } catch (error) {
      console.error(`Scheduled report execution failed for ${scheduleId}:`, error);
    }
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }

  private parseInterval(expression: string): number {
    // Parse expressions like "5m", "1h", "2d"
    const match = expression.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid interval expression: ${expression}`);

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  private calculateCronInterval(expression: string): number {
    // Simplified cron parsing - would use a proper cron library
    return 60 * 60 * 1000; // Default to 1 hour
  }

  private calculateDataRange(range: ReportSchedule['dataRange']): { start: Date; end: Date } {
    const now = new Date();
    
    if (range.type === 'absolute' && range.endDate) {
      // For absolute ranges, calculate backwards from end date
      return { start: range.endDate, end: now };
    }

    // Parse relative ranges like "last_7_days", "last_month"
    const match = range.value.match(/^last_(\d+)_(\w+)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      let startTime = now.getTime();
      switch (unit) {
        case 'minutes':
          startTime -= value * 60 * 1000;
          break;
        case 'hours':
          startTime -= value * 60 * 60 * 1000;
          break;
        case 'days':
          startTime -= value * 24 * 60 * 60 * 1000;
          break;
        case 'weeks':
          startTime -= value * 7 * 24 * 60 * 60 * 1000;
          break;
        case 'months':
          startTime -= value * 30 * 24 * 60 * 60 * 1000;
          break;
      }
      
      return { start: new Date(startTime), end: now };
    }

    // Default to last 24 hours
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
  }

  private storeGeneratedReport(report: GeneratedReport): void {
    this.generatedReports.set(report.id, report);
    
    // Clean up old reports if exceeding retention limit
    const reports = Array.from(this.generatedReports.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    
    if (reports.length > this.config.maxReportsRetention) {
      const reportsToRemove = reports.slice(this.config.maxReportsRetention);
      reportsToRemove.forEach(r => {
        this.generatedReports.delete(r.id);
        // Clean up associated files
        r.outputs.forEach(output => {
          if (output.filePath) {
            fs.unlink(output.filePath).catch(console.error);
          }
        });
      });
    }
  }

  // Mock section processing methods
  private async processKPISummarySection(section: ReportSection, dataRange: { start: Date; end: Date }): Promise<any> {
    // Would fetch KPI data from KPI builder
    return {
      kpis: [
        { name: 'Availability', value: 99.95, formattedValue: '99.95%', trend: 'stable' },
        { name: 'Response Time', value: 145, formattedValue: '145ms', trend: 'improving' }
      ]
    };
  }

  private async processChartSection(section: ReportSection, dataRange: { start: Date; end: Date }): Promise<any> {
    // Would fetch chart data
    return { chartData: { labels: [], datasets: [] } };
  }

  private async processTableSection(section: ReportSection, dataRange: { start: Date; end: Date }): Promise<any> {
    // Would fetch table data
    return { tableData: [] };
  }

  private async processAlertSummarySection(section: ReportSection, dataRange: { start: Date; end: Date }): Promise<any> {
    // Would fetch alerts
    return { alerts: [] };
  }

  private async renderKPISummary(kpis: any[]): Promise<any> {
    return { html: '<div class="kpi-summary">KPI Summary</div>' };
  }

  private async renderChart(chartData: any, visualization?: ReportSection['visualization']): Promise<any> {
    return { chartImage: Buffer.from('Mock chart image') };
  }

  private async renderTable(tableData: any[]): Promise<any> {
    return { tableHtml: '<table><tr><td>Mock table</td></tr></table>' };
  }

  private async renderAlertSummary(alerts: any[]): Promise<any> {
    return { html: '<div class="alert-summary">Alert Summary</div>' };
  }

  private extractDataSources(sections: ReportSection[]): string[] {
    return sections
      .map(s => s.dataSource?.type)
      .filter((ds): ds is 'kpi' | 'metrics' | 'sla' | 'cost' | 'custom_query' => !!ds);
  }

  private countProcessedRecords(sections: GeneratedReportSection[]): number {
    return sections.reduce((count, section) => {
      return count + (section.data.tableData?.length || 0) + (section.data.kpis?.length || 0);
    }, 0);
  }

  private generateHTMLContent(template: ReportTemplate, sections: GeneratedReportSection[], format: ReportFormat): string {
    const sectionsHtml = sections
      .map(section => section.renderedContent.html || '')
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${template.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .section { margin-bottom: 30px; }
            .kpi-summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>${template.name}</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          ${sectionsHtml}
        </body>
      </html>
    `;
  }

  private generateCSVContent(sections: GeneratedReportSection[]): string {
    // Extract tabular data from sections
    const rows: string[] = ['Section,Data'];
    
    sections.forEach(section => {
      if (section.data.kpis) {
        section.data.kpis.forEach(kpi => {
          rows.push(`${section.title},${kpi.name}: ${kpi.formattedValue}`);
        });
      }
    });
    
    return rows.join('\n');
  }

  private initializeBuiltInTemplates(): void {
    const executiveTemplate: ReportTemplate = {
      id: 'executive_summary',
      name: 'Executive Summary Report',
      description: 'High-level KPIs and business metrics for executives',
      category: 'executive',
      sections: [
        {
          id: 'kpi_summary',
          title: 'Key Performance Indicators',
          type: 'kpi_summary',
          dataSource: {
            type: 'kpi',
            configuration: { category: 'executive' }
          },
          order: 1
        },
        {
          id: 'alert_summary',
          title: 'Critical Alerts',
          type: 'alert_summary',
          dataSource: {
            type: 'custom_query',
            configuration: { severity: 'critical' }
          },
          order: 2
        }
      ],
      formats: [
        {
          type: 'pdf',
          configuration: {
            pageSize: 'A4',
            orientation: 'portrait',
            includeCharts: true,
            branding: {
              colors: { primary: '#1f2937', secondary: '#6b7280' }
            }
          }
        },
        {
          type: 'html',
          configuration: {
            includeCharts: true
          }
        }
      ],
      owner: 'system',
      tags: ['executive', 'summary', 'kpi'],
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(executiveTemplate.id, executiveTemplate);
  }
}

export default ReportGenerator;