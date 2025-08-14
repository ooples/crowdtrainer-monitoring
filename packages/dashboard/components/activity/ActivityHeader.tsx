'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Clock } from 'lucide-react';
import { Event, Alert } from '@/types/monitoring';

interface ActivityHeaderProps {
  events: Event[];
  alerts: Alert[];
  totalItems: number;
  errorCount: number;
  warningCount: number;
  criticalCount: number;
  lastUpdated?: string;
}

export function ActivityHeader({
  events,
  alerts,
  totalItems,
  errorCount,
  warningCount,
  criticalCount,
  lastUpdated
}: ActivityHeaderProps) {
  const hasErrors = errorCount > 0 || criticalCount > 0;
  const hasWarnings = warningCount > 0;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        {/* Icon with animation */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className={`p-3 rounded-xl bg-gradient-to-br ${
              hasErrors 
                ? 'from-red-500/20 to-rose-500/20 border-red-500/30' 
                : hasWarnings 
                ? 'from-amber-500/20 to-yellow-500/20 border-amber-500/30'
                : 'from-blue-500/20 to-cyan-500/20 border-blue-500/30'
            } border backdrop-blur-sm`}
            animate={hasErrors ? { 
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 0 0 rgba(239, 68, 68, 0.4)',
                '0 0 20px 4px rgba(239, 68, 68, 0)',
                '0 0 0 0 rgba(239, 68, 68, 0)'
              ]
            } : {}}
            transition={{ duration: 2, repeat: hasErrors ? Infinity : 0 }}
          >
            <Activity className={`w-6 h-6 ${
              hasErrors ? 'text-red-300' : hasWarnings ? 'text-amber-300' : 'text-blue-300'
            }`} />
          </motion.div>
          
          <div>
            <h2 className="text-2xl font-semibold text-white">Recent Activity</h2>
            <p className="text-gray-400 text-sm mt-1">
              {totalItems} total items • {events.length} events • {alerts.length} alerts
            </p>
          </div>
        </motion.div>
      </div>

      {/* Status badges and last updated */}
      <div className="flex items-center gap-3">
        {/* Error count badge */}
        {(errorCount > 0 || criticalCount > 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            {criticalCount > 0 && (
              <motion.div
                className="px-3 py-2 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm font-medium flex items-center gap-2"
                animate={{ 
                  pulse: [1, 1.1, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(239, 68, 68, 0.7)',
                    '0 0 10px 2px rgba(239, 68, 68, 0)',
                    '0 0 0 0 rgba(239, 68, 68, 0)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{criticalCount} Critical</span>
              </motion.div>
            )}
            
            {errorCount > 0 && (
              <motion.div
                className="px-3 py-2 bg-orange-500/20 border border-orange-500/40 rounded-full text-orange-300 text-sm font-medium"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                {errorCount} Error{errorCount > 1 ? 's' : ''}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Warning count badge */}
        {warningCount > 0 && !hasErrors && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-3 py-2 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-sm font-medium"
          >
            {warningCount} Warning{warningCount > 1 ? 's' : ''}
          </motion.div>
        )}

        {/* All clear badge */}
        {!hasErrors && !hasWarnings && totalItems === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-3 py-2 bg-green-500/20 border border-green-500/40 rounded-full text-green-300 text-sm font-medium"
          >
            All Clear
          </motion.div>
        )}

        {/* Last updated */}
        {lastUpdated && (
          <motion.div
            className="flex items-center gap-2 text-gray-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Clock className="w-4 h-4" />
            <span>Updated {lastUpdated}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}