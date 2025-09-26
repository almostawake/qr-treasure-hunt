import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@crm/common': path.resolve(__dirname, '../functions/common/src'),
    },
  },
  optimizeDeps: {
    include: ['@crm/common'],
  },
})
