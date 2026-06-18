import type { SKRSContext2D } from '@napi-rs/canvas'
import { createCanvas } from '@napi-rs/canvas'
import { ensureBadgeFonts, formatBadgeFont } from './fonts'

let measureCtx: SKRSContext2D | null = null

/** 复用单例 2D 上下文，避免 fitBadgeText / drawBadge 频繁创建 Canvas */
function getMeasureCtx(): SKRSContext2D {
  if (!measureCtx) {
    const canvas = createCanvas(1, 1)
    measureCtx = canvas.getContext('2d')
  }
  return measureCtx
}

/**
 * 用已注册的平台字体测量徽章文字实际像素宽度。
 * Skia 不会解析 CSS font-family 栈，需配合 getBadgeFontFamily 的单字体名。
 */
export function measureBadgeTextWidth(text: string, fontSize: number): number {
  ensureBadgeFonts()
  const ctx = getMeasureCtx()
  ctx.font = formatBadgeFont(fontSize, text)
  return ctx.measureText(text).width
}
