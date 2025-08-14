'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter,
  Search,
  Users,
  Server,
  Zap,
  TrendingUp,
  Eye,
  EyeOff,
  Bell,
  BellOff
} from 'lucide-react';
import { Event, Alert, EventSeverity, EventCategory } from '@/types/monitoring';
import { useMode } from '../providers/mode-provider';
import { useAdminMode } from '../providers/admin-mode-provider';
import { formatTimeAgo } from '@/lib/utils';

interface UnifiedActivityPanelProps {
  events: Event[];
  alerts: Alert[];
  loading?: boolean;
  onEventClick?: (event: Event) => void;
  onAlertClick?: (alert: Alert) => void;
  className?: string;
}

type ActivityItem = {
  id: string;
  type: 'event' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  severity: EventSeverity;
  category?: EventCategory;
  status?: string;
  data: Event | Alert;
};

const severityColors = {
  low: 'text-blue-400 bg-blue-500/20 border-blue-500/40',
  medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40',
  high: 'text-orange-400 bg-orange-500/20 border-orange-500/40',
  critical: 'text-red-400 bg-red-500/20 border-red-500/40'
};

const categoryIcons = {
  auth: Users,
  api: Server,
  performance: Zap,
  error: AlertTriangle,
  security: CheckCircle,
  system: Server,
  user: Users,
  payment: TrendingUp
};

export function UnifiedActivityPanel({
  events = [],
  alerts = [],
  loading = false,
  onEventClick,
  onAlertClick,
  className = ''
}: UnifiedActivityPanelProps) {
  const { mode, canShowFeature } = useMode();
  const { isAdminMode } = useAdminMode();
  const [filter, setFilter] = useState<'all' | 'events' | 'alerts'>('all');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [mutedCategories, setMutedCategories] = useState<Set<string>>(new Set());

  // Combine and sort activities
  const activities = useMemo(() => {
    const eventItems: ActivityItem[] = events.map(event => ({
      id: `event-${event.id}`,
      type: 'event' as const,
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      category: event.category,
      data: event
    }));

    const alertItems: ActivityItem[] = alerts.map(alert => ({
      id: `alert-${alert.id}`,
      type: 'alert' as const,
      title: alert.title,
      description: alert.description,
      timestamp: alert.timestamp,
      severity: alert.severity,
      status: alert.status,
      data: alert
    }));

    const combined = [...eventItems, ...alertItems];
    
    // Sort by timestamp (most recent first)
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return combined;
  }, [events, alerts]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Type filter
      if (filter !== 'all' && 
          ((filter === 'events' && activity.type !== 'event') || 
           (filter === 'alerts' && activity.type !== 'alert'))) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && activity.severity !== severityFilter) {
        return false;
      }

      // Search filter
      if (searchQuery && 
          !activity.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !activity.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // New items filter (last 5 minutes for demo)
      if (showOnlyNew) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (new Date(activity.timestamp).getTime() < fiveMinutesAgo) {
          return false;
        }
      }

      // Muted categories filter
      if (activity.category && mutedCategories.has(activity.category)) {
        return false;
      }

      return true;
    });
  }, [activities, filter, severityFilter, searchQuery, showOnlyNew, mutedCategories]);

  const toggleMuteCategory = (category: string) => {
    const newMuted = new Set(mutedCategories);
    if (newMuted.has(category)) {
      newMuted.delete(category);
    } else {
      newMuted.add(category);
    }
    setMutedCategories(newMuted);
  };

  const ActivityItem = ({ activity }: { activity: ActivityItem }) => {
    const IconComponent = activity.category ? categoryIcons[activity.category] || Activity : Activity;
    const isMuted = activity.category && mutedCategories.has(activity.category);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isMuted ? 0.5 : 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
          activity.type === 'alert' 
            ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10' 
            : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
        onClick={() => {
          if (activity.type === 'event' && onEventClick) {
            onEventClick(activity.data as Event);
          } else if (activity.type === 'alert' && onAlertClick) {
            onAlertClick(activity.data as Alert);
          }
        }}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`p-2 rounded-lg ${severityColors[activity.severity]}`}>
              <IconComponent className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                    {activity.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {activity.description}
                  </p>
                </div>

                {/* Timestamp and actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canShowFeature('advanced') && activity.category && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMuteCategory(activity.category!);
                      }}
                      className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`${isMuted ? 'Unmute' : 'Mute'} ${activity.category} events`}
                    >
                      {isMuted ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                    </button>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[activity.severity]}`}>
                  {activity.severity}
                </span>
                
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  activity.type === 'alert' 
                    ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                    : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                }`}>
                  {activity.type}
                </span>

                {activity.category && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 border border-gray-500/40 text-gray-300">
                    {activity.category}
                  </span>
                )}

                {activity.status && canShowFeature('advanced') && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 border border-purple-500/40 text-purple-300">
                    {activity.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar for severity */}
        <motion.div
          className={`absolute bottom-0 left-0 h-0.5 ${
            activity.severity === 'critical' ? 'bg-gradient-to-r from-red-500 to-rose-400' :
            activity.severity === 'high' ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
            activity.severity === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
            'bg-gradient-to-r from-blue-500 to-cyan-400'
          }`}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.5, delay: 0.2 }}
        />
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className={`backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl shadow-2xl p-6 ${className}`}>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl shadow-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-semibold text-white">Unified Activity</h2>
          <motion.div
            className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-sm font-medium"
            key={filteredActivities.length}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {filteredActivities.length} items
          </motion.div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Eye className="w-4 h-4" />
          <span>Live feed</span>
        </div>
      </div>

      {/* Filters - Show based on mode */}
      {canShowFeature('advanced') && (
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-400"
            >
              <option value="all">All</option>
              <option value="events">Events</option>
              <option value="alerts">Alerts</option>
            </select>
          </div>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-400"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {/* Search */}
          {canShowFeature('expert') && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search activities..."
                className="bg-gray-800 border border-gray-600 rounded-lg pl-9 pr-3 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>
          )}

          {/* New items toggle */}
          <button
            onClick={() => setShowOnlyNew(!showOnlyNew)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              showOnlyNew
                ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {showOnlyNew ? 'Showing New' : 'Show New Only'}
          </button>
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filteredActivities.length > 0 ? (
            filteredActivities.slice(0, mode === 'simple' ? 10 : mode === 'advanced' ? 25 : 50).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <div className="text-gray-400 mb-2">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No activities match your filters</p>
              </div>
              {(filter !== 'all' || severityFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilter('all');
                    setSeverityFilter('all');
                    setSearchQuery('');
                    setShowOnlyNew(false);
                  }}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Clear filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Muted categories indicator */}
      {mutedCategories.size > 0 && canShowFeature('advanced') && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-300 text-sm">
            <BellOff className="w-4 h-4" />
            <span>
              Muted categories: {Array.from(mutedCategories).join(', ')}
            </span>
            <button
              onClick={() => setMutedCategories(new Set())}
              className="ml-auto text-yellow-400 hover:text-yellow-300"
            >
              Unmute all
            </button>
          </div>
        </div>
      )}

      {/* Admin-only debug info */}
      {isAdminMode && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="text-red-300 text-sm font-mono">
            <div>Events: {events.length} | Alerts: {alerts.length}</div>
            <div>Filtered: {filteredActivities.length} | Mode: {mode}</div>
            <div>Muted: {mutedCategories.size} categories</div>
          </div>
        </div>
      )}
    </div>
  );
}