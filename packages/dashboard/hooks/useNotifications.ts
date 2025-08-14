'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useNotifications as useNotificationContext } from '../components/notifications/NotificationProvider';
import { Event, Alert } from '../types/monitoring';

// Hook for convenient notification triggering with smart detection
export const useNotifications = () => {
  return useNotificationContext();
};

// Hook for auto-detecting errors from monitoring data
export const useErrorDetection = () => {
  const { notifyFromEvent, notifyFromAlert, settings } = useNotificationContext();
  const lastEventIds = useRef<Set<string>>(new Set());
  const lastAlertIds = useRef<Set<string>>(new Set());

  // Auto-detect new events and create notifications
  const processEvents = useCallback((events: Event[]) => {
    if (!settings.enabled) return;

    events.forEach(event => {
      // Only notify for new events we haven't seen
      if (!lastEventIds.current.has(event.id)) {
        lastEventIds.current.add(event.id);
        
        // Only notify for errors and warnings by default
        if (['error', 'critical', 'warning'].includes(event.severity)) {
          notifyFromEvent(event);
        }
      }
    });

    // Clean up old event IDs to prevent memory leaks
    if (lastEventIds.current.size > 1000) {
      const eventIds = Array.from(lastEventIds.current);
      lastEventIds.current = new Set(eventIds.slice(-500));
    }
  }, [notifyFromEvent, settings.enabled]);

  // Auto-detect new alerts and create notifications
  const processAlerts = useCallback((alerts: Alert[]) => {
    if (!settings.enabled) return;

    alerts.forEach(alert => {
      // Only notify for new alerts we haven't seen
      if (!lastAlertIds.current.has(alert.id)) {
        lastAlertIds.current.add(alert.id);
        notifyFromAlert(alert);
      }
    });

    // Clean up old alert IDs to prevent memory leaks
    if (lastAlertIds.current.size > 1000) {
      const alertIds = Array.from(lastAlertIds.current);
      lastAlertIds.current = new Set(alertIds.slice(-500));
    }
  }, [notifyFromAlert, settings.enabled]);

  return {
    processEvents,
    processAlerts,
  };
};

// Hook for system health monitoring notifications
export const useSystemHealthNotifications = () => {
  const { addNotification, settings } = useNotificationContext();
  const lastHealthStatus = useRef<string>('');

  const checkSystemHealth = useCallback((health: string, metrics?: any) => {
    if (!settings.enabled || health === lastHealthStatus.current) return;

    const previousHealth = lastHealthStatus.current;
    lastHealthStatus.current = health;

    // Don't notify on initial load
    if (!previousHealth) return;

    switch (health) {
      case 'critical':
        addNotification({
          title: 'System Critical',
          message: 'System health has degraded to critical level. Immediate attention required.',
          type: 'critical',
          source: 'system',
          priority: 5,
          metadata: { previousHealth, currentHealth: health, metrics },
          action: {
            label: 'View Details',
            onClick: () => console.log('Navigate to system health details'),
          },
        });
        break;
        
      case 'degraded':
        if (previousHealth === 'healthy') {
          addNotification({
            title: 'System Degraded',
            message: 'System performance has degraded. Monitoring closely.',
            type: 'warning',
            source: 'system',
            priority: 3,
            metadata: { previousHealth, currentHealth: health, metrics },
          });
        }
        break;
        
      case 'healthy':
        if (['critical', 'degraded'].includes(previousHealth)) {
          addNotification({
            title: 'System Recovered',
            message: 'System health has returned to normal.',
            type: 'success',
            source: 'system',
            priority: 2,
            metadata: { previousHealth, currentHealth: health, metrics },
          });
        }
        break;
    }
  }, [addNotification, settings.enabled]);

  return { checkSystemHealth };
};

