import type { UserConfig } from 'vite'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import dts from 'unplugin-dts/vite'
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
      formats: ['es'],
    },
    rollupOptions: {
      external: [...builtinModules, 'electron'],
      output: {
        // ESM preload scripts must have the .mjs extension
        // https://www.electronjs.org/docs/latest/tutorial/esm#esm-preload-scripts-must-have-the-mjs-extension
        entryFileNames: '[name].mjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },

  // 开发态直接使用源码类型；仅在构建产物时生成声明，避免启动时遍历主进程的类型依赖。
  plugins: process.env.MODE === 'development'
    ? []
    : [dts({
        tsconfigPath: join(PACKAGE_ROOT, 'tsconfig.build.json'),
        rollupTypes: true,
        entryRoot: join(PACKAGE_ROOT, 'src'),
        clearPureImport: false,
        logLevel: 'silent',
      })],
}

export default config
