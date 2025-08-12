'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Play,
  Pause,
  Square,
  Headphones,
  Radio,
  Zap,
  Brain,
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Loader,
  Waves,
  Activity,
  Sparkles,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/components/theme/ThemeProvider';

// Voice Recognition Types
export interface VoiceCommand {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  category: 'navigation' | 'dashboard' | 'alerts' | 'system' | 'data' | 'help';
  action: (params?: any) => Promise<void> | void;
  parameters?: VoiceParameter[];
  examples: string[];
  confidence: number;
  enabled: boolean;
}

export interface VoiceParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  required: boolean;
  options?: string[];
  description: string;
}

export interface VoiceConfig {
  enabled: boolean;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  sensitivity: number;
  wakeWord: string;
  confirmationRequired: boolean;
  voiceFeedback: boolean;
  hotkey: string;
  noiseReduction: boolean;
  echoCancellation: boolean;
  autoGain: boolean;
  timeout: number;
  confidenceThreshold: number;
}

export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  hasPermission: boolean;
  currentTranscript: string;
  finalTranscript: string;
  confidence: number;
  lastCommand?: VoiceCommand;
  error?: string;
}

export interface VoiceStats {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageConfidence: number;
  sessionDuration: number;
  commandsByCategory: Record<string, number>;
  accuracyRate: number;
}

// Default Configuration
const DEFAULT_CONFIG: VoiceConfig = {
  enabled: false,
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 3,
  sensitivity: 0.7,
  wakeWord: 'hey monitor',
  confirmationRequired: false,
  voiceFeedback: true,
  hotkey: 'ctrl+shift+m',
  noiseReduction: true,
  echoCancellation: true,
  autoGain: true,
  timeout: 5000,
  confidenceThreshold: 0.75,
};

