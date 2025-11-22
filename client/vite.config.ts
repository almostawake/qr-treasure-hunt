import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), svgr()],
  define: {
    __IS_DEV__: JSON.stringify(command === 'serve'),
  },
}))
