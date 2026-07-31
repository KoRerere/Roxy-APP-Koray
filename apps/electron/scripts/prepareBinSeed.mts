/**
 * 打包期准备 roxynet / roxysync 的内置 seed。
 *
 * 职责：
 * - 通过 /get_app_upgrade 解析 webDomain（与运行时 getWebDomain 一致）。
 * - 按“当前平台的每个目标 arch”下载 version + sha512，用 version+sha512 决定是否需要下载二进制。
 * - 下载的二进制先校验 sha512 再落盘到本地缓存 apps/electron/bin-seed/{env}/{os}/{ebArch}/。
 * - 通过 getSeedResourceEntries() 提供 electron-builder extraResources 条目，利用 ${arch} 宏
 *   让每个安装包按自身 arch 只内置对应的 seed（x86 装 x86、x64 装 x64）。
 *
 * 环境隔离：测试(dev)与生产(prod)的 webDomain 指向不同 OSS，二进制也不同，
 * 缓存必须按 env 分目录，避免打生产包时误用测试 seed（反之亦然）。
 *
 * 严格策略：远端拉取失败一律终止打包，绝不回退本地缓存（避免误用很久以前的过期 seed）。
 * 本地缓存仅用于“远端拉取成功、且缓存 sha512 与最新远端一致”时跳过重复下载——
 * 这是对最新远端校验过的命中，而非失败回退。
 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const isDev = process.env.NODE_ENV !== 'production'
const isAppx = process.env.BUILD_APPX === 'true'
/** 缓存环境段：dev / prod 严格隔离，杜绝测试 seed 混入生产包 */
const envDir = isDev ? 'dev' : 'prod'

/**
 * 与运行时 getGatewayConfig.ts 保持一致的默认 app 网关（全部网关请求失败时兜底）。
 */
const DEFAULT_APP_GATEWAY = isDev ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn'

/**
 * 网关配置地址列表（VITE_GATEWAY_URL_LIST，dotenvx 已注入 process.env）。
 * 拉取后得到 app_gateway，再据此请求 /get_app_upgrade 解析 webDomain。
 */
function getGateConfUrls(): string[] {
  const raw = process.env.VITE_GATEWAY_URL_LIST
  if (raw) {
    try {
      const list = JSON.parse(raw) as string[]
      if (Array.isArray(list) && list.length > 0) {
        return list
      }
    }
    catch {
      // 忽略解析失败，走下方默认值
    }
  }
  return [`${DEFAULT_APP_GATEWAY}/vgo/gateway`]
}

/**
 * 与运行时 osConfig 一致的 cpu / osBit。
 * webDomain 按 IP 就近返回、与 arch 无关，此处仅为通过 get_app_upgrade 的参数校验
 * （macOS 要求 cpu 必传）。
 */
const osConfigCpu = process.arch === 'x64' ? 'intel' : 'apple'
const osConfigOsBit = process.arch === 'x64' ? '64' : '32'

/**
 * 构造与运行时 getCommonRequestHeaders 一致的 app 请求头。
 * 服务端据此（尤其是 source=app / appVersion）才会返回 webDomain，否则返回空串。
 */
function getAppHeaders(): Record<string, string> {
  const isMac = process.platform === 'darwin'
  const isLinux = process.platform === 'linux'
  return {
    'Content-Type': 'application/json',
    'source': 'app',
    'appVersion': process.env.VITE_APP_VERSION || '',
    'osVersion': os.release().split('.')[0],
    'R-OS': isMac ? 'mac' : (isLinux ? 'linux' : 'win'),
    // 与运行时 getCommonRequestHeaders 一致：mac 走 cpu(intel/apple)，其余走位数
    'R-OSBIT': isMac ? osConfigCpu : osConfigOsBit,
    'language': 'zh-CN',
  }
}

const scriptDir = import.meta.dirname
/** 缓存根目录：apps/electron/bin-seed/{env}（extraResources from 相对 apps/electron 目录） */
const cacheRoot = path.join(scriptDir, '../bin-seed', envDir)

/** electron-builder 的 ${arch} 宏字面量（务必保持原样，交给 electron-builder 逐架构展开） */
// eslint-disable-next-line no-template-curly-in-string
const ARCH_MACRO = '${arch}'

/** 平台 -> OSS os 段（与运行时 currentOS 一致） */
const OSS_OS: Record<string, string> = {
  win32: 'windows',
  darwin: 'macos',
  linux: 'linux',
}

interface ArchPair {
  /** electron-builder 架构名（缓存目录名 / ${arch} 展开值） */
  eb: string
  /** OSS 架构段（与运行时 currentArch 一致） */
  oss: string
}

