import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type LauncherVariantId = 'chrome' | 'firefox'

export interface LauncherVariant {
  id: LauncherVariantId
  /** 产物文件名（不含扩展名）：RoxyChrome / RoxyFirefox 等 */
  appName: string
  /** 相对 src-tauri 的 Tauri 配置叠加文件；Chrome 使用基础 tauri.conf.json */
  configFile?: string
}

const FIREFOX_APP_NAME = 'RoxyFirefox'

export function getChromeAppName(): string {
  const fromEnv = process.env.ROXY_DEFAULT_BROWSER_APP_NAME?.trim()
  if (fromEnv)
    return fromEnv
  try {
    const tauriConfPath = join(import.meta.dirname, '../src-tauri/tauri.conf.json')
    const raw = readFileSync(tauriConfPath, 'utf8')
    const conf = JSON.parse(raw) as Record<string, unknown>
    const productName = String(conf.productName || '').trim()
    if (productName)
      return productName
  }
  catch {}
  return 'RoxyChrome'
}

/** 一次打包会依次构建 Chrome + Firefox 两个变体（逻辑相同，仅名称与图标不同） */
export function getLauncherVariants(): LauncherVariant[] {
  return [
    {
      id: 'chrome',
      appName: getChromeAppName(),
    },
    {
      id: 'firefox',
      appName: FIREFOX_APP_NAME,
      configFile: 'tauri.firefox.conf.json',
    },
  ]
}

export function resolveVariantConfigPath(configFile?: string): string | undefined {
  if (!configFile)
    return undefined
  const abs = join(import.meta.dirname, '../src-tauri', configFile)
  if (!existsSync(abs)) {
    throw new Error(`[tauri-build] 未找到变体配置文件：${abs}`)
  }
  return abs
}
