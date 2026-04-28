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
  }
})
