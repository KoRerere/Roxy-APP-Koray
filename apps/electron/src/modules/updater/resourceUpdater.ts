/**
 * 默认浏览器启动器（Tauri）远程更新。
 *
 * OSS 目录（与 apps/tauri publish 一致）：
 *   /public/static/browser-launcher/{os}/{arch}/
 *     - version.json
 *     - RoxyChrome.{exe|app.zip|AppImage}
 *     - RoxyFirefox.{exe|app.zip|AppImage}
 *
 * 本地均落在 sessionData/default-browser-bin/，供 DefaultBrowserInstaller 使用。
 */
import { compare } from 'compare-versions'
import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { chmod, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { currentArch, currentOS, defaultBrowserExeName, defaultFirefoxExeName, isMac } from '/@/constants/common'
import { fileOperations } from '/@/modules/fileOperations'
import { fileExists, request } from '/@/utils'

interface VersionInfo {
  /** 最新版本号 */
  version: string
  /** 发布时间 */
  releaseTime: string
}

/** 单个启动器变体：逻辑相同，仅可执行文件名与 OSS 资源名不同 */
interface LauncherResource {
  exeName: string
  resourceFileName: string
}

/** Chrome + Firefox 两套启动器，与 Tauri 打包产物一一对应 */
function getLauncherResources(): LauncherResource[] {
  const names = [defaultBrowserExeName, defaultFirefoxExeName]
  return names.map((exeName) => {
    const resourceFileName = {
      macos: `${exeName}.app.zip`,
      windows: `${exeName}.exe`,
      linux: `${exeName}.AppImage`,
    }[currentOS]
    return { exeName, resourceFileName }
  })
}

function getRemoteBaseUrl(webDomain: string) {
  return `${webDomain}/public/static/browser-launcher/${currentOS}/${currentArch}`
}

export const resourceUpdater = new class ResourceUpdater {
  timer: NodeJS.Timeout | null = null
  /** 网关域名（用于拼 OSS 静态资源 URL） */
  webDomain = ''
  /** 是否在下载中 */
  isInProgress = false
  /** 本会话内已成功同步的远程版本（须与本地两套启动器齐全一并判断，见 checkForUpdates） */
  remoteVersionInfo: VersionInfo | null = null

  readonly launchers = getLauncherResources()
  /** 启动器安装目录：RoxyChrome / RoxyFirefox 同级存放 */
  readonly binDir = appConfig.defaultBrowserBinDir
  readonly versionFilePath = join(appConfig.defaultBrowserBinDir, 'version.json')

  /** 最新 web 资源版本号文件地址 */
  get versionUrl() {
    return `${getRemoteBaseUrl(this.webDomain)}/version.json`
  }

  /** 单个启动器资源包下载地址 */
  getDownloadUrl(resourceFileName: string) {
    return `${getRemoteBaseUrl(this.webDomain)}/${resourceFileName}`
  }

  constructor() {
    this.startInterval()
  }

  async startInterval() {
    this.stopInterval()
    // 每 10 分钟检查一次远程 version.json
    this.timer = setInterval(() => {
      this.checkForUpdates()
    }, 1000 * 60 * 10)
  }

  async stopInterval() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  /** 判断本地是否已有该启动器产物（按平台扩展名） */
  async localArtifactExists(exeName: string) {
    if (isMac)
      return fileExists(join(this.binDir, `${exeName}.app`))
    if (currentOS === 'windows')
      return fileExists(join(this.binDir, `${exeName}.exe`))
    return fileExists(join(this.binDir, `${exeName}.AppImage`))
  }

  /** Chrome + Firefox 启动器是否都已落盘 */
  async allLocalArtifactsReady() {
    for (const launcher of this.launchers) {
      if (!(await this.localArtifactExists(launcher.exeName)))
        return false
    }
    return true
  }

  async collectMissingLaunchers() {
    const missing: LauncherResource[] = []
    for (const launcher of this.launchers) {
      if (!(await this.localArtifactExists(launcher.exeName)))
        missing.push(launcher)
    }
    return missing
  }

  /** 下载并落盘单个启动器；macOS 会在下载完成后解压 .app.zip */
  async downloadLauncher(launcher: LauncherResource) {
    const localResourcePath = join(this.binDir, launcher.resourceFileName)
    console.log(`[ResourceUpdater] downloading ${launcher.resourceFileName}...`)

    const response = await request({
      url: this.getDownloadUrl(launcher.resourceFileName),
      method: 'get',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.total || 0
        const current = progressEvent.loaded
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0
        console.log(`[ResourceUpdater] ${launcher.resourceFileName} progress: ${percentage}%`)
      },
    })

    const writer = createWriteStream(localResourcePath)
    const { promise, resolve, reject } = Promise.withResolvers<void>()

    response.data.pipe(writer)
    writer.on('finish', async () => {
      writer.close()
      if (isMac)
        await this.extractMac(launcher.exeName, localResourcePath)
      resolve()
    })
    writer.on('error', reject)

    await promise
    console.log(`[ResourceUpdater] downloaded ${launcher.resourceFileName}`)
  }

  /**
   * 检查并拉取远程启动器。
   * @returns 是否已具备全部本地启动器（含本次下载成功）
   */
  async checkForUpdates(): Promise<boolean> {
    if (this.isInProgress) {
      return this.allLocalArtifactsReady()
    }

    this.isInProgress = true
    console.log('[ResourceUpdater] checkForUpdates start')
    try {
      this.webDomain = await getWebDomain(false)
      const remoteVersionInfo = await request.get<VersionInfo>(this.versionUrl, { timeout: 3 * 1000 }).then(response => response.data)
      console.log('[ResourceUpdater] remoteVersionInfo', remoteVersionInfo)

      const missingLaunchers = await this.collectMissingLaunchers()

      // 同一会话内已拉过相同或更高版本：仍需确认磁盘上两套启动器都在（避免只下了 Chrome 就跳过 Firefox）
      if (
        this.remoteVersionInfo
        && compare(this.remoteVersionInfo.version, remoteVersionInfo.version, '>=')
        && missingLaunchers.length === 0
      ) {
        console.log('[ResourceUpdater] checkForUpdates already downloaded')
        return true
      }

      const localVersion = await readFile(this.versionFilePath, 'utf8').then(data => JSON.parse(data).version).catch(() => '0.0.0')
      console.log('[ResourceUpdater] localVersion', localVersion)
      console.log('[ResourceUpdater] remoteVersion', remoteVersionInfo.version)

      const versionOutdated = compare(remoteVersionInfo.version, localVersion, '>')

      if (!versionOutdated && missingLaunchers.length === 0) {
        this.remoteVersionInfo = remoteVersionInfo
        console.log('[ResourceUpdater] local launchers up to date')
        return true
      }

      const toDownload = versionOutdated
        ? this.launchers
        : missingLaunchers

      console.log('[ResourceUpdater] will download:', toDownload.map(l => l.resourceFileName).join(', '))
      await fileExists(this.binDir, true)

      for (const launcher of toDownload)
        await this.downloadLauncher(launcher)

      this.remoteVersionInfo = remoteVersionInfo
      await writeFile(this.versionFilePath, JSON.stringify(remoteVersionInfo, null, 2), 'utf8')
      console.log('[ResourceUpdater] write version file', this.versionFilePath)
      console.log('[ResourceUpdater] all launchers updated')

      return this.allLocalArtifactsReady()
    }
    catch (error) {
      console.error('[ResourceUpdater] checkForUpdates error', error)
      return false
    }
    finally {
      this.isInProgress = false
    }
  }

  /** 解压 mac 资源包（RoxyChrome.app / RoxyFirefox.app） */
  async extractMac(exeName: string, zipPath: string) {
    console.log('[ResourceUpdater] extract start', exeName)
    const appPath = join(this.binDir, `${exeName}.app`)
    const macosBinPath = join(appPath, `Contents/MacOS/${exeName}`)

    // 先清理旧的 app，避免覆盖时残留导致异常
    await rm(appPath, { recursive: true, force: true }).catch(() => {})

    try {
      // macOS：用 ditto 解压 zip，尽量保留权限/资源 fork
      const r = spawnSync('ditto', ['-x', '-k', zipPath, this.binDir], {
        stdio: 'pipe',
        encoding: 'utf8',
      })
      if (r.status !== 0) {
        throw new Error(r.stderr || r.stdout || 'ditto 解压失败')
      }
    }
    catch (error) {
      // 兜底：仍走原来的 adm-zip 解压（可能会丢可执行位）
      console.warn('[ResourceUpdater] ditto extract failed, fallback to adm-zip:', error)
      await fileOperations.executeTask('decompress', {
        src: zipPath,
        dest: this.binDir,
      })
    }

    // 修复常见问题：可执行位 + quarantine
    await chmod(macosBinPath, 0o755).catch(() => {})
    // 某些 zip 可能导致 Frameworks 内可执行位丢失，这里做一个保守的“尽力补救”
    await chmod(join(appPath, 'Contents/MacOS'), 0o755).catch(() => {})
    await chmod(join(appPath, 'Contents/Frameworks'), 0o755).catch(() => {})

    // 去掉 quarantine，避免系统把它当作“下载的未知应用/已损坏”
    spawnSync('xattr', ['-dr', 'com.apple.quarantine', appPath], { stdio: 'pipe' })

    console.log('[ResourceUpdater] extract done:', appPath)
    await rm(zipPath).catch(() => {})
  }
}()
