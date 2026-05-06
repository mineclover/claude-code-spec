import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Mirrors the layout of Electrobun's react-tailwind-vite template:
// vite root lives inside src/mainview/, dist is emitted at the project root,
// and electrobun.config.ts copies that dist into views/mainview/ for packaging.
export default defineConfig({
  plugins: [react()],
  root: 'src/mainview',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});
