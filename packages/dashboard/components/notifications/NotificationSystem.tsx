'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellRing } from 'lucide-react';
import { NotificationProvider, useNotifications } from './NotificationProvider';
import { ToastContainer } from './NotificationToast';
import NotificationCenter from './NotificationCenter';
import { 
  useErrorDetection, 
  useSystemHealthNotifications, 
  usePerformanceNotifications,
  useOAuthHealthNotifications 
} from '../../hooks/useNotifications';

// Notification Bell Button Component
interface NotificationBellProps {
  className?: string;
  showBadge?: boolean;
  onClick?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  className = '',
  showBadge = true,
  onClick,
}) => {
  const { unreadCount, settings } = useNotifications();
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate bell when new notifications arrive
  useEffect(() => {
    if (unreadCount > 0) {
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [unreadCount]);

  if (!settings.enabled || !settings.showBadge) {
    return null;
  }

  return (
    <motion.button
      onClick={onClick}
      className={`
        relative p-2 rounded-lg transition-all duration-200
        hover:bg-white/10 active:scale-95
        ${className}
      `}
      animate={isAnimating ? { rotate: [0, -10, 10, -10, 0] } : {}}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {unreadCount > 0 ? (
        <BellRing className="w-5 h-5 text-blue-400" />
      ) : (
        <Bell className="w-5 h-5 text-gray-400" />
      )}
      
      {showBadge && unreadCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-semibold rounded-full px-1"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.div>
      )}
    </motion.button>
  );
};

// Auto-Detection Component - monitors data and triggers notifications
interface AutoDetectionProps {
  events?: any[];
  alerts?: any[];
  systemMetrics?: any;
  oauthStatus?: Record<string, 'operational' | 'degraded' | 'down'>;
}

const AutoDetection: React.FC<AutoDetectionProps> = ({
  events = [],
  alerts = [],
  systemMetrics,
  oauthStatus,
}) => {
  const { processEvents, processAlerts } = useErrorDetection();
  const { checkSystemHealth } = useSystemHealthNotifications();
  const { checkPerformanceThresholds } = usePerformanceNotifications();
  const { checkOAuthHealth } = useOAuthHealthNotifications();

  // Process events for notifications
  useEffect(() => {
    if (events.length > 0) {
      processEvents(events);
    }
  }, [events, processEvents]);

  // Process alerts for notifications
  useEffect(() => {
    if (alerts.length > 0) {
      processAlerts(alerts);
    }
  }, [alerts, processAlerts]);

  // Monitor system health
  useEffect(() => {
    if (systemMetrics?.systemHealth) {
      checkSystemHealth(systemMetrics.systemHealth, systemMetrics);
    }
  }, [systemMetrics?.systemHealth, checkSystemHealth, systemMetrics]);

  // Monitor performance metrics
  useEffect(() => {
    if (systemMetrics) {
      const performanceMetrics = {
        apiLatency: systemMetrics.apiLatency,
        errorRate: systemMetrics.errorRate,
        activeUsers: systemMetrics.activeUsers,
        cpuUsage: systemMetrics.system?.cpuUsage ? parseFloat(systemMetrics.system.cpuUsage) : undefined,
        memoryUsage: systemMetrics.system?.memoryUsage ? parseFloat(systemMetrics.system.memoryUsage) : undefined,
      };
      
      checkPerformanceThresholds(performanceMetrics);
    }
  }, [systemMetrics, checkPerformanceThresholds]);

  // Monitor OAuth health
  useEffect(() => {
    if (oauthStatus) {
      checkOAuthHealth(oauthStatus);
    }
  }, [oauthStatus, checkOAuthHealth]);

  return null; // This component only handles side effects
};

// Complete Notification System Component
interface NotificationSystemProps {
  // Data for auto-detection
  events?: any[];
  alerts?: any[];
  systemMetrics?: any;
  oauthStatus?: Record<string, 'operational' | 'degraded' | 'down'>;
  
  // UI configuration
  toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
  showBell?: boolean;
  bellClassName?: string;
  
  // Behavior
  enableAutoDetection?: boolean;
  defaultSettings?: any;
  storageKey?: string;
  
  // Children
  children?: React.ReactNode;
}

const NotificationSystemContent: React.FC<Omit<NotificationSystemProps, 'children'>> = ({
  events = [],
  alerts = [],
  systemMetrics,
  oauthStatus,
  toastPosition = 'top-right',
  maxToasts = 5,
  showBell = true,
  bellClassName = '',
  enableAutoDetection = true,
}) => {
  const [centerOpen, setCenterOpen] = useState(false);

  return (
    <>
      {/* Auto-detection system */}
      {enableAutoDetection && (
        <AutoDetection
          events={events}
          alerts={alerts}
          systemMetrics={systemMetrics}
          oauthStatus={oauthStatus}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer 
        position={toastPosition} 
        maxToasts={maxToasts}
      />

      {/* Notification bell (if enabled) */}
      {showBell && (
        <NotificationBell
          className={bellClassName}
          onClick={() => setCenterOpen(true)}
        />
      )}

      {/* Notification center */}
      <NotificationCenter
        isOpen={centerOpen}
        onClose={() => setCenterOpen(false)}
      />
    </>
  );
};

// Main NotificationSystem component with provider
const NotificationSystem: React.FC<NotificationSystemProps> = ({
  children,
  defaultSettings,
  storageKey,
  ...contentProps
}) => {
  return (
    <NotificationProvider
      defaultSettings={defaultSettings}
      storageKey={storageKey}
    >
      {children}
      <NotificationSystemContent {...contentProps} />
    </NotificationProvider>
  );
};

// Example usage component for testing
export const NotificationSystemExample: React.FC = () => {
  const { addNotification, playNotificationSound } = useNotifications();

  const testNotifications = [
    {
      title: 'Test Info',
      message: 'This is an info notification',
      type: 'info' as const,
    },
    {
      title: 'Test Warning',
      message: 'This is a warning notification',
      type: 'warning' as const,
    },
    {
      title: 'Test Error',
      message: 'This is an error notification',
      type: 'error' as const,
    },
    {
      title: 'Test Critical',
      message: 'This is a critical notification',
      type: 'critical' as const,
    },
    {
      title: 'Test Success',
      message: 'This is a success notification',
      type: 'success' as const,
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white">Test Notifications</h3>
      <div className="grid grid-cols-2 gap-2">
        {testNotifications.map((notification, index) => (
          <button
            key={index}
            onClick={() => addNotification(notification)}
            className={`
              p-3 rounded-lg border text-left text-sm
              ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-300' :
                notification.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300' :
                notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                notification.type === 'critical' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' :
                'bg-blue-500/10 border-blue-500/20 text-blue-300'
              }
              hover:bg-opacity-20 transition-all
            `}
          >
            {notification.title}
          </button>
        ))}
        <button
          onClick={() => playNotificationSound('info')}
          className="p-3 rounded-lg border bg-gray-500/10 border-gray-500/20 text-gray-300 hover:bg-opacity-20 transition-all text-sm"
        >
          Test Sound
        </button>
      </div>
    </div>
  );
};

export default NotificationSystem;