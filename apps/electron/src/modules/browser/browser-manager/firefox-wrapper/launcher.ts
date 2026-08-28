import type { FirefoxLaunchOptions } from './types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { BiDiClient } from './bidi-client'
import { FirefoxBrowser } from './browser'

export type { FirefoxLaunchOptions }

/** stdout 中 Marionette 实际监听端口的官方日志格式 */
const MARIONETTE_PORT_LOG_RE = /Marionette\s+INFO\s+Listening on port\s+(\d+)/
/** prefs.js 中 Marionette 就绪后写入的实际端口 */
const MARIONETTE_PORT_PREF_RE = /user_pref\(\s*"marionette\.port"\s*,\s*(\d+)\s*\)/

/**
 * 将原始端口字符串解析为已分配端口。
 * 0 表示仍在请求系统分配，不能当作可连接端口。
 */
function parseAllocatedPort(raw: string | undefined): number | undefined {
  if (!raw)
    return undefined
  const port = Number.parseInt(raw, 10)
  if (!Number.isFinite(port) || port <= 0)
    return undefined
  return port
}

/** 从 Firefox stdout 解析 Marionette 实际监听端口 */
function parseMarionettePortFromLog(output: string): number | undefined {
  return parseAllocatedPort(output.match(MARIONETTE_PORT_LOG_RE)?.[1])
}

/** 从 prefs.js 内容解析 Marionette 实际监听端口 */
function parseMarionettePortFromPrefs(content: string): number | undefined {
  return parseAllocatedPort(content.match(MARIONETTE_PORT_PREF_RE)?.[1])
}

/** 解析 Firefox profile 目录：优先显式 userDataDir，否则从 -profile 参数取 */
function resolveFirefoxProfileDir(options: { userDataDir?: string, args?: string[] }): string | undefined {
  if (options.userDataDir)
    return options.userDataDir
  const args = options.args ?? []
  const flagIndex = args.findIndex(arg => arg === '-profile' || arg === '--profile')
  if (flagIndex !== -1)
    return args[flagIndex + 1]
  const inline = args.find(arg => arg.startsWith('-profile=') || arg.startsWith('--profile='))
  return inline?.slice(inline.indexOf('=') + 1)
}

/**
 * 启动前清掉上次写入的 marionette.port。
 * 不清的话，prefs.js 在本次实例写回新端口前仍持有旧值，会被误当成当前端口。
 */
async function clearStaleMarionettePortPref(profileDir: string | undefined): Promise<void> {
  if (!profileDir)
    return
  const prefsPath = join(profileDir, 'prefs.js')
  try {
    const content = await readFile(prefsPath, 'utf8')
    const cleaned = content
      .split('\n')
      .filter(line => !line.includes('"marionette.port"'))
      .join('\n')
    if (cleaned !== content)
      await writeFile(prefsPath, cleaned, 'utf8')
  }
  catch {
    // 全新 profile 尚无 prefs.js，无需处理
  }
}

/** 读取 prefs.js 中已分配的 Marionette 端口 */
async function readMarionettePortFromPrefs(profileDir: string | undefined): Promise<number | undefined> {
  if (!profileDir)
    return undefined
  try {
    const content = await readFile(join(profileDir, 'prefs.js'), 'utf8')
    return parseMarionettePortFromPrefs(content)
  }
  catch {
    return undefined
  }
}

/** stdout 未解析到时轮询 prefs.js：官方会在 Marionette 就绪后把实际端口写进该文件 */
async function waitForMarionettePortFromPrefs(
  profileDir: string | undefined,
  timeoutMs: number,
): Promise<number | undefined> {
  if (!profileDir)
    return undefined
  const deadline = Date.now() + timeoutMs
  while (true) {
    const port = await readMarionettePortFromPrefs(profileDir)
    if (port !== undefined)
      return port
    if (Date.now() >= deadline)
      return undefined
    await sleep(150)
  }
}

/**
 * 启动 Firefox 浏览器
 *
 * 完整的命令行参数（包含 -profile / --remote-debugging-port=0 / 启动 URL 等）
 * 由上层 BeforeLaunchTask 生成，本函数仅负责拉起进程并连接 BiDi。
 */
