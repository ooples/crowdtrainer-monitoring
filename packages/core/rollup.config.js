import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    },
    external: (id) => {
      // Don't mark the entry module as external
      if (id === 'src/index.ts' || id.includes('packages/core/src')) {
        return false;
      }
      // Mark node_modules as external
      return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
    },
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        outputToFilesystem: true
      })
    ]
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    external: (id) => {
      // Don't mark the entry module as external
      if (id === 'src/index.ts' || id.includes('packages/core/src')) {
        return false;
      }
      // Mark node_modules as external
      return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
    },
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        outputToFilesystem: false
      })
    ]
  }
];