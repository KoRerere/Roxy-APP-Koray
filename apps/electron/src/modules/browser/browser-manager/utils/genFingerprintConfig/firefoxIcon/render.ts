import type { SKRSContext2D } from '@napi-rs/canvas'
import type { Buffer } from 'node:buffer'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { isMac } from '/@/constants/common'

/**
 * 品牌徽章底色：Roxy 红 #FF3B30。
 *
 * - macOS：完全不透明。Dock 在显示时可能叠加亮 / 暗背景以及高对比模式，
 *          半透明会让数字与底色对比度劣化（视觉上发"灰")，所以直接用纯色。
 * - Windows / Linux：保留 alpha 0.8 轻微透明，与任务栏图标的视觉层次更协调。
 */
const BADGE_CSS = isMac ? 'rgb(255,59,48)' : 'rgba(255,59,48,0.8)'

/**
 * 徽章宽 / 高占画布的比例（相对画布短边）。
 *
 * - 宽：0.92（铺满底部，保留两侧少量内边距）
 * - 高：原 0.50 × 2/3 ≈ 0.333（视觉过厚，按需求缩高 1/3）
 * 圆角与字号均按 bH/bW 等比派生，无需单独调整。
 */
const BADGE_W_RATIO = isMac ? 0.8 : 0.92
const BADGE_H_RATIO = isMac ? (0.5 * 2) / 3.3 : 0.5

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
 * 在已有画布上叠加底部数字徽章。
 *
 * 徽章视觉规格：
 *  - 宽/高比例由 BADGE_W_RATIO / BADGE_H_RATIO 控制（当前 ≈ 61% × 33%）
 *  - 底部 1px 留白、圆角 38% 徽章高（饱满胶囊形）
 *  - 字号双约束：高度约束（bH×0.85）与宽度约束（按字符数估算）取较小值，任意位数自适应
 */
function drawBadge(ctx: SKRSContext2D, windowSortNum: number, size: number): void {
  const text = String(Math.floor(windowSortNum))

  // 徽章几何（相对于 size 的比例，确保不同尺寸下视觉一致）
  const bW = Math.round(size * BADGE_W_RATIO)
  const bH = Math.round(size * BADGE_H_RATIO)
  const bX = Math.round((size - bW) / 2)
  // 让徽章底端稍微"溢出"画布底（被 canvas 裁剪），盖掉 Firefox 环底的粉色高光
  const bY = size - bH + Math.round(size * BADGE_BOTTOM_OVERFLOW_RATIO)
  const br = Math.round(bH * 0.38)

  ctx.fillStyle = BADGE_CSS
  traceRoundRect(ctx, bX, bY, bW, bH, br)
  ctx.fill()

  // 字号双约束取较小值（Arial 数字 advance ≈ 0.55em）
  const fontSize = Math.max(6, Math.floor(Math.min(bH * 0.85, (bW * 0.9) / (text.length * 0.55))) - 3)
  ctx.fillStyle = '#ffffff'
  ctx.font = `400 ${fontSize}px Arial, 'Segoe UI', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 文字垂直居中到"画布可见的徽章可视区"而非胶囊几何中心，
  // 避免徽章溢出底部后数字看起来偏下
  const visibleBottom = Math.min(bY + bH, size)
  ctx.fillText(text, size / 2, (bY + visibleBottom) / 2)
}

/**
 * 以 source 为基底，在画布上叠加 windowSortNum 数字徽章，返回 PNG Buffer。
 *
 * 纯函数：只做图像加载 + Canvas 渲染，无文件写入，与缓存/IO 层完全解耦，便于单测。
 * 格式打包（ICO / ICNS / PNG）由各平台打包器负责，本函数不感知平台。
 *
 * @param source 基底图像源；支持文件路径（PNG / ICO，Skia 自动选最大帧）或 PNG/JPEG Buffer。
 *               传 Buffer 时常用于从 .icns 中按帧解出再回填，保证保留原帧的背景色与样式。
 * @param windowSortNum 窗口序号，叠加到徽章上的数字
 * @param size 画布像素尺寸；省略时按基底图像原始宽度（保持每帧原始分辨率不丢失细节）
 */
export async function renderBadgedPng(
  source: string | Buffer,
  windowSortNum: number,
  size?: number,
): Promise<Buffer> {
  // loadImage 原生支持 Buffer / Uint8Array / 路径，Buffer 路径下不会发生拷贝
  const img = await loadImage(source)
  // 未指定 size 时沿用基底图像原始宽度，避免对 ICNS 各档（128/256/512/1024）做下采样
  const actualSize = size ?? img.width

  const canvas = createCanvas(actualSize, actualSize)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0, actualSize, actualSize)
  drawBadge(ctx, windowSortNum, actualSize)

  return canvas.encode('png') as Promise<Buffer>
}
