import { 
  SystemMetrics, 
  Alert, 
  Event, 
  ApiResponse, 
  MetricsResponse, 
  AlertsResponse, 
  EventsResponse,
  DashboardConfig,
  DataSourceConfig
} from '@/types/monitoring';

export class ApiClient {
  private baseUrl: string;
  private apiKey?: string;
  private headers: Record<string, string>;

  constructor(config: Pick<DashboardConfig, 'apiUrl' | 'apiKey'>) {
    // Ensure baseUrl doesn't have /api suffix since we add it in endpoints
    this.baseUrl = config.apiUrl.replace(/\/api\/?$/, '');
    this.apiKey = config.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-API-Key': this.apiKey }),
    };
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Use absolute URL directly to bypass Next.js routing
      const url = `${this.baseUrl}${endpoint}`;
      console.log('Making request to:', url);
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getMetrics(): Promise<MetricsResponse> {
    return this.request<SystemMetrics>('/api/v1/dashboard/realtime');
  }

  async getAlerts(): Promise<AlertsResponse> {
    const response = await this.request<{ alerts: Alert[] }>('/api/v1/alerts');
    return response;
  }

  async getEvents(params?: {
    category?: string;
    severity?: string;
    timeRange?: string;
    limit?: number;
    offset?: number;
  }): Promise<EventsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== 'all') {
      searchParams.append('category', params.category);
    }
    if (params?.severity && params.severity !== 'all') {
      searchParams.append('severity', params.severity);
    }
    if (params?.timeRange) {
      searchParams.append('timeRange', params.timeRange);
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params?.offset) {
      searchParams.append('offset', params.offset.toString());
    }

    const query = searchParams.toString();
    const endpoint = `/api/v1/events${query ? `?${query}` : ''}`;
    
    return this.request<{ events: Event[] }>(endpoint);
  }

  async acknowledgeAlert(alertId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/v1/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
  }

  async testConnection(): Promise<ApiResponse<{ status: string }>> {
    return this.request('/health');
  }

  // OAuth specific endpoints
  async getOAuthStatus(): Promise<ApiResponse<Record<string, string>>> {
    return this.request('/api/v1/oauth/status');
  }

  async getOAuthAnalytics(): Promise<ApiResponse<any>> {
    return this.request('/api/v1/oauth/analytics');
  }

  // Performance metrics
  async getPerformanceMetrics(): Promise<ApiResponse<any>> {
    return this.request('/api/v1/metrics/performance');
  }

  // System health check
  async getSystemHealth(): Promise<ApiResponse<any>> {
    return this.request('/api/v1/admin/health');
  }
}

// Multi-source data aggregator
export class MultiSourceApiClient {
  private sources: Map<string, ApiClient> = new Map();
  private primarySource?: string;

  constructor(sources: DataSourceConfig[]) {
    sources.forEach(source => {
      if (source.enabled) {
        const client = new ApiClient({
          apiUrl: source.endpoint,
          apiKey: source.apiKey,
        });
        this.sources.set(source.id, client);
        
        if (source.priority === 1 || !this.primarySource) {
          this.primarySource = source.id;
        }
      }
    });
  }

  async getAggregatedMetrics(): Promise<SystemMetrics | null> {
    const promises = Array.from(this.sources.entries()).map(async ([sourceId, client]) => {
      try {
        const response = await client.getMetrics();
        return { sourceId, metrics: response.data, success: response.success };
      } catch (error) {
        console.error(`Failed to fetch metrics from ${sourceId}:`, error);
        return { sourceId, metrics: null, success: false };
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r.success && r.metrics);

    if (successfulResults.length === 0) {
      return null;
    }

    // Use primary source if available, otherwise first successful source
    const primaryResult = successfulResults.find(r => r.sourceId === this.primarySource);
    const selectedResult = primaryResult || successfulResults[0];

    return selectedResult.metrics;
  }

  async getAggregatedAlerts(): Promise<Alert[]> {
    const promises = Array.from(this.sources.entries()).map(async ([sourceId, client]) => {
      try {
        const response = await client.getAlerts();
        return response.data?.alerts || [];
      } catch (error) {
        console.error(`Failed to fetch alerts from ${sourceId}:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    return results.flat().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getAggregatedEvents(params?: any): Promise<Event[]> {
    const promises = Array.from(this.sources.entries()).map(async ([sourceId, client]) => {
      try {
        const response = await client.getEvents(params);
        return response.data?.events || [];
      } catch (error) {
        console.error(`Failed to fetch events from ${sourceId}:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    return results.flat().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getSourceStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.sources.forEach((client, sourceId) => {
      // This would need to be implemented based on last successful request
      status[sourceId] = true; // Placeholder
    });
    return status;
  }
}

// Default API client factory
export function createApiClient(config?: Partial<DashboardConfig>): ApiClient {
  // Use the config passed in, which should come from defaultConfig in config.ts
  // The config.ts file properly handles environment variables
  if (!config?.apiUrl) {
    console.error('API URL not provided to createApiClient, using fallback');
    // Fallback but this shouldn't happen if config.ts is working
    return new ApiClient({
      apiUrl: 'http://localhost:4001',
      apiKey: config?.apiKey,
    });
  }
  
  return new ApiClient({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
  });
}

// Webhook client for real-time updates
export class WebhookClient {
  private eventSource?: EventSource;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private webhookUrl: string, private apiKey?: string) {}

  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = new URL(this.webhookUrl);
    if (this.apiKey) {
      url.searchParams.set('apiKey', this.apiKey);
    }

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onopen = () => {
      console.log('Webhook connection established');
    };

    this.eventSource.onerror = (error) => {
      console.error('Webhook connection error:', error);
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type || 'message', data);
      } catch (error) {
        console.error('Failed to parse webhook message:', error);
      }
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}