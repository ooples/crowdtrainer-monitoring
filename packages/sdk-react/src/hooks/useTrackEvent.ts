import { useCallback, useRef, useEffect } from 'react';
import { useMonitor } from './useMonitor';
import { EventMetadata } from '../types';

/**
 * Options for event tracking
 */
interface TrackEventOptions {
  debounceMs?: number;
  throttleMs?: number;
  immediate?: boolean;
  metadata?: EventMetadata;
  enabled?: boolean;
  maxEvents?: number;
  timeWindow?: number; // ms
}

/**
 * Hook for tracking events with advanced options like debouncing, throttling, and rate limiting
 * 
 * @param defaultOptions - Default options for all tracked events
 * 
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const trackEvent = useTrackEvent({
 *     debounceMs: 300,
 *     metadata: { component: 'SearchComponent' }
 *   });
 *   
 *   const handleSearch = useCallback((query: string) => {
 *     trackEvent('search_performed', { query, queryLength: query.length });
 *   }, [trackEvent]);
 *   
 *   return (
 *     <input 
 *       onChange={(e) => handleSearch(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 * ```
 */
export const useTrackEvent = (defaultOptions: TrackEventOptions = {}) => {
  const { monitor, isEnabled } = useMonitor();
  
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const throttleTimestamps = useRef<Map<string, number>>(new Map());
  const eventCounts = useRef<Map<string, { count: number; windowStart: number }>>(new Map());
  
  const trackEvent = useCallback((
    action: string,
    eventMetadata?: EventMetadata,
    options?: TrackEventOptions
  ) => {
    if (!isEnabled) return;
    
    const finalOptions = { ...defaultOptions, ...options };
    const {
      debounceMs = 0,
      throttleMs = 0,
      immediate = false,
      metadata = {},
      enabled = true,
      maxEvents,
      timeWindow = 60000 // 1 minute default
    } = finalOptions;
    
    if (!enabled) return;
    
    const eventKey = `${action}_${JSON.stringify(eventMetadata)}`;
    const now = Date.now();
    
    // Rate limiting check
    if (maxEvents && timeWindow) {
      const eventData = eventCounts.current.get(eventKey) || { count: 0, windowStart: now };
      
      // Reset window if it has expired
      if (now - eventData.windowStart > timeWindow) {
        eventData.count = 0;
        eventData.windowStart = now;
      }
      
      // Check if we've exceeded the rate limit
      if (eventData.count >= maxEvents) {
        console.warn(`[Monitor] Rate limit exceeded for event: ${action}`);
        return;
      }
      
      eventData.count++;
      eventCounts.current.set(eventKey, eventData);
    }
    
    const executeTrack = () => {
      monitor.trackEvent(action, {
        ...metadata,
        ...eventMetadata,
        trackingTimestamp: new Date().toISOString()
      });
    };
    
    // Immediate execution (no debounce/throttle)
    if (immediate) {
      executeTrack();
      return;
    }
    
    // Throttling
    if (throttleMs > 0) {
      const lastThrottle = throttleTimestamps.current.get(eventKey) || 0;
      if (now - lastThrottle < throttleMs) {
        return; // Skip this event due to throttling
      }
      throttleTimestamps.current.set(eventKey, now);
    }
    
    // Debouncing
    if (debounceMs > 0) {
      // Clear existing timer
      const existingTimer = debounceTimers.current.get(eventKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer
      const timer = setTimeout(() => {
        executeTrack();
        debounceTimers.current.delete(eventKey);
      }, debounceMs);
      
      debounceTimers.current.set(eventKey, timer);
    } else {
      // No debouncing, execute immediately
      executeTrack();
    }
  }, [monitor, isEnabled, defaultOptions]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, []);
  
  return trackEvent;
};

/**
 * Hook for tracking page views and navigation events
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function usePageTracking() {
 *   const trackPageView = useTrackPageView({
 *     trackTimeOnPage: true,
 *     trackScrollDepth: true
 *   });
 *   
 *   useEffect(() => {
 *     trackPageView(window.location.pathname);
 *   }, [trackPageView]);
 * }
 * ```
 */
export const useTrackPageView = (options: {
  trackTimeOnPage?: boolean;
  trackScrollDepth?: boolean;
  scrollThresholds?: number[];
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    trackTimeOnPage = false,
    trackScrollDepth = false,
    scrollThresholds = [25, 50, 75, 90],
    metadata = {},
    enabled = true
  } = options;
  
  const pageStartTime = useRef<number>(0);
  const maxScrollDepth = useRef<number>(0);
  const scrollThresholdsReached = useRef<Set<number>>(new Set());
  
  const trackPageView = useCallback((route: string, pageMetadata?: EventMetadata) => {
    if (!isEnabled || !enabled) return;
    
    // Track page view
    monitor.trackPageView(route, {
      ...metadata,
      ...pageMetadata,
      pageLoadTimestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined
    });
    
    // Reset tracking state for new page
    pageStartTime.current = Date.now();
    maxScrollDepth.current = 0;
    scrollThresholdsReached.current.clear();
    
    // Set up time on page tracking
    if (trackTimeOnPage) {
      const handleBeforeUnload = () => {
        const timeOnPage = Date.now() - pageStartTime.current;
        monitor.trackMetric('time_on_page', timeOnPage, 'ms', {
          ...metadata,
          route,
          maxScrollDepth: maxScrollDepth.current
        });
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        handleBeforeUnload(); // Track time when component unmounts
      };
    }
    
    // Set up scroll depth tracking
    if (trackScrollDepth && typeof window !== 'undefined') {
      const handleScroll = () => {
        const scrollPercent = Math.round(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        maxScrollDepth.current = Math.max(maxScrollDepth.current, scrollPercent);
        
        // Check if any thresholds were reached
        scrollThresholds.forEach(threshold => {
          if (scrollPercent >= threshold && !scrollThresholdsReached.current.has(threshold)) {
            scrollThresholdsReached.current.add(threshold);
            monitor.trackEvent('scroll_depth_reached', {
              ...metadata,
              route,
              threshold,
              scrollPercent,
              timestamp: new Date().toISOString()
            });
          }
        });
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
    
    // Return empty cleanup function if no tracking is set up
    return () => {};
  }, [isEnabled, enabled, monitor, metadata, trackTimeOnPage, trackScrollDepth, scrollThresholds]);
  
  return trackPageView;
};

/**
 * Hook for tracking form interactions and submissions
 * 
 * @param formName - Name of the form
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function ContactForm() {
 *   const {
 *     trackFieldFocus,
 *     trackFieldChange,
 *     trackFormSubmit,
 *     trackValidationError
 *   } = useTrackForm('contact_form');
 *   
 *   return (
 *     <form onSubmit={trackFormSubmit({ formData: {...} })}>
 *       <input
 *         name="email"
 *         onFocus={trackFieldFocus('email')}
 *         onChange={trackFieldChange('email')}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
export const useTrackForm = (formName: string, options: {
  trackAllFields?: boolean;
  trackValidation?: boolean;
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const trackEvent = useTrackEvent({
    metadata: { formName, ...options.metadata },
    enabled: options.enabled
  });
  
  const formStartTime = useRef<number>(0);
  const fieldInteractions = useRef<Map<string, number>>(new Map());
  
  const trackFormStart = useCallback(() => {
    formStartTime.current = Date.now();
    trackEvent('form_started', {
      formStartTime: new Date().toISOString()
    });
  }, [trackEvent]);
  
  const trackFieldFocus = useCallback((fieldName: string) => () => {
    const focusTime = Date.now();
    fieldInteractions.current.set(fieldName, focusTime);
    
    if (options.trackAllFields !== false) {
      trackEvent('field_focused', {
        fieldName,
        focusTime: new Date().toISOString()
      });
    }
    
    // Track form start on first field focus if not already started
    if (formStartTime.current === 0) {
      trackFormStart();
    }
  }, [trackEvent, options.trackAllFields, trackFormStart]);
  
  const trackFieldChange = useCallback((fieldName: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    const focusTime = fieldInteractions.current.get(fieldName);
    const timeToFirstChange = focusTime ? Date.now() - focusTime : 0;
    
    if (options.trackAllFields !== false) {
      trackEvent('field_changed', {
        fieldName,
        valueLength: value.length,
        timeToFirstChange,
        hasValue: value.length > 0
      });
    }
  }, [trackEvent, options.trackAllFields]);
  
  const trackFieldBlur = useCallback((fieldName: string) => (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    const focusTime = fieldInteractions.current.get(fieldName);
    const timeSpent = focusTime ? Date.now() - focusTime : 0;
    
    if (options.trackAllFields !== false) {
      trackEvent('field_blurred', {
        fieldName,
        timeSpent,
        finalValueLength: value.length,
        fieldCompleted: value.length > 0
      });
    }
  }, [trackEvent, options.trackAllFields]);
  
  const trackFormSubmit = useCallback((submitMetadata?: EventMetadata) => (_event: React.FormEvent) => {
    const formCompletionTime = formStartTime.current ? Date.now() - formStartTime.current : 0;
    const totalFields = fieldInteractions.current.size;
    
    trackEvent('form_submitted', {
      ...submitMetadata,
      formCompletionTime,
      totalFields,
      submitTime: new Date().toISOString()
    });
  }, [trackEvent]);
  
  const trackValidationError = useCallback((fieldName: string, errorMessage: string) => {
    if (options.trackValidation !== false) {
      trackEvent('validation_error', {
        fieldName,
        errorMessage,
        errorTime: new Date().toISOString()
      });
    }
  }, [trackEvent, options.trackValidation]);
  
  const trackFormAbandoned = useCallback((reason?: string) => {
    const formDuration = formStartTime.current ? Date.now() - formStartTime.current : 0;
    const completedFields = fieldInteractions.current.size;
    
    trackEvent('form_abandoned', {
      reason,
      formDuration,
      completedFields,
      abandonTime: new Date().toISOString()
    });
  }, [trackEvent]);
  
  return {
    trackFormStart,
    trackFieldFocus,
    trackFieldChange,
    trackFieldBlur,
    trackFormSubmit,
    trackValidationError,
    trackFormAbandoned
  };
};