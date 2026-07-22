import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  root: 'admin',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './admin/src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
