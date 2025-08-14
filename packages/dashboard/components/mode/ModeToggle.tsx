'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Settings,
  Gauge,
  Zap,
  ChevronDown,
  ChevronUp,
  Keyboard,
  Crown,
  Eye,
  EyeOff,
  BarChart3,
  Brain,
  Sparkles,
  Shield,
  Info,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useModeContext } from './ModeProvider';
import { DashboardMode } from '@/lib/mode-storage';
import { GlassCard } from '@/components/ui/glass-card';
import { clsx } from 'clsx';

/**
 * Mode Toggle Props
 */
interface ModeToggleProps {
  variant?: 'compact' | 'full' | 'minimal';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  showStats?: boolean;
  showDescription?: boolean;
  showKeyboardHints?: boolean;
  enableHoverEffects?: boolean;
  className?: string;
  onModeChange?: (mode: DashboardMode) => void;
}

/**
 * Mode option interface
 */
interface ModeOption {
  mode: DashboardMode;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  features: string[];
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Mode Toggle Component
 * Beautiful, animated toggle for switching between dashboard modes
 */
export const ModeToggle: React.FC<ModeToggleProps> = ({
  variant = 'full',
  position = 'inline',
  showStats = true,
  showDescription = true,
  showKeyboardHints = true,
  enableHoverEffects = true,
  className = '',
  onModeChange,
}) => {
  const {
    currentMode,
    adminOverlay,
    config,
    allConfigs,
    setMode,
    cycleMode,
    toggleAdmin,
    statistics,
    isLoading,
  } = useModeContext();

  const [isOpen, setIsOpen] = useState(false);
  const [hoveredMode, setHoveredMode] = useState<DashboardMode | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const toggleRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Mode options configuration
  const modeOptions: ModeOption[] = [
    {
      mode: 'simple',
      name: 'Simple',
      description: 'Clean, essential monitoring with key metrics only',
      icon: Gauge,
      color: '#10b981',
      features: ['Key metrics', 'Basic alerts', 'Clean UI'],
      complexity: 'low',
    },
    {
      mode: 'advanced',
      name: 'Advanced',
      description: 'Comprehensive monitoring with detailed insights',
      icon: BarChart3,
      color: '#3b82f6',
      features: ['Advanced analytics', 'Custom dashboards', 'Data export'],
      complexity: 'medium',
    },
    {
      mode: 'expert',
      name: 'Expert',
      description: 'Full-featured monitoring with debugging tools',
      icon: Brain,
      color: '#8b5cf6',
      features: ['Raw data access', 'Debugging panel', 'API tools'],
      complexity: 'high',
    },
  ];

  // Get current mode option
  const currentOption = modeOptions.find(opt => opt.mode === currentMode) || modeOptions[0];

  // Handle mode change
  const handleModeChange = async (mode: DashboardMode) => {
    if (mode === currentMode) return;

    const success = await setMode(mode, 'user');
    if (success) {
      onModeChange?.(mode);
      setIsOpen(false);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          const currentIndex = modeOptions.findIndex(opt => opt.mode === currentMode);
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          const nextIndex = (currentIndex + direction + modeOptions.length) % modeOptions.length;
          setHoveredMode(modeOptions[nextIndex].mode);
          break;
        case 'Enter':
        case ' ':
          if (hoveredMode) {
            event.preventDefault();
            handleModeChange(hoveredMode);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, hoveredMode, currentMode]);

  // Handle mouse movement for glow effects
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!enableHoverEffects || !toggleRef.current) return;

    const rect = toggleRef.current.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  };

  // Glow effect transforms
  const glowX = useTransform(mouseX, [0, 200], [0, 1]);
  const glowY = useTransform(mouseY, [0, 100], [0, 1]);

  // Get complexity indicator
  const getComplexityIcon = (complexity: 'low' | 'medium' | 'high') => {
    switch (complexity) {
      case 'low':
        return <div className="w-2 h-2 bg-green-400 rounded-full" />;
      case 'medium':
        return (
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          </div>
        );
      case 'high':
        return (
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-purple-400 rounded-full" />
            <div className="w-1 h-1 bg-purple-400 rounded-full" />
            <div className="w-1 h-1 bg-purple-400 rounded-full" />
          </div>
        );
    }
  };

  // Position classes
  const positionClasses = {
    'top-left': 'fixed top-4 left-4 z-50',
    'top-right': 'fixed top-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'inline': '',
  };

  // Variant classes
  const variantClasses = {
    minimal: 'p-2',
    compact: 'p-3',
    full: 'p-4',
  };

