import type { Canvas, SKRSContext2D } from '@napi-rs/canvas'
import type { Buffer } from 'node:buffer'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { isMac } from './platform'
import { BADGE_MIN_FONT_SIZE, computeOptimalBadgeFontSize, getBadgeGeometry, getBadgeReadableMinFontSize } from './badgeMetrics'
import { withCanvasLock } from './canvasLock'
import { formatBadgeFont } from './fonts'

/**
 * 品牌徽章底色：Roxy 红 #FF3B30。
 *
 * - macOS：完全不透明。Dock 叠加亮 / 暗背景时半透明会让对比度劣化。
 * - Windows / Linux：保留 alpha 0.8 轻微透明，与任务栏图标的视觉层次更协调。
 */
export const FIREFOX_BADGE_CSS = isMac ? 'rgb(255,59,48)' : 'rgba(255,59,48,0.8)'

/** Chrome 任务栏圆点同色 #FF6000，alpha 与 taskBarIcon.color（FF6000d7）一致 */
export const CHROME_BADGE_CSS = isMac ? 'rgb(255,96,0)' : 'rgba(255,96,0,0.843)'

export interface RenderBadgedPngOptions {
  badgeCss?: string
}

/**
 * 徽章底部相对画布底边的"向下溢出"比例。
 *
 * - >0：徽章底部超出画布底，溢出部分被 canvas 自动裁剪 → 视觉上紧贴 Firefox 环底
 * - =0：徽章底端齐画布底
 * - <0：徽章上方留间隙（原值约 -0.4% / 256px → 露出 Firefox 环底的粉色高光，
 *        在 Dock 小尺寸缩放下肉眼像一条"白色间隙"）
 *
 * 当前值 1.5%：在 256px 上约 4px、1024px 上约 15px，足以盖掉 Firefox 渐变环
 * 底部那条粉色高光，又不会切掉太多胶囊主体。
 */
const BADGE_BOTTOM_OVERFLOW_RATIO = 0.015

/**
 * 徽章文字超采样倍率：小档位尽量在 256px 量级绘制后最近邻下采样，避免 Skia 抗锯齿 + 双线性缩放糊字。
 * 基底 Firefox 图标仍单独做高质量缩放，互不影响。
 */
function getBadgeOverlayScale(targetSize: number): number {
  if (targetSize <= 20)
    return 16
  if (targetSize <= 32)
    return 8
  if (targetSize <= 48)
    return 6
  if (targetSize <= 64)
    return 4
  if (targetSize <= 96)
    return 2
  return 1
}

