// Core monitoring types
export type EventCategory = 'all' | 'user' | 'auth' | 'api' | 'payment' | 'dataset' | 'system' | 'security' | 'deployment' | 'error';
export type EventSeverity = 'all' | 'info' | 'warning' | 'error' | 'critical';
export type TimeRange = '1h' | '24h' | '7d' | '30d';
export type SystemHealth = 'healthy' | 'degraded' | 'critical' | 'checking';

export interface Event {
  id: string;
  timestamp: string;
  category: EventCategory;
  type: string;
  title: string;
  description: string;
  severity: EventSeverity;
  metadata?: Record<string, any>;
  timeAgo?: string;
  icon?: string;
  color?: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  actionRequired?: boolean;
  resolved?: boolean;
}

export interface SystemMetrics {
  systemHealth: SystemHealth;
  activeUsers: number;
  apiLatency: number;
  errorRate: number;
  lastUpdated: string;
  system?: {
    cpuUsage: string;
    memoryUsage: string;
    diskUsage?: string;
    uptime?: string;
  };
  api?: {
    requestsPerMinute: number;
    errorsLastHour: number;
    avgResponseTime: number;
  };
  oauth?: Record<string, 'operational' | 'degraded' | 'down'>;
  recentEvents: Event[];
}

export interface DashboardFilters {
  category: EventCategory;
  severity: EventSeverity;
  timeRange: TimeRange;
  searchQuery: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface MetricsResponse extends ApiResponse<SystemMetrics> {}
export interface AlertsResponse extends ApiResponse<{ alerts: Alert[] }> {}
export interface EventsResponse extends ApiResponse<{ events: Event[] }> {}

// Configuration types
export interface DashboardConfig {
  apiUrl: string;
  apiKey?: string;
  refreshInterval: number;
  enableRealtime: boolean;
  enableExport: boolean;
  enableAlerts: boolean;
  maxEvents: number;
  theme: ThemeConfig;
}

export interface ThemeConfig {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkMode: boolean;
}

// White-label customization
export interface BrandConfig {
  name: string;
  logo?: {
    url: string;
    width?: number;
    height?: number;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background?: string;
    text?: string;
  };
  fonts?: {
    heading: string;
    body: string;
  };
  customCss?: string;
}

// Data source types
export interface DataSourceConfig {
  id: string;
  name: string;
  type: 'crowdtrainer' | 'external' | 'webhook';
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  priority: number;
}

// Authentication types
export interface AuthConfig {
  requireApiKey: boolean;
  adminApiKey?: string;
  allowedOrigins: string[];
}

// Embed configuration
export interface EmbedConfig {
  allowedOrigins: string[];
  timeout: number;
  showHeader: boolean;
  showFilters: boolean;
  showExport: boolean;
  customCss?: string;
}

// Component props types
export interface MonitoringDashboardProps {
  config?: Partial<DashboardConfig>;
  embedMode?: boolean;
  brandConfig?: BrandConfig;
  onError?: (error: Error) => void;
}

export interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<any>;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  loading?: boolean;
}

export interface EventListProps {
  events: Event[];
  loading?: boolean;
  onEventClick?: (event: Event) => void;
  showCategory?: boolean;
  maxHeight?: string;
}

export interface AlertsPanelProps {
  alerts: Alert[];
  loading?: boolean;
  onAlertClick?: (alert: Alert) => void;
  maxAlerts?: number;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;