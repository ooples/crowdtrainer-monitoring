/**
 * Simplified Monitoring SDK
 */

export class MonitoringSDK {
  private config: any;
  constructor(config: any) {
    this.config = config;
    console.log('MonitoringSDK initialized:', config.apiUrl);
  }
  
  setUser(user: any) { console.log('User set:', user.id); }
  clearUser() { console.log('User cleared'); }
  trackEvent(name: string, props?: any) { console.log('Event:', name, props); }
  trackPageView(props: any) { console.log('Page view:', props); }
  captureError(error: any, context?: any) { console.error('Error captured:', error); }
  recordMetric(name: string, value: number, tags?: any) { console.log('Metric:', name, value); }
  startTransaction(name: string, op: string) {
    return {
      finish: () => console.log('Transaction finished:', name),
      setStatus: (s: string) => console.log('Transaction status:', s)
    };
  }
  addBreadcrumb(crumb: any) { console.log('Breadcrumb:', crumb.message); }
}