function applyHighQualitySmoothing(ctx: SKRSContext2D): void {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

function applyCrispDownscale(ctx: SKRSContext2D): void {
  ctx.imageSmoothingEnabled = false
}

/**
 * 统一使用 @napi-rs/canvas 的同步编码（encodeSync）输出 PNG。
 *
 * 异步 `canvas.encode('png')` 会把任务投递到底层线程池，其 finalizer 在 GC 时与
 * 线程池任务竞态，已知会在 Electron utilityProcess / Node 中触发 SIGSEGV（退出码 11，
 * 见 napi-rs/canvas#988、oven-sh/bun#12375）。改用同步编码可彻底规避该竞态；
 * 本模块已通过 withCanvasLock 串行化，且运行在独立子进程中，同步阻塞无副作用。
 */
function encodeCanvasPng(canvas: Canvas): Buffer {
  return canvas.encodeSync('png')
}

/**
 * 手写圆角矩形路径（arcTo 方式，兼容所有 @napi-rs/canvas 版本，不依赖 roundRect API）
 */
function traceRoundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/**
 * 在已有画布上叠加底部徽章（透明底上仅绘制胶囊 + 文字，便于分层合成）。
 *
 * 徽章视觉规格：
 *  - Windows：底色与画布等宽；macOS ≈ 80% × 30%，Linux ≈ 92% × 50%
 *  - 底部 1px 留白、圆角 38% 徽章高（饱满胶囊形）
 *  - 字号双约束：高度约束（bH×0.85）与宽度约束（按字符数估算）取较小值，任意位数自适应
 */
function drawBadge(
  ctx: SKRSContext2D,
  badgeText: string,
  targetSize: number,
  badgeCss: string,
  scale = 1,
  crispText = false,
): void {
  const text = badgeText.trim()
  if (!text)
    return

  const canvasSize = targetSize * scale
  const { bW, bH, bX } = getBadgeGeometry(targetSize)
  const scaledBW = bW * scale
  const scaledBH = bH * scale
  const scaledBX = bX * scale
  const bY = canvasSize - scaledBH + Math.round(canvasSize * BADGE_BOTTOM_OVERFLOW_RATIO)
  const br = Math.round(scaledBH * 0.38)

  ctx.fillStyle = badgeCss
  traceRoundRect(ctx, scaledBX, bY, scaledBW, scaledBH, br)
  ctx.fill()

  const minFontSize = /^\d+$/.test(text) ? BADGE_MIN_FONT_SIZE : getBadgeReadableMinFontSize(targetSize)
  const fontSize = computeOptimalBadgeFontSize(text, targetSize, minFontSize) * scale
  ctx.fillStyle = '#ffffff'
  ctx.font = formatBadgeFont(fontSize, text, targetSize <= 64 ? '700' : undefined)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const visibleBottom = Math.min(bY + scaledBH, canvasSize)
  const textX = crispText ? Math.round(canvasSize / 2) : Math.round(canvasSize / 2) + 0.5
  const textY = crispText ? Math.round((bY + visibleBottom) / 2) : Math.round((bY + visibleBottom) / 2) + 0.5
  ctx.fillText(text, textX, textY)
  // 小档位在超采样层上微偏移再填一次，模拟加粗、减少半透明抗锯齿边缘
  if (targetSize <= 48 && scale > 1)
    ctx.fillText(text, textX + Math.max(1, Math.round(scale * 0.12)), textY)
}

function drawBaseIcon(ctx: SKRSContext2D, img: Awaited<ReturnType<typeof loadImage>>, targetSize: number): void {
  applyHighQualitySmoothing(ctx)
  ctx.drawImage(img, 0, 0, targetSize, targetSize)
}

async function compositeBadgedIcon(
  img: Awaited<ReturnType<typeof loadImage>>,
  targetSize: number,
  badgeText: string,
  badgeCss: string,
): Promise<Buffer> {
  const overlayScale = getBadgeOverlayScale(targetSize)
  const canvas = createCanvas(targetSize, targetSize)
  const ctx = canvas.getContext('2d')

  drawBaseIcon(ctx, img, targetSize)

  if (!badgeText.trim())
    return encodeCanvasPng(canvas)

  if (overlayScale === 1) {
    drawBadge(ctx, badgeText, targetSize, badgeCss, 1, false)
    return encodeCanvasPng(canvas)
  }

  const overlaySize = targetSize * overlayScale
  const overlay = createCanvas(overlaySize, overlaySize)
  drawBadge(overlay.getContext('2d'), badgeText, targetSize, badgeCss, overlayScale, true)

  const scaledOverlay = createCanvas(targetSize, targetSize)
  const overlayCtx = scaledOverlay.getContext('2d')
  applyCrispDownscale(overlayCtx)
  overlayCtx.drawImage(overlay, 0, 0, targetSize, targetSize)

  ctx.drawImage(scaledOverlay, 0, 0)
  return encodeCanvasPng(canvas)
}

/**
 * 仅绘制基底图标，不叠加徽章（用于 Windows 16px 等过小档位）。
 */
export function renderIconPng(source: string | Buffer, size?: number): Promise<Buffer> {
  return withCanvasLock(async () => {
    const img = await loadImage(source)
    const actualSize = size ?? img.width
    const canvas = createCanvas(actualSize, actualSize)
    drawBaseIcon(canvas.getContext('2d'), img, actualSize)
    return encodeCanvasPng(canvas)
  })
}

/**
 * 以 source 为基底，在画布上叠加徽章文字，返回 PNG Buffer。
 *
 * 纯函数：只做图像加载 + Canvas 渲染，无文件写入，与缓存/IO 层完全解耦，便于单测。
 * 格式打包（ICO / ICNS / PNG）由各平台打包器负责，本函数不感知平台。
 *
 * @param source 基底图像源；支持文件路径（PNG / ICO，Skia 自动选最大帧）或 PNG/JPEG Buffer。
 *               传 Buffer 时常用于从 .icns 中按帧解出再回填，保证保留原帧的背景色与样式。
 * @param badgeText 徽章文字：窗口编号或窗口名称
 * @param size 画布像素尺寸；省略时按基底图像原始宽度（保持每帧原始分辨率不丢失细节）
 */
export function renderBadgedPng(
  source: string | Buffer,
  badgeText: string | number,
  size?: number,
  options: RenderBadgedPngOptions = {},
): Promise<Buffer> {
  return withCanvasLock(async () => {
    const img = await loadImage(source)
    const actualSize = size ?? img.width
    const text = typeof badgeText === 'number' ? String(Math.floor(badgeText)) : badgeText
    const badgeCss = options.badgeCss ?? FIREFOX_BADGE_CSS
    return compositeBadgedIcon(img, actualSize, text, badgeCss)
  })
}
