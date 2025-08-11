import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';

interface MonitoringEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  metadata?: Record<string, any>;
}

interface MonitoringConfig {
  apiEndpoint: string;
  enableRealTime: boolean;
  enableCrashReporting: boolean;
  enablePerformanceTracking: boolean;
  enableUserJourney: boolean;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  bufferSize: number;
  flushInterval: number;
}

interface MonitoringContextType {
  track: (event: MonitoringEvent) => void;
  trackError: (error: Error, context?: Partial<MonitoringEvent>) => void;
  trackPerformance: (metric: PerformanceMetric) => void;
  trackScreenView: (screenName: string, metadata?: Record<string, any>) => void;
  getSessionInfo: () => SessionInfo;
  isOnline: boolean;
  config: MonitoringConfig;
}

interface SessionInfo {
  sessionId: string;
  userId?: string;
  appVersion: string;
  deviceInfo: Record<string, any>;
  sessionStartTime: number;
  screenViews: ScreenView[];
}

interface ScreenView {
  screenName: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

interface MonitoringProviderProps {
  children: ReactNode;
  config: MonitoringConfig;
}

export function MonitoringProvider({ children, config }: MonitoringProviderProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [eventQueue, setEventQueue] = useState<any[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('');
  const [screenStartTime, setScreenStartTime] = useState<number>(Date.now());

  // Initialize session
  useEffect(() => {
    initializeSession();
  }, []);

  // Set up network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOnline = isOnline;
      const nowOnline = state.isConnected ?? false;
      
      setIsOnline(nowOnline);

      if (!wasOnline && nowOnline) {
        // Back online, flush queued events
        flushEventQueue();
        
        track({
          category: 'connectivity',
          action: 'network_restored',
          metadata: {
            connection_type: state.type,
            is_wifi: state.type === 'wifi',
          },
        });
      } else if (wasOnline && !nowOnline) {
        track({
          category: 'connectivity',
          action: 'network_lost',
          metadata: {
            connection_type: state.type,
          },
        });
      }
    });

