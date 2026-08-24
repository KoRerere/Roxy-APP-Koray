import type { UserConfig } from 'vite'
import { createSystemSkillsBundlePlugin } from '@roxy/vite-plugins'
import { join } from 'node:path'
// import { node } from './.electron-vendors.cache.json'

const PACKAGE_ROOT = import.meta.dirname

const config: UserConfig = {
  envDir: PACKAGE_ROOT,
  root: PACKAGE_ROOT,
  resolve: {
    alias: {
      '@': join(PACKAGE_ROOT, 'src'),
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
      external: ['electron'],
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [
    createSystemSkillsBundlePlugin({
      systemSkillsDir: join(PACKAGE_ROOT, 'src/system-skills'),
    }),
  ],
}

export default config