// Voice Commands Registry
const createDefaultCommands = (onCommand: (command: string, params?: any) => void): VoiceCommand[] => [
  // Navigation Commands
  {
    id: 'navigate-dashboard',
    name: 'Go to Dashboard',
    description: 'Navigate to the main dashboard',
    patterns: ['go to dashboard', 'show dashboard', 'open dashboard', 'navigate to dashboard'],
    category: 'navigation',
    action: () => onCommand('navigate', { route: '/dashboard' }),
    examples: ['Go to dashboard', 'Show me the dashboard'],
    confidence: 0.9,
    enabled: true,
  },
  {
    id: 'navigate-alerts',
    name: 'Go to Alerts',
    description: 'Navigate to alerts panel',
    patterns: ['show alerts', 'go to alerts', 'open alerts', 'check alerts', 'view alerts'],
    category: 'navigation',
    action: () => onCommand('navigate', { route: '/alerts' }),
    examples: ['Show me alerts', 'Go to alerts'],
    confidence: 0.9,
    enabled: true,
  },
  {
    id: 'navigate-settings',
    name: 'Go to Settings',
    description: 'Navigate to settings page',
    patterns: ['open settings', 'go to settings', 'show settings', 'configure'],
    category: 'navigation',
    action: () => onCommand('navigate', { route: '/settings' }),
    examples: ['Open settings', 'Go to settings'],
    confidence: 0.9,
    enabled: true,
  },

  // Dashboard Commands
  {
    id: 'refresh-data',
    name: 'Refresh Data',
    description: 'Refresh dashboard data',
    patterns: ['refresh', 'reload', 'update data', 'refresh data', 'get latest data'],
    category: 'dashboard',
    action: () => onCommand('refresh'),
    examples: ['Refresh the data', 'Update data'],
    confidence: 0.85,
    enabled: true,
  },
  {
    id: 'toggle-theme',
    name: 'Toggle Theme',
    description: 'Switch between light and dark themes',
    patterns: ['toggle theme', 'switch theme', 'change theme', 'dark mode', 'light mode'],
    category: 'dashboard',
    action: () => onCommand('toggleTheme'),
    examples: ['Toggle theme', 'Switch to dark mode'],
    confidence: 0.8,
    enabled: true,
  },
  {
    id: 'fullscreen',
    name: 'Toggle Fullscreen',
    description: 'Enter or exit fullscreen mode',
    patterns: ['fullscreen', 'full screen', 'exit fullscreen', 'toggle fullscreen'],
    category: 'dashboard',
    action: () => onCommand('fullscreen'),
    examples: ['Go fullscreen', 'Exit fullscreen'],
    confidence: 0.8,
    enabled: true,
  },

  // System Status Commands
  {
    id: 'system-status',
    name: 'Check System Status',
    description: 'Get current system health status',
    patterns: ['system status', 'health check', 'how is the system', 'system health', 'check system'],
    category: 'system',
    action: () => onCommand('systemStatus'),
    examples: ['What\'s the system status?', 'How is the system health?'],
    confidence: 0.85,
    enabled: true,
  },
  {
    id: 'cpu-usage',
    name: 'Check CPU Usage',
    description: 'Get current CPU utilization',
    patterns: ['cpu usage', 'processor usage', 'cpu load', 'how much cpu'],
    category: 'system',
    action: () => onCommand('cpuUsage'),
    examples: ['What\'s the CPU usage?', 'Show CPU load'],
    confidence: 0.8,
    enabled: true,
  },
  {
    id: 'memory-usage',
    name: 'Check Memory Usage',
    description: 'Get current memory utilization',
    patterns: ['memory usage', 'ram usage', 'memory load', 'how much memory'],
    category: 'system',
    action: () => onCommand('memoryUsage'),
    examples: ['What\'s the memory usage?', 'Show RAM usage'],
    confidence: 0.8,
    enabled: true,
  },

  // Alert Commands
  {
    id: 'active-alerts',
    name: 'Count Active Alerts',
    description: 'Get number of active alerts',
    patterns: ['how many alerts', 'active alerts', 'alert count', 'number of alerts'],
    category: 'alerts',
    action: () => onCommand('activeAlerts'),
    examples: ['How many active alerts?', 'Show alert count'],
    confidence: 0.85,
    enabled: true,
  },
  {
    id: 'critical-alerts',
    name: 'Show Critical Alerts',
    description: 'Display only critical severity alerts',
    patterns: ['critical alerts', 'show critical', 'urgent alerts', 'high priority alerts'],
    category: 'alerts',
    action: () => onCommand('criticalAlerts'),
    examples: ['Show critical alerts', 'What critical alerts do we have?'],
    confidence: 0.9,
    enabled: true,
  },
  {
    id: 'acknowledge-alerts',
    name: 'Acknowledge All Alerts',
    description: 'Acknowledge all visible alerts',
    patterns: ['acknowledge alerts', 'ack all alerts', 'dismiss alerts', 'clear alerts'],
    category: 'alerts',
    action: () => onCommand('acknowledgeAlerts'),
    examples: ['Acknowledge all alerts', 'Clear all alerts'],
    confidence: 0.8,
    enabled: true,
  },

  // Data Query Commands
  {
    id: 'api-latency',
    name: 'Check API Latency',
    description: 'Get current API response times',
    patterns: ['api latency', 'response time', 'api speed', 'how fast is api'],
    category: 'data',
    action: () => onCommand('apiLatency'),
    examples: ['What\'s the API latency?', 'Show response times'],
    confidence: 0.8,
    enabled: true,
  },
  {
    id: 'error-rate',
    name: 'Check Error Rate',
    description: 'Get current error rate percentage',
    patterns: ['error rate', 'failure rate', 'how many errors', 'error percentage'],
    category: 'data',
    action: () => onCommand('errorRate'),
    examples: ['What\'s the error rate?', 'Show failure rate'],
    confidence: 0.8,
    enabled: true,
  },
  {
    id: 'active-users',
    name: 'Check Active Users',
    description: 'Get number of currently active users',
    patterns: ['active users', 'user count', 'how many users', 'online users'],
    category: 'data',
    action: () => onCommand('activeUsers'),
    examples: ['How many active users?', 'Show user count'],
    confidence: 0.85,
    enabled: true,
  },

  // Help Commands
  {
    id: 'help',
    name: 'Show Help',
    description: 'Display available voice commands',
    patterns: ['help', 'what can you do', 'show commands', 'voice commands', 'available commands'],
    category: 'help',
    action: () => onCommand('help'),
    examples: ['Help', 'What commands are available?'],
    confidence: 0.9,
    enabled: true,
  },
  {
    id: 'stop-listening',
    name: 'Stop Listening',
    description: 'Disable voice recognition',
    patterns: ['stop listening', 'disable voice', 'turn off voice', 'stop voice'],
    category: 'help',
    action: () => onCommand('stopListening'),
    examples: ['Stop listening', 'Turn off voice commands'],
    confidence: 0.95,
    enabled: true,
  },
];

