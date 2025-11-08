import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5178,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
