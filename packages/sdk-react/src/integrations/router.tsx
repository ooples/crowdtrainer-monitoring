import React, { useEffect, useCallback, useRef, ReactNode } from 'react';
import { useMonitor } from '../hooks/useMonitor';
import { EventMetadata, RouteChangeEvent } from '../types';

/**
 * Props for React Router integration components
 */
export interface RouterIntegrationProps {
  children?: ReactNode;
  trackPageViews?: boolean;
  trackRouteChanges?: boolean;
  trackNavigationTiming?: boolean;
  trackUserJourney?: boolean;
  excludeRoutes?: string[];
  metadata?: EventMetadata;
  enabled?: boolean;
}

/**
 * Navigation timing data
 */
interface NavigationTiming {
  from: string;
  to: string;
  startTime: number;
  endTime: number;
  duration: number;
  method: 'push' | 'replace' | 'pop' | 'initial';
}

/**
 * React Router v6 integration component for automatic route tracking
 * 
 * @example
 * ```tsx
 * import { BrowserRouter } from 'react-router-dom';
 * import { ReactRouterIntegration } from '@monitoring-service/sdk-react';
 * 
 * function App() {
 *   return (
 *     <BrowserRouter>
 *       <ReactRouterIntegration 
 *         trackPageViews={true}
 *         trackNavigationTiming={true}
 *         trackUserJourney={true}
 *       />
 *       <Routes>
 *         <Route path="/" element={<Home />} />
 *         <Route path="/about" element={<About />} />
 *       </Routes>
 *     </BrowserRouter>
 *   );
 * }
 * ```
 */
export const ReactRouterIntegration: React.FC<RouterIntegrationProps> = ({
  children,
  trackPageViews = true,
  trackRouteChanges = true,
  trackNavigationTiming = true,
  trackUserJourney = true,
  excludeRoutes = [],
  metadata = {},
  enabled = true
}) => {
  const { monitor, isEnabled } = useMonitor();
  const currentRoute = useRef<string>(typeof window !== 'undefined' ? window.location.pathname : '/');
  const navigationStart = useRef<number>(0);
  const routeHistory = useRef<string[]>([]);
  const sessionRoutes = useRef<Set<string>>(new Set());
  
  // Check if route should be excluded from tracking
  const shouldTrackRoute = useCallback((route: string): boolean => {
    if (!enabled || !isEnabled) return false;
    return !excludeRoutes.some(excluded => 
      route.includes(excluded) || route.match(new RegExp(excluded))
    );
  }, [enabled, isEnabled, excludeRoutes]);
  
  // Track page view
  const trackPageView = useCallback((route: string, pageMetadata?: EventMetadata) => {
    if (!shouldTrackRoute(route) || !trackPageViews) return;
    
    monitor.trackPageView(route, {
      ...metadata,
      ...pageMetadata,
      routeType: getRouteType(route),
      isNewRoute: !sessionRoutes.current.has(route),
      totalUniqueRoutes: sessionRoutes.current.size + 1,
      timestamp: new Date().toISOString()
    });
    
    sessionRoutes.current.add(route);
  }, [shouldTrackRoute, trackPageViews, monitor, metadata]);
  
  // Track route change
  const trackRouteChange = useCallback((routeChangeData: RouteChangeEvent) => {
    if (!shouldTrackRoute(routeChangeData.to) || !trackRouteChanges) return;
    
    monitor.trackEvent('route_change', {
      ...metadata,
      ...routeChangeData.metadata,
      fromRoute: routeChangeData.from,
      toRoute: routeChangeData.to,
      navigationDuration: routeChangeData.duration,
      routeChangeType: getRouteChangeType(routeChangeData.from, routeChangeData.to),
      timestamp: new Date().toISOString()
    });
  }, [shouldTrackRoute, trackRouteChanges, monitor, metadata]);
  
  // Track user journey
  const trackUserJourneyStep = useCallback((route: string, stepMetadata?: EventMetadata) => {
    if (!shouldTrackRoute(route) || !trackUserJourney) return;
    
    routeHistory.current.push(route);
    
    // Keep only last 10 routes for journey tracking
    if (routeHistory.current.length > 10) {
      routeHistory.current = routeHistory.current.slice(-10);
    }
    
    monitor.trackEvent('user_journey_step', {
      ...metadata,
      ...stepMetadata,
      currentRoute: route,
      previousRoute: routeHistory.current[routeHistory.current.length - 2],
      journeyStep: routeHistory.current.length,
      journeyPath: routeHistory.current.slice(-5), // Last 5 steps
      isBacktrack: isBacktracking(routeHistory.current),
      timestamp: new Date().toISOString()
    });
  }, [shouldTrackRoute, trackUserJourney, monitor, metadata]);
  
  // Handle navigation timing
  const handleNavigation = useCallback((to: string, method: NavigationTiming['method']) => {
    const from = currentRoute.current;
    const endTime = performance.now();
    const duration = navigationStart.current ? endTime - navigationStart.current : 0;
    
    if (from !== to) {
      const navigationData: NavigationTiming = {
        from,
        to,
        startTime: navigationStart.current,
        endTime,
        duration,
        method
      };
      
      // Track navigation timing
      if (trackNavigationTiming && shouldTrackRoute(to)) {
        monitor.trackMetric('navigation_duration', duration, 'ms', {
          ...metadata,
          from,
          to,
          method,
          navigationDistance: calculateNavigationDistance(from, to),
          isSlowNavigation: duration > 1000
        });
      }
      
      // Track route change
      trackRouteChange({
        from,
        to,
        duration: duration > 0 ? duration : undefined,
        metadata: { method, navigationData }
      });
      
      // Track page view
      trackPageView(to, { 
        navigationMethod: method,
        fromRoute: from,
        navigationDuration: duration
      });
      
      // Track user journey
      trackUserJourneyStep(to, { 
        navigationMethod: method,
        fromRoute: from
      });
      
      currentRoute.current = to;
    }
    
    navigationStart.current = performance.now();
  }, [trackNavigationTiming, shouldTrackRoute, monitor, metadata, trackRouteChange, trackPageView, trackUserJourneyStep]);
  
  // Set up route change detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Track initial page load
    const initialRoute = window.location.pathname;
    if (shouldTrackRoute(initialRoute)) {
      trackPageView(initialRoute, { 
        isInitialLoad: true,
        referrer: document.referrer
      });
      trackUserJourneyStep(initialRoute, { isInitialLoad: true });
    }
    
    // Listen for browser navigation (back/forward buttons)
    const handlePopState = (event: PopStateEvent) => {
      handleNavigation(window.location.pathname, 'pop');
    };
    
    // Override History API methods to track programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(state, title, url) {
      originalPushState.call(this, state, title, url);
      if (url) {
        const newPath = typeof url === 'string' ? url : url.toString();
        handleNavigation(newPath, 'push');
      }
    };
    
    history.replaceState = function(state, title, url) {
      originalReplaceState.call(this, state, title, url);
      if (url) {
        const newPath = typeof url === 'string' ? url : url.toString();
        handleNavigation(newPath, 'replace');
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [shouldTrackRoute, trackPageView, trackUserJourneyStep, handleNavigation]);
  
  return <>{children}</>;
};