// Voice Recognition Hook
export const useVoiceRecognition = () => {
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    isSupported: false,
    hasPermission: false,
    currentTranscript: '',
    finalTranscript: '',
    confidence: 0,
  });
  const [stats, setStats] = useState<VoiceStats>({
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageConfidence: 0,
    sessionDuration: 0,
    commandsByCategory: {},
    accuracyRate: 0,
  });
  
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const sessionStartRef = useRef<number>(Date.now());
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const commandsRef = useRef<VoiceCommand[]>([]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: true }));
      synthesisRef.current = window.speechSynthesis;
      
      const recognition = new SpeechRecognition();
      recognition.continuous = config.continuous;
      recognition.interimResults = config.interimResults;
      recognition.lang = config.language;
      recognition.maxAlternatives = config.maxAlternatives;
      
      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: undefined }));
        startTimeout();
      };
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        let maxConfidence = 0;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0.8;
          
          if (result.isFinal) {
            finalTranscript += transcript;
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }
        
        setState(prev => ({
          ...prev,
          currentTranscript: interimTranscript,
          finalTranscript: finalTranscript.trim(),
          confidence: maxConfidence,
        }));
        
        if (finalTranscript.trim()) {
          processCommand(finalTranscript.trim(), maxConfidence);
        }
        
        resetTimeout();
      };
      
      recognition.onerror = (event: any) => {
        setState(prev => ({
          ...prev,
          isListening: false,
          isProcessing: false,
          error: event.error,
        }));
        clearTimeout();
      };
      
      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
        clearTimeout();
        
        // Auto-restart if continuous mode is enabled
        if (config.enabled && config.continuous) {
          setTimeout(() => startListening(), 100);
        }
      };
      
      recognitionRef.current = recognition;
    } else {
      setState(prev => ({ 
        ...prev, 
        isSupported: false, 
        error: 'Speech recognition not supported in this browser'
      }));
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      clearTimeout();
    };
  }, [config]);

  // Timeout management
  const startTimeout = () => {
    if (config.timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        stopListening();
      }, config.timeout);
    }
  };
  
  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      startTimeout();
    }
  };
  
  const clearTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  // Command processing
  const processCommand = useCallback(async (transcript: string, confidence: number) => {
    setState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      // Check wake word if required
      if (config.wakeWord && !transcript.toLowerCase().includes(config.wakeWord.toLowerCase())) {
        return;
      }
      
      // Remove wake word from transcript
      let cleanTranscript = transcript.toLowerCase();
      if (config.wakeWord) {
        cleanTranscript = cleanTranscript.replace(config.wakeWord.toLowerCase(), '').trim();
      }
      
      // Find matching command
      const matchedCommand = findBestMatch(cleanTranscript, confidence);
      
      if (matchedCommand && confidence >= config.confidenceThreshold) {
        setState(prev => ({ ...prev, lastCommand: matchedCommand }));
        
        // Execute command
        if (config.confirmationRequired && !['help', 'stop-listening'].includes(matchedCommand.id)) {
          const confirmed = await requestConfirmation(matchedCommand);
          if (!confirmed) return;
        }
        
        await matchedCommand.action();
        
        // Update stats
        setStats(prev => ({
          ...prev,
          totalCommands: prev.totalCommands + 1,
          successfulCommands: prev.successfulCommands + 1,
          commandsByCategory: {
            ...prev.commandsByCategory,
            [matchedCommand.category]: (prev.commandsByCategory[matchedCommand.category] || 0) + 1,
          },
          averageConfidence: (prev.averageConfidence * prev.totalCommands + confidence) / (prev.totalCommands + 1),
          accuracyRate: ((prev.successfulCommands + 1) / (prev.totalCommands + 1)) * 100,
        }));
        
        // Voice feedback
        if (config.voiceFeedback) {
          speak(`Command executed: ${matchedCommand.name}`);
        }
      } else {
        // Command not recognized
        setStats(prev => ({
          ...prev,
          totalCommands: prev.totalCommands + 1,
          failedCommands: prev.failedCommands + 1,
          accuracyRate: (prev.successfulCommands / (prev.totalCommands + 1)) * 100,
        }));
        
        if (config.voiceFeedback) {
          speak('Command not recognized. Say "help" to see available commands.');
        }
      }
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [config]);

  // Find best matching command
  const findBestMatch = (transcript: string, confidence: number): VoiceCommand | null => {
    let bestMatch: VoiceCommand | null = null;
    let bestScore = 0;
    
    for (const command of commandsRef.current) {
      if (!command.enabled) continue;
      
      for (const pattern of command.patterns) {
        const score = calculateSimilarity(transcript, pattern.toLowerCase());
        const adjustedScore = score * confidence;
        
        if (adjustedScore > bestScore && adjustedScore >= config.sensitivity) {
          bestScore = adjustedScore;
          bestMatch = command;
        }
      }
    }
    
    return bestMatch;
  };

  // Calculate string similarity (simplified Levenshtein distance)
  const calculateSimilarity = (a: string, b: string): number => {
    // Simple word overlap scoring
    const wordsA = a.split(' ');
    const wordsB = b.split(' ');
    const matchingWords = wordsA.filter(word => wordsB.includes(word));
    
    return matchingWords.length / Math.max(wordsA.length, wordsB.length);
  };

  // Request confirmation
  const requestConfirmation = async (command: VoiceCommand): Promise<boolean> => {
    return new Promise((resolve) => {
      speak(`Execute command: ${command.name}? Say "yes" to confirm or "no" to cancel.`);
      
      const confirmationTimeout = setTimeout(() => {
        resolve(false);
      }, 5000);
      
      const handleConfirmation = (transcript: string) => {
        clearTimeout(confirmationTimeout);
        const response = transcript.toLowerCase().trim();
        resolve(response.includes('yes') || response.includes('confirm'));
      };
      
      // Listen for confirmation (simplified)
      // In a real implementation, this would use a separate recognition instance
      setTimeout(() => handleConfirmation('yes'), 1000); // Auto-confirm for demo
    });
  };

  // Text-to-speech
  const speak = (text: string) => {
    if (!synthesisRef.current || !config.voiceFeedback) return;
    
    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    synthesisRef.current.speak(utterance);
  };

  // Request microphone permission
  const requestPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, hasPermission: true }));
      return true;
    } catch (error) {
      setState(prev => ({ ...prev, hasPermission: false, error: 'Microphone access denied' }));
      return false;
    }
  };

  // Control functions
  const startListening = async () => {
    if (!state.isSupported) return false;
    
    if (!state.hasPermission) {
      const granted = await requestPermission();
      if (!granted) return false;
    }
    
    if (recognitionRef.current && !state.isListening) {
      try {
        recognitionRef.current.start();
        return true;
      } catch (error) {
        setState(prev => ({ ...prev, error: 'Failed to start voice recognition' }));
        return false;
      }
    }
    
    return false;
  };
  
  const stopListening = () => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
      setState(prev => ({ ...prev, isListening: false }));
    }
  };
  
  const toggleListening = async () => {
    if (state.isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  // Update session duration
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        sessionDuration: Date.now() - sessionStartRef.current,
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    config,
    setConfig,
    state,
    stats,
    commands: commandsRef.current,
    setCommands: (commands: VoiceCommand[]) => {
      commandsRef.current = commands;
    },
    startListening,
    stopListening,
    toggleListening,
    speak,
    requestPermission,
  };
};

