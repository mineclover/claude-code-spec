import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[tj]sx?$/,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.ts': 'tsx',
        '.tsx': 'tsx',
      },
    },
  },
  server: {
    strictPort: false,
    hmr: {
      overlay: false,
    },
  },
});