    return unsubscribe;
  }, [isOnline]);

  // Set up app state monitoring
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      track({
        category: 'app_lifecycle',
        action: 'app_state_change',
        label: nextAppState,
        metadata: {
          previous_state: AppState.currentState,
          current_state: nextAppState,
        },
      });

      if (nextAppState === 'background') {
        // App went to background, flush events
        flushEventQueue();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Set up periodic metrics collection
  useEffect(() => {
    if (!config.enablePerformanceTracking) return;

    const interval = setInterval(() => {
      collectSystemMetrics();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [config.enablePerformanceTracking]);

  // Set up automatic event flushing
  useEffect(() => {
    const interval = setInterval(() => {
      if (eventQueue.length > 0) {
        flushEventQueue();
      }
    }, config.flushInterval);

    return () => clearInterval(interval);
  }, [eventQueue.length, config.flushInterval]);

  const initializeSession = async () => {
    try {
      // Generate or retrieve session ID
      const sessionId = await generateSessionId();
      
      // Get device information
      const deviceInfo = await getDeviceInfo();
      
      // Get app version
      const appVersion = await DeviceInfo.getVersion();
      
      // Load user ID if available
      const userId = await AsyncStorage.getItem('user_id');

      const session: SessionInfo = {
        sessionId,
        userId: userId || undefined,
        appVersion,
        deviceInfo,
        sessionStartTime: Date.now(),
        screenViews: [],
      };

      setSessionInfo(session);

      // Track session start
      track({
        category: 'app_lifecycle',
        action: 'session_started',
        metadata: {
          session_id: sessionId,
          app_version: appVersion,
          device_info: deviceInfo,
        },
      });

    } catch (error) {
      console.error('[Monitoring] Failed to initialize session:', error);
    }
  };

  const generateSessionId = async (): Promise<string> => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `rn_${timestamp}_${randomString}`;
  };

  const getDeviceInfo = async () => {
    try {
      const [
        brand,
        model,
        systemVersion,
        uniqueId,
        isTablet,
        totalMemory,
        usedMemory,
      ] = await Promise.all([
        DeviceInfo.getBrand(),
        DeviceInfo.getModel(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getUniqueId(),
        DeviceInfo.isTablet(),
        DeviceInfo.getTotalMemory(),
        DeviceInfo.getUsedMemory(),
      ]);

      return {
        platform: Platform.OS,
        platform_version: Platform.Version,
        brand,
        model,
        system_version: systemVersion,
        device_id: uniqueId,
        is_tablet: isTablet,
        memory: {
          total: totalMemory,
          used: usedMemory,
          available: totalMemory - usedMemory,
        },
      };
    } catch (error) {
      console.error('[Monitoring] Failed to get device info:', error);
      return {
        platform: Platform.OS,
        platform_version: Platform.Version,
        error: 'failed_to_get_device_info',
      };
    }
  };

  const collectSystemMetrics = async () => {
    try {
      const [usedMemory, battery] = await Promise.all([
        DeviceInfo.getUsedMemory(),
        DeviceInfo.getBatteryLevel(),
      ]);

      trackPerformance({
        name: 'memory_usage',
        value: usedMemory / (1024 * 1024), // Convert to MB
        unit: 'bytes',
        metadata: {
          platform: Platform.OS,
        },
      });

      trackPerformance({
        name: 'battery_level',
        value: battery * 100,
        unit: 'percentage',
      });

    } catch (error) {
      if (config.debug) {
        console.error('[Monitoring] Failed to collect system metrics:', error);
      }
    }
  };

  const track = (event: MonitoringEvent) => {
    if (!sessionInfo) return;

    const eventData = {
      type: 'event',
      category: event.category,
      action: event.action,
      label: event.label || null,
      value: event.value || null,
      sessionId: sessionInfo.sessionId,
      userId: sessionInfo.userId,
      metadata: {
        ...event.metadata,
        timestamp: new Date().toISOString(),
        app_version: sessionInfo.appVersion,
        device_info: sessionInfo.deviceInfo,
        screen: currentScreen,
        session_duration: Date.now() - sessionInfo.sessionStartTime,
      },
      environment: config.environment,
    };

    addToQueue(eventData);

    if (config.debug) {
      console.log('[Monitoring] Event tracked:', eventData);
    }
  };

  const trackError = (error: Error, context: Partial<MonitoringEvent> = {}) => {
    const errorData = {
      type: 'error',
      category: context.category || 'app_error',
      action: context.action || 'error_occurred',
      label: context.label || error.name,
      sessionId: sessionInfo?.sessionId,
      userId: sessionInfo?.userId,
      metadata: {
        ...context.metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date().toISOString(),
        app_version: sessionInfo?.appVersion,
        device_info: sessionInfo?.deviceInfo,
        screen: currentScreen,
      },
      environment: config.environment,
      severity: 'high',
    };

    addToQueue(errorData);

    if (config.debug) {
      console.error('[Monitoring] Error tracked:', errorData);
    }
  };

  const trackPerformance = (metric: PerformanceMetric) => {
    if (!config.enablePerformanceTracking || !sessionInfo) return;

    const performanceData = {
      type: 'performance',
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      sessionId: sessionInfo.sessionId,
      userId: sessionInfo.userId,
      metadata: {
        ...metric.metadata,
        timestamp: new Date().toISOString(),
        app_version: sessionInfo.appVersion,
        device_info: sessionInfo.deviceInfo,
        screen: currentScreen,
      },
      environment: config.environment,
    };

    addToQueue(performanceData);

    if (config.debug) {
      console.log('[Monitoring] Performance metric tracked:', performanceData);
    }
  };

  const trackScreenView = (screenName: string, metadata: Record<string, any> = {}) => {
    const now = Date.now();
    
    // Track previous screen duration
    if (currentScreen) {
      const duration = now - screenStartTime;
      
      trackPerformance({
        name: 'screen_view_duration',
        value: duration,
        unit: 'ms',
        metadata: {
          screen: currentScreen,
          next_screen: screenName,
        },
      });
    }

    // Update current screen
    setCurrentScreen(screenName);
    setScreenStartTime(now);

    // Add to session screen views
    if (sessionInfo) {
      const screenView: ScreenView = {
        screenName,
        timestamp: now,
        metadata,
      };

      setSessionInfo(prev => prev ? {
        ...prev,
        screenViews: [...prev.screenViews, screenView],
      } : null);
    }

    // Track screen view event
    track({
      category: 'navigation',
      action: 'screen_view',
      label: screenName,
      metadata: {
        ...metadata,
        screen_views_count: sessionInfo ? sessionInfo.screenViews.length + 1 : 1,
      },
    });
  };

  const addToQueue = (data: any) => {
    setEventQueue(prev => {
      const newQueue = [...prev, data];
      
      // Auto-flush if buffer is full
      if (newQueue.length >= config.bufferSize) {
        setTimeout(() => flushEventQueue(), 0);
      }
      
      return newQueue;
    });
  };

  const flushEventQueue = async () => {
    if (eventQueue.length === 0 || !isOnline) return;

    const events = [...eventQueue];
    setEventQueue([]);

    try {
      const response = await fetch(`${config.apiEndpoint}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (config.debug) {
        console.log(`[Monitoring] Flushed ${events.length} events`);
      }

    } catch (error) {
      // Re-queue events on failure
      setEventQueue(prev => [...events, ...prev]);
      
      if (config.debug) {
        console.error('[Monitoring] Failed to flush events:', error);
      }
    }
  };

  const getSessionInfo = (): SessionInfo => {
    return sessionInfo || {
      sessionId: 'unknown',
      appVersion: 'unknown',
      deviceInfo: {},
      sessionStartTime: Date.now(),
      screenViews: [],
    };
  };

  const contextValue: MonitoringContextType = {
    track,
    trackError,
    trackPerformance,
    trackScreenView,
    getSessionInfo,
    isOnline,
    config,
  };

  return (
    <MonitoringContext.Provider value={contextValue}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}