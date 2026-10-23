import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('src/data/ingredientImages') ||
            id.includes('src/utils/ingredientImageHelper') ||
            id.includes('src/assets/images/pantry-images')
          ) {
            return 'vendor-ingredients';
          }
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('react-hot-toast')) {
              return 'vendor-ui';
            }
            if (
              id.includes('socket.io-client') ||
              id.includes('engine.io-client') ||
              id.includes('@react-oauth/google')
            ) {
              return 'vendor-network';
            }
          }
        }
      }
    }
  }
})
