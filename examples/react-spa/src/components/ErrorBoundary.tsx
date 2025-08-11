import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] React error caught:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Send error to monitoring system
    this.reportErrorToMonitoring(error, errorInfo);
  }

  private reportErrorToMonitoring = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorData = {
        type: 'error',
        category: 'react_error',
        action: 'component_error',
        metadata: {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          errorInfo: {
            componentStack: errorInfo.componentStack,
          },
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
        severity: 'high',
      };

      const response = await fetch(`${process.env.REACT_APP_MONITORING_ENDPOINT}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });

      if (!response.ok) {
        console.error('[ErrorBoundary] Failed to report error to monitoring service');
      }
    } catch (reportingError) {
      console.error('[ErrorBoundary] Error while reporting to monitoring service:', reportingError);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">
              ⚠️
            </div>
            <h1>Oops! Something went wrong</h1>
            <p>We're sorry, but something unexpected happened. The error has been reported to our team.</p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="error-details">
                <h3>Error Details (Development Mode)</h3>
                <p><strong>Error:</strong> {this.state.error.message}</p>
                <details>
                  <summary>Stack Trace</summary>
                  <pre>{this.state.error.stack}</pre>
                </details>
                {this.state.errorInfo && (
                  <details>
                    <summary>Component Stack</summary>
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
            )}

            <div className="error-actions">
              <button onClick={this.handleReset} className="btn btn-secondary">
                Try Again
              </button>
              <button onClick={this.handleReload} className="btn btn-primary">
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;