import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The JWC backend serves the API on http://localhost:8080 with no CORS headers,
// so instead of calling it cross-origin we proxy `/api/*` through the Vite dev
// server and strip the `/api` prefix. The browser only ever talks same-origin.
// Override the backend URL with VITE_API_TARGET if it runs elsewhere.
const target = process.env.VITE_API_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
