'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Search, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ActivityHeader } from './ActivityHeader';
import { QuickFilters, FilterState } from './QuickFilters';
import { ActivityItem, ActivityItemData } from './ActivityItem';
import { Event, Alert } from '@/types/monitoring';
import { formatTimeAgo } from '@/lib/utils';

interface UnifiedActivityPanelProps {
  events: Event[];
  alerts: Alert[];
  loading?: boolean;
  onItemClick?: (item: ActivityItemData) => void;
  showSearch?: boolean;
  maxItems?: number;
  enableGrouping?: boolean;
  className?: string;
}

export function UnifiedActivityPanel({
  events = [],
  alerts = [],
  loading = false,
  onItemClick,
  showSearch = true,
  maxItems = 50,
  enableGrouping = true,
  className = ""
}: UnifiedActivityPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    severity: 'all',
    category: 'all',
    showOnlyErrors: false,
    showOnlyWarnings: false,
    showOnlyToday: false,
    hideResolved: false
  });

  // Combine and sort events and alerts by timestamp
  const combinedItems = useMemo(() => {
    const eventItems: ActivityItemData[] = events.map(event => ({
      ...event,
      itemType: 'event' as const
    }));

    const alertItems: ActivityItemData[] = alerts.map(alert => ({
      ...alert,
      itemType: 'alert' as const
    }));

    // Sort by timestamp (most recent first)
    const allItems = [...eventItems, ...alertItems].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return allItems;
  }, [events, alerts]);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    let filtered = combinedItems;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.itemType === 'event' 
          ? (item as Event).description.toLowerCase().includes(query)
          : (item as Alert).message.toLowerCase().includes(query)
        )
      );
    }

    // Quick filters
    if (filters.showOnlyErrors) {
      filtered = filtered.filter(item => {
        if (item.itemType === 'event') {
          return (item as Event).severity === 'error' || (item as Event).severity === 'critical';
        } else {
          return (item as Alert).type === 'error' || (item as Alert).type === 'critical';
        }
      });
    }

    if (filters.showOnlyWarnings) {
      filtered = filtered.filter(item => {
        if (item.itemType === 'event') {
          return (item as Event).severity === 'warning';
        } else {
          return (item as Alert).type === 'warning';
        }
      });
    }

    if (filters.showOnlyToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => 
        new Date(item.timestamp) >= today
      );
    }

    if (filters.hideResolved) {
      filtered = filtered.filter(item => {
        if (item.itemType === 'alert') {
          return !(item as Alert).resolved;
        }
        return true; // Events don't have resolved status
      });
    }

    // Detailed filters
    if (filters.severity !== 'all') {
      filtered = filtered.filter(item => {
        if (item.itemType === 'event') {
          return (item as Event).severity === filters.severity;
        } else {
          return (item as Alert).type === filters.severity;
        }
      });
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(item => {
        if (item.itemType === 'event') {
          return (item as Event).category === filters.category;
        }
        // Alerts don't have categories, so exclude them unless 'all' is selected
        return filters.category === 'all';
      });
    }

    return filtered.slice(0, maxItems);
  }, [combinedItems, searchQuery, filters, maxItems]);

  // Group similar items if enabled
  const processedItems = useMemo(() => {
    if (!enableGrouping) return filteredItems;

    const grouped: ActivityItemData[] = [];
    const titleGroups: { [key: string]: ActivityItemData[] } = {};

    filteredItems.forEach(item => {
      const groupKey = `${item.title}-${item.itemType}`;
      if (titleGroups[groupKey]) {
        titleGroups[groupKey].push(item);
      } else {
        titleGroups[groupKey] = [item];
      }
    });

    Object.entries(titleGroups).forEach(([key, items]) => {
      if (items.length > 1) {
        // Create a grouped item with the most recent timestamp
        const mostRecent = items[0];
        grouped.push({
          ...mostRecent,
          grouped: true,
          groupCount: items.length - 1
        });
      } else {
        grouped.push(items[0]);
      }
    });

    return grouped;
  }, [filteredItems, enableGrouping]);

  // Calculate counts for filters and header
  const counts = useMemo(() => {
    const errorItems = combinedItems.filter(item => {
      if (item.itemType === 'event') {
        return (item as Event).severity === 'error' || (item as Event).severity === 'critical';
      } else {
        return (item as Alert).type === 'error' || (item as Alert).type === 'critical';
      }
    });

    const warningItems = combinedItems.filter(item => {
      if (item.itemType === 'event') {
        return (item as Event).severity === 'warning';
      } else {
        return (item as Alert).type === 'warning';
      }
    });

    const criticalItems = combinedItems.filter(item => {
      if (item.itemType === 'event') {
        return (item as Event).severity === 'critical';
      } else {
        return (item as Alert).type === 'critical';
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayItems = combinedItems.filter(item => 
      new Date(item.timestamp) >= today
    );

    const unresolvedItems = combinedItems.filter(item => {
      if (item.itemType === 'alert') {
        return !(item as Alert).resolved;
      }
      return true;
    });

    return {
      error: errorItems.length,
      warning: warningItems.length,
      critical: criticalItems.length,
      today: todayItems.length,
      unresolved: unresolvedItems.length
    };
  }, [combinedItems]);

  const handleItemClick = (item: ActivityItemData) => {
    onItemClick?.(item);
  };

  if (loading) {
    return (
      <GlassCard className={`p-6 ${className}`}>
        <LoadingSkeleton count={5} />
      </GlassCard>
    );
  }

  const lastUpdated = combinedItems.length > 0 
    ? formatTimeAgo(combinedItems[0].timestamp)
    : undefined;

  return (
    <GlassCard className={`p-6 ${className}`}>
      {/* Header */}
      <ActivityHeader
        events={events}
        alerts={alerts}
        totalItems={combinedItems.length}
        errorCount={counts.error}
        warningCount={counts.warning}
        criticalCount={counts.critical}
        lastUpdated={lastUpdated}
      />

      {/* Search Bar */}
      {showSearch && (
        <div className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events and alerts..."
              className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:bg-white/10 focus:border-white/20 focus:outline-none transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <QuickFilters
        filters={filters}
        onFiltersChange={setFilters}
        errorCount={counts.error}
        warningCount={counts.warning}
        todayCount={counts.today}
        unresolvedCount={counts.unresolved}
      />

      {/* Activity List */}
      <div className="space-y-3 overflow-y-auto max-h-[800px] custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {processedItems.length === 0 ? (
            <motion.div
              key="no-items"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1] 
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  repeatDelay: 3 
                }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center"
              >
                <Activity className="w-8 h-8 text-gray-400" />
              </motion.div>
              <p className="text-gray-400 text-lg">No activity found</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery || Object.values(filters).some(f => f !== 'all' && f !== false)
                  ? 'Try adjusting your search or filters'
                  : 'Activity will appear here when events occur'
                }
              </p>
            </motion.div>
          ) : (
            processedItems.map((item, index) => (
              <ActivityItem
                key={`${item.id}-${item.itemType}-${index}`}
                item={item}
                index={index}
                onClick={handleItemClick}
                showCategory={true}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Items count indicator */}
      {processedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 pt-4 border-t border-white/10 text-center"
        >
          <p className="text-sm text-gray-400">
            Showing {processedItems.length} of {combinedItems.length} items
            {processedItems.length === maxItems && combinedItems.length > maxItems && (
              <span className="text-amber-300 ml-1">(limited to {maxItems})</span>
            )}
          </p>
        </motion.div>
      )}
    </GlassCard>
  );
}