/** 当前平台的目标架构矩阵（须与 build.mts 的构建 target arch 保持一致） */
function getArchMatrix(): ArchPair[] {
  switch (process.platform) {
    case 'win32':
      return isAppx
        ? [{ eb: 'x64', oss: 'x64' }]
        : [{ eb: 'ia32', oss: 'x86' }, { eb: 'x64', oss: 'x64' }]
    case 'darwin':
      return [{ eb: 'x64', oss: 'intel' }, { eb: 'arm64', oss: 'apple' }]
    case 'linux':
      return [{ eb: 'x64', oss: 'x64' }]
    default:
      return []
  }
}

interface SeedSpec {
  /** OSS 静态资源路径段 */
  seg: string
  /** 二进制文件名（含扩展名） */
  binName: string
  /** 内置到 resources 下的目标目录名（与 appConfig.{seg}SeedDir 对应） */
  seedDirName: string
}

/** 需要内置的二进制：roxynet 全平台；roxysync 仅 Windows */
function getSeedSpecs(): SeedSpec[] {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const specs: SeedSpec[] = [
    { seg: 'roxynet', binName: `roxynet${ext}`, seedDirName: 'roxynet-seed' },
  ]
  if (process.platform === 'win32') {
    specs.push({ seg: 'roxysync', binName: 'roxy-sync.exe', seedDirName: 'roxy-sync-seed' })
  }
  return specs
}

const ossOs = OSS_OS[process.platform] ?? process.platform

function sha512Hex(buf: Buffer) {
  return createHash('sha512').update(buf).digest('hex')
}

async function fileExists(p: string) {
  return access(p).then(() => true).catch(() => false)
}

let cachedWebDomain: string | null = null

/**
 * 解析托管静态 seed 的 webDomain（与运行时完全一致的两步流程）：
 * 1. 拉取网关配置（VITE_GATEWAY_URL_LIST），得到 app_gateway；
 * 2. 带 app 请求头 POST app_gateway/get_app_upgrade，取 data.webDomain（限流等瞬时失败时无限重试）。
 */
async function resolveWebDomain(): Promise<string> {
  if (cachedWebDomain) {
    return cachedWebDomain
  }

  // 1. 拉取网关配置 -> app_gateway
  let appGateway = ''
  for (const url of getGateConfUrls()) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const json = await res.json() as { code: number, data?: { app_gateway?: string } }
      if (json?.code === 0 && json.data?.app_gateway) {
        appGateway = json.data.app_gateway
        break
      }
    }
    catch {
      // 尝试下一个网关地址
    }
  }
  if (!appGateway) {
    appGateway = DEFAULT_APP_GATEWAY
  }

  // 2. get_app_upgrade -> webDomain（IP 就近的静态资源域名，通常为 OSS 域名）
  // 无限重试 + 退避：限流(code=249)等瞬时失败时持续等待，直到拿到最新 webDomain。
  const maxDelayMs = 30_000
  let attempt = 0
  let lastErr = ''
  while (true) {
    attempt++
    try {
      const res = await fetch(`${appGateway}/get_app_upgrade`, {
        method: 'POST',
        headers: getAppHeaders(),
        body: JSON.stringify({ os: process.platform, osVersion: os.release().split('.')[0], cpu: osConfigCpu, osBit: osConfigOsBit }),
        signal: AbortSignal.timeout(10000),
      })
      const json = await res.json() as { code: number, data?: { webDomain?: string }, msg?: string }
      if (json?.code === 0 && json.data?.webDomain) {
        cachedWebDomain = json.data.webDomain
        console.log('[prepareBinSeed] webDomain =', cachedWebDomain)
        return cachedWebDomain
      }
      lastErr = `code=${json?.code} msg=${json?.msg ?? ''}`
    }
    catch (error) {
      lastErr = (error as Error).message
    }
    const delayMs = Math.min(2000 * attempt, maxDelayMs)
    console.warn(`[prepareBinSeed] resolve webDomain attempt ${attempt} failed: ${lastErr}, retrying in ${delayMs}ms...`)
    await sleep(delayMs)
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`)
  }
  return (await res.text()).trim()
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) })
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/** 处理单个 (seg, arch) 的 seed：远端 sha512 与缓存一致则跳过，否则下载校验落盘；远端拉取失败则终止 */
async function prepareOne(spec: SeedSpec, arch: ArchPair) {
  const archDir = path.join(cacheRoot, ossOs, arch.eb)
  mkdirSync(archDir, { recursive: true })
  const binPath = path.join(archDir, spec.binName)
  const versionPath = path.join(archDir, `${spec.seg}.version`)
  const sha512Path = path.join(archDir, `${spec.seg}.sha512`)

  /** 校验本地缓存二进制是否与给定 sha512 一致 */
  const cacheMatches = async (expectedSha: string) => {
    if (!expectedSha || !(await fileExists(binPath))) {
      return false
    }
    const localSha = sha512Hex(await readFile(binPath))
    return localSha === expectedSha
  }

  let remoteVersion = ''
  let remoteSha = ''
  let downloadUrl = ''
  try {
    // 解析域名与拉取 version/sha512 都可能因网络失败，统一在 catch 中终止打包（严格模式）
    const webDomain = await resolveWebDomain()
    const versionUrl = `${webDomain}/public/static/${spec.seg}/version`
    const sha512Url = `${webDomain}/public/static/${spec.seg}/${ossOs}/${arch.oss}/sha512`
    downloadUrl = `${webDomain}/public/static/${spec.seg}/${ossOs}/${arch.oss}/${spec.binName}`
    ;[remoteVersion, remoteSha] = await Promise.all([fetchText(versionUrl), fetchText(sha512Url)])
  }
  catch (error) {
    // 严格模式：远端拉取失败一律终止打包，绝不回退本地缓存，
    // 避免误把很久以前的过期 seed 打进包里（宁可失败也不产出内容存疑的安装包）。
    throw new Error(`cannot prepare seed for ${spec.seg}/${arch.eb}: failed to fetch remote info (${(error as Error).message})`)
  }

  // version + sha512 决定是否需要下载
  if (await cacheMatches(remoteSha)) {
    console.log(`[prepareBinSeed] ${spec.seg}/${arch.eb} cache hit, skip download (version=${remoteVersion})`)
    await writeFile(versionPath, remoteVersion, 'utf8')
    await writeFile(sha512Path, remoteSha, 'utf8')
    return
  }

  console.log(`[prepareBinSeed] downloading ${spec.seg}/${arch.eb} (version=${remoteVersion})...`)
  const buf = await fetchBuffer(downloadUrl)
  const realSha = sha512Hex(buf)
  if (realSha !== remoteSha) {
    throw new Error(`${spec.seg}/${arch.eb} sha512 verification failed`)
  }
  // 原子落盘：先写临时文件再 rename
  const tmp = `${binPath}.downloading`
  await writeFile(tmp, buf)
  await rm(binPath, { force: true }).catch(() => {})
  await rename(tmp, binPath)
  await writeFile(versionPath, remoteVersion, 'utf8')
  await writeFile(sha512Path, remoteSha, 'utf8')
  console.log(`[prepareBinSeed] ${spec.seg}/${arch.eb} ready`)
}

/** 打包前调用：准备当前平台所有目标 arch 的 seed */
export async function prepareBinSeed() {
  const archMatrix = getArchMatrix()
  if (archMatrix.length === 0) {
    console.log('[prepareBinSeed] no seed required for current platform')
    return
  }
  const specs = getSeedSpecs()
  console.log(`[prepareBinSeed] platform=${process.platform} arch=${archMatrix.map(a => a.eb).join(',')} resources=${specs.map(s => s.seg).join(',')}`)
  for (const spec of specs) {
    for (const arch of archMatrix) {
      await prepareOne(spec, arch)
    }
  }
  console.log('[prepareBinSeed] all seeds prepared')
}

/**
 * 生成 electron-builder extraResources 条目：
 * 用 ${arch} 宏按安装包 arch 分别内置对应 seed，os 段用当前平台字面量固定。
 */
export function getSeedResourceEntries(): { from: string, to: string }[] {
  const specs = getSeedSpecs()
  const entries: { from: string, to: string }[] = []
  for (const spec of specs) {
    const fromDir = `bin-seed/${envDir}/${ossOs}/${ARCH_MACRO}`
    entries.push(
      { from: `${fromDir}/${spec.binName}`, to: `${spec.seedDirName}/${spec.binName}` },
      { from: `${fromDir}/${spec.seg}.version`, to: `${spec.seedDirName}/version` },
      { from: `${fromDir}/${spec.seg}.sha512`, to: `${spec.seedDirName}/sha512` },
    )
  }
  return entries
}

// 允许直接以脚本方式运行（调试用）
if (process.argv[1]?.endsWith('prepareBinSeed.mts')) {
  prepareBinSeed().catch((error) => {
    console.error('[prepareBinSeed] failed:', error)
    process.exit(1)
  })
}
