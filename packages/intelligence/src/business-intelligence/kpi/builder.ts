import { EventEmitter } from 'events';

// Base types for KPI system
export interface DataSource {
  id: string;
  name: string;
  type: 'metrics' | 'logs' | 'traces' | 'events' | 'database' | 'api';
  connection: {
    endpoint?: string;
    credentials?: Record<string, string>;
    parameters?: Record<string, any>;
  };
  schema: DataFieldSchema[];
  refreshInterval: number; // seconds
  isActive: boolean;
}

export interface DataFieldSchema {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'date' | 'array' | 'object';
  description?: string;
  unit?: string;
  aggregatable: boolean;
  filterable: boolean;
  groupable: boolean;
}

export interface AggregationFunction {
  type: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'percentile' | 'rate' | 'growth';
  field: string;
  parameters?: Record<string, any>; // e.g., percentile: { value: 95 }
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value: any;
  logicalOperator?: 'and' | 'or';
}

export interface GroupByClause {
  field: string;
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month'; // for time-based grouping
}

export interface KPIQuery {
  dataSource: string;
  aggregation: AggregationFunction;
  filters: FilterCondition[];
  groupBy?: GroupByClause[];
  timeRange: {
    start: Date | string;
    end: Date | string;
    relative?: string; // e.g., "last_24_hours", "last_7_days"
  };
  limit?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'operational' | 'technical' | 'customer' | 'financial' | 'custom';
  
  // Query configuration
  query: KPIQuery;
  
  // Display configuration
  visualization: {
    type: 'number' | 'gauge' | 'chart' | 'table' | 'trend';
    format: {
      unit: string;
      decimals: number;
      prefix?: string;
      suffix?: string;
      formatStyle?: 'number' | 'currency' | 'percentage';
    };
    chartConfig?: {
      chartType: 'line' | 'bar' | 'pie' | 'area';
      xAxis?: string;
      yAxis?: string;
      colors?: string[];
    };
  };
  
  // Alerting configuration
  alerting?: {
    enabled: boolean;
    thresholds: {
      warning?: { operator: 'gt' | 'lt' | 'eq'; value: number };
      critical?: { operator: 'gt' | 'lt' | 'eq'; value: number };
    };
    channels: string[]; // slack, email, webhook
  };
  
  // Metadata
  owner: string;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Calculated/cached values
  lastValue?: number;
  lastCalculated?: Date;
  trend?: 'increasing' | 'decreasing' | 'stable';
  
  // Schedule for calculation
  refreshSchedule?: {
    enabled: boolean;
    interval: number; // seconds
    timezone?: string;
  };
}

export interface KPICalculationResult {
  kpiId: string;
  timestamp: Date;
  value: number;
  formattedValue: string;
  dataPoints?: Array<{
    timestamp: Date;
    value: number;
    dimensions?: Record<string, any>;
  }>;
  metadata: {
    executionTime: number;
    dataSourcesUsed: string[];
    recordsProcessed: number;
    cacheHit: boolean;
  };
}

export interface KPITemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  
  // Pre-configured KPI definition
  template: Omit<KPIDefinition, 'id' | 'name' | 'description' | 'owner' | 'createdAt' | 'updatedAt'>;
  
  // Variables that can be customized
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    description: string;
    defaultValue?: any;
    options?: any[]; // for select type
    required: boolean;
  }>;
  
  // Usage statistics
  usageCount: number;
  rating: number;
  tags: string[];
}

// Main KPI Builder class
export class KPIBuilder extends EventEmitter {
  private dataSources = new Map<string, DataSource>();
  private kpiDefinitions = new Map<string, KPIDefinition>();
  private templates = new Map<string, KPITemplate>();
  private calculationResults = new Map<string, KPICalculationResult[]>();
  private calculationSchedules = new Map<string, NodeJS.Timeout>();

  constructor(private config: {
    maxResultsPerKPI: number;
    defaultRefreshInterval: number;
    enableCaching: boolean;
    cacheExpirationMinutes: number;
  } = {
    maxResultsPerKPI: 1000,
    defaultRefreshInterval: 300, // 5 minutes
    enableCaching: true,
    cacheExpirationMinutes: 15
  }) {
    super();
    this.initializeBuiltInTemplates();
  }

  /**
   * Register a data source for KPI calculations
   */
  registerDataSource(dataSource: DataSource): void {
    this.dataSources.set(dataSource.id, dataSource);
    this.emit('data_source_registered', { dataSource });
  }

