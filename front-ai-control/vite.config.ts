import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),],

  server: {
    https: false,
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/auth': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
    }
  },
  
  optimizeDeps: {
    exclude: [],
    force: true
  },
  
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      }
    }
  }
})
