'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { 
  Activity, 
  RefreshCw, 
  Server, 
  Users, 
  Zap, 
  TrendingUp,
  Minimize2,
  Maximize2
} from 'lucide-react';

// Components
import { GlassCard } from '@/components/ui/glass-card';
import { MetricsCard, MiniChart } from '@/components/monitoring/metrics-card';
import { EventList } from '@/components/monitoring/event-list';
import { AlertsPanel, AlertsSummary } from '@/components/monitoring/alerts-panel';

// Types and utilities
import { 
  SystemMetrics, 
  Alert, 
  Event, 
  DashboardFilters,
  BrandConfig 
} from '@/types/monitoring';
import { createApiClient } from '@/lib/api-client';
import { defaultConfig, defaultBrandConfig, loadEmbedConfig } from '@/lib/config';
import { formatTimeAgo } from '@/lib/utils';

interface EmbedDashboardProps {
  compact?: boolean;
  showHeader?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxEvents?: number;
  brandConfig?: BrandConfig;
}

// Animation variants for embed mode (more subtle)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 15
    }
  }
};

export default function EmbedDashboard() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  // Configuration from URL parameters
  const embedConfig = useMemo(() => {
    if (!searchParams) return {};
    return loadEmbedConfig(searchParams);
  }, [searchParams]);

  // Parse embed-specific parameters
  const showHeader = searchParams?.get('showHeader') !== 'false';
  const showFilters = searchParams?.get('showFilters') !== 'false';
  const showExport = searchParams?.get('showExport') === 'true';
  const compact = searchParams?.get('compact') === 'true';
  const autoRefresh = searchParams?.get('autoRefresh') !== 'false';
  const maxEvents = parseInt(searchParams?.get('maxEvents') || '10');

  // Brand configuration
  const brandConfig: BrandConfig = {
    ...defaultBrandConfig,
    name: searchParams?.get('brandName') || defaultBrandConfig.name,
    colors: {
      ...defaultBrandConfig.colors,
      primary: searchParams?.get('primaryColor') || defaultBrandConfig.colors.primary,
      secondary: searchParams?.get('secondaryColor') || defaultBrandConfig.colors.secondary,
      accent: searchParams?.get('accentColor') || defaultBrandConfig.colors.accent,
    },
    logo: searchParams?.get('logoUrl') ? {
      url: searchParams.get('logoUrl')!,
      width: parseInt(searchParams.get('logoWidth') || '120'),
      height: parseInt(searchParams.get('logoHeight') || '40'),
    } : undefined
  };

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

  // API client with embed config
  const apiClient = useMemo(() => {
    const config = {
      ...defaultConfig,
      ...embedConfig,
      maxEvents
    };
    return createApiClient(config);
  }, [embedConfig, maxEvents]);

  // Fetch data functions
  const fetchData = async () => {
    try {
      const [metricsResponse, alertsResponse] = await Promise.all([
        apiClient.getMetrics(),
        apiClient.getAlerts()
      ]);

      if (metricsResponse.success && metricsResponse.data) {
        setMetrics(metricsResponse.data);
      }

      if (alertsResponse.success && alertsResponse.data) {
        setAlerts(alertsResponse.data.alerts || []);
      }

      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMetrics(prev => ({ 
        ...prev, 
        lastUpdated: new Date().toISOString(),
        systemHealth: 'critical'
      }));
    }
  };

  // Initialize
  useEffect(() => {
    setMounted(true);
    setIsCompact(compact);
    setLoading(true);
    
    fetchData().finally(() => setLoading(false));
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchData, embedConfig.refreshInterval || 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, embedConfig.refreshInterval]);

  // Apply custom CSS if provided
  useEffect(() => {
    if (brandConfig.customCss) {
      const style = document.createElement('style');
      style.textContent = brandConfig.customCss;
      document.head.appendChild(style);
      
      return () => {
        document.head.removeChild(style);
      };
    }
  }, [brandConfig.customCss]);

  // Custom CSS variables for theming
  useEffect(() => {
    if (mounted) {
      document.documentElement.style.setProperty('--brand-primary', brandConfig.colors.primary);
      document.documentElement.style.setProperty('--brand-secondary', brandConfig.colors.secondary);
      document.documentElement.style.setProperty('--brand-accent', brandConfig.colors.accent);
    }
  }, [mounted, brandConfig.colors]);

  const generateChartData = (baseValue: number, points: number = 6) => {
    return Array.from({ length: points }, () => 
      Math.max(0, baseValue + (Math.random() - 0.5) * baseValue * 0.3)
    );
  };

  if (!mounted) {
    return <EmbedLoadingScreen compact={isCompact} />;
  }

  const filteredEvents = metrics.recentEvents?.slice(0, maxEvents) || [];

  return (
    <div className={`min-h-screen ${isCompact ? 'p-4' : 'p-6'} bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 relative overflow-hidden embed-mode`}>
      {/* Subtle background for embed */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Header */}
          {showHeader && (
            <motion.div variants={itemVariants} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {brandConfig.logo && (
                  <img 
                    src={brandConfig.logo.url} 
                    alt={brandConfig.name}
                    width={brandConfig.logo.width}
                    height={brandConfig.logo.height}
                    className="h-8 w-auto"
                  />
                )}
                <h1 className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold gradient-text`}>
                  {brandConfig.name}
                </h1>
                <motion.div
                  animate={{ 
                    boxShadow: [
                      `0 0 10px ${brandConfig.colors.primary}40`,
                      `0 0 20px ${brandConfig.colors.primary}60`,
                      `0 0 10px ${brandConfig.colors.primary}40`
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: brandConfig.colors.primary }}
                />
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCompact(!isCompact)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title={isCompact ? 'Expand view' : 'Compact view'}
                >
                  {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={fetchData}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                
                {lastUpdate && (
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(lastUpdate)}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Alerts Summary */}
          {alerts.length > 0 && (
            <motion.div variants={itemVariants}>
              <AlertsSummary alerts={alerts} />
            </motion.div>
          )}

          {/* Metrics */}
          <motion.div 
            variants={itemVariants} 
            className={`grid ${isCompact ? 'grid-cols-2 gap-4' : 'grid-cols-4 gap-6'}`}
          >
            <MetricsCard
              title="System"
              value={metrics.systemHealth}
              subtitle={metrics.system ? `CPU: ${metrics.system.cpuUsage}` : ''}
              icon={Server}
              color="text-green-400"
              status={metrics.systemHealth}
              loading={loading}
            />

            <MetricsCard
              title="Users"
              value={metrics.activeUsers}
              subtitle="Active"
              icon={Users}
              color="text-blue-400"
              loading={loading}
              chart={!isCompact ? <MiniChart data={generateChartData(metrics.activeUsers)} color="blue" /> : undefined}
            />

            {!isCompact && (
              <>
                <MetricsCard
                  title="Latency"
                  value={metrics.apiLatency}
                  subtitle="Response time"
                  suffix="ms"
                  icon={Zap}
                  color="text-yellow-400"
                  loading={loading}
                  progress={Math.min((metrics.apiLatency / 500) * 100, 100)}
                />

                <MetricsCard
                  title="Errors"
                  value={metrics.errorRate}
                  subtitle="Error rate"
                  suffix="%"
                  icon={TrendingUp}
                  color="text-red-400"
                  loading={loading}
                />
              </>
            )}
          </motion.div>

          {/* Events */}
          <motion.div variants={itemVariants}>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-blue-400" />
                <h2 className={`${isCompact ? 'text-lg' : 'text-xl'} font-semibold text-white`}>
                  Recent Activity
                </h2>
                <div className="px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-xs font-medium">
                  {filteredEvents.length}
                </div>
              </div>

              <EventList
                events={filteredEvents}
                loading={loading}
                maxHeight={isCompact ? '400px' : '500px'}
                showCategory={!isCompact}
              />
            </GlassCard>
          </motion.div>

          {/* Detailed alerts for non-compact mode */}
          {!isCompact && alerts.length > 0 && (
            <motion.div variants={itemVariants}>
              <AlertsPanel 
                alerts={alerts} 
                loading={loading}
                maxAlerts={3}
              />
            </motion.div>
          )}

          {/* Embed footer */}
          <motion.div 
            variants={itemVariants}
            className="text-center text-xs text-gray-500 pt-4 border-t border-white/10"
          >
            <span>Powered by {brandConfig.name} • Last updated {lastUpdate ? formatTimeAgo(lastUpdate) : 'Never'}</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Loading screen for embed mode
function EmbedLoadingScreen({ compact }: { compact: boolean }) {
  return (
    <div className={`min-h-screen ${compact ? 'p-4' : 'p-6'} bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800`}>
      <div className="relative max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-6 w-48">
            <div className="invisible">Loading...</div>
          </div>
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
        
        <div className={`grid ${compact ? 'grid-cols-2 gap-4' : 'grid-cols-4 gap-6'} mb-6`}>
          {[...Array(compact ? 2 : 4)].map((_, i) => (
            <div key={i} className="glass p-4">
              <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-3 w-16 mb-2">
                <div className="invisible">Loading...</div>
              </div>
              <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-6 w-12 mb-1">
                <div className="invisible">Loading...</div>
              </div>
              <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-3 w-20">
                <div className="invisible">Loading...</div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="glass p-4">
          <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-5 w-32 mb-4">
            <div className="invisible">Loading...</div>
          </div>
          <div className="space-y-3">
            {[...Array(compact ? 3 : 5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-6 w-6 rounded-full">
                  <div className="invisible">Loading...</div>
                </div>
                <div className="flex-1">
                  <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-3 w-3/4 mb-1">
                    <div className="invisible">Loading...</div>
                  </div>
                  <div className="animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-3 w-1/2">
                    <div className="invisible">Loading...</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}