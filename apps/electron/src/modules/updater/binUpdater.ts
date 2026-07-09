/**
 * roxynet / roxysync 二进制的“内置 seed + 后台 pending 更新 + 空闲 apply”统一更新器。
 *
 * 三层模型（每个二进制独立一套）：
 * - seed  ：打包期按 arch 内置到 resources/{seg}-seed（只读），含 二进制 + version + sha512。
 * - active：真正被 spawn 的运行副本，位于 sessionData/{seg}-bin，含 二进制 + version + sha512。
 * - pending：后台下载暂存，位于 active 目录下 pending/ 子目录，含 二进制 + version + sha512。
 *
 * 关键不变量：
 * - active / pending 落盘后都必须通过 sha512 校验（下载先写临时文件再校验再 rename）。
 * - 下载进行中（isDownloading）禁止 apply，避免读到写了一半的 pending。
 * - apply 只在“空闲”时进行（roxynet 与 roxysync 空闲判定不同），并在替换前二次校验空闲以缩短竞态窗口。
 * - 启动阶段只做本地 seed 自愈（不联网、不阻塞启动页），联网更新一律放后台。
 */
import { compare } from 'compare-versions'
import { createWriteStream } from 'node:fs'
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { currentArch, currentOS, isWindows } from '/@/constants/common'
import { browserManager } from '/@/modules/browser'
import { getRoxynetProcess, stopRoxynet } from '/@/modules/roxynet'
import { getSyncWindowCount } from '/@/modules/sync-control/bin'
import { calculateFileHash, fileExists, getErrorMessage, isProxyDetectionInFlight, request } from '/@/utils'

/**
 * 下载文件到指定路径（流式）。
 * 采用“不活动看门狗”：一段时间内没有任何下载进度即判定超时中断，避免大文件卡死。
 */
async function downloadToFile(url: string, outputPath: string, inactivityMs = 30_000) {
  const response = await request({
    url,
    method: 'get',
    responseType: 'stream',
    // 关闭 axios 的总超时（会中断大文件），改由下方不活动看门狗兜底
    timeout: 0,
  })

  const writer = createWriteStream(outputPath)
  const { promise, resolve, reject } = Promise.withResolvers<void>()

  let settled = false
  let watchdog: NodeJS.Timeout | null = null
  const armWatchdog = () => {
    if (watchdog) {
      clearTimeout(watchdog)
    }
    watchdog = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      response.data.destroy(new Error('download inactivity timeout'))
      writer.destroy()
      reject(new Error(`download timeout: ${url}`))
    }, inactivityMs)
  }

  const finish = (fn: () => void) => {
    if (settled) {
      return
    }
    settled = true
    if (watchdog) {
      clearTimeout(watchdog)
    }
    fn()
  }

  armWatchdog()
  response.data.on('data', armWatchdog)
  response.data.on('error', (error: Error) => finish(() => reject(error)))
  writer.on('error', (error: Error) => finish(() => reject(error)))
  writer.on('finish', () => finish(() => resolve()))
  response.data.pipe(writer)

  return promise
}

/**
 * 原子替换文件：src -> dest。
 * 优先 rename（同分区近乎瞬时且原子）；Windows 上目标 exe 可能刚被 kill 尚未释放句柄，
 * rename 会抛 EBUSY/EPERM/EEXIST，这里做有限次重试。
 */
async function atomicReplaceFile(src: string, dest: string) {
  const maxRetry = 5
  for (let i = 0; i < maxRetry; i++) {
    try {
      await rename(src, dest)
      return
    }
    catch (error: any) {
      // 跨分区无法 rename，退化为 copy + rm
      if (error?.code === 'EXDEV') {
        await copyFile(src, dest)
        await rm(src, { force: true }).catch(() => {})
        return
      }
      // 目标被占用/已存在：尝试删除后重试（Windows 释放句柄有延迟）
      if (i < maxRetry - 1 && ['EBUSY', 'EPERM', 'EEXIST', 'EACCES'].includes(error?.code)) {
        await rm(dest, { force: true }).catch(() => {})
        await sleep(300 * (i + 1))
        continue
      }
      throw error
    }
  }
}

