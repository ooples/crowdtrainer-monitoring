'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  TestTube, 
  AlertCircle, 
  Users, 
  Zap, 
  Trash2,
  Database,
  Activity,
  CheckCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminPanelProps {
  apiUrl: string;
  apiKey?: string;
}

export function AdminPanel({ apiUrl, apiKey }: AdminPanelProps) {
  const [results, setResults] = useState<{ [key: string]: { success: boolean; message: string } }>({});
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const showResult = (key: string, success: boolean, message: string) => {
    setResults(prev => ({ ...prev, [key]: { success, message } }));
    setTimeout(() => {
      setResults(prev => {
        const newResults = { ...prev };
        delete newResults[key];
        return newResults;
      });
    }, 3000);
  };

  const sendToAPI = async (endpoint: string, data: any) => {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey }),
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  };

  const sendTestEvent = async () => {
    setLoading(prev => ({ ...prev, testEvent: true }));
    try {
      const categories = ['api', 'database', 'auth', 'payment', 'system'];
      const severities = ['info', 'warning', 'success'];
      
      const event = {
        type: 'event',
        name: `test_event_${Math.random().toString(36).substr(2, 9)}`,
        category: categories[Math.floor(Math.random() * categories.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        title: 'Test Event from Admin Panel',
        description: 'This is a test event generated from the admin panel for verification purposes.',
        properties: {
          source: 'admin_panel',
          timestamp: Date.now(),
          test: true,
        },
        timestamp: Date.now(),
      };
      
      await sendToAPI('/events/batch', { events: [event] });
      showResult('testEvent', true, 'Test event sent successfully!');
    } catch (error) {
      showResult('testEvent', false, `Failed: ${error}`);
    } finally {
      setLoading(prev => ({ ...prev, testEvent: false }));
    }
  };

  const sendTestError = async () => {
    setLoading(prev => ({ ...prev, testError: true }));
    try {
      const errorTypes = ['TypeError', 'ReferenceError', 'NetworkError', 'ValidationError'];
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      const error = {
        type: 'error',
        severity: 'error',
        category: 'system',
        title: `${errorType}: Test error from admin panel`,
        message: `This is a test ${errorType} generated for monitoring verification`,
        stack: `${errorType}: Test error\n    at sendTestError (AdminPanel.tsx:85:15)\n    at onClick (AdminPanel.tsx:204:25)\n    at invokeEventHandler (react-dom.js:1234:10)`,
        context: {
          source: 'admin_panel',
          intentional: true,
          errorType,
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
        timestamp: Date.now(),
      };
      
      await sendToAPI('/events/batch', { events: [error] });
      showResult('testError', true, 'Test error sent successfully!');
    } catch (error) {
      showResult('testError', false, `Failed: ${error}`);
    } finally {
      setLoading(prev => ({ ...prev, testError: false }));
    }
  };

  const sendTestMetric = async () => {
    setLoading(prev => ({ ...prev, testMetric: true }));
    try {
      const metric = {
        type: 'metric',
        name: 'test.metric',
        value: Math.floor(Math.random() * 100),
        tags: {
          source: 'admin_panel',
        },
        timestamp: Date.now(),
      };
      
      await sendToAPI('/metrics', metric);
      showResult('testMetric', true, 'Test metric sent successfully!');
    } catch (error) {
      showResult('testMetric', false, `Failed: ${error}`);
    } finally {
      setLoading(prev => ({ ...prev, testMetric: false }));
    }
  };

  const sendBulkEvents = async () => {
    setLoading(prev => ({ ...prev, bulkEvents: true }));
    try {
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push({
          type: 'event',
          name: `bulk_event_${i}`,
          category: 'system',
          severity: 'info',
          title: `Bulk Event ${i}`,
          description: `Bulk test event number ${i}`,
          properties: {
            index: i,
            batch: true,
          },
          timestamp: Date.now() + i,
        });
      }
      
      await sendToAPI('/events/batch', { events });
      showResult('bulkEvents', true, '10 bulk events sent successfully!');
    } catch (error) {
      showResult('bulkEvents', false, `Failed: ${error}`);
    } finally {
      setLoading(prev => ({ ...prev, bulkEvents: false }));
    }
  };

  const simulateUserSession = async () => {
    setLoading(prev => ({ ...prev, userSession: true }));
    try {
      const userId = `user_${Math.random().toString(36).substr(2, 9)}`;
      const events = [
        {
          type: 'event',
          name: 'user_signup',
          category: 'auth',
          severity: 'success',
          title: 'New User Registration',
          description: `User ${userId} successfully registered`,
          properties: { userId, email: `${userId}@example.com` },
          user_id: userId,
          timestamp: Date.now(),
        },
        {
          type: 'event',
          name: 'page_view',
          category: 'system',
          severity: 'info',
          title: 'Page View',
          description: 'User viewed dashboard page',
          properties: { userId, path: '/dashboard' },
          user_id: userId,
          timestamp: Date.now() + 1000,
        },
        {
          type: 'event',
          name: 'button_click',
          category: 'payment',
          severity: 'info',
          title: 'Purchase Button Clicked',
          description: 'User initiated purchase flow',
          properties: { userId, button: 'purchase' },
          user_id: userId,
          timestamp: Date.now() + 2000,
        },
      ];
      
      await sendToAPI('/events/batch', { events });
      showResult('userSession', true, `User session simulated with 3 events for ${userId}!`);
    } catch (error) {
      showResult('userSession', false, `Failed: ${error}`);
    } finally {
      setLoading(prev => ({ ...prev, userSession: false }));
    }
  };

  const clearAllData = async () => {
    setLoading(prev => ({ ...prev, clearData: true }));
    try {
      await sendToAPI('/admin/clear', {});
      showResult('clearData', true, 'All data cleared successfully!');
    } catch (error) {
      showResult('clearData', false, 'Clear data feature not implemented on server');
    } finally {
      setLoading(prev => ({ ...prev, clearData: false }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="backdrop-blur-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-2 border-amber-500/30 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/20 rounded-full blur-2xl" />
      
      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Admin Testing Panel</h2>
            <p className="text-amber-200/80 text-sm">Generate test data to verify the monitoring system</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <TestButton
            onClick={sendTestEvent}
            loading={loading.testEvent}
            icon={<Activity className="w-5 h-5" />}
            title="Send Test Event"
            description="Generate random event"
            color="blue"
          />
          
          <TestButton
            onClick={sendTestError}
            loading={loading.testError}
            icon={<AlertCircle className="w-5 h-5" />}
            title="Send Test Error"
            description="Trigger error event"
            color="red"
          />
          
          <TestButton
            onClick={sendTestMetric}
            loading={loading.testMetric}
            icon={<Database className="w-5 h-5" />}
            title="Send Test Metric"
            description="Push metric data"
            color="green"
          />
          
          <TestButton
            onClick={sendBulkEvents}
            loading={loading.bulkEvents}
            icon={<Zap className="w-5 h-5" />}
            title="Send 10 Events"
            description="Bulk event test"
            color="purple"
          />
          
          <TestButton
            onClick={simulateUserSession}
            loading={loading.userSession}
            icon={<Users className="w-5 h-5" />}
            title="Simulate User"
            description="Full user journey"
            color="pink"
          />
          
          <TestButton
            onClick={clearAllData}
            loading={loading.clearData}
            icon={<Trash2 className="w-5 h-5" />}
            title="Clear All Data"
            description="Reset monitoring data"
            color="amber"
            dangerous
          />
        </div>

        {/* Results display */}
        <AnimatePresence>
          {Object.entries(results).map(([key, result]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
                result.success 
                  ? 'bg-green-500/20 border border-green-500/30' 
                  : 'bg-red-500/20 border border-red-500/30'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <X className="w-5 h-5 text-red-400" />
              )}
              <span className={result.success ? 'text-green-300' : 'text-red-300'}>
                {result.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface TestButtonProps {
  onClick: () => void;
  loading: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  dangerous?: boolean;
}

function TestButton({ onClick, loading, icon, title, description, color, dangerous }: TestButtonProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    red: 'from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600',
    green: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    purple: 'from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600',
    pink: 'from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600',
    amber: 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
  }[color];

  return (
    <motion.button
      onClick={onClick}
      disabled={loading}
      className={`relative group p-4 bg-gradient-to-br ${colorClasses} rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              {icon}
            </motion.div>
          ) : (
            icon
          )}
          <span className="font-semibold">{title}</span>
        </div>
        <p className="text-xs text-white/80">{description}</p>
      </div>
      
      {/* Hover effect */}
      <motion.div
        className="absolute inset-0 bg-white/20"
        initial={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.5, opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{ borderRadius: '50%' }}
      />
      
      {dangerous && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
      )}
    </motion.button>
  );
}

export default AdminPanel;