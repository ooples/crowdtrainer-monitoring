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
  X,
  Monitor,
  Download,
  RefreshCw,
  Bug,
  BarChart3,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminMode } from '@/components/providers/admin-mode-provider';

interface AdminPanelProps {
  apiUrl: string;
  apiKey?: string;
}

export function AdminPanel({ apiUrl, apiKey }: AdminPanelProps) {
  const { isAdminMode } = useAdminMode();
  const [results, setResults] = useState<{ [key: string]: { success: boolean; message: string } }>({});
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [diagnostics, setDiagnostics] = useState<any>(null);

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

  const sendToAPI = async (endpoint: string, data: any, method: 'POST' | 'GET' = 'POST') => {
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey }),
        },
        ...(method === 'POST' && { body: JSON.stringify(data) }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const responseText = await response.text();
      if (!responseText) return {};
      
      try {
        return JSON.parse(responseText);
      } catch {
        return { message: responseText };
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  };

  const sendTestEvent = async () => {
    setLoading(prev => ({ ...prev, testEvent: true }));
    try {
      const categories = ['api', 'database', 'auth', 'payment', 'system'];
      const levels = ['info', 'low', 'medium'];
      
      const event = {
        type: 'info',
        level: levels[Math.floor(Math.random() * levels.length)],
        source: 'admin-panel',
        message: 'This is a test event generated from the admin panel for verification purposes.',
        metadata: {
          category: categories[Math.floor(Math.random() * categories.length)],
          test: true,
          timestamp: Date.now(),
        },
      };
      
      await sendToAPI('/api/v1/events/bulk', { events: [event] });
      showResult('testEvent', true, 'Test event sent successfully!');
    } catch (error) {
      showResult('testEvent', false, `Failed: ${error instanceof Error ? error.message : String(error)}`);
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
        level: 'critical',
        source: 'admin-panel',
        message: `Test ${errorType}: This is a test error generated for monitoring verification`,
        metadata: {
          intentional: true,
          errorType,
          url: window.location.href,
          userAgent: navigator.userAgent,
          category: 'system',
        },
        stack: `${errorType}: Test error\n    at sendTestError (AdminPanel.tsx:95:15)\n    at onClick (AdminPanel.tsx:380:25)\n    at invokeEventHandler (react-dom.js:1234:10)`,
      };
      
      await sendToAPI('/api/v1/events/bulk', { events: [error] });
      showResult('testError', true, 'Test error sent successfully!');
    } catch (error) {
      showResult('testError', false, `Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(prev => ({ ...prev, testError: false }));
    }
  };

  const sendTestMetric = async () => {
    setLoading(prev => ({ ...prev, testMetric: true }));
    try {
      const metric = {
        name: 'test.admin_panel.metric',
        value: Math.floor(Math.random() * 100),
        source: 'admin-panel',
        unit: 'count',
        dimensions: {
          test: 'true',
          environment: 'admin_panel',
        },
      };
      
      await sendToAPI('/api/v1/metrics', metric);
      showResult('testMetric', true, 'Test metric sent successfully!');
    } catch (error) {
      showResult('testMetric', false, `Failed: ${error instanceof Error ? error.message : String(error)}`);
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
          type: 'info',
          level: 'info',
          source: 'admin-panel',
          message: `Bulk test event number ${i}`,
          metadata: {
            index: i,
            batch: true,
            category: 'system',
            bulkTest: true,
          },
        });
      }
      
      await sendToAPI('/api/v1/events/bulk', { events });
      showResult('bulkEvents', true, '10 bulk events sent successfully!');
    } catch (error) {
      showResult('bulkEvents', false, `Failed: ${error instanceof Error ? error.message : String(error)}`);
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
          type: 'user_action',
          level: 'info',
          source: 'admin-panel',
          message: `User ${userId} successfully registered`,
          metadata: {
            userId,
            email: `${userId}@example.com`,
            category: 'auth',
            action: 'signup',
          },
          userId,
        },
        {
          type: 'user_action',
          level: 'info',
          source: 'admin-panel',
          message: 'User viewed dashboard page',
          metadata: {
            userId,
            path: '/dashboard',
            category: 'system',
            action: 'page_view',
          },
          userId,
          url: window.location.origin + '/dashboard',
        },
        {
          type: 'business',
          level: 'info',
          source: 'admin-panel',
          message: 'User initiated purchase flow',
          metadata: {
            userId,
            button: 'purchase',
            category: 'payment',
            action: 'button_click',
            value: Math.floor(Math.random() * 100) + 10,
          },
          userId,
        },
      ];
      
      await sendToAPI('/api/v1/events/bulk', { events });
      showResult('userSession', true, `User session simulated with 3 events for ${userId}!`);
    } catch (error) {
      showResult('userSession', false, `Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(prev => ({ ...prev, userSession: false }));
    }
  };

  const clearAllData = async () => {
    setLoading(prev => ({ ...prev, clearData: true }));
    try {
      await sendToAPI('/api/v1/admin/clear', { confirmAction: true, tables: ['all'] });
      showResult('clearData', true, 'All data cleared successfully!');
    } catch (error) {
      showResult('clearData', false, `Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(prev => ({ ...prev, clearData: false }));
    }
  };

  const runDiagnostics = async () => {
    setLoading(prev => ({ ...prev, diagnostics: true }));
    try {
      const systemInfo = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        localStorage: {
          adminMode: localStorage.getItem('adminMode'),
          theme: localStorage.getItem('theme'),
        },
        performance: {
          memory: (performance as any).memory ? {
            used: Math.round(((performance as any).memory.usedJSHeapSize / 1024 / 1024) * 100) / 100,
            total: Math.round(((performance as any).memory.totalJSHeapSize / 1024 / 1024) * 100) / 100,
            limit: Math.round(((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) * 100) / 100,
          } : null,
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
      
      setDiagnostics(systemInfo);
      showResult('diagnostics', true, 'System diagnostics collected successfully!');
    } catch (error) {
      showResult('diagnostics', false, `Failed to collect diagnostics: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(prev => ({ ...prev, diagnostics: false }));
    }
  };

  const exportDiagnostics = () => {
    if (!diagnostics) {
      showResult('export', false, 'No diagnostics data available. Run diagnostics first.');
      return;
    }
    
    const dataStr = JSON.stringify(diagnostics, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagnostics-${new Date().toISOString().slice(0, 19)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showResult('export', true, 'Diagnostics exported successfully!');
  };

  const generateLoadTest = async () => {
    setLoading(prev => ({ ...prev, loadTest: true }));
    try {
      const events = [];
      const levels = ['info', 'low', 'medium', 'high', 'critical'];
      const eventTypes = ['info', 'error', 'performance', 'user_action'];
      const categories = ['api', 'database', 'auth', 'payment', 'system'];
      
      // Generate 50 events quickly to test system load
      for (let i = 0; i < 50; i++) {
        events.push({
          type: eventTypes[Math.floor(Math.random() * eventTypes.length)] as any,
          level: levels[Math.floor(Math.random() * levels.length)] as any,
          source: 'admin-panel',
          message: `Load test event number ${i} generated for performance testing`,
          metadata: {
            loadTest: true,
            index: i,
            batch: Math.floor(i / 10),
            category: categories[Math.floor(Math.random() * categories.length)],
            responseTime: Math.floor(Math.random() * 500) + 50,
          },
        });
      }
      
      await sendToAPI('/api/v1/events/bulk', { events });
      showResult('loadTest', true, '50 load test events sent successfully!');
    } catch (error) {
      showResult('loadTest', false, `Load test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(prev => ({ ...prev, loadTest: false }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full"
    >
      <div className="backdrop-blur-sm bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl shadow-2xl p-6 relative overflow-hidden">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Test Data Generators */}
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
              onClick={generateLoadTest}
              loading={loading.loadTest}
              icon={<BarChart3 className="w-5 h-5" />}
              title="Load Test"
              description="Generate 50 events"
              color="cyan"
            />
            
            {/* System Functions */}
            <TestButton
              onClick={runDiagnostics}
              loading={loading.diagnostics}
              icon={<Monitor className="w-5 h-5" />}
              title="Run Diagnostics"
              description="Collect system info"
              color="indigo"
            />
            
            <TestButton
              onClick={exportDiagnostics}
              loading={false}
              icon={<Download className="w-5 h-5" />}
              title="Export Diagnostics"
              description="Download system data"
              color="teal"
              disabled={!diagnostics}
            />
            
            {/* Data Management */}
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
  disabled?: boolean;
}

function TestButton({ onClick, loading, icon, title, description, color, dangerous, disabled }: TestButtonProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    red: 'from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600',
    green: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    purple: 'from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600',
    pink: 'from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600',
    amber: 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
    cyan: 'from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600',
    indigo: 'from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600',
    teal: 'from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600',
  }[color];

  return (
    <motion.button
      onClick={onClick}
      disabled={loading || disabled}
      className={`relative group px-3 py-1.5 bg-gradient-to-br ${colorClasses} rounded-lg text-sm font-medium text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden`}
      whileHover={!loading && !disabled ? { scale: 1.02 } : {}}
      whileTap={!loading && !disabled ? { scale: 0.98 } : {}}
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