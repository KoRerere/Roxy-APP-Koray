import { isMac, isWindows } from '/@/constants/common'
import { measureBadgeTextWidth } from './textMeasure'

/**
 * 徽章宽 / 高占画布的比例（与 render.ts 保持一致，修改时需同步）。
 * Windows：底色与内核图标等宽；macOS / Linux 保持原有居中胶囊比例。
 */
export const BADGE_W_RATIO = isWindows ? 1 : isMac ? 0.8 : 0.92
export const BADGE_H_RATIO = isMac ? (0.5 * 2) / 3.3 : 0.5

/** macOS ICNS 中叠加徽章的最小参考帧尺寸（与 ensure.ts 一致） */
export const MAC_BADGE_MIN_SIZE = 32

/**
 * Windows 各 DPI 任务栏常用像素档（96 DPI 基准 × 缩放系数）：
 * 100% → 16~32，125% → 20~40，150% → 24~48，200% → 32~64。
 * ICO 需覆盖这些档位，避免系统选不到合适帧而二次缩放糊字。
 */
export const WINDOWS_ICO_SIZES = [256, 128, 96, 64, 48, 40, 36, 32, 30, 24, 20, 16] as const

/** 小于该尺寸的 ICO 帧不叠加徽章（16px 仅显示基底图标） */
export const WINDOWS_BADGE_MIN_SIZE = 20

/** 各平台 fitBadgeText 参考的最小画布尺寸（取各平台任务栏实际可见的最小徽章帧） */
export function getMinBadgeCanvasSize(): number {
  return isWindows ? WINDOWS_BADGE_MIN_SIZE : MAC_BADGE_MIN_SIZE
}

/** @deprecated 使用 getMinBadgeCanvasSize() */
export const BADGE_FIT_CANVAS_SIZE = MAC_BADGE_MIN_SIZE

/** 窗口编号等短数字允许的最小字号（绝对下限） */
export const BADGE_MIN_FONT_SIZE = 6

/** 字号相对徽章高度的内边距（measureText 已精确，仅留 1px 安全边） */
export const BADGE_FONT_PADDING = 1

/** 计算指定画布下徽章几何尺寸与水平偏移 */
export function getBadgeGeometry(canvasSize: number): { bW: number, bH: number, bX: number } {
  const bW = Math.round(canvasSize * BADGE_W_RATIO)
  const bH = Math.round(canvasSize * BADGE_H_RATIO)
  const bX = Math.round((canvasSize - bW) / 2)
  return { bW, bH, bX }
}

/**
 * windowName 在参考画布上的可读字号下限：约为徽章高度的 55%，
 * 保证 32px 任务栏档位也能辨认中文 / 英文 / 其他 Unicode 文字。
 */
export function getBadgeReadableMinFontSize(canvasSize: number): number {
  const { bH } = getBadgeGeometry(canvasSize)
  return Math.max(7, Math.min(14, Math.floor(bH * 0.55)))
}

/**
 * 计算徽章最优字号：高度约束与 measureText 宽度约束取较小值。
 * @param minFontSize 字号下限（windowName 用可读下限，编号用 BADGE_MIN_FONT_SIZE）
 */
export function computeOptimalBadgeFontSize(
  text: string,
  canvasSize: number,
  minFontSize = BADGE_MIN_FONT_SIZE,
): number {
  const { bW, bH } = getBadgeGeometry(canvasSize)
  const maxWidth = bW * 0.9
  let fontSize = Math.floor(bH * 0.85)
  while (fontSize > 0 && measureBadgeTextWidth(text, fontSize) > maxWidth)
    fontSize--
  return Math.max(minFontSize, fontSize - BADGE_FONT_PADDING)
}

/**
 * 估算徽章文字占位宽度（em），CJK 全角按 1em、拉丁数字按 0.55em。
 * 仅作快速估算；fitBadgeText / drawBadge 以 measureText 为准。
 */
export function estimateBadgeTextWidthEm(text: string): number {
  let width = 0
  for (const ch of text) {
    width += (ch.codePointAt(0) ?? 0) <= 0x024F ? 0.55 : 1
  }
  return Math.max(width, 0.55)
}

/** @deprecated 请使用 computeOptimalBadgeFontSize */
export function computeBadgeFontSize(text: string, canvasSize: number): number {
  return computeOptimalBadgeFontSize(text, canvasSize, BADGE_MIN_FONT_SIZE)
}

/**
 * 判断 windowName 在参考画布下能否完整放入徽章且字号达到可读下限。
 */
export function badgeTextFits(text: string, canvasSize: number): boolean {
  const { bW, bH } = getBadgeGeometry(canvasSize)
  const readableMin = getBadgeReadableMinFontSize(canvasSize)
  const fontSize = computeOptimalBadgeFontSize(text, canvasSize, readableMin)

  if (fontSize < readableMin)
    return false
  if (measureBadgeTextWidth(text, fontSize) > bW * 0.9)
    return false
  if (fontSize > bH * 0.85)
    return false
  return true
}

/**
 * 在任务栏徽章可读性约束下，尽可能多地保留窗口名称字符。
 * 支持中文、英文及混合文本；按任务栏最小徽章帧 + 可读字号下限估算，避免过小看不清。
 */
export function fitBadgeText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed)
    return ''

  const canvasSize = getMinBadgeCanvasSize()
  const chars = [...trimmed]

  // 从最长前缀开始尝试，取能完整放入徽章的最长片段
  for (let end = chars.length; end >= 1; end--) {
    const candidate = chars.slice(0, end).join('')
    if (badgeTextFits(candidate, canvasSize))
      return candidate
  }

  return chars[0] ?? ''
}
