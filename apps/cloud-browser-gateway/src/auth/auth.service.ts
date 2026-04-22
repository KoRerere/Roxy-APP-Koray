import type { SessionContext } from '../browser/browser-item/browserItem'
import type { SessionData } from '../session/session-state'
import type {
  ConnectDto,
  ConnectResponseDto,
  HeartbeatResponseDto,
} from './dto/connect.dto'
import type { Configuration } from '~/config/configuration'
import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { API } from '~/api'
import { commonHeaders } from '~/constants/common'
import { BrowserItemService } from '../browser/browser-item.service'
import { BrowserService } from '../browser/browser.service'
import { ContainerService } from '../container/container.service'
import { RedisService } from '../redis/redis.service'
import { getSessionState, normalizeSessionData } from '../session/session-state'

const SESSION_METADATA_RETENTION_MS = 5 * 60 * 1000

/**
 * 鉴权与会话服务。
 * 负责对接第三方鉴权、创建/复用云浏览器会话，并维护 Redis 中的会话生命周期数据。
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly redisService: RedisService,
    private readonly containerService: ContainerService,
    private readonly browserService: BrowserService,
    private readonly browserItemService: BrowserItemService,
  ) {}

  /**
   * 连接云浏览器核心流程：
   * 1. 验证用户身份
   * 2. 初始化 BrowserItem 并执行启动前任务（指纹/缓存/扩展等）
   * 3. 创建或复用容器（含扩展挂载）
   * 4. 后台连接浏览器并执行启动后任务
   * 5. 返回 sessionId 与直连地址
   */
  async connect(dto: ConnectDto): Promise<ConnectResponseDto> {
    const userId = String(await this.verifyWithThirdParty(dto))
    const { dirId } = dto
    const redisKey = this.getUserContainerKey(userId, dirId)

    const existingMapping = await this.redisService.get(redisKey)
    const sessionContext = this.createSessionContext(dto)
    const remainingUsageMs = await this.getVerifiedRemainingUsageMs(sessionContext)

    if (remainingUsageMs <= 0) {
      if (existingMapping) {
        await this.containerService.cleanupUserSession(userId, dirId)
      }
      throw new UnauthorizedException('云浏览器剩余可用时长不足')
    }

    let sessionData: SessionData

    if (existingMapping) {
      const reusableSession = await this.loadReusableSession(
        existingMapping,
        userId,
        dirId,
        sessionContext,
        remainingUsageMs,
      )

      if (reusableSession) {
        sessionData = reusableSession
        this.logger.log(`复用现有容器 ${sessionData.containerName}，用户=${userId}，目录 ID=${dirId}`)
      }
      else {
        sessionData = await this.createNewSession(userId, dirId, sessionContext, remainingUsageMs)
      }
    }
    else {
      sessionData = await this.createNewSession(userId, dirId, sessionContext, remainingUsageMs)
    }

    await this.saveSessionData(sessionData)
    this.containerService.trackSession(sessionData)

    return {
      sessionId: sessionData.sessionId,
      connectUrl: this.buildConnectUrl(sessionData.sessionId),
      webrtcUdpPort: sessionData.udpPort,
    }
  }

  /**
   * 心跳续期。
   * 仅刷新“空闲超时”窗口，不会突破 usageExpiresAt 代表的总使用时长上限。
   */
  async heartbeat(sessionId: string): Promise<HeartbeatResponseDto> {
    const sessionJson = await this.redisService.get(this.getSessionContainerKey(sessionId))
    if (!sessionJson) {
      throw new UnauthorizedException('会话无效或已过期')
    }

    const normalizedSession = normalizeSessionData(JSON.parse(sessionJson) as SessionData)
    await this.ensureSessionActive(normalizedSession)

    const sessionData = this.refreshSessionLifetime(normalizedSession)
    await this.saveSessionData(sessionData)
    this.containerService.trackSession(sessionData)

    return {
      success: true,
      lastSeenAt: sessionData.lastSeenAt,
      expiresAt: sessionData.expiresAt,
      usageExpiresAt: sessionData.usageExpiresAt,
    }
  }

  /**
   * 调用业务后端校验 token/workspaceId，并取回当前登录用户 ID。
   * 只有这里通过后，网关才会继续分配容器资源。
   */
  private async verifyWithThirdParty(dto: ConnectDto): Promise<string> {
    const apiBaseUrl = this.configService.get('apiBaseUrl', { infer: true })!
    const userInfoApiUrl = `${apiBaseUrl}/user_get_user_info`

    try {
      const { data: { code, data, msg } } = await axios.get(userInfoApiUrl, {
        headers: {
          ...commonHeaders,
          token: dto.token,
          workspaceId: dto.workspaceId,
        },
      })
      if (code !== 0)
        throw new UnauthorizedException(msg)
      if (!data?.id)
        throw new UnauthorizedException('第三方鉴权返回数据缺少 userId')

      return String(data.id)
    }
    catch (error: any) {
      if (error instanceof UnauthorizedException)
        throw error
      this.logger.error(`第三方鉴权失败：${error.message}`)
      throw new UnauthorizedException('第三方鉴权失败')
    }
  }

  /**
   * 创建全新的云浏览器会话。
   * 这里会完成启动前文件准备、容器创建、后台连接浏览器，以及会话时间窗口初始化。
   */
  private async createNewSession(
    userId: string,
    dirId: string,
    sessionContext: SessionContext,
    remainingUsageMs: number,
  ): Promise<SessionData> {
    const sessionKey = `${userId}:${dirId}`

    // 1. 初始化 BrowserItem 并执行启动前任务（文件预处理 + 扩展下载 + 生成启动参数）
    const { launchResult } = await this.browserItemService.initAndPrepare(
      sessionKey,
      sessionContext,
      dirId,
    )
    const launchOptions = {
      extensionHostDir: launchResult.extensionHostDir,
      browserLaunchArgs: launchResult.browserLaunchArgs,
    }

    // 2. 创建并启动容器（NEKO_DESKTOP_COMMAND 含完整浏览器启动参数）
    const containerInfo = await this.containerService.createAndStart(userId, dirId, launchOptions)

    // 3. 后台连接浏览器并启动后置任务
    this.browserService.connect(sessionKey, containerInfo.containerId, {
      onDisconnected: async () => {
        this.logger.warn(`浏览器进程已断开，开始清理会话，会话键=${sessionKey}`)
        await this.containerService.cleanupUserSession(userId, dirId)
      },
    })
      .then(browser => this.browserItemService.onBrowserConnected(sessionKey, browser))
      .catch(err => this.logger.error(`浏览器连接或启动后任务执行失败，会话键=${sessionKey}：${err.message}`))

    const now = Date.now()
    const usageExpiresAt = now + remainingUsageMs
    return {
      sessionId: containerInfo.nekoAdminPassword,
      userId,
      dirId,
      containerId: containerInfo.containerId,
      containerName: containerInfo.containerName,
      httpPort: containerInfo.httpPort,
      udpPort: containerInfo.udpPort,
      nekoAdminPassword: containerInfo.nekoAdminPassword,
      createdAt: now,
      lastSeenAt: now,
      usageExpiresAt,
      expiresAt: this.getEffectiveExpiresAt(now, usageExpiresAt),
      sessionContext,
    }
  }

  private createSessionContext(dto: ConnectDto): SessionContext {
    const workspaceId = Number(dto.workspaceId)
    if (!Number.isFinite(workspaceId)) {
      throw new UnauthorizedException('workspaceId 无效')
    }

    return {
      token: dto.token,
      workspaceId,
    }
  }

  private async getVerifiedRemainingUsageMs(sessionContext: SessionContext): Promise<number> {
    try {
      const { code, data, msg } = await API.cloudBrowserRemainingUsage.userGetCloudBrowserRemainingUsageList({
        headers: {
          token: sessionContext.token,
          workspaceId: sessionContext.workspaceId,
        },
      })

      if (code !== 0) {
        throw new UnauthorizedException(msg || '获取云浏览器剩余可用时长失败')
      }

      if (typeof data?.remainingUsageMs !== 'number') {
        throw new BadGatewayException('云浏览器剩余可用时长返回值无效')
      }

      return Math.max(0, data.remainingUsageMs)
    }
    catch (error: any) {
      if (error instanceof UnauthorizedException || error instanceof BadGatewayException) {
        throw error
      }

      this.logger.error(`获取云浏览器剩余可用时长失败：${error.message}`)
      throw new BadGatewayException('获取云浏览器剩余可用时长失败')
    }
  }

  /** 将 sessionId 拼接到公开入口地址，供前端直接跳转连接 */
  private buildConnectUrl(sessionId: string): string {
    const publicBaseUrl = this.configService.get('publicBaseUrl', { infer: true })!
    const connectUrl = new URL(publicBaseUrl)
    connectUrl.searchParams.set('sessionId', sessionId)
    return connectUrl.toString()
  }

  /**
   * 刷新会话时间窗口。
   * remainingUsageMs 仅在 connect 复用已有容器时使用。
   * 复用场景下必须锚定首次创建时间，并且只允许收紧 usageExpiresAt，
   * 不能因为用户在自动回收前重复打开标签页而把总使用时长往后推。
   */
  private refreshSessionLifetime(sessionData: SessionData, remainingUsageMs?: number): SessionData {
    const lastSeenAt = Date.now()
    const usageExpiresAt = remainingUsageMs != null
      ? this.getReusedSessionUsageExpiresAt(sessionData, remainingUsageMs)
      : sessionData.usageExpiresAt
    return {
      ...sessionData,
      lastSeenAt,
      usageExpiresAt,
      expiresAt: this.getEffectiveExpiresAt(lastSeenAt, usageExpiresAt),
    }
  }

  /**
   * 复用已有会话时，根据服务端剩余时长给 usageExpiresAt 加上上限，但绝不允许放宽旧的硬截止。
   * 这里用 createdAt 作为锚点，避免“关闭标签页再打开”把总使用时长重新从当前时刻开始计算。
   */
  private getReusedSessionUsageExpiresAt(sessionData: SessionData, remainingUsageMs: number): number {
    const createdAt = typeof sessionData.createdAt === 'number'
      ? sessionData.createdAt
      : Date.now()
    const serverBoundUsageExpiresAt = createdAt + remainingUsageMs

    return Math.min(sessionData.usageExpiresAt, serverBoundUsageExpiresAt)
  }

  private async loadReusableSession(
    existingMapping: string,
    userId: string,
    dirId: string,
    sessionContext: SessionContext,
    remainingUsageMs: number,
  ): Promise<SessionData | null> {
    const mapping = JSON.parse(existingMapping) as { sessionId?: string }
    if (!mapping.sessionId) {
      await this.containerService.cleanupUserSession(userId, dirId)
      return null
    }

    const existingSessionJson = await this.redisService.get(this.getSessionContainerKey(mapping.sessionId))
    if (!existingSessionJson) {
      this.logger.warn(`会话 ${mapping.sessionId} 的映射仍存在，但 Redis 会话数据已缺失，开始清理旧会话`)
      await this.containerService.cleanupUserSession(userId, dirId)
      return null
    }

    const normalizedSession = normalizeSessionData(JSON.parse(existingSessionJson) as SessionData)
    const sessionState = getSessionState(normalizedSession)
    if (sessionState !== 'active') {
      this.logger.warn(`旧会话 ${mapping.sessionId} 已${this.getSessionStateDescription(sessionState)}，先清理再创建新会话`)
      await this.containerService.cleanupUserSession(userId, dirId)
      return null
    }

    return this.refreshSessionLifetime(
      {
        ...normalizedSession,
        sessionContext,
      },
      remainingUsageMs,
    )
  }

  private async ensureSessionActive(sessionData: SessionData): Promise<void> {
    const sessionState = getSessionState(sessionData)
    if (sessionState === 'active') {
      return
    }

    await this.containerService.cleanupUserSession(sessionData.userId, sessionData.dirId)
    if (sessionState === 'usage-expired') {
      throw new UnauthorizedException('云浏览器使用时长已耗尽')
    }

    throw new UnauthorizedException('会话无效或已过期')
  }

  private getSessionStateDescription(sessionState: ReturnType<typeof getSessionState>): string {
    switch (sessionState) {
      case 'usage-expired':
        return '达到使用时长上限'
      case 'idle-expired':
        return '空闲超时'
      default:
        return '有效'
    }
  }

  /**
   * 将会话主数据、端口映射和 userId/dirId 到容器的反向索引一并写入 Redis。
   * Redis TTL 只负责保留“清理/恢复所需的元数据”，真正的会话有效性由 expiresAt/usageExpiresAt 决定。
   */
  private async saveSessionData(sessionData: SessionData): Promise<void> {
    const ttlSeconds = this.getSessionMetadataTtlSeconds(sessionData)
    const userContainerKey = this.getUserContainerKey(sessionData.userId, sessionData.dirId)
    const sessionContainerKey = this.getSessionContainerKey(sessionData.sessionId)
    const sessionPortKey = this.getSessionPortKey(sessionData.sessionId)

    await this.redisService.set(sessionContainerKey, JSON.stringify(sessionData), ttlSeconds)
    await this.redisService.set(sessionPortKey, String(sessionData.httpPort), ttlSeconds)
    await this.redisService.set(
      userContainerKey,
      JSON.stringify({
        containerId: sessionData.containerId,
        sessionId: sessionData.sessionId,
        httpPort: sessionData.httpPort,
        udpPort: sessionData.udpPort,
      }),
      ttlSeconds,
    )
  }

  /**
   * Redis 元数据保留时间要略晚于业务会话过期时间，给清理、计费上报和重启恢复留出缓冲窗口。
   */
  private getSessionMetadataTtlSeconds(sessionData: SessionData): number {
    const retentionDeadline = sessionData.expiresAt + SESSION_METADATA_RETENTION_MS
    return Math.max(1, Math.ceil((retentionDeadline - Date.now()) / 1000))
  }

  /** 获取空闲回收窗口，来源于容器层 stopGracePeriod 配置 */
  private getIdleTimeoutMs(): number {
    return this.configService.get('container', { infer: true })!.stopGracePeriod
  }

  /**
   * 计算当前会话的实际过期时间。
   * 会话只要满足“长时间无操作”或“总使用时长耗尽”任一条件，就应该被回收。
   */
  private getEffectiveExpiresAt(lastSeenAt: number, usageExpiresAt: number): number {
    return Math.min(lastSeenAt + this.getIdleTimeoutMs(), usageExpiresAt)
  }

  /** userId + dirId 到容器映射的 Redis key */
  private getUserContainerKey(userId: string, dirId: string): string {
    return `user_container:${userId}:${dirId}`
  }

  /** sessionId 到完整会话数据的 Redis key */
  private getSessionContainerKey(sessionId: string): string {
    return `session_container:${sessionId}`
  }

  /** sessionId 到 HTTP 端口映射的 Redis key */
  private getSessionPortKey(sessionId: string): string {
    return `session_port:${sessionId}`
  }
}
