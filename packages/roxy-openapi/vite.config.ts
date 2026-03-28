import type { UserConfig } from 'vite'
import { join } from 'node:path'

const PACKAGE_ROOT = import.meta.dirname

const config: UserConfig = {
  envDir: PACKAGE_ROOT,
  root: PACKAGE_ROOT,
  resolve: {
    alias: {
      '/@/': `${join(PACKAGE_ROOT, 'src')}/`,
    },
  },
  build: {
    ssr: true,
    sourcemap: false,
    target: 'node22',
    outDir: 'dist-vite',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: {
        index: join(PACKAGE_ROOT, 'src/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // 避免与当前包同名的依赖被解析到自身 dist，导致 runServer 等无法解析
      external: ['@modelcontextprotocol/sdk', '@roxybrowser/openapi'],
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [],
}

export default config
