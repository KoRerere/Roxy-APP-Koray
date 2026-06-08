// vite.config.js
import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['axios'],
    },
  },
  plugins: [dts({ rollupTypes: true, entryRoot: resolve(__dirname, 'src') })],
})
