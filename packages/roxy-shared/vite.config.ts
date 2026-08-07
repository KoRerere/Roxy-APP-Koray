import { builtinModules } from 'node:module'
// vite.config.js
import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'
import { dependencies } from './package.json'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'agent-paths': resolve(__dirname, 'src/agent-paths.ts'),
        channel: resolve(__dirname, 'src/channel/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'js'}`,
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