  if (isLoading) {
    return (
      <div className={clsx(positionClasses[position], className)}>
        <GlassCard className={variantClasses[variant]}>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
            />
            <span className="text-sm text-gray-300">Loading...</span>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Minimal variant - just the current mode indicator
  if (variant === 'minimal') {
    return (
      <div className={clsx(positionClasses[position], className)}>
        <motion.button
          onClick={() => cycleMode()}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="relative p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <currentOption.icon 
            className="w-5 h-5"
            style={{ color: currentOption.color }}
          />
          
          {showKeyboardHints && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">M</span>
            </div>
          )}

          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50"
              >
                <GlassCard className="p-2 whitespace-nowrap">
                  <span className="text-sm text-white capitalize">{currentMode} mode</span>
                  {showKeyboardHints && (
                    <div className="text-xs text-gray-400 mt-1">Ctrl+M to cycle</div>
                  )}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    );
  }

  return (
    <div className={clsx(positionClasses[position], className)}>
      <GlassCard 
        ref={toggleRef}
        className={clsx(variantClasses[variant], 'relative overflow-hidden')}
        onMouseMove={handleMouseMove}
      >
        {/* Glow effect */}
        {enableHoverEffects && (
          <motion.div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${mouseX}px ${mouseY}px, ${currentOption.color}40 0%, transparent 50%)`,
            }}
          />
        )}

        {/* Admin overlay indicator */}
        <AnimatePresence>
          {adminOverlay && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full"
            >
              <Crown className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-300">Admin</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main toggle button */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-left group"
          whileHover={{ scale: enableHoverEffects ? 1.02 : 1 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="relative p-2 rounded-lg border"
              style={{ 
                borderColor: currentOption.color,
                backgroundColor: `${currentOption.color}20`,
              }}
              whileHover={{ scale: 1.1 }}
            >
              <currentOption.icon 
                className="w-5 h-5"
                style={{ color: currentOption.color }}
              />
              
              {/* Complexity indicator */}
              <div className="absolute -bottom-1 -right-1">
                {getComplexityIcon(currentOption.complexity)}
              </div>
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                  {currentOption.name} Mode
                </h3>
                {showKeyboardHints && (
                  <div className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
                    Ctrl+M
                  </div>
                )}
              </div>
              
              {showDescription && variant === 'full' && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {currentOption.description}
                </p>
              )}
            </div>
          </div>

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </motion.div>
        </motion.button>

        {/* Mode selection dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mt-4 border-t border-white/10 pt-4 overflow-hidden"
            >
              <div className="space-y-2">
                {modeOptions.map((option) => (
                  <motion.button
                    key={option.mode}
                    onClick={() => handleModeChange(option.mode)}
                    onMouseEnter={() => setHoveredMode(option.mode)}
                    onMouseLeave={() => setHoveredMode(null)}
                    className={clsx(
                      'w-full p-3 rounded-lg border transition-all text-left',
                      'hover:bg-white/5',
                      option.mode === currentMode
                        ? 'border-white/20 bg-white/10'
                        : 'border-white/5',
                      hoveredMode === option.mode && 'ring-2 ring-blue-500/30'
                    )}
                    style={{
                      borderColor: option.mode === currentMode ? option.color : undefined
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: modeOptions.indexOf(option) * 0.1 }}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="p-2 rounded-lg border"
                        style={{ 
                          borderColor: option.color,
                          backgroundColor: `${option.color}20`,
                        }}
                      >
                        <option.icon 
                          className="w-4 h-4"
                          style={{ color: option.color }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">
                            {option.name}
                          </h4>
                          {getComplexityIcon(option.complexity)}
                          {option.mode === currentMode && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full">
                              <Eye className="w-3 h-3 text-green-400" />
                              <span className="text-xs text-green-300">Active</span>
                            </div>
                          )}
                        </div>

                        <p className="text-sm text-gray-400 mt-1">
                          {option.description}
                        </p>

                        {variant === 'full' && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {option.features.map((feature, index) => (
                              <span
                                key={index}
                                className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Admin toggle */}
              <motion.button
                onClick={toggleAdmin}
                className={clsx(
                  'w-full p-3 mt-3 rounded-lg border border-dashed transition-all text-left',
                  adminOverlay
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-white/20 hover:bg-white/5'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-2 rounded-lg border',
                    adminOverlay
                      ? 'border-yellow-500/50 bg-yellow-500/20'
                      : 'border-white/10 bg-white/5'
                  )}>
                    {adminOverlay ? (
                      <Shield className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Settings className="w-4 h-4 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        Admin Overlay
                      </span>
                      {showKeyboardHints && (
                        <div className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-300">
                          Ctrl+Shift+A
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {adminOverlay ? 'Disable admin features' : 'Enable admin features'}
                    </p>
                  </div>

                  <div className={clsx(
                    'w-8 h-4 rounded-full border transition-colors',
                    adminOverlay
                      ? 'bg-yellow-500/30 border-yellow-500/50'
                      : 'bg-white/10 border-white/20'
                  )}>
                    <motion.div
                      className={clsx(
                        'w-3 h-3 rounded-full mt-0.5',
                        adminOverlay ? 'bg-yellow-400' : 'bg-gray-400'
                      )}
                      animate={{ x: adminOverlay ? 18 : 2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  </div>
                </div>
              </motion.button>

              {/* Statistics */}
              {showStats && statistics.totalChanges > 0 && variant === 'full' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 pt-3 border-t border-white/10"
                >
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Usage Stats
                  </h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3 h-3 text-blue-400" />
                      <div>
                        <div className="text-sm font-medium text-white">{statistics.totalChanges}</div>
                        <div className="text-xs text-gray-400">Mode Changes</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Keyboard className="w-3 h-3 text-purple-400" />
                      <div>
                        <div className="text-sm font-medium text-white">{statistics.keyboardUsage}%</div>
                        <div className="text-xs text-gray-400">Keyboard</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick cycle indicator */}
        {showKeyboardHints && !isOpen && variant !== 'minimal' && (
          <div className="absolute bottom-2 right-2 opacity-50 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Keyboard className="w-3 h-3" />
              <span>Ctrl+M</span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Click outside to close */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModeToggle;