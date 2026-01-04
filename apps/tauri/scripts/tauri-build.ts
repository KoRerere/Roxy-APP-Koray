import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { getDefaultTargetsForHost } from './utils.ts'

const nodeEnv = process.env.NODE_ENV || 'development'
console.log('[tauri-build] NODE_ENV', nodeEnv)

cpSync(join(import.meta.dirname, `../.env.${nodeEnv}`), '.env')

function getTauriIdentifierForEnv(env: string) {
  // 约定：
  // - 测试/开发环境：com.roxybrowserdev.browser.launcher
  // - 生产环境：com.roxybrowser.browser.launcher
  return env === 'production'
    ? 'com.roxybrowser.browser.launcher'
    : 'com.roxybrowserdev.browser.launcher'
}

function normalizeSemverFromEnv(raw: string): string {
  const v = raw.trim().replace(/^v/i, '')
  const semverLike = /^\d+\.\d+\.\d+(?:-[0-9A-Z.-]+)?(?:\+[0-9A-Z.-]+)?$/i
  if (!semverLike.test(v)) {
    throw new Error(`[tauri-build] VITE_VERSION 不是合法 semver：${raw}（期望类似 1.2.3 或 1.2.3-beta.1）`)
  }
  return v
}

function syncTauriVersionFromViteVersion() {
  const raw = process.env.VITE_VERSION
  if (!raw)
    return

  const version = normalizeSemverFromEnv(raw)
  const identifier = getTauriIdentifierForEnv(nodeEnv)

  // 1) tauri.conf.json
  const tauriConfPath = join(import.meta.dirname, '../src-tauri/tauri.conf.json')
  const tauriConfRaw = readFileSync(tauriConfPath, 'utf8')
  const tauriConf = JSON.parse(tauriConfRaw) as Record<string, any>
  let tauriConfChanged = false
  if (tauriConf.version !== version) {
    tauriConf.version = version
    tauriConfChanged = true
    console.log('[tauri-build] 已同步 tauri.conf.json version =', version)
  }
  if (tauriConf.identifier !== identifier) {
    tauriConf.identifier = identifier
    tauriConfChanged = true
    console.log('[tauri-build] 已同步 tauri.conf.json identifier =', identifier)
  }
  if (tauriConfChanged)
    writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8')

  // 2) Cargo.toml（仅替换 [package] 下的 version 行）
  const cargoTomlPath = join(import.meta.dirname, '../src-tauri/Cargo.toml')
  const cargoRaw = readFileSync(cargoTomlPath, 'utf8')
  const replaced = cargoRaw.replace(
    /(\[package\][\s\S]*?^version\s*=\s*")[^"]*(")/m,
    `$1${version}$2`,
  )
  if (replaced !== cargoRaw) {
    writeFileSync(cargoTomlPath, replaced, 'utf8')
    console.log('[tauri-build] 已同步 Cargo.toml package.version =', version)
  }
  else {
    console.warn('[tauri-build] 未能在 Cargo.toml 的 [package] 段落中定位 version 行，已跳过同步')
  }
}

// 构建前同步版本号（可选）：VITE_VERSION -> tauri.conf.json + Cargo.toml
syncTauriVersionFromViteVersion()

function getBundleAppName() {
  const fromEnv = process.env.ROXY_DEFAULT_BROWSER_APP_NAME?.trim()
  if (fromEnv)
    return fromEnv
  try {
    const tauriConfPath = join(import.meta.dirname, '../src-tauri/tauri.conf.json')
    const raw = readFileSync(tauriConfPath, 'utf8')
    const conf = JSON.parse(raw) as Record<string, any>
    const productName = String(conf.productName || '').trim()
    if (productName)
      return productName
  }
  catch {}
  return 'RoxyChrome'
}

function findFirstAppImageFile(dir: string) {
  try {
    const files = readdirSync(dir)
      .filter(f => /\.appimage$/i.test(f))
      // ignore signature/zsync files if any
      .filter(f => !/\.(zsync|sig)$/i.test(f))
      .sort((a, b) => a.localeCompare(b))
    return files[0]
  }
  catch {
    return undefined
  }
}

function renameLinuxAppImage(options: { target?: string }) {
  if (process.platform !== 'linux')
    return

  const appName = getBundleAppName()
  const desiredFileName = `${appName}.AppImage`

  const tryDirs: string[] = []
  if (options.target) {
    tryDirs.push(join(import.meta.dirname, '../src-tauri/target', options.target, 'release', 'bundle', 'appimage'))
  }
  // when building without --target, tauri outputs to target/release
  tryDirs.push(join(import.meta.dirname, '../src-tauri/target', 'release', 'bundle', 'appimage'))

  for (const dir of tryDirs) {
    const srcFileName = findFirstAppImageFile(dir)
    if (!srcFileName)
      continue

    const srcPath = join(dir, srcFileName)
    const destPath = join(dir, desiredFileName)

    if (srcPath === destPath)
      return

    try {
      if (existsSync(destPath))
        rmSync(destPath, { force: true })
      renameSync(srcPath, destPath)
      console.log('[tauri-build] 已重命名 AppImage:', srcFileName, '->', desiredFileName)
      return
    }
    catch (e) {
      console.warn('[tauri-build] 重命名 AppImage 失败（已忽略）:', dir, e)
      return
    }
  }
}

function parseTargets(input: string | undefined): string[] {
  if (!input)
    return []
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function stripTargetArgs(positionals: string[]): string[] {
  // 当我们用 --targets/--all-targets 控制多 target 时，避免把外部的 --target 再透传给 tauri，导致冲突
  const out: string[] = []
  for (let i = 0; i < positionals.length; i++) {
    const cur = positionals[i]
    if (cur === '--target' || cur === '-t') {
      i++ // skip value
      continue
    }
    if (cur.startsWith('--target=')) {
      continue
    }
    out.push(cur)
  }
  return out
}

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
  /**
   * 指定 Rust targets（逗号分隔）
   * - macOS: aarch64-apple-darwin,x86_64-apple-darwin
   * - Windows: x86_64-pc-windows-msvc,i686-pc-windows-msvc
   * - Linux(AppImage): x86_64-unknown-linux-gnu
   */
  'targets': {
    type: 'string',
  },
  /** 一键构建当前平台的默认 targets（mac 双架构 / win 双架构 / linux x86_64） */
  'all-targets': {
    type: 'boolean',
    default: true,
  },
} as const

const parsed = parseArgs({
  options,
  allowPositionals: true,
  strict: false, // 默认 true，遇到未知参数会报错
})
const args = parsed.values
const positionals = parsed.positionals

console.log('[tauri-build] args', args, 'positionals', positionals)

const skipNotarize = args['skip-notarize'] === true
const forceAdhoc = args.adhoc === true
const targets = parseTargets(typeof args.targets === 'string' ? args.targets : undefined)
const useAllTargets = args['all-targets'] === true
const defaultTargets = getDefaultTargetsForHost()
const targetsToBuild = targets.length > 0
  ? targets
  : (useAllTargets ? defaultTargets : [])

const childEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: nodeEnv }

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

