import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/finance-ai-dashbaord/',
  plugins: [react()],
  server: {
    proxy: {
      // Proxy backend API calls to Express server
      '/convert-token': 'http://localhost:5055',
      '/mcp': 'http://localhost:5055',
      '/crypto-price': 'http://localhost:5050',
      '/crypto-history': 'http://localhost:5050',
      '/yahoo': 'http://localhost:5050',
      '/yahoo/stock-price': 'http://localhost:5050',
      '/yahoo/stock-history': 'http://localhost:5050',
      '/delta': 'http://localhost:5050',
      '/delta/auth-url': 'http://localhost:5050',
      '/delta/callback': 'http://localhost:5050'
    }
  }
})
