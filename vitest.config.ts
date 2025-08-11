/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@monitoring-service/core': resolve(__dirname, './packages/core/src'),
      '@monitoring-service/server': resolve(__dirname, './packages/server/src'),
      '@monitoring-service/dashboard': resolve(
        __dirname,
        './packages/dashboard/src'
      ),
      '@monitoring-service/sdk-js': resolve(
        __dirname,
        './packages/sdk-js/src'
      ),
      '@monitoring-service/sdk-react': resolve(
        __dirname,
        './packages/sdk-react/src'
      ),
      '@monitoring-service/sdk-react-native': resolve(
        __dirname,
        './packages/sdk-react-native/src'
      ),
    },
  },
  define: {
    __DEV__: true,
  },
});