function getPlatformBundleArgs(): string[] {
  if (process.platform === 'darwin')
    return ['--bundles', 'app']
  if (process.platform === 'win32')
    return ['--no-bundle']
  if (process.platform === 'linux')
    return ['--bundles', 'appimage']
  return []
}

const baseTauriArgs = [
  'tauri',
  'build',
  ...getPlatformBundleArgs(),
]

const extraArgs = targetsToBuild.length > 0 ? stripTargetArgs(positionals) : positionals

if (targetsToBuild.length === 0) {
  // 兼容旧行为：不指定 --target，按当前 Rust toolchain 的默认 target 打一次
  const result = spawnSync('pnpm', [...baseTauriArgs, ...extraArgs], {
    stdio: 'inherit',
    env: childEnv,
  })
  if (result.status !== 0) {
    console.error('[tauri-build] 打包失败')
    process.exit(1)
  }

  renameLinuxAppImage({})
}
else {
  console.log('[tauri-build] 将按 targets 依次构建:', targetsToBuild.join(', '))
  if (useAllTargets && defaultTargets.length > 0)
    console.log('[tauri-build]（提示）默认 targets:', defaultTargets.join(', '))

  for (const target of targetsToBuild) {
    console.log(`[tauri-build] 开始构建 target=${target}`)
    const result = spawnSync('pnpm', [...baseTauriArgs, '--target', target, ...extraArgs], {
      stdio: 'inherit',
      env: childEnv,
    })
    if (result.status !== 0) {
      console.error(`[tauri-build] target=${target} 打包失败`)
      process.exit(1)
    }

    renameLinuxAppImage({ target })
  }
}
