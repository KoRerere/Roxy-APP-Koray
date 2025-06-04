import CDP from 'chrome-remote-interface'
import type { Client } from 'chrome-remote-interface'
import { spawn } from 'node:child_process'
import { ChromeBrowser } from './browser'

/**
 * 启动选项接口
 */
export interface PuppeteerLaunchOptions {
  executablePath?: string
  args?: string[]
  headless?: boolean
  ignoreDefaultArgs?: boolean | string[]
  defaultViewport?: { width: number; height: number } | null
}

/**
 * 启动浏览器
 */
export async function launch(options: PuppeteerLaunchOptions, relaunch = false): Promise<ChromeBrowser> {
  const {
    executablePath,
    args = [],
    headless = false,
    ignoreDefaultArgs = false,
    defaultViewport = null
  } = options

  if (!executablePath) {
    throw new Error('executablePath is required')
  }

  if (relaunch) {
    spawn(executablePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return
  }

  // 确保包含远程调试端口
  let port = 0
  const portArg = args.find(arg => arg.startsWith('--remote-debugging-port='))
  if (portArg) {
    port = parseInt(portArg.split('=')[1])
  } else {
    // 使用随机端口
    port = 0
    args.push('--remote-debugging-port=0')
  }

  // 启动 Chrome 进程
  const chromeProcess = spawn(executablePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // 等待获取调试端口
  const actualPort = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Failed to get debugging port from Chrome'))
    }, 30000)

    chromeProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString()
      const match = output.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/)
      if (match) {
        clearTimeout(timeout)
        resolve(parseInt(match[1]))
      }
    })

    chromeProcess.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })

  // 获取 WebSocket 端点
  const version = await CDP.Version({ port: actualPort })
  const wsEndpoint = version.webSocketDebuggerUrl

  // 连接到 Chrome
  const client = await CDP({ port: actualPort }) as Client

  // 启用必要的域
  await client.Target.setDiscoverTargets({ discover: true })

  return new ChromeBrowser(client, wsEndpoint, chromeProcess)
}

/**
 * 连接到已存在的浏览器
 */
export async function connect(options: { browserWSEndpoint: string }): Promise<ChromeBrowser> {
  const { browserWSEndpoint } = options

  // 从 WebSocket URL 提取端口
  const url = new URL(browserWSEndpoint)
  const port = parseInt(url.port)

  // 连接到 Chrome
  const client = await CDP({ port }) as Client

  // 启用必要的域
  await client.Target.setDiscoverTargets({ discover: true })

  return new ChromeBrowser(client, browserWSEndpoint)
}
