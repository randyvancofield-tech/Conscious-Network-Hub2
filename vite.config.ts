import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const configuredBackendUrl = (env.VITE_BACKEND_URL || '').trim()
  const allowRemoteBackendInDev = String(env.VITE_ALLOW_REMOTE_BACKEND_IN_DEV || '').toLowerCase() === 'true'

  const isLocalBackendUrl = (value: string): boolean => {
    if (!value) return false
    try {
      const parsed = new URL(value)
      const host = parsed.hostname.toLowerCase()
      return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')
    } catch {
      return false
    }
  }

  const devProxyTarget =
    configuredBackendUrl && (isLocalBackendUrl(configuredBackendUrl) || allowRemoteBackendInDev)
      ? configuredBackendUrl
      : 'http://localhost:3001'

  return {
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
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
