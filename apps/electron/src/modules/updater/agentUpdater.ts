import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { createAgentPaths, resolveAgentHome } from '@roxy/shared/agent-paths'
import { compare } from 'compare-versions'
import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { isProd, isWindows } from '/@/constants/common'
import { ipcSender } from '/@/modules/ipc/sender'
import { calculateFileHash, fileExists, getErrorMessage, request, unzipFile } from '/@/utils'

const agentPaths = createAgentPaths(resolveAgentHome(isProd))

interface VersionInfo {
  /** agent 版本号 */
  version: string
  /** 此 agent 兼容的最低 app 版本 */
  minimum_app_version: string
  /** 发布时间 */
  releaseTime: string
  /** skills 压缩包文件名列表 */
  skills?: string[]
}

interface ChecksumsInfo {
  'roxy-agent': string
}

type RetriableFileError = NodeJS.ErrnoException & {
  code?: string
}

export interface CheckForUpdatesOptions {
  onDownloadProgress?: (percentage: number) => void
  onDownloadComplete?: () => any
  /** 是否允许把已发现的新版本写入本地 agent 脚本；agent 进程运行中时即使允许也只提示不下载。 */
  allowDownload?: boolean
  /** 手动更新时需要把下载失败抛给前端提示。 */
  throwOnDownloadFailure?: boolean
}

const os = isWindows ? 'Windows' : 'macOS'
const WINDOWS_FILE_RETRY_CODES = new Set(['EBUSY', 'EPERM'])

function isRetriableWindowsFileError(error: unknown): error is RetriableFileError {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && WINDOWS_FILE_RETRY_CODES.has(String((error as RetriableFileError).code))
}

