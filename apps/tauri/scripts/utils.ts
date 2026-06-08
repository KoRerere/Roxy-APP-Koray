import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 确保子进程能找到 cargo（Windows 上 rustup 常装在 ~/.cargo/bin 但未写入 PATH）
 */
export function ensureCargoInPath(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const cargoBin = join(homedir(), '.cargo', 'bin')
  const cargoExe = join(cargoBin, process.platform === 'win32' ? 'cargo.exe' : 'cargo')
  if (!existsSync(cargoExe))
    return env

  const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') ?? 'Path'
  const current = env[pathKey] ?? ''
  const sep = process.platform === 'win32' ? ';' : ':'
  const normalizedCargo = cargoBin.toLowerCase()
  const already = current.split(sep).some((p) => {
    const part = p.trim().toLowerCase()
    return part === normalizedCargo || part === `${normalizedCargo}\\`
  })
  if (already)
    return env

  return { ...env, [pathKey]: `${cargoBin}${sep}${current}` }
}

export function getDefaultTargetsForHost(): string[] {
  if (process.platform === 'darwin')
    return ['aarch64-apple-darwin', 'x86_64-apple-darwin']
  if (process.platform === 'win32')
    return ['x86_64-pc-windows-msvc', 'i686-pc-windows-msvc']
  if (process.platform === 'linux')
    return ['x86_64-unknown-linux-gnu']
  return []
}
