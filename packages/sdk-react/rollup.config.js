import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { terser } from 'rollup-plugin-terser';

const packageJson = require('./package.json');

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        rollupCommonJSResolveHack: true,
        clean: true
      })
    ],
    external: ['react', 'react-dom']
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        rollupCommonJSResolveHack: true,
        clean: true
      })
    ],
    external: ['react', 'react-dom']
  },
  // UMD build for CDN
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'MonitoringSDKReact',
        sourcemap: true,
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        rollupCommonJSResolveHack: true,
        clean: true
      }),
      terser() // Minify UMD build
    ],
    external: ['react', 'react-dom']
  }
];