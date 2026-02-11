import type { UserConfig } from 'vite'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { node } from './.electron-vendors.cache.json'

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
      external: ['@roxy/diskspace-native'],
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [
    {
      name: 'post-build',
      closeBundle() {
        // 这里就是“打包结束后”
        const marker = join(PACKAGE_ROOT, 'dist-vite')
        writeFile(join(marker, 'agent.cjs'), `process.on('uncaughtException', err => process.parentPort.postMessage(err));
process.on('unhandledRejection', err => process.parentPort.postMessage(err)); require("bytenode"); require(process.env.BYTENODE_SCRIPT);`, 'utf8')
        // console.log("[post-build] build done:", marker);
      },
    },
  ],
}

export default config
