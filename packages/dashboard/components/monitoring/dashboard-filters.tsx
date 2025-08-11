'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Clock, 
  X,
  User, 
  Lock, 
  Zap, 
  CreditCard, 
  Database, 
  Settings, 
  Shield, 
  Rocket, 
  XCircle 
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { DashboardFilters, EventCategory, EventSeverity, TimeRange } from '@/types/monitoring';

interface DashboardFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: Partial<DashboardFilters>) => void;
  eventStats?: Record<string, number>;
  className?: string;
}

const categoryIcons = {
  user: User,
  auth: Lock,
  api: Zap,
  payment: CreditCard,
  dataset: Database,
  system: Settings,
  security: Shield,
  deployment: Rocket,
  error: XCircle
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export function DashboardFiltersComponent({
  filters,
  onFiltersChange,
  eventStats = {},
  className = ""
}: DashboardFiltersProps) {
  const handleSearchChange = (query: string) => {
    onFiltersChange({ searchQuery: query });
  };

  const handleCategoryChange = (category: EventCategory) => {
    onFiltersChange({ category });
  };

  const handleSeverityChange = (severity: EventSeverity) => {
    onFiltersChange({ severity });
  };

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    onFiltersChange({ timeRange });
  };

  const clearSearch = () => {
    onFiltersChange({ searchQuery: '' });
  };

  return (
    <GlassCard className={`p-6 ${className}`}>
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <motion.div 
          className="flex-1 min-w-[280px] relative"
          variants={itemVariants}
        >
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <motion.input
            type="text"
            placeholder="Search events, titles, descriptions..."
            value={filters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 text-white rounded-xl 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                      backdrop-blur-sm transition-all duration-300 placeholder-gray-400"
            whileFocus={{ scale: 1.02 }}
          />
          {filters.searchQuery && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-gray-500 
                        flex items-center justify-center text-white text-xs hover:bg-gray-400 transition-colors"
              onClick={clearSearch}
            >
              <X className="w-3 h-3" />
            </motion.button>
          )}
        </motion.div>

        {/* Category Filter */}
        <motion.div className="relative" variants={itemVariants}>
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={filters.category}
            onChange={(e) => handleCategoryChange(e.target.value as EventCategory)}
            className="pl-10 pr-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                      backdrop-blur-sm transition-all duration-300 appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="all" className="bg-gray-800">All Categories</option>
            <option value="user" className="bg-gray-800">User</option>
            <option value="auth" className="bg-gray-800">Auth</option>
            <option value="api" className="bg-gray-800">API</option>
            <option value="payment" className="bg-gray-800">Payment</option>
            <option value="dataset" className="bg-gray-800">Dataset</option>
            <option value="system" className="bg-gray-800">System</option>
            <option value="security" className="bg-gray-800">Security</option>
            <option value="deployment" className="bg-gray-800">Deployment</option>
            <option value="error" className="bg-gray-800">Error</option>
          </select>
        </motion.div>

        {/* Severity Filter */}
        <motion.div className="relative" variants={itemVariants}>
          <select
            value={filters.severity}
            onChange={(e) => handleSeverityChange(e.target.value as EventSeverity)}
            className="px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                      backdrop-blur-sm transition-all duration-300 appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="all" className="bg-gray-800">All Severities</option>
            <option value="info" className="bg-gray-800">Info</option>
            <option value="warning" className="bg-gray-800">Warning</option>
            <option value="error" className="bg-gray-800">Error</option>
            <option value="critical" className="bg-gray-800">Critical</option>
          </select>
        </motion.div>

        {/* Time Range */}
        <motion.div className="relative" variants={itemVariants}>
          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={filters.timeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
            className="pl-10 pr-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                      backdrop-blur-sm transition-all duration-300 appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="1h" className="bg-gray-800">Last Hour</option>
            <option value="24h" className="bg-gray-800">Last 24 Hours</option>
            <option value="7d" className="bg-gray-800">Last 7 Days</option>
            <option value="30d" className="bg-gray-800">Last 30 Days</option>
          </select>
        </motion.div>
      </div>

      {/* Category Stats */}
      {Object.keys(eventStats).length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-white/10"
        >
          {Object.entries(eventStats).map(([category, count], index) => {
            const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
            if (!IconComponent) return null;
            
            return (
              <motion.button
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  filters.category === category 
                    ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300' 
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
                onClick={() => handleCategoryChange(category as EventCategory)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <IconComponent className="w-4 h-4" />
                <span className="capitalize">{category}:</span>
                <motion.span 
                  className="font-medium"
                  key={count}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                >
                  {count}
                </motion.span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </GlassCard>
  );
}

// Quick filter buttons
export function QuickFilters({
  onFilterClick,
  activeFilter,
  className = ""
}: {
  onFilterClick: (filter: { category?: EventCategory; severity?: EventSeverity }) => void;
  activeFilter?: string;
  className?: string;
}) {
  const quickFilters = [
    { label: 'Critical Issues', category: 'error' as EventCategory, severity: 'critical' as EventSeverity, color: 'red' },
    { label: 'Auth Problems', category: 'auth' as EventCategory, color: 'amber' },
    { label: 'API Errors', category: 'api' as EventCategory, severity: 'error' as EventSeverity, color: 'orange' },
    { label: 'Security Alerts', category: 'security' as EventCategory, color: 'purple' },
    { label: 'System Issues', category: 'system' as EventCategory, color: 'blue' },
  ];

  const colorStyles = {
    red: 'border-red-500/40 text-red-300 hover:bg-red-500/10',
    amber: 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10',
    orange: 'border-orange-500/40 text-orange-300 hover:bg-orange-500/10',
    purple: 'border-purple-500/40 text-purple-300 hover:bg-purple-500/10',
    blue: 'border-blue-500/40 text-blue-300 hover:bg-blue-500/10',
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {quickFilters.map((filter, index) => (
        <motion.button
          key={filter.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`px-3 py-2 border backdrop-blur-sm rounded-lg text-sm font-medium transition-all duration-200 ${
            colorStyles[filter.color as keyof typeof colorStyles]
          }`}
          onClick={() => onFilterClick(filter)}
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
        >
          {filter.label}
        </motion.button>
      ))}
    </div>
  );
}