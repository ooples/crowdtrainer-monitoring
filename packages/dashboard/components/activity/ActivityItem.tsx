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
  Activity,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  Tag
} from 'lucide-react';
import { Event, Alert } from '@/types/monitoring';
import { formatTimeAgo } from '@/lib/utils';

export type ActivityItemData = (Event | Alert) & { 
  itemType: 'event' | 'alert';
  grouped?: boolean;
  groupCount?: number;
};

interface ActivityItemProps {
  item: ActivityItemData;
  index: number;
  onClick?: (item: ActivityItemData) => void;
  showCategory?: boolean;
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
  error: XCircle,
};

const severityConfig = {
  info: { 
    bg: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30', 
    text: 'text-blue-300',
    icon: Info,
    border: 'border-l-blue-500',
    dot: 'bg-blue-500'
  },
  warning: { 
    bg: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30', 
    text: 'text-amber-300',
    icon: AlertTriangle,
    border: 'border-l-amber-500',
    dot: 'bg-amber-500'
  },
  error: { 
    bg: 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30', 
    text: 'text-red-300',
    icon: XCircle,
    border: 'border-l-red-500',
    dot: 'bg-red-500'
  },
  critical: { 
    bg: 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30', 
    text: 'text-purple-300',
    icon: AlertCircle,
    border: 'border-l-purple-500',
    dot: 'bg-purple-500'
  }
};

const alertTypeConfig = {
  info: severityConfig.info,
  warning: severityConfig.warning,
  error: severityConfig.error,
  critical: severityConfig.critical
};

export function ActivityItem({ 
  item, 
  index, 
  onClick, 
  showCategory = true 
}: ActivityItemProps) {
  const [expanded, setExpanded] = useState(false);

  const isEvent = item.itemType === 'event';
  const isAlert = item.itemType === 'alert';

  // Get the appropriate configuration based on item type and severity/type
  const getSeverityConfig = () => {
    if (isEvent) {
      const event = item as Event;
      return severityConfig[event.severity as keyof typeof severityConfig] || severityConfig.info;
    } else {
      const alert = item as Alert;
      return alertTypeConfig[alert.type as keyof typeof alertTypeConfig] || alertTypeConfig.info;
    }
  };

  const config = getSeverityConfig();

  // Get icon for events
  const getIcon = () => {
    if (isEvent) {
      const event = item as Event;
      return categoryIcons[event.category as keyof typeof categoryIcons] || Activity;
    }
    return config.icon;
  };

  const IconComponent = getIcon();

  // Get title and description
  const getTitle = () => {
    return item.title;
  };

  const getDescription = () => {
    if (isEvent) {
      return (item as Event).description;
    }
    return (item as Alert).message;
  };

  const getSeverityLevel = () => {
    if (isEvent) {
      return (item as Event).severity;
    }
    return (item as Alert).type;
  };

  const getCategory = () => {
    if (isEvent) {
      return (item as Event).category;
    }
    return 'alert';
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
    onClick?.(item);
  };

  // Check if alert has additional properties
  const alert = isAlert ? item as Alert : null;
  const event = isEvent ? item as Event : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative overflow-hidden rounded-xl border backdrop-blur-sm cursor-pointer
                 hover:bg-white/5 transition-all duration-300 ${config.bg} border-l-4 ${config.border}`}
      onClick={toggleExpanded}
      whileHover={{ scale: 1.01, y: -2 }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {/* Icon with activity type indicator */}
              <motion.div
                className="relative p-2 rounded-lg bg-white/5 border border-white/10"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <IconComponent className="w-4 h-4 text-gray-300" />
                {/* Activity type indicator dot */}
                <motion.div
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${config.dot} border border-gray-900`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 + 0.2 }}
                />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base leading-tight truncate">
                  {getTitle()}
                  {item.grouped && item.groupCount && (
                    <motion.span
                      className="ml-2 px-2 py-0.5 bg-white/10 text-gray-300 text-xs rounded-full"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      +{item.groupCount} similar
                    </motion.span>
                  )}
                </h3>
              </div>
              
              {/* Severity/Type badge */}
              <motion.div
                className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${config.bg} ${config.text}`}
                whileHover={{ scale: 1.05 }}
              >
                <config.icon className="w-3 h-3" />
                {getSeverityLevel()}
              </motion.div>
            </div>
            
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              {getDescription()}
            </p>
            
            {/* Metadata row */}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  {isEvent && event?.timeAgo 
                    ? event.timeAgo 
                    : formatTimeAgo(item.timestamp)
                  }
                </span>
              </div>
              
              {showCategory && (
                <div className="flex items-center gap-1 capitalize">
                  <Tag className="w-3 h-3" />
                  <span>{getCategory()}</span>
                </div>
              )}
              
              {/* Item type badge */}
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span className="capitalize">{item.itemType}</span>
              </div>
              
              {/* Alert specific indicators */}
              {isAlert && alert && (
                <>
                  {alert.actionRequired && (
                    <motion.div
                      className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full"
                      animate={{ 
                        boxShadow: [
                          '0 0 0 0 rgba(239, 68, 68, 0.4)', 
                          '0 0 10px 2px rgba(239, 68, 68, 0)', 
                          '0 0 0 0 rgba(239, 68, 68, 0)'
                        ] 
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Action Required</span>
                    </motion.div>
                  )}
                  
                  {alert.resolved && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      <span>Resolved</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Expand button */}
          <motion.div
            className="ml-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </motion.div>
        </div>
        
        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (event?.metadata || alert) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="mt-4 pt-4 border-t border-white/10"
            >
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">
                  {isEvent ? 'Event Details' : 'Alert Details'}
                </span>
              </div>
              
              <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                {isEvent && event?.metadata ? (
                  <pre className="text-xs text-gray-300 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                ) : isAlert && alert ? (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400 block">Alert ID:</span>
                        <span className="text-gray-300 font-mono">{alert.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Type:</span>
                        <span className="text-gray-300 capitalize">{alert.type}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Action Required:</span>
                        <span className={`${alert.actionRequired ? 'text-red-300' : 'text-green-300'}`}>
                          {alert.actionRequired ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Status:</span>
                        <span className={`${alert.resolved ? 'text-green-300' : 'text-amber-300'}`}>
                          {alert.resolved ? 'Resolved' : 'Active'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-1">Full Message:</span>
                      <p className="text-gray-300 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Animated progress line at bottom */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${config.dot}`}
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