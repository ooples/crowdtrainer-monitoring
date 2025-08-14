'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Zap,
  Settings,
  BellOff
} from 'lucide-react';
import { useMode } from '../providers/mode-provider';
import { useAdminMode } from '../providers/admin-mode-provider';

export interface SmartNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  actionLabel?: string;
  onAction?: () => void;
  autoClose?: boolean;
  duration?: number;
}

interface SmartNotificationsProps {
  notifications: SmartNotification[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    colors: 'bg-green-500/90 border-green-400 text-white',
    iconColor: 'text-green-300'
  },
  warning: {
    icon: AlertTriangle,
    colors: 'bg-yellow-500/90 border-yellow-400 text-white',
    iconColor: 'text-yellow-300'
  },
  error: {
    icon: AlertTriangle,
    colors: 'bg-red-500/90 border-red-400 text-white',
    iconColor: 'text-red-300'
  },
  info: {
    icon: Info,
    colors: 'bg-blue-500/90 border-blue-400 text-white',
    iconColor: 'text-blue-300'
  }
};

const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

export function SmartNotifications({
  notifications,
  onDismiss,
  maxVisible = 5,
  position = 'top-right'
}: SmartNotificationsProps) {
  const { mode, canShowFeature } = useMode();
  const { isAdminMode } = useAdminMode();
  const [isMinimized, setIsMinimized] = useState(false);
  const [mutedTypes, setMutedTypes] = useState<Set<string>>(new Set());

  // Sort notifications by priority and timestamp
  const sortedNotifications = [...notifications]
    .filter(notification => !mutedTypes.has(notification.type))
    .sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, maxVisible);

  // Auto-close notifications
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    notifications.forEach(notification => {
      if (notification.autoClose !== false) {
        const duration = notification.duration || 
          (notification.priority === 'critical' ? 10000 : 
           notification.priority === 'high' ? 7000 : 5000);
        
        const timer = setTimeout(() => {
          onDismiss(notification.id);
        }, duration);
        
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, onDismiss]);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const toggleMuteType = (type: string) => {
    const newMuted = new Set(mutedTypes);
    if (newMuted.has(type)) {
      newMuted.delete(type);
    } else {
      newMuted.add(type);
    }
    setMutedTypes(newMuted);
  };

  if (sortedNotifications.length === 0 && !isMinimized) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 max-w-sm w-full pointer-events-none`}>
      <div className="space-y-2 pointer-events-auto">
        {/* Notification Count Indicator */}
        <AnimatePresence>
          {isMinimized && notifications.length > 0 && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setIsMinimized(false)}
              className="ml-auto block p-2 bg-blue-500/90 backdrop-blur-sm border border-blue-400 rounded-lg text-white shadow-lg hover:bg-blue-600/90 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="text-sm font-medium">{notifications.length}</span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Notifications List */}
        <AnimatePresence mode="popLayout">
          {!isMinimized && sortedNotifications.map((notification, index) => {
            const config = typeConfig[notification.type];
            const IconComponent = config.icon;

            return (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: -50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 30,
                  delay: index * 0.1 
                }}
                className={`backdrop-blur-sm border rounded-xl shadow-2xl p-4 ${config.colors} relative overflow-hidden`}
              >
                {/* Priority indicator */}
                {notification.priority === 'critical' && (
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-600"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                )}

                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-1 rounded-lg ${config.iconColor}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm leading-tight">
                          {notification.title}
                        </h4>
                        <p className="text-sm opacity-90 mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Advanced mode: mute type button */}
                        {canShowFeature('advanced') && (
                          <button
                            onClick={() => toggleMuteType(notification.type)}
                            className="p-1 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Mute ${notification.type} notifications`}
                          >
                            <BellOff className="w-3 h-3" />
                          </button>
                        )}

                        {/* Minimize all button */}
                        <button
                          onClick={() => setIsMinimized(true)}
                          className="p-1 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Minimize notifications"
                        >
                          <Settings className="w-3 h-3" />
                        </button>

                        {/* Close button */}
                        <button
                          onClick={() => onDismiss(notification.id)}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Action button */}
                    {notification.actionLabel && notification.onAction && (
                      <button
                        onClick={notification.onAction}
                        className="mt-3 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                      >
                        {notification.actionLabel}
                      </button>
                    )}

                    {/* Metadata - Expert mode only */}
                    {canShowFeature('expert') && (
                      <div className="mt-2 flex items-center gap-2 text-xs opacity-75">
                        <span>{notification.priority}</span>
                        {notification.category && (
                          <>
                            <span>•</span>
                            <span>{notification.category}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-close progress bar */}
                {notification.autoClose !== false && notification.priority !== 'critical' && (
                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 bg-white/30"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ 
                      duration: (notification.duration || 5000) / 1000, 
                      ease: "linear" 
                    }}
                  />
                )}

                {/* Pulse effect for critical notifications */}
                {notification.priority === 'critical' && (
                  <motion.div
                    className="absolute inset-0 border-2 border-red-400 rounded-xl"
                    animate={{ 
                      opacity: [0, 0.5, 0],
                      scale: [1, 1.02, 1]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Muted types indicator */}
        {mutedTypes.size > 0 && canShowFeature('advanced') && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-2 bg-gray-500/20 backdrop-blur-sm border border-gray-500/40 rounded-lg text-gray-300 text-xs"
          >
            <div className="flex items-center gap-2">
              <BellOff className="w-3 h-3" />
              <span>Muted: {Array.from(mutedTypes).join(', ')}</span>
              <button
                onClick={() => setMutedTypes(new Set())}
                className="ml-auto text-blue-400 hover:text-blue-300"
              >
                Unmute all
              </button>
            </div>
          </motion.div>
        )}

        {/* Admin debug info */}
        {isAdminMode && !isMinimized && notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-2 bg-red-500/20 backdrop-blur-sm border border-red-500/40 rounded-lg text-red-300 text-xs font-mono"
          >
            <div>Total: {notifications.length} | Shown: {sortedNotifications.length}</div>
            <div>Muted: {mutedTypes.size} types | Mode: {mode}</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Hook for managing notifications
export function useSmartNotifications() {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);

  const addNotification = (notification: Omit<SmartNotification, 'id' | 'timestamp'>) => {
    const newNotification: SmartNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [newNotification, ...prev]);
    return newNotification.id;
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll
  };
}