// Hook for performance threshold notifications
export const usePerformanceNotifications = () => {
  const { addNotification, settings } = useNotificationContext();
  const lastNotifications = useRef<Map<string, number>>(new Map());

  const checkPerformanceThresholds = useCallback((metrics: {
    apiLatency?: number;
    errorRate?: number;
    activeUsers?: number;
    cpuUsage?: number;
    memoryUsage?: number;
  }) => {
    if (!settings.enabled) return;

    const now = Date.now();
    const throttleDelay = 60000; // 1 minute throttle

    // API Latency check
    if (metrics.apiLatency && metrics.apiLatency > 1000) {
      const key = 'api-latency';
      const lastNotified = lastNotifications.current.get(key) || 0;
      
      if (now - lastNotified > throttleDelay) {
        lastNotifications.current.set(key, now);
        addNotification({
          title: 'High API Latency',
          message: `API response time is ${metrics.apiLatency}ms, above normal threshold.`,
          type: metrics.apiLatency > 5000 ? 'error' : 'warning',
          source: 'system',
          priority: metrics.apiLatency > 5000 ? 4 : 3,
          metadata: { latency: metrics.apiLatency, threshold: 1000 },
        });
      }
    }

    // Error Rate check
    if (metrics.errorRate && metrics.errorRate > 5) {
      const key = 'error-rate';
      const lastNotified = lastNotifications.current.get(key) || 0;
      
      if (now - lastNotified > throttleDelay) {
        lastNotifications.current.set(key, now);
        addNotification({
          title: 'High Error Rate',
          message: `Error rate is ${metrics.errorRate}%, above acceptable threshold.`,
          type: metrics.errorRate > 15 ? 'critical' : 'error',
          source: 'system',
          priority: metrics.errorRate > 15 ? 5 : 4,
          metadata: { errorRate: metrics.errorRate, threshold: 5 },
        });
      }
    }

    // CPU Usage check
    if (metrics.cpuUsage && metrics.cpuUsage > 80) {
      const key = 'cpu-usage';
      const lastNotified = lastNotifications.current.get(key) || 0;
      
      if (now - lastNotified > throttleDelay) {
        lastNotifications.current.set(key, now);
        addNotification({
          title: 'High CPU Usage',
          message: `CPU usage is ${metrics.cpuUsage}%, system may be under stress.`,
          type: metrics.cpuUsage > 95 ? 'critical' : 'warning',
          source: 'system',
          priority: metrics.cpuUsage > 95 ? 5 : 3,
          metadata: { cpuUsage: metrics.cpuUsage, threshold: 80 },
        });
      }
    }

    // Memory Usage check
    if (metrics.memoryUsage && metrics.memoryUsage > 85) {
      const key = 'memory-usage';
      const lastNotified = lastNotifications.current.get(key) || 0;
      
      if (now - lastNotified > throttleDelay) {
        lastNotifications.current.set(key, now);
        addNotification({
          title: 'High Memory Usage',
          message: `Memory usage is ${metrics.memoryUsage}%, approaching limit.`,
          type: metrics.memoryUsage > 95 ? 'critical' : 'warning',
          source: 'system',
          priority: metrics.memoryUsage > 95 ? 5 : 3,
          metadata: { memoryUsage: metrics.memoryUsage, threshold: 85 },
        });
      }
    }
  }, [addNotification, settings.enabled]);

  return { checkPerformanceThresholds };
};

// Hook for OAuth health monitoring
export const useOAuthHealthNotifications = () => {
  const { addNotification, settings } = useNotificationContext();
  const lastOAuthStatus = useRef<Record<string, string>>({});

  const checkOAuthHealth = useCallback((oauthStatus: Record<string, 'operational' | 'degraded' | 'down'>) => {
    if (!settings.enabled) return;

    Object.entries(oauthStatus).forEach(([provider, status]) => {
      const lastStatus = lastOAuthStatus.current[provider];
      
      if (lastStatus && lastStatus !== status) {
        switch (status) {
          case 'down':
            addNotification({
              title: `${provider} OAuth Down`,
              message: `${provider} authentication service is currently unavailable.`,
              type: 'critical',
              source: 'system',
              priority: 5,
              metadata: { provider, status, previousStatus: lastStatus },
              action: {
                label: 'View Status',
                onClick: () => console.log(`Check ${provider} status page`),
              },
            });
            break;
            
          case 'degraded':
            if (lastStatus === 'operational') {
              addNotification({
                title: `${provider} OAuth Degraded`,
                message: `${provider} authentication service is experiencing issues.`,
                type: 'warning',
                source: 'system',
                priority: 3,
                metadata: { provider, status, previousStatus: lastStatus },
              });
            }
            break;
            
          case 'operational':
            if (['down', 'degraded'].includes(lastStatus)) {
              addNotification({
                title: `${provider} OAuth Restored`,
                message: `${provider} authentication service has been restored.`,
                type: 'success',
                source: 'system',
                priority: 2,
                metadata: { provider, status, previousStatus: lastStatus },
              });
            }
            break;
        }
      }
      
      lastOAuthStatus.current[provider] = status;
    });
  }, [addNotification, settings.enabled]);

  return { checkOAuthHealth };
};

// Hook for custom notification triggers with smart batching
export const useSmartNotifications = () => {
  const { addNotification, settings } = useNotificationContext();
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const pendingNotifications = useRef<Array<Parameters<typeof addNotification>[0]>>([]);

  // Batch similar notifications to prevent spam
  const addBatchedNotification = useCallback((notification: Parameters<typeof addNotification>[0]) => {
    if (!settings.enabled) return;

    pendingNotifications.current.push(notification);

    // Clear existing timeout
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    // Set new timeout to process batch
    batchTimeout.current = setTimeout(() => {
      const notifications = pendingNotifications.current;
      pendingNotifications.current = [];

      if (notifications.length === 1) {
        // Single notification, send as-is
        addNotification(notifications[0]);
      } else if (notifications.length > 1) {
        // Multiple notifications, create a summary
        const types = [...new Set(notifications.map(n => n.type))];
        const priority = Math.max(...notifications.map(n => n.priority || 1));
        
        addNotification({
          title: `${notifications.length} New Issues`,
          message: `${notifications.length} issues detected: ${notifications.map(n => n.title).join(', ')}`,
          type: types.includes('critical') ? 'critical' : types.includes('error') ? 'error' : 'warning',
          source: 'system',
          priority,
          metadata: { batchedNotifications: notifications },
          action: {
            label: 'View All',
            onClick: () => console.log('Open notification center'),
          },
        });
      }
    }, 2000); // 2 second batch window
  }, [addNotification, settings.enabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
    };
  }, []);

  return { addBatchedNotification };
};

export default useNotifications;