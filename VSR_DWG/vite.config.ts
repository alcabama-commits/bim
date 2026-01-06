import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      three: resolve(__dirname, 'node_modules/three')
    }
  },
  server: { host: true },
  build: {
    outDir: '../docs/VSR_DWG',
    emptyOutDir: true
  }
})
