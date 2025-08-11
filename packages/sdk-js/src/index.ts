/**
 * @monitoring-service/sdk-js
 * JavaScript/TypeScript SDK for monitoring service
 */

export { Monitor } from './Monitor';

// Export types for TypeScript users
export type {
  MonitorConfig,
  MonitorEvent,
  UserContext,
  SessionContext,
  Breadcrumb,
  PerformanceMetrics,
  NetworkCapture,
  ErrorCapture,
  TransportOptions,
} from './types';

// Export utilities
export {
  generateUUID,
  now,
  isBrowser,
  hasPerformanceAPI,
  hasBeaconAPI,
  hasLocalStorage,
} from './utils';

// Re-export capture classes for advanced usage
export { ErrorCapture } from './capture/errors';
export { NetworkCapture } from './capture/network';
export { PerformanceCapture } from './capture/performance';
export { WebVitalsCapture } from './capture/webvitals';

// Re-export transport classes for advanced usage
export { FetchTransport } from './transport/fetch';
export { BeaconTransport } from './transport/beacon';

// Re-export storage for advanced usage
export { LocalStorage } from './storage/localStorage';

// Default export for CDN/script tag usage
export default Monitor;