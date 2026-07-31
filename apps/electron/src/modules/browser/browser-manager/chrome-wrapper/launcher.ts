import type { Client } from 'chrome-remote-interface'
import type { Buffer } from 'node:buffer'
import CDP from 'chrome-remote-interface'
import { spawn } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
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
  /** 等待调试端口就绪的超时时间（毫秒），需与上层启动超时对齐 */
  timeoutMs?: number
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
    timeoutMs = 30_000,
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
    let readDevToolsActivePortTimer: NodeJS.Timeout | undefined
    let settled = false
    let timeout: NodeJS.Timeout

    const settleResolve = (port: number) => {
      if (settled)
        return
      settled = true
      clearTimeout(timeout)
      clearTimeout(readDevToolsActivePortTimer)
      resolve(port)
    }

    const settleReject = (error: Error) => {
      if (settled)
        return
      settled = true
      clearTimeout(timeout)
      clearTimeout(readDevToolsActivePortTimer)
      reject(error)
    }

    // 超时必须同步回收进程：迟到写出的调试端口已无法被使用,若不 kill 会残留脱管的
    // Chrome 进程占着 user-data-dir 的 profile 锁,导致用户立刻重试同一窗口也会失败
    timeout = setTimeout(() => {
      settleReject(new Error($t('Chrome 启动超时，未能获取调试端口')))
      chromeProcess.kill()
    }, timeoutMs)

    /**
     * 持续轮询直到成功或超时兜底：部分环境 stderr 匹配不到 DevTools listening,
     * 且内核首装被杀软扫描时端口文件可能在数十秒后才写出,不能提前放弃
     */
    const readDevToolsActivePort = async () => {
      if (settled)
        return
      try {
        const devToolsActivePort = await readFile(join(userDataDir!, 'DevToolsActivePort'), 'utf8')
        console.debug('devToolsActivePort', devToolsActivePort)
        const port = Number(devToolsActivePort.split('\n')[0])
        console.log('devToolsActivePort', port)
        if (port) {
          settleResolve(port)
          return
        }
      }
      catch (error) {
        console.debug('readDevToolsActivePort error', error)
      }
      readDevToolsActivePortTimer = setTimeout(readDevToolsActivePort, 3000)
    }
    readDevToolsActivePortTimer = setTimeout(readDevToolsActivePort, 3000)

    chromeProcess.stdout.on('data', (data) => {
      // 可选：打印日志
      console.debug('[chrome stdout]', data.toString())
    })

    chromeProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString()
      console.debug('chromeProcess.stderr.on', output)
      const match = output.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/)
      if (match) {
        console.debug('chromeProcess match', match[1])
        settleResolve(Number.parseInt(match[1]))
      }
    })

    chromeProcess.on('error', (error) => {
      console.error('chromeProcess.on error', error)
      settleReject(error)
    })

    // 进程在拿到调试端口前异常退出时立即失败；正常退出码 0 不在此处理，由超时兜底
    chromeProcess.on('exit', (code, signal) => {
      if (settled)
        return
      if (code !== 0 && code !== null) {
        const exitDesc = `退出码 ${code}`
        settleReject(new Error($t('Chrome 进程意外退出（{exitDesc}），未能获取调试端口', { exitDesc })))
      }
    })
  })

  // 尝试连接 CDP，带重试逻辑
  // Chrome 端口已写入但 WebSocket 服务尚未就绪时会出现 ECONNRESET，短暂等待后重试可解决
  const MAX_RETRY = 5
  const RETRY_DELAY_MS = 200
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      // 获取 WebSocket 端点
      const version = await CDP.Version({ port: actualPort })
      const wsEndpoint = version.webSocketDebuggerUrl
      console.debug('wsEndpoint', wsEndpoint, actualPort, `attempt=${attempt}`)
      // 连接到 Chrome
      const client = await CDP({ target: wsEndpoint }) as Client

      // 启用必要的域
      await client.Target.setDiscoverTargets({ discover: true })
      return new ChromeBrowser(client, wsEndpoint, chromeProcess, actualPort)
    }
    catch (error) {
      lastError = error
      const msg = getErrorMessage(error)
      // ECONNRESET / ECONNREFUSED 是 Chrome 未就绪的瞬态错误，可重试
      const isTransient = msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED')
      console.warn(`connect error (attempt ${attempt}/${MAX_RETRY}):`, msg)
      if (isTransient && attempt < MAX_RETRY) {
        await setTimeoutPromise(RETRY_DELAY_MS)
        continue
      }
      // 非瞬态错误或已超过重试次数，直接失败
      break
    }
  }

  // 所有重试均失败
  console.error('connect error (all retries exhausted)', lastError)
  chromeProcess.kill()
  const lastMsg = getErrorMessage(lastError)
  if (lastMsg.startsWith('connect ') || lastMsg.includes('ECONNRESET') || lastMsg.includes('ECONNREFUSED')) {
    if (actualPort) {
      ipcSender.browser.networkIntercepted()
    }
    throw new Error($t('内核连接失败，请重试'))
  }
  throw lastError
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
