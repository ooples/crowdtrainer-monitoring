'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings } from 'lucide-react';
import NotificationSystem, { NotificationBell } from './NotificationSystem';
import { NotificationProvider, useNotifications } from './NotificationProvider';
import { Event, Alert } from '../../types/monitoring';

// Example data generators
const generateMockEvent = (severity: 'info' | 'warning' | 'error' | 'critical'): Event => ({
  id: `event-${Date.now()}-${Math.random()}`,
  timestamp: new Date().toISOString(),
  category: 'system',
  type: 'performance',
  title: `${severity.charAt(0).toUpperCase() + severity.slice(1)} Event`,
  description: `This is a mock ${severity} event for testing notifications.`,
  severity,
  metadata: { source: 'mock', automated: true },
});

const generateMockAlert = (type: 'info' | 'warning' | 'error' | 'critical'): Alert => ({
  id: `alert-${Date.now()}-${Math.random()}`,
  title: `${type.charAt(0).toUpperCase() + type.slice(1)} Alert`,
  message: `This is a mock ${type} alert for testing notifications.`,
  type,
  timestamp: new Date().toISOString(),
  actionRequired: type === 'critical' || type === 'error',
  resolved: false,
});

// Demo Controls Component
const NotificationDemo: React.FC = () => {
  const { 
    addNotification, 
    notifications, 
    clearAll, 
    settings, 
    updateSettings,
    playNotificationSound,
    muteAll,
    unmuteAll 
  } = useNotifications();
  
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [autoInterval, setAutoInterval] = useState<NodeJS.Timeout | null>(null);

  // Auto-generate notifications for demo
  useEffect(() => {
    if (isAutoMode) {
      const interval = setInterval(() => {
        const types = ['info', 'warning', 'error', 'critical'] as const;
        const randomType = types[Math.floor(Math.random() * types.length)];
        
        addNotification({
          title: `Auto ${randomType} notification`,
          message: `This is an automatically generated ${randomType} notification for demo purposes.`,
          type: randomType,
          source: 'system',
          priority: randomType === 'critical' ? 5 : randomType === 'error' ? 4 : 3,
        });
      }, 3000); // Every 3 seconds

      setAutoInterval(interval);
      return () => clearInterval(interval);
    } else if (autoInterval) {
      clearInterval(autoInterval);
      setAutoInterval(null);
    }
  }, [isAutoMode, addNotification]);

  // Manual notification triggers
  const triggerNotification = (type: 'info' | 'warning' | 'error' | 'critical' | 'success') => {
    const notifications = {
      info: {
        title: 'Information',
        message: 'This is an informational notification.',
        type: 'info' as const,
      },
      warning: {
        title: 'Warning Alert',
        message: 'This is a warning notification that requires attention.',
        type: 'warning' as const,
      },
      error: {
        title: 'Error Occurred',
        message: 'An error has occurred in the system.',
        type: 'error' as const,
      },
      critical: {
        title: 'Critical Issue',
        message: 'A critical issue requires immediate attention!',
        type: 'critical' as const,
      },
      success: {
        title: 'Success',
        message: 'Operation completed successfully.',
        type: 'success' as const,
      },
    };

    addNotification({
      ...notifications[type],
      source: 'user',
      action: type === 'critical' ? {
        label: 'View Details',
        onClick: () => alert('Opening details...'),
      } : undefined,
    });
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Smart Notification System Demo
          </h1>
          <p className="text-gray-400">
            Test and explore the notification system features
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Total Notifications</h3>
            <p className="text-2xl font-bold text-white">{notifications.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Unread</h3>
            <p className="text-2xl font-bold text-blue-400">
              {notifications.filter(n => !n.viewed && !n.dismissed).length}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Sound Status</h3>
            <p className="text-2xl font-bold text-green-400">
              {settings.soundEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Demo Controls</h2>
          
          {/* Auto Mode */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setIsAutoMode(!isAutoMode)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                  ${isAutoMode 
                    ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30' 
                    : 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                  }
                `}
              >
                {isAutoMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isAutoMode ? 'Stop Auto Mode' : 'Start Auto Mode'}
              </button>
              
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500/20 border border-gray-500/50 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All
              </button>
            </div>
            <p className="text-sm text-gray-400">
              Auto mode generates random notifications every 3 seconds
            </p>
          </div>

          {/* Manual Triggers */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Manual Notifications</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={() => triggerNotification('info')}
                className="p-3 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-all text-sm"
              >
                Info
              </button>
              <button
                onClick={() => triggerNotification('success')}
                className="p-3 bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg hover:bg-green-500/30 transition-all text-sm"
              >
                Success
              </button>
              <button
                onClick={() => triggerNotification('warning')}
                className="p-3 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-all text-sm"
              >
                Warning
              </button>
              <button
                onClick={() => triggerNotification('error')}
                className="p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg hover:bg-red-500/30 transition-all text-sm"
              >
                Error
              </button>
              <button
                onClick={() => triggerNotification('critical')}
                className="p-3 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-all text-sm"
              >
                Critical
              </button>
            </div>
          </div>

          {/* Sound Controls */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Sound Controls</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={settings.soundEnabled ? muteAll : unmuteAll}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                  ${settings.soundEnabled 
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/30' 
                    : 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30'
                  }
                `}
              >
                {settings.soundEnabled ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {settings.soundEnabled ? 'Mute' : 'Unmute'}
              </button>
              
              <button
                onClick={() => playNotificationSound('info')}
                className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-all"
              >
                Test Sound
              </button>
            </div>
            
            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-2">
                Volume: {Math.round(settings.soundVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.soundVolume}
                onChange={(e) => updateSettings({ soundVolume: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-lg font-medium mb-3">Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Show toast notifications</span>
                <input
                  type="checkbox"
                  checked={settings.showToasts}
                  onChange={(e) => updateSettings({ showToasts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Show notification badge</span>
                <input
                  type="checkbox"
                  checked={settings.showBadge}
                  onChange={(e) => updateSettings({ showBadge: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Persist history</span>
                <input
                  type="checkbox"
                  checked={settings.persistHistory}
                  onChange={(e) => updateSettings({ persistHistory: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Max notifications: {settings.maxNotifications}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={settings.maxNotifications}
                  onChange={(e) => updateSettings({ maxNotifications: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notification Bell in header position */}
        <div className="fixed top-4 right-4 z-40">
          <NotificationBell className="bg-gray-800 border border-gray-700" />
        </div>

        {/* Feature List */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-white mb-2">Core Features</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Smart deduplication</li>
                <li>• Auto-dismiss with timeout</li>
                <li>• Sound alerts (5 different types)</li>
                <li>• Toast notifications</li>
                <li>• Notification center with history</li>
                <li>• Real-time unread badge</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Smart Detection</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Auto-detect events and alerts</li>
                <li>• System health monitoring</li>
                <li>• Performance threshold alerts</li>
                <li>• OAuth health monitoring</li>
                <li>• Batch notification prevention</li>
                <li>• Priority-based notifications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Complete example with provider
const NotificationSystemExample: React.FC = () => {
  return (
    <NotificationProvider>
      <NotificationDemo />
      <NotificationSystem
        enableAutoDetection={false}
        showBell={false} // We're showing our own in the demo
        toastPosition="top-right"
        maxToasts={3}
      />
    </NotificationProvider>
  );
};

export default NotificationSystemExample;