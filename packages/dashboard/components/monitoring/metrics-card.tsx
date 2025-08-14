'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { MetricCardSkeleton } from '@/components/ui/loading-skeleton';
import { formatMetricValue } from '@/lib/utils';
import { MetricsCardProps } from '@/types/monitoring';

interface ExtendedMetricsCardProps extends MetricsCardProps {
  status?: string;
  progress?: number;
  chart?: React.ReactNode;
  suffix?: string;
  prefix?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    label?: string;
  };
}

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const trendColors = {
  up: 'text-green-400',
  down: 'text-red-400',
  stable: 'text-gray-400',
};

export function MetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  status,
  progress,
  chart,
  suffix = '',
  prefix = '',
  trend,
  loading = false,
  className = ""
}: ExtendedMetricsCardProps) {
  if (loading) {
    return <MetricCardSkeleton className={className} />;
  }

  const numericValue = typeof value === 'number' ? value : 
    typeof value === 'string' ? parseFloat(value) || 0 : 
    value != null ? parseFloat(String(value)) || 0 : 0;
  const TrendIcon = trend ? trendIcons[trend.direction] : null;

  return (
    <GlassCard 
      className={`group p-6 ${className}`} 
      hover
      role="article"
      ariaLabel={`${title} metric: ${value != null ? formatMetricValue(value) : '0'} ${suffix}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 text-gray-400 group-hover:text-white transition-colors ${color}`} aria-hidden="true" />
          <h3 className="text-gray-400 group-hover:text-gray-300 transition-colors font-medium" id={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
            {title}
          </h3>
        </div>
        {status && <StatusIndicator status={status} size="sm" aria-label={`Status: ${status}`} />}
      </div>

      <motion.div 
        className="text-3xl font-bold text-white mb-2"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        key={value}
        aria-labelledby={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
        aria-describedby={`metric-subtitle-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <span aria-label={`Current value: ${formatMetricValue(numericValue)} ${suffix}`}>
          {prefix}
          <AnimatedNumber value={numericValue} />
          {suffix}
        </span>
      </motion.div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400" id={`metric-subtitle-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {subtitle}
        </div>
        
        {trend && TrendIcon && (
          <div className={`flex items-center gap-1 text-sm ${trendColors[trend.direction]}`} aria-label={`Trend: ${trend.direction} by ${trend.value} percent ${trend.label || ''}`}>
            <TrendIcon className="w-3 h-3" aria-hidden="true" />
            <span aria-hidden="true">{trend.value}%</span>
            {trend.label && <span className="text-gray-500 ml-1" aria-hidden="true">{trend.label}</span>}
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progress: ${progress.toFixed(1)} percent`}>
          <div className="relative">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full bg-gradient-to-r ${getProgressColor(progress)}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1" aria-hidden="true">
              {progress.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {chart && (
        <div className="mt-4" role="img" aria-label={`${title} chart showing trend data`}>
          {chart}
        </div>
      )}

      {/* Gradient decoration */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-xl ${getGradientColor(color)} opacity-60`} />
    </GlassCard>
  );
}

function getProgressColor(progress: number): string {
  if (progress < 30) return 'from-red-500 to-rose-400';
  if (progress < 70) return 'from-amber-500 to-yellow-400';
  return 'from-emerald-500 to-green-400';
}

function getGradientColor(color: string): string {
  if (color.includes('blue')) return 'bg-gradient-to-r from-blue-500 to-cyan-400';
  if (color.includes('green')) return 'bg-gradient-to-r from-green-500 to-emerald-400';
  if (color.includes('yellow')) return 'bg-gradient-to-r from-yellow-500 to-orange-400';
  if (color.includes('red')) return 'bg-gradient-to-r from-red-500 to-rose-400';
  if (color.includes('purple')) return 'bg-gradient-to-r from-purple-500 to-pink-400';
  return 'bg-gradient-to-r from-gray-500 to-slate-400';
}

// Mini chart component for metrics cards
export function MiniChart({ data, color = 'blue' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const dataDescription = `Chart showing ${data.length} data points ranging from ${min.toFixed(1)} to ${max.toFixed(1)}`;
  const [focusedPoint, setFocusedPoint] = React.useState<number | null>(null);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentIndex = focusedPoint ?? -1;
      if (e.key === 'ArrowRight' && currentIndex < data.length - 1) {
        setFocusedPoint(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setFocusedPoint(currentIndex - 1);
      } else if (e.key === 'ArrowLeft' && currentIndex === -1) {
        setFocusedPoint(data.length - 1);
      }
    } else if (e.key === 'Escape') {
      setFocusedPoint(null);
    }
  };

  // Listen for custom chart navigation events
  React.useEffect(() => {
    const chartElement = document.activeElement?.closest('[role="img"]');
    if (!chartElement) return;

    const handleNextPoint = () => {
      const currentIndex = focusedPoint ?? -1;
      if (currentIndex < data.length - 1) {
        setFocusedPoint(currentIndex + 1);
      }
    };

    const handlePrevPoint = () => {
      const currentIndex = focusedPoint ?? -1;
      if (currentIndex > 0) {
        setFocusedPoint(currentIndex - 1);
      } else if (currentIndex === -1) {
        setFocusedPoint(data.length - 1);
      }
    };

    chartElement.addEventListener('chart-next-point', handleNextPoint);
    chartElement.addEventListener('chart-prev-point', handlePrevPoint);

    return () => {
      chartElement.removeEventListener('chart-next-point', handleNextPoint);
      chartElement.removeEventListener('chart-prev-point', handlePrevPoint);
    };
  }, [focusedPoint, data.length]);

  return (
    <div 
      className="flex items-end gap-1 h-6 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" 
      role="img" 
      aria-label={focusedPoint !== null 
        ? `${dataDescription}. Currently focused on point ${focusedPoint + 1} with value ${data[focusedPoint].toFixed(1)}`
        : dataDescription
      }
      title={dataDescription}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {data.map((value, i) => (
        <motion.div
          key={i}
          className={`bg-gradient-to-t ${getChartColor(color)} rounded-sm flex-1 relative ${
            focusedPoint === i ? 'ring-2 ring-white' : ''
          }`}
          initial={{ height: 0 }}
          animate={{ height: `${((value - min) / range) * 100}%` }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          aria-hidden="true"
        >
          {focusedPoint === i && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              {value.toFixed(1)}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function getChartColor(color: string): string {
  switch (color) {
    case 'blue': return 'from-blue-500 to-cyan-400';
    case 'green': return 'from-green-500 to-emerald-400';
    case 'yellow': return 'from-yellow-500 to-orange-400';
    case 'red': return 'from-red-500 to-rose-400';
    case 'purple': return 'from-purple-500 to-pink-400';
    default: return 'from-blue-500 to-cyan-400';
  }
}

// Specialized metric cards
export function SystemHealthCard({ systemHealth, cpuUsage, memoryUsage, loading }: {
  systemHealth: string;
  cpuUsage?: string;
  memoryUsage?: string;
  loading?: boolean;
}) {
  return (
    <MetricsCard
      title="System Health"
      value={systemHealth}
      subtitle={cpuUsage && memoryUsage ? `CPU: ${cpuUsage}, RAM: ${memoryUsage}` : 'System status'}
      icon={() => <div className="w-5 h-5" />} // Server icon would go here
      color="text-green-400"
      status={systemHealth}
      loading={loading}
    />
  );
}

export function ApiLatencyCard({ latency, loading }: { latency: number; loading?: boolean }) {
  return (
    <MetricsCard
      title="API Latency"
      value={latency}
      subtitle="Average response time"
      suffix="ms"
      icon={() => <div className="w-5 h-5" />} // Zap icon would go here
      color="text-yellow-400"
      progress={Math.min((latency / 500) * 100, 100)}
      trend={{
        direction: latency < 100 ? 'down' : latency > 300 ? 'up' : 'stable',
        value: Math.round(Math.random() * 20 - 10) // Mock trend
      }}
      loading={loading}
    />
  );
}