interface BinUpdaterOptions {
  /** 日志用名称 */
  name: string
  /** active 二进制路径（appConfig.roxynetBinPath / roxySyncBinPath） */
  binPath: string
  /** seed 目录（appConfig.roxynetSeedDir / roxySyncSeedDir） */
  seedDir: string
  /** OSS 静态资源路径段：roxynet / roxysync */
  ossSeg: string
  /** 是否启用（roxysync 仅 Windows） */
  enabled: boolean
  /** 空闲判定：满足才允许热替换 active */
  isIdle: () => boolean
  /** apply 前置动作（如 roxynet 需要先停进程） */
  beforeApply?: () => Promise<void> | void
}

/** 单个二进制资源的更新器 */
class BinResourceUpdater {
  private readonly options: BinUpdaterOptions
  /** 正在下载 pending（下载中禁止 apply） */
  private isDownloading = false
  /** 正在执行 apply（避免并发 apply / 与下载交叠） */
  private isApplying = false
  private checkTimer: NodeJS.Timeout | null = null
  private applyTimer: NodeJS.Timeout | null = null

  constructor(options: BinUpdaterOptions) {
    this.options = options
  }

  private get binFileName() {
    return this.options.binPath.split(/[/\\]/).pop()!
  }

  private get activeDir() {
    return dirname(this.options.binPath)
  }

  private get activeVersionPath() {
    return join(this.activeDir, 'version')
  }

  private get activeSha512Path() {
    return join(this.activeDir, 'sha512')
  }

  private get pendingDir() {
    return join(this.activeDir, 'pending')
  }

  private get pendingBinPath() {
    return join(this.pendingDir, this.binFileName)
  }

  private get pendingVersionPath() {
    return join(this.pendingDir, 'version')
  }

  private get pendingSha512Path() {
    return join(this.pendingDir, 'sha512')
  }

  private get seedBinPath() {
    return join(this.options.seedDir, this.binFileName)
  }

  private get seedVersionPath() {
    return join(this.options.seedDir, 'version')
  }

  private get seedSha512Path() {
    return join(this.options.seedDir, 'sha512')
  }

  private versionUrl(webDomain: string) {
    return `${webDomain}/public/static/${this.options.ossSeg}/version`
  }

  private sha512Url(webDomain: string) {
    return `${webDomain}/public/static/${this.options.ossSeg}/${currentOS}/${currentArch}/sha512`
  }

  private downloadUrl(webDomain: string) {
    return `${webDomain}/public/static/${this.options.ossSeg}/${currentOS}/${currentArch}/${this.binFileName}`
  }

  private async readText(path: string) {
    return readFile(path, 'utf8').then(t => t.trim()).catch(() => '')
  }

  /** active 是否健康：存在且与元数据 sha512 一致（无元数据视为不健康，触发 seed 自愈） */
  private async isActiveHealthy() {
    if (!(await fileExists(this.options.binPath))) {
      return false
    }
    const metaSha = await this.readText(this.activeSha512Path)
    if (!metaSha) {
      return false
    }
    const realSha = await calculateFileHash(this.options.binPath).catch(() => '')
    return !!realSha && realSha === metaSha
  }

  /**
   * pending 是否就绪：存在、元数据完整且实际 sha512 校验通过。
   * @param expectedSha 若传入，则还需与该远端 sha512 一致
   */
  private async isPendingReady(expectedSha?: string) {
    if (!(await fileExists(this.pendingBinPath))) {
      return false
    }
    const metaSha = await this.readText(this.pendingSha512Path)
    if (!metaSha) {
      return false
    }
    if (expectedSha && metaSha !== expectedSha) {
      return false
    }
    const realSha = await calculateFileHash(this.pendingBinPath).catch(() => '')
    return !!realSha && realSha === metaSha
  }

  private async clearPending() {
    await rm(this.pendingDir, { recursive: true, force: true }).catch(() => {})
  }

  /** 写入 active 的 version / sha512 元数据 */
  private async writeActiveMeta(version: string, sha512: string) {
    await writeFile(this.activeVersionPath, version, 'utf8')
    await writeFile(this.activeSha512Path, sha512, 'utf8')
  }

