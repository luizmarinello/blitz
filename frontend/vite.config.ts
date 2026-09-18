import { defineConfig } from 'vite';

// Build vai direto para o classpath do Spring: uma origem só, um deploy só.
export default defineConfig({
  build: {
    outDir: '../backend/src/main/resources/static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
});
