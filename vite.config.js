import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

// @zenuml/core's package.json `exports` only exposes the root entry, so
// `import '@zenuml/core/dist/zenuml?url'` in src/utils.js is rejected by both
// node-style resolution and Vite's alias + dep-optimizer pipeline. This plugin
// intercepts that one specifier and returns the file's @fs URL directly.
const zenumlAssetUrlShim = {
  name: 'zenuml-core-asset-url-shim',
  enforce: 'pre',
  resolveId(source) {
    if (source === '@zenuml/core/dist/zenuml?url') {
      return '\0zenuml-core-asset-url';
    }
    return null;
  },
  load(id) {
    if (id === '\0zenuml-core-asset-url') {
      const filePath = resolve(
        __dirname,
        'node_modules/@zenuml/core/dist/zenuml.js',
      );
      return `export default ${JSON.stringify('/@fs' + filePath)};`;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [
    zenumlAssetUrlShim,
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