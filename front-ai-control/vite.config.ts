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
    proxy: {
      '/auth': {
        target: 'https://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth/, ''),
      },
    }
  },
  // corePlugins: {
  //   preflight: false
  // }
})
