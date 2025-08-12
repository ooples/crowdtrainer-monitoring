/**
 * React Integration Examples for Debugging Package
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  DebugManager,
  TimelineVisualizer,
  type DebugSessionData,
  type TimelineData,
  type ErrorData
} from '@monitoring-service/debugging';

// Debug Provider for React Context
const DebugContext = React.createContext<{
  debugManager: DebugManager | null;
  startDebugging: (error: ErrorData) => Promise<string>;
  getDebugSession: (sessionId: string) => DebugSessionData | null;
} | null>(null);

interface DebugProviderProps {
  children: React.ReactNode;
  config?: Parameters<typeof DebugManager>[0];
}

export const DebugProvider: React.FC<DebugProviderProps> = ({
  children,
  config = {
    tracing: {
      serviceName: 'react-app',
      endpoint: 'http://localhost:14268/api/traces'
    }
  }
}) => {
  const [debugManager, setDebugManager] = useState<DebugManager | null>(null);

  useEffect(() => {
    const manager = new DebugManager(config);
    
    manager.initialize().then(() => {
      setDebugManager(manager);
    });

    return () => {
      manager.shutdown();
    };
  }, []);

  const startDebugging = useCallback(async (error: ErrorData): Promise<string> => {
    if (!debugManager) throw new Error('Debug manager not initialized');
    
    return debugManager.startDebugging(error, {
      includeReplay: true,
      includeTrace: true,
      includeTimeline: true
    });
  }, [debugManager]);

  const getDebugSession = useCallback((sessionId: string): DebugSessionData | null => {
    if (!debugManager) return null;
    return debugManager.getDebugSession(sessionId);
  }, [debugManager]);

  const value = {
    debugManager,
    startDebugging,
    getDebugSession
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

// Custom hook to use debug context
export const useDebug = () => {
  const context = React.useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};

// Error Boundary with Debug Integration
interface DebugErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  debugSessionId: string | null;
}

export class DebugErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, debugSessionId: string) => void },
  DebugErrorBoundaryState
> {
  private debugManager: DebugManager;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      debugSessionId: null
    };

    this.debugManager = new DebugManager({
      tracing: {
        serviceName: 'react-error-boundary',
        endpoint: 'http://localhost:14268/api/traces'
      }
    });

    this.debugManager.initialize();
  }

  static getDerivedStateFromError(error: Error): Partial<DebugErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const errorData: ErrorData = {
        id: `react-error-${Date.now()}`,
        message: error.message,
        type: error.name,
        timestamp: Date.now(),
        stackTrace: error.stack,
        context: {
          componentStack: errorInfo.componentStack,
          errorBoundary: 'DebugErrorBoundary'
        }
      };

      const debugSession = await this.debugManager.captureError(errorData, {
        includeReplay: true,
        includeTrace: true,
        includeTimeline: true
      });

      this.setState({ debugSessionId: debugSession.sessionId });
      
      this.props.onError?.(error, debugSession.sessionId);
    } catch (debugError) {
      console.error('Failed to capture error debug data:', debugError);
    }
  }

  componentWillUnmount() {
    this.debugManager.shutdown();
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          debugSessionId={this.state.debugSessionId}
          onRetry={() => this.setState({ hasError: false, error: null, debugSessionId: null })}
        />
      );
    }

    return this.props.children;
  }
}

// Error Fallback Component
interface ErrorFallbackProps {
  error: Error | null;
  debugSessionId: string | null;
  onRetry: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  debugSessionId,
  onRetry
}) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  return (
    <div style={{ padding: '20px', border: '1px solid #f00', borderRadius: '4px', margin: '20px' }}>
      <h2>Something went wrong</h2>
      <p>An error occurred in the application.</p>
      
      {error && (
        <details style={{ marginTop: '10px' }}>
          <summary>Error Details</summary>
          <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}

      {debugSessionId && (
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            style={{ marginRight: '10px' }}
          >
            {showDebugInfo ? 'Hide' : 'Show'} Debug Info
          </button>
          
          {showDebugInfo && (
            <DebugSessionViewer sessionId={debugSessionId} />
          )}
        </div>
      )}

      <button 
        onClick={onRetry}
        style={{ marginTop: '10px', padding: '8px 16px' }}
      >
        Try Again
      </button>
    </div>
  );
};

// Debug Session Viewer Component
interface DebugSessionViewerProps {
  sessionId: string;
}

const DebugSessionViewer: React.FC<DebugSessionViewerProps> = ({ sessionId }) => {
  const { getDebugSession } = useDebug();
  const [session, setSession] = useState<DebugSessionData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'cluster' | 'insights'>('overview');

  useEffect(() => {
    const debugSession = getDebugSession(sessionId);
    setSession(debugSession);

    // Poll for updates since debug data is collected asynchronously
    const interval = setInterval(() => {
      const updatedSession = getDebugSession(sessionId);
      if (updatedSession && updatedSession.metadata.updatedAt > (session?.metadata.updatedAt || 0)) {
        setSession(updatedSession);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId, getDebugSession]);

  if (!session) {
    return <div>Loading debug information...</div>;
  }

  return (
    <div style={{ marginTop: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <div style={{ borderBottom: '1px solid #ddd', display: 'flex' }}>
        {(['overview', 'timeline', 'cluster', 'insights'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 15px',
              border: 'none',
              background: activeTab === tab ? '#007bff' : '#f8f9fa',
              color: activeTab === tab ? 'white' : 'black',
              cursor: 'pointer'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '15px' }}>
        {activeTab === 'overview' && (
          <DebugOverview session={session} />
        )}
        
        {activeTab === 'timeline' && session.timelineData && (
          <TimelineVisualizer
            data={session.timelineData}
            config={{
              height: 400,
              showMinimap: true,
              colorScheme: 'light'
            }}
            onEventClick={(event) => {
              console.log('Timeline event clicked:', event);
            }}
          />
        )}
        
        {activeTab === 'cluster' && session.cluster && (
          <ClusterInfo cluster={session.cluster} />
        )}
        
        {activeTab === 'insights' && session.codeInsights && (
          <CodeInsightsView insights={session.codeInsights} />
        )}
      </div>
    </div>
  );
};

// Debug Overview Component
interface DebugOverviewProps {
  session: DebugSessionData;
}

const DebugOverview: React.FC<DebugOverviewProps> = ({ session }) => (
  <div>
    <h4>Debug Session Overview</h4>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <strong>Session ID:</strong><br />
        <code>{session.sessionId}</code>
      </div>
      
      <div>
        <strong>Duration:</strong><br />
        {session.metadata.debugDuration}ms
      </div>
      
      <div>
        <strong>Error Type:</strong><br />
        {session.error.type}
      </div>
      
      <div>
        <strong>Components Used:</strong><br />
        {session.metadata.componentsUsed.join(', ')}
      </div>
    </div>

    <div style={{ marginTop: '15px' }}>
      <strong>Error Message:</strong><br />
      <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', fontFamily: 'monospace' }}>
        {session.error.message}
      </div>
    </div>

    {session.error.stackTrace && (
      <div style={{ marginTop: '15px' }}>
        <strong>Stack Trace:</strong><br />
        <pre style={{ 
          background: '#f8f9fa', 
          padding: '10px', 
          borderRadius: '4px', 
          fontSize: '12px',
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {session.error.stackTrace}
        </pre>
      </div>
    )}
  </div>
);

// Cluster Info Component
const ClusterInfo: React.FC<{ cluster: any }> = ({ cluster }) => (
  <div>
    <h4>Error Cluster Information</h4>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <strong>Cluster ID:</strong><br />
        <code>{cluster.id}</code>
      </div>
      
      <div>
        <strong>Similar Errors:</strong><br />
        {cluster.stats.count}
      </div>
      
      <div>
        <strong>Confidence:</strong><br />
        {(cluster.confidence * 100).toFixed(1)}%
      </div>
      
      <div>
        <strong>First Seen:</strong><br />
        {new Date(cluster.stats.firstSeen).toLocaleString()}
      </div>
    </div>

    <div style={{ marginTop: '15px' }}>
      <strong>Representative Error:</strong><br />
      <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
        {cluster.representative.message}
      </div>
    </div>

    <div style={{ marginTop: '15px' }}>
      <strong>Affected Users:</strong> {cluster.stats.affectedUsers}<br />
      <strong>Error Frequency:</strong> {cluster.stats.frequency.toFixed(2)} errors/hour
    </div>
  </div>
);

// Code Insights View Component
const CodeInsightsView: React.FC<{ insights: any }> = ({ insights }) => (
  <div>
    <h4>Code Insights</h4>
    
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <strong>Risk Score: </strong>
        <div style={{
          marginLeft: '10px',
          background: insights.riskAssessment.overallRisk > 0.7 ? '#dc3545' : 
                     insights.riskAssessment.overallRisk > 0.4 ? '#ffc107' : '#28a745',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px'
        }}>
          {(insights.riskAssessment.overallRisk * 100).toFixed(1)}%
        </div>
      </div>
    </div>

    {insights.riskAssessment.factors.length > 0 && (
      <div style={{ marginBottom: '20px' }}>
        <strong>Risk Factors:</strong>
        {insights.riskAssessment.factors.map((factor: any, index: number) => (
          <div key={index} style={{ 
            margin: '5px 0', 
            padding: '8px',
            background: '#f8f9fa',
            borderLeft: `4px solid ${factor.score > 0.7 ? '#dc3545' : '#ffc107'}`,
            borderRadius: '0 4px 4px 0'
          }}>
            <strong>{factor.name}</strong> ({(factor.score * 100).toFixed(1)}%)<br />
            <small>{factor.description}</small>
          </div>
        ))}
      </div>
    )}

    {insights.suggestions.length > 0 && (
      <div style={{ marginBottom: '20px' }}>
        <strong>Suggestions:</strong>
        {insights.suggestions.map((suggestion: any, index: number) => (
          <div key={index} style={{
            margin: '5px 0',
            padding: '8px',
            background: '#e7f3ff',
            border: '1px solid #b8daff',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{suggestion.text}</span>
              <span style={{
                background: '#007bff',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px'
              }}>
                Priority {suggestion.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}

    {insights.relatedCommits.length > 0 && (
      <div>
        <strong>Recent Related Commits:</strong>
        {insights.relatedCommits.slice(0, 3).map((commit: any, index: number) => (
          <div key={index} style={{
            margin: '8px 0',
            padding: '10px',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '13px'
          }}>
            <div><strong>{commit.hash.substring(0, 7)}</strong> by {commit.author.name}</div>
            <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
              {commit.message}
            </div>
            <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
              {new Date(commit.date).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// React Hook for Debugging
export const useErrorCapture = () => {
  const { startDebugging } = useDebug();

  const captureError = useCallback(async (error: Error, context?: Record<string, any>) => {
    const errorData: ErrorData = {
      id: `react-hook-${Date.now()}`,
      message: error.message,
      type: error.name,
      timestamp: Date.now(),
      stackTrace: error.stack,
      context
    };

    return startDebugging(errorData);
  }, [startDebugging]);

  return { captureError };
};

// Example Usage Component
export const DebugExampleApp: React.FC = () => {
  const { captureError } = useErrorCapture();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const triggerError = async () => {
    try {
      // Simulate an error
      throw new Error('This is a test error from React component');
    } catch (error) {
      const debugSessionId = await captureError(error as Error, {
        component: 'DebugExampleApp',
        userAction: 'button-click',
        timestamp: Date.now()
      });
      
      setSessionId(debugSessionId);
    }
  };

  const triggerAsyncError = async () => {
    try {
      // Simulate async error
      await new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Async operation failed'));
        }, 1000);
      });
    } catch (error) {
      const debugSessionId = await captureError(error as Error, {
        component: 'DebugExampleApp',
        operation: 'async-operation',
        delay: 1000
      });
      
      setSessionId(debugSessionId);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Debug Integration Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={triggerError}
          style={{ marginRight: '10px', padding: '10px 20px' }}
        >
          Trigger Sync Error
        </button>
        
        <button 
          onClick={triggerAsyncError}
          style={{ padding: '10px 20px' }}
        >
          Trigger Async Error
        </button>
      </div>

      {sessionId && (
        <div>
          <h3>Debug Session Created</h3>
          <DebugSessionViewer sessionId={sessionId} />
        </div>
      )}
    </div>
  );
};

// Complete App Example
export const App: React.FC = () => {
  return (
    <DebugProvider config={{
      tracing: {
        serviceName: 'react-debug-example',
        endpoint: 'http://localhost:14268/api/traces'
      },
      sessionReplay: {
        enabled: true,
        maxSessionSize: 5 * 1024 * 1024
      },
      errorClustering: {
        enabled: true,
        minSimilarity: 0.8
      }
    }}>
      <DebugErrorBoundary 
        onError={(error, debugSessionId) => {
          console.log('Error captured by boundary:', error.message);
          console.log('Debug session ID:', debugSessionId);
        }}
      >
        <DebugExampleApp />
      </DebugErrorBoundary>
    </DebugProvider>
  );
};

export default App;