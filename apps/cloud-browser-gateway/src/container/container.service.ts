import type { SessionContext } from '../browser/browser-item/browserItem'
import type { SessionData } from '../session/session-state'
import type { OnModuleInit } from '@nestjs/common'
import type { Configuration } from '~/config/configuration'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Dockerode from 'dockerode'
import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import * as path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { getWritableDir } from '~/utils'
import { BrowserItemService } from '../browser/browser-item.service'
import { BrowserService } from '../browser/browser.service'
import { RedisService } from '../redis/redis.service'
import { getSessionState, normalizeSessionData } from '../session/session-state'
import { PortAllocatorService } from './port-allocator.service'

const SHM_SIZE_PATTERN = /^(\d+)([gmk])?$/i
const SCREEN_SIZE_PATTERN = /^(\d+)x(\d+)(?:@\d+)?$/i
const CONTAINER_REMOVAL_IN_PROGRESS_PATTERN = /already in progress/i
const PRE_STOP_COOKIE_CAPTURE_TIMEOUT_MS = 3_000
const PRE_STOP_BROWSER_CLOSE_TIMEOUT_MS = 5_000
const PRE_STOP_ROXY_TABS_TIMEOUT_MS = 1_000
const PRE_STOP_UPLOAD_TIMEOUT_MS = 10_000
const CONTAINER_REMOVAL_WAIT_TIMEOUT_MS = 5_000
const CONTAINER_REMOVAL_POLL_INTERVAL_MS = 250

/** 容器创建后返回的信息 */
export interface ContainerInfo {
  containerId: string
  containerName: string
  httpPort: number
  udpPort: number
  nekoAdminPassword: string
}

/**
 * 容器服务本地维护的会话快照。
 * 主要用于本地定时器触发清理时的兜底，避免 Redis TTL 先过期导致无法拿到容器和端口信息。
 */
interface SessionSnapshot {
  sessionId: string
  userId: string
  dirId: string
  containerId: string
  containerName: string
  httpPort: number
  udpPort: number
  createdAt: number
  lastSeenAt: number
  sessionContext?: SessionContext
}

type TrackedSessionData = SessionData

/**
 * Docker 容器管理服务
 * 负责 neko 容器的完整生命周期：创建、启动、定时停止、移除、启动恢复
 */
