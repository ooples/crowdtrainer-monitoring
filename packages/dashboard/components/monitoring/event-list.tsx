'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Settings, 
  Info, 
  AlertTriangle, 
  XCircle, 
  AlertCircle, 
  User, 
  Lock, 
  Zap, 
  CreditCard, 
  Database, 
  Shield, 
  Rocket, 
  Activity 
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { EventListSkeleton } from '@/components/ui/loading-skeleton';
import { formatTimeAgo } from '@/lib/utils';
import { Event, EventListProps } from '@/types/monitoring';

const categoryIcons = {
  user: User,
  auth: Lock,
  api: Zap,
  payment: CreditCard,
  dataset: Database,
  system: Settings,
  security: Shield,
  deployment: Rocket,
  error: XCircle,
};

const severityConfig = {
  info: { 
    bg: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30', 
    text: 'text-blue-300',
    icon: Info
  },
  warning: { 
    bg: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30', 
    text: 'text-amber-300',
    icon: AlertTriangle
  },
  error: { 
    bg: 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30', 
    text: 'text-red-300',
    icon: XCircle
  },
  critical: { 
    bg: 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30', 
    text: 'text-purple-300',
    icon: AlertCircle
  }
};

const borderColors = {
  info: 'bg-gradient-to-r from-blue-500 to-cyan-400',
  warning: 'bg-gradient-to-r from-amber-500 to-yellow-500',
  error: 'bg-gradient-to-r from-red-500 to-rose-500',
  critical: 'bg-gradient-to-r from-purple-500 to-pink-500'
};

export function EventList({
  events,
  loading = false,
  onEventClick,
  showCategory = true,
  maxHeight = '700px',
  className = ""
}: EventListProps & { className?: string }) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  if (loading) {
    return <EventListSkeleton count={5} className={className} />;
  }

  return (
    <div className={`space-y-3 overflow-y-auto custom-scrollbar ${className}`} style={{ maxHeight }}>
      <AnimatePresence mode="popLayout">
        {events.length === 0 ? (
          <motion.div
            key="no-events"
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
            <p className="text-gray-400 text-lg">No events found</p>
            <p className="text-gray-500 text-sm mt-2">Events will appear here when they occur</p>
          </motion.div>
        ) : (
          events.map((event, index) => (
            <EventItem
              key={event.id}
              event={event}
              index={index}
              expanded={expandedEvents.has(event.id)}
              onToggleExpand={() => toggleEventExpansion(event.id)}
              onClick={() => onEventClick?.(event)}
              showCategory={showCategory}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

interface EventItemProps {
  event: Event;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onClick?: () => void;
  showCategory: boolean;
}

function EventItem({ 
  event, 
  index, 
  expanded, 
  onToggleExpand, 
  onClick, 
  showCategory 
}: EventItemProps) {
  const IconComponent = categoryIcons[event.category as keyof typeof categoryIcons] || Activity;
  const severityConf = severityConfig[event.severity as keyof typeof severityConfig] || severityConfig.info;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative overflow-hidden rounded-xl border backdrop-blur-sm cursor-pointer
                 hover:bg-white/5 transition-all duration-300 ${severityConf.bg}`}
      onClick={() => {
        onToggleExpand();
        onClick?.();
      }}
      whileHover={{ scale: 1.01, y: -2 }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                className="p-2 rounded-lg bg-white/5 border border-white/10"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <IconComponent className="w-4 h-4 text-gray-300" />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base leading-tight truncate">
                  {event.title}
                </h3>
              </div>
              
              <motion.div
                className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${severityConf.bg} ${severityConf.text}`}
                whileHover={{ scale: 1.05 }}
              >
                <severityConf.icon className="w-3 h-3" />
                {event.severity}
              </motion.div>
            </div>
            
            <p className="text-gray-300 text-sm leading-relaxed mb-2">
              {event.description}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{event.timeAgo || formatTimeAgo(event.timestamp)}</span>
              </div>
              {showCategory && (
                <div className="flex items-center gap-1 capitalize">
                  <span>{event.category}</span>
                </div>
              )}
            </div>
          </div>
          
          <motion.div
            className="ml-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
        
        {/* Expanded details */}
        <AnimatePresence>
          {expanded && event.metadata && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="mt-4 pt-4 border-t border-white/10"
            >
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Event Details</span>
              </div>
              <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                <pre className="text-xs text-gray-300 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Animated border */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${borderColors[event.severity as keyof typeof borderColors] || borderColors.info}`}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: 1, delay: index * 0.1 }}
      />
      
      {/* Hover effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

// Event list with search and filtering
export function FilterableEventList({
  events,
  loading,
  onEventClick,
  searchQuery = '',
  selectedCategory = 'all',
  selectedSeverity = 'all',
}: EventListProps & {
  searchQuery?: string;
  selectedCategory?: string;
  selectedSeverity?: string;
}) {
  const filteredEvents = events.filter(event => {
    // Category filter
    if (selectedCategory !== 'all' && event.category !== selectedCategory) return false;
    
    // Severity filter
    if (selectedSeverity !== 'all' && event.severity !== selectedSeverity) return false;
    
    // Search filter
    if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !event.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  return <EventList events={filteredEvents} loading={loading} onEventClick={onEventClick} />;
}