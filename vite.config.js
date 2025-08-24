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
    // Set reasonable chunk size limit for this complex application
    chunkSizeWarningLimit: 1000, // 1MB limit instead of default 500KB
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate large vendor libraries
          codemirror: ['codemirror'],
          firebase: ['firebase'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-radio-group', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
        },
      },
    },
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
    proxy: {
      '/create-share': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        rewrite: (path) => `/staging-zenuml-27954/us-central1/create_share`
      },
      '/get-shared-item': {
        target: 'http://127.0.0.1:5002/staging-zenuml-27954/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace('/get-shared-item', '/get_shared_item')
      },
      '/sync-diagram': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        rewrite: (path) => `/staging-zenuml-27954/us-central1/sync_diagram`
      },
      '/authenticate': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        rewrite: (path) => `/staging-zenuml-27954/us-central1/authenticate`
      },
      '/track': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        rewrite: (path) => `/staging-zenuml-27954/us-central1/track`
      },
      '/info': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        rewrite: (path) => `/staging-zenuml-27954/us-central1/info`
      },
    }
  },
}); 