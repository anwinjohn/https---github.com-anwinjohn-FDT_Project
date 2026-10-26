import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteVersionPlugin } from './scripts/vite-version-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteVersionPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: false, // This removes the source maps entirely
    minify: 'esbuild', // This ensures fast and compact minification
  },
});
