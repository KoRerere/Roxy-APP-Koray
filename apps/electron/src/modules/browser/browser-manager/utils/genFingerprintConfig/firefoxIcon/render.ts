import type { SKRSContext2D } from '@napi-rs/canvas'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { Buffer } from 'node:buffer'

/** 输出图标尺寸（px）；Windows 会从此帧降采样到各使用场景，64px 实测够用 */
const SIZE = 64

/** 品牌徽章底色：Roxy 红 #FF3B30 */
const BADGE_CSS = 'rgba(255,59,48,1)'

/**
 * 将单张 PNG buffer 封装为最小单条目 ICO（Vista+ PNG-in-ICO 格式）
 * 结构：6 字节 ICONDIR + 16 字节 ICONDIRENTRY + PNG 字节流，共 22 字节头部
 */
function pngToIco(png: Buffer): Buffer {
  // width/height 在 PNG IHDR 块的偏移 16/20（big-endian uint32）
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)

  /**
   * 6 (ICONDIR) + 16 (ICONDIRENTRY)
   */
  const dir = Buffer.alloc(22)

  // ICONDIR
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // type: 1 = ICO
  dir.writeUInt16LE(1, 4) // image count: 1

  // ICONDIRENTRY — 256px 时按规范写 0
  dir.writeUInt8(w >= 256 ? 0 : w, 6)
  dir.writeUInt8(h >= 256 ? 0 : h, 7)
  dir.writeUInt8(0, 8) // colorCount
  dir.writeUInt8(0, 9) // reserved
  dir.writeUInt16LE(1, 10) // planes
  dir.writeUInt16LE(32, 12) // bitCount
  dir.writeUInt32LE(png.length, 14) // bytesInRes
  dir.writeUInt32LE(22, 18) // imageOffset = sizeof(dir)

  return Buffer.concat([dir, png])
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
 * 以 iconPath 为基底，在 64×64 画布上叠加 windowSortNum 数字徽章，返回 ICO Buffer
 *
 * 纯函数：只做图像加载 + Canvas 渲染，无文件写入，与缓存/IO 层完全解耦，便于单测。
 *
 * 徽章视觉规格：
 *  - 宽 92% 图标宽、高 50% 图标高、底部 1px 留白、圆角 38% 徽章高（饱满胶囊形）
 *  - 字号双约束：高度约束（bH×0.85）与宽度约束（按字符数估算）取较小值，任意位数自适应
 */
export async function renderBadgedIco(iconPath: string, windowSortNum: number): Promise<Buffer> {
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')

  // Skia 支持 ICO 解码，自动选最大尺寸帧作为来源
  ctx.drawImage(await loadImage(iconPath), 0, 0, SIZE, SIZE)

  const text = String(Math.floor(windowSortNum))

  // 徽章几何
  const bW = Math.round(SIZE * 0.92)
  const bH = Math.round(SIZE * 0.5)
  const bX = Math.round((SIZE - bW) / 2)
  const bY = SIZE - bH - 1
  const br = Math.round(bH * 0.38)

  // 绘制徽章背景
  ctx.fillStyle = BADGE_CSS
  traceRoundRect(ctx, bX, bY, bW, bH, br)
  ctx.fill()

  // 字号双约束取较小值（Arial 数字 advance ≈ 0.55em）
  const fontSize = Math.max(6, Math.floor(Math.min(bH * 0.85, (bW * 0.9) / (text.length * 0.55))) - 3)
  ctx.fillStyle = '#ffffff'
  ctx.font = `400 ${fontSize}px Arial, 'Segoe UI', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, SIZE / 2, bY + bH / 2)

  return pngToIco(await (canvas.encode('png') as Promise<Buffer>))
}
