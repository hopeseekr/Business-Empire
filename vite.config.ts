import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Subpath on ai.autonomo.codes — must match the live URL path (trailing slash required)
const base = '/business-empire/'

export default defineConfig({
  base,
  plugins: [react()],
  // Static source files (favicon, etc.) — copied into the webroot on build
  publicDir: 'static',
  build: {
    // Match your other sites: public/ is the webroot
    outDir: 'public',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
})
