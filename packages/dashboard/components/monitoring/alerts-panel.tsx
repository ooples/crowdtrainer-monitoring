'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { formatTimeAgo } from '@/lib/utils';
import { Alert, AlertsPanelProps } from '@/types/monitoring';

const alertTypeConfig = {
  info: {
    bg: 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30',
    color: 'text-blue-300',
    dot: 'bg-blue-500'
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30',
    color: 'text-amber-300',
    dot: 'bg-amber-500'
  },
  error: {
    bg: 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30',
    color: 'text-orange-300',
    dot: 'bg-orange-500'
  },
  critical: {
    bg: 'bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30',
    color: 'text-red-300',
    dot: 'bg-red-500'
  }
};

const borderColors = {
  info: 'bg-gradient-to-r from-blue-500 to-cyan-400',
  warning: 'bg-gradient-to-r from-amber-500 to-yellow-500',
  error: 'bg-gradient-to-r from-orange-500 to-red-500',
  critical: 'bg-gradient-to-r from-red-500 to-rose-500'
};

export function AlertsPanel({
  alerts,
  loading = false,
  onAlertClick,
  maxAlerts = 5,
  className = ""
}: AlertsPanelProps & { className?: string }) {
  const displayAlerts = alerts.slice(0, maxAlerts);

  if (loading) {
    return (
      <GlassCard className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-40"></div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  if (alerts.length === 0) {
    return (
      <GlassCard className={`p-6 text-center ${className}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-8"
        >
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-gray-300 text-lg font-medium mb-2">All Clear!</p>
          <p className="text-gray-500 text-sm">No active alerts to display</p>
        </motion.div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1, repeat: Infinity, repeatDelay: 3 }}
        >
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </motion.div>
        <h2 className="text-2xl font-semibold text-white">Active Alerts</h2>
        <motion.div
          className="px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm font-medium"
          animate={{ pulse: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {alerts.length}
        </motion.div>
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        <AnimatePresence>
          {displayAlerts.map((alert, index) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              index={index}
              onClick={() => onAlertClick?.(alert)}
            />
          ))}
        </AnimatePresence>
        
        {alerts.length > maxAlerts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pt-4 border-t border-white/10"
          >
            <p className="text-sm text-gray-400">
              And {alerts.length - maxAlerts} more alert{alerts.length - maxAlerts > 1 ? 's' : ''}
            </p>
          </motion.div>
        )}
      </div>
    </GlassCard>
  );
}

interface AlertItemProps {
  alert: Alert;
  index: number;
  onClick?: () => void;
}

function AlertItem({ alert, index, onClick }: AlertItemProps) {
  const config = alertTypeConfig[alert.type as keyof typeof alertTypeConfig] || alertTypeConfig.info;

  return (
    <motion.div
      key={alert.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.1 }}
      className={`relative overflow-hidden rounded-xl border backdrop-blur-sm cursor-pointer
                 hover:bg-white/5 transition-all duration-300 ${config.bg}`}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                className={`w-2 h-2 rounded-full ${config.dot}`}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="font-semibold text-white text-lg">{alert.title}</span>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{formatTimeAgo(alert.timestamp)}</span>
              </div>
            </div>
            <p className="text-gray-300 leading-relaxed">{alert.message}</p>
          </div>
          
          {alert.actionRequired && (
            <motion.div
              className="ml-4 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full shadow-lg"
              animate={{ 
                boxShadow: [
                  '0 0 0 0 rgba(239, 68, 68, 0.7)', 
                  '0 0 20px 4px rgba(239, 68, 68, 0)', 
                  '0 0 0 0 rgba(239, 68, 68, 0)'
                ] 
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Action Required
            </motion.div>
          )}
          
          {alert.resolved && (
            <motion.div
              className="ml-4 px-3 py-1 bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-medium rounded-full"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Resolved
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Animated border */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${borderColors[alert.type as keyof typeof borderColors] || borderColors.info}`}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: 2, delay: index * 0.2 }}
      />
    </motion.div>
  );
}

// Compact alerts summary
export function AlertsSummary({ 
  alerts, 
  onClick 
}: { 
  alerts: Alert[]; 
  onClick?: () => void; 
}) {
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const errorCount = alerts.filter(a => a.type === 'error').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  if (alerts.length === 0) {
    return (
      <motion.div
        className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg cursor-pointer"
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
      >
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-green-300 text-sm font-medium">All systems operational</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg cursor-pointer"
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      animate={{ pulse: criticalCount > 0 ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 1.5, repeat: criticalCount > 0 ? Infinity : 0 }}
    >
      <AlertTriangle className="w-4 h-4 text-amber-400" />
      <div className="flex items-center gap-2 text-sm">
        {criticalCount > 0 && (
          <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
            {criticalCount} Critical
          </span>
        )}
        {errorCount > 0 && (
          <span className="px-2 py-1 bg-orange-500 text-white rounded-full text-xs font-medium">
            {errorCount} Error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="px-2 py-1 bg-amber-500 text-white rounded-full text-xs font-medium">
            {warningCount} Warning{warningCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </motion.div>
  );
}