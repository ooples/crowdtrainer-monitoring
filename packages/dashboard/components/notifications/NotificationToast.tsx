'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle, Zap, ExternalLink } from 'lucide-react';
import { Notification, useNotifications } from './NotificationProvider';

// Toast notification component for individual notifications
interface NotificationToastProps {
  notification: Notification;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: () => void;
  onAction?: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  position,
  onDismiss,
  onAction,
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-dismiss progress
  useEffect(() => {
    if (!notification.duration || notification.duration <= 0 || isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (notification.duration! / 100));
        if (newProgress <= 0) {
          onDismiss();
          return 0;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [notification.duration, isPaused, onDismiss]);

  // Get icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      case 'error':
        return AlertCircle;
      case 'critical':
        return Zap;
      default:
        return Info;
    }
  };

  // Get colors based on notification type
  const getColors = () => {
    switch (notification.type) {
      case 'success':
        return {
          bg: 'bg-green-500/10 border-green-500/20',
          icon: 'text-green-400',
          progress: 'bg-green-400',
          text: 'text-green-100',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/20',
          icon: 'text-yellow-400',
          progress: 'bg-yellow-400',
          text: 'text-yellow-100',
        };
      case 'error':
        return {
          bg: 'bg-red-500/10 border-red-500/20',
          icon: 'text-red-400',
          progress: 'bg-red-400',
          text: 'text-red-100',
        };
      case 'critical':
        return {
          bg: 'bg-purple-500/10 border-purple-500/20',
          icon: 'text-purple-400',
          progress: 'bg-purple-400',
          text: 'text-purple-100',
        };
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/20',
          icon: 'text-blue-400',
          progress: 'bg-blue-400',
          text: 'text-blue-100',
        };
    }
  };

  // Animation variants based on position
  const getAnimationVariants = () => {
    const baseY = position.includes('top') ? -100 : 100;
    const baseX = position.includes('right') ? 100 : -100;

    return {
      initial: { 
        opacity: 0, 
        x: baseX,
        y: baseY,
        scale: 0.8,
      },
      animate: { 
        opacity: 1, 
        x: 0,
        y: 0,
        scale: 1,
      },
      exit: { 
        opacity: 0, 
        x: baseX,
        scale: 0.8,
        transition: { duration: 0.2 }
      },
    };
  };

  const Icon = getIcon();
  const colors = getColors();
  const variants = getAnimationVariants();

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        duration: 0.3 
      }}
      className={`
        relative overflow-hidden max-w-sm w-full 
        ${colors.bg} backdrop-blur-md border rounded-lg shadow-2xl
        cursor-pointer group
      `}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={onAction}
    >
      {/* Progress bar */}
      {notification.duration && notification.duration > 0 && (
        <div className="absolute top-0 left-0 h-1 bg-white/10 w-full">
          <motion.div
            className={`h-full ${colors.progress} transition-all duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${colors.icon}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className={`text-sm font-semibold ${colors.text} line-clamp-2`}>
                  {notification.title}
                </h4>
                {notification.message && (
                  <p className={`text-xs ${colors.text} opacity-80 mt-1 line-clamp-3`}>
                    {notification.message}
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className={`
                  flex-shrink-0 ${colors.text} opacity-60 hover:opacity-100 
                  transition-opacity duration-200 p-1 rounded hover:bg-white/10
                `}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action button */}
            {notification.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  notification.action!.onClick();
                  onDismiss();
                }}
                className={`
                  mt-2 inline-flex items-center gap-1 text-xs font-medium
                  ${colors.text} opacity-80 hover:opacity-100 
                  hover:underline transition-all duration-200
                `}
              >
                {notification.action.label}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            {/* Metadata */}
            {notification.source && (
              <div className="mt-2 flex items-center gap-2 text-xs opacity-50">
                <span className={colors.text}>
                  {notification.source} • {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Priority indicator */}
      {notification.priority && notification.priority >= 4 && (
        <div className="absolute top-2 right-2">
          <div className={`w-2 h-2 rounded-full ${colors.progress} animate-pulse`} />
        </div>
      )}
    </motion.div>
  );
};

// Toast container component
interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
  spacing?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = 'top-right',
  maxToasts = 5,
  spacing = 12,
}) => {
  const { notifications, dismissNotification, settings } = useNotifications();

  // Filter active toast notifications
  const activeToasts = notifications
    .filter(n => !n.dismissed && settings.showToasts)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, maxToasts);

  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  if (!settings.enabled || activeToasts.length === 0) {
    return null;
  }

  return (
    <div 
      className={`
        fixed ${getPositionClasses()} z-50 
        flex flex-col gap-${spacing / 4} 
        pointer-events-none
      `}
      style={{ gap: `${spacing}px` }}
    >
      <AnimatePresence>
        {activeToasts.map((notification, index) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationToast
              notification={notification}
              position={position}
              onDismiss={() => dismissNotification(notification.id)}
              onAction={notification.action?.onClick}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationToast;