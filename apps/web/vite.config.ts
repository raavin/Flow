import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@superapp/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@superapp/types': path.resolve(__dirname, '../../packages/types/src'),
    },
  },
})
