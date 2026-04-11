import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Main bundle includes Clerk + maps; warn threshold only (not a build failure)
    chunkSizeWarningLimit: 1600,
  },
  server: {
    // Local dev: browser → same origin (any Vite port) → proxy → FastAPI. Avoids CORS when
    // the dev server is not exactly :5173 or when using another host/port.
    proxy: {
      '/v2': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/zipcodes': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/providers': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/plans': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/hospitals': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