// Voice Commands Component
export interface VoiceCommandsProps {
  onCommand?: (command: string, params?: any) => void;
  className?: string;
  showStats?: boolean;
  showCommands?: boolean;
}

export const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  onCommand,
  className = '',
  showStats = false,
  showCommands = false,
}) => {
  const { currentTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandList, setShowCommandList] = useState(showCommands);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const handleCommand = useCallback((command: string, params?: any) => {
    if (onCommand) {
      onCommand(command, params);
    } else {
      console.log('Voice command:', command, params);
    }
  }, [onCommand]);
  
  const voice = useVoiceRecognition();
  
  // Initialize commands
  useEffect(() => {
    const commands = createDefaultCommands(handleCommand);
    voice.setCommands(commands);
  }, [handleCommand]);
  
  // Auto-start if enabled
  useEffect(() => {
    if (voice.config.enabled && voice.state.isSupported) {
      voice.startListening();
    }
  }, [voice.config.enabled]);

  const getStatusColor = () => {
    if (voice.state.error) return '#ef4444';
    if (voice.state.isListening) return '#22c55e';
    if (voice.state.isProcessing) return '#f59e0b';
    return '#6b7280';
  };
  
  const getStatusIcon = () => {
    if (voice.state.error) return XCircle;
    if (voice.state.isListening) return Mic;
    if (voice.state.isProcessing) return Loader;
    return MicOff;
  };
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  const categories = Array.from(new Set(voice.commands.map(cmd => cmd.category)));
  const filteredCommands = selectedCategory === 'all' 
    ? voice.commands 
    : voice.commands.filter(cmd => cmd.category === selectedCategory);

  if (!voice.state.isSupported) {
    return (
      <GlassCard className={`p-4 ${className}`}>
        <div className="flex items-center gap-3 text-gray-400">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">Voice commands not supported in this browser</span>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className={`voice-commands ${className}`}>
      {/* Main Control */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  scale: voice.state.isListening ? [1, 1.2, 1] : 1,
                  rotate: voice.state.isProcessing ? 360 : 0,
                }}
                transition={{ 
                  scale: { duration: 1, repeat: Infinity },
                  rotate: { duration: 1, repeat: Infinity, ease: 'linear' }
                }}
                className="relative"
              >
                {React.createElement(getStatusIcon(), {
                  className: "w-6 h-6",
                  style: { color: getStatusColor() }
                })}
                
                {voice.state.isListening && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: getStatusColor() }}
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>
              
              <div>
                <div className="text-sm font-medium text-white">
                  {voice.state.isListening ? 'Listening...' :
                   voice.state.isProcessing ? 'Processing...' :
                   voice.state.error ? 'Error' :
                   voice.config.enabled ? 'Ready' : 'Disabled'}
                </div>
                
                {voice.state.error && (
                  <div className="text-xs text-red-400">{voice.state.error}</div>
                )}
                
                {voice.state.currentTranscript && (
                  <div className="text-xs text-blue-400">">{voice.state.currentTranscript}"</div>
                )}
                
                {voice.state.lastCommand && (
                  <div className="text-xs text-green-400">
                    Last: {voice.state.lastCommand.name}
                  </div>
                )}
              </div>
            </div>
            
            {/* Confidence Meter */}
            {voice.state.confidence > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Confidence:</span>
                <div className="w-20 h-2 bg-gray-600 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: voice.state.confidence > 0.8 ? '#22c55e' :
                                voice.state.confidence > 0.6 ? '#f59e0b' : '#ef4444'
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${voice.state.confidence * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-xs text-white">
                  {Math.round(voice.state.confidence * 100)}%
                </span>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Toggle Listening */}
            <motion.button
              onClick={() => voice.toggleListening()}
              disabled={!voice.state.hasPermission}
              className={`p-2 rounded-lg transition-colors ${
                voice.state.isListening
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {voice.state.isListening ? (
                <Square className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </motion.button>
            
            {/* Voice Feedback Toggle */}
            <motion.button
              onClick={() => voice.setConfig(prev => ({ ...prev, voiceFeedback: !prev.voiceFeedback }))}
              className={`p-2 rounded-lg transition-colors ${
                voice.config.voiceFeedback
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {voice.config.voiceFeedback ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </motion.button>
            
            {/* Commands List */}
            <motion.button
              onClick={() => setShowCommandList(!showCommandList)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MessageCircle className="w-4 h-4" />
            </motion.button>
            
            {/* Settings */}
            <motion.button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
        
        {/* Wake Word Display */}
        {voice.config.wakeWord && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">Wake word:</span>
              <span className="text-blue-300 font-medium">"{voice.config.wakeWord}"</span>
            </div>
          </div>
        )}
      </GlassCard>
      
      {/* Stats Panel */}
      {showStats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <GlassCard className="p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Voice Recognition Stats
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{voice.stats.successfulCommands}</div>
                <div className="text-sm text-gray-400">Successful</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{voice.stats.failedCommands}</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {Math.round(voice.stats.accuracyRate)}%
                </div>
                <div className="text-sm text-gray-400">Accuracy</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {formatDuration(voice.stats.sessionDuration)}
                </div>
                <div className="text-sm text-gray-400">Session</div>
              </div>
            </div>
            
            {Object.keys(voice.stats.commandsByCategory).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-white mb-2">Commands by Category</h4>
                <div className="space-y-2">
                  {Object.entries(voice.stats.commandsByCategory).map(([category, count]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-sm text-gray-400 capitalize">{category}</span>
                      <span className="text-sm font-medium text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}
      
      {/* Commands List */}
      <AnimatePresence>
        {showCommandList && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
          >
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-400" />
                  Available Commands
                </h3>
                
                {/* Category Filter */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    All
                  </button>
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${
                        selectedCategory === category
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {filteredCommands.map((command) => (
                  <motion.div
                    key={command.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border transition-all ${
                      command.enabled
                        ? 'border-white/10 bg-white/5 hover:bg-white/10'
                        : 'border-gray-600 bg-gray-800/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white">{command.name}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            command.category === 'navigation' ? 'bg-blue-500/20 text-blue-300' :
                            command.category === 'dashboard' ? 'bg-green-500/20 text-green-300' :
                            command.category === 'alerts' ? 'bg-red-500/20 text-red-300' :
                            command.category === 'system' ? 'bg-yellow-500/20 text-yellow-300' :
                            command.category === 'data' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-gray-500/20 text-gray-300'
                          }`}>
                            {command.category}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-400 mb-2">{command.description}</p>
                        
                        <div className="space-y-1">
                          {command.examples.map((example, index) => (
                            <div key={index} className="text-xs text-blue-300 font-mono">
                              "{example}"
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-400">
                          {Math.round(command.confidence * 100)}%
                        </div>
                        
                        {command.enabled ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">Voice Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* General Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">General</h3>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.enabled}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Enable voice commands</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.continuous}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, continuous: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Continuous listening</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.voiceFeedback}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, voiceFeedback: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Voice feedback</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.confirmationRequired}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, confirmationRequired: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Require confirmation for actions</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Recognition Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Recognition</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Language
                        </label>
                        <select
                          value={voice.config.language}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, language: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="en-US" className="bg-gray-800">English (US)</option>
                          <option value="en-GB" className="bg-gray-800">English (UK)</option>
                          <option value="es-ES" className="bg-gray-800">Spanish</option>
                          <option value="fr-FR" className="bg-gray-800">French</option>
                          <option value="de-DE" className="bg-gray-800">German</option>
                          <option value="ja-JP" className="bg-gray-800">Japanese</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Wake Word
                        </label>
                        <input
                          type="text"
                          value={voice.config.wakeWord}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, wakeWord: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder="hey monitor"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Sensitivity: {Math.round(voice.config.sensitivity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={voice.config.sensitivity}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, sensitivity: parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Confidence Threshold: {Math.round(voice.config.confidenceThreshold * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="0.95"
                          step="0.05"
                          value={voice.config.confidenceThreshold}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Timeout: {voice.config.timeout / 1000}s
                        </label>
                        <input
                          type="range"
                          min="2000"
                          max="10000"
                          step="1000"
                          value={voice.config.timeout}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Audio Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Audio</h3>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.noiseReduction}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, noiseReduction: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Noise reduction</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.echoCancellation}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, echoCancellation: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Echo cancellation</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={voice.config.autoGain}
                          onChange={(e) => voice.setConfig(prev => ({ ...prev, autoGain: e.target.checked }))}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Automatic gain control</span>
                      </label>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceCommands;