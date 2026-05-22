import type { BeforeLaunchResult } from './browser-item/beforeLaunchTask'
import type { SessionContext } from './browser-item/browserItem'
import type { UserGetUserConfigListData } from '@roxy/backend-api'
import type { Configuration } from '~/config/configuration'
import type { Browser } from 'puppeteer-core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { API } from '~/api'
import { getWritableDir } from '~/utils'
import { RedisService } from '../redis/redis.service'
import { AfterLaunchTask } from './browser-item/afterLaunchTask'
import { BeforeLaunchTask } from './browser-item/beforeLaunchTask'
import { BrowserItem } from './browser-item/browserItem'

const USAGE_REPORT_LOCK_TTL_SECONDS = 30
const USAGE_REPORT_MARK_TTL_SECONDS = 24 * 60 * 60

/**
 * BrowserItem 生命周期管理服务
 * 负责创建 BrowserItem、执行启动前/后任务、管理会话映射
 */
@Injectable()
export class BrowserItemService {
  private readonly logger = new Logger(BrowserItemService.name)
  /** 活跃的 BrowserItem：sessionKey (userId:dirId) -> BrowserItem */
  private readonly items = new Map<string, BrowserItem>()
  /** 活跃的 AfterLaunchTask：sessionKey -> AfterLaunchTask */
  private readonly afterTasks = new Map<string, AfterLaunchTask>()
  /** 预停止中的会话，避免断连监听重复上传 */
  private readonly preStopSessions = new Set<string>()

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 初始化 BrowserItem 并执行启动前任务
   * 在容器创建之前调用，完成文件预处理（指纹/缓存/扩展等）
   *
   * @returns 启动前任务结果（含扩展路径和代理信息）
   */
  async initAndPrepare(
    sessionKey: string,
    sessionContext: SessionContext,
    dirId: string,
  ): Promise<{ item: BrowserItem, launchResult: BeforeLaunchResult }> {
    const configuredDataDir = this.configService.get('dataDir', { infer: true })!
    const dataDir = await getWritableDir(configuredDataDir)
    const configuredExtensionBaseDir = this.configService.get('extensionBaseDir', { infer: true })!
    const extensionBaseDir = await getWritableDir(configuredExtensionBaseDir, path.resolve(dataDir, 'extensions'))
    const browserColorScheme = this.configService.get('browserColorScheme', { infer: true })!
    const nekoConfig = this.configService.get('neko', { infer: true })!

    // 获取窗口配置
    const { code, data, msg } = await API.window.userGetWindowInfoV2List(
      { dirId, sourceType: 'open' } as any,
      { headers: { token: sessionContext.token, workspaceId: sessionContext.workspaceId } },
    )
    console.log('userGetWindowInfoV2List request', { dirId, workspaceId: sessionContext.workspaceId, token: sessionContext.token })
    console.log('userGetWindowInfoV2List response', { code, data, msg })
    if (code !== 0 || !data?.rows?.[0]) {
      throw new Error(msg || `获取目录 ID=${dirId} 的窗口信息失败`)
    }
    const winInfo = data.rows[0]

    // 计算用户数据目录
    const [userId] = sessionKey.split(':')
    const userDataDir = path.resolve(dataDir, userId, dirId)

    // 创建 BrowserItem
    const item = new BrowserItem(winInfo as any, userDataDir, sessionContext)
    this.items.set(sessionKey, item)

    try {
      // 解密代理信息
      await item.decryptProxyInfo().catch(err =>
        this.logger.warn(`代理信息解密失败：${err.message}`),
      )

      // 随机指纹
      await item.handleRandomFingerprint()

      // 获取全局配置
      const globalConfig = await this.fetchGlobalConfig(sessionContext)

      // 执行启动前任务
      const beforeTask = new BeforeLaunchTask(item, {
        globalConfig,
        extensionBaseDir,
        browserColorScheme,
        nekoDataDir: nekoConfig.browserDataPath,
        nekoScreen: nekoConfig.screen,
      })
      const launchResult = await beforeTask.run()

      return { item, launchResult }
    }
    catch (error) {
      this.cleanup(sessionKey)
      throw error
    }
  }

  /**
   * 浏览器连接成功后，注入 Browser 实例并启动后置任务
   */
  async onBrowserConnected(sessionKey: string, browser: Browser): Promise<void> {
    const item = this.items.get(sessionKey)
    if (!item) {
      this.logger.warn(`浏览器连接时未找到会话键=${sessionKey} 对应的浏览器项`)
      try {
        browser.disconnect()
      }
      catch (error: any) {
        this.logger.warn(`断开游离浏览器连接失败，会话键=${sessionKey}：${error.message}`)
      }
      return
    }

    item.setBrowser(browser)

    // 执行启动后任务（Cookie 导入/同步）
    const afterTask = new AfterLaunchTask(item, browser)
    this.afterTasks.set(sessionKey, afterTask)
    afterTask.run().catch(err =>
      this.logger.error(`启动后任务执行失败，会话键=${sessionKey}：${err.message}`),
    )

    // 监听浏览器断连，自动上传数据
    browser.on('disconnected', async () => {
      if (this.preStopSessions.has(sessionKey)) {
        this.logger.log(`预停止阶段浏览器已断开，会话键=${sessionKey}，跳过自动上传`)
        return
      }

      this.logger.log(`浏览器已断开，开始上传数据，会话键=${sessionKey}`)
      try {
        const afterTask = this.afterTasks.get(sessionKey)
        if (afterTask) {
          const uploadData = await afterTask.getUploadData()
          await item.uploadData(uploadData)
        }
      }
      catch (error: any) {
        this.logger.error(`上传 ${sessionKey} 的数据失败：${error.message}`)
      }
      finally {
        this.cleanup(sessionKey)
      }
    })
  }

