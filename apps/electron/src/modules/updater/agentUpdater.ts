import axios from 'axios'
import { compare } from 'compare-versions'
import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { isWindows } from '/@/constants/common'
import { calculateFileHash, fileExists, getErrorMessage, unzipFile } from '/@/utils'

interface VersionInfo {
  /** 最新版本号 */
  version: string
  /** 最低支持版本号 */
  minimum_app_version: string
  /** 发布时间 */
  releaseTime: string
  /** skills 压缩包文件名列表，用于遍历下载 */
  skills?: string[]
  /** roxy-agent.mjs sha512（hex） */
  agent_sha512?: string
  /** roxy-openapi.mjs sha512（hex） */
  openapi_sha512?: string
  /** roxy-playwright.mjs sha512（hex） */
  playwright_sha512?: string
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

  /** integrity 校验：roxy-agent.mjs 远端 sha512（打包后下载的目标文件） */
  agentEntrySha512: string | null = null
  /** integrity 校验：roxy-openapi.mjs 远端 sha512 */
  openapiEntrySha512: string | null = null
  /** integrity 校验：roxy-playwright.mjs 远端 sha512 */
  playwrightEntrySha512: string | null = null

  /** 最新 web 资源版本号文件地址 */
  get versionUrl() {
    return `${this.agentDomain}/public/package/agent/${os}/version.json`
  }

  /** 生成 agent 资源包下载地址 */
  genAgentDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/${version}/${os}/roxy-agent.mjs`
  }

  genOpenapiDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/${version}/${os}/roxy-openapi.mjs`
  }

  genPlaywrightDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/${version}/${os}/roxy-playwright.mjs`
  }

  /** 生成 skill 压缩包下载地址（version.json 中的 skills 项） */
  genSkillDownloadUrl(version: string, filename: string) {
    return `${this.agentDomain}/public/package/agent/${version}/skills/${filename}`
  }

  /** skills 压缩包存放目录 */
  get skillsDir() {
    return join(this.agentDir, 'skills')
  }

  constructor() {
    this.startInterval()
  }

  promise: Promise<void> | null = null

  private async downloadFileAndVerify(url: string, outputPath: string, expectedSha512: string) {
    await this.downloadFile(url, outputPath)
    const localSha512 = await calculateFileHash(outputPath)
    if (localSha512 !== expectedSha512.toLowerCase()) {
      // 校验失败：删除脏文件，避免后续启动加载到被篡改内容
      await import('node:fs/promises').then(fs => fs.rm(outputPath, { force: true })).catch(() => {})
      throw new Error(`[AgentUpdater] sha512 mismatch: ${outputPath}`)
    }
  }

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

      const integrityRequired = process.env.ROXY_AGENT_INTEGRITY_REQUIRED !== 'false'

      // 获取本地版本信息
      const localVersion = await this.getLocalVersion()
      console.log('[AgentUpdater] localVersion', localVersion)
      console.log('[AgentUpdater] remoteVersion', remoteVersionInfo.version)

      const agentVersion = remoteVersionInfo.version
      const agentUrl = this.genAgentDownloadUrl(agentVersion)
      const openapiUrl = this.genOpenapiDownloadUrl(agentVersion)
      const playwrightUrl = this.genPlaywrightDownloadUrl(agentVersion)

      // 远端完整性信息直接来自 version.json
      this.agentEntrySha512 = remoteVersionInfo.agent_sha512 ? String(remoteVersionInfo.agent_sha512).toLowerCase() : null
      this.openapiEntrySha512 = remoteVersionInfo.openapi_sha512 ? String(remoteVersionInfo.openapi_sha512).toLowerCase() : null
      this.playwrightEntrySha512 = remoteVersionInfo.playwright_sha512 ? String(remoteVersionInfo.playwright_sha512).toLowerCase() : null

      if (integrityRequired) {
        if (!this.agentEntrySha512 || !this.openapiEntrySha512 || !this.playwrightEntrySha512) {
          throw new Error('[AgentUpdater] missing remote sha512 for agent scripts')
        }
      }

      // 检查是否需要更新（版本升级 或 本地 sha512 不匹配）
      let needDownload = compare(agentVersion, localVersion, '>')

      if (!needDownload && (this.agentEntrySha512 || this.openapiEntrySha512 || this.playwrightEntrySha512)) {
        const localAgentSha = await calculateFileHash(appConfig.agentBinPath).catch(() => '')
        const localOpenapiSha = await calculateFileHash(appConfig.openapiMcpBinPath).catch(() => '')
        const localPlaywrightSha = await calculateFileHash(appConfig.playwrightMcpBinPath).catch(() => '')

        if (integrityRequired && (!localAgentSha || !localOpenapiSha || !localPlaywrightSha)) {
          // 本地脚本缺失：强制下载
          needDownload = true
        }

        if (this.agentEntrySha512 && localAgentSha && localAgentSha !== this.agentEntrySha512) {
          needDownload = true
        }
        if (this.openapiEntrySha512 && localOpenapiSha && localOpenapiSha !== this.openapiEntrySha512) {
          needDownload = true
        }
        if (this.playwrightEntrySha512 && localPlaywrightSha && localPlaywrightSha !== this.playwrightEntrySha512) {
          needDownload = true
        }
      }

      if (needDownload) {
        console.log('[AgentUpdater] downloading...')
        await fileExists(this.agentDir, true)

        const downloadTasks: Promise<void>[] = []
        if (integrityRequired) {
          downloadTasks.push(
            this.downloadFileAndVerify(agentUrl, appConfig.agentBinPath, this.agentEntrySha512!),
            this.downloadFileAndVerify(openapiUrl, appConfig.openapiMcpBinPath, this.openapiEntrySha512!),
            this.downloadFileAndVerify(playwrightUrl, appConfig.playwrightMcpBinPath, this.playwrightEntrySha512!),
          )
        }
        else {
          downloadTasks.push(
            this.downloadFile(agentUrl, appConfig.agentBinPath),
            this.downloadFile(openapiUrl, appConfig.openapiMcpBinPath),
            this.downloadFile(playwrightUrl, appConfig.playwrightMcpBinPath),
          )
        }

        const skillNames = remoteVersionInfo.skills ?? []
        if (skillNames.length > 0) {
          await fileExists(this.skillsDir, true)
          for (const name of skillNames) {
            const skillUrl = this.genSkillDownloadUrl(agentVersion, name)
            // skills 不做 sha512 校验：按版本下载/解压即可
            downloadTasks.push(this.downloadFile(skillUrl, join(this.skillsDir, name)))
          }
        }

        await Promise.all(downloadTasks)
        if (skillNames.length > 0) {
          await Promise.all(skillNames.map(name => unzipFile(join(this.skillsDir, name))))
          console.log('[AgentUpdater] skills 解压完成')
        }
        await writeFile(join(this.agentDir, 'version'), agentVersion, 'utf8')
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
