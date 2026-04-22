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
  'roxy-playwright': string
  'roxy-openapi': string
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

  /** integrity 校验：各脚本远端 sha512 缓存 */
  checksums: ChecksumsInfo | null = null

  genChecksumsUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/checksums.json`
  }

  async getChecksums() {
    const version = await this.getLocalVersion()
    if (!this.checksums) {
      this.checksums = await axios.get<ChecksumsInfo>(this.genChecksumsUrl(version)).then(r => r.data)
    }
    return this.checksums
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
    const index = await axios.get<VersionInfo[]>(this.compatIndexUrl).then(r => r.data)
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

  genOpenapiDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/roxy-openapi.mjs`
  }

  genPlaywrightDownloadUrl(version: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/roxy-playwright.mjs`
  }

  /** 生成 skill 压缩包下载地址（version.json 中的 skills 项） */
  genSkillDownloadUrl(version: string, filename: string) {
    return `${this.agentDomain}/public/package/agent/scripts/${version}/skills/${filename}`
  }

  /** skills 压缩包存放目录 */
  get skillsDir() {
    return join(this.agentDir, 'skills')
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

      // 从 compat-index.json 找到当前 app 版本兼容的最新 agent
      const remoteVersionInfo = await this.resolveCompatibleVersion()
      if (!remoteVersionInfo) {
        this.isInProgress = false
        return
      }
      console.log('[AgentUpdater] remoteVersionInfo', remoteVersionInfo)

      // 获取本地版本信息
      const localVersion = await this.getLocalVersion()
      console.log('[AgentUpdater] localVersion', localVersion)
      console.log('[AgentUpdater] remoteVersion', remoteVersionInfo.version)

      const agentVersion = remoteVersionInfo.version
      const needDownload = compare(agentVersion, localVersion, '>')

      if (needDownload) {
        console.log('[AgentUpdater] downloading...')
        await fileExists(this.agentDir, true)

        const downloadTasks: Promise<void>[] = [
          this.downloadFile(this.genAgentDownloadUrl(agentVersion), appConfig.agentBinPath),
          this.downloadFile(this.genOpenapiDownloadUrl(agentVersion), appConfig.openapiMcpBinPath),
          this.downloadFile(this.genPlaywrightDownloadUrl(agentVersion), appConfig.playwrightMcpBinPath),
        ]

        const skillNames = remoteVersionInfo.skills ?? []
        if (skillNames.length > 0) {
          await fileExists(this.skillsDir, true)
          for (const name of skillNames) {
            downloadTasks.push(this.downloadFile(this.genSkillDownloadUrl(agentVersion, name), join(this.skillsDir, name)))
          }
        }

        await Promise.all(downloadTasks)
        this.checksums = null
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

  /** 校验本地脚本完整性，返回校验失败的脚本 key 列表 */
  async checkScriptIntegrity(): Promise<(keyof ChecksumsInfo)[]> {
    const checksums = await this.getChecksums()
    if (!checksums) {
      console.error('[AgentUpdater] checksums not available')
      return []
    }

    const scripts: { key: keyof ChecksumsInfo, path: string }[] = [
      { key: 'roxy-agent', path: appConfig.agentBinPath },
      { key: 'roxy-openapi', path: appConfig.openapiMcpBinPath },
      { key: 'roxy-playwright', path: appConfig.playwrightMcpBinPath },
    ]

    const corrupted: (keyof ChecksumsInfo)[] = []
    for (const { key, path: localPath } of scripts) {
      try {
        const localHash = await calculateFileHash(localPath)
        if (localHash !== checksums[key]) {
          corrupted.push(key)
          console.error(`[AgentUpdater] ${key} 校验失败`, { local: localHash, remote: checksums[key] })
        }
      }
      catch {
        corrupted.push(key)
        console.error(`[AgentUpdater] ${key} 文件不存在或读取失败`)
      }
    }
    return corrupted
  }

  /** 重新下载指定脚本，覆盖本地文件 */
  async repairScripts(scripts: (keyof ChecksumsInfo)[]) {
    if (scripts.length === 0)
      return

    console.log('[AgentUpdater] 开始修复脚本:', scripts)
    const version = await this.getLocalVersion()
    const downloadMap: Record<string, string> = {
      'roxy-agent': appConfig.agentBinPath,
      'roxy-openapi': appConfig.openapiMcpBinPath,
      'roxy-playwright': appConfig.playwrightMcpBinPath,
    }

    const tasks: Promise<void>[] = []
    for (const key of scripts) {
      const url = `${this.agentDomain}/public/package/agent/scripts/${version}/${os}/${key}.mjs`
      const outputPath = downloadMap[key]
      tasks.push(this.downloadFile(url, outputPath))
    }
    await Promise.all(tasks)
    this.checksums = null // 清除缓存，下次获取时重新拉取
    console.log('[AgentUpdater] 脚本修复完成')
  }
}()