  /**
   * 从 seed 原子写入 active（自愈）：
   * 先校验 seed 自身完整性，再写临时文件、rename 到 active，最后写元数据。
   * @returns 是否成功自愈
   */
  private async copyFromSeedAtomic() {
    if (!(await fileExists(this.seedBinPath))) {
      console.log(`[BinUpdater:${this.options.name}] seed missing, skip self-heal`)
      return false
    }
    // 以 seed 二进制的真实哈希为准，保证写入 active 后元数据自洽
    const realSha = await calculateFileHash(this.seedBinPath).catch(() => '')
    if (!realSha) {
      return false
    }
    const seedSha = await this.readText(this.seedSha512Path)
    if (seedSha && seedSha !== realSha) {
      console.error(`[BinUpdater:${this.options.name}] seed sha512 mismatch, abort self-heal`)
      return false
    }
    const seedVersion = (await this.readText(this.seedVersionPath)) || '0.0.0'

    await fileExists(this.activeDir, true)
    const tmp = `${this.options.binPath}.seed-${Date.now()}`
    try {
      await copyFile(this.seedBinPath, tmp)
      await atomicReplaceFile(tmp, this.options.binPath)
      await this.writeActiveMeta(seedVersion, realSha)
      console.log(`[BinUpdater:${this.options.name}] active restored from seed (version=${seedVersion})`)
      return true
    }
    catch (error) {
      await rm(tmp, { force: true }).catch(() => {})
      console.error(`[BinUpdater:${this.options.name}] failed to restore active from seed`, getErrorMessage(error))
      return false
    }
  }

  /**
   * 启动阶段确保 active 可用（本地、快速、不联网）：
   * 1) active 健康 -> 直接返回；
   * 2) 否则从 seed 原子自愈；
   * 3) seed 不可用（如 dev 环境）-> 回退联网下载直接落到 active（此时无 active 无法启动，必须补齐）。
   */
  async ensureActiveFromSeed() {
    if (!this.options.enabled) {
      return
    }
    try {
      if (await this.isActiveHealthy()) {
        return
      }
      if (await this.copyFromSeedAtomic()) {
        return
      }
      // 兜底：seed 与 active 都不可用，只能联网补齐（尽量不发生，仅 dev / 异常场景）
      console.log(`[BinUpdater:${this.options.name}] seed unavailable, fallback to download active`)
      await this.downloadDirectlyToActive()
    }
    catch (error) {
      console.error(`[BinUpdater:${this.options.name}] ensureActiveFromSeed failed`, getErrorMessage(error))
    }
  }

  /** 兜底：联网下载并直接原子写入 active（仅在既无 seed 又无 active 时使用） */
  private async downloadDirectlyToActive() {
    const webDomain = await getWebDomain(false)
    if (!webDomain) {
      return
    }
    const sha = (await request.get(this.sha512Url(webDomain), { timeout: 5000 }).then(r => String(r.data).trim()).catch(() => ''))
    const version = (await request.get(this.versionUrl(webDomain), { timeout: 5000 }).then(r => String(r.data).trim()).catch(() => '')) || '0.0.0'
    if (!sha) {
      console.error(`[BinUpdater:${this.options.name}] remote sha512 unavailable, abort fallback download`)
      return
    }
    await fileExists(this.activeDir, true)
    const tmp = `${this.options.binPath}.dl-${Date.now()}`
    try {
      await downloadToFile(this.downloadUrl(webDomain), tmp)
      const realSha = await calculateFileHash(tmp)
      if (realSha !== sha) {
        throw new Error('active 兜底下载 sha512 校验失败')
      }
      await atomicReplaceFile(tmp, this.options.binPath)
      await this.writeActiveMeta(version, sha)
      console.log(`[BinUpdater:${this.options.name}] fallback download to active completed (version=${version})`)
    }
    catch (error) {
      await rm(tmp, { force: true }).catch(() => {})
      console.error(`[BinUpdater:${this.options.name}] fallback download to active failed`, getErrorMessage(error))
    }
  }

  /**
   * 后台检查更新：拉取远端 version + sha512，比 active 新则下载到 pending（含 sha512 校验）。
   * 下载完成后尝试 apply（此时下载锁已释放）。
   */
  async checkForUpdates() {
    if (!this.options.enabled || this.isDownloading) {
      return
    }

    let downloaded = false
    this.isDownloading = true
    try {
      const webDomain = await getWebDomain(false)
      if (!webDomain) {
        return
      }
      const [remoteVersion, remoteSha] = await Promise.all([
        request.get(this.versionUrl(webDomain), { timeout: 5000 }).then(r => String(r.data).trim()).catch(() => ''),
        request.get(this.sha512Url(webDomain), { timeout: 5000 }).then(r => String(r.data).trim()).catch(() => ''),
      ])
      if (!remoteVersion || !remoteSha) {
        console.log(`[BinUpdater:${this.options.name}] failed to fetch remote version/sha512, skip`)
        return
      }

      const activeSha = await this.readText(this.activeSha512Path)
      // sha512 是身份的权威依据：远端与本地元数据一致，说明已是最新版，清理残留 pending 即可。
      // 注意：这里不校验实际二进制与元数据的一致性——那是 ensureActiveFromSeed/isActiveHealthy 的职责；
      // checkForUpdates 只负责把"远端最新版"同步过来。
      if (activeSha && activeSha === remoteSha) {
        await this.clearPending()
        return
      }

      const activeVersion = (await this.readText(this.activeVersionPath)) || '0.0.0'
      // 仅当远端版本明确低于本地时才跳过（防降级）。
      // 远端 sha 已与本地不同，若 version 相等说明本地元数据/二进制损坏，仍需下载自修复；
      // 若 version 更高则是正常更新；两种情况都应继续。
      if (compare(remoteVersion, activeVersion, '<')) {
        console.log(`[BinUpdater:${this.options.name}] remote version ${remoteVersion} < active ${activeVersion}, skip to prevent downgrade`)
        return
      }

      // pending 已下载好且匹配远端：无需重复下载，直接进入 apply 阶段
      if (await this.isPendingReady(remoteSha)) {
        downloaded = true
      }
      else {
        // 下载到 pending：临时文件 -> 校验 sha512 -> rename
        console.log(`[BinUpdater:${this.options.name}] downloading new version to pending: ${activeVersion} -> ${remoteVersion}`)
        await fileExists(this.pendingDir, true)
        const tmp = `${this.pendingBinPath}.downloading`
        await downloadToFile(this.downloadUrl(webDomain), tmp)
        const realSha = await calculateFileHash(tmp)
        if (realSha !== remoteSha) {
          await rm(tmp, { force: true }).catch(() => {})
          throw new Error('pending sha512 校验失败')
        }
        await atomicReplaceFile(tmp, this.pendingBinPath)
        await writeFile(this.pendingVersionPath, remoteVersion, 'utf8')
        await writeFile(this.pendingSha512Path, remoteSha, 'utf8')
        downloaded = true
        console.log(`[BinUpdater:${this.options.name}] pending download verified (version=${remoteVersion})`)
      }
    }
    catch (error) {
      console.error(`[BinUpdater:${this.options.name}] checkForUpdates failed`, getErrorMessage(error))
    }
    finally {
      this.isDownloading = false
    }

    // 下载锁释放后再尝试 apply（下载中禁止 apply）
    if (downloaded) {
      await this.tryApplyPending()
    }
  }