@Injectable()
export class ContainerService implements OnModuleInit {
  private readonly logger = new Logger(ContainerService.name)
  private docker!: Dockerode
  /** 会话快照：sessionKey(userId:dirId) -> 会话清理所需的最小数据 */
  private readonly sessionSnapshots = new Map<string, SessionSnapshot>()
  /** 同一会话的清理只允许一条链路执行，避免并发回收打架 */
  private readonly cleanupTasks = new Map<string, Promise<void>>()
  /** 同一容器的 stop/remove 只执行一次，其余调用复用同一个 Promise */
  private readonly stopTasks = new Map<string, Promise<boolean>>()
  /** 延迟停止定时器映射：containerId -> timer */
  private readonly stopTimers = new Map<string, NodeJS.Timeout>()
  /** 活跃会话定时器映射：containerId -> timer */
  private readonly activityTimers = new Map<string, NodeJS.Timeout>()
  /** 总使用时长到期定时器映射：containerId -> timer */
  private readonly usageTimers = new Map<string, NodeJS.Timeout>()
  /** 最近一次刷新活跃时间：containerId -> timestamp */
  private readonly lastActivityAt = new Map<string, number>()

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly redisService: RedisService,
    private readonly portAllocator: PortAllocatorService,
    private readonly browserService: BrowserService,
    private readonly browserItemService: BrowserItemService,
  ) {}

  /** 模块初始化时连接 Docker daemon */
  onModuleInit() {
    this.ensureDockerClient()
  }

  /**
   * 记录当前活跃会话并刷新本地清理定时器。
   * 这是运行中会话的统一入口，供 connect/heartbeat 复用。
   */
  trackSession(sessionData: TrackedSessionData): void {
    this.syncSessionSnapshot(sessionData)
    this.touchSession(
      sessionData.containerId,
      sessionData.containerName,
      `${sessionData.userId}:${sessionData.dirId}`,
      sessionData.usageExpiresAt,
    )
  }

  /**
   * 同步会话快照到内存。
   * 这份快照只用于本地定时器触发清理时的兜底，不替代 Redis 中的主会话数据。
   */
  syncSessionSnapshot(sessionData: TrackedSessionData): void {
    const sessionKey = `${sessionData.userId}:${sessionData.dirId}`
    this.sessionSnapshots.set(sessionKey, {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      dirId: sessionData.dirId,
      containerId: sessionData.containerId,
      containerName: sessionData.containerName,
      httpPort: sessionData.httpPort,
      udpPort: sessionData.udpPort,
      createdAt: sessionData.createdAt,
      lastSeenAt: sessionData.lastSeenAt,
      sessionContext: sessionData.sessionContext,
    })
  }

  /** 确保 Docker client 已初始化（用于早于 onModuleInit 的调用场景） */
  private ensureDockerClient() {
    if (this.docker) {
      return
    }
    const dockerConfig = this.configService.get('docker', { infer: true })!
    this.docker = new Dockerode({ socketPath: dockerConfig.socketPath })
    this.logger.log(`Docker 客户端已初始化，socket：${dockerConfig.socketPath}`)
  }

  /**
   * 为指定用户创建并启动一个 neko 容器
   * 包括：分配端口、生成密码、挂载持久化 Volume、设置环境变量
   * @param userId 用户唯一标识
   * @param dirId 目录 ID，与 userId 共同构成容器隔离的唯一键
   * @param launchOptions 启动配置（可选）：扩展挂载目录 + 浏览器启动参数
   * @param launchOptions.extensionHostDir 扩展目录（挂载到容器 /extensions）
   * @param launchOptions.browserLaunchArgs 浏览器启动参数（拼接为 desktop command）
   */
  async createAndStart(userId: string, dirId: string, launchOptions?: {
    extensionHostDir: string | null
    browserLaunchArgs: string[]
  }): Promise<ContainerInfo> {
    const safeUserId = String(userId)
    const safeDirId = String(dirId)
    const nekoConfig = this.configService.get('neko', { infer: true })!
    const containerConfig = this.configService.get('container', { infer: true })!
    const configuredDataDir = this.configService.get('dataDir', { infer: true })!
    const webrtcNat1to1 = this.configService.get('webrtc', { infer: true })!.nat1to1
    const nanoCpus = this.parseNanoCpus(containerConfig.cpuLimit)

    const containerName = `neko-${safeUserId}-${safeDirId}`
    const nekoAdminPassword = randomUUID().slice(0, 12)
    await this.assertHostCpuHealthyForStartup(containerName)

    const dataDir = await getWritableDir(configuredDataDir)
    const nekoBrowserDataPath = nekoConfig.browserDataPath
    const browserDataPath = path.resolve(dataDir, safeUserId, safeDirId)
    let httpPort: number | undefined
    let udpPort: number | undefined

    this.ensureDockerClient()

    try {
      httpPort = await this.portAllocator.allocateHttpPort()
      udpPort = await this.portAllocator.allocateUdpPort()

      await this.removeExistingContainer(containerName)
      await this.prepareBrowserDataDir(browserDataPath)
      await this.cleanupChromiumSingletonFiles(browserDataPath)

      const env = [
        `NEKO_WEBRTC_UDPMUX=${udpPort}`,
        `NEKO_DESKTOP_SCREEN=${nekoConfig.screen}`,
      ]
      if (webrtcNat1to1) {
        env.push(`NEKO_WEBRTC_NAT1TO1=${webrtcNat1to1}`)
      }

      // 完整的浏览器启动命令（用于环境变量和 supervisord browser.conf）
      const browserBinaryPath = nekoConfig.browserBinaryPath
      const desktopCommand = this.buildDesktopCommand(browserBinaryPath, nekoBrowserDataPath, nekoConfig.screen, launchOptions?.browserLaunchArgs)
      env.push(`NEKO_DESKTOP_COMMAND=${desktopCommand}`)
      const browserConfPath = await this.writeBrowserSupervisorConf(dataDir, safeUserId, safeDirId, desktopCommand)
      const nekoServerConfigPath = await this.writeNekoServerConfig(dataDir, safeUserId, safeDirId, nekoAdminPassword)

      const binds = [`${browserDataPath}:${nekoBrowserDataPath}`]
      if (launchOptions?.extensionHostDir) {
        binds.push(`${launchOptions.extensionHostDir}:/extensions:ro`)
      }
      const customFrontendPage = this.configService.get('customFrontendPage', { infer: true })
      if (customFrontendPage) {
        binds.push(`${customFrontendPage}/html-template:/var/www/html-template:ro`)
      }
      binds.push(`${browserConfPath}:/etc/neko/supervisord/browser.conf:ro`)
      binds.push(`${nekoServerConfigPath}:/etc/neko/neko.yaml:ro`)

      this.logger.log(
        `正在创建容器 ${containerName}（HTTP:${httpPort}，UDP:${udpPort}，CPU:${containerConfig.cpuLimit ?? '不限制'}）`,
      )

      const container = await this.docker.createContainer({
        Image: nekoConfig.image,
        name: containerName,
        Labels: {
          'roxy.userId': safeUserId,
          'roxy.dirId': safeDirId,
        },
        Env: env,
        HostConfig: {
          PortBindings: {
            '8080/tcp': [{ HostPort: String(httpPort) }],
            [`${udpPort}/udp`]: [{ HostPort: String(udpPort) }],
          },
          Binds: binds,
          CapAdd: ['SYS_ADMIN'],
          ShmSize: this.parseShmSize(nekoConfig.shmSize),
          ...(nanoCpus ? { NanoCpus: nanoCpus } : {}),
        },
        ExposedPorts: {
          '8080/tcp': {},
          [`${udpPort}/udp`]: {},
        },
      })

      await container.start()
      this.logger.log(`容器 ${containerName} 启动成功`)

      return {
        containerId: container.id,
        containerName,
        httpPort,
        udpPort,
        nekoAdminPassword,
      }
    }
    catch (error: any) {
      await this.cleanupFailedContainerCreation(containerName, httpPort, udpPort)
      this.logger.error(`创建或启动容器 ${containerName} 失败：${error.message}`)
      throw error
    }
  }

  /**
   * 刷新会话活跃时间
   * 任意来自 neko 前端的 HTTP/WS 活动都会调用。
   * 这里会同时维护两套回收条件：
   * 1. 空闲超时：用户长时间没有任何活动
   * 2. 总时长到期：usageExpiresAt 到点后强制清理
   * @param containerId 容器 ID
   * @param containerName 容器名称
   * @param sessionKey userId:dirId 复合键
   * @param usageExpiresAt 总使用时长截止时间戳；传入后会同步刷新硬截止定时器
   */
  touchSession(containerId: string, containerName: string, sessionKey: string, usageExpiresAt?: number): void {
    const idleTimeout = this.configService.get('container', { infer: true })!.stopGracePeriod
    const now = Date.now()
    const lastActivityAt = this.lastActivityAt.get(containerId) ?? 0

    if (usageExpiresAt) {
      this.syncUsageTimer(containerId, containerName, sessionKey, usageExpiresAt)
    }

    this.cancelScheduledStop(containerId)

    if (this.activityTimers.has(containerId) && now - lastActivityAt < 5000) {
      return
    }

    this.lastActivityAt.set(containerId, now)
    this.clearActivityTimer(containerId)

    const timer = setTimeout(async () => {
      this.activityTimers.delete(containerId)
      this.lastActivityAt.delete(containerId)

      const [userId, dirId] = sessionKey.split(':')
      if (userId && dirId) {
        this.logger.log(`会话 ${containerName} 已空闲 ${idleTimeout}ms，开始清理`)
        await this.cleanupUserSession(userId, dirId)
        return
      }

      this.logger.warn(`无效的会话键 ${sessionKey}，回退到停止并移除流程`)
      await this.stopAndRemove(containerId, containerName, sessionKey)
    }, idleTimeout)

    this.activityTimers.set(containerId, timer)
  }

  /**
   * 延迟回收会话
   * 在 grace period 内若用户重连（调用 cancelScheduledStop），则取消回收
   * @param containerId 容器 ID
   * @param containerName 容器名称
   * @param sessionKey userId:dirId 复合键
   */
  async scheduleStop(containerId: string, containerName: string, sessionKey: string): Promise<void> {
    const gracePeriod = this.configService.get('container', { infer: true })!.stopGracePeriod

    this.clearActivityTimer(containerId)

    if (this.stopTimers.has(containerId)) {
      this.logger.log(`${containerName} 的停止定时器已存在，跳过本次调度`)
      return
    }

    this.logger.log(`已为 ${containerName} 安排停止任务，将在 ${gracePeriod}ms 后执行`)

    const timer = setTimeout(async () => {
      this.stopTimers.delete(containerId)
      const [userId, dirId] = sessionKey.split(':')
      if (userId && dirId) {
        await this.cleanupUserSession(userId, dirId)
        return
      }

      this.logger.warn(`无效的会话键 ${sessionKey}，回退到停止并移除流程`)
      await this.stopAndRemove(containerId, containerName, sessionKey)
    }, gracePeriod)

    this.stopTimers.set(containerId, timer)
  }

  /**
   * 取消已计划的容器停止（用户在 grace period 内重连时调用）
   * @returns 是否成功取消
   */
  cancelScheduledStop(containerId: string): boolean {
    const timer = this.stopTimers.get(containerId)
    if (timer) {
      clearTimeout(timer)
      this.stopTimers.delete(containerId)
      this.logger.log(`已取消容器 ${containerId} 的计划停止任务`)
      return true
    }
    return false
  }

  /**
   * 停止并移除容器
   * 停止前先做最终 cookie 抓取、优雅关闭浏览器并上传数据。
   * 容器移除成功后，还会顺带清理宿主机上的会话配置目录和浏览器用户数据目录。
   * @param containerId 容器 ID
   * @param containerName 容器名称
   * @param sessionKey userId:dirId 复合键，用于定位浏览器连接和 cookie 服务
   */
  async stopAndRemove(containerId: string, containerName: string, sessionKey?: string): Promise<boolean> {
    const existingTask = this.stopTasks.get(containerId)
    if (existingTask) {
      this.logger.log(`${containerName} 的停止并移除任务已在执行，等待已有任务完成`)
      return existingTask
    }

    const task = this.performStopAndRemove(containerId, containerName, sessionKey)
    this.stopTasks.set(containerId, task)

    try {
      return await task
    }
    finally {
      this.stopTasks.delete(containerId)
    }
  }

  private async performStopAndRemove(containerId: string, containerName: string, sessionKey?: string): Promise<boolean> {
    this.ensureDockerClient()
    this.clearSessionTimers(containerId)
    this.logger.log(`开始执行 ${containerName} (${containerId}) 的停止并移除`)

    if (sessionKey) {
      this.browserService.markPreStop(sessionKey)
      await this.handlePreStopBrowserShutdown(containerName, sessionKey)
    }

    let info: Dockerode.ContainerInspectInfo | undefined

    try {
      const container = this.docker.getContainer(containerId)
      this.logger.log(`正在检查容器 ${containerName}`)
      info = await container.inspect()
      this.logger.log(`容器 ${containerName} 检查成功，运行中=${info.State.Running}`)

      if (info.State.Running) {
        this.logger.log(`正在停止容器 ${containerName}`)
        await container.stop({ t: 10 })
        this.logger.log(`容器 ${containerName} 已停止`)
      }

      this.logger.log(`正在移除容器 ${containerName}`)
      try {
        await container.remove()
        this.logger.log(`容器 ${containerName} 已移除`)
      }
      catch (error: any) {
        if (error?.statusCode === 404) {
          this.logger.warn(`容器 ${containerName} 在清理完成前已被移除`)
        }
        else if (this.isContainerRemovalInProgressError(error)) {
          this.logger.warn(`容器 ${containerName} 的移除操作已在进行中，等待完成`)
          const removed = await this.waitForContainerRemoval(containerId, containerName)
          if (!removed) {
            return false
          }
          this.logger.log(`容器 ${containerName} 已移除`)
        }
        else {
          throw error
        }
      }

      await this.cleanupBrowserSupervisorConf(info)
      this.logger.log(`${containerName} 的配置清理完成`)
      await this.cleanupBrowserDataDir(info)
      this.logger.log(`${containerName} 的浏览器数据清理完成`)
      return true
    }
    catch (error: any) {
      if (error.statusCode !== 404) {
        this.logger.error(`停止或移除 ${containerName} 失败：${error.message}`)
        return false
      }
      else {
        this.logger.warn(`容器 ${containerName} 在清理完成前已被移除`)
        return true
      }
    }
    finally {
      if (sessionKey) {
        this.browserService.clearPreStop(sessionKey)
      }
    }
  }

  /**
   * 容器停止前的浏览器回收链路。
   * 顺序固定为：最终抓 cookie -> 优雅关闭浏览器 -> 等 roxy_tabs 落盘 -> 上传会话数据。
   */
  private async handlePreStopBrowserShutdown(containerName: string, sessionKey: string): Promise<void> {
    this.logger.log(`开始执行 ${containerName} 的停止前清理，会话键=${sessionKey}`)
    this.browserItemService.markPreStop(sessionKey)

    try {
      this.logger.log(`开始执行 ${containerName} 的最终 Cookie 抓取`)
      await this.runWithTimeout(
        this.browserItemService.captureCookiesBeforeStop(sessionKey),
        PRE_STOP_COOKIE_CAPTURE_TIMEOUT_MS,
        `${containerName} 的停止前 Cookie 抓取超时`,
      )
      this.logger.log(`${containerName} 的最终 Cookie 抓取完成`)

      this.logger.log(`开始优雅关闭 ${containerName} 的浏览器`)
      await this.runWithTimeout(
        this.browserService.gracefulClose(sessionKey),
        PRE_STOP_BROWSER_CLOSE_TIMEOUT_MS,
        `${containerName} 的浏览器优雅关闭超时`,
      )
      this.logger.log(`${containerName} 的浏览器优雅关闭完成`)

      this.logger.log(`等待 ${containerName} 的 roxy_tabs 文件落盘`)
      const roxyTabsReady = await this.browserItemService.waitForRoxyTabs(
        sessionKey,
        PRE_STOP_ROXY_TABS_TIMEOUT_MS,
      )
      if (!roxyTabsReady) {
        this.logger.warn(`${containerName} 的 roxy_tabs 在上传前未就绪，回退为默认打开地址`)
      }

      this.logger.log(`开始执行 ${containerName} 的停止前上传`)
      await this.runWithTimeout(
        this.browserItemService.uploadDataBeforeStop(sessionKey),
        PRE_STOP_UPLOAD_TIMEOUT_MS,
        `${containerName} 的停止前上传超时`,
      )
      this.logger.log(`${containerName} 的停止前上传完成`)
    }
    finally {
      this.browserItemService.cleanup(sessionKey)
      this.logger.log(`${containerName} 的浏览器项清理完成`)
    }
  }

  /**
   * 完整清理用户会话
   * 停止容器 + 释放端口 + 删除 Redis 中所有相关记录
   * @param userId 用户 ID
   * @param dirId 目录 ID
   */
  async cleanupUserSession(userId: string, dirId: string): Promise<void> {
    const sessionKey = `${userId}:${dirId}`
    const existingTask = this.cleanupTasks.get(sessionKey)
    if (existingTask) {
      this.logger.log(`会话清理任务已在执行，用户=${userId}，目录 ID=${dirId}，等待已有任务完成`)
      await existingTask
      return
    }

    const task = this.performCleanupUserSession(userId, dirId, sessionKey)
    this.cleanupTasks.set(sessionKey, task)

    try {
      await task
    }
    finally {
      this.cleanupTasks.delete(sessionKey)
    }
  }

  private async performCleanupUserSession(userId: string, dirId: string, sessionKey: string): Promise<void> {
    const redisKey = `user_container:${userId}:${dirId}`
    this.logger.log(`开始执行会话清理，用户=${userId}，目录 ID=${dirId}`)
    const mapping = await this.redisService.get(redisKey)
    const sessionSnapshot = this.sessionSnapshots.get(sessionKey)
    if (!mapping && !sessionSnapshot) {
      this.logger.warn(`未找到会话映射，用户=${userId}，目录 ID=${dirId}`)
      return
    }

    const mappingData = mapping
      ? JSON.parse(mapping) as {
        containerId: string
        sessionId?: string
        httpPort: number
        udpPort: number
      }
      : undefined
    const containerId = mappingData?.containerId ?? sessionSnapshot!.containerId
    const sessionId = mappingData?.sessionId ?? sessionSnapshot?.sessionId
    const httpPort = mappingData?.httpPort ?? sessionSnapshot!.httpPort
    const udpPort = mappingData?.udpPort ?? sessionSnapshot!.udpPort
    const containerName = sessionSnapshot?.containerName ?? `neko-${userId}-${dirId}`

    if (!mapping && sessionSnapshot) {
      this.logger.warn(`Redis 中缺少会话映射，用户=${userId}，目录 ID=${dirId}，回退到内存会话快照`)
    }

    this.logger.log(
      `已加载清理映射，用户=${userId}，目录 ID=${dirId}，`
      + `容器 ID=${containerId}，HTTP 端口=${httpPort}，UDP 端口=${udpPort}，会话 ID=${sessionId ?? '无'}`,
    )

    // 用最近一次心跳时间近似“用户断开连接时间”，避免把容器空闲回收等待时间也计入 usedMs。
    const { usedMs, sessionContext } = await this.getSessionRuntimeInfo(sessionId, sessionSnapshot)
    const reportContext = sessionSnapshot?.sessionContext ?? sessionContext
    this.logger.log(`会话 ${sessionKey} 已使用时长 ${usedMs ?? '未知'}ms`)
    if (sessionId && usedMs != null) {
      await this.browserItemService.reportCloudBrowserDisconnected(sessionId, sessionKey, usedMs, reportContext)
    }

    this.clearSessionTimers(containerId)
    this.logger.log(`已清理 ${containerId} 的内存定时器`)

    const stopped = await this.stopAndRemove(containerId, containerName, sessionKey)
    if (!stopped) {
      this.logger.error(`由于停止并移除容器失败，终止会话清理，用户=${userId}，目录 ID=${dirId}`)
      return
    }
    this.logger.log(`停止并移除容器已完成，用户=${userId}，目录 ID=${dirId}`)
    this.logger.log(`开始为 ${containerId} 释放 HTTP 端口 ${httpPort}`)
    await this.portAllocator.releaseHttpPort(httpPort)
    this.logger.log(`已为 ${containerId} 释放 HTTP 端口 ${httpPort}`)
    this.logger.log(`开始为 ${containerId} 释放 UDP 端口 ${udpPort}`)
    await this.portAllocator.releaseUdpPort(udpPort)
    this.logger.log(`已为 ${containerId} 释放 UDP 端口 ${udpPort}`)
    this.logger.log(`开始删除 Redis 映射 ${redisKey}`)
    await this.redisService.del(redisKey)
    if (sessionId) {
      this.logger.log(`开始删除会话 ID=${sessionId} 对应的 Redis Key`)
      await this.redisService.del(`session_container:${sessionId}`)
      await this.redisService.del(`session_port:${sessionId}`)
    }
    this.sessionSnapshots.delete(sessionKey)

    this.logger.log(`会话清理完成，用户=${userId}，目录 ID=${dirId}`)
  }

  /** 列出所有 neko 前缀的容器（包括已停止的） */
  async listNekoContainers(): Promise<Dockerode.ContainerInfo[]> {
    this.ensureDockerClient()
    const containers = await this.docker.listContainers({ all: true })
    return containers.filter(c =>
      c.Names.some(name => name.startsWith('/neko-')),
    )
  }

  /**
   * 服务启动时同步状态
   * 扫描 Docker 中所有 neko 容器，通过 Labels 中存储的 userId/dirId 对比 Redis 记录：
   * - 有 Redis 记录的保留
   * - 无记录的孤儿容器执行清理
   */
  async syncOnStartup(): Promise<void> {
    this.logger.log('启动时开始同步容器状态...')

    const containers = await this.listNekoContainers()
    const knownContainerIds = new Set<string>()

    const httpPorts = await this.portAllocator.getAllocatedHttpPorts()
    const udpPorts = await this.portAllocator.getAllocatedUdpPorts()

    for (const containerInfo of containers) {
      const containerName = containerInfo.Names[0]?.replace('/', '') || ''
      const userId = containerInfo.Labels?.['roxy.userId']
      const dirId = containerInfo.Labels?.['roxy.dirId']

      if (userId && dirId) {
        const mapping = await this.redisService.get(`user_container:${userId}:${dirId}`)
        if (mapping) {
          const sessionData = await this.loadTrackedSessionFromMapping(mapping)
          if (!sessionData) {
            this.logger.warn(`容器 ${containerName} 的 Redis 映射不完整，按孤儿容器清理`)
            const sessionKey = `${userId}:${dirId}`
            await this.stopAndRemove(containerInfo.Id, containerName, sessionKey)
            continue
          }

          if (sessionData.containerId !== containerInfo.Id) {
            this.logger.warn(`容器 ${containerName} 与 Redis 记录的容器 ID 不一致，按孤儿容器清理`)
            const sessionKey = `${userId}:${dirId}`
            await this.stopAndRemove(containerInfo.Id, containerName, sessionKey)
            continue
          }

          const sessionState = getSessionState(sessionData)
          if (sessionState !== 'active') {
            this.logger.warn(`容器 ${containerName} 对应的会话已过期（${sessionState}），开始清理`)
            await this.cleanupUserSession(userId, dirId)
            continue
          }

          knownContainerIds.add(containerInfo.Id)
          this.restoreTrackedSession(sessionData)
          continue
        }
      }

      this.logger.warn(`发现孤儿容器 ${containerName}，正在移除...`)
      const sessionKey = userId && dirId ? `${userId}:${dirId}` : undefined
      await this.stopAndRemove(containerInfo.Id, containerName, sessionKey)
    }

    this.logger.log(
      `启动同步完成：活跃容器 ${knownContainerIds.size} 个，`
      + `已移除孤儿容器 ${containers.length - knownContainerIds.size} 个，`
      + `已分配 HTTP 端口 ${httpPorts.length} 个，UDP 端口 ${udpPorts.length} 个`,
    )
  }

  /** 移除已存在的同名容器（创建新容器前的清理） */
  private async removeExistingContainer(name: string): Promise<void> {
    this.ensureDockerClient()
    try {
      const existing = this.docker.getContainer(name)
      const info = await existing.inspect()
      if (info.State.Running)
        await existing.stop({ t: 5 })
      await existing.remove()
      this.logger.log(`已移除现有容器 ${name}`)
    }
    catch (error: any) {
      if (error.statusCode !== 404)
        throw error
    }
  }

  private async cleanupFailedContainerCreation(
    containerName: string,
    httpPort?: number,
    udpPort?: number,
  ): Promise<void> {
    try {
      await this.removeExistingContainer(containerName)
    }
    catch (error: any) {
      this.logger.warn(`回滚容器 ${containerName} 失败：${error.message}`)
    }

    if (httpPort != null) {
      try {
        await this.portAllocator.releaseHttpPort(httpPort)
      }
      catch (error: any) {
        this.logger.warn(`回滚 HTTP 端口 ${httpPort} 失败：${error.message}`)
      }
    }

    if (udpPort != null) {
      try {
        await this.portAllocator.releaseUdpPort(udpPort)
      }
      catch (error: any) {
        this.logger.warn(`回滚 UDP 端口 ${udpPort} 失败：${error.message}`)
      }
    }
  }

  /** 将人类可读的内存大小字符串（如 2g、512m）转为字节数 */
  private parseShmSize(size: string): number {
    const match = size.match(SHM_SIZE_PATTERN)
    if (!match)
      return 2 * 1024 * 1024 * 1024
    const num = Number.parseInt(match[1], 10)
    switch (match[2]?.toLowerCase()) {
      case 'g': return num * 1024 * 1024 * 1024
      case 'm': return num * 1024 * 1024
      case 'k': return num * 1024
      default: return num
    }
  }

  /** Docker HostConfig 使用十亿分之一核表示 CPU 上限 */
  private parseNanoCpus(cpuLimit?: number): number | undefined {
    if (!cpuLimit) {
      return undefined
    }
    return Math.max(1, Math.round(cpuLimit * 1_000_000_000))
  }

  /**
   * 启动前先采样宿主机 CPU 使用率，避免在机器已经过载时继续拉起新的浏览器容器。
   * 这里直接拦截新启动，而不是等 Chromium 启动失败后再回滚，能减少宿主机雪崩风险。
   */
  private async assertHostCpuHealthyForStartup(containerName: string): Promise<void> {
    const containerConfig = this.configService.get('container', { infer: true })!
    const currentCpuUsage = await this.measureCpuUsagePercent(containerConfig.startCpuSampleIntervalMs)
    const currentCpuUsageText = currentCpuUsage.toFixed(2)
    const thresholdText = containerConfig.startCpuUsageLimit.toFixed(2)

    if (currentCpuUsage < containerConfig.startCpuUsageLimit) {
      this.logger.debug(
        `容器 ${containerName} 启动前 CPU 检查通过：当前 ${currentCpuUsageText}% ，阈值 ${thresholdText}%`,
      )
      return
    }

    this.logger.warn(
      `容器 ${containerName} 启动前 CPU 使用率过高：当前 ${currentCpuUsageText}% ，阈值 ${thresholdText}% ，已拒绝启动`,
    )
    throw new ServiceUnavailableException(
      '当前服务器较拥挤，暂时无法打开云浏览器，请稍后再试',
    )
  }

  /**
   * 用短时间窗口采样整机 CPU 占用。
   * 基于两次 CPU 时间片快照计算差值，兼容 Linux/Windows，不依赖平台特定命令。
   */
  private async measureCpuUsagePercent(sampleIntervalMs: number): Promise<number> {
    const normalizedIntervalMs = Math.max(200, sampleIntervalMs)
    const start = this.captureCpuTimes()
    await delay(normalizedIntervalMs)
    const end = this.captureCpuTimes()

    const totalDiff = end.total - start.total
    const idleDiff = end.idle - start.idle

    if (totalDiff <= 0) {
      return 0
    }

    return Number((((totalDiff - idleDiff) / totalDiff) * 100).toFixed(2))
  }

  /** 聚合所有 CPU 核心的 idle/total 时间，供差值采样复用。 */
  private captureCpuTimes(): { idle: number, total: number } {
    return os.cpus().reduce(
      (accumulator, cpu) => {
        const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
        return {
          idle: accumulator.idle + cpu.times.idle,
          total: accumulator.total + total,
        }
      },
      { idle: 0, total: 0 },
    )
  }

  /** 清理 Chromium 用户数据目录中的单例锁文件，避免启动时因残留锁导致失败 */
  private async cleanupChromiumSingletonFiles(browserDataPath: string): Promise<void> {
    const singletonFiles = ['SingletonCookie', 'SingletonLock', 'SingletonSocket']
    await Promise.all(singletonFiles.map(async (fileName) => {
      const targetPath = path.resolve(browserDataPath, fileName)
      try {
        await rm(targetPath, { force: true })
      }
      catch (error: any) {
        this.logger.warn(`删除单例文件失败：${targetPath}，${error.message}`)
      }
    }))
  }

  /**
   * 提前准备浏览器用户数据目录，避免 Docker 自动创建 root:root 目录后导致容器内 neko 用户无写权限。
   * Chromium 启动时必须能在整个 profile 树下写入锁文件、缓存和数据库文件。
   */
  private async prepareBrowserDataDir(browserDataPath: string): Promise<void> {
    await mkdir(browserDataPath, { recursive: true, mode: 0o777 })
    await this.ensureWritableRecursively(browserDataPath)
  }

  /**
   * 浏览器缓存来自宿主机预处理与 OSS 解压，默认权限可能只允许 root 写入。
   * 这里在挂载前递归修正整个 profile 树权限，避免容器内 neko 用户无法更新 Chromium 数据文件。
   */
  private async ensureWritableRecursively(targetPath: string): Promise<void> {
    await chmod(targetPath, 0o777)

    const entries = await readdir(targetPath, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.resolve(targetPath, entry.name)

      if (entry.isSymbolicLink()) {
        return
      }

      if (entry.isDirectory()) {
        await this.ensureWritableRecursively(entryPath)
        return
      }

      await chmod(entryPath, 0o666)
    }))
  }

  /** 组装容器内浏览器启动命令 */
  private buildDesktopCommand(
    browserBinaryPath: string,
    browserDataPath: string,
    screen: string,
    browserLaunchArgs?: string[],
  ): string {
    if (browserLaunchArgs?.length) {
      return `${browserBinaryPath} ${browserLaunchArgs.join(' ')}`
    }
    const windowSize = this.parseWindowSize(screen)
    return `${browserBinaryPath} --user-data-dir=${browserDataPath} --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu-sandbox --no-first-run --no-default-browser-check --disable-infobars --remote-debugging-port=0 --remote-debugging-address=0.0.0.0 --start-maximized --window-size=${windowSize} --window-position=0,0`
  }

  /** 将 NEKO_DESKTOP_SCREEN 转为 Chromium 的 --window-size 参数值 */
  private parseWindowSize(screen: string): string {
    const match = screen.match(SCREEN_SIZE_PATTERN)
    if (!match) {
      return '1920,1080'
    }
    return `${match[1]},${match[2]}`
  }

  /** 生成并写入 browser.conf（按 userId/dirId 隔离） */
  private async writeBrowserSupervisorConf(dataDir: string, userId: string, dirId: string, command: string): Promise<string> {
    const supervisorDir = path.resolve(dataDir, 'supervisord', userId, dirId)
    await mkdir(supervisorDir, { recursive: true })
    const browserConfPath = path.resolve(supervisorDir, 'browser.conf')
    await writeFile(browserConfPath, this.buildBrowserSupervisorConf(command), 'utf8')
    return browserConfPath
  }

  /** 生成并写入 neko.yaml，固定为单管理员账号模式 */
  private async writeNekoServerConfig(dataDir: string, userId: string, dirId: string, credential: string): Promise<string> {
    const supervisorDir = path.resolve(dataDir, 'supervisord', userId, dirId)
    await mkdir(supervisorDir, { recursive: true })
    const nekoConfigPath = path.resolve(supervisorDir, 'neko.yaml')
    await writeFile(nekoConfigPath, this.buildNekoServerConfig(credential), 'utf8')
    return nekoConfigPath
  }

  /** 渲染 supervisord browser.conf 内容 */
  private buildBrowserSupervisorConf(command: string): string {
    return `[program:browser]
environment=HOME="/home/neko",USER="neko",DISPLAY=":99.0",PULSE_SERVER="unix:/tmp/pulseaudio.socket",XDG_RUNTIME_DIR="/tmp/runtime-neko"
command=${command}
autorestart=false
priority=900
user=neko
stdout_logfile=/var/log/neko/browser.log
stdout_logfile_maxbytes=100MB
stdout_logfile_backups=10
redirect_stderr=true
`
  }

  /** 渲染 neko v3 配置，禁用游客并仅允许固定管理员账号登录 */
  private buildNekoServerConfig(credential: string): string {
    const quotedCredential = JSON.stringify(credential)
    const audioBitrate = this.configService.get('neko', { infer: true })!.audioBitrate

    return `server:
  proxy: true
capture:
  audio:
    codec: "opus"
    pipeline: |
      pulsesrc device={device}
        ! audioconvert
        ! audioresample
        ! queue
        ! opusenc bitrate=${audioBitrate}
        ! appsink name=appsink
  video:
    codec: "vp8"
    pipeline: |
      ximagesrc display-name={display} show-pointer=false use-damage=false
        ! videoconvert
        ! queue
        ! vp8enc
        ! appsink name=appsink
member:
  provider: "object"
  object:
    users:
      - username: ${quotedCredential}
        password: ${quotedCredential}
        profile:
          name: ${quotedCredential}
          is_admin: true
          can_login: true
          can_connect: true
          can_watch: true
          can_host: true
          can_share_media: true
          can_access_clipboard: true
          sends_inactive_cursor: false
          can_see_inactive_cursors: false
session:
  inactive_cursors: false
  locked_logins: true
  cookie:
    enabled: false
`
  }

  /** 清理会话对应的 neko/brower 配置目录 */
  private async cleanupBrowserSupervisorConf(info: Dockerode.ContainerInspectInfo): Promise<void> {
    const userId = info.Config?.Labels?.['roxy.userId']
    const dirId = info.Config?.Labels?.['roxy.dirId']
    if (!userId || !dirId) {
      return
    }
    try {
      const configuredDataDir = this.configService.get('dataDir', { infer: true })!
      const dataDir = await getWritableDir(configuredDataDir)
      const supervisorDir = path.resolve(dataDir, 'supervisord', userId, dirId)
      await rm(supervisorDir, { recursive: true, force: true })
    }
    catch (error: any) {
      this.logger.warn(`清理 ${userId}/${dirId} 的会话配置失败：${error.message}`)
    }
  }

  /** 清理会话对应的浏览器用户数据目录 */
  private async cleanupBrowserDataDir(info: Dockerode.ContainerInspectInfo): Promise<void> {
    const userId = info.Config?.Labels?.['roxy.userId']
    const dirId = info.Config?.Labels?.['roxy.dirId']
    if (!userId || !dirId) {
      return
    }
    try {
      const configuredDataDir = this.configService.get('dataDir', { infer: true })!
      const dataDir = await getWritableDir(configuredDataDir)
      const browserDataDir = path.resolve(dataDir, userId, dirId)
      await rm(browserDataDir, { recursive: true, force: true })
    }
    catch (error: any) {
      this.logger.warn(`清理 ${userId}/${dirId} 的浏览器数据失败：${error.message}`)
    }
  }

  private clearActivityTimer(containerId: string): void {
    const timer = this.activityTimers.get(containerId)
    if (timer) {
      clearTimeout(timer)
      this.activityTimers.delete(containerId)
    }
    this.lastActivityAt.delete(containerId)
  }

  /** 清理总使用时长到期定时器，避免重复触发强制回收 */
  private clearUsageTimer(containerId: string): void {
    const timer = this.usageTimers.get(containerId)
    if (timer) {
      clearTimeout(timer)
      this.usageTimers.delete(containerId)
    }
  }

  /** 清理会话相关的所有本地定时器，包括空闲回收和总时长回收 */
  private clearSessionTimers(containerId: string): void {
    const stopTimer = this.stopTimers.get(containerId)
    if (stopTimer) {
      clearTimeout(stopTimer)
      this.stopTimers.delete(containerId)
    }
    this.clearActivityTimer(containerId)
    this.clearUsageTimer(containerId)
  }

  /**
   * 同步总使用时长到期定时器。
   * 每次心跳都会重新计算剩余时长，保证会话一旦达到 usageExpiresAt 就立即触发清理。
   */
  private syncUsageTimer(
    containerId: string,
    containerName: string,
    sessionKey: string,
    usageExpiresAt: number,
  ): void {
    this.clearUsageTimer(containerId)

    const remainingMs = usageExpiresAt - Date.now()
    if (remainingMs <= 0) {
      this.logger.log(`会话 ${containerName} 的使用时长已耗尽，立即清理`)
      void this.cleanupBySessionKey(containerId, containerName, sessionKey)
      return
    }

    const timer = setTimeout(async () => {
      this.usageTimers.delete(containerId)
      this.logger.log(`会话 ${containerName} 已到使用时长截止时间，开始清理`)
      await this.cleanupBySessionKey(containerId, containerName, sessionKey)
    }, remainingMs)

    this.usageTimers.set(containerId, timer)
  }

  /**
   * 通过统一的 sessionKey 入口执行回收。
   * 这样无论是空闲超时还是总时长到期，最终都走同一条 cleanupUserSession 流程。
   */
  private async cleanupBySessionKey(containerId: string, containerName: string, sessionKey: string): Promise<void> {
    const [userId, dirId] = sessionKey.split(':')
    if (userId && dirId) {
      await this.cleanupUserSession(userId, dirId)
      return
    }

    this.logger.warn(`无效的会话键 ${sessionKey}，回退到停止并移除流程`)
    await this.stopAndRemove(containerId, containerName, sessionKey)
  }

  private async runWithTimeout(
    task: Promise<void>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<void> {
    try {
      await Promise.race([
        task,
        (async () => {
          await delay(timeoutMs)
          throw new Error(timeoutMessage)
        })(),
      ])
    }
    catch (error: any) {
      this.logger.warn(error?.message || timeoutMessage)
    }
  }

  private isContainerRemovalInProgressError(error: any): boolean {
    return error?.statusCode === 409 && CONTAINER_REMOVAL_IN_PROGRESS_PATTERN.test(error?.message ?? '')
  }

  private async loadTrackedSessionFromMapping(mapping: string): Promise<TrackedSessionData | null> {
    const mappingData = JSON.parse(mapping) as { sessionId?: string }
    if (!mappingData.sessionId) {
      return null
    }

    const sessionJson = await this.redisService.get(`session_container:${mappingData.sessionId}`)
    if (!sessionJson) {
      return null
    }

    return normalizeSessionData(JSON.parse(sessionJson) as SessionData)
  }

  private restoreTrackedSession(sessionData: TrackedSessionData): void {
    this.syncSessionSnapshot(sessionData)

    const sessionKey = `${sessionData.userId}:${sessionData.dirId}`
    const now = Date.now()
    this.clearSessionTimers(sessionData.containerId)
    this.cancelScheduledStop(sessionData.containerId)
    this.lastActivityAt.set(sessionData.containerId, sessionData.lastSeenAt)

    if (sessionData.usageExpiresAt === sessionData.expiresAt) {
      this.syncUsageTimer(
        sessionData.containerId,
        sessionData.containerName,
        sessionKey,
        sessionData.usageExpiresAt,
      )
      return
    }

    const remainingMs = sessionData.expiresAt - now
    if (remainingMs <= 0) {
      void this.cleanupUserSession(sessionData.userId, sessionData.dirId)
      return
    }

    const timer = setTimeout(async () => {
      this.activityTimers.delete(sessionData.containerId)
      this.lastActivityAt.delete(sessionData.containerId)
      this.logger.log(`恢复的会话 ${sessionData.containerName} 已空闲到期，开始清理`)
      await this.cleanupUserSession(sessionData.userId, sessionData.dirId)
    }, remainingMs)

    this.activityTimers.set(sessionData.containerId, timer)
  }

  /**
   * 从 Redis 会话数据推导本次浏览器已使用时长。
   * 优先使用 lastSeenAt 作为断开近似时间，避免把 idle grace period 算进 usedMs。
   */
  private async getSessionRuntimeInfo(
    sessionId?: string,
    sessionSnapshot?: Pick<SessionSnapshot, 'createdAt' | 'lastSeenAt' | 'sessionContext'>,
  ): Promise<{
    usedMs: number | null
    sessionContext?: SessionContext
  }> {
    if (!sessionId) {
      return this.getSessionRuntimeInfoFromSnapshot(sessionSnapshot)
    }

    try {
      const sessionJson = await this.redisService.get(`session_container:${sessionId}`)
      if (!sessionJson) {
        if (sessionSnapshot) {
          this.logger.warn(`会话 ID=${sessionId} 的 Redis 会话数据缺失，回退到内存会话快照计算已用时长`)
        }
        return this.getSessionRuntimeInfoFromSnapshot(sessionSnapshot)
      }

      const sessionData = JSON.parse(sessionJson) as {
        createdAt?: number
        lastSeenAt?: number
        sessionContext?: SessionContext
      }
      if (typeof sessionData.createdAt !== 'number') {
        return {
          usedMs: null,
          sessionContext: sessionData.sessionContext,
        }
      }

      const disconnectAt = typeof sessionData.lastSeenAt === 'number'
        ? sessionData.lastSeenAt
        : Date.now()

      return {
        usedMs: Math.max(0, disconnectAt - sessionData.createdAt),
        sessionContext: sessionData.sessionContext,
      }
    }
    catch (error: any) {
      this.logger.warn(`计算会话 ID=${sessionId} 的已用时长失败：${error.message}`)
      return this.getSessionRuntimeInfoFromSnapshot(sessionSnapshot)
    }
  }

  private getSessionRuntimeInfoFromSnapshot(
    sessionSnapshot?: Pick<SessionSnapshot, 'createdAt' | 'lastSeenAt' | 'sessionContext'>,
  ): {
    usedMs: number | null
    sessionContext?: SessionContext
  } {
    if (!sessionSnapshot || typeof sessionSnapshot.createdAt !== 'number') {
      return { usedMs: null, sessionContext: sessionSnapshot?.sessionContext }
    }

    const disconnectAt = typeof sessionSnapshot.lastSeenAt === 'number'
      ? sessionSnapshot.lastSeenAt
      : Date.now()

    return {
      usedMs: Math.max(0, disconnectAt - sessionSnapshot.createdAt),
      sessionContext: sessionSnapshot.sessionContext,
    }
  }

  /**
   * Docker 返回 409 removal already in progress 时，等待另一条清理链路完成实际删除。
   * 只有确认容器已不可 inspect 后，才继续做本地目录和 Redis 清理。
   */
  private async waitForContainerRemoval(containerId: string, containerName: string): Promise<boolean> {
    const deadline = Date.now() + CONTAINER_REMOVAL_WAIT_TIMEOUT_MS

    while (Date.now() < deadline) {
      try {
        await this.docker.getContainer(containerId).inspect()
      }
      catch (error: any) {
        if (error?.statusCode === 404) {
          return true
        }

        this.logger.error(`等待 ${containerName} 移除完成时出错：${error.message}`)
        return false
      }

      await delay(CONTAINER_REMOVAL_POLL_INTERVAL_MS)
    }

    this.logger.error(`等待 ${containerName} 移除完成超时`)
    return false
  }
}
