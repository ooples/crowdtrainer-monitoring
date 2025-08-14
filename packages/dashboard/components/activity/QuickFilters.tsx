'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Filter, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  Info, 
  Eye,
  EyeOff,
  Clock,
  User,
  Lock,
  Zap,
  CreditCard,
  Database,
  Settings,
  Shield,
  Rocket
} from 'lucide-react';
import { EventSeverity, EventCategory } from '@/types/monitoring';

export interface FilterState {
  severity: EventSeverity;
  category: EventCategory;
  showOnlyErrors: boolean;
  showOnlyWarnings: boolean;
  showOnlyToday: boolean;
  hideResolved: boolean;
}

interface QuickFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  errorCount: number;
  warningCount: number;
  todayCount: number;
  unresolvedCount: number;
}

const severityFilters = [
  { value: 'all' as EventSeverity, label: 'All', icon: Eye, color: 'text-gray-300' },
  { value: 'critical' as EventSeverity, label: 'Critical', icon: AlertCircle, color: 'text-purple-300' },
  { value: 'error' as EventSeverity, label: 'Errors', icon: XCircle, color: 'text-red-300' },
  { value: 'warning' as EventSeverity, label: 'Warnings', icon: AlertTriangle, color: 'text-amber-300' },
  { value: 'info' as EventSeverity, label: 'Info', icon: Info, color: 'text-blue-300' },
];

const categoryFilters = [
  { value: 'all' as EventCategory, label: 'All Categories', icon: Eye, color: 'text-gray-300' },
  { value: 'user' as EventCategory, label: 'User', icon: User, color: 'text-green-300' },
  { value: 'auth' as EventCategory, label: 'Auth', icon: Lock, color: 'text-yellow-300' },
  { value: 'api' as EventCategory, label: 'API', icon: Zap, color: 'text-blue-300' },
  { value: 'payment' as EventCategory, label: 'Payment', icon: CreditCard, color: 'text-emerald-300' },
  { value: 'dataset' as EventCategory, label: 'Dataset', icon: Database, color: 'text-cyan-300' },
  { value: 'system' as EventCategory, label: 'System', icon: Settings, color: 'text-gray-300' },
  { value: 'security' as EventCategory, label: 'Security', icon: Shield, color: 'text-red-300' },
  { value: 'deployment' as EventCategory, label: 'Deploy', icon: Rocket, color: 'text-purple-300' },
  { value: 'error' as EventCategory, label: 'Errors', icon: XCircle, color: 'text-red-300' },
];

export function QuickFilters({
  filters,
  onFiltersChange,
  errorCount,
  warningCount,
  todayCount,
  unresolvedCount
}: QuickFiltersProps) {
  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleQuickFilter = (filterKey: keyof FilterState) => {
    const newFilters = { ...filters };
    
    // Reset other quick filters when activating one
    if (!newFilters[filterKey]) {
      newFilters.showOnlyErrors = false;
      newFilters.showOnlyWarnings = false;
      newFilters.showOnlyToday = false;
      newFilters.hideResolved = false;
    }
    
    newFilters[filterKey] = !newFilters[filterKey];
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Quick Action Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-gray-300">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Quick Filters:</span>
        </div>
        
        <motion.button
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            filters.showOnlyErrors
              ? 'bg-red-500/20 border-red-500/40 text-red-300'
              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
          }`}
          onClick={() => toggleQuickFilter('showOnlyErrors')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={errorCount === 0}
        >
          <XCircle className="w-4 h-4" />
          <span>Errors Only</span>
          {errorCount > 0 && (
            <motion.span
              className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              {errorCount}
            </motion.span>
          )}
        </motion.button>

        <motion.button
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            filters.showOnlyWarnings
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
          }`}
          onClick={() => toggleQuickFilter('showOnlyWarnings')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={warningCount === 0}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Warnings</span>
          {warningCount > 0 && (
            <motion.span
              className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              {warningCount}
            </motion.span>
          )}
        </motion.button>

        <motion.button
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            filters.showOnlyToday
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
          }`}
          onClick={() => toggleQuickFilter('showOnlyToday')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={todayCount === 0}
        >
          <Clock className="w-4 h-4" />
          <span>Today</span>
          {todayCount > 0 && (
            <motion.span
              className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              {todayCount}
            </motion.span>
          )}
        </motion.button>

        <motion.button
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            filters.hideResolved
              ? 'bg-green-500/20 border-green-500/40 text-green-300'
              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
          }`}
          onClick={() => toggleQuickFilter('hideResolved')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <EyeOff className="w-4 h-4" />
          <span>Hide Resolved</span>
          {unresolvedCount > 0 && (
            <motion.span
              className="px-2 py-0.5 bg-green-500 text-white rounded-full text-xs"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              {unresolvedCount}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* Detailed Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Severity Level</label>
          <div className="flex items-center gap-2 flex-wrap">
            {severityFilters.map((severityFilter) => {
              const isSelected = filters.severity === severityFilter.value;
              const Icon = severityFilter.icon;
              
              return (
                <motion.button
                  key={severityFilter.value}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-white/10 border-white/30 text-white'
                      : `bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 ${severityFilter.color}`
                  }`}
                  onClick={() => updateFilter('severity', severityFilter.value)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{severityFilter.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Category</label>
          <div className="flex items-center gap-2 flex-wrap">
            {categoryFilters.map((categoryFilter) => {
              const isSelected = filters.category === categoryFilter.value;
              const Icon = categoryFilter.icon;
              
              return (
                <motion.button
                  key={categoryFilter.value}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-white/10 border-white/30 text-white'
                      : `bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 ${categoryFilter.color}`
                  }`}
                  onClick={() => updateFilter('category', categoryFilter.value)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{categoryFilter.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active filters indicator */}
      {(filters.severity !== 'all' || 
        filters.category !== 'all' || 
        filters.showOnlyErrors || 
        filters.showOnlyWarnings || 
        filters.showOnlyToday || 
        filters.hideResolved) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 rounded-lg p-3 border border-white/10"
        >
          <Filter className="w-4 h-4" />
          <span>Active filters applied</span>
          <motion.button
            className="ml-auto text-blue-300 hover:text-blue-200 font-medium"
            onClick={() => onFiltersChange({
              severity: 'all',
              category: 'all',
              showOnlyErrors: false,
              showOnlyWarnings: false,
              showOnlyToday: false,
              hideResolved: false
            })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear All
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}