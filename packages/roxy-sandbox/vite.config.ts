import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'

// 多子路径入口：每个能力模块（utils / human / llm）单独构建为一个 entry，
// 对应 package.json 的 subpath exports（@roxybrowser/sandbox/utils 等）。
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'utils/index': resolve(__dirname, 'src/utils/index.ts'),
        'human/index': resolve(__dirname, 'src/human/index.ts'),
        'llm/index': resolve(__dirname, 'src/llm/index.ts'),
        'table/index': resolve(__dirname, 'src/table/index.ts'),
        'kv/index': resolve(__dirname, 'src/kv/index.ts'),
        'debug/index': resolve(__dirname, 'src/debug/index.ts'),
        'download/index': resolve(__dirname, 'src/download/index.ts'),
        '2fa/index': resolve(__dirname, 'src/2fa/index.ts'),
      },
      formats: ['es', 'cjs'],
      // vite 传入 format（'es' | 'cjs'）与 entry 名（如 'llm/index'）。
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'js'}`,
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
        'playwright',
      ],
    },
  },
  plugins: [dts({ entryRoot: resolve(__dirname, 'src') })],
})