/**
 * Hook for manual route tracking (useful for custom routers or SSR)
 * 
 * @example
 * ```tsx
 * function CustomRouter() {
 *   const { trackRoute, trackNavigation } = useRouteTracking({
 *     trackPageViews: true,
 *     metadata: { routerType: 'custom' }
 *   });
 *   
 *   useEffect(() => {
 *     trackRoute('/custom-route', { customData: 'value' });
 *   }, [trackRoute]);
 *   
 *   return <div>Custom router content</div>;
 * }
 * ```
 */
export const useRouteTracking = (options: RouterIntegrationProps = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    trackPageViews = true,
    trackRouteChanges = true,
    trackNavigationTiming = true,
    trackUserJourney = true,
    excludeRoutes = [],
    metadata = {},
    enabled = true
  } = options;
  
  const shouldTrack = useCallback((route: string): boolean => {
    if (!enabled || !isEnabled) return false;
    return !excludeRoutes.some(excluded => 
      route.includes(excluded) || route.match(new RegExp(excluded))
    );
  }, [enabled, isEnabled, excludeRoutes]);
  
  const trackRoute = useCallback((
    route: string, 
    routeMetadata?: EventMetadata
  ) => {
    if (!shouldTrack(route)) return;
    
    if (trackPageViews) {
      monitor.trackPageView(route, {
        ...metadata,
        ...routeMetadata,
        manualTracking: true
      });
    }
    
    if (trackUserJourney) {
      monitor.trackEvent('user_journey_step', {
        ...metadata,
        ...routeMetadata,
        currentRoute: route,
        manualTracking: true
      });
    }
  }, [shouldTrack, trackPageViews, trackUserJourney, monitor, metadata]);
  
  const trackNavigation = useCallback((
    from: string,
    to: string,
    duration?: number,
    navigationMetadata?: EventMetadata
  ) => {
    if (!shouldTrack(to)) return;
    
    if (trackRouteChanges) {
      monitor.trackEvent('route_change', {
        ...metadata,
        ...navigationMetadata,
        fromRoute: from,
        toRoute: to,
        navigationDuration: duration,
        manualTracking: true
      });
    }
    
    if (trackNavigationTiming && duration !== undefined) {
      monitor.trackMetric('navigation_duration', duration, 'ms', {
        ...metadata,
        ...navigationMetadata,
        from,
        to,
        manualTracking: true
      });
    }
  }, [shouldTrack, trackRouteChanges, trackNavigationTiming, monitor, metadata]);
  
  return {
    trackRoute,
    trackNavigation,
    isEnabled: enabled && isEnabled
  };
};

