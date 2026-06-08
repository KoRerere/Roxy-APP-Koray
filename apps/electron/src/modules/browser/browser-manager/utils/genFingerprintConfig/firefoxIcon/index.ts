import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { isMac, isWindows } from '/@/constants/common'
// appConfig 仅用于 staticResourceDir（FALLBACK_ICON 和 baseIcon），不再依赖 firefoxIconsCacheDir
import { isPngBuffer, packIcns, parseIcns } from './icns'
import { pngToIco } from './ico'
import { renderBadgedPng } from './render'

/** 资源版本号：每次升级 logo 资源或视觉规范时 +1，旧缓存文件自然失效 */
const ASSET_VERSION = 'v1'

/**
 * 平台配置：封装当前 OS 所需的基底图标、输出扩展名及格式打包逻辑。
 *
 * - Windows : 输出 .ico（64×64 PNG-in-ICO，Vista+ 格式）
 * - macOS   : 输出 .icns（基于原 icon.icns 拆帧 → 逐帧叠加徽章 → 重打包，
 *                        完整保留原图的背景色 / 圆角 / 立体阴影等品牌样式）
 * - Linux   : 输出 .png（128×128，满足 XDG 任务栏 / Dock 规范）
 */
interface PlatformConfig {
  /** resources/firefox/ 下的基底图标；用于 Canvas 绘制时的底图 */
  baseIcon: string
  /** 输出文件扩展名（不含 '.'） */
  ext: string
  /** 接收基底路径和编号，返回目标格式的 Buffer */
  pack: (baseIcon: string, num: number) => Promise<Buffer>
}

/**
 * macOS 徽章渲染最小尺寸阈值。
 *
 * 小于该阈值（如 ic04 16×16、ic11 16×16@2x）的帧不绘制徽章，避免出现
 * 难以辨识的“红色像素块”。系统在 Dock / 任务切换器中默认展示的是大尺寸
 * 帧（128+），小尺寸保留原图即可。
 */
const MAC_BADGE_MIN_SIZE = 32

function makePlatformConfig(): PlatformConfig {
  const firefoxResDir = join(appConfig.staticResourceDir, 'firefox')

  if (isWindows) {
    // Windows 渲染基底：PNG（Skia 解码兼容性最佳）
    const basePng = join(firefoxResDir, 'icon.png')
    return {
      baseIcon: basePng,
      ext: 'ico',
      async pack(iconPath, num) {
        // 64px 对 Windows 任务栏 / 标题栏已足够；ICO 会自动降采样
        const png = await renderBadgedPng(iconPath, num, 64)
        return pngToIco(png)
      },
    }
  }

  if (isMac) {
    // macOS 渲染基底：直接使用原 icon.icns，避免丢失多档分辨率和品牌底色
    const baseIcns = join(firefoxResDir, 'icon.icns')
    return {
      baseIcon: baseIcns,
      ext: 'icns',
      async pack(iconPath, num) {
        // 1) 拆帧：parseIcns 保留原始顺序与所有 OSType 块（PNG / ARGB / info）
        const src = await readFile(iconPath)
        const blocks = parseIcns(src)

        // 2) 并行处理：仅替换"足够大的 PNG 帧"，其余原样保留：
        //    - 非 PNG 块（ic04 / ic05 / info 等）直接保留，维持 ICNS 元信息完整
        //    - PNG 帧若宽度小于阈值（如 16×16）不叠加徽章，避免数字不可辨识
        //    - PNG 帧渲染时按原始分辨率输出，保留每档（128 / 256 / 512 / 1024）细节
        const patched = await Promise.all(
          blocks.map(async (block) => {
            if (!isPngBuffer(block.data))
              return block

            // PNG IHDR 起始偏移 = 8(magic) + 8(IHDR chunk len/type) = 16，宽 4 字节大端
            const width = block.data.readUInt32BE(16)
            if (width < MAC_BADGE_MIN_SIZE)
              return block

            const newPng = await renderBadgedPng(block.data, num)
            return { osType: block.osType, data: newPng }
          }),
        )

        // 3) 重打包：保持原顺序写回 .icns，系统按 OSType 自动挑选合适档位
        return packIcns(patched)
      },
    }
  }

  // Linux：单张 128×128 PNG，满足 XDG 图标主题规范及主流 DE 任务栏需求
  const basePng = join(firefoxResDir, 'icon.png')
  return {
    baseIcon: basePng,
    ext: 'png',
    async pack(iconPath, num) {
      return renderBadgedPng(iconPath, num, 128)
    },
  }
}

/** 进程级单例：平台配置在启动时确定，不随请求变化 */
const platformConfig = makePlatformConfig()

/**
 * 兜底静态图标：生成失败或编号无效时返回 resources/firefox/icon.{ext}
 * 路径按当前平台的格式自动选取（.ico / .icns / .png）
 */
const FALLBACK_ICON = join(appConfig.staticResourceDir, 'firefox', `icon.${platformConfig.ext}`)

/** 内存级并发去重：同一 cachePath 同时被多次请求时只执行一次 IO */
const inflight = new Map<string, Promise<string>>()

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  }
  catch {
    return false
  }
}

/**
 * 根据 windowSortNum 动态生成（或读取缓存的）Firefox 内核应用图标，图标存储于该浏览器实例的 userDataDir
 *
 * 跨平台输出格式由运行时 OS 决定：
 * - Windows : .ico（64×64 PNG-in-ICO）
 * - macOS   : .icns（基于原 icon.icns 拆帧 → 仅替换大于 32px 的 PNG 帧 → 重打包，
 *                    完整保留品牌背景色 / 圆角 / 多档分辨率）
 * - Linux   : .png（128×128）
 *
 * 双层缓存：
 * - 磁盘缓存：`{userDataDir}/{ASSET_VERSION}_{num}.firefox-icon.{ext}`，命中直接返回
 * - 内存 inflight：单进程并发同号请求合并为一次 IO，防止竞态写入
 *
 * 失败回退：任何异常均退化到 resources/firefox/icon.{ext}，保证 Firefox 启动不中断
 */
export async function ensureFirefoxIcon(windowSortNum: number | null | undefined, userDataDir: string): Promise<string> {
  if (!Number.isFinite(windowSortNum as number) || (windowSortNum as number) <= 0) {
    return FALLBACK_ICON
  }

  const num = Math.floor(windowSortNum as number)
  const key = `${ASSET_VERSION}_${num}`
  // 图标按版本+编号缓存在 userDataDir 根目录，windowSortNum 变化时自动生成新文件，旧文件随 userDataDir 清理
  const cachePath = join(userDataDir, `${key}.firefox-icon.${platformConfig.ext}`)

  // 磁盘缓存命中：直接返回，无需重新渲染
  if (await pathExists(cachePath))
    return cachePath

  // inflight 命中：复用已有 Promise，避免并发重复生成同一路径图标
  const cached = inflight.get(cachePath)
  if (cached)
    return cached

  const task = (async () => {
    // userDataDir 由调用方保证存在，此处仅防御性 mkdir
    await mkdir(userDataDir, { recursive: true })
    const buf = await platformConfig.pack(platformConfig.baseIcon, num)
    // 先写 .tmp 再 rename：保证落盘原子性，避免并发读到半成品
    const tmp = `${cachePath}.tmp`
    await writeFile(tmp, buf)
    await rename(tmp, cachePath)
    return cachePath
  })()
    .catch((err) => {
      console.error('[firefoxIcon] 生成动态图标失败，回退默认图标', err)
      return FALLBACK_ICON
    })
    .finally(() => inflight.delete(cachePath))

  inflight.set(cachePath, task)
  return task
}
