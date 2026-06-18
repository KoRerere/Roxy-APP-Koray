import type { BrowserIconPackFormat, RenderBadgedPngOptions } from '/@/modules/browserIconRenderWorker'
import { access, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants/appConfig'
import { isMac, isWindows } from '/@/constants/common'
import { browserIconRenderWorker, CHROME_BADGE_CSS, FIREFOX_BADGE_CSS } from '/@/modules/browserIconRenderWorker'

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
  ext: BrowserIconPackFormat
  badgeCss: string
}

function makePlatformConfig(resourceDir: string, renderOptions: RenderBadgedPngOptions): PlatformConfig {
  const resDir = join(appConfig.staticResourceDir, resourceDir)
  const badgeCss = renderOptions.badgeCss ?? FIREFOX_BADGE_CSS

  if (isWindows) {
    return {
      baseIcon: join(resDir, 'icon.png'),
      ext: 'ico',
      badgeCss,
    }
  }

  if (isMac) {
    return {
      baseIcon: join(resDir, 'icon.icns'),
      ext: 'icns',
      badgeCss,
    }
  }

  return {
    baseIcon: join(resDir, 'icon.png'),
    ext: 'png',
    badgeCss,
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

      await browserIconRenderWorker.writeIcon({
        baseIconPath: platformConfig.baseIcon,
        badgeText,
        badgeCss: platformConfig.badgeCss,
        packFormat: platformConfig.ext,
        iconPath,
        metaPath,
        cacheVersion: BROWSER_ICON_CACHE_VERSION,
      })
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
