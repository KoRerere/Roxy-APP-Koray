import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const wasmArtifact = join(root, 'pkg/roxy_crypto_wasm_bg.wasm')
const wasmDir = join(root, 'wasm')
const wasmOnly = process.argv.includes('--wasm-only')
const cargoBin = join(homedir(), '.cargo', 'bin')
const pathEnvKey = process.platform === 'win32' ? 'Path' : 'PATH'

function cargoBinExe(name) {
  const file = process.platform === 'win32' ? `${name}.exe` : name
  return join(cargoBin, file)
}

function withCargoBinPath() {
  const currentPath = process.env[pathEnvKey] || ''
  const alreadyIncluded = currentPath
    .split(delimiter)
    .some(entry => entry.toLowerCase() === cargoBin.toLowerCase())

  if (alreadyIncluded) {
    return process.env
  }

  return {
    ...process.env,
    [pathEnvKey]: `${cargoBin}${delimiter}${currentPath}`,
  }
}

function resolveTool(name) {
  const candidate = cargoBinExe(name)
  if (existsSync(candidate)) {
    return candidate
  }

  const fromPath = spawnSync(name, ['--version'], { shell: true, stdio: 'ignore' })
  return fromPath.status === 0 ? name : null
}

function resolveWasmPack() {
  if (process.env.WASM_PACK && existsSync(process.env.WASM_PACK)) {
    return process.env.WASM_PACK
  }
  return resolveTool('wasm-pack')
}

function ensureWasmTarget(env) {
  const rustup = resolveTool('rustup')
  if (!rustup) {
    return true
  }

  const list = spawnSync(
    rustup,
    ['target', 'list', '--installed'],
    { env, shell: rustup === 'rustup', encoding: 'utf8' },
  )

  if (list.stdout?.includes('wasm32-unknown-unknown')) {
    return true
  }

  console.log('[roxy-crypto] installing wasm32-unknown-unknown target...')
  const add = spawnSync(
    rustup,
    ['target', 'add', 'wasm32-unknown-unknown'],
    { env, shell: rustup === 'rustup', stdio: 'inherit' },
  )
  return add.status === 0
}

function buildWasm(wasmPack) {
  const env = withCargoBinPath()

  if (!resolveTool('rustc')) {
    console.error(
      '[roxy-crypto] rustc not found. Install Rust from https://rustup.rs and restart the terminal.',
    )
    process.exit(1)
  }

  if (!ensureWasmTarget(env)) {
    console.error('[roxy-crypto] failed to install wasm32-unknown-unknown target')
    process.exit(1)
  }

  console.log('[roxy-crypto] building wasm with wasm-pack...')
  const result = spawnSync(
    wasmPack,
    ['build', '--target', 'web', '--out-dir', '../pkg', '--release'],
    {
      cwd: wasmDir,
      shell: wasmPack === 'wasm-pack',
      env,
      stdio: 'inherit',
    },
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  // wasm-pack 会生成 pkg/.gitignore(*)，导致产物无法提交
  const pkgGitignore = join(root, 'pkg/.gitignore')
  if (existsSync(pkgGitignore)) {
    unlinkSync(pkgGitignore)
  }
}

function buildVite() {
  console.log('[roxy-crypto] building ts wrapper with vite...')
  const viteBin = join(root, '../../node_modules/vite/bin/vite.js')
  const result = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const shouldBuildWasm = process.env.FORCE_WASM_REBUILD === '1' || !existsSync(wasmArtifact)

if (shouldBuildWasm) {
  const wasmPack = resolveWasmPack()
  if (!wasmPack) {
    console.error(
      '[roxy-crypto] wasm-pack not found. Install Rust toolchain and run:\n'
      + '  rustup target add wasm32-unknown-unknown\n'
      + '  cargo install wasm-pack\n'
      + 'Then ensure %USERPROFILE%\\.cargo\\bin is in PATH, or set WASM_PACK to the executable path.',
    )
    process.exit(1)
  }
  buildWasm(wasmPack)
}
else {
  console.log('[roxy-crypto] using committed wasm artifacts in pkg/, skip wasm-pack')
}

if (!wasmOnly) {
  buildVite()
}
