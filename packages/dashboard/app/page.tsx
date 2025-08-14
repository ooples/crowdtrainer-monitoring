'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  RefreshCw, 
  Download, 
  Pause, 
  Play, 
  Clock, 
  Server, 
  Users, 
  Zap, 
  TrendingUp,
  Shield,
  Eye,
  Settings
} from 'lucide-react';

// Components
import { GlassCard } from '@/components/ui/glass-card';
import { MetricsCard, MiniChart } from '@/components/monitoring/metrics-card';
import { EventList } from '@/components/monitoring/event-list';
import { AlertsPanel } from '@/components/monitoring/alerts-panel';
import { DashboardFiltersComponent } from '@/components/monitoring/dashboard-filters';
import { UnifiedActivityPanel } from '@/components/monitoring/unified-activity-panel';
import { ModeSwitcher } from '@/components/ui/mode-switcher';
import { SmartNotifications, useSmartNotifications } from '@/components/ui/smart-notifications';
import { ShortcutHelper } from '@/components/ui/shortcut-helper';
import { AdminPanel } from '@/components/admin/AdminPanel';

// Providers
import { ModeProvider } from '@/components/providers/mode-provider';
import { AdminModeProvider } from '@/components/providers/admin-mode-provider';
import { A11yProvider } from '@/components/accessibility/A11yProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

// Hooks
import { useDashboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMode } from '@/components/providers/mode-provider';
import { useAdminMode } from '@/components/providers/admin-mode-provider';

// Types and utilities
import { 
  SystemMetrics, 
  Alert, 
  Event, 
  DashboardFilters, 
  EventCategory, 
  EventSeverity, 
  TimeRange 
} from '@/types/monitoring';
import { createApiClient } from '@/lib/api-client';
import { defaultConfig } from '@/lib/config';
import { formatTimeAgo, exportToJson } from '@/lib/utils';
import { demoEvents, demoAlerts, demoMetrics, updateMetricsWithRealtimeData } from '@/lib/demo-data';
import { printAccessibilityReport } from '@/lib/accessibility-test';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 10
    }
  }
};

