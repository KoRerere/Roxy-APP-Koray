import type { Client } from 'chrome-remote-interface'
import CDP from 'chrome-remote-interface'
import { spawn } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ipcSender } from '/@/modules/ipc/sender'
import { getErrorMessage } from '/@/utils'
import { ChromeBrowser } from './browser'

/**
 * 启动选项接口
 */
export interface PuppeteerLaunchOptions {
  executablePath?: string
  args?: string[]
  headless?: boolean
  ignoreDefaultArgs?: boolean | string[]
  defaultViewport?: { width: number, height: number } | null
  relaunch?: boolean
}

/**
 * 启动浏览器
 */
export async function launch(options: PuppeteerLaunchOptions): Promise<ChromeBrowser> {
  const {
    executablePath,
    args = [],
    headless = false,
    ignoreDefaultArgs = false,
    defaultViewport = null,
    relaunch = false,
  } = options

  if (!executablePath) {
    throw new Error('executablePath is required')
  }

  if (relaunch) {
    spawn(executablePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return
  }

  const userDataDir = args.find(n => n.startsWith('--user-data-dir='))?.split('=')[1]
  await rm(join(userDataDir!, 'DevToolsActivePort'), { force: true }).catch(() => { })

  // 启动 Chrome 进程
  const chromeProcess = spawn(executablePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // 等待获取调试端口
  const actualPort = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Failed to get debugging port from Chrome'))
    }, 30000)

    let tryCount = 0
    const readDevToolsActivePort = async () => {
      try {
        const devToolsActivePort = await readFile(join(userDataDir!, 'DevToolsActivePort'), 'utf8')
        console.debug('devToolsActivePort', devToolsActivePort)
        const port = Number(devToolsActivePort.split('\n')[0])
        console.log('devToolsActivePort', port)
        if (port) {
          clearTimeout(timeout)
          resolve(port)
        }
      }
      catch (error) {
        console.debug('readDevToolsActivePort error', error)
        if (tryCount++ < 5) {
          readDevToolsActivePortTimer = setTimeout(readDevToolsActivePort, 3000)
        }
      }
    }
    let readDevToolsActivePortTimer = setTimeout(readDevToolsActivePort, 3000)

    chromeProcess.stdout.on('data', (data) => {
      // 可选：打印日志
      console.debug('[chrome stdout]', data.toString())
    })

    chromeProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString()
      console.debug('chromeProcess.stderr.on', output)
      const match = output.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/)
      if (match) {
        clearTimeout(timeout)
        clearTimeout(readDevToolsActivePortTimer)
        console.debug('chromeProcess match', match[1])
        resolve(Number.parseInt(match[1]))
      }
    })

    chromeProcess.on('error', (error) => {
      clearTimeout(timeout)
      console.error('chromeProcess.on error', error)
      reject(error)
    })
  })

  try {
    // 获取 WebSocket 端点
    const version = await CDP.Version({ port: actualPort })
    const wsEndpoint = version.webSocketDebuggerUrl
    console.debug('wsEndpoint', wsEndpoint, actualPort)
    // 连接到 Chrome
    const client = await CDP({ target: wsEndpoint }) as Client

    // 启用必要的域
    await client.Target.setDiscoverTargets({ discover: true })
    return new ChromeBrowser(client, wsEndpoint, chromeProcess, actualPort)
  }
  catch (error) {
    console.error('connect error', error)
    chromeProcess.kill()
    if (getErrorMessage(error).startsWith('connect ')) {
      if (actualPort) {
        ipcSender.browser.networkIntercepted()
      }
      throw new Error($t('内核连接失败，请重试'))
    }
    throw error
  }
}

/**
 * 连接到已存在的浏览器
 */
export async function connect(options: { browserWSEndpoint: string }): Promise<ChromeBrowser> {
  const { browserWSEndpoint } = options

  // 从 WebSocket URL 提取端口
  const url = new URL(browserWSEndpoint)
  const port = Number.parseInt(url.port)

  // 连接到 Chrome
  const client = await CDP({ port }) as Client

  // 启用必要的域
  await client.Target.setDiscoverTargets({ discover: true })

  return new ChromeBrowser(client, browserWSEndpoint)
}
