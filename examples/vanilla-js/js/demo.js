/**
 * Demo functionality for Vanilla JavaScript Monitoring Example
 * Interactive examples and demonstrations
 */

(function() {
  'use strict';

  class Demo {
    constructor() {
      this.likeCount = 0;
      this.init();
    }

    init() {
      this.setupDemoButtons();
      this.setupFormDemo();
      this.setupInteractionDemo();
      this.setupErrorDemo();
    }

    /**
     * Set up demo button handlers
     */
    setupDemoButtons() {
      // Track custom event
      const trackEventBtn = document.getElementById('track-event-btn');
      if (trackEventBtn) {
        trackEventBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'demo',
            action: 'custom_event_triggered',
            label: 'hero_button',
            value: Math.floor(Math.random() * 100),
            metadata: {
              demo_type: 'custom_event',
              random_value: Math.random(),
            },
          });
        });
      }

      // Simulate error
      const simulateErrorBtn = document.getElementById('simulate-error-btn');
      if (simulateErrorBtn) {
        simulateErrorBtn.addEventListener('click', () => {
          try {
            throw new Error('This is a simulated error for demonstration purposes');
          } catch (error) {
            CrowdTrainerMonitoring.trackError(error, {
              category: 'demo',
              action: 'simulated_error',
              label: 'hero_button',
              severity: 'low',
            });
          }
        });
      }

      // Get started button
      const getStartedBtn = document.getElementById('get-started-btn');
      if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'conversion',
            action: 'get_started_clicked',
            label: 'header_cta',
            metadata: {
              button_location: 'header',
            },
          });
        });
      }

      // Features page demo buttons
      this.setupFeaturesPageButtons();

      // Analytics page buttons
      this.setupAnalyticsPageButtons();
    }

    /**
     * Set up features page demo buttons
     */
    setupFeaturesPageButtons() {
      const trackCustomBtn = document.getElementById('track-custom-btn');
      if (trackCustomBtn) {
        trackCustomBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'demo',
            action: 'custom_tracking_demo',
            label: 'features_page',
            metadata: {
              demo_timestamp: Date.now(),
              page_section: 'features',
            },
          });
        });
      }

      const trackConversionBtn = document.getElementById('track-conversion-btn');
      if (trackConversionBtn) {
        trackConversionBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'conversion',
            action: 'demo_conversion',
            label: 'features_page',
            value: 1,
            metadata: {
              conversion_type: 'demo',
              page_section: 'features',
            },
          });
        });
      }

      const trackPerformanceBtn = document.getElementById('track-performance-btn');
      if (trackPerformanceBtn) {
        trackPerformanceBtn.addEventListener('click', () => {
          const startTime = performance.now();
          
          // Simulate some work
          setTimeout(() => {
            const duration = performance.now() - startTime;
            
            CrowdTrainerMonitoring.trackPerformance({
              name: 'demo_operation',
              value: duration,
              unit: 'ms',
              metadata: {
                operation_type: 'simulated_work',
                page_section: 'features',
              },
            });
          }, Math.random() * 500 + 100);
        });
      }
    }

    /**
     * Set up analytics page buttons
     */
    setupAnalyticsPageButtons() {
      const exportBtn = document.getElementById('export-data-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.exportData();
        });
      }

      const clearSessionBtn = document.getElementById('clear-session-btn');
      if (clearSessionBtn) {
        clearSessionBtn.addEventListener('click', () => {
          if (confirm('Are you sure you want to clear the current session data?')) {
            CrowdTrainerMonitoring.clearSession();
            location.reload();
          }
        });
      }
    }

    /**
     * Set up API call demo
     */
    setupApiDemo() {
      const apiCallBtn = document.getElementById('api-call-btn');
      const apiResult = document.getElementById('api-result');

      if (apiCallBtn && apiResult) {
        apiCallBtn.addEventListener('click', async () => {
          apiCallBtn.disabled = true;
          apiCallBtn.textContent = 'Loading...';
          apiResult.innerHTML = '';

          const startTime = performance.now();

          try {
            // Track API call start
            CrowdTrainerMonitoring.track({
              category: 'api',
              action: 'demo_api_call_start',
              label: 'jsonplaceholder',
            });

            const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const duration = performance.now() - startTime;

            // Track successful API call
            CrowdTrainerMonitoring.trackPerformance({
              name: 'api_call_duration',
              value: duration,
              unit: 'ms',
              metadata: {
                endpoint: 'jsonplaceholder.typicode.com',
                status: response.status,
                success: true,
              },
            });

            CrowdTrainerMonitoring.track({
              category: 'api',
              action: 'demo_api_call_success',
              label: 'jsonplaceholder',
              value: Math.round(duration),
            });

            apiResult.innerHTML = `
              <div class="api-success">
                <strong>Success! (${Math.round(duration)}ms)</strong>
                <pre>${JSON.stringify(data, null, 2)}</pre>
              </div>
            `;

          } catch (error) {
            const duration = performance.now() - startTime;

            // Track API error
            CrowdTrainerMonitoring.trackError(error, {
              category: 'api',
              action: 'demo_api_call_error',
              label: 'jsonplaceholder',
              metadata: {
                duration,
                endpoint: 'jsonplaceholder.typicode.com',
              },
            });

            apiResult.innerHTML = `
              <div class="api-error">
                <strong>Error:</strong> ${error.message}
              </div>
            `;
          } finally {
            apiCallBtn.disabled = false;
            apiCallBtn.textContent = 'Make API Call';
          }
        });
      }
    }

    /**
     * Set up form demo
     */
    setupFormDemo() {
      const form = document.getElementById('demo-form');
      const formResult = document.getElementById('form-result');

      if (!form || !formResult) return;

      // Track form field interactions
      const fields = form.querySelectorAll('input, textarea');
      fields.forEach(field => {
        field.addEventListener('focus', () => {
          CrowdTrainerMonitoring.track({
            category: 'form_interaction',
            action: 'field_focus',
            label: field.name,
            metadata: {
              field_type: field.type,
              form_id: 'demo-form',
            },
          });
        });

        field.addEventListener('blur', () => {
          CrowdTrainerMonitoring.track({
            category: 'form_interaction',
            action: 'field_blur',
            label: field.name,
            metadata: {
              field_type: field.type,
              field_length: field.value.length,
              form_id: 'demo-form',
            },
          });
        });

        field.addEventListener('input', this.throttle(() => {
          CrowdTrainerMonitoring.track({
            category: 'form_interaction',
            action: 'field_input',
            label: field.name,
            metadata: {
              field_length: field.value.length,
              form_id: 'demo-form',
            },
          });
        }, 1000));
      });

      // Handle form submission
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const formFields = Array.from(formData.keys());
        const completionRate = formFields.filter(field => formData.get(field)).length / formFields.length;

        CrowdTrainerMonitoring.track({
          category: 'form_submission',
          action: 'demo_form_submitted',
          label: 'demo-form',
          metadata: {
            completion_rate: completionRate,
            field_count: formFields.length,
            form_data: {
              name_length: formData.get('name')?.length || 0,
              email_length: formData.get('email')?.length || 0,
              message_length: formData.get('message')?.length || 0,
            },
          },
        });

        formResult.innerHTML = `
          <div class="form-success">
            <strong>Form submitted successfully!</strong>
            <p>Completion rate: ${Math.round(completionRate * 100)}%</p>
          </div>
        `;

        // Clear form after a delay
        setTimeout(() => {
          form.reset();
          formResult.innerHTML = '';
        }, 3000);
      });
    }

    /**
     * Set up interaction demo
     */
    setupInteractionDemo() {
      const likeBtn = document.getElementById('like-btn');
      const shareBtn = document.getElementById('share-btn');
      const bookmarkBtn = document.getElementById('bookmark-btn');
      const downloadBtn = document.getElementById('download-btn');

      if (likeBtn) {
        likeBtn.addEventListener('click', () => {
          this.likeCount++;
          likeBtn.textContent = `👍 Like (${this.likeCount})`;
          
          CrowdTrainerMonitoring.track({
            category: 'user_engagement',
            action: 'like_clicked',
            label: 'demo_content',
            value: this.likeCount,
            metadata: {
              total_likes: this.likeCount,
            },
          });
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'user_engagement',
            action: 'share_clicked',
            label: 'demo_content',
            metadata: {
              share_method: 'button',
            },
          });

          if (navigator.share) {
            navigator.share({
              title: 'Vanilla JavaScript Monitoring Demo',
              text: 'Check out this monitoring integration example!',
              url: window.location.href,
            });
          } else {
            // Fallback for browsers without Web Share API
            const textarea = document.createElement('textarea');
            textarea.value = window.location.href;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            alert('URL copied to clipboard!');
          }
        });
      }

      if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'user_engagement',
            action: 'bookmark_clicked',
            label: 'demo_content',
          });

          alert('Bookmarked! (This is just a demo)');
        });
      }

      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          CrowdTrainerMonitoring.track({
            category: 'conversion',
            action: 'download_clicked',
            label: 'demo_content',
          });

          // Simulate download
          const link = document.createElement('a');
          link.href = 'data:text/plain;charset=utf-8,This is a demo download from the monitoring example.';
          link.download = 'demo-file.txt';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }
    }

    /**
     * Set up error demo buttons
     */
    setupErrorDemo() {
      const jsErrorBtn = document.getElementById('js-error-btn');
      const networkErrorBtn = document.getElementById('network-error-btn');
      const customErrorBtn = document.getElementById('custom-error-btn');

      if (jsErrorBtn) {
        jsErrorBtn.addEventListener('click', () => {
          try {
            // This will throw a reference error
            undefinedFunction();
          } catch (error) {
            CrowdTrainerMonitoring.trackError(error, {
              category: 'demo_error',
              action: 'javascript_error',
              label: 'intentional_demo',
            });
          }
        });
      }

      if (networkErrorBtn) {
        networkErrorBtn.addEventListener('click', async () => {
          try {
            // This will cause a network error
            await fetch('https://this-domain-does-not-exist-demo.com/api/test');
          } catch (error) {
            CrowdTrainerMonitoring.trackError(error, {
              category: 'demo_error',
              action: 'network_error',
              label: 'intentional_demo',
            });
          }
        });
      }

      if (customErrorBtn) {
        customErrorBtn.addEventListener('click', () => {
          const error = new Error('Custom demo error with additional context');
          
          CrowdTrainerMonitoring.trackError(error, {
            category: 'demo_error',
            action: 'custom_error',
            label: 'intentional_demo',
            severity: 'low',
            metadata: {
              error_source: 'demo_button',
              user_action: 'intentional_trigger',
            },
          });
        });
      }
    }

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     */
    throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  }

  // Initialize demo when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    window.Demo = new Demo();
    
    // Set up API demo after UI controller is ready
    setTimeout(() => {
      window.Demo.setupApiDemo();
    }, 100);
  });

})();