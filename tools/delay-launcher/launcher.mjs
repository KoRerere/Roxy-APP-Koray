/**
 * 一次性冷启动模拟器：延迟 N 秒后还原真内核并拉起，后续启动不再延迟。
 *
 * 真实内核约定（同目录）：
 * - Windows: RoxyChrome_real.exe / RoxyFirefox_real.exe
 * - macOS/Linux: RoxyChrome_real / RoxyFirefox_real
 * 或环境变量 ROXY_REAL_EXE 指向绝对路径
 *
 * 延迟秒数优先级：
 * 1. 环境变量 ROXY_DELAY_SECONDS
 * 2. 可执行文件名中的 _delay_<N>s（如 RoxyChrome_delay_35s.exe）
 * 3. 编译期注入的 DEFAULT_DELAY_SECONDS
 *
 * 流程：
 * 1. sleep(delay)
 * 2. 将自身（假 RoxyChrome.exe）改名为 RoxyChrome_delay_used.exe
 * 3. 将 RoxyChrome_real.exe 还原为 RoxyChrome.exe
 * 4. spawn 还原后的 RoxyChrome.exe，并透传启动参数
 * → 下一次启动直接命中真内核，不会二次延迟
 */
import { spawn } from 'node:child_process'
import { access, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import process from 'node:process'

/** @type {number} 编译期由 build.mjs 替换；运行时仍可被文件名/环境变量覆盖 */
const DEFAULT_DELAY_SECONDS = 35

async function fileExists(path) {
  try {
    await access(path)
    return true
  }
  catch {
    return false
  }
}

function normalizePath(path) {
  return path.replace(/\\/g, '/').toLowerCase()
}

function parseDelayFromFileName(fileName) {
  const match = fileName.match(/_delay_(\d+)s(?:\.exe)?$/i)
  return match ? Number(match[1]) : null
}

function resolveDelaySeconds() {
  const fromEnv = Number(process.env.ROXY_DELAY_SECONDS)
  if (Number.isFinite(fromEnv) && fromEnv >= 0) {
    return fromEnv
  }
  const fromName = parseDelayFromFileName(basename(process.execPath))
  if (fromName !== null) {
    return fromName
  }
  const fromArgv0 = parseDelayFromFileName(basename(process.argv[0] || ''))
  if (fromArgv0 !== null) {
    return fromArgv0
  }
  return DEFAULT_DELAY_SECONDS
}

async function resolveRealExe(selfDir) {
  if (process.env.ROXY_REAL_EXE) {
    return process.env.ROXY_REAL_EXE
  }

  const isWin = process.platform === 'win32'
  const candidates = isWin
    ? ['RoxyChrome_real.exe', 'RoxyFirefox_real.exe']
    : ['RoxyChrome_real', 'RoxyFirefox_real']

  for (const name of candidates) {
    const full = join(selfDir, name)
    if (await fileExists(full)) {
      return full
    }
  }

  throw new Error(
    `[delay-launcher] real core not found in ${selfDir}. `
    + `Rename original binary to ${candidates[0]} (or set ROXY_REAL_EXE).`,
  )
}

/** RoxyChrome_real.exe → RoxyChrome.exe */
function realToPrimaryExe(realExe) {
  return realExe.replace(/_real(\.exe)?$/i, '$1')
}

function getUsedExePath(selfDir, primaryExe) {
  const isWin = process.platform === 'win32'
  const base = basename(primaryExe).replace(/\.exe$/i, '')
  return join(selfDir, isWin ? `${base}_delay_used.exe` : `${base}_delay_used`)
}

/**
 * 延迟结束后把真内核还原为正式文件名，供后续启动直接使用。
 * Windows 一般允许对正在运行的 exe 做 rename。
 */
async function restorePrimaryExe(selfDir, selfPath, realExe) {
  const primaryExe = realToPrimaryExe(realExe)
  const usedExe = getUsedExePath(selfDir, primaryExe)

  if (!(await fileExists(realExe))) {
    console.error(`[delay-launcher] sibling real missing, assume already restored: ${primaryExe}`)
    return { exeToRun: primaryExe, usedExe: null }
  }

  try {
    if (await fileExists(primaryExe)) {
      if (normalizePath(primaryExe) === normalizePath(selfPath)) {
        if (await fileExists(usedExe)) {
          await unlink(usedExe).catch(() => {})
        }
        await rename(primaryExe, usedExe)
        console.error(`[delay-launcher] moved launcher aside -> ${usedExe}`)
      }
      else {
        await unlink(primaryExe).catch(() => {})
      }
    }

    await rename(realExe, primaryExe)
    console.error(`[delay-launcher] restored real core -> ${primaryExe}`)
    return { exeToRun: primaryExe, usedExe }
  }
  catch (error) {
    console.error('[delay-launcher] restore failed, spawn real path directly:', error)
    return { exeToRun: realExe, usedExe: null }
  }
}

/**
 * 浏览器退出后、延迟器进程退出前，尝试删除改名残留。
 * 不再额外 spawn cmd/powershell，避免弹出黑框。
 */
async function cleanupUsedExe(usedExe) {
  if (!usedExe) {
    return
  }
  try {
    await unlink(usedExe)
    console.error(`[delay-launcher] removed leftover ${usedExe}`)
  }
  catch (error) {
    console.error(`[delay-launcher] leftover cleanup skipped (ok): ${usedExe}`, error?.code || error)
  }
}

function getForwardedArgs() {
  // node:  [node, script, ...userArgs]
  // pkg:   [exe, /snapshot/.../entry.js, ...userArgs]
  return process.argv.slice(2).filter((arg) => {
    const normalized = arg.replace(/\\/g, '/')
    return !normalized.includes('/snapshot/') && !normalized.startsWith('file:///C:/snapshot/')
  })
}

async function main() {
  const selfPath = process.execPath
  const selfDir = dirname(selfPath)
  const delaySeconds = resolveDelaySeconds()
  const realExe = await resolveRealExe(selfDir)
  const forwardedArgs = getForwardedArgs()

  console.error(`[delay-launcher] one-shot cold-start delay=${delaySeconds}s real=${realExe}`)
  console.error(`[delay-launcher] forward args (${forwardedArgs.length}):`, forwardedArgs)

  if (delaySeconds > 0) {
    await sleep(delaySeconds * 1000)
  }

  const { exeToRun, usedExe } = await restorePrimaryExe(selfDir, selfPath, realExe)

  console.error(`[delay-launcher] spawning restored core: ${exeToRun}`)

  // 勿 detached：包装进程需作为 Electron 跟踪的 browserProcess 存活，直到真 Chrome 退出
  // 勿 windowsHide：避免 CREATE_NO_WINDOW 影响 GUI 子进程
  const child = spawn(exeToRun, forwardedArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  })

  const exitCode = await new Promise((resolve) => {
    child.on('error', (error) => {
      console.error('[delay-launcher] spawn error:', error)
      resolve(1)
    })
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve(1)
        return
      }
      // 单实例唤醒等：spawn 子进程秒退 0，真 Chrome 仍在；包装进程保持 stderr 管道直到 Electron kill
      if (code === 0) {
        console.error('[delay-launcher] child exited with code 0, keeping wrapper alive for stderr forwarding')
        return
      }
      resolve(code ?? 1)
    })
  })

  await cleanupUsedExe(usedExe)
  process.exit(exitCode)
}

main().catch((error) => {
  console.error('[delay-launcher]', error)
  process.exit(1)
})