  /**
   * 尝试在空闲时把 pending 热替换为 active。
   * 前置：非下载中、非 apply 中、pending 校验通过、处于空闲。
   * 替换前二次校验空闲以缩短竞态窗口；替换走原子 rename。
   */
  async tryApplyPending() {
    if (!this.options.enabled || this.isDownloading || this.isApplying) {
      return
    }
    if (!(await this.isPendingReady())) {
      return
    }
    if (!this.options.isIdle()) {
      return
    }

    this.isApplying = true
    try {
      // 二次校验：从判定到真正替换之间可能有新内核开始打开
      if (this.isDownloading || !this.options.isIdle() || !(await this.isPendingReady())) {
        return
      }

      const metaVersion = (await this.readText(this.pendingVersionPath)) || '0.0.0'
      const metaSha = await this.readText(this.pendingSha512Path)

      // apply 前置（roxynet：停进程，等待 OS 释放 exe 句柄）
      await this.options.beforeApply?.()

      await atomicReplaceFile(this.pendingBinPath, this.options.binPath)
      await this.writeActiveMeta(metaVersion, metaSha)

      // 复核 active：若替换后校验失败，立即从 seed 自愈兜底
      const realSha = await calculateFileHash(this.options.binPath).catch(() => '')
      if (realSha !== metaSha) {
        console.error(`[BinUpdater:${this.options.name}] active verification failed after apply, retry self-heal from seed`)
        await this.copyFromSeedAtomic()
        return
      }

      await this.clearPending()
      console.log(`[BinUpdater:${this.options.name}] applied new active version (version=${metaVersion})`)
    }
    catch (error) {
      console.error(`[BinUpdater:${this.options.name}] tryApplyPending failed`, getErrorMessage(error))
    }
    finally {
      this.isApplying = false
    }
  }

  /** 启动定时器：24h 检查更新 + 5min 兜底 apply（空闲时应用已就绪的 pending） */
  start() {
    if (!this.options.enabled) {
      return
    }
    this.stop()
    this.checkTimer = setInterval(() => {
      this.checkForUpdates()
    }, 1000 * 60 * 60 * 24)
    this.applyTimer = setInterval(() => {
      this.tryApplyPending()
    }, 1000 * 60 * 5)
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    if (this.applyTimer) {
      clearInterval(this.applyTimer)
      this.applyTimer = null
    }
  }
}

/**
 * roxynet 空闲：没有已打开/打开中的内核，且没有正在进行的代理检测。
 * openingBrowserMap 覆盖“打开中”边界（进程 spawn / 代理配置 / launchPromise 未完成）。
 */
function isRoxynetIdle() {
  return browserManager.openedBrowserMap.size === 0
    && browserManager.openingBrowserMap.size === 0
    && !isProxyDetectionInFlight()
}

/** roxysync 空闲：没有群控窗口在运行 */
function isRoxySyncIdle() {
  return getSyncWindowCount() === 0
}

export const roxynetBinUpdater = new BinResourceUpdater({
  name: 'roxynet',
  binPath: appConfig.roxynetBinPath,
  seedDir: appConfig.roxynetSeedDir,
  ossSeg: 'roxynet',
  enabled: true,
  isIdle: isRoxynetIdle,
  beforeApply: async () => {
    // 停掉正在运行的 roxynet，等待 OS 释放 exe 句柄，避免 Windows 替换文件被占用
    if (getRoxynetProcess()) {
      stopRoxynet()
      await sleep(500)
    }
  },
})

export const roxySyncBinUpdater = new BinResourceUpdater({
  name: 'roxysync',
  binPath: appConfig.roxySyncBinPath,
  seedDir: appConfig.roxySyncSeedDir,
  ossSeg: 'roxysync',
  // roxysync 目前仅 Windows 分发
  enabled: isWindows,
  isIdle: isRoxySyncIdle,
})

/** 启动阶段：本地 seed 自愈（不联网、不阻塞启动页） */
export async function ensureBinSeeds() {
  await roxynetBinUpdater.ensureActiveFromSeed()
  await roxySyncBinUpdater.ensureActiveFromSeed()
}

/** 启动后台更新器（仅注册定时检查 + 兜底 apply 定时器） */
export function startBinUpdaters() {
  roxynetBinUpdater.start()
  roxySyncBinUpdater.start()
}

/**
 * 触发一次首检。须在启动收尾（seed 自愈写好 active、roxynet 已启动）之后调用，
 * 避免与 ensureBinSeeds 争抢 active 元数据、与 startRoxynet 的进程 stop/start 竞态。
 */
export function triggerFirstBinCheck() {
  roxynetBinUpdater.checkForUpdates()
  roxySyncBinUpdater.checkForUpdates()
}

/** 空闲时机（如内核/群控关闭）触发一次 apply 尝试 */
export function tryApplyAllPendingBins() {
  roxynetBinUpdater.tryApplyPending()
  roxySyncBinUpdater.tryApplyPending()
}
