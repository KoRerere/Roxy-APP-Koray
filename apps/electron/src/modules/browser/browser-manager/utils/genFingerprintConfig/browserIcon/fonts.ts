import type { SKRSContext2D } from '@napi-rs/canvas'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { existsSync } from 'node:fs'

let fontsReady = false
let measureCtx: SKRSContext2D | null = null

/** 已注册的系统字体候选 */
interface BadgeFontCandidate {
  path: string
  family: string
  weight: string
  /** 为 true 时仅当文本含非拉丁字符才参与排序靠前 */
  preferForNonLatin?: boolean
}

const WIN32_FONTS: BadgeFontCandidate[] = [
  // 微软雅黑优先：UI 小字号 hinting 优于 SimHei，任务栏更清晰
  { path: 'C:\\Windows\\Fonts\\msyh.ttc', family: 'Microsoft YaHei', weight: '600', preferForNonLatin: true },
  { path: 'C:\\Windows\\Fonts\\simhei.ttf', family: 'SimHei', weight: '400', preferForNonLatin: true },
  { path: 'C:\\Windows\\Fonts\\segoeuib.ttf', family: 'Segoe UI', weight: '600' },
  { path: 'C:\\Windows\\Fonts\\segoeui.ttf', family: 'Segoe UI', weight: '600' },
  { path: 'C:\\Windows\\Fonts\\ARIALUNI.TTF', family: 'Arial Unicode MS', weight: '400' },
]

const DARWIN_FONTS: BadgeFontCandidate[] = [
  // 单 TTF，覆盖 CJK + 大量 Unicode；避免 STHeiti/PingFang TTC 缺字
  { path: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf', family: 'Arial Unicode MS', weight: '700', preferForNonLatin: true },
  { path: '/System/Library/Fonts/Hiragino Sans GB.ttc', family: 'Hiragino Sans GB', weight: '500', preferForNonLatin: true },
  { path: '/System/Library/Fonts/Supplemental/Arial.ttf', family: 'Arial', weight: '600' },
  { path: '/System/Library/Fonts/Helvetica.ttc', family: 'Helvetica', weight: '600' },
]

const LINUX_FONTS: BadgeFontCandidate[] = [
  { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC', weight: '500', preferForNonLatin: true },
  { path: '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC', weight: '500', preferForNonLatin: true },
  { path: '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC', weight: '500', preferForNonLatin: true },
  { path: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', family: 'WenQuanYi Micro Hei', weight: '400', preferForNonLatin: true },
  { path: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', family: 'DejaVu Sans', weight: '600' },
]

const PLATFORM_FONTS: Partial<Record<NodeJS.Platform, BadgeFontCandidate[]>> = {
  win32: WIN32_FONTS,
  darwin: DARWIN_FONTS,
  linux: LINUX_FONTS,
}

/** 非拉丁字符（含 CJK、假名、韩文、阿拉伯文等） */
export function containsNonLatin(text: string): boolean {
  for (const ch of text) {
    if ((ch.codePointAt(0) ?? 0) > 0x024F)
      return true
  }
  return false
}

/** @deprecated 使用 containsNonLatin */
export function containsCjk(text: string): boolean {
  return containsNonLatin(text)
}

function getMeasureCtx(): SKRSContext2D {
  if (!measureCtx) {
    const canvas = createCanvas(1, 1)
    measureCtx = canvas.getContext('2d')
  }
  return measureCtx
}

/**
 * 检测字体是否能完整渲染文本（宽度一致，避免 Skia 缺字回退到无 CJK 的默认字体）。
 */
function fontSupportsBadgeText(text: string, family: string, weight: string, fontSize = 16): boolean {
  const ctx = getMeasureCtx()
  ctx.font = `${weight} ${fontSize}px ${family}`
  let sum = 0
  for (const ch of text) {
    const w = ctx.measureText(ch).width
    if (w <= 0)
      return false
    sum += w
  }
  const whole = ctx.measureText(text).width
  // 混用 fallback 字体时，整句宽度常与逐字累加不一致
  return Math.abs(whole - sum) < 1
}

function registerPlatformFonts(candidates: BadgeFontCandidate[]): void {
  const registeredFamilies = new Set<string>()
  for (const item of candidates) {
    if (registeredFamilies.has(item.family))
      continue
    if (!existsSync(item.path))
      continue
    try {
      GlobalFonts.registerFromPath(item.path, item.family)
      registeredFamilies.add(item.family)
    }
    catch {
      // 已注册或格式不支持时忽略
    }
  }
}

/** 注册当前平台可用的系统字体 */
export function ensureBadgeFonts(): void {
  if (fontsReady)
    return
  fontsReady = true
  registerPlatformFonts(PLATFORM_FONTS[process.platform] ?? [])
}

function orderCandidates(text: string, candidates: BadgeFontCandidate[]): BadgeFontCandidate[] {
  const nonLatin = containsNonLatin(text)
  const forNonLatin = candidates.filter(c => c.preferForNonLatin)
  const forLatin = candidates.filter(c => !c.preferForNonLatin)
  const primary = nonLatin ? [...forNonLatin, ...forLatin] : [...forLatin, ...forNonLatin]

  const seen = new Set<string>()
  const ordered: BadgeFontCandidate[] = []
  for (const c of [...primary, ...candidates]) {
    if (seen.has(c.family))
      continue
    seen.add(c.family)
    ordered.push(c)
  }
  return ordered
}

let lastResolved: { family: string, weight: string } = { family: 'sans-serif', weight: '500' }

/** 为文本解析可用的系统字体（带缺字检测） */
function resolveBadgeFont(text: string): { family: string, weight: string } {
  ensureBadgeFonts()
  const trimmed = text.trim()
  if (!trimmed) {
    lastResolved = { family: 'sans-serif', weight: '500' }
    return lastResolved
  }

  const candidates = PLATFORM_FONTS[process.platform] ?? []
  for (const candidate of orderCandidates(trimmed, candidates)) {
    if (!GlobalFonts.has(candidate.family))
      continue
    if (fontSupportsBadgeText(trimmed, candidate.family, candidate.weight)) {
      lastResolved = { family: candidate.family, weight: candidate.weight }
      return lastResolved
    }
  }

  // 未通过检测时仍尝试第一个已注册字体，优于 sans-serif
  for (const candidate of candidates) {
    if (GlobalFonts.has(candidate.family)) {
      lastResolved = { family: candidate.family, weight: candidate.weight }
      return lastResolved
    }
  }

  console.warn('[badgeFont] 系统字体不可用，文字可能显示为方块:', trimmed.slice(0, 8))
  lastResolved = { family: 'sans-serif', weight: '500' }
  return lastResolved
}

export function getBadgeFontFamily(text = ''): string {
  return resolveBadgeFont(text).family
}

export function getBadgeFontWeight(text = ''): string {
  resolveBadgeFont(text)
  return lastResolved.weight
}

export function formatBadgeFont(fontSize: number, text = '', weightOverride?: string): string {
  const { family, weight } = resolveBadgeFont(text)
  return `${weightOverride ?? weight} ${fontSize}px ${family}`
}

/** 是否存在已注册的系统字体 */
export function hasBadgeFontSupport(): boolean {
  ensureBadgeFonts()
  const candidates = PLATFORM_FONTS[process.platform] ?? []
  return candidates.some(c => GlobalFonts.has(c.family))
}
