/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Enable experimental features for better monitoring
  experimental: {
    instrumentationHook: true,
  },

  // Custom webpack config for monitoring instrumentation
  webpack: (config, { dev, isServer }) => {
    // Add monitoring instrumentation in production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        sideEffects: false,
      };
    }
    
    return config;
  },

  // Environment variables
  env: {
    CUSTOM_MONITORING_VERSION: '1.0.0',
  },

  // Headers for monitoring
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Monitoring-Enabled',
            value: 'true',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

  // Redirects for monitoring examples
  async redirects() {
    return [
      {
        source: '/monitoring',
        destination: '/api/monitoring/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;