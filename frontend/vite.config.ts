import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors the nginx reverse-proxy setup used in prod/docker-compose,
    // so `npm run dev` also works with the API client's relative default
    // (VITE_API_BASE_URL unset) without needing the backend's own CORS.
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
