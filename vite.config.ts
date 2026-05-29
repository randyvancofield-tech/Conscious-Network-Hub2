import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const configuredBackendUrl = (env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '')
  const proxy = configuredBackendUrl
    ? {
        '/api': {
          target: configuredBackendUrl,
          changeOrigin: true,
        },
        '/health': {
          target: configuredBackendUrl,
          changeOrigin: true,
        },
      }
    : undefined

  return {
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      proxy,
    },

    plugins: [react()],

    base: '/',

    define: {
      // Required shim for wallet SDKs expecting Node globals.
      'process': {},
      'process.env': {},
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      chunkSizeWarningLimit: 800,
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/')

            if (normalizedId.includes('vite/preload-helper')) {
              return 'vite-preload-helper'
            }

            if (normalizedId.endsWith('/components/immersive/threeRuntime.ts')) {
              return 'three-runtime'
            }

            if (!normalizedId.includes('node_modules')) return undefined

            if (normalizedId.includes('lucide-react')) {
              return 'icons-vendor'
            }

            if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/') || normalizedId.includes('/scheduler/')) {
              return 'react-vendor'
            }

            if (normalizedId.includes('@react-three')) {
              return 'react-three-vendor'
            }

            if (normalizedId.includes('/three/')) {
              return 'three-vendor'
            }

            if (normalizedId.includes('@mediapipe')) {
              return 'media-vendor'
            }

            if (normalizedId.includes('/ethers/')) {
              return 'wallet-vendor'
            }

            return 'vendor'
          },
        },
      },
    },
  }
})
