// Types and interfaces for executive dashboard components
// This provides TypeScript definitions for dashboard data structures

export interface ExecutiveKPI {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  category: 'availability' | 'performance' | 'business' | 'cost' | 'customer';
  description: string;
}

export interface BusinessMetric {
  name: string;
  current: number;
  previous: number;
  target: number;
  unit: string;
  change: number;
  changePercent: number;
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'warning' | 'critical' | 'down';
  availability: number;
  responseTime: number;
  errorRate: number;
  lastIncident?: Date;
  uptime: number; // days
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface RiskAlert {
  id: string;
  type: 'sla_breach' | 'capacity_limit' | 'cost_overrun' | 'security_incident' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  timeToAction?: number; // hours
  recommendedAction: string;
  timestamp: Date;
}

export interface ExecutiveDashboardData {
  kpis: ExecutiveKPI[];
  businessMetrics: BusinessMetric[];
  serviceHealth: ServiceHealth[];
  costBreakdown: CostBreakdown[];
  riskAlerts: RiskAlert[];
  summary: {
    totalServices: number;
    healthyServices: number;
    activeIncidents: number;
    monthlyBurn: number;
    customerSatisfaction: number;
    overallHealthScore: number;
  };
  timeRange: {
    start: Date;
    end: Date;
    period: '24h' | '7d' | '30d' | '90d';
  };
}

// Dashboard component prop types
export interface ExecutiveDashboardProps {
  data: ExecutiveDashboardData;
  onTimeRangeChange: (period: '24h' | '7d' | '30d' | '90d') => void;
  onRefresh: () => void;
}

export interface DashboardHeaderProps {
  summary: ExecutiveDashboardData['summary'];
  timeRange: string;
  onTimeRangeChange: (period: '24h' | '7d' | '30d' | '90d') => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
}

export interface KPIGridProps {
  kpis: ExecutiveKPI[];
}

export interface KPICardProps {
  kpi: ExecutiveKPI;
}

export interface BusinessMetricsCardsProps {
  metrics: BusinessMetric[];
}

export interface ServiceHealthGridProps {
  services: ServiceHealth[];
}

export interface CostBreakdownChartProps {
  costData: CostBreakdown[];
}

export interface RiskAlertsPanelProps {
  alerts: RiskAlert[];
}

export interface RiskAlertCardProps {
  alert: RiskAlert;
}

// Hook return type for dashboard data
export interface ExecutiveDashboardHook {
  data: ExecutiveDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Utility functions for dashboard data processing
export class ExecutiveDashboardUtils {
  static calculateHealthPercentage(healthyServices: number, totalServices: number): number {
    return totalServices > 0 ? (healthyServices / totalServices) * 100 : 0;
  }

  static getHealthStatus(percentage: number): 'excellent' | 'good' | 'needs-attention' {
    if (percentage >= 95) return 'excellent';
    if (percentage >= 85) return 'good';
    return 'needs-attention';
  }

  static calculateChangePercent(current: number, previous: number): number {
    return previous ? ((current - previous) / previous) * 100 : 0;
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  static formatPercentage(value: number, decimals: number = 1): string {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100);
  }

  static formatTimeToAction(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${Math.round(hours)} hours`;
    return `${Math.round(hours / 24)} days`;
  }

  static getStatusColor(status: ServiceHealth['status']): string {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      case 'down': return '#dc2626';
      default: return '#6b7280';
    }
  }

  static getSeverityColor(severity: RiskAlert['severity']): string {
    switch (severity) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return '#6b7280';
    }
  }

  static sortAlertsBySeverity(alerts: RiskAlert[]): RiskAlert[] {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return alerts.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }

  static groupKPIsByCategory(kpis: ExecutiveKPI[]): Record<string, ExecutiveKPI[]> {
    return kpis.reduce((acc, kpi) => {
      if (!acc[kpi.category]) acc[kpi.category] = [];
      acc[kpi.category].push(kpi);
      return acc;
    }, {} as Record<string, ExecutiveKPI[]>);
  }
}

// Factory functions for creating mock data
export class ExecutiveDashboardMockData {
  static createMockKPI(overrides: Partial<ExecutiveKPI> = {}): ExecutiveKPI {
    return {
      id: 'mock-kpi-' + Math.random().toString(36).substr(2, 9),
      name: 'Mock KPI',
      value: 95.5,
      previousValue: 93.2,
      target: 95,
      unit: '%',
      trend: 'up',
      status: 'good',
      category: 'performance',
      description: 'Mock KPI for testing',
      ...overrides
    };
  }

  static createMockServiceHealth(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
    return {
      serviceName: 'Mock Service',
      status: 'healthy',
      availability: 99.95,
      responseTime: 150,
      errorRate: 0.1,
      uptime: 30,
      ...overrides
    };
  }

  static createMockRiskAlert(overrides: Partial<RiskAlert> = {}): RiskAlert {
    return {
      id: 'mock-alert-' + Math.random().toString(36).substr(2, 9),
      type: 'performance_degradation',
      severity: 'medium',
      title: 'Mock Alert',
      description: 'Mock alert description',
      impact: 'Low impact on users',
      timeToAction: 4,
      recommendedAction: 'Monitor the situation',
      timestamp: new Date(),
      ...overrides
    };
  }

  static createMockDashboardData(): ExecutiveDashboardData {
    return {
      kpis: [
        this.createMockKPI({ name: 'System Availability', category: 'availability' }),
        this.createMockKPI({ name: 'Response Time', category: 'performance', value: 145, unit: 'ms' }),
        this.createMockKPI({ name: 'Monthly Revenue', category: 'business', value: 125000, unit: '$' })
      ],
      businessMetrics: [
        {
          name: 'Active Users',
          current: 15420,
          previous: 14850,
          target: 16000,
          unit: '',
          change: 570,
          changePercent: 3.8
        }
      ],
      serviceHealth: [
        this.createMockServiceHealth({ serviceName: 'API Gateway' }),
        this.createMockServiceHealth({ serviceName: 'Database', status: 'warning', availability: 99.1 })
      ],
      costBreakdown: [
        { category: 'Infrastructure', amount: 25000, percentage: 40, trend: 'stable' },
        { category: 'Personnel', amount: 30000, percentage: 48, trend: 'increasing' }
      ],
      riskAlerts: [
        this.createMockRiskAlert({ severity: 'high', title: 'High CPU Usage' })
      ],
      summary: {
        totalServices: 12,
        healthyServices: 10,
        activeIncidents: 1,
        monthlyBurn: 62500,
        customerSatisfaction: 4.2,
        overallHealthScore: 92
      },
      timeRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
        period: '24h'
      }
    };
  }
}

export default ExecutiveDashboardUtils;