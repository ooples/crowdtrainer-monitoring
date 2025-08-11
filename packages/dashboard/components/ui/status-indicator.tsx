'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { SystemHealth } from '@/types/monitoring';

interface StatusIndicatorProps {
  status: SystemHealth | string;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  healthy: { 
    color: 'bg-emerald-500', 
    shadowColor: 'shadow-emerald-500/50', 
    icon: CheckCircle,
    label: 'Healthy'
  },
  operational: { 
    color: 'bg-emerald-500', 
    shadowColor: 'shadow-emerald-500/50', 
    icon: CheckCircle,
    label: 'Operational'
  },
  degraded: { 
    color: 'bg-amber-500', 
    shadowColor: 'shadow-amber-500/50', 
    icon: AlertTriangle,
    label: 'Degraded'
  },
  critical: { 
    color: 'bg-red-500', 
    shadowColor: 'shadow-red-500/50', 
    icon: XCircle,
    label: 'Critical'
  },
  down: { 
    color: 'bg-red-500', 
    shadowColor: 'shadow-red-500/50', 
    icon: XCircle,
    label: 'Down'
  },
  checking: { 
    color: 'bg-gray-500', 
    shadowColor: 'shadow-gray-500/50', 
    icon: Activity,
    label: 'Checking'
  },
};

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const pulseVariants = {
  idle: { scale: 1 },
  pulse: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export function StatusIndicator({ 
  status, 
  animated = true, 
  size = 'md',
  showIcon = false,
  showLabel = false,
  className = ""
}: StatusIndicatorProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.checking;
  const Icon = config.icon;

  if (showIcon) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <motion.div
          variants={animated ? pulseVariants : undefined}
          animate={animated ? "pulse" : "idle"}
          className={`${sizes[size]} rounded-full ${config.color} ${config.shadowColor} shadow-lg`}
        />
        <Icon className={`${iconSizes[size]} text-gray-300`} />
        {showLabel && (
          <span className="text-sm text-gray-300 capitalize">{config.label}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        variants={animated ? pulseVariants : undefined}
        animate={animated ? "pulse" : "idle"}
        className={`${sizes[size]} rounded-full ${config.color} ${config.shadowColor} shadow-lg`}
      />
      {showLabel && (
        <span className="text-sm text-gray-300 capitalize">{config.label}</span>
      )}
    </div>
  );
}