export const agentUpdater = new class AgentUpdater {
  /** agent 资源包下载地址 */
  agentDomain = ''
  /** 是否在下载中 */
  isInProgress = false
  /** 是否正在升级中 */
  isUpgrading = false
  /** 当前运行中的 agent 进程版本；磁盘版本可能已经提前下载到更新版本 */
  runningAgentVersion: string | null = null
  /** agent 资源包目录 */
  agentDir = dirname(appConfig.agentBinPath)

  #updateMessageData: ResourceUpdateMessage = {
    type: 'agent',
    percent: 0,
    description: '',
    title: 'RoxyBrowser AI Agent',
  }

  getUpdateMessageData() {
    if (!this.#updateMessageData.status)
      return null

    if (this.#updateMessageData.status === 'downloaded' && !this.hasPendingDownloadedUpdate()) {
      this.clearUpdateMessageData()
      return null
    }

    return { ...this.#updateMessageData }
  }

  clearUpdateMessageData() {
    this.#updateMessageData = {
      type: 'agent',
      percent: 0,
      description: '',
      title: 'RoxyBrowser AI Agent',
    }
  }

  get versionFilePath() {
    return join(this.agentDir, 'version')
  }

  genChecksumsUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/checksums.json`
  }

  async ensureAgentDomain() {
    if (!this.agentDomain)
      this.agentDomain = await getWebDomain(false)
    return this.agentDomain
  }

  async getChecksumsForVersion(version: string) {
    await this.ensureAgentDomain()
    return request.get<ChecksumsInfo>(this.genChecksumsUrl(version)).then(r => r.data)
  }

  /** compat-index.json 地址，记录所有 agent 版本及其兼容的最低 app 版本 */
  get compatIndexUrl() {
    return `${this.agentDomain}/public/package/agent/compat-index.json`
  }

  /**
   * 从 compat-index.json 中找到当前 app 版本兼容的最新 agent 版本信息
   * 返回 null：app 版本过低，低于所有记录的 minimum_app_version
   * 抛异常：网络问题拉取失败，由外层 checkForUpdates 的 catch 兜底，继续使用本地已有版本
   */
  async resolveCompatibleVersion(): Promise<VersionInfo | null> {
    const index = await request.get<VersionInfo[]>(this.compatIndexUrl).then(r => r.data)
    const appVersion = app.getVersion()
    // 数组按发布时间降序排列（最新在前），找第一个 minimum_app_version <= appVersion 的记录
    const entry = index.find(e => compare(appVersion, e.minimum_app_version, '>='))
    if (!entry) {
      console.log(`[AgentUpdater] 未找到兼容 app ${appVersion} 的 agent（app 版本过低，最低要求 ${index.at(-1)?.minimum_app_version}）`)
      return null
    }
    console.log(`[AgentUpdater] app ${appVersion} 匹配到 agent ${entry.version}（minimum: ${entry.minimum_app_version}）`)
    return entry
  }

  /** 生成 agent 资源包下载地址 */
  genAgentDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/roxy-agent.mjs`
  }

  /** 生成 skill 压缩包下载地址（version.json 中的 skills 项） */
  genSkillDownloadUrl(version: string, filename: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/skills/${filename}`
  }

  /**
   * skills 压缩包存放与解压目录。
   * 官方内置技能属于「随 agent 下发」的 builtin 桶，落在 ~/.roxy-agent-[dev]/library/skills/builtin，
   * 与 agent 侧 SkillManager 扫描的 builtinSkillsDir 对齐（见 docs/agent-data-directory-design.md）。
   */
  get skillsDir() {
    return agentPaths.skillsBuiltinDir
  }

  promise: Promise<void> | null = null
  private promiseCanDownload = false
  private downloadUpdatePromise: Promise<void> | null = null
  private agentFileAccessPromise: Promise<void> = Promise.resolve()

  setRunningAgentVersion(version: string | null) {
    this.runningAgentVersion = version
    if (this.#updateMessageData.status === 'downloaded' && !this.hasPendingDownloadedUpdate())
      this.clearUpdateMessageData()
  }

  isAgentRunning() {
    return Boolean(this.runningAgentVersion)
  }

  hasPendingAgentRestart(version = this.#updateMessageData.version) {
    return Boolean(version && this.runningAgentVersion && compare(version, this.runningAgentVersion, '>'))
  }

  hasPendingDownloadedUpdate() {
    return this.#updateMessageData.status === 'downloaded'
      && this.hasPendingAgentRestart(this.#updateMessageData.version)
  }

  private markAvailableUpdate(remoteVersionInfo: VersionInfo, currentVersion: string) {
    this.#updateMessageData.version = remoteVersionInfo.version
    this.#updateMessageData.currentVersion = currentVersion
    this.#updateMessageData.releaseTime = remoteVersionInfo.releaseTime
    this.#updateMessageData.percent = 0
    this.#updateMessageData.description = ''
    this.#updateMessageData.status = 'update'
  }

  private markDownloadedUpdate(remoteVersionInfo: VersionInfo, currentVersion: string) {
    this.#updateMessageData.version = remoteVersionInfo.version
    this.#updateMessageData.currentVersion = currentVersion
    this.#updateMessageData.releaseTime = remoteVersionInfo.releaseTime
    this.#updateMessageData.percent = 100
    this.#updateMessageData.description = ''
    this.#updateMessageData.status = 'downloaded'
  }

  async waitForDownloadIfPending() {
    const pendingDownload = this.downloadUpdatePromise
    if (pendingDownload)
      await pendingDownload
  }

  async downloadFile(
    url: string,
    outputPath: string,
    onDownloadProgress?: (percentage: number) => void,
  ) {
    const response = await request({
      url,
      method: 'get',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.total || 0
        const current = progressEvent.loaded
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0
        console.log(`[AgentUpdater] ${outputPath} Download progress: ${percentage}%`)
        onDownloadProgress?.(percentage)
      },
    })

    await pipeline(response.data, createWriteStream(outputPath))
  }

  async downloadFileAtomically(
    url: string,
    outputPath: string,
    onDownloadProgress?: (percentage: number) => void,
  ) {
    const tempPath = `${outputPath}.${process.pid}.${Date.now()}.download`
    try {
      await this.downloadFile(url, tempPath, onDownloadProgress)
      await this.renameDownloadedFile(tempPath, outputPath)
    }
    catch (error) {
      await rm(tempPath, { force: true }).catch(() => {})
      throw error
    }
  }

  private async renameDownloadedFile(tempPath: string, outputPath: string) {
    await this.retryWindowsFileOperation(() => rename(tempPath, outputPath))
  }

  private async removeDownloadedArchive(filePath: string) {
    await this.retryWindowsFileOperation(() => rm(filePath, { force: true }))
  }

  private async retryWindowsFileOperation<T>(operation: () => Promise<T>, retries = 5): Promise<T> {
    try {
      return await operation()
    }
    catch (error) {
      if (!isWindows || retries <= 0 || !isRetriableWindowsFileError(error))
        throw error

      await sleep(150)
      return this.retryWindowsFileOperation(operation, retries - 1)
    }
  }

  private async withAgentFileAccess<T>(operation: () => Promise<T>) {
    const previousAccess = this.agentFileAccessPromise
    let releaseAccess!: () => void
    const currentAccess = new Promise<void>((resolve) => {
      releaseAccess = resolve
    })
    this.agentFileAccessPromise = currentAccess

    await previousAccess

    try {
      return await operation()
    }
    finally {
      releaseAccess()
      if (this.agentFileAccessPromise === currentAccess)
        this.agentFileAccessPromise = Promise.resolve()
    }
  }

  private async unzipSkillAndRemoveArchive(skillArchivePath: string) {
    await unzipFile(skillArchivePath)
    await this.removeDownloadedArchive(skillArchivePath).catch((error) => {
      console.warn('[AgentUpdater] 删除 skill 压缩包失败:', skillArchivePath, getErrorMessage(error))
    })
  }

  async checkForUpdates(options: CheckForUpdatesOptions = {}) {
    if (options.allowDownload && !this.isAgentRunning()) {
      if (this.downloadUpdatePromise)
        return this.downloadUpdatePromise

      const downloadUpdatePromise = this.runCheckForUpdates(options)
      this.downloadUpdatePromise = downloadUpdatePromise
      const clearDownloadPromise = () => {
        if (this.downloadUpdatePromise === downloadUpdatePromise)
          this.downloadUpdatePromise = null
      }
      downloadUpdatePromise.then(clearDownloadPromise, clearDownloadPromise)
      return downloadUpdatePromise
    }

    return this.runCheckForUpdates(options)
  }

  async checkForUpdatesAndGetMessage(options: CheckForUpdatesOptions = {}) {
    await this.checkForUpdates(options)
    return this.getUpdateMessageData()
  }

  private async runCheckForUpdates(options: CheckForUpdatesOptions = {}) {
    if (this.promise) {
      const wantsDownloadNow = Boolean(options.allowDownload) && !this.isAgentRunning()
      if (wantsDownloadNow && !this.promiseCanDownload) {
        await this.promise
        return this.runCheckForUpdates(options)
      }
      return this.promise
    }

    this.promiseCanDownload = Boolean(options.allowDownload) && !this.isAgentRunning()
    this.promise = this.checkForUpdatesInner(options).finally(() => {
      this.promise = null
      this.promiseCanDownload = false
    })

    return this.promise
  }

  private async checkForUpdatesInner(options: CheckForUpdatesOptions = {}) {
    if (this.isInProgress) {
      return
    }

    this.isInProgress = true
    let downloadingThisRun = false
    console.log('[AgentUpdater] checkForUpdates start')
    try {
      this.agentDomain = await getWebDomain(false)

      // 从 compat-index.json 找到当前 app 版本兼容的最新 agent
      const remoteVersionInfo = await this.resolveCompatibleVersion()
      if (!remoteVersionInfo) {
        this.isInProgress = false
        return
      }
      console.log('[AgentUpdater] remoteVersionInfo', remoteVersionInfo)

      // 获取本地版本信息
      const localVersionInfo = await this.getLocalVersionInfo()
      const localVersion = localVersionInfo.version
      console.log('[AgentUpdater] localVersion', localVersion)
      console.log('[AgentUpdater] remoteVersion', remoteVersionInfo.version)

      const agentVersion = remoteVersionInfo.version
      const needDownload = !localVersionInfo.exists || compare(agentVersion, localVersion, '>')
      const canDownload = Boolean(options.allowDownload) && !this.isAgentRunning()

      if (needDownload && !canDownload) {
        this.markAvailableUpdate(remoteVersionInfo, this.runningAgentVersion ?? localVersion)
        ipcSender.mcp.resourceUpdate(this.#updateMessageData)
        console.log('[AgentUpdater] update available, waiting for agent close or manual update')
      }
      else if (needDownload) {
        await this.withAgentFileAccess(async () => {
          console.log('[AgentUpdater] downloading...')
          downloadingThisRun = true
          await fileExists(this.agentDir, true)
          this.#updateMessageData.version = agentVersion
          this.#updateMessageData.currentVersion = localVersion
          this.#updateMessageData.releaseTime = remoteVersionInfo.releaseTime
          this.#updateMessageData.percent = 0
          this.#updateMessageData.description = ''
          this.#updateMessageData.status = 'downloading'
          ipcSender.mcp.resourceUpdate(this.#updateMessageData)

          const downloadTasks: Promise<void>[] = [
            this.downloadFileAtomically(this.genAgentDownloadUrl(agentVersion), appConfig.agentBinPath, (percentage) => {
              this.#updateMessageData.percent = percentage
              options.onDownloadProgress?.(percentage)
              ipcSender.mcp.resourceUpdate(this.#updateMessageData)
            }),
          ]

          const skillNames = remoteVersionInfo.skills ?? []
          if (skillNames.length > 0) {
            await fileExists(this.skillsDir, true)
            for (const name of skillNames) {
              downloadTasks.push(this.downloadFileAtomically(this.genSkillDownloadUrl(agentVersion, name), join(this.skillsDir, name)))
            }
          }

          await Promise.all(downloadTasks)
          if (skillNames.length > 0) {
            await Promise.all(skillNames.map(name => this.unzipSkillAndRemoveArchive(join(this.skillsDir, name))))
            console.log('[AgentUpdater] skills 解压完成')
          }
          await this.assertScriptIntegrityForVersion(agentVersion)
          await this.writeLocalVersion(agentVersion)
        })
        await options.onDownloadComplete?.()
        this.markDownloadedUpdate(remoteVersionInfo, this.runningAgentVersion ?? localVersion)
        if (this.hasPendingDownloadedUpdate()) {
          ipcSender.mcp.resourceUpdate(this.#updateMessageData)
          console.log('[AgentUpdater] downloaded')
        }
        else {
          this.clearUpdateMessageData()
          console.log('[AgentUpdater] downloaded, no running agent restart required')
        }
      }
      else if (this.hasPendingAgentRestart(agentVersion)) {
        this.markDownloadedUpdate(remoteVersionInfo, this.runningAgentVersion ?? localVersion)
        ipcSender.mcp.resourceUpdate(this.#updateMessageData)
      }
      else if (this.#updateMessageData.status === 'update') {
        this.clearUpdateMessageData()
      }
      else if (this.#updateMessageData.status === 'downloaded') {
        this.clearUpdateMessageData()
      }
    }
    catch (error) {
      const errorMessage = getErrorMessage(error)
      console.error('[AgentUpdater] checkForUpdates error', errorMessage)
      if (downloadingThisRun) {
        this.#updateMessageData.status = 'failed'
        this.#updateMessageData.description = errorMessage
        ipcSender.mcp.resourceUpdate(this.#updateMessageData)
      }
      if (options.throwOnDownloadFailure)
        throw error
    }
    finally {
      this.isInProgress = false
    }
    console.log('[AgentUpdater] checkForUpdates end')
  }

  async getLocalVersionInfo(): Promise<{ version: string, exists: boolean }> {
    try {
      const version = (await readFile(this.versionFilePath, 'utf8')).toString().trim()
      return { version: version || '0.0.1', exists: Boolean(version) }
    }
    catch {
      return { version: '0.0.1', exists: false }
    }
  }

  async getLocalVersion(): Promise<string> {
    return this.getLocalVersionInfo().then(info => info.version)
  }

  async writeLocalVersion(version: string) {
    await fileExists(this.agentDir, true)
    await writeFile(this.versionFilePath, version, 'utf8')
    console.log('[AgentUpdater] write version file', this.versionFilePath, version)
  }

  async assertScriptIntegrityForVersion(version: string) {
    if (await this.verifyScriptIntegrityForVersion(version))
      return

    throw new Error('roxy-agent checksum mismatch')
  }

  async verifyScriptIntegrityForVersion(version: string) {
    const key: keyof ChecksumsInfo = 'roxy-agent'
    const [checksums, localHash] = await Promise.all([
      this.getChecksumsForVersion(version),
      calculateFileHash(appConfig.agentBinPath),
    ])

    if (checksums[key] !== localHash) {
      console.warn(`[AgentUpdater] ${key} 远端 checksum 校验失败`, { version, local: localHash, remote: checksums[key] })
      return false
    }

    return true
  }

  async resolveRepairVersion() {
    await this.ensureAgentDomain()
    try {
      const remoteVersionInfo = await this.resolveCompatibleVersion()
      if (remoteVersionInfo)
        return remoteVersionInfo.version
    }
    catch (error) {
      console.warn('[AgentUpdater] 获取兼容 agent 版本失败，回退本地 version 修复', getErrorMessage(error))
    }

    return this.getLocalVersion()
  }

  /** 校验本地脚本完整性，返回校验失败的脚本 key 列表 */
  async checkScriptIntegrity(): Promise<(keyof ChecksumsInfo)[]> {
    return this.withAgentFileAccess(async () => {
      const key: keyof ChecksumsInfo = 'roxy-agent'
      let localHash = ''
      try {
        localHash = await calculateFileHash(appConfig.agentBinPath)
      }
      catch {
        console.error(`[AgentUpdater] ${key} 文件不存在或读取失败`)
        return [key]
      }

      const localVersionInfo = await this.getLocalVersionInfo()
      const candidateVersions = new Set<string>()
      if (localVersionInfo.exists)
        candidateVersions.add(localVersionInfo.version)

      await this.ensureAgentDomain()
      const remoteVersionInfo = await this.resolveCompatibleVersion()
      if (remoteVersionInfo)
        candidateVersions.add(remoteVersionInfo.version)

      for (const version of candidateVersions) {
        try {
          const checksums = await this.getChecksumsForVersion(version)
          if (checksums[key] === localHash) {
            await this.writeLocalVersion(version)
            console.log('[AgentUpdater] 远端 checksums 校验通过', { version })
            return []
          }
          console.warn(`[AgentUpdater] ${key} checksum mismatch`, { version, local: localHash, remote: checksums[key] })
        }
        catch (error) {
          console.warn('[AgentUpdater] 获取 checksums 失败，跳过候选版本', version, getErrorMessage(error))
        }
      }

      console.error(`[AgentUpdater] ${key} 校验失败`, {
        localVersion: localVersionInfo.exists ? localVersionInfo.version : '(missing)',
        local: localHash,
      })
      return [key]
    })
  }

  /** 重新下载指定脚本，覆盖本地文件 */
  async repairScripts(scripts: (keyof ChecksumsInfo)[]) {
    if (scripts.length === 0)
      return

    await this.withAgentFileAccess(async () => {
      console.log('[AgentUpdater] 开始修复脚本:', scripts)
      const version = await this.resolveRepairVersion()
      const downloadMap: Record<string, string> = {
        'roxy-agent': appConfig.agentBinPath,
      }

      await fileExists(this.agentDir, true)

      const tasks: Promise<void>[] = []
      for (const key of scripts) {
        const url = `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/${key}.mjs`
        const outputPath = downloadMap[key]
        tasks.push(this.downloadFileAtomically(url, outputPath))
      }
      await Promise.all(tasks)
      if (!await this.verifyScriptIntegrityForVersion(version)) {
        console.warn('[AgentUpdater] 修复后脚本未通过远端 checksum 校验，保持本地 version 不变', { version })
        return
      }

      await this.writeLocalVersion(version)
      console.log('[AgentUpdater] 脚本修复完成')
    })
  }
}()
