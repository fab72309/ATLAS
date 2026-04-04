import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(self)',
    },
  },
  preview: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('maplibre-gl-csp-worker')) return;
          if (id.includes('node_modules/maplibre-gl/')) return 'maplibre';
          if (id.includes('node_modules/fabric/')) return 'fabric';
          if (id.includes('node_modules/leaflet/')) return 'leaflet';
          if (id.includes('node_modules/html2canvas/')) return 'html2canvas';
          if (id.includes('node_modules/docx/') || id.includes('node_modules/file-saver/')) return 'export';
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/swiper/')) return 'ui';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) {
            return 'vendor';
          }
        },
      },
    },
  },
});
