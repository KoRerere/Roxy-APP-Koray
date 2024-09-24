import { builtinModules } from 'node:module'
// vite.config.js
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        ...builtinModules.map(m => `node:${m}`),
        'body-parser',
        'formidable',
        'adm-zip',
      ],
    },
  },
  plugins: [dts({ rollupTypes: true })],
})
