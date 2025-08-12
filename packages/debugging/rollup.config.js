import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: false,
        preferBuiltins: true
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
        exclude: ['**/*.test.ts', '**/*.spec.ts']
      })
    ],
    external: [
      'react',
      '@opentelemetry/api',
      '@opentelemetry/sdk-node',
      '@opentelemetry/exporter-jaeger',
      '@opentelemetry/exporter-zipkin',
      '@opentelemetry/instrumentation',
      '@opentelemetry/semantic-conventions',
      'simple-git',
      'ml-kmeans',
      'similarity',
      'lz-string',
      'uuid',
      'perf_hooks',
      'events',
      'path'
    ]
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: false,
        preferBuiltins: true
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        exclude: ['**/*.test.ts', '**/*.spec.ts']
      })
    ],
    external: [
      'react',
      '@opentelemetry/api',
      '@opentelemetry/sdk-node', 
      '@opentelemetry/exporter-jaeger',
      '@opentelemetry/exporter-zipkin',
      '@opentelemetry/instrumentation',
      '@opentelemetry/semantic-conventions',
      'simple-git',
      'ml-kmeans',
      'similarity',
      'lz-string',
      'uuid',
      'perf_hooks',
      'events',
      'path'
    ]
  }
];