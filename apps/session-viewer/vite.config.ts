import { defineConfig } from 'vite';

// Mirrors the renderer config of the parent Electron app: no @vitejs/plugin-react
// dependency, esbuild handles JSX directly. Keeps the toolchain identical so a
// future move under apps/claude-code-spec can share build conventions.
export default defineConfig({
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[tj]sx?$/,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.ts': 'tsx',
        '.tsx': 'tsx',
      },
    },
  },
  server: {
    port: 5180,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
