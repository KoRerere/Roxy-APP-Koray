import { Buffer } from 'node:buffer'

/** 从 PNG IHDR 读取宽高（big-endian uint32，偏移 16/20） */
function readPngSize(png: Buffer): { w: number, h: number } {
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) }
}

/**
 * 将多张 PNG 封装为多帧 ICO（Vista+ PNG-in-ICO 格式）。
 * 按尺寸从大到小排列，便于 Windows 任务栏 / 标题栏选取合适档位。
 */
export function pngsToIco(pngs: Buffer[]): Buffer {
  if (pngs.length === 0)
    throw new Error('pngsToIco: 至少需要一个 PNG 帧')

  const frames = pngs.map(png => ({ png, ...readPngSize(png) }))
    .sort((a, b) => b.w - a.w)

  const count = frames.length
  const headerSize = 6 + 16 * count
  let offset = headerSize

  const dir = Buffer.alloc(headerSize)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(count, 4)

  for (let i = 0; i < count; i++) {
    const { png, w, h } = frames[i]
    const entryOffset = 6 + i * 16
    dir.writeUInt8(w >= 256 ? 0 : w, entryOffset)
    dir.writeUInt8(h >= 256 ? 0 : h, entryOffset + 1)
    dir.writeUInt8(0, entryOffset + 2)
    dir.writeUInt8(0, entryOffset + 3)
    dir.writeUInt16LE(1, entryOffset + 4)
    dir.writeUInt16LE(32, entryOffset + 6)
    dir.writeUInt32LE(png.length, entryOffset + 8)
    dir.writeUInt32LE(offset, entryOffset + 12)
    offset += png.length
  }

  return Buffer.concat([dir, ...frames.map(f => f.png)])
}

/**
 * 将单张 PNG buffer 封装为最小单条目 ICO（Vista+ PNG-in-ICO 格式）
 *
 * 结构：6 字节 ICONDIR + 16 字节 ICONDIRENTRY + PNG 字节流，共 22 字节头部。
 *
 * @param png 任意尺寸的 PNG Buffer
 * @returns ICO 格式的 Buffer
 */
export function pngToIco(png: Buffer): Buffer {
  return pngsToIco([png])
}