/**
 * Higher-order component for wrapping route components with automatic tracking
 * 
 * @example
 * ```tsx
 * const TrackedHome = withRouteTracking(Home, {
 *   routeName: 'home',
 *   metadata: { importance: 'high' }
 * });
 * 
 * const TrackedAbout = withRouteTracking(About, {
 *   routeName: 'about',
 *   trackTime: true
 * });
 * ```
 */
export const withRouteTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    routeName?: string;
    trackTime?: boolean;
    metadata?: EventMetadata;
    enabled?: boolean;
  } = {}
) => {
  const {
    routeName,
    trackTime = false,
    metadata = {},
    enabled = true
  } = options;
  
  const WithRouteTrackingComponent: React.FC<P> = (props) => {
    const { monitor, isEnabled } = useMonitor();
    const mountTime = useRef<number>(0);
    
    useEffect(() => {
      if (!enabled || !isEnabled) return;
      
      const route = routeName || window.location.pathname;
      mountTime.current = performance.now();
      
      monitor.trackEvent('route_component_mounted', {
        ...metadata,
        route,
        componentName: WrappedComponent.displayName || WrappedComponent.name
      });
      
      return () => {
        if (trackTime) {
          const timeOnRoute = performance.now() - mountTime.current;
          monitor.trackMetric('time_on_route', timeOnRoute, 'ms', {
            ...metadata,
            route,
            componentName: WrappedComponent.displayName || WrappedComponent.name
          });
        }
        
        monitor.trackEvent('route_component_unmounted', {
          ...metadata,
          route,
          componentName: WrappedComponent.displayName || WrappedComponent.name,
          timeOnRoute: trackTime ? performance.now() - mountTime.current : undefined
        });
      };
    }, [props]);
    
    return <WrappedComponent {...props} />;
  };
  
  WithRouteTrackingComponent.displayName = 
    `withRouteTracking(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithRouteTrackingComponent;
};

// Helper functions

function getRouteType(route: string): string {
  if (route === '/') return 'home';
  if (route.includes('/admin')) return 'admin';
  if (route.includes('/api')) return 'api';
  if (route.includes('/auth') || route.includes('/login') || route.includes('/signup')) return 'auth';
  if (route.includes('/profile') || route.includes('/account')) return 'profile';
  if (route.includes('/settings')) return 'settings';
  if (route.includes('/help') || route.includes('/support')) return 'support';
  if (route.match(/\/\d+/)) return 'detail'; // Routes with IDs
  return 'general';
}

function getRouteChangeType(from: string, to: string): string {
  if (from === to) return 'refresh';
  if (to === '/') return 'to_home';
  if (from === '/') return 'from_home';
  if (from.includes(to) || to.includes(from)) return 'related';
  if (getRouteType(from) === getRouteType(to)) return 'same_section';
  return 'cross_section';
}

function calculateNavigationDistance(from: string, to: string): number {
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);
  
  // Calculate "distance" as the difference in route depth plus non-matching segments
  const maxLength = Math.max(fromParts.length, toParts.length);
  let distance = Math.abs(fromParts.length - toParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    if (fromParts[i] !== toParts[i]) {
      distance++;
    }
  }
  
  return distance;
}

function isBacktracking(routeHistory: string[]): boolean {
  if (routeHistory.length < 3) return false;
  
  const current = routeHistory[routeHistory.length - 1];
  const beforePrevious = routeHistory[routeHistory.length - 3];
  
  return current === beforePrevious;
}

export type { RouterIntegrationProps, NavigationTiming };