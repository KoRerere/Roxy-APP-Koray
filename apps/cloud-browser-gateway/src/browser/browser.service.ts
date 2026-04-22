import type { OnModuleInit } from '@nestjs/common'
import type { Configuration } from '~/config/configuration'
import type { Buffer } from 'node:buffer'
import type { Browser } from 'puppeteer-core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import Dockerode from 'dockerode'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

/** 浏览器连接超时时间（毫秒） */
const CONNECT_TIMEOUT_MS = 30_000
/** 日志轮询间隔（毫秒） */
const LOG_POLL_INTERVAL_MS = 500
/** DevTools WS URL 匹配正则 */
const DEVTOOLS_WS_REGEX = /DevTools listening on (ws:\/\/.+)/
/** DevToolsActivePort 第一行端口号匹配正则 */
const PORT_NUMBER_REGEX = /^\d+$/

interface ConnectOptions {
  /** 浏览器异常断连时的兜底回调，通常用于触发整会话清理 */
  onDisconnected?: () => Promise<void> | void
}

/**
 * 浏览器连接管理服务
 * 通过 puppeteer-core 连接容器内的 Chromium 浏览器，
 * 优先从容器日志提取 WebSocket 调试地址，DevToolsActivePort 作为降级方案
 */
@Injectable()
export class BrowserService implements OnModuleInit {
  private readonly logger = new Logger(BrowserService.name)
  private docker!: Dockerode
  /** 活跃的浏览器连接：sessionKey (userId:dirId) -> Browser */
  private readonly browsers = new Map<string, Browser>()
  /** 主动断开标记，避免回收流程再次触发延迟清理 */
  private readonly intentionalDisconnects = new Set<string>()
  /** 预停止中的会话，避免容器回收阶段再次触发会话清理 */
  private readonly preStopSessions = new Set<string>()

  constructor(
    private readonly configService: ConfigService<Configuration>,
  ) {}

  onModuleInit() {
    const dockerConfig = this.configService.get('docker', { infer: true })!
    this.docker = new Dockerode({ socketPath: dockerConfig.socketPath })
  }

