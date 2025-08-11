import React, { useEffect } from 'react';
import { useMonitoring } from '../providers/MonitoringProvider';
import { useUserJourney } from '../providers/UserJourneyProvider';

const AboutPage: React.FC = () => {
  const { track } = useMonitoring();
  const { trackUserInteraction } = useUserJourney();

  useEffect(() => {
    // Track page-specific metrics
    track({
      category: 'page_engagement',
      action: 'about_page_loaded',
      metadata: {
        referrer: document.referrer,
      },
    });
  }, [track]);

  const handleContactClick = () => {
    trackUserInteraction('contact_intent', {
      source: 'about_page',
      cta_type: 'contact_button',
    });
    
    track({
      category: 'conversion',
      action: 'contact_intent',
      label: 'about_page',
    });
  };

  return (
    <div className="about-page">
      <div className="container">
        <h1>About React SPA Monitoring</h1>
        
        <section className="about-content">
          <p>
            This example demonstrates a comprehensive monitoring integration for React Single Page Applications.
            It showcases real-world patterns for tracking user behavior, performance metrics, and errors.
          </p>

          <h2>What We Monitor</h2>
          
          <div className="monitoring-categories">
            <div className="category">
              <h3>📊 User Journey</h3>
              <ul>
                <li>Page navigation and views</li>
                <li>Session duration and engagement</li>
                <li>Conversion funnel analysis</li>
                <li>User interaction patterns</li>
              </ul>
            </div>

            <div className="category">
              <h3>⚡ Performance</h3>
              <ul>
                <li>Core Web Vitals (LCP, FID, CLS)</li>
                <li>Page load times</li>
                <li>API response times</li>
                <li>Custom performance metrics</li>
              </ul>
            </div>

            <div className="category">
              <h3>🚨 Errors</h3>
              <ul>
                <li>JavaScript errors</li>
                <li>Promise rejections</li>
                <li>React component errors</li>
                <li>Network failures</li>
              </ul>
            </div>

            <div className="category">
              <h3>🎯 Business Metrics</h3>
              <ul>
                <li>Feature usage tracking</li>
                <li>Conversion events</li>
                <li>User engagement metrics</li>
                <li>Custom business events</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="implementation-details">
          <h2>Implementation Highlights</h2>
          
          <div className="implementation-grid">
            <div className="implementation-card">
              <h3>Context Providers</h3>
              <p>
                Uses React Context for monitoring state management and user journey tracking.
                Provides hooks for easy integration throughout the application.
              </p>
            </div>

            <div className="implementation-card">
              <h3>Offline Support</h3>
              <p>
                Queues events when offline and sends them when connectivity is restored.
                Uses navigator.sendBeacon for reliable event delivery.
              </p>
            </div>

            <div className="implementation-card">
              <h3>Error Boundaries</h3>
              <p>
                React Error Boundaries catch component errors and report them
                to the monitoring system with full context.
              </p>
            </div>

            <div className="implementation-card">
              <h3>Performance Observers</h3>
              <p>
                Uses native Performance APIs and observers to track Core Web Vitals
                and custom performance metrics automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Ready to Get Started?</h2>
          <p>
            Contact us to learn more about implementing comprehensive monitoring
            in your React applications.
          </p>
          
          <button 
            className="btn btn-primary btn-lg"
            onClick={handleContactClick}
          >
            Contact Us
          </button>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;