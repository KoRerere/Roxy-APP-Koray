import type { UserConfig } from 'vite'
import { createSystemSkillsBundlePlugin } from '@roxy/vite-plugins'
import { join } from 'node:path'
import { node } from './.electron-vendors.cache.json'

const PACKAGE_ROOT = import.meta.dirname
const OPTIONAL_NATIVE_EXTERNALS = [
  // systeminformation probes these only on darwin.
  'osx-temperature-sensor',
  'macos-temperature-sensor',
]
const ELECTRON_EXTERNALS = ['electron', 'electron/index.js']
const agentEntry = join(PACKAGE_ROOT, 'src/modules/mcp/agent/index.ts')

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
    sourcemap: process.env.MODE === 'development' ? 'inline' : false,
    target: `node${node}`,
    outDir: 'dist-vite',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: {
        index: join(PACKAGE_ROOT, 'src/index.ts'),
        agent: agentEntry,
        browserIconRenderWorker: join(PACKAGE_ROOT, 'src/modules/browserIconRenderWorker/workerProcess.ts'),
        // logWorker: join(PACKAGE_ROOT, 'src/workers/log/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@roxy/diskspace-native', '@roxy/crypto', ...ELECTRON_EXTERNALS, ...OPTIONAL_NATIVE_EXTERNALS],
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
      systemSkillsDir: join(PACKAGE_ROOT, '../../packages/roxy-agent/src/system-skills'),
    }),
  ],
}

export default config
