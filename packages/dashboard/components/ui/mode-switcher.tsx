'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Settings, Wrench, Shield } from 'lucide-react';
import { useMode, DashboardMode } from '../providers/mode-provider';
import { useAdminMode } from '../providers/admin-mode-provider';

const modeConfig = {
  simple: {
    label: 'Simple',
    description: 'Essential metrics only',
    icon: Zap,
    color: 'from-green-500 to-emerald-500',
    textColor: 'text-green-400'
  },
  advanced: {
    label: 'Advanced',
    description: 'Detailed analytics',
    icon: Settings,
    color: 'from-blue-500 to-cyan-500',
    textColor: 'text-blue-400'
  },
  expert: {
    label: 'Expert',
    description: 'All features & debug',
    icon: Wrench,
    color: 'from-purple-500 to-pink-500',
    textColor: 'text-purple-400'
  }
};

export function ModeSwitcher() {
  const { mode, setMode } = useMode();
  const { isAdminMode, toggleAdminMode } = useAdminMode();

  return (
    <nav aria-label="Dashboard mode switcher" className="flex items-center gap-4">
      {/* Mode Buttons */}
      <div 
        className="flex items-center bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-1" 
        role="group" 
        aria-label="Dashboard display modes"
      >
        {Object.entries(modeConfig).map(([modeKey, config]) => {
          const IconComponent = config.icon;
          const isActive = mode === modeKey;
          
          return (
            <motion.button
              key={modeKey}
              onClick={() => setMode(modeKey as DashboardMode)}
              className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                isActive 
                  ? `bg-gradient-to-r ${config.color} text-white shadow-lg` 
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-pressed={isActive}
              aria-label={`Switch to ${config.label} mode: ${config.description}`}
              title={`${config.label} mode - ${config.description}`}
            >
              <div className="flex items-center gap-2">
                <IconComponent className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{config.label}</span>
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="activeMode"
                  className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-lg pointer-events-none"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  aria-hidden="true"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Current Mode Info */}
      <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
        <span>•</span>
        <span>{modeConfig[mode].description}</span>
      </div>

      {/* Admin Mode Toggle */}
      <motion.button
        onClick={toggleAdminMode}
        className={`p-2 rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
          isAdminMode 
            ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25' 
            : 'bg-white/10 border border-white/20 text-gray-400 hover:bg-white/20 hover:text-white'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-pressed={isAdminMode}
        aria-label={isAdminMode ? 'Exit admin mode' : 'Enter admin mode'}
        title={isAdminMode ? 'Exit Admin Mode' : 'Enter Admin Mode'}
      >
        <Shield className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">
          {isAdminMode ? 'Admin mode active' : 'Admin mode inactive'}
        </span>
      </motion.button>
    </nav>
  );
}