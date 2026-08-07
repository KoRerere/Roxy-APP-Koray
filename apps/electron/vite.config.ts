import type { UserConfig } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { node } from './.electron-vendors.cache.json'

const PACKAGE_ROOT = import.meta.dirname

// 读取 roxy-agent 的版本号，在构建期内联到 agent 产物（与 packages/roxy-agent webpack DefinePlugin 对称）。
// 本地 dev 的 agent.mjs 由本 vite 配置从 roxy-agent 源码（main: src/index.ts）构建，不经过 webpack，
// 故需在此把版本号注入；config.ts 仍按运行时 ENV_TYPE 选择 DEV / PROD。

function readAgentVersions() {
  const envPath = join(PACKAGE_ROOT, '../../packages/roxy-agent/.env.local')
  const result = { dev: '', prod: '' }
  if (!existsSync(envPath))
    return result
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#'))
      continue
    const eq = line.indexOf('=')
    if (eq === -1)
      continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key === 'AI_AGENT_VERSION_DEV')
      result.dev = val
    else if (key === 'AI_AGENT_VERSION_PROD')
      result.prod = val
  }
  return result
}
const agentVersions = readAgentVersions()
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
const agentEntry = process.env.ROXY_AGENT_ENTRY === 'next'
  ? join(PACKAGE_ROOT, 'src/modules/mcp/agent-next/index.ts')
  : join(PACKAGE_ROOT, 'src/modules/mcp/agent/index.ts')

const config: UserConfig = {
  envDir: PACKAGE_ROOT,
  root: PACKAGE_ROOT,
  // 仅注入版本号，不注入 ENV_TYPE —— ENV_TYPE 由 Electron 运行时注入，用于选择 DEV / PROD。
  define: {
    'process.env.AI_AGENT_VERSION_DEV': JSON.stringify(agentVersions.dev),
    'process.env.AI_AGENT_VERSION_PROD': JSON.stringify(agentVersions.prod),
  },
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
  ],
}

export default config
