import type { UserConfig } from 'vite'
import { join } from 'node:path'
import { builtinModules } from 'node:module'
import dts from 'vite-plugin-dts'
import { chrome } from '../electron/.electron-vendors.cache.json'

const PACKAGE_ROOT = __dirname
const PROJECT_ROOT = join(PACKAGE_ROOT, '../..')

const config: UserConfig = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  resolve: {
    alias: {
      // 强制把子路径解析到具体文件，便于被打包器内联
      '@sentry/electron/preload': join(PACKAGE_ROOT, 'node_modules/@sentry/electron/preload/default.js'),
    },
  },
  build: {
    ssr: true,
    sourcemap: 'inline',
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: ['src/index.ts', 'src/ipcMain.ts'],
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        // ESM preload scripts must have the .mjs extension
        // https://www.electronjs.org/docs/latest/tutorial/esm#esm-preload-scripts-must-have-the-mjs-extension
        entryFileNames: '[name].cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },

  plugins: [dts({
    tsconfigPath: join(PACKAGE_ROOT, 'tsconfig.build.json'),
    rollupTypes: true,
    clearPureImport: false,
    logLevel: 'silent',
  })],
}

export default config
