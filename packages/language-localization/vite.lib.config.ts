import { builtinModules } from 'node:module'
// vite.config.js
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  ssr: {},
  build: {
    outDir: 'dist',
    lib: {
      // entry: [resolve(__dirname, 'src/index.ts'), resolve(__dirname, 'src/bin/index.ts')],
      entry: {
        'vite/index': resolve(__dirname, 'src/index.ts'),
        'bin/index': resolve(__dirname, 'src/bin/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        ...builtinModules.map(m => `node:${m}`),
        'body-parser',
        'formidable',
        'serve-static',
        'glob',
        'p-limit',
        '@roxy/puppeteer-google-translate',
      ],
    },
  },
  plugins: [dts({ rollupTypes: true })],
})