  /**
   * 连接容器内的浏览器
   * 优先从容器日志提取 WS 地址，失败时降级读取 DevToolsActivePort 文件
   * @param sessionKey userId:dirId 复合键
   * @param containerId Docker 容器 ID
   */
  async connect(sessionKey: string, containerId: string, options?: ConnectOptions): Promise<Browser> {
    if (this.browsers.has(sessionKey)) {
      this.logger.warn(`会话 ${sessionKey} 的浏览器已连接，先断开旧连接`)
      await this.disconnect(sessionKey)
    }

    const containerIp = await this.getContainerIp(containerId)
    let wsEndpoint: string

    try {
      wsEndpoint = await this.extractWsFromLogs(containerId, containerIp)
      this.logger.log(`已从日志提取 ${sessionKey} 的 WS 地址：${wsEndpoint}`)
    }
    catch (logError: any) {
      this.logger.warn(
        `从日志提取 ${sessionKey} 的 WS 地址失败：${logError.message}，改为读取 DevToolsActivePort`,
      )
      wsEndpoint = await this.extractWsFromActivePort(sessionKey, containerIp)
      this.logger.log(`已从 DevToolsActivePort 提取 ${sessionKey} 的 WS 地址：${wsEndpoint}`)
    }

    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null })
    this.browsers.set(sessionKey, browser)

    browser.on('disconnected', () => {
      const isIntentional = this.intentionalDisconnects.has(sessionKey)
      const isPreStop = this.preStopSessions.has(sessionKey)
      if (isIntentional) {
        this.intentionalDisconnects.delete(sessionKey)
      }

      this.logger.warn(`浏览器已断开，会话键=${sessionKey}`)
      this.browsers.delete(sessionKey)

      if (!isIntentional && !isPreStop && options?.onDisconnected) {
        void Promise.resolve(options.onDisconnected()).catch((error: any) => {
          this.logger.error(`处理 ${sessionKey} 的浏览器断开事件失败：${error.message}`)
        })
      }
    })

    this.logger.log(`浏览器已连接，会话键=${sessionKey}`)
    return browser
  }

  /**
   * 断开浏览器连接（不关闭浏览器进程，浏览器由 neko 管理）
   * @param sessionKey userId:dirId 复合键
   */
  async disconnect(sessionKey: string): Promise<void> {
    const browser = this.browsers.get(sessionKey)
    if (browser) {
      try {
        this.intentionalDisconnects.add(sessionKey)
        browser.disconnect()
      }
      catch (error: any) {
        this.intentionalDisconnects.delete(sessionKey)
        this.logger.warn(`断开 ${sessionKey} 的浏览器连接时出错：${error.message}`)
      }
      this.browsers.delete(sessionKey)
      this.logger.log(`浏览器已断开，会话键=${sessionKey}`)
    }
  }

  /**
   * 优雅关闭浏览器进程，触发浏览器自身退出逻辑落盘数据
   * 若 Browser.close 未能真正让远端浏览器断连，则退回到普通 disconnect，保证回收流程继续推进。
   * @param sessionKey userId:dirId 复合键
   */
  async gracefulClose(sessionKey: string): Promise<void> {
    const browser = this.browsers.get(sessionKey)
    if (!browser) {
      return
    }

    let disconnected = !browser.connected
    const disconnectedSignal = browser.connected
      ? new Promise<void>(resolve => browser.once('disconnected', () => {
          disconnected = true
          resolve()
        }))
      : Promise.resolve()

    try {
      this.intentionalDisconnects.add(sessionKey)
      await browser.close().catch((error: any) => {
        this.logger.warn(`关闭 ${sessionKey} 的浏览器时出错：${error.message}`)
      })
      await Promise.race([
        disconnectedSignal,
        setTimeoutPromise(3000).then(() => undefined),
      ])
    }
    finally {
      this.intentionalDisconnects.delete(sessionKey)
      if (!browser.connected) {
        this.browsers.delete(sessionKey)
      }
    }

    if (!disconnected && browser.connected) {
      this.logger.warn(`优雅关闭后 ${sessionKey} 的浏览器仍未断开，回退为普通断开`)
      await this.disconnect(sessionKey)
      return
    }

    this.logger.log(`浏览器已优雅关闭，会话键=${sessionKey}`)
  }

  /** 标记会话进入容器预停止阶段 */
  markPreStop(sessionKey: string): void {
    this.preStopSessions.add(sessionKey)
  }

  /** 清除容器预停止阶段标记，恢复异常断连时的自动清理能力 */
  clearPreStop(sessionKey: string): void {
    this.preStopSessions.delete(sessionKey)
  }

  /** 获取 sessionKey 对应的 Browser 实例 */
  getBrowser(sessionKey: string): Browser | undefined {
    return this.browsers.get(sessionKey)
  }

  /** 检查 sessionKey 是否已有浏览器连接 */
  isConnected(sessionKey: string): boolean {
    const browser = this.browsers.get(sessionKey)
    return !!browser && browser.connected
  }

  /**
   * 策略一：从容器日志流中提取 DevTools WebSocket 地址
   * 流式读取日志，匹配到目标行后立即停止并返回
   */
  private extractWsFromLogs(containerId: string, containerIp: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const container = this.docker.getContainer(containerId)
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          reject(new Error(`在 ${CONNECT_TIMEOUT_MS}ms 内未从日志中找到 DevTools WS 地址`))
        }
      }, CONNECT_TIMEOUT_MS)

      container.logs(
        { follow: true, stdout: true, stderr: true, tail: 50 },
        (err, stream) => {
          if (err) {
            clearTimeout(timeout)
            return reject(err)
          }
          if (!stream) {
            clearTimeout(timeout)
            return reject(new Error('未返回日志流'))
          }

          const onData = (chunk: Buffer) => {
            if (resolved)
              return
            const line = chunk.toString('utf-8')
            const match = line.match(DEVTOOLS_WS_REGEX)
            if (match) {
              resolved = true
              clearTimeout(timeout)
              stream.removeListener('data', onData)
              if ('destroy' in stream && typeof (stream as any).destroy === 'function') {
                (stream as any).destroy()
              }

              // 将日志中的 0.0.0.0 / 127.0.0.1 替换为容器实际 IP
              const wsUrl = match[1]
                .replace('0.0.0.0', containerIp)
                .replace('127.0.0.1', containerIp)
              resolve(wsUrl)
            }
          }

          stream.on('data', onData)

          stream.on('error', (streamErr: Error) => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              reject(streamErr)
            }
          })

          stream.on('end', () => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              reject(new Error('日志流结束，仍未找到 DevTools WS 地址'))
            }
          })
        },
      )
    })
  }

  /**
   * 策略二（降级）：从 DevToolsActivePort 文件读取调试端口，
   * 再通过 /json/version 接口获取完整 WS URL
   * @param sessionKey userId:dirId 复合键
   */
  private async extractWsFromActivePort(sessionKey: string, containerIp: string): Promise<string> {
    const dataDir = this.configService.get('dataDir', { infer: true })!
    const [userId, dirId] = sessionKey.split(':')
    const activePortPath = path.resolve(dataDir, userId, dirId, 'DevToolsActivePort')

    const port = await this.pollForFile(activePortPath)
    const versionUrl = `http://${containerIp}:${port}/json/version`

    const response = await axios.get(versionUrl, { timeout: 5000 })
    const wsUrl: string = response.data.webSocketDebuggerUrl

    if (!wsUrl) {
      throw new Error('在 /json/version 响应中未找到 webSocketDebuggerUrl')
    }

    // /json/version 可能返回 localhost，替换为容器 IP
    return wsUrl
      .replace('127.0.0.1', containerIp)
      .replace('0.0.0.0', containerIp)
  }

  /**
   * 轮询等待文件出现并读取第一行（端口号）
   */
  private async pollForFile(filePath: string): Promise<string> {
    const deadline = Date.now() + CONNECT_TIMEOUT_MS

    while (Date.now() < deadline) {
      try {
        const content = (await readFile(filePath, 'utf-8')).trim()
        if (content) {
          // DevToolsActivePort 第一行是端口号
          const port = content.split('\n')[0].trim()
          if (port && PORT_NUMBER_REGEX.test(port)) {
            return port
          }
        }
      }
      catch {
        // 文件不存在，继续等待
      }
      await setTimeoutPromise(LOG_POLL_INTERVAL_MS)
    }

    throw new Error(`在 ${CONNECT_TIMEOUT_MS}ms 内未找到 DevToolsActivePort 文件：${filePath}`)
  }

  /**
   * 通过 Docker inspect 获取容器内网 IP
   */
  private async getContainerIp(containerId: string): Promise<string> {
    const container = this.docker.getContainer(containerId)
    const info = await container.inspect()

    // 优先取 bridge 网络 IP，其次取全局 IPAddress
    const networks = info.NetworkSettings.Networks
    if (networks?.bridge?.IPAddress) {
      return networks.bridge.IPAddress
    }

    // 自定义网络：取第一个有 IP 的网络
    for (const netName of Object.keys(networks || {})) {
      if (networks[netName]?.IPAddress) {
        return networks[netName].IPAddress
      }
    }

    const globalIp = (info.NetworkSettings as any).IPAddress
    if (globalIp) {
      return globalIp
    }

    throw new Error(`无法确定容器 ${containerId} 的 IP 地址`)
  }
}
