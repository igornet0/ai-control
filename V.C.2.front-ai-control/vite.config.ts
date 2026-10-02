import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // process.env: надёжно для Docker (environment в compose); loadEnv — для .env локально.
  // Если :8000 занят, задайте VITE_DEV_PROXY_TARGET=http://127.0.0.1:8001
  const proxyTarget = (
    process.env.VITE_DEV_PROXY_TARGET ||
    env.VITE_DEV_PROXY_TARGET ||
    'http://127.0.0.1:8000'
  ).replace(/\/$/, '')

  const dataplaneRaw =
    process.env.VITE_DEV_PROXY_DATAPLANE_TARGET || env.VITE_DEV_PROXY_DATAPLANE_TARGET
  const dataplaneTarget =
    dataplaneRaw && dataplaneRaw !== '' ? dataplaneRaw.replace(/\/$/, '') : null

  const messagingRaw =
    process.env.VITE_DEV_PROXY_MESSAGING_TARGET || env.VITE_DEV_PROXY_MESSAGING_TARGET
  const messagingTarget =
    messagingRaw && messagingRaw !== '' ? messagingRaw.replace(/\/$/, '') : 'http://127.0.0.1:8792'

  const aiApiRaw =
    process.env.VITE_DEV_PROXY_AI_TARGET || env.VITE_DEV_PROXY_AI_TARGET
  const aiApiTarget =
    aiApiRaw && aiApiRaw !== '' ? aiApiRaw.replace(/\/$/, '') : 'http://127.0.0.1:8003'

  const partyhomeRaw =
    process.env.VITE_DEV_PROXY_PARTYHOME_TARGET || env.VITE_DEV_PROXY_PARTYHOME_TARGET
  const partyhomeTarget =
    partyhomeRaw && partyhomeRaw !== '' ? partyhomeRaw.replace(/\/$/, '') : 'http://127.0.0.1:8989'

  const apiProxy: Record<string, { target: string; changeOrigin: boolean }> =
    dataplaneTarget != null
      ? {
          '^/api/data-models(?:/|$)': {
            target: dataplaneTarget,
            changeOrigin: true,
          },
          '^/api/datacode(?:/|$)': {
            target: dataplaneTarget,
            changeOrigin: true,
          },
          '^/api/code-execution(?:/|$)': {
            target: dataplaneTarget,
            changeOrigin: true,
          },
          '^/api/public/dashboard-links(?:/|$)': {
            target: dataplaneTarget,
            changeOrigin: true,
          },
        }
      : {}

  const serveDatacodeDocs: import('vite').Plugin = {
    name: 'serve-datacode-docs',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] || ''
        if (url === '/datacode-docs' || url === '/datacode-docs/') {
          req.url = '/datacode-docs/index.html'
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] || ''
        if (url === '/datacode-docs' || url === '/datacode-docs/') {
          req.url = '/datacode-docs/index.html'
        }
        next()
      })
    },
  }

  return {
    plugins: [serveDatacodeDocs, react(), tailwindcss()],

    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/')
            ) {
              return 'react-vendor'
            }
            if (id.includes('react-router')) {
              return 'router'
            }
            return undefined
          },
        },
      },
    },

    server: {
      host: '0.0.0.0',
      proxy: {
        // Нельзя убирать префикс /auth — бэкенд ждёт /auth/login_user/ и т.д.; rewrite ломал preflight (501).
        ...apiProxy,
        '/api/messaging': {
          target: messagingTarget,
          changeOrigin: true,
          ws: true,
        },
        // PartyHome signaling (:8989). Strip /api/partyhome prefix → /api/v1/rooms, /ws, /health.
        '/api/partyhome': {
          target: partyhomeTarget,
          changeOrigin: true,
          ws: true,
          timeout: 3600000,
          rewrite: (path) => path.replace(/^\/api\/partyhome/, '') || '/',
        },
        '/auth': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/admin': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/ai-api': {
          target: aiApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-api/, '') || '/',
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/static': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
