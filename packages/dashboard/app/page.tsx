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
  Eye
} from 'lucide-react';

// Components
import { GlassCard } from '@/components/ui/glass-card';
import { MetricsCard, MiniChart } from '@/components/monitoring/metrics-card';
import { EventList } from '@/components/monitoring/event-list';
import { AlertsPanel } from '@/components/monitoring/alerts-panel';
import { DashboardFiltersComponent } from '@/components/monitoring/dashboard-filters';

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

export default function MonitoringDashboard() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
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
        setMetrics(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setMetrics(prev => ({ 
        ...prev, 
        lastUpdated: new Date().toISOString(),
        systemHealth: 'critical'
      }));
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await apiClient.getAlerts();
      if (response.success && response.data) {
        setAlerts(response.data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  // Initialize and set up auto-refresh
  useEffect(() => {
    setMounted(true);
    setLoading(true);
    
    const initialize = async () => {
      await Promise.all([fetchMetrics(), fetchAlerts()]);
      setLoading(false);
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
      {/* Animated Background */}
      <div className="absolute inset-0">
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

      <div className="relative max-w-7xl mx-auto p-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <motion.h1 
                className="text-4xl font-bold gradient-text"
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
            </div>
            
            <motion.div variants={itemVariants} className="flex gap-3 items-center">
              <motion.button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`group relative px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  autoRefresh 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25' 
                    : 'bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  {autoRefresh ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                </div>
              </motion.button>
              
              <motion.button
                onClick={handleExportData}
                className="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Data
                </div>
              </motion.button>
              
              <motion.div 
                className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
                variants={itemVariants}
              >
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Last updated: {metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleTimeString() : 'Never'}</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

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
          <motion.div variants={itemVariants} className="grid grid-cols-4 gap-6">
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

          {/* Filters */}
          <DashboardFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            eventStats={eventStats}
          />

          {/* Events Section */}
          <GlassCard className="p-6">
            <motion.div 
              className="flex justify-between items-center mb-6"
              variants={itemVariants}
            >
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-semibold text-white">Recent Activity</h2>
                <motion.div
                  className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-sm font-medium"
                  key={filteredEvents.length}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {filteredEvents.length} events
                </motion.div>
              </div>
              
              <motion.div
                className="flex items-center gap-2 text-sm text-gray-400"
                variants={itemVariants}
              >
                <Eye className="w-4 h-4" />
                <span>Live monitoring</span>
              </motion.div>
            </motion.div>

            <EventList
              events={filteredEvents}
              loading={loading}
              onEventClick={handleEventClick}
            />
          </GlassCard>

          {/* OAuth Status */}
          <AnimatePresence>
            {metrics.oauth && (
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
    </div>
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