  /**
   * Create a KPI from a template with custom variables
   */
  createKPIFromTemplate(
    templateId: string,
    name: string,
    description: string,
    variables: Record<string, any>,
    owner: string
  ): KPIDefinition {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    const missingRequired = template.variables
      .filter(v => v.required && !(v.name in variables))
      .map(v => v.name);
    
    if (missingRequired.length > 0) {
      throw new Error(`Missing required variables: ${missingRequired.join(', ')}`);
    }

    // Apply variables to template
    const kpiDefinition: KPIDefinition = {
      id: this.generateKPIId(),
      name,
      description,
      owner,
      ...this.applyTemplateVariables(template.template, variables),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.createKPI(kpiDefinition);
  }

  /**
   * Create a custom KPI definition
   */
  createKPI(definition: KPIDefinition): KPIDefinition {
    // Validate the KPI definition
    this.validateKPIDefinition(definition);

    this.kpiDefinitions.set(definition.id, definition);
    
    // Start scheduled calculation if enabled
    if (definition.refreshSchedule?.enabled) {
      this.scheduleKPICalculation(definition.id);
    }

    this.emit('kpi_created', { kpi: definition });
    return definition;
  }

  /**
   * Update an existing KPI definition
   */
  updateKPI(kpiId: string, updates: Partial<KPIDefinition>): KPIDefinition {
    const existing = this.kpiDefinitions.get(kpiId);
    if (!existing) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.validateKPIDefinition(updated);
    this.kpiDefinitions.set(kpiId, updated);

    // Restart scheduling if refresh configuration changed
    if (updates.refreshSchedule !== undefined) {
      this.unscheduleKPICalculation(kpiId);
      if (updated.refreshSchedule?.enabled) {
        this.scheduleKPICalculation(kpiId);
      }
    }

    this.emit('kpi_updated', { kpi: updated, changes: updates });
    return updated;
  }

  /**
   * Delete a KPI definition
   */
  deleteKPI(kpiId: string): void {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    this.kpiDefinitions.delete(kpiId);
    this.calculationResults.delete(kpiId);
    this.unscheduleKPICalculation(kpiId);

    this.emit('kpi_deleted', { kpiId, kpi });
  }

  /**
   * Calculate KPI value and return result
   */
  async calculateKPI(kpiId: string, timeRange?: { start: Date; end: Date }): Promise<KPICalculationResult> {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const startTime = Date.now();
    
    try {
      // Build the query with optional time range override
      const query = timeRange 
        ? { ...kpi.query, timeRange: { start: timeRange.start, end: timeRange.end } }
        : kpi.query;

      // Execute the query
      const queryResult = await this.executeQuery(query);
      
      // Process the result
      const value = this.extractKPIValue(queryResult, kpi.query.aggregation);
      const formattedValue = this.formatKPIValue(value, kpi.visualization.format);

      const result: KPICalculationResult = {
        kpiId,
        timestamp: new Date(),
        value,
        formattedValue,
        dataPoints: queryResult.dataPoints,
        metadata: {
          executionTime: Date.now() - startTime,
          dataSourcesUsed: [query.dataSource],
          recordsProcessed: queryResult.recordCount || 0,
          cacheHit: queryResult.cacheHit || false
        }
      };

      // Store result
      this.storeCalculationResult(kpiId, result);

      // Update KPI with latest values
      await this.updateKPICalculatedValues(kpiId, result);

      this.emit('kpi_calculated', { result, kpi });
      return result;

    } catch (error) {
      this.emit('kpi_calculation_error', { kpiId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Get available KPI templates
   */
  getTemplates(category?: string): KPITemplate[] {
    const templates = Array.from(this.templates.values());
    return category 
      ? templates.filter(t => t.category === category)
      : templates;
  }

  /**
   * Get all KPI definitions
   */
  getKPIs(filters?: {
    category?: string;
    owner?: string;
    tags?: string[];
    isPublic?: boolean;
  }): KPIDefinition[] {
    let kpis = Array.from(this.kpiDefinitions.values());

    if (filters) {
      if (filters.category) {
        kpis = kpis.filter(kpi => kpi.category === filters.category);
      }
      if (filters.owner) {
        kpis = kpis.filter(kpi => kpi.owner === filters.owner);
      }
      if (filters.tags) {
        kpis = kpis.filter(kpi => 
          filters.tags!.some(tag => kpi.tags.includes(tag))
        );
      }
      if (filters.isPublic !== undefined) {
        kpis = kpis.filter(kpi => kpi.isPublic === filters.isPublic);
      }
    }

    return kpis;
  }

  /**
   * Get historical results for a KPI
   */
  getKPIHistory(
    kpiId: string, 
    timeRange: { start: Date; end: Date },
    limit?: number
  ): KPICalculationResult[] {
    const results = this.calculationResults.get(kpiId) || [];
    
    let filteredResults = results.filter(
      result => result.timestamp >= timeRange.start && result.timestamp <= timeRange.end
    );

    filteredResults.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      filteredResults = filteredResults.slice(0, limit);
    }

    return filteredResults;
  }

  /**
   * Validate data source connectivity
   */
  async testDataSource(dataSourceId: string): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
    sampleData?: any[];
  }> {
    const dataSource = this.dataSources.get(dataSourceId);
    if (!dataSource) {
      return { connected: false, error: 'Data source not found' };
    }

    const startTime = Date.now();
    
    try {
      // Test query - implementation would depend on data source type
      const sampleQuery: KPIQuery = {
        dataSource: dataSourceId,
        aggregation: { type: 'count', field: '*' },
        filters: [],
        timeRange: {
          start: new Date(Date.now() - 60000), // Last minute
          end: new Date()
        },
        limit: 5
      };

      const result = await this.executeQuery(sampleQuery);
      const latency = Date.now() - startTime;

      return {
        connected: true,
        latency,
        sampleData: result.dataPoints?.slice(0, 5)
      };

    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  // Private helper methods
  private validateKPIDefinition(definition: KPIDefinition): void {
    if (!definition.name || definition.name.trim().length === 0) {
      throw new Error('KPI name is required');
    }

    if (!this.dataSources.has(definition.query.dataSource)) {
      throw new Error(`Data source not found: ${definition.query.dataSource}`);
    }

    // Validate aggregation function
    const validAggregations = ['sum', 'avg', 'count', 'min', 'max', 'median', 'percentile', 'rate', 'growth'];
    if (!validAggregations.includes(definition.query.aggregation.type)) {
      throw new Error(`Invalid aggregation type: ${definition.query.aggregation.type}`);
    }

    // Validate visualization configuration
    const validVisualizationTypes = ['number', 'gauge', 'chart', 'table', 'trend'];
    if (!validVisualizationTypes.includes(definition.visualization.type)) {
      throw new Error(`Invalid visualization type: ${definition.visualization.type}`);
    }
  }

  private async executeQuery(query: KPIQuery): Promise<{
    dataPoints: Array<{ timestamp: Date; value: number; dimensions?: Record<string, any> }>;
    recordCount: number;
    cacheHit: boolean;
  }> {
    // This would be implemented based on your specific data sources
    // For now, returning mock data
    
    const dataSource = this.dataSources.get(query.dataSource);
    if (!dataSource) {
      throw new Error(`Data source not found: ${query.dataSource}`);
    }

    // Check cache first if enabled
    if (this.config.enableCaching) {
      const cachedResult = this.getCachedQueryResult(query);
      if (cachedResult) {
        return { ...cachedResult, cacheHit: true };
      }
    }

    // Execute actual query based on data source type
    let result;
    switch (dataSource.type) {
      case 'metrics':
        result = await this.executeMetricsQuery(query, dataSource);
        break;
      case 'database':
        result = await this.executeDatabaseQuery(query, dataSource);
        break;
      case 'api':
        result = await this.executeAPIQuery(query, dataSource);
        break;
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }

    // Cache the result
    if (this.config.enableCaching) {
      this.setCachedQueryResult(query, result);
    }

    return { ...result, cacheHit: false };
  }

  private extractKPIValue(
    queryResult: { dataPoints: Array<{ value: number }> },
    aggregation: AggregationFunction
  ): number {
    const values = queryResult.dataPoints.map(dp => dp.value);
    
    switch (aggregation.type) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'count':
        return values.length;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'median':
        if (values.length === 0) return 0;
        const sorted = values.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      case 'percentile':
        const percentile = aggregation.parameters?.value || 95;
        const sortedValues = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[Math.max(0, index)] || 0;
      default:
        return values[0] || 0;
    }
  }

  private formatKPIValue(value: number, format: KPIDefinition['visualization']['format']): string {
    let formattedValue: string;

    switch (format.formatStyle) {
      case 'currency':
        formattedValue = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals
        }).format(value);
        break;
      case 'percentage':
        formattedValue = new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals
        }).format(value / 100);
        break;
      default:
        formattedValue = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals
        }).format(value);
    }

    if (format.prefix) formattedValue = format.prefix + formattedValue;
    if (format.suffix) formattedValue = formattedValue + format.suffix;
    if (format.unit && !format.suffix) formattedValue = formattedValue + format.unit;

    return formattedValue;
  }

  private storeCalculationResult(kpiId: string, result: KPICalculationResult): void {
    if (!this.calculationResults.has(kpiId)) {
      this.calculationResults.set(kpiId, []);
    }

    const results = this.calculationResults.get(kpiId)!;
    results.push(result);

    // Maintain maximum results limit
    if (results.length > this.config.maxResultsPerKPI) {
      results.splice(0, results.length - this.config.maxResultsPerKPI);
    }

    this.calculationResults.set(kpiId, results);
  }

  private async updateKPICalculatedValues(kpiId: string, result: KPICalculationResult): Promise<void> {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi) return;

    // Calculate trend based on recent results
    const recentResults = this.calculationResults.get(kpiId) || [];
    const trend = this.calculateTrend(recentResults.slice(-10));

    const updatedKPI = {
      ...kpi,
      lastValue: result.value,
      lastCalculated: result.timestamp,
      trend
    };

    this.kpiDefinitions.set(kpiId, updatedKPI);
  }

  private calculateTrend(results: KPICalculationResult[]): 'increasing' | 'decreasing' | 'stable' {
    if (results.length < 2) return 'stable';

    const recent = results.slice(-5);
    const older = results.slice(-10, -5);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, r) => sum + r.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.value, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(changePercent) < 5) return 'stable';
    return changePercent > 0 ? 'increasing' : 'decreasing';
  }

  private scheduleKPICalculation(kpiId: string): void {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi?.refreshSchedule?.enabled) return;

    const interval = setInterval(async () => {
      try {
        await this.calculateKPI(kpiId);
      } catch (error) {
        console.error(`Scheduled KPI calculation failed for ${kpiId}:`, error);
      }
    }, kpi.refreshSchedule.interval * 1000);

    this.calculationSchedules.set(kpiId, interval);
  }

  private unscheduleKPICalculation(kpiId: string): void {
    const interval = this.calculationSchedules.get(kpiId);
    if (interval) {
      clearInterval(interval);
      this.calculationSchedules.delete(kpiId);
    }
  }

  private generateKPIId(): string {
    return `kpi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private applyTemplateVariables(template: any, variables: Record<string, any>): any {
    // Deep clone and replace variables in template
    const applied = JSON.parse(JSON.stringify(template));
    
    // This would recursively replace template variables
    // Implementation depends on your template variable syntax
    
    return applied;
  }

  // Mock implementations for different data source types
  private async executeMetricsQuery(query: KPIQuery, dataSource: DataSource): Promise<any> {
    // Implementation would connect to metrics store (Prometheus, InfluxDB, etc.)
    return { dataPoints: [], recordCount: 0 };
  }

  private async executeDatabaseQuery(query: KPIQuery, dataSource: DataSource): Promise<any> {
    // Implementation would execute SQL query
    return { dataPoints: [], recordCount: 0 };
  }

  private async executeAPIQuery(query: KPIQuery, dataSource: DataSource): Promise<any> {
    // Implementation would make HTTP requests
    return { dataPoints: [], recordCount: 0 };
  }

  private getCachedQueryResult(query: KPIQuery): any {
    // Implementation would check cache
    return null;
  }

  private setCachedQueryResult(query: KPIQuery, result: any): void {
    // Implementation would store in cache
  }

  private initializeBuiltInTemplates(): void {
    // Add common KPI templates
    const templates: KPITemplate[] = [
      {
        id: 'availability_sla',
        name: 'Service Availability SLA',
        description: 'Track service availability against SLA targets',
        category: 'operational',
        template: {
          category: 'operational',
          query: {
            dataSource: 'metrics',
            aggregation: { type: 'avg', field: 'availability' },
            filters: [],
            timeRange: { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date(), relative: 'last_24_hours' }
          },
          visualization: {
            type: 'gauge',
            format: { unit: '%', decimals: 2, formatStyle: 'percentage' }
          },
          alerting: {
            enabled: true,
            thresholds: {
              warning: { operator: 'lt', value: 99.5 },
              critical: { operator: 'lt', value: 99.0 }
            },
            channels: ['slack', 'email']
          },
          tags: [],
          isPublic: true
        },
        variables: [
          {
            name: 'service_name',
            type: 'string',
            description: 'Name of the service to monitor',
            required: true
          },
          {
            name: 'sla_target',
            type: 'number',
            description: 'SLA target percentage',
            defaultValue: 99.9,
            required: true
          }
        ],
        usageCount: 0,
        rating: 4.8,
        tags: ['sla', 'availability', 'monitoring']
      },
      {
        id: 'response_time_p95',
        name: 'Response Time 95th Percentile',
        description: 'Track 95th percentile response time',
        category: 'technical',
        template: {
          category: 'technical',
          query: {
            dataSource: 'metrics',
            aggregation: { type: 'percentile', field: 'response_time', parameters: { value: 95 } },
            filters: [],
            timeRange: { start: new Date(Date.now() - 60 * 60 * 1000), end: new Date(), relative: 'last_1_hour' }
          },
          visualization: {
            type: 'trend',
            format: { unit: 'ms', decimals: 0 }
          },
          tags: [],
          isPublic: true
        },
        variables: [
          {
            name: 'endpoint',
            type: 'string',
            description: 'API endpoint to monitor',
            required: false
          }
        ],
        usageCount: 0,
        rating: 4.5,
        tags: ['performance', 'latency', 'p95']
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }
}

export default KPIBuilder;