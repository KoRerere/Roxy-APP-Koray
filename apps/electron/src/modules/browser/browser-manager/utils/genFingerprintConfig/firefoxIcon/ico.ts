import { Buffer } from 'node:buffer'

/**
 * 将单张 PNG buffer 封装为最小单条目 ICO（Vista+ PNG-in-ICO 格式）
 *
 * 结构：6 字节 ICONDIR + 16 字节 ICONDIRENTRY + PNG 字节流，共 22 字节头部。
 * 推荐输入尺寸：64×64（Windows 会从此帧降采样到各使用场景）。
 *
 * @param png 任意尺寸的 PNG Buffer
 * @returns ICO 格式的 Buffer
 */
export function pngToIco(png: Buffer): Buffer {
  // width/height 在 PNG IHDR 块的偏移 16/20（big-endian uint32）
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)

  // 6 (ICONDIR) + 16 (ICONDIRENTRY) = 22 字节固定头
  const dir = Buffer.alloc(22)

  // ICONDIR
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // type: 1 = ICO
  dir.writeUInt16LE(1, 4) // image count: 1

  // ICONDIRENTRY — 256px 时按规范写 0
  dir.writeUInt8(w >= 256 ? 0 : w, 6)
  dir.writeUInt8(h >= 256 ? 0 : h, 7)
  dir.writeUInt8(0, 8)  // colorCount
  dir.writeUInt8(0, 9)  // reserved
  dir.writeUInt16LE(1, 10)            // planes
  dir.writeUInt16LE(32, 12)           // bitCount
  dir.writeUInt32LE(png.length, 14)   // bytesInRes
  dir.writeUInt32LE(22, 18)           // imageOffset = sizeof(dir)

  return Buffer.concat([dir, png])
}
