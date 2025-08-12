/**
 * @monitoring-service/sdk-react
 * 
 * React SDK for CrowdTrainer monitoring service with hooks and components.
 * Compatible with React 16.8+ and React 18.
 * 
 * @example
 * ```tsx
 * import { MonitorProvider, useMonitor, ErrorBoundary } from '@monitoring-service/sdk-react';
 * 
 * function App() {
 *   return (
 *     <MonitorProvider config={{ apiKey: 'your-key', environment: 'production' }}>
 *       <ErrorBoundary>
 *         <MyComponent />
 *       </ErrorBoundary>
 *     </MonitorProvider>
 *   );
 * }
 * 
 * function MyComponent() {
 *   const monitor = useMonitor();
 *   
 *   const handleClick = () => {
 *     monitor.trackEvent('button_click', { component: 'MyComponent' });
 *   };
 *   
 *   return <button onClick={handleClick}>Track Event</button>;
 * }
 * ```
 */

// Core provider and context
export { MonitorProvider } from './MonitorProvider';
export type { MonitorProviderProps, MonitorConfig } from './MonitorProvider';

// Error boundary component
export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';

// React hooks
export { useMonitor } from './hooks/useMonitor';
export { useTrackEvent } from './hooks/useTrackEvent';
export { useMetric } from './hooks/useMetric';
export { usePerformance } from './hooks/usePerformance';

// Higher-order component
export { withMonitoring } from './hoc/withMonitoring';
export type { WithMonitoringOptions } from './hoc/withMonitoring';

// Router integrations
export { ReactRouterIntegration } from './integrations/router';
export type { RouterIntegrationProps } from './integrations/router';

// Types
export type {
  MonitoringEvent,
  PerformanceMetric,
  EventMetadata,
  MonitoringHook,
  ComponentRenderMetric,
  UserInteractionEvent,
  WithMonitoringProps
} from './types';