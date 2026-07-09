import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const wasmJsPath = resolve(__dirname, 'pkg/roxy_crypto_wasm.js')

export default defineConfig({
  resolve: {
    alias: {
      './roxy_crypto_wasm.js': wasmJsPath,
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        ...builtinModules.map(m => `node:${m}`),
        './roxy_crypto_wasm.js',
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    dts({ rollupTypes: true, entryRoot: resolve(__dirname, 'src') }),
    viteStaticCopy({
      targets: [
        { src: 'pkg/roxy_crypto_wasm.js', dest: '.' },
        { src: 'pkg/roxy_crypto_wasm.d.ts', dest: '.' },
        { src: 'pkg/roxy_crypto_wasm_bg.wasm', dest: '.' },
        { src: 'pkg/roxy_crypto_wasm_bg.wasm.d.ts', dest: '.' },
      ],
    }),
  ],
})
