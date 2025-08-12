import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
  SafeAreaView,
  RefreshControl,
  Modal,
  Animated,
  Vibration,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  LineChart,
  BarChart,
  PieChart,
  ContributionGraph,
} from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import BackgroundJob from 'react-native-background-job';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Voice from '@react-native-voice/voice';

// Icons (using react-native-vector-icons)
import Icon from 'react-native-vector-icons/MaterialIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';

// Types
interface SystemMetrics {
  systemHealth: 'operational' | 'degraded' | 'critical' | 'checking';
  activeUsers: number;
  apiLatency: number;
  errorRate: number;
  lastUpdated: string;
  recentEvents: Event[];
  oauth?: Record<string, string>;
  system?: {
    cpuUsage: string;
    memoryUsage: string;
    diskUsage: string;
  };
  api?: {
    errorsLastHour: number;
    requestsPerSecond: number;
  };
}

interface Event {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  source: string;
}

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  acknowledged: boolean;
}

interface AppConfig {
  apiEndpoint: string;
  apiKey: string;
  refreshInterval: number;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    critical: boolean;
    warnings: boolean;
  };
  voice: {
    enabled: boolean;
    language: string;
    wakeWord: string;
  };
  offline: {
    cacheSize: number;
    maxAge: number;
  };
}

// Default configuration
const defaultConfig: AppConfig = {
  apiEndpoint: 'https://api.monitoring.example.com',
  apiKey: '',
  refreshInterval: 30000,
  theme: 'auto',
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
    critical: true,
    warnings: true,
  },
  voice: {
    enabled: false,
    language: 'en-US',
    wakeWord: 'hey monitor',
  },
  offline: {
    cacheSize: 50,
    maxAge: 300000, // 5 minutes
  },
};

// Theme configurations
const themes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#3b82f6',
      background: '#ffffff',
      card: '#f8fafc',
      text: '#1e293b',
      border: '#e2e8f0',
      notification: '#ef4444',
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#60a5fa',
      background: '#0f172a',
      card: '#1e293b',
      text: '#f8fafc',
      border: '#334155',
      notification: '#ef4444',
    },
  },
};

// Navigation setup
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// API Client
class MonitoringAPI {
  private config: AppConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(config: AppConfig) {
    this.config = config;
  }

  updateConfig(config: AppConfig) {
    this.config = config;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if available and not expired
    if (cached && Date.now() - cached.timestamp < this.config.offline.maxAge) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the response
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      // Cleanup old cache entries
      if (this.cache.size > this.config.offline.cacheSize) {
        const oldest = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        this.cache.delete(oldest[0]);
      }

      return data;
    } catch (error) {
      // Return cached data if network request fails
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  }

