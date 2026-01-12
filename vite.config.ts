import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

import Components from 'unplugin-vue-components/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss(), Components({})],
  base: '/flux-pdf/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    deps: {
      optimizer: {
        client: {
          include: ['pdfjs-dist'],
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
})
