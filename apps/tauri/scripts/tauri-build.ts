import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { getLauncherVariants, resolveVariantConfigPath } from './launcher-variants.ts'
import { ensureCargoInPath, getDefaultTargetsForHost } from './utils.ts'

const nodeEnv = process.env.NODE_ENV || 'development'
console.log('[tauri-build] NODE_ENV', nodeEnv)

cpSync(join(import.meta.dirname, `../.env.${nodeEnv}`), '.env')

function getTauriIdentifierForEnv(env: string, variant: 'chrome' | 'firefox') {
  const base = env === 'production'
    ? 'com.roxybrowser.browser.launcher'
    : 'com.roxybrowserdev.browser.launcher'
  return variant === 'firefox' ? `${base}.firefox` : base
}

function normalizeSemverFromEnv(raw: string): string {
  const v = raw.trim().replace(/^v/i, '')
  const semverLike = /^\d+\.\d+\.\d+(?:-[0-9A-Z.-]+)?(?:\+[0-9A-Z.-]+)?$/i
  if (!semverLike.test(v)) {
    throw new Error(`[tauri-build] VITE_VERSION 不是合法 semver：${raw}（期望类似 1.2.3 或 1.2.3-beta.1）`)
  }
  return v
}

function syncTauriConfFile(
  relativePath: string,
  version: string,
  identifier: string,
) {
  const tauriConfPath = join(import.meta.dirname, '../src-tauri', relativePath)
  if (!existsSync(tauriConfPath))
    return

  const tauriConfRaw = readFileSync(tauriConfPath, 'utf8')
  const tauriConf = JSON.parse(tauriConfRaw) as Record<string, any>
  let changed = false
  if (tauriConf.version !== version) {
    tauriConf.version = version
    changed = true
  }
  if (tauriConf.identifier !== identifier) {
    tauriConf.identifier = identifier
    changed = true
  }
  if (changed) {
    writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8')
    console.log(`[tauri-build] 已同步 ${relativePath} version=${version} identifier=${identifier}`)
  }
}

function syncTauriVersionFromViteVersion() {
  const raw = process.env.VITE_VERSION
  if (!raw)
    return

  const version = normalizeSemverFromEnv(raw)
  syncTauriConfFile('tauri.conf.json', version, getTauriIdentifierForEnv(nodeEnv, 'chrome'))
  syncTauriConfFile('tauri.firefox.conf.json', version, getTauriIdentifierForEnv(nodeEnv, 'firefox'))

  const cargoTomlPath = join(import.meta.dirname, '../src-tauri/Cargo.toml')
  const cargoRaw = readFileSync(cargoTomlPath, 'utf8')
  const versionLineRe = /^version\s*=\s*"[^"]*"/m
  if (!versionLineRe.test(cargoRaw)) {
    console.warn('[tauri-build] 未能在 Cargo.toml 中定位 version 行，已跳过同步')
  }
  else {
    const replaced = cargoRaw.replace(versionLineRe, `version = "${version}"`)
    if (replaced !== cargoRaw) {
      writeFileSync(cargoTomlPath, replaced, 'utf8')
      console.log('[tauri-build] 已同步 Cargo.toml package.version =', version)
    }
  }
}

syncTauriVersionFromViteVersion()

const launcherVariants = getLauncherVariants()
console.log('[tauri-build] 将构建启动器变体:', launcherVariants.map(v => v.appName).join(', '))

function findFirstAppImageFile(dir: string) {
  try {
    const files = readdirSync(dir)
      .filter(f => /\.appimage$/i.test(f))
      .filter(f => !/\.(zsync|sig)$/i.test(f))
      .sort((a, b) => a.localeCompare(b))
    return files[0]
  }
  catch {
    return undefined
  }
}

function renameLinuxAppImage(options: { target?: string, appName: string }) {
  if (process.platform !== 'linux')
    return

  const desiredFileName = `${options.appName}.AppImage`

  const tryDirs: string[] = []
  if (options.target) {
    tryDirs.push(join(import.meta.dirname, '../src-tauri/target', options.target, 'release', 'bundle', 'appimage'))
  }
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
  const out: string[] = []
  for (let i = 0; i < positionals.length; i++) {
    const cur = positionals[i]
    if (cur === '--target' || cur === '-t') {
      i++
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
  'skip-notarize': {
    type: 'boolean',
    default: false,
  },
  'adhoc': {
    type: 'boolean',
    default: false,
  },
  'targets': {
    type: 'string',
  },
  'all-targets': {
    type: 'boolean',
    default: true,
  },
} as const

const parsed = parseArgs({
  options,
  allowPositionals: true,
  strict: false,
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

const childEnvBase: NodeJS.ProcessEnv = ensureCargoInPath({ ...process.env, NODE_ENV: nodeEnv })

const cargoBin = join(process.env.USERPROFILE || process.env.HOME || '', '.cargo', 'bin')
if (!existsSync(join(cargoBin, process.platform === 'win32' ? 'cargo.exe' : 'cargo'))) {
  console.error(
    '[tauri-build] 未找到 cargo。请先安装 Rust：https://rustup.rs/\n'
    + '  Windows 安装后请重启终端，或确保 %USERPROFILE%\\.cargo\\bin 在 PATH 中。',
  )
  process.exit(1)
}

if (forceAdhoc) {
  delete childEnvBase.APPLE_SIGNING_IDENTITY
  console.log('[tauri-build] 已开启 --adhoc（忽略 APPLE_SIGNING_IDENTITY，使用配置里的 ad-hoc 签名）')
}

if (skipNotarize) {
  delete childEnvBase.APPLE_ID
  delete childEnvBase.APPLE_PASSWORD
  delete childEnvBase.APPLE_TEAM_ID
  delete childEnvBase.APPLE_API_ISSUER
  delete childEnvBase.APPLE_API_KEY
  delete childEnvBase.APPLE_API_KEY_PATH
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

function runTauriBuildForVariant(options: {
  variant: (typeof launcherVariants)[number]
  target?: string
}) {
  const { variant, target } = options
  const configPath = resolveVariantConfigPath(variant.configFile)
  const tauriArgs = [
    ...baseTauriArgs,
    ...(configPath ? ['--config', configPath] : []),
    ...(target ? ['--target', target] : []),
    ...extraArgs,
  ]

  const childEnv: NodeJS.ProcessEnv = {
    ...childEnvBase,
    ROXY_DEFAULT_BROWSER_APP_NAME: variant.appName,
  }

  const label = target
    ? `variant=${variant.id} target=${target}`
    : `variant=${variant.id}`

  console.log(`[tauri-build] 开始构建 ${label} (appName=${variant.appName})`)
  const result = spawnSync('pnpm', tauriArgs, {
    stdio: 'inherit',
    env: childEnv,
  })
  if (result.status !== 0) {
    console.error(`[tauri-build] ${label} 打包失败`)
    process.exit(1)
  }

  renameLinuxAppImage({ target, appName: variant.appName })
}

const buildTargets = targetsToBuild.length > 0 ? targetsToBuild : [undefined]

for (const target of buildTargets) {
  if (target && targetsToBuild.length > 0) {
    console.log(`[tauri-build] ===== target=${target} =====`)
  }

  for (const variant of launcherVariants) {
    runTauriBuildForVariant({ variant, target })
  }
}

if (targetsToBuild.length > 0) {
  console.log('[tauri-build] 全部 targets 与变体构建完成:', targetsToBuild.join(', '))
}
else {
  console.log('[tauri-build] 全部变体构建完成')
}
