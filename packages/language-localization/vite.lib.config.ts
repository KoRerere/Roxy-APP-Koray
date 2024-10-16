import { builtinModules } from 'node:module'
// vite.config.js
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  ssr: {},
  build: {
    outDir: 'dist/vite',
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
        'serve-static',
        'glob',
        '@roxy/puppeteer-google-translate',
      ],
    },
  },
  plugins: [dts({ rollupTypes: true })],
})
