import type { UserConfig } from 'vite'
import { join } from 'node:path'
import { node } from './.electron-vendors.cache.json'

const PACKAGE_ROOT = import.meta.dirname
const OPTIONAL_NATIVE_EXTERNALS = [
  // ws probes these at runtime via optional requires inside @roxy/playwright.
  'bufferutil',
  'utf-8-validate',
  'fsevents',
  // systeminformation probes these only on darwin.
  'osx-temperature-sensor',
  'macos-temperature-sensor',
]
const ELECTRON_EXTERNALS = ['electron', 'electron/index.js']

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
    target: `node${node}`,
    outDir: 'dist-vite',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: {
        index: join(PACKAGE_ROOT, 'src/index.ts'),
        openapiMcp: join(PACKAGE_ROOT, 'src/modules/mcp/openapi-mcp/index.ts'),
        playwrightMcp: join(PACKAGE_ROOT, 'src/modules/mcp/playwright-mcp/index.ts'),
        agent: join(PACKAGE_ROOT, 'src/modules/mcp/agent/index.ts'),
        // logWorker: join(PACKAGE_ROOT, 'src/workers/log/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@roxy/diskspace-native', ...ELECTRON_EXTERNALS, ...OPTIONAL_NATIVE_EXTERNALS],
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [
  ],
}

export default config