  async getMetrics(): Promise<{ success: boolean; data?: SystemMetrics; error?: string }> {
    try {
      const data = await this.request('/metrics');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getAlerts(): Promise<{ success: boolean; data?: { alerts: Alert[] }; error?: string }> {
    try {
      const data = await this.request('/alerts');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async acknowledgeAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/alerts/${alertId}/acknowledge`, { method: 'POST' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Dashboard Screen
const DashboardScreen: React.FC<{ config: AppConfig; api: MonitoringAPI; theme: any }> = ({
  config,
  api,
  theme,
}) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<boolean>(true);

  const fetchMetrics = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const response = await api.getMetrics();
      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        setError(response.error || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMetrics();
    
    const interval = setInterval(() => {
      fetchMetrics(false);
    }, config.refreshInterval);

    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkStatus(state.isConnected ?? false);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [config.refreshInterval]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'operational':
        return '#22c55e';
      case 'degraded':
        return '#f59e0b';
      case 'critical':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'operational':
        return 'check-circle';
      case 'degraded':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'help';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Animated.View style={styles.loadingSpinner}>
            <Icon name="refresh" size={48} color={theme.colors.primary} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading metrics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={config.theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Monitoring Dashboard</Text>
        <View style={styles.headerActions}>
          {!networkStatus && (
            <Icon name="wifi-off" size={24} color="#f59e0b" style={styles.networkIcon} />
          )}
          <TouchableOpacity onPress={() => fetchMetrics()}>
            <Icon name="refresh" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Icon name="error-outline" size={20} color="#dc2626" />
            <Text style={[styles.errorText, { color: '#dc2626' }]}>{error}</Text>
          </View>
        )}

        {metrics && (
          <>
            {/* Status Cards */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.metricHeader}>
                  <Icon 
                    name={getHealthIcon(metrics.systemHealth)} 
                    size={24} 
                    color={getHealthColor(metrics.systemHealth)} 
                  />
                  <Text style={[styles.metricTitle, { color: theme.colors.text }]}>System Health</Text>
                </View>
                <Text style={[styles.metricValue, { color: getHealthColor(metrics.systemHealth) }]}>
                  {metrics.systemHealth.toUpperCase()}
                </Text>
                {metrics.system && (
                  <Text style={[styles.metricSubtext, { color: theme.colors.text }]}>
                    CPU: {metrics.system.cpuUsage} | RAM: {metrics.system.memoryUsage}
                  </Text>
                )}
              </View>

              <View style={[styles.metricCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.metricHeader}>
                  <Icon name="people" size={24} color="#3b82f6" />
                  <Text style={[styles.metricTitle, { color: theme.colors.text }]}>Active Users</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#3b82f6' }]}>
                  {metrics.activeUsers.toLocaleString()}
                </Text>
                <Text style={[styles.metricSubtext, { color: theme.colors.text }]}>Currently online</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.metricHeader}>
                  <Icon name="speed" size={24} color="#f59e0b" />
                  <Text style={[styles.metricTitle, { color: theme.colors.text }]}>API Latency</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#f59e0b' }]}>
                  {metrics.apiLatency}ms
                </Text>
                <Text style={[styles.metricSubtext, { color: theme.colors.text }]}>Average response time</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.metricHeader}>
                  <Icon name="trending-up" size={24} color="#ef4444" />
                  <Text style={[styles.metricTitle, { color: theme.colors.text }]}>Error Rate</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#ef4444' }]}>
                  {metrics.errorRate}%
                </Text>
                {metrics.api && (
                  <Text style={[styles.metricSubtext, { color: theme.colors.text }]}>
                    {metrics.api.errorsLastHour} errors in last hour
                  </Text>
                )}
              </View>
            </View>

            {/* Charts */}
            <View style={[styles.chartContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Performance Trend</Text>
              <LineChart
                data={{
                  labels: ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'now'],
                  datasets: [
                    {
                      data: [65, 72, 68, 75, 70, 73, metrics.apiLatency / 10],
                      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                      strokeWidth: 2,
                    },
                  ],
                }}
                width={Dimensions.get('window').width - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix="ms"
                chartConfig={{
                  backgroundColor: theme.colors.card,
                  backgroundGradientFrom: theme.colors.card,
                  backgroundGradientTo: theme.colors.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `${theme.colors.text}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: '#3b82f6',
                  },
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
              />
            </View>

            {/* Recent Events */}
            {metrics.recentEvents && metrics.recentEvents.length > 0 && (
              <View style={[styles.eventsContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Events</Text>
                {metrics.recentEvents.slice(0, 5).map((event) => (
                  <View key={event.id} style={[styles.eventItem, { borderBottomColor: theme.colors.border }]}>
                    <View style={styles.eventHeader}>
                      <Icon
                        name={
                          event.severity === 'critical' ? 'error' :
                          event.severity === 'warning' ? 'warning' : 'info'
                        }
                        size={16}
                        color={
                          event.severity === 'critical' ? '#ef4444' :
                          event.severity === 'warning' ? '#f59e0b' : '#3b82f6'
                        }
                      />
                      <Text style={[styles.eventTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={[styles.eventTime, { color: theme.colors.text }]}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={[styles.eventDescription, { color: theme.colors.text }]} numberOfLines={2}>
                      {event.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* OAuth Status */}
            {metrics.oauth && (
              <View style={[styles.oauthContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>OAuth Provider Status</Text>
                {Object.entries(metrics.oauth).map(([provider, status]) => (
                  <View key={provider} style={styles.oauthItem}>
                    <Text style={[styles.oauthProvider, { color: theme.colors.text }]}>{provider}</Text>
                    <View style={[
                      styles.oauthStatus,
                      { backgroundColor: status === 'operational' ? '#22c55e' : status === 'degraded' ? '#f59e0b' : '#ef4444' }
                    ]}>
                      <Text style={styles.oauthStatusText}>{status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Alerts Screen
const AlertsScreen: React.FC<{ config: AppConfig; api: MonitoringAPI; theme: any }> = ({
  config,
  api,
  theme,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const response = await api.getAlerts();
      if (response.success && response.data) {
        setAlerts(response.data.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    const response = await api.acknowledgeAlert(alertId);
    if (response.success) {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ));
      
      if (config.notifications.vibration) {
        Vibration.vibrate(100);
      }
    } else {
      Alert.alert('Error', response.error || 'Failed to acknowledge alert');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(false), config.refreshInterval);
    return () => clearInterval(interval);
  }, [config.refreshInterval]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Animated.View style={styles.loadingSpinner}>
            <Icon name="notifications" size={48} color={theme.colors.primary} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={config.theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Alerts</Text>
        <View style={styles.headerActions}>
          <Text style={[styles.alertCount, { color: theme.colors.text }]}>
            {alerts.filter(a => !a.acknowledged).length} Active
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={64} color={theme.colors.primary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No alerts at this time</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.text }]}>All systems are running normally</Text>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {alerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={[
                  styles.alertItem,
                  { 
                    backgroundColor: theme.colors.card, 
                    borderColor: theme.colors.border,
                    borderLeftColor: getSeverityColor(alert.severity),
                    opacity: alert.acknowledged ? 0.6 : 1,
                  }
                ]}
                onPress={() => acknowledgeAlert(alert.id)}
                disabled={alert.acknowledged}
              >
                <View style={styles.alertHeader}>
                  <View style={styles.alertSeverity}>
                    <Icon
                      name={
                        alert.severity === 'critical' ? 'error' :
                        alert.severity === 'warning' ? 'warning' : 'info'
                      }
                      size={20}
                      color={getSeverityColor(alert.severity)}
                    />
                    <Text style={[styles.alertSeverityText, { color: getSeverityColor(alert.severity) }]}>
                      {alert.severity.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.alertTime, { color: theme.colors.text }]}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </Text>
                </View>
                
                <Text style={[styles.alertTitle, { color: theme.colors.text }]}>
                  {alert.title}
                </Text>
                
                <Text style={[styles.alertDescription, { color: theme.colors.text }]}>
                  {alert.description}
                </Text>
                
                {alert.acknowledged ? (
                  <View style={styles.acknowledgedBadge}>
                    <Icon name="check" size={16} color="#22c55e" />
                    <Text style={[styles.acknowledgedText, { color: '#22c55e' }]}>Acknowledged</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.acknowledgeButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => acknowledgeAlert(alert.id)}
                  >
                    <Text style={styles.acknowledgeButtonText}>Acknowledge</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Settings Screen
const SettingsScreen: React.FC<{
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
  theme: any;
}> = ({ config, onConfigChange, theme }) => {
  const [tempConfig, setTempConfig] = useState<AppConfig>(config);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    // Check voice recognition support
    Voice.isAvailable().then(setVoiceSupported).catch(() => setVoiceSupported(false));
  }, []);

  const updateConfig = (updates: Partial<AppConfig>) => {
    const newConfig = { ...tempConfig, ...updates };
    setTempConfig(newConfig);
    onConfigChange(newConfig);
  };

  const testNotification = () => {
    if (config.notifications.enabled) {
      PushNotification.localNotification({
        title: 'Test Notification',
        message: 'This is a test notification from the monitoring app',
        playSound: config.notifications.sound,
        vibrate: config.notifications.vibration,
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={config.theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* API Configuration */}
        <View style={[styles.settingsSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>API Configuration</Text>
          
          <View style={styles.settingsItem}>
            <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>API Endpoint</Text>
            <Text style={[styles.settingsValue, { color: theme.colors.text }]}>
              {tempConfig.apiEndpoint}
            </Text>
          </View>
          
          <View style={styles.settingsItem}>
            <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Refresh Interval</Text>
            <Text style={[styles.settingsValue, { color: theme.colors.text }]}>
              {tempConfig.refreshInterval / 1000}s
            </Text>
          </View>
        </View>

        {/* Theme Settings */}
        <View style={[styles.settingsSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>Appearance</Text>
          
          <View style={styles.settingsItem}>
            <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Theme</Text>
            <View style={styles.themeSelector}>
              {['light', 'dark', 'auto'].map((themeOption) => (
                <TouchableOpacity
                  key={themeOption}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: tempConfig.theme === themeOption ? theme.colors.primary : 'transparent',
                      borderColor: theme.colors.border,
                    }
                  ]}
                  onPress={() => updateConfig({ theme: themeOption as 'light' | 'dark' | 'auto' })}
                >
                  <Text style={[
                    styles.themeOptionText,
                    { 
                      color: tempConfig.theme === themeOption ? '#ffffff' : theme.colors.text,
                    }
                  ]}>
                    {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={[styles.settingsSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.settingsSectionHeader}>
            <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>Notifications</Text>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: theme.colors.primary }]}
              onPress={testNotification}
            >
              <Text style={styles.testButtonText}>Test</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.settingsToggleItem}>
            <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Enable Notifications</Text>
            <TouchableOpacity
              style={[
                styles.toggle,
                { backgroundColor: tempConfig.notifications.enabled ? theme.colors.primary : theme.colors.border }
              ]}
              onPress={() => updateConfig({ 
                notifications: { ...tempConfig.notifications, enabled: !tempConfig.notifications.enabled }
              })}
            >
              <View style={[
                styles.toggleKnob,
                { 
                  transform: [{ translateX: tempConfig.notifications.enabled ? 20 : 2 }],
                  backgroundColor: '#ffffff'
                }
              ]} />
            </TouchableOpacity>
          </View>
          
          {tempConfig.notifications.enabled && (
            <>
              <View style={styles.settingsToggleItem}>
                <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Sound</Text>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    { backgroundColor: tempConfig.notifications.sound ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => updateConfig({ 
                    notifications: { ...tempConfig.notifications, sound: !tempConfig.notifications.sound }
                  })}
                >
                  <View style={[
                    styles.toggleKnob,
                    { 
                      transform: [{ translateX: tempConfig.notifications.sound ? 20 : 2 }],
                      backgroundColor: '#ffffff'
                    }
                  ]} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingsToggleItem}>
                <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Vibration</Text>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    { backgroundColor: tempConfig.notifications.vibration ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => updateConfig({ 
                    notifications: { ...tempConfig.notifications, vibration: !tempConfig.notifications.vibration }
                  })}
                >
                  <View style={[
                    styles.toggleKnob,
                    { 
                      transform: [{ translateX: tempConfig.notifications.vibration ? 20 : 2 }],
                      backgroundColor: '#ffffff'
                    }
                  ]} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Voice Commands */}
        {voiceSupported && (
          <View style={[styles.settingsSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>Voice Commands</Text>
            
            <View style={styles.settingsToggleItem}>
              <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Enable Voice Commands</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  { backgroundColor: tempConfig.voice.enabled ? theme.colors.primary : theme.colors.border }
                ]}
                onPress={() => updateConfig({ 
                  voice: { ...tempConfig.voice, enabled: !tempConfig.voice.enabled }
                })}
              >
                <View style={[
                  styles.toggleKnob,
                  { 
                    transform: [{ translateX: tempConfig.voice.enabled ? 20 : 2 }],
                    backgroundColor: '#ffffff'
                  }
                ]} />
              </TouchableOpacity>
            </View>
            
            {tempConfig.voice.enabled && (
              <View style={styles.settingsItem}>
                <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Wake Word</Text>
                <Text style={[styles.settingsValue, { color: theme.colors.text }]}>
                  "{tempConfig.voice.wakeWord}"
                </Text>
              </View>
            )}
          </View>
        )}

        {/* App Info */}
        <View style={[styles.settingsSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>App Information</Text>
          
          <View style={styles.settingsItem}>
            <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Version</Text>
            <Text style={[styles.settingsValue, { color: theme.colors.text }]}>1.0.0</Text>
          </View>
          
          <View style={styles.settingsItem}>
            <Text style={[styles.settingsLabel, { color: theme.colors.text }]}>Device</Text>
            <Text style={[styles.settingsValue, { color: theme.colors.text }]}>
              {Platform.OS === 'ios' ? 'iOS' : 'Android'} {Platform.Version}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Main App Component
const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [currentTheme, setCurrentTheme] = useState(themes.light);
  const [api] = useState(new MonitoringAPI(config));
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Load configuration from storage
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const stored = await AsyncStorage.getItem('@monitoring_config');
        if (stored) {
          const parsedConfig = JSON.parse(stored);
          setConfig(parsedConfig);
          api.updateConfig(parsedConfig);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    
    loadConfig();
  }, []);

  // Save configuration to storage
  const handleConfigChange = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    api.updateConfig(newConfig);
    
    try {
      await AsyncStorage.setItem('@monitoring_config', JSON.stringify(newConfig));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  // Theme handling
  useEffect(() => {
    const updateTheme = () => {
      if (config.theme === 'auto') {
        // Use system preference (simplified - in real app, use Appearance API)
        const isDarkMode = new Date().getHours() > 18 || new Date().getHours() < 6;
        setCurrentTheme(isDarkMode ? themes.dark : themes.light);
      } else {
        setCurrentTheme(config.theme === 'dark' ? themes.dark : themes.light);
      }
    };
    
    updateTheme();
  }, [config.theme]);

  // App state handling
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        console.log('App has come to the foreground!');
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState]);

  // Push notifications setup
  useEffect(() => {
    if (config.notifications.enabled) {
      PushNotification.configure({
        onNotification: function(notification) {
          console.log('NOTIFICATION:', notification);
        },
        requestPermissions: Platform.OS === 'ios',
      });
    }
  }, [config.notifications.enabled]);

  // Background job for data fetching
  useEffect(() => {
    if (Platform.OS === 'android') {
      BackgroundJob.define({
        jobKey: 'monitoring_sync',
        job: () => {
          // Sync data in background
          api.getMetrics().then(response => {
            if (response.success && response.data) {
              // Handle background data update
              // Send local notification for critical alerts if needed
            }
          });
        }
      });
      
      BackgroundJob.setGlobalOptions({
        minimumBackgroundTime: 15000,
      });
      
      return () => {
        BackgroundJob.stop({ jobKey: 'monitoring_sync' });
      };
    }
  }, []);

  return (
    <NavigationContainer theme={currentTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: string;

            if (route.name === 'Dashboard') {
              iconName = 'dashboard';
            } else if (route.name === 'Alerts') {
              iconName = 'notifications';
            } else if (route.name === 'Settings') {
              iconName = 'settings';
            } else {
              iconName = 'help';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: currentTheme.colors.primary,
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: currentTheme.colors.card,
            borderTopColor: currentTheme.colors.border,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard">
          {() => <DashboardScreen config={config} api={api} theme={currentTheme} />}
        </Tab.Screen>
        <Tab.Screen name="Alerts">
          {() => <AlertsScreen config={config} api={api} theme={currentTheme} />}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {() => <SettingsScreen config={config} onConfigChange={handleConfigChange} theme={currentTheme} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  networkIcon: {
    marginRight: 8,
  },
  alertCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  chartContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  eventsContainer: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 12,
  },
  eventItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  eventDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  oauthContainer: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  oauthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  oauthProvider: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  oauthStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  oauthStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
  alertsList: {
    padding: 16,
  },
  alertItem: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertSeverity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertSeverityText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  alertTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  alertDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    opacity: 0.8,
  },
  acknowledgedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acknowledgedText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  acknowledgeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  acknowledgeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsSection: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  testButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingsToggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingsValue: {
    fontSize: 14,
    opacity: 0.7,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});

export default App;