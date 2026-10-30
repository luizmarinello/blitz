import { defineConfig } from 'vite';

// Build vai para dist/ (Render Static Site). Em dev, /api é proxy para o back local.
export default defineConfig({
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8080' },   // API_PROXY=http://localhost:8090 para outro back
  },
});
