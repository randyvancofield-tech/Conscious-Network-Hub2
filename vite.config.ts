import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
    },

    plugins: [react()],

    base: '/',

    // 🔑 CRITICAL FIX:
    // Neutralizes Node-only `process` usage in browser builds
    define: {
      'process.env': {},

      // Explicit Gemini env injection (kept intact)
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }
})
