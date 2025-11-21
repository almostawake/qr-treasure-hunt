import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ command }) => ({
  plugins: [react(), svgr(), mkcert()],
  server: {
    host: '0.0.0.0',
    https: true,
  },
  define: {
    __IS_DEV__: JSON.stringify(command === 'serve'),
  },
}))
