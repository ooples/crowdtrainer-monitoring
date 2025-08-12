import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        declaration: true,
        declarationDir: 'dist',
      }),
    ],
    external: [
      'twilio',
      'nodemailer',
      '@slack/web-api',
      'microsoft-graph-client',
      'handlebars',
      'uuid',
      'ioredis',
      'axios',
      'zod',
      'date-fns',
      'date-fns-tz',
      'lodash',
      '@aws-sdk/client-sns',
      '@microsoft/microsoft-graph-client',
      '@monitoring-service/core'
    ],
  },
]);