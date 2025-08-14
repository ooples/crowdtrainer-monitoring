import { Event, Alert, SystemMetrics } from '@/types/monitoring';

// Demo events to simulate real monitoring data
export const demoEvents: Event[] = [
  {
    id: '1',
    title: 'User Registration',
    description: 'New user registered from Google OAuth',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    severity: 'low',
    category: 'auth',
    source: 'CrowdTrainer'
  },
  {
    id: '2',
    title: 'Payment Processed',
    description: 'Subscription payment completed via Stripe',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    severity: 'low',
    category: 'payment',
    source: 'CrowdTrainer'
  },
  {
    id: '3',
    title: 'API Rate Limit Warning',
    description: 'API rate limit approaching 80% threshold',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    severity: 'medium',
    category: 'api',
    source: 'API Gateway'
  },
  {
    id: '4',
    title: 'Database Query Slow',
    description: 'Query execution time exceeded 2 seconds',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    severity: 'high',
    category: 'performance',
    source: 'Database Monitor'
  },
  {
    id: '5',
    title: 'OAuth Provider Error',
    description: 'GitHub OAuth service temporary outage',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    severity: 'critical',
    category: 'auth',
    source: 'OAuth Service'
  },
  {
    id: '6',
    title: 'Memory Usage High',
    description: 'Server memory usage at 85%',
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    severity: 'high',
    category: 'system',
    source: 'System Monitor'
  },
  {
    id: '7',
    title: 'Security Alert',
    description: 'Multiple failed login attempts detected',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    severity: 'high',
    category: 'security',
    source: 'Security Monitor'
  },
  {
    id: '8',
    title: 'Deployment Successful',
    description: 'New version deployed to production',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    severity: 'low',
    category: 'system',
    source: 'CI/CD Pipeline'
  }
];

export const demoAlerts: Alert[] = [
  {
    id: 'alert-1',
    title: 'High Error Rate',
    description: 'Error rate exceeded 5% in the last hour',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    severity: 'high',
    status: 'active',
    source: 'Error Monitor'
  },
  {
    id: 'alert-2',
    title: 'API Response Time',
    description: 'Average API response time above 1000ms',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    severity: 'medium',
    status: 'acknowledged',
    source: 'Performance Monitor'
  }
];

export const demoMetrics: SystemMetrics = {
  systemHealth: 'operational',
  activeUsers: 1247,
  apiLatency: 342,
  errorRate: 2.3,
  lastUpdated: new Date().toISOString(),
  recentEvents: demoEvents,
  system: {
    cpuUsage: '23%',
    memoryUsage: '67%',
    diskUsage: '45%'
  },
  api: {
    requestsPerMinute: 3540,
    errorsLastHour: 12,
    averageResponseTime: 342
  },
  oauth: {
    google: 'operational',
    github: 'degraded'
  }
};

// Simulate real-time data updates
export function generateRealtimeEvent(): Event {
  const eventTypes = [
    { title: 'User Login', category: 'auth', severity: 'low' as const },
    { title: 'API Request', category: 'api', severity: 'low' as const },
    { title: 'Database Query', category: 'performance', severity: 'low' as const },
    { title: 'Payment Event', category: 'payment', severity: 'low' as const },
    { title: 'Error Occurred', category: 'error', severity: 'medium' as const },
    { title: 'Security Check', category: 'security', severity: 'low' as const }
  ];

  const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  
  return {
    id: `realtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: randomEvent.title,
    description: `${randomEvent.title} generated at ${new Date().toLocaleTimeString()}`,
    timestamp: new Date().toISOString(),
    severity: randomEvent.severity,
    category: randomEvent.category,
    source: 'Real-time Monitor'
  };
}

export function updateMetricsWithRealtimeData(currentMetrics: SystemMetrics): SystemMetrics {
  // Simulate changing metrics
  const newActiveUsers = currentMetrics.activeUsers + Math.floor(Math.random() * 20 - 10);
  const newApiLatency = Math.max(100, currentMetrics.apiLatency + Math.floor(Math.random() * 100 - 50));
  const newErrorRate = Math.max(0, currentMetrics.errorRate + (Math.random() - 0.5) * 1);

  // Occasionally add a new real-time event
  const shouldAddEvent = Math.random() < 0.3; // 30% chance
  const updatedEvents = shouldAddEvent 
    ? [generateRealtimeEvent(), ...currentMetrics.recentEvents].slice(0, 50) // Keep last 50 events
    : currentMetrics.recentEvents;

  return {
    ...currentMetrics,
    activeUsers: newActiveUsers,
    apiLatency: newApiLatency,
    errorRate: newErrorRate,
    lastUpdated: new Date().toISOString(),
    recentEvents: updatedEvents,
    system: {
      ...currentMetrics.system,
      cpuUsage: `${Math.max(5, Math.min(95, parseInt(currentMetrics.system?.cpuUsage || '50') + Math.floor(Math.random() * 10 - 5)))}%`,
      memoryUsage: `${Math.max(10, Math.min(90, parseInt(currentMetrics.system?.memoryUsage || '50') + Math.floor(Math.random() * 10 - 5)))}%`
    },
    api: {
      ...currentMetrics.api,
      requestsPerMinute: Math.max(0, (currentMetrics.api?.requestsPerMinute || 1000) + Math.floor(Math.random() * 200 - 100)),
      averageResponseTime: newApiLatency
    }
  };
}