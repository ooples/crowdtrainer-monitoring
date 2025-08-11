import React, { Component, ReactNode, ErrorInfo } from 'react';
import { ErrorBoundaryState, EventMetadata } from './types';
import { useMonitorContext } from './MonitorProvider';

/**
 * Props for the ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'component' | 'page' | 'application';
  metadata?: EventMetadata;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

/**
 * Default error fallback UI
 */
const DefaultErrorFallback: React.FC<{
  error: Error;
  errorInfo: ErrorInfo;
  retry: () => void;
  level?: string;
}> = ({ error, errorInfo, retry, level = 'component' }) => (
  <div 
    style={{
      padding: '20px',
      border: '1px solid #ff6b6b',
      borderRadius: '8px',
      backgroundColor: '#fff5f5',
      color: '#c92a2a',
      fontFamily: 'system-ui, sans-serif'
    }}
  >
    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
      Something went wrong in this {level}
    </h3>
    <details style={{ marginBottom: '15px' }}>
      <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
        Error Details
      </summary>
      <pre style={{ 
        fontSize: '12px', 
        backgroundColor: '#f8f8f8', 
        padding: '10px', 
        borderRadius: '4px',
        overflow: 'auto',
        maxHeight: '200px'
      }}>
        <strong>Error:</strong> {error.message}
        {'\n'}
        <strong>Component Stack:</strong>
        {errorInfo.componentStack}
      </pre>
    </details>
    <button
      onClick={retry}
      style={{
        backgroundColor: '#ff6b6b',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
      }}
    >
      Try Again
    </button>
  </div>
);

/**
 * ErrorBoundary class component for catching JavaScript errors in React components
 */
class ErrorBoundaryClass extends Component<
  ErrorBoundaryProps & { monitorInstance?: any },
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;
  
  constructor(props: ErrorBoundaryProps & { monitorInstance?: any }) {
    super(props);
    
    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    };
  }
  
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state to show error UI on next render
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, metadata = {}, level = 'component', monitorInstance } = this.props;
    
    // Update state with error info
    this.setState({
      errorInfo
    });
    
    // Track error with monitoring service
    if (monitorInstance) {
      monitorInstance.trackComponentError(
        level === 'component' ? 'ErrorBoundary' : level,
        error,
        {
          ...metadata,
          componentStack: errorInfo.componentStack,
          errorBoundaryLevel: level,
          errorId: this.state.errorId
        }
      );
    }
    
    // Call user-provided error handler
    if (onError) {
      onError(error, errorInfo);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ErrorBoundary caught an error (${level} level)`);
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Error ID:', this.state.errorId);
      console.groupEnd();
    }
  }
  
  componentDidUpdate(prevProps: ErrorBoundaryProps & { monitorInstance?: any }) {
    const { hasError } = this.state;
    const { resetOnPropsChange, children } = this.props;
    
    // Reset error state if props change and resetOnPropsChange is enabled
    if (hasError && resetOnPropsChange && prevProps.children !== children) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: undefined
      });
    }
  }
  
  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }
  
  handleRetry = () => {
    const { monitorInstance, metadata = {} } = this.props;
    const { errorId } = this.state;
    
    // Track retry attempt
    if (monitorInstance) {
      monitorInstance.trackEvent('error_boundary_retry', {
        ...metadata,
        errorId,
        retryTimestamp: new Date().toISOString()
      });
    }
    
    // Reset error state
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    });
  }
  
  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, level, isolate } = this.props;
    
    if (hasError && error && errorInfo) {
      // Render custom fallback or default error UI
      const errorUI = fallback ? 
        fallback(error, errorInfo, this.handleRetry) :
        <DefaultErrorFallback 
          error={error} 
          errorInfo={errorInfo} 
          retry={this.handleRetry}
          level={level}
        />;
      
      // If isolate is true, wrap in an additional container to prevent style bleeding
      if (isolate) {
        return (
          <div style={{ isolation: 'isolate', contain: 'layout style' }}>
            {errorUI}
          </div>
        );
      }
      
      return errorUI;
    }
    
    return children;
  }
}

/**
 * ErrorBoundary functional component wrapper with monitoring context
 */
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
  // Try to get monitoring context if available
  let monitorInstance;
  try {
    const context = useMonitorContext();
    monitorInstance = context.monitor;
  } catch {
    // Context not available, monitoring will be disabled
    monitorInstance = null;
  }
  
  return <ErrorBoundaryClass {...props} monitorInstance={monitorInstance} />;
};

/**
 * Higher-order component to wrap components with error boundary
 */
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WithErrorBoundaryComponent: React.FC<P> = (props) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
  
  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
};

/**
 * Hook for manual error reporting within components
 */
export const useErrorHandler = () => {
  let monitorInstance;
  try {
    const context = useMonitorContext();
    monitorInstance = context.monitor;
  } catch {
    monitorInstance = null;
  }
  
  const reportError = (error: Error, metadata?: EventMetadata) => {
    if (monitorInstance) {
      monitorInstance.trackError(error, {
        ...metadata,
        manualReport: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Also throw the error to trigger error boundary if desired
    if (metadata?.triggerBoundary) {
      throw error;
    }
  };
  
  return { reportError };
};