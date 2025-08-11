'use client';

import { useEffect, useState } from 'react';
import { useMonitoring } from '@crowdtrainer/monitoring-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export default function HomePage() {
  const { track, trackError, trackPerformance } = useMonitoring();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Track page view
    track({
      category: 'page',
      action: 'view',
      label: 'home',
      metadata: {
        userAgent: navigator.userAgent,
        referrer: document.referrer,
      },
    });

    // Track performance metrics
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        trackPerformance({
          name: 'page_load_time',
          value: navigation.loadEventEnd - navigation.loadEventStart,
          unit: 'ms',
          metadata: {
            path: window.location.pathname,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          },
        });
      }
    }
  }, [track, trackPerformance]);

  const handleApiCall = async () => {
    setLoading(true);
    setError(null);
    
    const startTime = performance.now();
    
    try {
      // Track the start of the API call
      track({
        category: 'api',
        action: 'request_start',
        label: 'fetch_data',
      });

      const response = await fetch('/api/data');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
      
      // Track successful API call
      const duration = performance.now() - startTime;
      trackPerformance({
        name: 'api_response_time',
        value: duration,
        unit: 'ms',
        metadata: {
          endpoint: '/api/data',
          status: response.status,
          success: true,
        },
      });
      
      track({
        category: 'api',
        action: 'request_success',
        label: 'fetch_data',
        value: Math.round(duration),
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Track API error
      trackError(err instanceof Error ? err : new Error(errorMessage), {
        category: 'api',
        action: 'request_error',
        label: 'fetch_data',
        metadata: {
          endpoint: '/api/data',
          duration: performance.now() - startTime,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserInteraction = (action: string) => {
    track({
      category: 'user_interaction',
      action,
      label: 'demo_interaction',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  };

  const simulateError = () => {
    try {
      // Simulate a JavaScript error
      throw new Error('This is a simulated error for testing purposes');
    } catch (err) {
      trackError(err as Error, {
        category: 'user_action',
        action: 'simulate_error',
        label: 'demo',
        severity: 'low',
      });
      
      alert('Error tracked! Check your monitoring dashboard.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Next.js Monitoring Example</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-semibold mb-4">API Monitoring</h2>
          <p className="text-gray-600 mb-4">
            Test API calls with automatic performance tracking and error monitoring.
          </p>
          
          <Button 
            onClick={handleApiCall} 
            disabled={loading}
            className="mb-4"
          >
            {loading ? 'Loading...' : 'Make API Call'}
          </Button>
          
          {data && (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <strong>Success:</strong> {JSON.stringify(data, null, 2)}
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-4">User Interaction Tracking</h2>
          <p className="text-gray-600 mb-4">
            Track various user interactions and behaviors.
          </p>
          
          <div className="space-y-2">
            <Button 
              onClick={() => handleUserInteraction('button_click')}
              variant="secondary"
            >
              Track Button Click
            </Button>
            
            <Button 
              onClick={() => handleUserInteraction('feature_usage')}
              variant="secondary"
            >
              Track Feature Usage
            </Button>
            
            <Button 
              onClick={simulateError}
              variant="destructive"
            >
              Simulate Error
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
          <p className="text-gray-600 mb-4">
            Automatic tracking of page load times, API response times, and user interactions.
          </p>
          
          <div className="space-y-2 text-sm">
            <div>✅ Page load time tracking</div>
            <div>✅ API response time monitoring</div>
            <div>✅ User interaction timing</div>
            <div>✅ Custom performance metrics</div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-4">Error Tracking</h2>
          <p className="text-gray-600 mb-4">
            Comprehensive error tracking with context and stack traces.
          </p>
          
          <div className="space-y-2 text-sm">
            <div>✅ JavaScript errors</div>
            <div>✅ API errors</div>
            <div>✅ Promise rejections</div>
            <div>✅ Custom error contexts</div>
          </div>
        </Card>
      </div>
    </div>
  );
}