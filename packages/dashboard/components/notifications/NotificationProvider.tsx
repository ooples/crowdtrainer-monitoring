'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Event, Alert, EventSeverity } from '../../types/monitoring';

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'critical' | 'success';
  timestamp: Date;
  duration?: number; // Auto-dismiss after ms (0 = manual dismiss)
  action?: {
    label: string;
    onClick: () => void;
  };
  metadata?: Record<string, any>;
  source?: 'event' | 'alert' | 'system' | 'user';
  dismissed?: boolean;
  viewed?: boolean;
  soundEnabled?: boolean;
  priority?: number; // Higher = more important
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  dismissNotification: (id: string) => void;
  markAsViewed: (id: string) => void;
  markAllAsViewed: () => void;
  clearAll: () => void;
  clearDismissed: () => void;
  // Smart notification methods
  notifyFromEvent: (event: Event) => void;
  notifyFromAlert: (alert: Alert) => void;
  // Settings
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  // Sound control
  playNotificationSound: (type: Notification['type']) => void;
  muteAll: () => void;
  unmuteAll: () => void;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0-1
  enableForTypes: Record<Notification['type'], boolean>;
  enableForSeverity: Record<EventSeverity, boolean>;
  autoDismissDelay: Record<Notification['type'], number>; // 0 = manual
  maxNotifications: number;
  duplicateTimeout: number; // ms to prevent duplicate notifications
  showToasts: boolean;
  showBadge: boolean;
  persistHistory: boolean;
}

// Default settings
const defaultSettings: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  soundVolume: 0.3,
  enableForTypes: {
    info: true,
    warning: true,
    error: true,
    critical: true,
    success: true,
  },
  enableForSeverity: {
    all: true,
    info: true,
    warning: true,
    error: true,
    critical: true,
  },
  autoDismissDelay: {
    info: 5000,
    warning: 8000,
    error: 0, // Manual dismiss
    critical: 0, // Manual dismiss
    success: 3000,
  },
  maxNotifications: 50,
  duplicateTimeout: 5000,
  showToasts: true,
  showBadge: true,
  persistHistory: true,
};

// Sound system
class NotificationSounds {
  private audioContext: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();
  
  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  // Generate synthetic notification sounds
  private createSound(frequency: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine'): AudioBuffer | null {
    if (!this.audioContext) return null;

    const sampleRate = this.audioContext.sampleRate;
    const bufferLength = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < bufferLength; i++) {
      const t = i / sampleRate;
      let sample = 0;
      
      switch (type) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
          break;
        case 'triangle':
          sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * frequency * t));
          break;
      }
      
      // Apply envelope (fade in/out)
      const envelope = Math.min(t * 10, 1) * Math.min((duration - t) * 10, 1);
      channelData[i] = sample * envelope * 0.1; // Low volume
    }

    return buffer;
  }

  private initializeSounds() {
    if (!this.audioContext) return;

    // Different sounds for different notification types
    const sounds = {
      info: { frequency: 440, duration: 0.2, type: 'sine' as const },
      success: { frequency: 523, duration: 0.15, type: 'sine' as const },
      warning: { frequency: 349, duration: 0.3, type: 'triangle' as const },
      error: { frequency: 220, duration: 0.4, type: 'square' as const },
      critical: { frequency: 196, duration: 0.6, type: 'square' as const },
    };

    Object.entries(sounds).forEach(([type, config]) => {
      const buffer = this.createSound(config.frequency, config.duration, config.type);
      if (buffer) {
        this.soundCache.set(type, buffer);
      }
    });
  }

  playSound(type: Notification['type'], volume: number = 0.3) {
    if (!this.audioContext || !this.soundCache.has(type)) {
      if (this.soundCache.size === 0) {
        this.initializeSounds();
      }
      if (!this.soundCache.has(type)) return;
    }

    try {
      const source = this.audioContext!.createBufferSource();
      const gainNode = this.audioContext!.createGain();
      
      source.buffer = this.soundCache.get(type)!;
      gainNode.gain.value = Math.max(0, Math.min(1, volume));
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      source.start();
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }
}

// Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Hook
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Provider Component
interface NotificationProviderProps {
  children: React.ReactNode;
  storageKey?: string;
  defaultSettings?: Partial<NotificationSettings>;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  storageKey = 'monitoring-notifications',
  defaultSettings: customDefaults = {},
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    ...defaultSettings,
    ...customDefaults,
  });
  
  const soundSystem = useRef<NotificationSounds | null>(null);
  const duplicateTracker = useRef<Map<string, number>>(new Map());
  const nextId = useRef<number>(1);

  // Initialize sound system
  useEffect(() => {
    soundSystem.current = new NotificationSounds();
  }, []);

  // Load from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { notifications: storedNotifications, settings: storedSettings } = JSON.parse(stored);
        if (storedSettings) {
          setSettings(prev => ({ ...prev, ...storedSettings }));
        }
        if (storedNotifications && settings.persistHistory) {
          setNotifications(storedNotifications.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          })));
        }
      }
    } catch (error) {
      console.warn('Failed to load notifications from storage:', error);
    }
  }, [storageKey, settings.persistHistory]);

  // Save to storage
  const saveToStorage = useCallback((notifications: Notification[], settings: NotificationSettings) => {
    if (!settings.persistHistory) return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        notifications: notifications.slice(-settings.maxNotifications),
        settings,
      }));
    } catch (error) {
      console.warn('Failed to save notifications to storage:', error);
    }
  }, [storageKey]);

  // Generate unique notification key for duplicate detection
  const getNotificationKey = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    return `${notification.type}-${notification.title}-${notification.message}`;
  }, []);

  // Check if notification is duplicate
  const isDuplicate = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const key = getNotificationKey(notification);
    const lastTime = duplicateTracker.current.get(key);
    const now = Date.now();
    
    if (lastTime && (now - lastTime) < settings.duplicateTimeout) {
      return true;
    }
    
    duplicateTracker.current.set(key, now);
    return false;
  }, [getNotificationKey, settings.duplicateTimeout]);

  // Add notification
  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'timestamp'>) => {
    if (!settings.enabled || !settings.enableForTypes[notificationData.type]) {
      return '';
    }

    // Check for duplicates
    if (isDuplicate(notificationData)) {
      return '';
    }

    const id = `notification-${nextId.current++}`;
    const notification: Notification = {
      ...notificationData,
      id,
      timestamp: new Date(),
      duration: notificationData.duration ?? settings.autoDismissDelay[notificationData.type],
      dismissed: false,
      viewed: false,
      soundEnabled: notificationData.soundEnabled ?? settings.soundEnabled,
    };

    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, settings.maxNotifications);
      saveToStorage(updated, settings);
      return updated;
    });

    // Play sound
    if (notification.soundEnabled && settings.soundEnabled && soundSystem.current) {
      soundSystem.current.playSound(notification.type, settings.soundVolume);
    }

    // Auto-dismiss
    if (notification.duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, notification.duration);
    }

    return id;
  }, [settings, isDuplicate, saveToStorage]);

  // Remove notification completely
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveToStorage(updated, settings);
      return updated;
    });
  }, [saveToStorage, settings]);

  // Dismiss notification (mark as dismissed)
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, dismissed: true } : n);
      saveToStorage(updated, settings);
      return updated;
    });
  }, [saveToStorage, settings]);

  // Mark as viewed
  const markAsViewed = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, viewed: true } : n);
      saveToStorage(updated, settings);
      return updated;
    });
  }, [saveToStorage, settings]);

  // Mark all as viewed
  const markAllAsViewed = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, viewed: true }));
      saveToStorage(updated, settings);
      return updated;
    });
  }, [saveToStorage, settings]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([], settings);
  }, [saveToStorage, settings]);

  // Clear dismissed notifications
  const clearDismissed = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.filter(n => !n.dismissed);
      saveToStorage(updated, settings);
      return updated;
    });
  }, [saveToStorage, settings]);

  // Smart notification from Event
  const notifyFromEvent = useCallback((event: Event) => {
    if (!settings.enableForSeverity[event.severity]) return;

    let type: Notification['type'] = 'info';
    let priority = 1;

    switch (event.severity) {
      case 'critical':
        type = 'critical';
        priority = 5;
        break;
      case 'error':
        type = 'error';
        priority = 4;
        break;
      case 'warning':
        type = 'warning';
        priority = 3;
        break;
      case 'info':
        type = 'info';
        priority = 2;
        break;
    }

    addNotification({
      title: event.title,
      message: event.description,
      type,
      source: 'event',
      priority,
      metadata: {
        eventId: event.id,
        category: event.category,
        ...event.metadata,
      },
      action: {
        label: 'View Details',
        onClick: () => {
          // Could emit an event or call a callback to show event details
          console.log('View event details:', event.id);
        },
      },
    });
  }, [settings.enableForSeverity, addNotification]);

  // Smart notification from Alert
  const notifyFromAlert = useCallback((alert: Alert) => {
    let type: Notification['type'] = 'info';
    let priority = 1;

    switch (alert.type) {
      case 'critical':
        type = 'critical';
        priority = 5;
        break;
      case 'error':
        type = 'error';
        priority = 4;
        break;
      case 'warning':
        type = 'warning';
        priority = 3;
        break;
      case 'info':
        type = 'info';
        priority = 2;
        break;
    }

    addNotification({
      title: alert.title,
      message: alert.message,
      type,
      source: 'alert',
      priority,
      metadata: {
        alertId: alert.id,
        actionRequired: alert.actionRequired,
        resolved: alert.resolved,
      },
      action: alert.actionRequired ? {
        label: 'Take Action',
        onClick: () => {
          console.log('Handle alert action:', alert.id);
        },
      } : undefined,
    });
  }, [addNotification]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveToStorage(notifications, updated);
      return updated;
    });
  }, [notifications, saveToStorage]);

  // Sound controls
  const playNotificationSound = useCallback((type: Notification['type']) => {
    if (settings.soundEnabled && soundSystem.current) {
      soundSystem.current.playSound(type, settings.soundVolume);
    }
  }, [settings.soundEnabled, settings.soundVolume]);

  const muteAll = useCallback(() => {
    updateSettings({ soundEnabled: false });
  }, [updateSettings]);

  const unmuteAll = useCallback(() => {
    updateSettings({ soundEnabled: true });
  }, [updateSettings]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.viewed && !n.dismissed).length;

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    dismissNotification,
    markAsViewed,
    markAllAsViewed,
    clearAll,
    clearDismissed,
    notifyFromEvent,
    notifyFromAlert,
    settings,
    updateSettings,
    playNotificationSound,
    muteAll,
    unmuteAll,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;