  /** 获取 BrowserItem */
  getItem(sessionKey: string): BrowserItem | undefined {
    return this.items.get(sessionKey)
  }

  /**
   * 用户断开后，上报本次云浏览器已使用时长。
   * 优先复用 BrowserItem 中的请求头；当 BrowserItem 已经被清理时，回退到 Redis 会话里持久化的鉴权上下文。
   */
  async reportCloudBrowserDisconnected(
    sessionId: string,
    sessionKey: string,
    usedMs: number,
    sessionContext?: SessionContext,
  ): Promise<void> {
    const reportedKey = `cloud_browser_usage_reported:${sessionId}`
    if (await this.redisService.exists(reportedKey)) {
      this.logger.log(`会话键 ${sessionKey} 的已用时长已上报，跳过重复提交`)
      return
    }

    const reportLockKey = `cloud_browser_usage_reporting:${sessionId}`
    const lockAcquired = await this.redisService.setIfAbsent(
      reportLockKey,
      String(Date.now()),
      USAGE_REPORT_LOCK_TTL_SECONDS,
    )
    if (!lockAcquired) {
      this.logger.warn(`会话键 ${sessionKey} 的断开上报正在进行中，跳过本次重复触发`)
      return
    }

    const item = this.items.get(sessionKey)
    const requestHeaders = item?.requestHeaders ?? (sessionContext
      ? {
          token: sessionContext.token,
          workspaceId: sessionContext.workspaceId,
        }
      : undefined)

    try {
      if (!requestHeaders) {
        this.logger.warn(`上报云浏览器断开时缺少鉴权上下文，会话键=${sessionKey}`)
        return
      }

      this.logger.log(`开始上报会话键 ${sessionKey} 的云浏览器断开，已用时长=${usedMs}ms`)

      const { code, data, msg } = await API.window.userMdfCloudBrowserActivateInfoCreate(
        { usedMs },
        { headers: requestHeaders },
      )

      if (code !== 0) {
        this.logger.warn(`云浏览器断开上报被拒绝，会话键=${sessionKey}：${msg}`)
        return
      }

      await this.redisService.set(reportedKey, String(Date.now()), USAGE_REPORT_MARK_TTL_SECONDS)

      this.logger.log(
        `已上报会话键 ${sessionKey} 的云浏览器断开，已用时长=${usedMs}，剩余时长=${data?.remainingUsageMs}`,
      )
    }
    catch (error: any) {
      this.logger.error(`云浏览器断开上报失败，会话键=${sessionKey}：${error.message}`)
    }
    finally {
      try {
        await this.redisService.del(reportLockKey)
      }
      catch (error: any) {
        this.logger.warn(`释放会话键 ${sessionKey} 的断开上报锁失败：${error.message}`)
      }
    }
  }

  /** 标记会话进入预停止阶段 */
  markPreStop(sessionKey: string): void {
    this.preStopSessions.add(sessionKey)
  }

  /** 清除会话预停止标记 */
  clearPreStop(sessionKey: string): void {
    this.preStopSessions.delete(sessionKey)
  }

  /**
   * 等待浏览器退出后写出 roxy_tabs。
   * 只有文件已经存在且内容能被解析成数组时，才认为 tabs 快照可用于上传。
   */
  async waitForRoxyTabs(sessionKey: string, timeoutMs = 1000): Promise<boolean> {
    const item = this.items.get(sessionKey)
    if (!item) {
      return false
    }

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const content = await readFile(item.roxyTabsPath, 'utf8')
        const tabs = JSON.parse(content)
        if (Array.isArray(tabs)) {
          return true
        }
      }
      catch {
        // 文件尚未生成或内容尚未写完
      }

      await delay(200)
    }

    return false
  }

  /** 容器停止前做最后一次 cookie 抓取，降低末尾 cookie 丢失概率 */
  async captureCookiesBeforeStop(sessionKey: string): Promise<void> {
    const item = this.items.get(sessionKey)
    const afterTask = this.afterTasks.get(sessionKey)
    if (!item?.winInfo.syncCookie || !afterTask) {
      return
    }

    try {
      await afterTask.captureCookies()
    }
    catch (error: any) {
      this.logger.error(`停止前抓取 Cookie 失败，会话键=${sessionKey}：${error.message}`)
    }
  }

  /** 手动触发数据上传（容器停止前调用） */
  async uploadDataBeforeStop(sessionKey: string): Promise<void> {
    const item = this.items.get(sessionKey)
    const afterTask = this.afterTasks.get(sessionKey)
    if (item && afterTask) {
      try {
        const uploadData = await afterTask.getUploadData()
        await item.uploadData(uploadData)
      }
      catch (error: any) {
        this.logger.error(`停止前上传失败，会话键=${sessionKey}：${error.message}`)
      }
    }
  }

  /** 清理会话 */
  cleanup(sessionKey: string) {
    const afterTask = this.afterTasks.get(sessionKey)
    afterTask?.dispose()

    this.items.delete(sessionKey)
    this.afterTasks.delete(sessionKey)
    this.preStopSessions.delete(sessionKey)
  }

  /** 获取全局用户配置，失败时回退为空对象，避免阻塞浏览器启动 */
  private async fetchGlobalConfig(sessionContext: SessionContext): Promise<UserGetUserConfigListData['data']> {
    try {
      const { code, data } = await API.base.userGetUserConfigList(
        { headers: { token: sessionContext.token, workspaceId: sessionContext.workspaceId } },
      )
      if (code === 0)
        return data
    }
    catch (error: any) {
      this.logger.warn(`获取全局配置失败：${error.message}`)
    }
    // 返回安全的默认值
    return {} as any
  }
}
