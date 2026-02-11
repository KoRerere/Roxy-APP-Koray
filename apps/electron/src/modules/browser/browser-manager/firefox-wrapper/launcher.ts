import type { FirefoxLaunchOptions } from './types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { BiDiClient } from './bidi-client'
import { FirefoxBrowser } from './browser'

export type { FirefoxLaunchOptions }

/**
 * 启动 Firefox 浏览器
 */
export async function launch(options: FirefoxLaunchOptions): Promise<FirefoxBrowser> {
  const {
    executablePath,
    args = [],
    headless = false,
    userDataDir,
  } = options

  if (!executablePath) {
    throw new Error('executablePath is required')
  }

  // 构建启动参数
  const firefoxArgs: string[] = []

  // 添加用户数据目录
  if (userDataDir) {
    firefoxArgs.push('-profile', userDataDir)
  }

  // 添加远程调试
  firefoxArgs.push('--remote-debugging-port=0')

  // 添加 headless 模式
  if (headless) {
    firefoxArgs.push('-headless')
  }

  // 添加自定义参数
  firefoxArgs.push(...args)

  // 启动 Firefox 进程
  const firefoxProcess = spawn(executablePath, firefoxArgs, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // 等待获取 WebSocket URL
  const wsUrl = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Failed to get WebSocket URL from Firefox'))
    }, 30000)

    firefoxProcess.stdout?.on('data', (data) => {
      console.debug('[firefox stdout]', data.toString())
    })

    firefoxProcess.stderr?.on('data', (data: ArrayBuffer) => {
      const output = Buffer.from(data).toString()
      console.debug('[firefox stderr]', output)

      // 解析 WebDriver BiDi WebSocket URL
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

    firefoxProcess.on('exit', (code, _signal) => {
      clearTimeout(timeout)
      if (code !== 0 && code !== null) {
        reject(new Error(`Firefox process exited with code ${code}`))
      }
    })
  })

  try {
    // 创建 BiDi 客户端
    const bidiClient = new BiDiClient()

    // 连接到 BiDi WebSocket
    await bidiClient.connect(wsUrl)

    // 创建会话
    const sessionResult = await bidiClient.sendCommand('session.new', {
      capabilities: {},
    })

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

    // 创建并返回 FirefoxBrowser 实例
    return new FirefoxBrowser(
      bidiClient,
      wsUrl,
      firefoxProcess,
      sessionId,
      capabilities,
      actualPort,
    )
  }
  catch (error) {
    // 如果连接失败，杀死进程
    firefoxProcess.kill()
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

    // 如果没有提供 sessionId，尝试创建新会话
    if (!actualSessionId) {
      const sessionResult = await bidiClient.sendCommand('session.new', {
        capabilities: {},
      })
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
