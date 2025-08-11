import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMonitoring } from './MonitoringProvider';

interface UserJourneyStep {
  page: string;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

interface UserJourneyContextType {
  currentStep: UserJourneyStep | null;
  journey: UserJourneyStep[];
  trackPageView: (metadata?: Record<string, any>) => void;
  trackUserInteraction: (action: string, metadata?: Record<string, any>) => void;
  getJourneyFunnel: () => Record<string, number>;
  getSessionDuration: () => number;
}

const UserJourneyContext = createContext<UserJourneyContextType | null>(null);

interface UserJourneyProviderProps {
  children: React.ReactNode;
}

export function UserJourneyProvider({ children }: UserJourneyProviderProps) {
  const location = useLocation();
  const { track } = useMonitoring();
  const [journey, setJourney] = useState<UserJourneyStep[]>([]);
  const [currentStep, setCurrentStep] = useState<UserJourneyStep | null>(null);
  const [sessionStart] = useState(new Date());
  const [lastInteraction, setLastInteraction] = useState<Date>(new Date());

  // Track page navigation
  useEffect(() => {
    trackPageView({
      referrer: document.referrer,
      search: location.search,
      hash: location.hash,
    });
  }, [location.pathname]);

  // Track user activity for engagement metrics
  useEffect(() => {
    const events = ['click', 'scroll', 'keypress', 'mousemove', 'touchstart'];
    let activityTimeout: NodeJS.Timeout;

    const trackActivity = () => {
      setLastInteraction(new Date());
      
      // Clear previous timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }

      // Track inactivity after 5 minutes
      activityTimeout = setTimeout(() => {
        track({
          category: 'user_engagement',
          action: 'became_inactive',
          metadata: {
            inactive_duration_seconds: 300,
            last_page: location.pathname,
          },
        });
      }, 5 * 60 * 1000);
    };

    const throttledTrackActivity = throttle(trackActivity, 10000); // Track at most every 10 seconds

    events.forEach(event => {
      document.addEventListener(event, throttledTrackActivity, { passive: true });
    });

    return () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      events.forEach(event => {
        document.removeEventListener(event, throttledTrackActivity);
      });
    };
  }, [location.pathname, track]);

  // Track session end on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionDuration = getSessionDuration();
      
      track({
        category: 'user_session',
        action: 'session_end',
        value: sessionDuration,
        metadata: {
          total_pages_visited: journey.length,
          final_page: location.pathname,
          journey_funnel: getJourneyFunnel(),
        },
      });

      // Send beacon for reliable delivery
      if ('sendBeacon' in navigator) {
        const data = JSON.stringify({
          type: 'session_end',
          duration: sessionDuration,
          pages: journey.length,
          final_page: location.pathname,
        });
        
        navigator.sendBeacon('/api/monitoring/beacon', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [journey, location.pathname]);

  const trackPageView = (metadata: Record<string, any> = {}) => {
    const now = new Date();
    const previousStep = currentStep;

    // Update previous step duration
    if (previousStep) {
      const updatedPreviousStep = {
        ...previousStep,
        duration: now.getTime() - previousStep.timestamp.getTime(),
      };
      
      setJourney(prev => {
        const newJourney = [...prev];
        newJourney[newJourney.length - 1] = updatedPreviousStep;
        return newJourney;
      });

      // Track time on previous page
      track({
        category: 'user_journey',
        action: 'page_duration',
        label: previousStep.page,
        value: updatedPreviousStep.duration,
        metadata: {
          from_page: previousStep.page,
          to_page: location.pathname,
        },
      });
    }

    // Create new step
    const newStep: UserJourneyStep = {
      page: location.pathname,
      timestamp: now,
      metadata,
    };

    setCurrentStep(newStep);
    setJourney(prev => [...prev, newStep]);

    // Track page view event
    track({
      category: 'user_journey',
      action: 'page_view',
      label: location.pathname,
      metadata: {
        ...metadata,
        step_number: journey.length + 1,
        session_duration: getSessionDuration(),
        time_since_last_interaction: now.getTime() - lastInteraction.getTime(),
      },
    });
  };

  const trackUserInteraction = (action: string, metadata: Record<string, any> = {}) => {
    const now = new Date();
    setLastInteraction(now);

    track({
      category: 'user_interaction',
      action,
      label: location.pathname,
      metadata: {
        ...metadata,
        step_number: journey.length,
        time_on_page: currentStep 
          ? now.getTime() - currentStep.timestamp.getTime()
          : 0,
        session_duration: getSessionDuration(),
      },
    });
  };

  const getJourneyFunnel = (): Record<string, number> => {
    const funnel: Record<string, number> = {};
    
    journey.forEach(step => {
      funnel[step.page] = (funnel[step.page] || 0) + 1;
    });

    return funnel;
  };

  const getSessionDuration = (): number => {
    return new Date().getTime() - sessionStart.getTime();
  };

  const contextValue: UserJourneyContextType = {
    currentStep,
    journey,
    trackPageView,
    trackUserInteraction,
    getJourneyFunnel,
    getSessionDuration,
  };

  return (
    <UserJourneyContext.Provider value={contextValue}>
      {children}
    </UserJourneyContext.Provider>
  );
}

export function useUserJourney() {
  const context = useContext(UserJourneyContext);
  if (!context) {
    throw new Error('useUserJourney must be used within a UserJourneyProvider');
  }
  return context;
}

// Utility function for throttling
function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}