function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  
  // Announcement function for screen readers
  const announce = (message: string) => {
    setAnnouncements(prev => [...prev, message]);
    // Clear announcement after 3 seconds to prevent clutter
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 3000);
  };
  
  // Smart notifications
  const { 
    notifications, 
    addNotification, 
    dismissNotification, 
    clearAll: clearAllNotifications 
  } = useSmartNotifications();
  
  // Keyboard shortcuts
  const shortcuts = useDashboardShortcuts();
  
  // Mode and admin contexts
  const { mode, canShowFeature } = useMode();
  const { isAdminMode } = useAdminMode();
  
  // Data state
  const [metrics, setMetrics] = useState<SystemMetrics>({
    systemHealth: 'checking',
    activeUsers: 0,
    apiLatency: 0,
    errorRate: 0,
    lastUpdated: '',
    recentEvents: []
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  // Filter state
  const [filters, setFilters] = useState<DashboardFilters>({
    category: 'all',
    severity: 'all',
    timeRange: '24h',
    searchQuery: ''
  });

  // API client
  const apiClient = useMemo(() => createApiClient(defaultConfig), []);

  // Filter events based on criteria
  const filteredEvents = useMemo(() => {
    if (!metrics.recentEvents) return [];
    
    return metrics.recentEvents.filter((event: Event) => {
      // Category filter
      if (filters.category !== 'all' && event.category !== filters.category) return false;
      
      // Severity filter
      if (filters.severity !== 'all' && event.severity !== filters.severity) return false;
      
      // Search filter
      if (filters.searchQuery && 
          !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
          !event.description.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      
      // Time range filter
      const eventTime = new Date(event.timestamp).getTime();
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      
      if (now - eventTime > ranges[filters.timeRange]) return false;
      
      return true;
    });
  }, [metrics.recentEvents, filters]);

  // Count events by category for stats
  const eventStats = useMemo(() => {
    if (!metrics.recentEvents) return {};
    
    const stats: Record<string, number> = {};
    metrics.recentEvents.forEach((event: Event) => {
      stats[event.category] = (stats[event.category] || 0) + 1;
    });
    return stats;
  }, [metrics.recentEvents]);

  // Fetch data functions
  const fetchMetrics = async () => {
    try {
      const response = await apiClient.getMetrics();
      if (response.success && response.data) {
        const oldHealth = metrics.systemHealth;
        const oldErrorRate = metrics.errorRate;
        const oldActiveUsers = metrics.activeUsers;
        
        setMetrics(response.data);
        
        // Announce significant changes for screen readers
        if (oldHealth !== 'checking' && response.data.systemHealth !== oldHealth) {
          announce(`System health changed from ${oldHealth} to ${response.data.systemHealth}`);
          
          // Smart notification for health changes
          addNotification({
            type: response.data.systemHealth === 'critical' ? 'error' : 
                  response.data.systemHealth === 'degraded' ? 'warning' : 'success',
            title: 'System Health Changed',
            message: `System health is now ${response.data.systemHealth}`,
            priority: response.data.systemHealth === 'critical' ? 'critical' : 'medium',
            category: 'system'
          });
        }
        
        // Announce significant error rate changes
        if (oldErrorRate > 0 && Math.abs(response.data.errorRate - oldErrorRate) > 2) {
          announce(`Error rate changed from ${oldErrorRate}% to ${response.data.errorRate}%`);
        }
        
        // Announce if there's a significant user count change (more than 20% change)
        if (oldActiveUsers > 0 && Math.abs(response.data.activeUsers - oldActiveUsers) / oldActiveUsers > 0.2) {
          announce(`Active users changed from ${oldActiveUsers} to ${response.data.activeUsers}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch metrics, using demo data:', error);
      
      // Use demo data with real-time simulation
      const oldHealth = metrics.systemHealth;
      const updatedDemoMetrics = updateMetricsWithRealtimeData(metrics.lastUpdated ? metrics : demoMetrics);
      setMetrics(updatedDemoMetrics);
      
      // Show notification about using demo data (only once)
      if (oldHealth === 'checking') {
        addNotification({
          type: 'info',
          title: 'Demo Mode Active',
          message: 'Using simulated data - monitoring API unavailable',
          priority: 'low',
          category: 'system',
          autoClose: false
        });
      }
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await apiClient.getAlerts();
      if (response.success && response.data) {
        setAlerts(response.data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts, using demo data:', error);
      setAlerts(demoAlerts);
    }
  };

  // Initialize and set up auto-refresh
  useEffect(() => {
    setMounted(true);
    setLoading(true);
    
    const initialize = async () => {
      await Promise.all([fetchMetrics(), fetchAlerts()]);
      setLoading(false);
      
      // Run accessibility test in development mode after a delay to let everything render
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          printAccessibilityReport();
          console.log('💡 Tip: Type testAccessibility() in the console to run accessibility tests anytime');
        }, 2000);
      }
    };
    
    initialize();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchMetrics();
        fetchAlerts();
      }, defaultConfig.refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Handlers
  const handleFiltersChange = (newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExportData = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
      alerts,
      events: filteredEvents,
      filters
    };
    
    exportToJson(exportData, 'monitoring-dashboard');
  };

  const handleEventClick = (event: Event) => {
    console.log('Event clicked:', event);
  };

  const handleAlertClick = (alert: Alert) => {
    console.log('Alert clicked:', alert);
  };

  // Generate mock mini chart data
  const generateChartData = (baseValue: number, points: number = 8) => {
    return Array.from({ length: points }, () => 
      Math.max(0, baseValue + (Math.random() - 0.5) * baseValue * 0.4)
    );
  };

  if (!mounted) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 relative overflow-hidden">
      {/* Skip Navigation */}
      <nav className="sr-only focus-within:not-sr-only" aria-label="Skip navigation">
        <a 
          href="#dashboard-header" 
          className="absolute top-4 left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Skip to dashboard header
        </a>
        <a 
          href="#metrics-section" 
          className="absolute top-4 left-40 z-50 px-4 py-2 bg-blue-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Skip to metrics
        </a>
        <a 
          href="#activity-section" 
          className="absolute top-4 left-60 z-50 px-4 py-2 bg-blue-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Skip to activity
        </a>
      </nav>
      {/* Animated Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-purple-900/20"></div>
        <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute top-40 -right-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-4000"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6 lg:space-y-8"
        >
          {/* Header */}
          <header id="dashboard-header" role="banner">
            <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <motion.h1 
                className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {defaultConfig.theme.brandName}
              </motion.h1>
              <motion.div
                animate={{ 
                  boxShadow: [
                    "0 0 20px rgba(59, 130, 246, 0.3)",
                    "0 0 40px rgba(59, 130, 246, 0.5)",
                    "0 0 20px rgba(59, 130, 246, 0.3)"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-3 h-3 bg-blue-500 rounded-full"
              />
              
              {/* Mode indicator for simple mode */}
              {mode === 'simple' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="hidden sm:flex px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-green-300 text-sm font-medium"
                >
                  Simple Mode
                </motion.div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 lg:gap-6">
              {/* Mode Switcher */}
              <ModeSwitcher />
              
              <motion.div variants={itemVariants} className="flex flex-wrap gap-3 items-center justify-center sm:justify-start">
              <motion.button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`group relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  autoRefresh 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25' 
                    : 'bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                aria-pressed={autoRefresh}
                aria-label={autoRefresh ? 'Turn off auto-refresh' : 'Turn on auto-refresh'}
                title={autoRefresh ? 'Auto-refresh is currently enabled' : 'Auto-refresh is currently disabled'}
              >
                <div className="flex items-center gap-2">
                  {autoRefresh ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    </motion.div>
                  ) : (
                    <Play className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                  </span>
                  <span className="sm:hidden">
                    {autoRefresh ? 'ON' : 'OFF'}
                  </span>
                </div>
              </motion.button>
              
{canShowFeature('advanced') && (
                <motion.button
                  onClick={handleExportData}
                  data-action="export"
                  className="group relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="Export dashboard data as JSON file"
                  title="Download current dashboard data and metrics"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Export Data</span>
                    <span className="sm:hidden">Export</span>
                  </div>
                </motion.button>
              )}
              
              <motion.div 
                className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
                variants={itemVariants}
              >
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Last updated: {metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleTimeString() : 'Never'}</span>
                  <span className="sm:hidden">{metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleTimeString() : 'Never'}</span>
                </div>
              </motion.div>
              </motion.div>
            </div>
            </motion.div>
          </header>

          {/* Admin Panel - Shows as integrated section at TOP when admin mode is active */}
          <AnimatePresence>
            {isAdminMode && (
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <AdminPanel 
                  apiUrl={defaultConfig.apiUrl}
                  apiKey={defaultConfig.apiKey}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Alerts */}
          <AnimatePresence>
            {alerts.length > 0 && (
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <AlertsPanel 
                  alerts={alerts} 
                  loading={loading}
                  onAlertClick={handleAlertClick}
                  maxAlerts={3}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Metrics Cards */}
          <section id="metrics-section" aria-labelledby="metrics-heading" tabIndex={-1} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg">
            <h2 id="metrics-heading" className="sr-only">System Metrics</h2>
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <MetricsCard
              title="System Health"
              value={metrics.systemHealth}
              subtitle={metrics.system ? `CPU: ${metrics.system.cpuUsage}, RAM: ${metrics.system.memoryUsage}` : 'System status'}
              icon={Server}
              color="text-green-400"
              status={metrics.systemHealth}
              loading={loading}
            />

            <MetricsCard
              title="Active Users"
              value={metrics.activeUsers}
              subtitle="Currently online"
              icon={Users}
              color="text-blue-400"
              loading={loading}
              chart={<MiniChart data={generateChartData(metrics.activeUsers)} color="blue" />}
            />

            <MetricsCard
              title="API Latency"
              value={metrics.apiLatency}
              subtitle="Average response time"
              suffix="ms"
              icon={Zap}
              color="text-yellow-400"
              loading={loading}
              progress={Math.min((metrics.apiLatency / 500) * 100, 100)}
            />

            <MetricsCard
              title="Error Rate"
              value={metrics.errorRate}
              subtitle={metrics.api ? `${metrics.api.errorsLastHour} errors in last hour` : 'No recent errors'}
              suffix="%"
              icon={TrendingUp}
              color="text-red-400"
              loading={loading}
              trend={{
                direction: metrics.errorRate > 5 ? 'up' : 'down',
                value: Math.round(Math.random() * 20)
              }}
            />
            </motion.div>
          </section>

          {/* Filters - Show for advanced and expert modes */}
          {canShowFeature('advanced') && (
            <DashboardFiltersComponent
              filters={filters}
              onFiltersChange={handleFiltersChange}
              eventStats={eventStats}
            />
          )}

          {/* Unified Activity Panel */}
          <section id="activity-section" aria-labelledby="activity-heading" tabIndex={-1} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg">
            <h2 id="activity-heading" className="sr-only">System Activity and Events</h2>
            <UnifiedActivityPanel
            events={filteredEvents}
            alerts={alerts}
            loading={loading}
            onEventClick={handleEventClick}
            onAlertClick={handleAlertClick}
          />
          </section>

          {/* OAuth Status - Advanced and Expert modes only */}
          <AnimatePresence>
            {metrics.oauth && canShowFeature('advanced') && (
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <GlassCard className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-6 h-6 text-green-400" />
                    <h2 className="text-2xl font-semibold text-white">OAuth Provider Status</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(metrics.oauth).map(([provider, status], index) => (
                      <motion.div
                        key={provider}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative overflow-hidden rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition-all duration-300"
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.div
                              className="w-3 h-3 rounded-full"
                              animate={{ 
                                boxShadow: status === 'operational' 
                                  ? ['0 0 0 0 rgba(34, 197, 94, 0.7)', '0 0 20px 4px rgba(34, 197, 94, 0)', '0 0 0 0 rgba(34, 197, 94, 0)']
                                  : status === 'degraded'
                                  ? ['0 0 0 0 rgba(234, 179, 8, 0.7)', '0 0 20px 4px rgba(234, 179, 8, 0)', '0 0 0 0 rgba(234, 179, 8, 0)']
                                  : ['0 0 0 0 rgba(239, 68, 68, 0.7)', '0 0 20px 4px rgba(239, 68, 68, 0)', '0 0 0 0 rgba(239, 68, 68, 0)']
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                              style={{
                                backgroundColor: status === 'operational' ? '#22c55e' :
                                               status === 'degraded' ? '#eab308' : '#ef4444'
                              }}
                            />
                            <span className="capitalize text-white font-medium">{provider}</span>
                          </div>
                          
                          <motion.span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              status === 'operational' 
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 text-green-300' :
                              status === 'degraded' 
                                ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/40 text-yellow-300' 
                                : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/40 text-red-300'
                            }`}
                            whileHover={{ scale: 1.05 }}
                          >
                            {status as string}
                          </motion.span>
                        </div>
                        
                        <motion.div
                          className={`absolute bottom-0 left-0 h-0.5 ${
                            status === 'operational' ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                            status === 'degraded' ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                            'bg-gradient-to-r from-red-500 to-rose-400'
                          }`}
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.5, delay: index * 0.2 }}
                        />
                      </motion.div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
      
      {/* Smart Notifications */}
      <SmartNotifications
        notifications={notifications}
        onDismiss={dismissNotification}
        maxVisible={mode === 'simple' ? 3 : mode === 'advanced' ? 5 : 8}
      />
      
      {/* Keyboard Shortcut Helper */}
      <ShortcutHelper shortcuts={shortcuts} />
      
      {/* Live Region for Screen Reader Announcements */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {announcements.map((announcement, index) => (
          <div key={`${announcement}-${index}`}>
            {announcement}
          </div>
        ))}
      </div>
      
      {/* Critical Alert Live Region */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {alerts.filter(alert => alert.severity === 'critical').length > 0 && (
          <div>
            Critical alert: {alerts.filter(alert => alert.severity === 'critical').length} critical alerts require attention
          </div>
        )}
      </div>
    </div>
  );
}

// Main component with providers
export default function MonitoringDashboard() {
  return (
    <ThemeProvider defaultTheme="dark-modern">
      <A11yProvider>
        <ModeProvider defaultMode="simple">
          <AdminModeProvider>
            <DashboardContent />
          </AdminModeProvider>
        </ModeProvider>
      </A11yProvider>
    </ThemeProvider>
  );
}

// Loading screen component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-purple-900/20"></div>
      <div className="relative max-w-7xl mx-auto p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-8 w-64">
            <div className="invisible">Loading...</div>
          </div>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
        
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl shadow-2xl p-6">
              <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-4 w-24 mb-3">
                <div className="invisible">Loading...</div>
              </div>
              <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-8 w-16 mb-2">
                <div className="invisible">Loading...</div>
              </div>
              <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-3 w-32">
                <div className="invisible">Loading...</div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl shadow-2xl p-6">
          <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-6 w-40 mb-4">
            <div className="invisible">Loading...</div>
          </div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-8 w-8 rounded-full">
                  <div className="invisible">Loading...</div>
                </div>
                <div className="flex-1">
                  <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-4 w-48 mb-2">
                    <div className="invisible">Loading...</div>
                  </div>
                  <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-3 w-32">
                    <div className="invisible">Loading...</div>
                  </div>
                </div>
                <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-4 w-16">
                  <div className="invisible">Loading...</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}