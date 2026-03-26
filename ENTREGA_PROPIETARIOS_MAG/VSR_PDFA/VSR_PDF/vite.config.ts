import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../docs/VSR_PDF',
    emptyOutDir: true
  },
  server: {
    host: true
  }
})
