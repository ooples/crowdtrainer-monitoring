'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Settings,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Monitor,
  Tv,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Server,
  Database,
  Wifi,
  Shield,
  Eye,
  EyeOff,
  MoreHorizontal,
  Info,
  Home,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/components/theme/ThemeProvider';

// TV Mode Types
export interface TVModeConfig {
  layout: 'single' | 'quad' | 'grid' | 'carousel' | 'split' | 'mosaic';
  autoRotate: boolean;
  rotationInterval: number; // seconds
  showTime: boolean;
  showLogo: boolean;
  showAlerts: boolean;
  audioAlerts: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  theme: 'dark' | 'light' | 'high-contrast' | 'noc';
  widgets: TVWidget[];
  alertThreshold: {
    critical: number;
    warning: number;
    info: number;
  };
  screensaver: {
    enabled: boolean;
    timeout: number; // minutes
    type: 'clock' | 'logo' | 'slideshow' | 'matrix';
  };
}

export interface TVWidget {
  id: string;
  type: 'metric' | 'chart' | 'status' | 'alert' | 'map' | 'video' | 'custom';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  dataSource: string;
  refreshInterval: number;
  alertRules?: AlertRule[];
  displayConfig: {
    showTitle: boolean;
    showBorder: boolean;
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    colorScheme: string;
    animation: boolean;
  };
}

export interface AlertRule {
  id: string;
  condition: string;
  value: number;
  operator: '>' | '<' | '=' | '!=' | '>=' | '<=';
  severity: 'critical' | 'warning' | 'info';
  action: 'highlight' | 'flash' | 'sound' | 'popup';
}

export interface TVModeProps {
  config?: TVModeConfig;
  onConfigChange?: (config: TVModeConfig) => void;
  onExit?: () => void;
  className?: string;
  fullscreen?: boolean;
  kiosk?: boolean;
}

// Default Configuration
const DEFAULT_CONFIG: TVModeConfig = {
  layout: 'grid',
  autoRotate: false,
  rotationInterval: 30,
  showTime: true,
  showLogo: true,
  showAlerts: true,
  audioAlerts: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  theme: 'noc',
  widgets: [],
  alertThreshold: {
    critical: 5,
    warning: 10,
    info: 20,
  },
  screensaver: {
    enabled: true,
    timeout: 10,
    type: 'clock',
  },
};

