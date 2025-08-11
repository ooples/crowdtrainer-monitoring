import React, { useEffect, useState } from 'react';
import { useMonitoring } from '../providers/MonitoringProvider';
import { useUserJourney } from '../providers/UserJourneyProvider';

const HomePage: React.FC = () => {
  const { track, trackError, trackPerformance } = useMonitoring();
  const { trackUserInteraction, getSessionDuration } = useUserJourney();
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Track page-specific engagement
    track({
      category: 'page_engagement',
      action: 'homepage_loaded',
      metadata: {
        session_duration: getSessionDuration(),
      },
    });

    // Simulate measuring a custom performance metric
    const startTime = performance.now();
    
    // Simulate some work
    setTimeout(() => {
      const duration = performance.now() - startTime;
      trackPerformance({
        name: 'homepage_initialization',
        value: duration,
        unit: 'ms',
        metadata: {
          components_loaded: ['hero', 'features', 'testimonials'],
        },
      });
    }, 100);
  }, []);

  const handleFeatureDemo = async () => {
    setLoading(true);
    setError(null);
    
    const startTime = performance.now();
    
    try {
      // Track feature usage
      trackUserInteraction('feature_demo_started', {
        feature: 'api_integration',
      });

      // Simulate API call
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setApiData(data);
      
      const duration = performance.now() - startTime;
      
      // Track successful API call
      trackPerformance({
        name: 'demo_api_call',
        value: duration,
        unit: 'ms',
        metadata: {
          endpoint: 'jsonplaceholder.typicode.com',
          success: true,
        },
      });
      
      track({
        category: 'feature_usage',
        action: 'demo_completed',
        label: 'api_integration',
        value: Math.round(duration),
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Track error
      trackError(err instanceof Error ? err : new Error(errorMessage), {
        category: 'feature_demo',
        action: 'api_call_failed',
        metadata: {
          duration: performance.now() - startTime,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewsletterSignup = () => {
    // Simulate form submission
    trackUserInteraction('newsletter_signup', {
      form_location: 'homepage_hero',
    });
    
    track({
      category: 'conversion',
      action: 'newsletter_signup',
      label: 'homepage',
    });
    
    // Show success message (in real app, this would submit to server)
    alert('Newsletter signup tracked! Check your monitoring dashboard.');
  };

  const simulateError = () => {
    try {
      throw new Error('This is a simulated error for testing monitoring');
    } catch (error) {
      trackError(error as Error, {
        category: 'user_initiated',
        action: 'simulate_error',
        label: 'homepage_demo',
      });
      
      alert('Error tracked successfully!');
    }
  };

  return (
    <div className="homepage">
      <section className="hero">
        <div className="container">
          <h1>React SPA Monitoring Example</h1>
          <p>
            Comprehensive monitoring integration with user journey tracking, 
            performance metrics, and error monitoring.
          </p>
          
          <div className="hero-actions">
            <button 
              className="btn btn-primary btn-lg"
              onClick={handleNewsletterSignup}
            >
              Track Newsletter Signup
            </button>
            
            <button 
              className="btn btn-secondary btn-lg"
              onClick={handleFeatureDemo}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Demo API Tracking'}
            </button>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>Monitoring Features</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <h3>User Journey Tracking</h3>
              <p>Track user navigation, page views, and session duration automatically.</p>
              <div className="feature-stats">
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">Page Views</span>
                </div>
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">Session Tracking</span>
                </div>
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">Funnel Analysis</span>
                </div>
              </div>
            </div>

            <div className="feature-card">
              <h3>Performance Monitoring</h3>
              <p>Automatic tracking of Core Web Vitals and custom performance metrics.</p>
              <div className="feature-stats">
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">LCP</span>
                </div>
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">FID</span>
                </div>
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">CLS</span>
                </div>
              </div>
            </div>

            <div className="feature-card">
              <h3>Error Tracking</h3>
              <p>Comprehensive error tracking with context and automatic reporting.</p>
              <div className="feature-stats">
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">JS Errors</span>
                </div>
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">Promise Rejections</span>
                </div>
                <div className="stat">
                  <span className="stat-value">✅</span>
                  <span className="stat-label">React Errors</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="demo">
        <div className="container">
          <h2>Interactive Demo</h2>
          
          <div className="demo-grid">
            <div className="demo-card">
              <h3>API Call Monitoring</h3>
              <p>Test API performance tracking with real HTTP requests.</p>
              
              <button 
                className="btn btn-primary"
                onClick={handleFeatureDemo}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Make API Call'}
              </button>
              
              {apiData && (
                <div className="api-result success">
                  <strong>Success:</strong>
                  <pre>{JSON.stringify(apiData, null, 2)}</pre>
                </div>
              )}
              
              {error && (
                <div className="api-result error">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </div>

            <div className="demo-card">
              <h3>Error Tracking Demo</h3>
              <p>Test error tracking and reporting functionality.</p>
              
              <button 
                className="btn btn-warning"
                onClick={simulateError}
              >
                Simulate Error
              </button>
              
              <div className="demo-info">
                <small>
                  This will trigger an error that gets tracked and reported
                  to the monitoring system.
                </small>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;