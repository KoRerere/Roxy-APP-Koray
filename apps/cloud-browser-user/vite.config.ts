import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/assets/styles/_variables.scss" as *;',
      },
    },
  },
  server: {
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
