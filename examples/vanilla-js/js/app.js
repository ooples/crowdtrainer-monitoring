/**
 * Main application initialization for Vanilla JavaScript Monitoring Example
 */

(function() {
  'use strict';

  // Application configuration
  const APP_CONFIG = {
    monitoring: {
      apiEndpoint: 'http://localhost:3001/api/monitoring',
      enableAutoTracking: true,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableUserJourney: true,
      environment: 'development',
      debug: true,
      bufferSize: 5,
      flushInterval: 3000,
    },
    ui: {
      updateInterval: 1000,
      notificationDuration: 5000,
    },
  };

  class App {
    constructor() {
      this.isInitialized = false;
      this.loadingStartTime = Date.now();
    }

    /**
     * Initialize the application
     */
    async init() {
      try {
        // Show loading screen
        this.showLoading();

        // Initialize monitoring
        await this.initializeMonitoring();

        // Set up navigation
        this.setupNavigation();

        // Set up global features
        this.setupGlobalFeatures();

        // Handle initial route
        this.handleInitialRoute();

        // Mark as initialized
        this.isInitialized = true;

        // Hide loading screen
        this.hideLoading();

        // Track app initialization
        const initTime = Date.now() - this.loadingStartTime;
        CrowdTrainerMonitoring.trackPerformance({
          name: 'app_initialization_time',
          value: initTime,
          unit: 'ms',
          metadata: {
            features_enabled: {
              monitoring: true,
              ui_updates: true,
              navigation: true,
            },
          },
        });

        CrowdTrainerMonitoring.track({
          category: 'app',
          action: 'initialized',
          value: initTime,
          metadata: {
            initialization_time: initTime,
            page_url: window.location.href,
          },
        });

        console.log('[App] Application initialized successfully');

      } catch (error) {
        console.error('[App] Failed to initialize application:', error);
        this.handleInitializationError(error);
      }
    }

    /**
     * Initialize monitoring system
     */
    async initializeMonitoring() {
      return new Promise((resolve, reject) => {
        try {
          CrowdTrainerMonitoring.init(APP_CONFIG.monitoring);
          
          // Wait a moment for monitoring to fully initialize
          setTimeout(() => {
            resolve();
          }, 100);
          
        } catch (error) {
          reject(error);
        }
      });
    }

    /**
     * Set up navigation handling
     */
    setupNavigation() {
      // Handle hash changes
      window.addEventListener('hashchange', () => {
        this.handleRouteChange();
      });

      // Handle browser back/forward
      window.addEventListener('popstate', () => {
        this.handleRouteChange();
      });
    }

    /**
     * Handle initial route on page load
     */
    handleInitialRoute() {
      const hash = window.location.hash.replace('#', '');
      const page = hash || 'home';
      
      // Navigate to initial page
      if (window.UIController) {
        // Small delay to ensure UI controller is ready
        setTimeout(() => {
          const pageElement = document.querySelector(`[data-page="${page}"]`);
          if (pageElement) {
            pageElement.click();
          }
        }, 50);
      }
    }

    /**
     * Handle route changes
     */
    handleRouteChange() {
      const hash = window.location.hash.replace('#', '');
      const page = hash || 'home';

      CrowdTrainerMonitoring.track({
        category: 'navigation',
        action: 'route_change',
        label: page,
        metadata: {
          previous_page: this.getCurrentPage(),
          new_page: page,
          navigation_type: 'hash_change',
        },
      });
    }

    /**
     * Get current active page
     */
    getCurrentPage() {
      const activePage = document.querySelector('.page.active');
      return activePage ? activePage.id.replace('-page', '') : 'unknown';
    }

    /**
     * Set up global application features
     */
    setupGlobalFeatures() {
      // Keyboard shortcuts
      this.setupKeyboardShortcuts();

      // Online/offline detection
      this.setupConnectivityTracking();

      // Performance monitoring
      this.setupPerformanceMonitoring();

      // Visibility change tracking
      this.setupVisibilityTracking();
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (event) => {
        // Ctrl+/ or Cmd+/ for help
        if ((event.ctrlKey || event.metaKey) && event.key === '/') {
          event.preventDefault();
          this.showKeyboardShortcuts();
          
          CrowdTrainerMonitoring.track({
            category: 'feature_usage',
            action: 'keyboard_shortcut',
            label: 'help',
          });
        }

        // Escape to close modals/notifications
        if (event.key === 'Escape') {
          this.closeModals();
        }
      });
    }

    /**
     * Set up connectivity tracking
     */
    setupConnectivityTracking() {
      window.addEventListener('online', () => {
        console.log('[App] Connection restored');
        this.showConnectionStatus('online');
      });

      window.addEventListener('offline', () => {
        console.log('[App] Connection lost');
        this.showConnectionStatus('offline');
      });
    }

    /**
     * Set up performance monitoring
     */
    setupPerformanceMonitoring() {
      // Track long tasks
      if ('PerformanceObserver' in window) {
        try {
          const longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) { // Tasks longer than 50ms
                CrowdTrainerMonitoring.trackPerformance({
                  name: 'long_task',
                  value: entry.duration,
                  unit: 'ms',
                  metadata: {
                    start_time: entry.startTime,
                    task_name: entry.name,
                  },
                });
              }
            }
          });
          longTaskObserver.observe({ entryTypes: ['longtask'] });

        } catch (error) {
          console.warn('[App] Long task observer not supported:', error);
        }
      }

      // Memory usage monitoring (if available)
      if (performance.memory) {
        setInterval(() => {
          const memory = performance.memory;
          CrowdTrainerMonitoring.trackPerformance({
            name: 'memory_usage',
            value: memory.usedJSHeapSize / 1024 / 1024, // MB
            unit: 'bytes',
            metadata: {
              total_heap: memory.totalJSHeapSize / 1024 / 1024,
              heap_limit: memory.jsHeapSizeLimit / 1024 / 1024,
            },
          });
        }, 30000); // Every 30 seconds
      }
    }

    /**
     * Set up page visibility tracking
     */
    setupVisibilityTracking() {
      let startTime = Date.now();

      document.addEventListener('visibilitychange', () => {
        const now = Date.now();
        
        if (document.hidden) {
          const activeTime = now - startTime;
          
          CrowdTrainerMonitoring.trackPerformance({
            name: 'page_active_time',
            value: activeTime,
            unit: 'ms',
            metadata: {
              page: this.getCurrentPage(),
              became_hidden_at: new Date().toISOString(),
            },
          });
        } else {
          startTime = now;
          
          CrowdTrainerMonitoring.track({
            category: 'user_engagement',
            action: 'page_focus',
            metadata: {
              page: this.getCurrentPage(),
              became_visible_at: new Date().toISOString(),
            },
          });
        }
      });
    }

    /**
     * Show loading screen
     */
    showLoading() {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.style.display = 'flex';
      }
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.style.opacity = '0';
        setTimeout(() => {
          loading.style.display = 'none';
        }, 300);
      }
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
      console.error('[App] Initialization failed:', error);
      
      // Try to track the error if monitoring is available
      try {
        if (window.CrowdTrainerMonitoring) {
          CrowdTrainerMonitoring.trackError(error, {
            category: 'app_initialization',
            action: 'init_failed',
            severity: 'critical',
          });
        }
      } catch (trackingError) {
        console.error('[App] Failed to track initialization error:', trackingError);
      }

      // Show error to user
      this.showInitializationError(error);
    }

    /**
     * Show initialization error to user
     */
    showInitializationError(error) {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.innerHTML = `
          <div class="error-container">
            <div class="error-icon">⚠️</div>
            <h2>Failed to Initialize Application</h2>
            <p>An error occurred while starting the application:</p>
            <code>${error.message}</code>
            <button onclick="window.location.reload()" class="btn btn-primary">
              Reload Page
            </button>
          </div>
        `;
      }
    }

    /**
     * Show connection status
     */
    showConnectionStatus(status) {
      const statusText = status === 'online' ? 'Connection restored' : 'Connection lost';
      const statusType = status === 'online' ? 'success' : 'warning';
      
      if (window.UIController) {
        window.UIController.showNotification(statusText, statusType);
      }
    }

    /**
     * Show keyboard shortcuts
     */
    showKeyboardShortcuts() {
      const shortcuts = `
        Keyboard Shortcuts:
        
        Ctrl/Cmd + /     Show this help
        Escape           Close modals
        
        Navigation:
        You can navigate using the menu or hash URLs:
        #home, #features, #demo, #analytics
      `;
      
      alert(shortcuts);
    }

    /**
     * Close modals and notifications
     */
    closeModals() {
      // Close any open notifications
      const notifications = document.querySelectorAll('.notification');
      notifications.forEach(notification => {
        if (window.UIController) {
          window.UIController.removeNotification(notification);
        }
      });
    }
  }

  // Initialize application when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    window.App = new App();
    window.App.init();
  });

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('[App] Global error:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[App] Unhandled rejection:', event.reason);
  });

})();