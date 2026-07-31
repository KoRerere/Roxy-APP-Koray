/**
 * 跨平台打包延迟启动器。
 *
 * 用法：
 *   pnpm build:delay-launcher
 *   node tools/delay-launcher/build.mjs --delays=10,35,50,70
 *   node tools/delay-launcher/build.mjs --targets=win-x64
 *   node tools/delay-launcher/build.mjs --targets=win-x64,macos-arm64,macos-x64,linux-x64
 *
 * 产出目录：tools/delay-launcher/dist/
 *
 * Windows 安装到内核目录：
 *   1. 退出 Roxy，关闭所有相关窗口
 *   2. chrome-bin/<version>/ 下：RoxyChrome.exe → 改名为 RoxyChrome_real.exe
 *   3. 复制 dist/win-x64/RoxyChrome_delay_35s.exe 到同目录，改名为 RoxyChrome.exe
 *   4. 启动窗口验证；测完后还原 real → RoxyChrome.exe
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const DEFAULT_DELAYS = [10, 35, 50, 70]

/** pkg target 映射 */
const TARGET_MAP = {
  'win-x64': { pkg: 'node22-win-x64', outDir: 'win-x64', ext: '.exe', prefix: 'RoxyChrome_delay_' },
  'macos-x64': { pkg: 'node22-macos-x64', outDir: 'macos-x64', ext: '', prefix: 'RoxyChrome_delay_' },
  'macos-arm64': { pkg: 'node22-macos-arm64', outDir: 'macos-arm64', ext: '', prefix: 'RoxyChrome_delay_' },
  'linux-x64': { pkg: 'node22-linux-x64', outDir: 'linux-x64', ext: '', prefix: 'RoxyChrome_delay_' },
}

function parseArgs(argv) {
  const opts = {
    delays: DEFAULT_DELAYS,
    targets: null,
    help: false,
  }
  for (const arg of argv) {
    if (arg.startsWith('--delays=')) {
      opts.delays = arg.slice('--delays='.length).split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0)
    }
    else if (arg.startsWith('--targets=')) {
      opts.targets = arg.slice('--targets='.length).split(',').map(s => s.trim()).filter(Boolean)
    }
    else if (arg === '--help' || arg === '-h') {
      opts.help = true
    }
  }
  return opts
}

function defaultTargetsForHost() {
  if (process.platform === 'win32') {
    return ['win-x64']
  }
  if (process.platform === 'darwin') {
    return [process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64']
  }
  return ['linux-x64']
}

/** 不使用 shell，避免 Windows 下「C:\Program Files\...」被空格拆开 */
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
      }
    })
  })
}

function resolvePkgBin() {
  const candidates = [
    () => require.resolve('@yao-pkg/pkg/package.json', { paths: [__dirname, join(__dirname, '../..')] }),
  ]
  for (const get of candidates) {
    try {
      const pkgJsonPath = get()
      const pkgJson = require(pkgJsonPath)
      const binRel = typeof pkgJson.bin === 'string' ? pkgJson.bin : pkgJson.bin?.pkg
      if (!binRel) {
        continue
      }
      return join(dirname(pkgJsonPath), binRel)
    }
    catch {
      // try next
    }
  }
  return null
}

async function ensurePkgBin() {
  const existing = resolvePkgBin()
  if (existing) {
    return existing
  }

  console.log('[delay-launcher] installing @yao-pkg/pkg into tools/delay-launcher (ignore-workspace)…')
  await run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--no-package-lock', '--ignore-scripts', '@yao-pkg/pkg@6'],
    __dirname,
  )

  const bin = resolvePkgBin()
  if (!bin) {
    throw new Error('Failed to resolve @yao-pkg/pkg after install')
  }
  return bin
}

async function writeVariantSource(delaySeconds, outFile) {
  const template = await readFile(join(__dirname, 'launcher.mjs'), 'utf8')
  const source = template.replace(
    /const DEFAULT_DELAY_SECONDS = \d+/,
    `const DEFAULT_DELAY_SECONDS = ${delaySeconds}`,
  )
  await writeFile(outFile, source, 'utf8')
}