export async function launch(options: FirefoxLaunchOptions): Promise<FirefoxBrowser | void> {
  const {
    executablePath,
    args = [],
    relaunch = false,
    timeoutMs = 30_000,
  } = options

  if (!executablePath) {
    throw new Error($t('Firefox 内核路径未指定'))
  }

  const profileDir = resolveFirefoxProfileDir(options)

  if (relaunch) {
    spawn(executablePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return
  }

  // 必须在 spawn 前清掉上次端口，否则轮询 prefs.js 可能读到上一实例的残留值
  await clearStaleMarionettePortPref(profileDir)

  // 启动 Firefox 进程，参数原样传递
  const firefoxProcess = spawn(executablePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  console.debug('firefoxProcess pid', firefoxProcess?.pid)

  // 暂存 Marionette 端口（官方发现方式：stdout「Listening on port」）
  let marionettePort: number | undefined

  // 等待获取 WebSocket URL
  const wsUrl = await new Promise<string>((resolve, reject) => {
    // 超时必须同步回收进程：迟到就绪的实例已无法被使用,若不 kill 会残留脱管的
    // Firefox 进程占着 profile 锁,导致用户立刻重试同一窗口也会失败
    const timeout = setTimeout(() => {
      firefoxProcess.kill()
      reject(new Error($t('Firefox 启动超时，未能获取调试端口')))
    }, timeoutMs)

    firefoxProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      console.debug('[firefox stdout]', output)

      // 官方发现方式：stdout "Marionette INFO Listening on port <port>"
      const parsedMarionettePort = parseMarionettePortFromLog(output)
      if (parsedMarionettePort && !marionettePort) {
        marionettePort = parsedMarionettePort
        console.log('Extracted marionettePort from stdout:', marionettePort)
      }
    })

    firefoxProcess.stderr?.on('data', (data: ArrayBuffer) => {
      const output = Buffer.from(data).toString()
      console.debug('[firefox stderr]', output)

      // 解析 WebDriver BiDi WebSocket URL（来自 stderr）
      const match = output.match(/WebDriver BiDi listening on (ws:\/\/\S+)/)
      if (match) {
        clearTimeout(timeout)
        resolve(match[1])
      }
    })

    firefoxProcess.on('error', (error) => {
      clearTimeout(timeout)
      console.error('Firefox process error:', error)
      reject(error)
    })

    firefoxProcess.on('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code !== 0 && code !== null) {
        const exitDesc = code !== null ? `退出码 ${code}` : `信号 ${signal}`
        reject(new Error($t('Firefox 进程意外退出（{exitDesc}），未能获取调试端口', { exitDesc })))
      }
    })
  })

  // Firefox 在打印 "WebDriver BiDi listening on ..." 时，WebSocket 服务器可能尚未完全
  // bind 完毕，立即连接会触发竞态失败。等待 300ms 让系统完成端口监听。
  await sleep(300)

  try {
    // 创建 BiDi 客户端
    const bidiClient = new BiDiClient()

    // 连接到 BiDi WebSocket
    await bidiClient.connect(wsUrl)

    // 创建会话（带重试，Firefox 窗口就绪前 session.new 会失败）
    const sessionResult = await bidiClient.createSessionWithRetry()

    const sessionId = sessionResult.sessionId
    const capabilities = sessionResult.capabilities

    // 从 WebSocket URL 中提取端口号
    let actualPort: number | undefined
    try {
      const url = new URL(wsUrl)
      actualPort = Number.parseInt(url.port, 10)
      console.log('Extracted actualPort from WebSocket URL:', actualPort)
    }
    catch (error) {
      console.warn('Failed to extract port from WebSocket URL:', error)
    }

    // stdout 未解析到时读 prefs.js（官方第二来源）；不用 BiDi 端口推算，二者无绑定关系
    let marionettePortSource: 'stdout' | 'prefs.js' | 'stdout-late' | undefined
    let resolvedMarionettePort = marionettePort
    if (resolvedMarionettePort !== undefined) {
      marionettePortSource = 'stdout'
    }
    else {
      resolvedMarionettePort = await waitForMarionettePortFromPrefs(profileDir, 2_000)
      if (resolvedMarionettePort !== undefined)
        marionettePortSource = 'prefs.js'
    }
    // prefs 轮询期间 stdout 仍可能迟到，再读一次内存里的解析结果
    if (resolvedMarionettePort === undefined && marionettePort !== undefined) {
      resolvedMarionettePort = marionettePort
      marionettePortSource = 'stdout-late'
    }
    if (resolvedMarionettePort !== undefined) {
      console.log(`Resolved marionettePort from ${marionettePortSource}:`, resolvedMarionettePort)
    }
    else {
      console.warn('Marionette port not found in stdout or prefs.js')
    }

    // 创建并返回 FirefoxBrowser 实例
    return new FirefoxBrowser(
      bidiClient,
      wsUrl,
      firefoxProcess,
      sessionId,
      capabilities,
      actualPort,
      resolvedMarionettePort,
    )
  }
  catch (error) {
    // 如果连接失败，杀死进程
    try {
      firefoxProcess.kill()
    }
    catch (killErr) {
      console.warn('Failed to kill firefox process after connect failure:', killErr)
    }
    throw error
  }
}

/**
 * 连接到已存在的 Firefox 浏览器
 */
export async function connect(options: {
  browserWSEndpoint: string
  sessionId?: string
  userDataDir?: string
}): Promise<FirefoxBrowser> {
  const { browserWSEndpoint, sessionId, userDataDir } = options

  try {
    // 创建 BiDi 客户端
    const bidiClient = new BiDiClient()

    // 连接到 BiDi WebSocket
    await bidiClient.connect(browserWSEndpoint)

    let actualSessionId = sessionId
    let capabilities

    // 如果没有提供 sessionId，带重试创建新会话
    if (!actualSessionId) {
      const sessionResult = await bidiClient.createSessionWithRetry()
      actualSessionId = sessionResult.sessionId
      capabilities = sessionResult.capabilities
    }

    // 从 WebSocket URL 中提取端口号
    let actualPort: number | undefined
    try {
      const url = new URL(browserWSEndpoint)
      actualPort = Number.parseInt(url.port, 10)
      console.log('Extracted actualPort from WebSocket URL:', actualPort)
    }
    catch (error) {
      console.warn('Failed to extract port from WebSocket URL:', error)
    }

    // 已运行实例的实际端口已写在 prefs.js，不能从 BiDi 端口推算
    const marionettePort = await readMarionettePortFromPrefs(userDataDir)
    console.log('Resolved marionettePort from prefs.js:', marionettePort)

    // 创建并返回 FirefoxBrowser 实例（没有进程对象）
    return new FirefoxBrowser(
      bidiClient,
      browserWSEndpoint,
      undefined,
      actualSessionId,
      capabilities,
      actualPort,
      marionettePort,
    )
  }
  catch (error) {
    console.error('Failed to connect to Firefox:', error)
    throw error
  }
}
