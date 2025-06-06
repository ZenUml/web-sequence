import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { execSync } from 'child_process';

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [
    preact({
      devToolsEnabled: true,
    }),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  root: 'src',
  publicDir: '../static',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  define: {
    __COMMITHASH__: JSON.stringify(getCommitHash()),
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  esbuild: {
    loader: 'jsx',
    include: [
      // src
      /src\/.*\.[jt]sx?$/,
      // node_modules
      /node_modules\/.*\.jsx$/,
    ],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    host: true,
    port: 3000,
  },
}); 