async function buildOne({ pkgBin, targetKey, delaySeconds }) {
  const target = TARGET_MAP[targetKey]
  if (!target) {
    throw new Error(`Unknown target: ${targetKey}. Supported: ${Object.keys(TARGET_MAP).join(', ')}`)
  }

  const stagingDir = join(__dirname, '.staging')
  const distDir = join(__dirname, 'dist', target.outDir)
  await mkdir(stagingDir, { recursive: true })
  await mkdir(distDir, { recursive: true })

  const entryPath = join(stagingDir, `launcher_${delaySeconds}s.mjs`)
  await writeVariantSource(delaySeconds, entryPath)

  const outName = `${target.prefix}${delaySeconds}s${target.ext}`
  const outPath = join(distDir, outName)

  console.log(`[delay-launcher] building ${targetKey} delay=${delaySeconds}s → ${outName}`)
  await run(process.execPath, [
    pkgBin,
    entryPath,
    '--target',
    target.pkg,
    '--output',
    outPath,
    '--compress',
    'GZip',
  ], __dirname)

  return outPath
}

async function writeInstallHint(distRoot, delays, targets) {
  const lines = [
    'Delay launcher build output',
    '',
    'Windows quick install (recommended):',
    '  # list cores in DEV/TEST app (RoxyBrowserDev)',
    '  powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -List',
    '',
    '  # install 35s delay into DEV Chrome 150',
    '  powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Delay 35',
    '',
    '  # install into PROD (RoxyBrowser)',
    '  powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv prod -CoreVersion 150 -Delay 35',
    '',
    '  # restore',
    '  powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Restore',
    '',
    'Notes:',
    '  - After first delayed launch, real exe is auto-restored (one-shot)',
    '  - Re-test requires running install-win.ps1 again',
    '',
    'Env mapping:',
    '  -AppEnv dev|test  -> %APPDATA%\\RoxyBrowserDev\\chrome-bin\\<version>',
    '  -AppEnv prod      -> %APPDATA%\\RoxyBrowser\\chrome-bin\\<version>',
    '  (-Env is an alias of -AppEnv)',
    '',
    'Manual steps:',
    '  1. Quit the matching app (Dev or Prod) and close profile windows',
    '  2. In chrome-bin/<version>/ rename RoxyChrome.exe -> RoxyChrome_real.exe',
    '  3. Copy one built file as RoxyChrome.exe into that folder',
    '  4. Launch a window that uses this core; restore when done',
    '',
    'macOS note:',
    '  Replace Contents/MacOS/RoxyChrome similarly with RoxyChrome_real + delay binary.',
    '',
    'Delay tiers (relative to ~30s Chrome launch timeout):',
    '  10s  - usually succeeds',
    '  35s  - around / past launch timeout',
    '  50s  - usually times out',
    '  70s  - times out',
    '',
    `Built delays: ${delays.join(', ')}s`,
    `Built targets: ${targets.join(', ')}`,
    '',
  ]
  await writeFile(join(distRoot, 'INSTALL.txt'), lines.join('\n'), 'utf8')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log('Usage: node tools/delay-launcher/build.mjs [--delays=10,35,50,70] [--targets=win-x64,macos-arm64,…]')
    return
  }
  if (!opts.delays.length) {
    throw new Error('No valid --delays provided')
  }

  const targets = opts.targets?.length ? opts.targets : defaultTargetsForHost()
  const pkgBin = await ensurePkgBin()

  await rm(join(__dirname, '.staging'), { recursive: true, force: true })

  const built = []
  for (const targetKey of targets) {
    for (const delay of opts.delays) {
      const outPath = await buildOne({ pkgBin, targetKey, delaySeconds: delay })
      built.push(outPath)
    }
  }

  await writeInstallHint(join(__dirname, 'dist'), opts.delays, targets)
  await rm(join(__dirname, '.staging'), { recursive: true, force: true })

  console.log('\n[delay-launcher] done:')
  for (const path of built) {
    console.log(`  - ${path}`)
  }
  console.log(`\nSee ${join(__dirname, 'dist', 'INSTALL.txt')}`)
}

main().catch((error) => {
  console.error('[delay-launcher] build failed:', error)
  process.exit(1)
})
