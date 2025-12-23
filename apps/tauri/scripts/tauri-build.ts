import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const options = {
  /** 是否跳过公证 */
  'skip-notarize': {
    type: 'boolean',
    default: false,
  },
  /** 是否强制走 ad-hoc 签名 */
  'adhoc': {
    type: 'boolean',
    default: false,
  },
} as const

const args = parseArgs({
  options,
  strict: false, // 默认 true，遇到未知参数会报错
}).values

console.log('args', args)

const skipNotarize = args['skip-notarize']
const forceAdhoc = args.adhoc

const childEnv = { ...process.env }

if (forceAdhoc) {
  // 强制走 tauri.conf.json 里配置的 signingIdentity（默认我们设为 "-"）
  delete childEnv.APPLE_SIGNING_IDENTITY
  console.log('[tauri-build] 已开启 --adhoc（忽略 APPLE_SIGNING_IDENTITY，使用配置里的 ad-hoc 签名）')
}

if (skipNotarize) {
  // 只签名不公证：保留 APPLE_SIGNING_IDENTITY，移除 notarize 相关变量
  delete childEnv.APPLE_ID
  delete childEnv.APPLE_PASSWORD
  delete childEnv.APPLE_TEAM_ID
  delete childEnv.APPLE_API_ISSUER
  delete childEnv.APPLE_API_KEY
  delete childEnv.APPLE_API_KEY_PATH
  console.log('[tauri-build] 已开启 --skip-notarize（只签名，不触发公证）')
}

const tauriArgs = [
  'tauri',
  'build',
]

if (process.platform === 'darwin') {
  tauriArgs.push('--bundles', 'app')
}
else if (process.platform === 'win32') {
  tauriArgs.push('--no-bundle')
}
else if (process.platform === 'linux') {
  tauriArgs.push('--bundles', 'appimage')
}

const result = spawnSync('pnpm', tauriArgs, {
  stdio: 'inherit',
  env: childEnv,
})

if (result.status !== 0) {
  console.error('[tauri-build] 打包失败')
  process.exit(1)
}
