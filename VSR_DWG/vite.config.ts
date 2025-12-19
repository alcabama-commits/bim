import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true },
  build: {
    outDir: '../docs/VSR_DWG',
    emptyOutDir: true
  }
})
