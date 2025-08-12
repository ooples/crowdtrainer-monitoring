import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Monitoring Dashboard',
  description: 'Real-time monitoring dashboard with beautiful visualizations',
  keywords: ['monitoring', 'dashboard', 'analytics', 'real-time'],
  authors: [{ name: 'Monitoring Service' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}