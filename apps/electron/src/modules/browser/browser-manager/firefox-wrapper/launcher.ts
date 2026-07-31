import type { FirefoxLaunchOptions } from './types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { BiDiClient } from './bidi-client'
import { FirefoxBrowser } from './browser'

export type { FirefoxLaunchOptions }

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

  if (relaunch) {
    spawn(executablePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return
  }

  // 启动 Firefox 进程，参数原样传递
  const firefoxProcess = spawn(executablePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  console.debug('firefoxProcess pid', firefoxProcess?.pid)

  // 暂存 Marionette 端口（通过 stdout 解析，早于 BiDi URL 打印；若未能解析则兜底用 BiDi 端口 - 1）
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

      // 解析 Marionette 端口，格式示例（来自 stdout）：
      // "1779936938036    Marionette      INFO    Listening on port 2828"
      const marionetteMatch = output.match(/Marionette\s+INFO\s+Listening on port\s+(\d+)/)
      if (marionetteMatch && !marionettePort) {
        marionettePort = Number.parseInt(marionetteMatch[1], 10)
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
  await new Promise(resolve => setTimeout(resolve, 300))

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

    // Marionette 端口：优先取 stderr 解析值，兜底用 BiDi 端口 - 1（本项目 Firefox 构建约定）
    const resolvedMarionettePort = marionettePort ?? (actualPort !== undefined ? actualPort - 1 : undefined)
    console.log('Resolved marionettePort:', resolvedMarionettePort)

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
export async function connect(options: { browserWSEndpoint: string, sessionId?: string }): Promise<FirefoxBrowser> {
  const { browserWSEndpoint, sessionId } = options

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

    // 创建并返回 FirefoxBrowser 实例（没有进程对象）
    return new FirefoxBrowser(
      bidiClient,
      browserWSEndpoint,
      undefined,
      actualSessionId,
      capabilities,
      actualPort,
    )
  }
  catch (error) {
    console.error('Failed to connect to Firefox:', error)
    throw error
  }
}
