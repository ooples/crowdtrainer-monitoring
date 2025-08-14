'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  BellOff, 
  X, 
  Settings, 
  Trash2, 
  CheckCircle, 
  Filter,
  Search,
  Volume2,
  VolumeX,
  AlertTriangle,
  Info,
  AlertCircle,
  Zap,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { Notification, useNotifications } from './NotificationProvider';

// Filter types
type NotificationFilter = 'all' | 'unread' | 'today' | 'error' | 'critical' | 'warning' | 'info' | 'success';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const {
    notifications,
    unreadCount,
    dismissNotification,
    removeNotification,
    markAsViewed,
    markAllAsViewed,
    clearAll,
    clearDismissed,
    settings,
    updateSettings,
    muteAll,
    unmuteAll,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
      );
    }

    // Apply type/status filters
    switch (activeFilter) {
      case 'unread':
        filtered = filtered.filter(n => !n.viewed && !n.dismissed);
        break;
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter(n => n.timestamp >= today);
        break;
      case 'error':
      case 'critical':
      case 'warning':
      case 'info':
      case 'success':
        filtered = filtered.filter(n => n.type === activeFilter);
        break;
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [notifications, activeFilter, searchQuery]);

  // Get icon for notification type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      case 'error':
        return AlertCircle;
      case 'critical':
        return Zap;
      default:
        return Info;
    }
  };

  // Get color classes for notification type
  const getNotificationColors = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'critical':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Filter options
  const filterOptions = [
    { key: 'all', label: 'All', icon: Bell },
    { key: 'unread', label: `Unread (${unreadCount})`, icon: Eye },
    { key: 'today', label: 'Today', icon: Clock },
    { key: 'critical', label: 'Critical', icon: Zap },
    { key: 'error', label: 'Errors', icon: AlertCircle },
    { key: 'warning', label: 'Warnings', icon: AlertTriangle },
    { key: 'info', label: 'Info', icon: Info },
    { key: 'success', label: 'Success', icon: CheckCircle },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Notification Center Panel */}
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`
          fixed top-0 right-0 h-full w-full max-w-md z-50
          bg-gray-900/95 backdrop-blur-md border-l border-white/10
          flex flex-col ${className}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Sound toggle */}
              <button
                onClick={settings.soundEnabled ? muteAll : unmuteAll}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title={settings.soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-gray-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-red-400" />
                )}
              </button>
              
              {/* Settings toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(option => {
              const Icon = option.icon;
              const isActive = activeFilter === option.key;
              
              return (
                <button
                  key={option.key}
                  onClick={() => setActiveFilter(option.key as NotificationFilter)}
                  className={`
                    inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-all
                    ${isActive 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }
                  `}
                >
                  <Icon className="w-3 h-3" />
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          {filteredNotifications.length > 0 && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={markAllAsViewed}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <Eye className="w-3 h-3" />
                Mark all read
              </button>
              <button
                onClick={clearDismissed}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-500/20 border border-gray-500/50 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear dismissed
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/10 overflow-hidden"
            >
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-medium text-white">Notification Settings</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Show toast notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.showToasts}
                      onChange={(e) => updateSettings({ showToasts: e.target.checked })}
                      className="rounded bg-white/10 border-white/20"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Sound notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.soundEnabled}
                      onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                      className="rounded bg-white/10 border-white/20"
                    />
                  </label>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Sound volume: {Math.round(settings.soundVolume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.soundVolume}
                      onChange={(e) => updateSettings({ soundVolume: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Max notifications: {settings.maxNotifications}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={settings.maxNotifications}
                      onChange={(e) => updateSettings({ maxNotifications: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8">
              <BellOff className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No notifications found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-blue-400 hover:underline text-sm mt-2"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const colors = getNotificationColors(notification.type);
                  
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 300 }}
                      className={`
                        relative p-4 rounded-lg border backdrop-blur-sm
                        transition-all duration-200 cursor-pointer
                        ${colors}
                        ${notification.dismissed ? 'opacity-50' : ''}
                        ${!notification.viewed ? 'ring-1 ring-blue-500/30' : ''}
                        hover:bg-opacity-20
                      `}
                      onClick={() => {
                        if (!notification.viewed) {
                          markAsViewed(notification.id);
                        }
                        if (notification.action) {
                          notification.action.onClick();
                        }
                      }}
                    >
                      {/* Priority indicator */}
                      {notification.priority && notification.priority >= 4 && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}

                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-medium text-white line-clamp-2">
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1">
                              {!notification.viewed && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissNotification(notification.id);
                                }}
                                className="text-gray-400 hover:text-white p-1 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          {notification.message && (
                            <p className="text-xs text-gray-300 mb-2 line-clamp-3">
                              {notification.message}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                              <span>{formatRelativeTime(notification.timestamp)}</span>
                              {notification.source && (
                                <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs">
                                  {notification.source}
                                </span>
                              )}
                            </div>
                            
                            {notification.action && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notification.action!.onClick();
                                }}
                                className="flex items-center gap-1 text-blue-400 hover:underline"
                              >
                                {notification.action.label}
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default NotificationCenter;