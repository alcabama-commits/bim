import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative paths for GitHub Pages
  build: {
    outDir: '../docs/VSR_IFC', // Deploys to docs/VSR_IFC for GitHub Pages
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    open: true
  }
});
