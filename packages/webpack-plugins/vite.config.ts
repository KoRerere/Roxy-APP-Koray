import { builtinModules } from 'node:module'
// vite.config.js
import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'
import { dependencies } from './package.json'

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
        ...Object.keys(dependencies),
      ],
    },
  },
  plugins: [dts({ rollupTypes: true, entryRoot: resolve(__dirname, 'src') })],
})
