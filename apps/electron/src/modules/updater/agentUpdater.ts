import axios from 'axios'
import { compare } from 'compare-versions'
import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { isWindows } from '/@/constants/common'
import { fileExists, getErrorMessage } from '/@/utils'

interface VersionInfo {
  /** 最新版本号 */
  version: string
  /** 最低支持版本号 */
  minimum_app_version: string
  /** 发布时间 */
  releaseTime: string
}

export interface CheckForUpdatesOptions {
  onDownloadProgress?: (percentage: number) => void
  onDownloadComplete?: () => any
}

const os = isWindows ? 'Windows' : 'macOS'

export const agentUpdater = new class AgentUpdater {
  timer: NodeJS.Timeout | null = null
  /** agent 资源包下载地址 */
  agentDomain = ''
  /** 是否在下载中 */
  isInProgress = false
  /** 是否正在升级中 */
  isUpgrading = false
  /** 远程 web 资源版本信息 */
  remoteVersionInfo: VersionInfo | null = null
  /** agent 资源包目录 */
  agentDir = dirname(appConfig.agentBinPath)

  /** 最新 web 资源版本号文件地址 */
  get versionUrl() {
    return `${this.agentDomain}/public/package/agent/${os}/version.json`
  }

  /** 生成 agent 资源包下载地址 */
  genAgentDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/${version}/${os}/agent-worker.jsc`
  }

  genOpenapiDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/${version}/${os}/roxybrowser-openapi-mcp.jsc`
  }

  genPlaywrightDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/${version}/${os}/roxybrowser-playwright-mcp.cjs`
  }

  constructor() {
    this.startInterval()
  }

  promise: Promise<void> | null = null

  async startInterval() {
    this.stopInterval()
    this.timer = setInterval(() => {
      this.promise = this.checkForUpdates().finally(() => {
        this.promise = null
      })
    }, 1000 * 60 * 10)
  }

  async stopInterval() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  async downloadFile(url: string, outputPath: string) {
    const response = await axios({
      url,
      method: 'get',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.total || 0
        const current = progressEvent.loaded
        const percentage = Math.round((current / total) * 100)
        console.log(`[AgentUpdater] ${outputPath} Download progress: ${percentage}%`)
      },
    })

    const writer = createWriteStream(outputPath)
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    response.data.pipe(writer)
    writer.on('finish', async () => {
      writer.close()
      resolve()
    })
    writer.on('error', (error) => {
      this.remoteVersionInfo = null
      reject(error)
    })
    return promise
  }

  async checkForUpdates() {
    if (this.isInProgress) {
      return
    }

    this.isInProgress = true
    console.log('[AgentUpdater] checkForUpdates start')
    try {
      this.agentDomain = await getWebDomain(false)
      // 获取远程版本信息
      const remoteVersionInfo = await axios.get<VersionInfo>(this.versionUrl).then(response => response.data)
      console.log('[AgentUpdater] remoteVersionInfo', remoteVersionInfo)

      if (this.remoteVersionInfo && compare(this.remoteVersionInfo.version, remoteVersionInfo.version, '>=')) {
        this.isInProgress = false
        console.log('[AgentUpdater] checkForUpdates already downloaded')
        return
      }

      // 检查 app 版本是否过低
      if (compare(remoteVersionInfo.minimum_app_version, app.getVersion(), '>')) {
        console.log('[AgentUpdater] app version is too old')
        this.isInProgress = false
        return
      }

      // 获取本地版本信息
      const localVersion = await this.getLocalVersion()
      console.log('[AgentUpdater] localVersion', localVersion)
      console.log('[AgentUpdater] remoteVersion', remoteVersionInfo.version)
      // 检查是否需要更新
      if (compare(remoteVersionInfo.version, localVersion, '>')) {
        console.log('[AgentUpdater] downloading...')
        await fileExists(this.agentDir, true)
        await Promise.all([
          this.downloadFile(this.genAgentDownloadUrl(remoteVersionInfo.version), appConfig.agentBinPath),
          this.downloadFile(this.genOpenapiDownloadUrl(remoteVersionInfo.version), appConfig.openapiMcpBinPath),
          this.downloadFile(this.genPlaywrightDownloadUrl(remoteVersionInfo.version), appConfig.playwrightMcpBinPath),
        ])
        await writeFile(join(this.agentDir, 'version'), remoteVersionInfo.version, 'utf8')
        this.remoteVersionInfo = remoteVersionInfo
        console.log('[AgentUpdater] downloaded')
      }
    }
    catch (error) {
      console.error('[AgentUpdater] checkForUpdates error', getErrorMessage(error))
    }
    finally {
      this.isInProgress = false
    }
    console.log('[AgentUpdater] checkForUpdates end')
  }

  async getLocalVersion(): Promise<string> {
    return readFile(join(this.agentDir, 'version'), 'utf8').then(data => data.toString()).catch(() => '0.0.1')
  }
}()