// TV Mode Component
export const TVMode: React.FC<TVModeProps> = ({
  config = DEFAULT_CONFIG,
  onConfigChange,
  onExit,
  className = '',
  fullscreen = false,
  kiosk = false,
}) => {
  const { currentTheme } = useTheme();
  const [currentConfig, setCurrentConfig] = useState<TVModeConfig>(config);
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);
  const [showControls, setShowControls] = useState(!kiosk);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alerts, setAlerts] = useState<any[]>([]);
  const [muted, setMuted] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout>();
  const screensaverTimerRef = useRef<NodeJS.Timeout>();
  const activityTimerRef = useRef<NodeJS.Timeout>();
  const audioContextRef = useRef<AudioContext>();

  // Time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Auto-rotation logic
  useEffect(() => {
    if (currentConfig.autoRotate && !isPaused && !screensaverActive) {
      rotationTimerRef.current = setInterval(() => {
        setCurrentSlide(prev => {
          const maxSlides = getMaxSlides();
          return (prev + 1) % maxSlides;
        });
      }, currentConfig.rotationInterval * 1000);
    } else {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    }

    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, [currentConfig.autoRotate, currentConfig.rotationInterval, isPaused, screensaverActive]);

  // Screensaver logic
  useEffect(() => {
    if (currentConfig.screensaver.enabled) {
      const resetTimer = () => {
        if (screensaverTimerRef.current) {
          clearTimeout(screensaverTimerRef.current);
        }
        screensaverTimerRef.current = setTimeout(() => {
          setScreensaverActive(true);
        }, currentConfig.screensaver.timeout * 60 * 1000);
      };

      const handleActivity = () => {
        setScreensaverActive(false);
        resetTimer();
      };

      resetTimer();
      
      if (!kiosk) {
        document.addEventListener('mousemove', handleActivity);
        document.addEventListener('keydown', handleActivity);
        document.addEventListener('click', handleActivity);
      }

      return () => {
        if (screensaverTimerRef.current) {
          clearTimeout(screensaverTimerRef.current);
        }
        document.removeEventListener('mousemove', handleActivity);
        document.removeEventListener('keydown', handleActivity);
        document.removeEventListener('click', handleActivity);
      };
    }
  }, [currentConfig.screensaver, kiosk]);

  // Audio context for alerts
  useEffect(() => {
    if (currentConfig.audioAlerts && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [currentConfig.audioAlerts]);

  // Fullscreen management
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [isFullscreen]);

  // Alert sound generation
  const playAlertSound = useCallback((severity: 'critical' | 'warning' | 'info') => {
    if (!audioContextRef.current || muted) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different frequencies for different severities
    const frequencies = {
      critical: [800, 600, 800, 600],
      warning: [500, 700],
      info: [400],
    };

    const freqList = frequencies[severity];
    let currentFreq = 0;

    oscillator.frequency.setValueAtTime(freqList[0], ctx.currentTime);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);

    const playNextNote = () => {
      if (currentFreq < freqList.length - 1) {
        currentFreq++;
        oscillator.frequency.setValueAtTime(freqList[currentFreq], ctx.currentTime + currentFreq * 0.2);
      }
    };

    oscillator.start(ctx.currentTime);
    
    for (let i = 1; i < freqList.length; i++) {
      setTimeout(playNextNote, i * 200);
    }
    
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + freqList.length * 0.2 + 0.1);
    oscillator.stop(ctx.currentTime + freqList.length * 0.2 + 0.2);
  }, [muted]);

  // Get max slides based on layout
  const getMaxSlides = () => {
    const widgetCount = currentConfig.widgets.length;
    switch (currentConfig.layout) {
      case 'single': return widgetCount;
      case 'quad': return Math.ceil(widgetCount / 4);
      case 'grid': return Math.ceil(widgetCount / 6);
      case 'split': return Math.ceil(widgetCount / 2);
      case 'mosaic': return Math.ceil(widgetCount / 8);
      default: return widgetCount;
    }
  };

  // Navigation handlers
  const nextSlide = () => {
    const maxSlides = getMaxSlides();
    setCurrentSlide((prev) => (prev + 1) % maxSlides);
  };

  const prevSlide = () => {
    const maxSlides = getMaxSlides();
    setCurrentSlide((prev) => (prev - 1 + maxSlides) % maxSlides);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (kiosk && !['F11', 'Escape'].includes(e.key)) return;

      switch (e.key) {
        case 'F11':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            toggleFullscreen();
          } else if (onExit) {
            onExit();
          }
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(!isPaused);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevSlide();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextSlide();
          break;
        case 's':
          if (e.ctrlKey) {
            e.preventDefault();
            setShowSettings(!showSettings);
          }
          break;
        case 'm':
          e.preventDefault();
          setMuted(!muted);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen, isPaused, showSettings, muted, kiosk, toggleFullscreen, onExit]);

  // Update config handler
  const updateConfig = useCallback((updates: Partial<TVModeConfig>) => {
    const newConfig = { ...currentConfig, ...updates };
    setCurrentConfig(newConfig);
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
  }, [currentConfig, onConfigChange]);

  // Render screensaver
  const renderScreensaver = () => {
    switch (currentConfig.screensaver.type) {
      case 'clock':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-8xl font-mono font-bold text-white mb-4">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-2xl text-gray-400">
                {currentTime.toLocaleDateString([], { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </motion.div>
          </div>
        );
      case 'logo':
        return (
          <div className="flex items-center justify-center h-full">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-6xl font-bold text-white"
            >
              {currentTheme.name} Monitoring
            </motion.div>
          </div>
        );
      case 'matrix':
        return <MatrixScreensaver />;
      default:
        return null;
    }
  };

  // Render main content based on layout
  const renderContent = () => {
    if (screensaverActive) {
      return renderScreensaver();
    }

    const { layout, widgets } = currentConfig;
    const startIndex = currentSlide * getWidgetsPerSlide();
    const endIndex = startIndex + getWidgetsPerSlide();
    const currentWidgets = widgets.slice(startIndex, endIndex);

    return (
      <div className="flex-1 relative">
        {/* Time Display */}
        {currentConfig.showTime && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 right-4 z-20 text-right"
          >
            <div className="text-2xl font-mono font-bold text-white">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-sm text-gray-400">
              {currentTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </motion.div>
        )}

        {/* Logo */}
        {currentConfig.showLogo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-4 z-20"
          >
            <div className="flex items-center gap-2">
              <Tv className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-bold text-white">{currentTheme.name} NOC</span>
            </div>
          </motion.div>
        )}

        {/* Alert Banner */}
        {currentConfig.showAlerts && alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-20 left-4 right-4 z-30"
          >
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-red-300 font-medium">
                  {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Widget Grid */}
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`h-full p-4 grid gap-4 ${getGridClasses()}`}
        >
          {currentWidgets.map((widget, index) => (
            <TVWidget
              key={widget.id}
              widget={widget}
              config={currentConfig}
              onAlert={playAlertSound}
              index={index}
            />
          ))}
        </motion.div>

        {/* Navigation Indicators */}
        {getMaxSlides() > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
            {Array.from({ length: getMaxSlides() }, (_, i) => (
              <motion.button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full border-2 transition-all ${
                  i === currentSlide
                    ? 'border-blue-400 bg-blue-400'
                    : 'border-gray-400 bg-transparent hover:border-gray-300'
                }`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const getWidgetsPerSlide = () => {
    switch (currentConfig.layout) {
      case 'single': return 1;
      case 'quad': return 4;
      case 'grid': return 6;
      case 'split': return 2;
      case 'mosaic': return 8;
      default: return 4;
    }
  };

  const getGridClasses = () => {
    switch (currentConfig.layout) {
      case 'single': return 'grid-cols-1 grid-rows-1';
      case 'quad': return 'grid-cols-2 grid-rows-2';
      case 'grid': return 'grid-cols-3 grid-rows-2';
      case 'split': return 'grid-cols-2 grid-rows-1';
      case 'mosaic': return 'grid-cols-4 grid-rows-2';
      default: return 'grid-cols-2 grid-rows-2';
    }
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`tv-mode relative w-full h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 overflow-hidden ${className}`}
      style={{
        filter: `brightness(${currentConfig.brightness}%) contrast(${currentConfig.contrast}%) saturate(${currentConfig.saturation}%)`,
      }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-purple-900/20"></div>
        <motion.div 
          className="absolute top-0 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-40 -right-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"
          animate={{ x: [0, -100, 0], y: [0, 100, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {renderContent()}

      {/* Control Bar */}
      <AnimatePresence>
        {showControls && !screensaverActive && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-0 left-0 right-0 z-40"
          >
            <TVControlBar
              config={currentConfig}
              onConfigChange={updateConfig}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
              onPrevSlide={prevSlide}
              onNextSlide={nextSlide}
              currentSlide={currentSlide}
              totalSlides={getMaxSlides()}
              muted={muted}
              onToggleMute={() => setMuted(!muted)}
              onShowSettings={() => setShowSettings(true)}
              onExit={onExit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <TVSettingsPanel
            config={currentConfig}
            onConfigChange={updateConfig}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// TV Widget Component
interface TVWidgetProps {
  widget: TVWidget;
  config: TVModeConfig;
  onAlert: (severity: 'critical' | 'warning' | 'info') => void;
  index: number;
}

const TVWidget: React.FC<TVWidgetProps> = ({ widget, config, onAlert, index }) => {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [alertActive, setAlertActive] = useState(false);

  // Simulate data fetching
  useEffect(() => {
    const fetchData = async () => {
      setStatus('loading');
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data based on widget type
        const mockData = generateMockData(widget.type);
        setData(mockData);
        setStatus('success');
        
        // Check alert rules
        checkAlerts(mockData);
      } catch (error) {
        setStatus('error');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, widget.refreshInterval);
    return () => clearInterval(interval);
  }, [widget]);

  const generateMockData = (type: string) => {
    switch (type) {
      case 'metric':
        return {
          value: Math.floor(Math.random() * 100),
          trend: Math.random() > 0.5 ? 'up' : 'down',
          change: Math.floor(Math.random() * 20) - 10,
        };
      case 'status':
        return {
          status: ['online', 'offline', 'degraded'][Math.floor(Math.random() * 3)],
          uptime: Math.floor(Math.random() * 100),
          lastCheck: new Date().toISOString(),
        };
      case 'alert':
        return {
          alerts: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
            id: i,
            severity: ['critical', 'warning', 'info'][Math.floor(Math.random() * 3)],
            message: `Alert ${i + 1}`,
            timestamp: new Date().toISOString(),
          })),
        };
      default:
        return { value: Math.random() * 100 };
    }
  };

  const checkAlerts = (data: any) => {
    if (!widget.alertRules) return;

    for (const rule of widget.alertRules) {
      const value = data.value || 0;
      let triggered = false;

      switch (rule.operator) {
        case '>':
          triggered = value > rule.value;
          break;
        case '<':
          triggered = value < rule.value;
          break;
        case '=':
          triggered = value === rule.value;
          break;
        case '!=':
          triggered = value !== rule.value;
          break;
        case '>=':
          triggered = value >= rule.value;
          break;
        case '<=':
          triggered = value <= rule.value;
          break;
      }

      if (triggered) {
        setAlertActive(true);
        onAlert(rule.severity);
        
        if (rule.action === 'flash') {
          setTimeout(() => setAlertActive(false), 1000);
        }
      }
    }
  };

  const getStatusColor = () => {
    if (status === 'error') return 'border-red-500';
    if (alertActive) return 'border-yellow-500';
    return 'border-green-500';
  };

  const renderWidgetContent = () => {
    if (status === 'loading') {
      return (
        <div className="flex items-center justify-center h-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"
          />
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400">
          <XCircle className="w-12 h-12 mb-2" />
          <span className="text-sm">Connection Error</span>
        </div>
      );
    }

    switch (widget.type) {
      case 'metric':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`text-4xl font-bold mb-2 ${
              widget.displayConfig.fontSize === 'xlarge' ? 'text-6xl' :
              widget.displayConfig.fontSize === 'large' ? 'text-5xl' :
              widget.displayConfig.fontSize === 'medium' ? 'text-3xl' : 'text-2xl'
            }`}>
              {data?.value}%
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {data?.trend === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span>{data?.change > 0 ? '+' : ''}{data?.change}%</span>
            </div>
          </div>
        );
        
      case 'status':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-2 mb-4">
              {data?.status === 'online' ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : data?.status === 'degraded' ? (
                <AlertTriangle className="w-8 h-8 text-yellow-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
              <span className={`text-lg font-semibold capitalize ${
                data?.status === 'online' ? 'text-green-400' :
                data?.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {data?.status}
              </span>
            </div>
            <div className="text-sm text-gray-400 text-center">
              <div>Uptime: {data?.uptime}%</div>
              <div>Last Check: {new Date(data?.lastCheck).toLocaleTimeString()}</div>
            </div>
          </div>
        );
        
      case 'alert':
        return (
          <div className="p-4 h-full overflow-y-auto">
            <div className="space-y-2">
              {data?.alerts?.map((alert: any) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded border-l-4 ${
                    alert.severity === 'critical' ? 'border-red-500 bg-red-500/10' :
                    alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                    'border-blue-500 bg-blue-500/10'
                  }`}
                >
                  <div className="text-sm font-medium">{alert.message}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
        
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Activity className="w-12 h-12" />
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        boxShadow: alertActive ? '0 0 20px rgba(255, 255, 0, 0.5)' : '0 0 0px transparent'
      }}
      transition={{ delay: index * 0.1 }}
      className={`tv-widget relative rounded-xl border-2 transition-all duration-300 ${
        widget.displayConfig.showBorder ? getStatusColor() : 'border-transparent'
      }`}
      style={{
        background: widget.displayConfig.animation 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
          : 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {widget.displayConfig.showTitle && (
        <div className="absolute top-2 left-2 right-2 z-10">
          <h3 className="text-sm font-semibold text-white truncate">
            {widget.title}
          </h3>
        </div>
      )}
      
      <div className={`w-full h-full ${widget.displayConfig.showTitle ? 'pt-8' : ''}`}>
        {renderWidgetContent()}
      </div>
    </motion.div>
  );
};

// TV Control Bar Component
interface TVControlBarProps {
  config: TVModeConfig;
  onConfigChange: (config: Partial<TVModeConfig>) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  currentSlide: number;
  totalSlides: number;
  muted: boolean;
  onToggleMute: () => void;
  onShowSettings: () => void;
  onExit?: () => void;
}

const TVControlBar: React.FC<TVControlBarProps> = ({
  config,
  onConfigChange,
  isFullscreen,
  onToggleFullscreen,
  isPaused,
  onTogglePause,
  onPrevSlide,
  onNextSlide,
  currentSlide,
  totalSlides,
  muted,
  onToggleMute,
  onShowSettings,
  onExit,
}) => {
  return (
    <GlassCard className="mx-4 mb-4 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={onPrevSlide}
              disabled={totalSlides <= 1}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </motion.button>
            
            <span className="text-sm text-white px-2">
              {currentSlide + 1} / {totalSlides}
            </span>
            
            <motion.button
              onClick={onNextSlide}
              disabled={totalSlides <= 1}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </motion.button>
          </div>
          
          {/* Playback Controls */}
          <div className="flex items-center gap-2 border-l border-white/20 pl-3">
            <motion.button
              onClick={onTogglePause}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPaused ? (
                <Play className="w-5 h-5 text-white" />
              ) : (
                <Pause className="w-5 h-5 text-white" />
              )}
            </motion.button>
            
            <motion.button
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </motion.button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Settings */}
          <motion.button
            onClick={onShowSettings}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Settings className="w-5 h-5 text-white" />
          </motion.button>
          
          {/* Fullscreen */}
          <motion.button
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-white" />
            ) : (
              <Maximize className="w-5 h-5 text-white" />
            )}
          </motion.button>
          
          {/* Exit */}
          {onExit && (
            <motion.button
              onClick={onExit}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Home className="w-5 h-5 text-red-300" />
            </motion.button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

// TV Settings Panel Component
interface TVSettingsPanelProps {
  config: TVModeConfig;
  onConfigChange: (config: Partial<TVModeConfig>) => void;
  onClose: () => void;
}

const TVSettingsPanel: React.FC<TVSettingsPanelProps> = ({
  config,
  onConfigChange,
  onClose,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">TV Mode Settings</h2>
            <motion.button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-5 h-5 text-white" />
            </motion.button>
          </div>
          
          <div className="space-y-6">
            {/* Layout Settings */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Layout</h3>
              <div className="grid grid-cols-3 gap-3">
                {['single', 'quad', 'grid', 'split', 'mosaic', 'carousel'].map((layout) => (
                  <motion.button
                    key={layout}
                    onClick={() => onConfigChange({ layout: layout as any })}
                    className={`p-3 rounded-lg border-2 transition-all capitalize ${
                      config.layout === layout
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-white/20 bg-white/5 text-white hover:border-white/40'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {layout}
                  </motion.button>
                ))}
              </div>
            </div>
            
            {/* Auto-Rotation */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Auto-Rotation</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.autoRotate}
                    onChange={(e) => onConfigChange({ autoRotate: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-white">Enable auto-rotation</span>
                </label>
                
                {config.autoRotate && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Rotation Interval: {config.rotationInterval} seconds
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="300"
                      value={config.rotationInterval}
                      onChange={(e) => onConfigChange({ rotationInterval: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Display Options */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Display Options</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.showTime}
                    onChange={(e) => onConfigChange({ showTime: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-white">Show time</span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.showLogo}
                    onChange={(e) => onConfigChange({ showLogo: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-white">Show logo</span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.showAlerts}
                    onChange={(e) => onConfigChange({ showAlerts: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-white">Show alerts</span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.audioAlerts}
                    onChange={(e) => onConfigChange({ audioAlerts: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-white">Audio alerts</span>
                </label>
              </div>
            </div>
            
            {/* Display Adjustments */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Display Adjustments</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Brightness: {config.brightness}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={config.brightness}
                    onChange={(e) => onConfigChange({ brightness: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Contrast: {config.contrast}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={config.contrast}
                    onChange={(e) => onConfigChange({ contrast: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Saturation: {config.saturation}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={config.saturation}
                    onChange={(e) => onConfigChange({ saturation: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};

// Matrix Screensaver Component
const MatrixScreensaver: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);
    
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };
    
    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: 'black' }}
    />
  );
};

export default TVMode;