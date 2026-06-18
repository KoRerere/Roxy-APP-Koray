import type { RenderBadgedPngOptions } from './render'
import type { Buffer } from 'node:buffer'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants/appConfig'
import { isMac, isWindows } from '/@/constants/common'
import { MAC_BADGE_MIN_SIZE, WINDOWS_BADGE_MIN_SIZE, WINDOWS_ICO_SIZES } from './badgeMetrics'
import { isPngBuffer, packIcns, parseIcns } from './icns'
import { pngsToIco } from './ico'
import { CHROME_BADGE_CSS, FIREFOX_BADGE_CSS, renderBadgedPng, renderIconPng } from './render'

export type BrowserIconKind = 'firefox' | 'chrome'

/**
 * 图标缓存版本：render / badgeMetrics 或静态基底图标变更导致输出变化时 +1。
 */
export const BROWSER_ICON_CACHE_VERSION = 1

interface IconCacheMeta {
  version: number
  badge: string
}

interface BrowserIconDefinition {
  resourceDir: string
  iconBasename: string
  renderOptions: RenderBadgedPngOptions
  logTag: string
}

const BROWSER_ICON_DEFINITIONS: Record<BrowserIconKind, BrowserIconDefinition> = {
  firefox: {
    resourceDir: 'firefox',
    iconBasename: 'firefox-icon',
    renderOptions: { badgeCss: FIREFOX_BADGE_CSS },
    logTag: 'firefoxIcon',
  },
  chrome: {
    resourceDir: 'chrome',
    iconBasename: 'chrome-icon',
    renderOptions: { badgeCss: CHROME_BADGE_CSS },
    logTag: 'chromeIcon',
  },
}

interface PlatformConfig {
  baseIcon: string
  ext: string
  pack: (baseIcon: string, badgeText: string) => Promise<Buffer>
}

/** Windows 小于该尺寸的 ICO 帧不叠加徽章文字 */
const WINDOWS_ICO_BADGE_MIN_SIZE = WINDOWS_BADGE_MIN_SIZE

/** macOS 小于该尺寸的 ICNS 帧不叠加徽章，避免数字不可辨识 */
const MAC_ICNS_BADGE_MIN_SIZE = MAC_BADGE_MIN_SIZE

function makePlatformConfig(resourceDir: string, renderOptions: RenderBadgedPngOptions): PlatformConfig {
  const resDir = join(appConfig.staticResourceDir, resourceDir)

  if (isWindows) {
    const basePng = join(resDir, 'icon.png')
    return {
      baseIcon: basePng,
      ext: 'ico',
      async pack(iconPath, badgeText) {
        const pngs = await Promise.all(
          WINDOWS_ICO_SIZES.map(size =>
            size >= WINDOWS_ICO_BADGE_MIN_SIZE
              ? renderBadgedPng(iconPath, badgeText, size, renderOptions)
              : renderIconPng(iconPath, size),
          ),
        )
        return pngsToIco(pngs)
      },
    }
  }

  if (isMac) {
    const baseIcns = join(resDir, 'icon.icns')
    return {
      baseIcon: baseIcns,
      ext: 'icns',
      async pack(iconPath, badgeText) {
        const src = await readFile(iconPath)
        const blocks = parseIcns(src)

        const patched = await Promise.all(
          blocks.map(async (block) => {
            if (!isPngBuffer(block.data))
              return block

            const width = block.data.readUInt32BE(16)
            if (width < MAC_ICNS_BADGE_MIN_SIZE)
              return block

            const newPng = await renderBadgedPng(block.data, badgeText, undefined, renderOptions)
            return { osType: block.osType, data: newPng }
          }),
        )

        return packIcns(patched)
      },
    }
  }

  const basePng = join(resDir, 'icon.png')
  return {
    baseIcon: basePng,
    ext: 'png',
    async pack(iconPath, badgeText) {
      return renderBadgedPng(iconPath, badgeText, 128, renderOptions)
    },
  }
}

function getIconMetaPath(iconBasename: string, userDataDir: string): string {
  return join(userDataDir, `${iconBasename}.meta.json`)
}

async function readIconMeta(metaPath: string): Promise<IconCacheMeta | null> {
  try {
    const raw = await readFile(metaPath, 'utf8')
    const parsed = JSON.parse(raw) as IconCacheMeta
    if (typeof parsed.version !== 'number' || typeof parsed.badge !== 'string')
      return null
    return parsed
  }
  catch {
    return null
  }
}

async function isIconCacheValid(iconPath: string, metaPath: string, badgeText: string): Promise<boolean> {
  try {
    await access(iconPath)
  }
  catch {
    return false
  }

  const meta = await readIconMeta(metaPath)
  if (!meta)
    return false

  return meta.version === BROWSER_ICON_CACHE_VERSION && meta.badge === badgeText
}

async function writeIconMeta(metaPath: string, badgeText: string): Promise<void> {
  const meta: IconCacheMeta = {
    version: BROWSER_ICON_CACHE_VERSION,
    badge: badgeText,
  }
  await writeFile(metaPath, JSON.stringify(meta), 'utf8')
}

function resolveBadgeText(badge: string | number | null | undefined): string | null {
  if (badge == null)
    return null

  if (typeof badge === 'number') {
    if (!Number.isFinite(badge) || badge <= 0)
      return null
    return String(Math.floor(badge))
  }

  const text = String(badge).trim()
  return text || null
}

function createBrowserIconEnsurer(kind: BrowserIconKind) {
  const definition = BROWSER_ICON_DEFINITIONS[kind]
  const platformConfig = makePlatformConfig(definition.resourceDir, definition.renderOptions)
  const fallbackIcon = join(appConfig.staticResourceDir, definition.resourceDir, `icon.${platformConfig.ext}`)

  return async function ensureBrowserIcon(badge: string | number | null | undefined, userDataDir: string): Promise<string> {
    const badgeText = resolveBadgeText(badge)
    if (!badgeText)
      return fallbackIcon

    const iconPath = join(userDataDir, `${definition.iconBasename}.${platformConfig.ext}`)
    const metaPath = getIconMetaPath(definition.iconBasename, userDataDir)

    try {
      await mkdir(userDataDir, { recursive: true })

      if (await isIconCacheValid(iconPath, metaPath, badgeText))
        return iconPath

      const buf = await platformConfig.pack(platformConfig.baseIcon, badgeText)
      const tmp = `${iconPath}.tmp`
      await writeFile(tmp, buf)
      await rename(tmp, iconPath)
      await writeIconMeta(metaPath, badgeText)
      return iconPath
    }
    catch (err) {
      console.error(`[${definition.logTag}] 生成动态图标失败，回退默认图标`, err)
      return fallbackIcon
    }
  }
}

/**
 * 动态生成 Firefox 内核应用图标，写入 `{userDataDir}/firefox-icon.{ico|icns|png}`
 *
 * 跨平台输出格式由运行时 OS 决定；徽章未变时复用 userDataDir 内缓存；失败时回退到 resources/firefox/icon.{ext}
 */
export const ensureFirefoxIcon = createBrowserIconEnsurer('firefox')

/**
 * 动态生成 Chrome 内核应用图标，写入 `{userDataDir}/chrome-icon.{ico|icns|png}`
 *
 * 跨平台输出格式由运行时 OS 决定；徽章未变时复用 userDataDir 内缓存；失败时回退到 resources/chrome/icon.{ext}
 */
export const ensureChromeIcon = createBrowserIconEnsurer('chrome')
