import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy backend API calls to Express server
      '/convert-token': 'http://localhost:5055',
      '/mcp': 'http://localhost:5055'
    }
  }
})
