import React, { useEffect, useState } from 'react';
import { useMonitoring } from '../providers/MonitoringProvider';
import { useUserJourney } from '../providers/UserJourneyProvider';

interface DashboardStats {
  totalEvents: number;
  sessionDuration: number;
  pagesVisited: number;
  errorsReported: number;
}

const DashboardPage: React.FC = () => {
  const { track, trackPerformance, isOnline } = useMonitoring();
  const { journey, getSessionDuration, getJourneyFunnel } = useUserJourney();
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    sessionDuration: 0,
    pagesVisited: 0,
    errorsReported: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Track dashboard access
    track({
      category: 'page_engagement',
      action: 'dashboard_accessed',
      metadata: {
        journey_length: journey.length,
      },
    });

    // Simulate loading dashboard data
    const loadDashboardData = async () => {
      const startTime = performance.now();
      
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Calculate real stats from session data
        const sessionDuration = getSessionDuration();
        const journeyFunnel = getJourneyFunnel();
        
        setStats({
          totalEvents: Math.floor(Math.random() * 50) + journey.length * 5,
          sessionDuration,
          pagesVisited: Object.keys(journeyFunnel).length,
          errorsReported: Math.floor(Math.random() * 3),
        });
        
        const loadTime = performance.now() - startTime;
        
        // Track dashboard load performance
        trackPerformance({
          name: 'dashboard_load_time',
          value: loadTime,
          unit: 'ms',
          metadata: {
            data_points: Object.keys(journeyFunnel).length,
            cache_hit: false,
          },
        });
        
        track({
          category: 'feature_usage',
          action: 'dashboard_loaded',
          value: Math.round(loadTime),
        });
        
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [track, trackPerformance, journey, getSessionDuration, getJourneyFunnel]);

  const handleRefreshStats = () => {
    track({
      category: 'user_interaction',
      action: 'dashboard_refresh',
      metadata: {
        refresh_type: 'manual',
      },
    });

    setIsLoading(true);
    
    // Simulate refresh
    setTimeout(() => {
      setStats(prev => ({
        ...prev,
        totalEvents: prev.totalEvents + Math.floor(Math.random() * 10),
        sessionDuration: getSessionDuration(),
      }));
      setIsLoading(false);
    }, 500);
  };

  const handleExportData = () => {
    track({
      category: 'feature_usage',
      action: 'export_requested',
      label: 'dashboard_data',
    });

    // Simulate export
    const exportData = {
      session: {
        duration: getSessionDuration(),
        pages_visited: journey.length,
      },
      journey: getJourneyFunnel(),
      stats,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-page">
      <div className="container">
        <header className="dashboard-header">
          <h1>Monitoring Dashboard</h1>
          <div className="dashboard-status">
            <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
        </header>

        <div className="dashboard-actions">
          <button 
            className="btn btn-secondary"
            onClick={handleRefreshStats}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh Stats'}
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={handleExportData}
          >
            Export Data
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">
                {isLoading ? '-' : stats.totalEvents.toLocaleString()}
              </div>
              <div className="stat-label">Total Events</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <div className="stat-value">
                {isLoading ? '-' : Math.round(stats.sessionDuration / 1000)}s
              </div>
              <div className="stat-label">Session Duration</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📄</div>
            <div className="stat-content">
              <div className="stat-value">
                {isLoading ? '-' : stats.pagesVisited}
              </div>
              <div className="stat-label">Pages Visited</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🚨</div>
            <div className="stat-content">
              <div className="stat-value">
                {isLoading ? '-' : stats.errorsReported}
              </div>
              <div className="stat-label">Errors Reported</div>
            </div>
          </div>
        </div>

        <div className="dashboard-sections">
          <section className="journey-section">
            <h2>User Journey</h2>
            <div className="journey-timeline">
              {journey.map((step, index) => (
                <div key={index} className="journey-step">
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <div className="step-page">{step.page}</div>
                    <div className="step-time">
                      {step.duration 
                        ? `${Math.round(step.duration / 1000)}s`
                        : 'Current page'
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="funnel-section">
            <h2>Page Funnel</h2>
            <div className="funnel-chart">
              {Object.entries(getJourneyFunnel()).map(([page, visits]) => (
                <div key={page} className="funnel-item">
                  <div className="funnel-page">{page}</div>
                  <div className="funnel-bar">
                    <div 
                      className="funnel-fill"
                      style={{ 
                        width: `${(visits / Math.max(...Object.values(getJourneyFunnel()))) * 100}%` 
                      }}
                    />
                  </div>
                  <div className="funnel-count">{visits}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="realtime-section">
            <h2>Real-time Monitoring</h2>
            <div className="monitoring-status">
              <div className="status-item">
                <span className="status-label">Connection Status:</span>
                <span className={`status-value ${isOnline ? 'success' : 'error'}`}>
                  {isOnline ? 'Connected' : 'Offline'}
                </span>
              </div>
              
              <div className="status-item">
                <span className="status-label">Events Queued:</span>
                <span className="status-value">0</span>
              </div>
              
              <div className="status-item">
                <span className="status-label">Last Event:</span>
                <span className="status-value">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;