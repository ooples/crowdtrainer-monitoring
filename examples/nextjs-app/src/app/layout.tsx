import { Metadata } from 'next';
import { MonitoringProvider } from '../components/MonitoringProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
  title: 'Next.js Monitoring Example',
  description: 'Example Next.js app with CrowdTrainer monitoring integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <MonitoringProvider
            config={{
              apiEndpoint: process.env.NEXT_PUBLIC_MONITORING_ENDPOINT || 'http://localhost:3001/api/monitoring',
              enableRealTime: true,
              enableUserJourney: true,
              enablePerformanceTracking: true,
              environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
              debug: process.env.NODE_ENV === 'development',
            }}
          >
            {children}
          </MonitoringProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}