import React, { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import {
  Incident,
  Component,
  ComponentStatus,
  IncidentStatus,
  IncidentSeverity,
  TimelineEvent,
  IncidentManagementConfig,
} from '../types';

interface StatusPageProps {
  config: IncidentManagementConfig;
  isPublic?: boolean;
  embedded?: boolean;
  theme?: 'light' | 'dark' | 'custom';
}

interface StatusPageData {
  overallStatus: 'operational' | 'issues' | 'outage';
  components: Component[];
  activeIncidents: Incident[];
  recentIncidents: Incident[];
  maintenanceWindows: MaintenanceWindow[];
  uptime: UptimeData;
  lastUpdated: Date;
}

interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  affectedComponents: string[];
  status: 'scheduled' | 'in-progress' | 'completed';
}

interface UptimeData {
  period: '90d' | '30d' | '7d' | '24h';
  percentage: number;
  incidents: number;
  downtime: number; // minutes
}

export const StatusPage: React.FC<StatusPageProps> = ({
  config,
  isPublic = true,
  embedded = false,
  theme = 'light',
}) => {
  const [data, setData] = useState<StatusPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'90d' | '30d' | '7d' | '24h'>('30d');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [showSubscribeForm, setShowSubscribeForm] = useState(false);

  // Fetch status page data
  useEffect(() => {
    fetchStatusData();
    const interval = setInterval(fetchStatusData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const fetchStatusData = async () => {
    try {
      const response = await fetch(`/api/status${isPublic ? '/public' : ''}?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch status data');
      }
      const statusData = await response.json();
      setData(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-500';
      case 'issues':
        return 'bg-yellow-500';
      case 'outage':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getOverallStatusText = (status: string) => {
    switch (status) {
      case 'operational':
        return 'All Systems Operational';
      case 'issues':
        return 'Some Systems Experiencing Issues';
      case 'outage':
        return 'System Outage';
      default:
        return 'Status Unknown';
    }
  };

  const getComponentStatusColor = (status: ComponentStatus) => {
    switch (status) {
      case ComponentStatus.OPERATIONAL:
        return 'bg-green-500';
      case ComponentStatus.DEGRADED_PERFORMANCE:
        return 'bg-yellow-500';
      case ComponentStatus.PARTIAL_OUTAGE:
        return 'bg-orange-500';
      case ComponentStatus.MAJOR_OUTAGE:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getComponentStatusText = (status: ComponentStatus) => {
    switch (status) {
      case ComponentStatus.OPERATIONAL:
        return 'Operational';
      case ComponentStatus.DEGRADED_PERFORMANCE:
        return 'Degraded Performance';
      case ComponentStatus.PARTIAL_OUTAGE:
        return 'Partial Outage';
      case ComponentStatus.MAJOR_OUTAGE:
        return 'Major Outage';
      default:
        return 'Unknown';
    }
  };

  const getIncidentSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case IncidentSeverity.P1_CRITICAL:
        return 'bg-red-500';
      case IncidentSeverity.P2_HIGH:
        return 'bg-orange-500';
      case IncidentSeverity.P3_MEDIUM:
        return 'bg-yellow-500';
      case IncidentSeverity.P4_LOW:
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/status/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscriberEmail }),
      });

      if (response.ok) {
        setSubscriberEmail('');
        setShowSubscribeForm(false);
        alert('Successfully subscribed to status updates!');
      } else {
        throw new Error('Failed to subscribe');
      }
    } catch (error) {
      alert('Failed to subscribe. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to load status</h2>
          <p className="text-gray-600">{error || 'No data available'}</p>
          <button
            onClick={fetchStatusData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const containerClass = embedded 
    ? "w-full" 
    : "min-h-screen bg-gray-50";

  const contentClass = embedded 
    ? "p-4" 
    : "max-w-6xl mx-auto px-4 py-8";

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {/* Header */}
        {!embedded && (
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              System Status
            </h1>
            <p className="text-gray-600">
              Current status of our systems and services
            </p>
          </header>
        )}

        {/* Overall Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getOverallStatusColor(data.overallStatus)}`} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {getOverallStatusText(data.overallStatus)}
                </h2>
                <p className="text-gray-600">
                  Last updated: {formatDistanceToNow(new Date(data.lastUpdated))} ago
                </p>
              </div>
            </div>
            
            {!embedded && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSubscribeForm(!showSubscribeForm)}
                  className="px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                >
                  Subscribe to Updates
                </button>
                <button
                  onClick={fetchStatusData}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Subscribe Form */}
        {showSubscribeForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Subscribe to Status Updates</h3>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                value={subscriberEmail}
                onChange={(e) => setSubscriberEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Subscribe
              </button>
            </form>
          </div>
        )}

        {/* Active Incidents */}
        {data.activeIncidents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
              Active Incidents
            </h3>
            <div className="space-y-4">
              {data.activeIncidents.map(incident => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Maintenance */}
        {data.maintenanceWindows.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              Scheduled Maintenance
            </h3>
            <div className="space-y-4">
              {data.maintenanceWindows.map(maintenance => (
                <MaintenanceCard key={maintenance.id} maintenance={maintenance} />
              ))}
            </div>
          </div>
        )}

        {/* Component Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">System Components</h3>
          <div className="space-y-3">
            {data.components.map(component => (
              <div key={component.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div>
                  <h4 className="font-medium text-gray-900">{component.name}</h4>
                  {component.description && (
                    <p className="text-sm text-gray-600">{component.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getComponentStatusColor(component.status)}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {getComponentStatusText(component.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Uptime Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Uptime Statistics</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['24h', '7d', '30d', '90d'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectedPeriod === period
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {data.uptime.percentage.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {data.uptime.incidents}
              </div>
              <div className="text-sm text-gray-600">Incidents</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {Math.round(data.uptime.downtime)}m
              </div>
              <div className="text-sm text-gray-600">Downtime</div>
            </div>
          </div>

          {/* Uptime Bar Chart */}
          <div className="mt-6">
            <UptimeChart period={selectedPeriod} />
          </div>
        </div>

        {/* Recent Incidents */}
        {data.recentIncidents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Incidents</h3>
            <div className="space-y-4">
              {data.recentIncidents.slice(0, 5).map(incident => (
                <IncidentCard key={incident.id} incident={incident} showTimestamp />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {!embedded && (
          <footer className="text-center mt-12 pt-8 border-t border-gray-200">
            <p className="text-gray-600">
              For technical support, please contact our{' '}
              <a href="/support" className="text-blue-600 hover:underline">
                support team
              </a>
            </p>
          </footer>
        )}
      </div>
    </div>
  );
};

// Incident Card Component
const IncidentCard: React.FC<{
  incident: Incident;
  showTimestamp?: boolean;
}> = ({ incident, showTimestamp = false }) => {
  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case IncidentSeverity.P1_CRITICAL:
        return 'bg-red-100 text-red-800 border-red-200';
      case IncidentSeverity.P2_HIGH:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case IncidentSeverity.P3_MEDIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case IncidentSeverity.P4_LOW:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case IncidentStatus.INVESTIGATING:
        return 'bg-red-100 text-red-800';
      case IncidentStatus.IDENTIFIED:
        return 'bg-orange-100 text-orange-800';
      case IncidentStatus.MONITORING:
        return 'bg-yellow-100 text-yellow-800';
      case IncidentStatus.RESOLVED:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900">{incident.title}</h4>
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
            {incident.severity.replace('_', ' ')}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
            {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
          </span>
        </div>
      </div>
      
      <p className="text-gray-600 text-sm mb-2">{incident.description}</p>
      
      {showTimestamp && (
        <p className="text-xs text-gray-500">
          {format(new Date(incident.createdAt), 'MMM dd, yyyy HH:mm')}
          {incident.resolvedAt && (
            <span> - Resolved {formatDistanceToNow(new Date(incident.resolvedAt))} ago</span>
          )}
        </p>
      )}
    </div>
  );
};

// Maintenance Card Component
const MaintenanceCard: React.FC<{
  maintenance: MaintenanceWindow;
}> = ({ maintenance }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900">{maintenance.title}</h4>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(maintenance.status)}`}>
          {maintenance.status.charAt(0).toUpperCase() + maintenance.status.slice(1)}
        </span>
      </div>
      
      <p className="text-gray-600 text-sm mb-2">{maintenance.description}</p>
      
      <div className="text-xs text-gray-500">
        <p>
          Scheduled: {format(new Date(maintenance.scheduledStart), 'MMM dd, yyyy HH:mm')} - {format(new Date(maintenance.scheduledEnd), 'HH:mm')}
        </p>
        {maintenance.affectedComponents.length > 0 && (
          <p>Affected: {maintenance.affectedComponents.join(', ')}</p>
        )}
      </div>
    </div>
  );
};

// Uptime Chart Component
const UptimeChart: React.FC<{
  period: '90d' | '30d' | '7d' | '24h';
}> = ({ period }) => {
  const [chartData, setChartData] = useState<{ date: string; uptime: number }[]>([]);

  useEffect(() => {
    // Generate mock uptime data - in production, fetch from API
    const days = period === '90d' ? 90 : period === '30d' ? 30 : period === '7d' ? 7 : 1;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const uptime = Math.random() * 5 + 95; // 95-100% uptime
      data.push({
        date: format(date, period === '24h' ? 'HH:mm' : 'MMM dd'),
        uptime,
      });
    }
    
    setChartData(data);
  }, [period]);

  return (
    <div className="h-20">
      <div className="flex items-end justify-between h-full gap-1">
        {chartData.map((point, index) => (
          <div
            key={index}
            className="flex-1 relative group cursor-pointer"
          >
            <div
              className={`w-full rounded-t transition-colors ${
                point.uptime >= 99.5 ? 'bg-green-500' :
                point.uptime >= 95 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{
                height: `${Math.max((point.uptime - 90) * 3, 5)}%`,
              }}
            />
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {point.date}: {point.uptime.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{chartData[0]?.date}</span>
        {chartData.length > 10 && (
          <span>{chartData[Math.floor(chartData.length / 2)]?.date}</span>
        )}
        <span>{chartData[chartData.length - 1]?.date}</span>
      </div>
    </div>
  );
};

// Status Page API Handler (Express.js)
export class StatusPageAPI {
  private redis: any;
  private config: IncidentManagementConfig;

  constructor(redis: any, config: IncidentManagementConfig) {
    this.redis = redis;
    this.config = config;
  }

  async getStatusPageData(period: string = '30d', isPublic: boolean = true): Promise<StatusPageData> {
    // Get current incidents
    const activeIncidents = await this.getActiveIncidents();
    const recentIncidents = await this.getRecentIncidents(period);
    
    // Get components status
    const components = await this.getComponentsStatus();
    
    // Get maintenance windows
    const maintenanceWindows = await this.getMaintenanceWindows();
    
    // Calculate overall status
    const overallStatus = this.calculateOverallStatus(components, activeIncidents);
    
    // Get uptime data
    const uptime = await this.getUptimeData(period);

    return {
      overallStatus,
      components,
      activeIncidents: isPublic ? this.filterPublicIncidents(activeIncidents) : activeIncidents,
      recentIncidents: isPublic ? this.filterPublicIncidents(recentIncidents) : recentIncidents,
      maintenanceWindows,
      uptime,
      lastUpdated: new Date(),
    };
  }

  private async getActiveIncidents(): Promise<Incident[]> {
    const allIncidents = await this.redis.hgetall('incidents');
    const incidents: Incident[] = [];

    for (const [id, data] of Object.entries(allIncidents)) {
      if (typeof data === 'string') {
        const incident: Incident = JSON.parse(data);
        if (incident.status !== IncidentStatus.RESOLVED) {
          incidents.push(incident);
        }
      }
    }

    return incidents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private async getRecentIncidents(period: string): Promise<Incident[]> {
    const allIncidents = await this.redis.hgetall('incidents');
    const incidents: Incident[] = [];
    const cutoffDate = this.getPeriodCutoff(period);

    for (const [id, data] of Object.entries(allIncidents)) {
      if (typeof data === 'string') {
        const incident: Incident = JSON.parse(data);
        if (new Date(incident.createdAt) >= cutoffDate) {
          incidents.push(incident);
        }
      }
    }

    return incidents
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  private async getComponentsStatus(): Promise<Component[]> {
    // Get from config or Redis
    return this.config.statusPage.components || [];
  }

  private async getMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    const maintenanceData = await this.redis.hgetall('maintenance_windows') || {};
    const windows: MaintenanceWindow[] = [];

    for (const [id, data] of Object.entries(maintenanceData)) {
      if (typeof data === 'string') {
        const window: MaintenanceWindow = JSON.parse(data);
        
        // Only show future or current maintenance
        if (new Date(window.scheduledEnd) >= new Date()) {
          windows.push(window);
        }
      }
    }

    return windows.sort((a, b) => 
      new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
    );
  }

  private calculateOverallStatus(components: Component[], incidents: Incident[]): 'operational' | 'issues' | 'outage' {
    // Check for critical incidents
    const hasCriticalIncident = incidents.some(i => i.severity === IncidentSeverity.P1_CRITICAL);
    if (hasCriticalIncident) return 'outage';

    // Check component status
    const hasOutage = components.some(c => c.status === ComponentStatus.MAJOR_OUTAGE);
    if (hasOutage) return 'outage';

    const hasIssues = components.some(c => 
      c.status === ComponentStatus.PARTIAL_OUTAGE || 
      c.status === ComponentStatus.DEGRADED_PERFORMANCE
    ) || incidents.length > 0;

    return hasIssues ? 'issues' : 'operational';
  }

  private async getUptimeData(period: string): Promise<UptimeData> {
    // Calculate uptime based on incidents in the period
    const cutoffDate = this.getPeriodCutoff(period);
    const incidents = await this.getRecentIncidents(period);
    
    const totalMinutes = (Date.now() - cutoffDate.getTime()) / (1000 * 60);
    const downtimeMinutes = incidents.reduce((total, incident) => {
      if (incident.resolvedAt) {
        const start = Math.max(new Date(incident.createdAt).getTime(), cutoffDate.getTime());
        const end = new Date(incident.resolvedAt).getTime();
        return total + (end - start) / (1000 * 60);
      }
      return total;
    }, 0);

    const uptime = ((totalMinutes - downtimeMinutes) / totalMinutes) * 100;

    return {
      period: period as UptimeData['period'],
      percentage: Math.max(uptime, 0),
      incidents: incidents.length,
      downtime: downtimeMinutes,
    };
  }

  private filterPublicIncidents(incidents: Incident[]): Incident[] {
    // Filter out internal incidents for public status page
    return incidents.filter(incident => 
      !incident.tags.includes('internal') &&
      !incident.tags.includes('private')
    );
  }

  private getPeriodCutoff(period: string): Date {
    const now = new Date();
    switch (period) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}

export default StatusPage;