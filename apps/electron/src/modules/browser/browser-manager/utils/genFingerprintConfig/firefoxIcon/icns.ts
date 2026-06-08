import { Buffer } from 'node:buffer'

/** ICNS 文件幻数 'icns'（0x69636E73） */
const ICNS_MAGIC = 0x69636E73

/**
 * ICNS 二进制结构（Apple Icon Image Format）：
 * - 4 字节 magic ('icns')
 * - 4 字节总文件长度（big-endian uint32，含此 8 字节头）
 * - 若干 block：
 *   - 4 字节 OSType
 *   - 4 字节 block 总长度（big-endian uint32，含此 8 字节块头）
 *   - N 字节 payload（PNG / JPEG2000 / 原始 ARGB / info plist 等）
 *
 * macOS 现代 PNG-in-ICNS 支持的 OSType 速查：
 * | OSType | 尺寸           | 备注                          |
 * |--------|----------------|-------------------------------|
 * | ic04   | 16×16          | ARGB 原始位图（非 PNG）        |
 * | ic05   | 32×32          | ARGB 原始位图（非 PNG）        |
 * | ic07   | 128×128        | PNG                           |
 * | ic08   | 256×256        | PNG                           |
 * | ic09   | 512×512        | PNG                           |
 * | ic10   | 1024×1024      | PNG                           |
 * | ic11   | 16×16 @2x      | PNG                           |
 * | ic12   | 32×32 @2x      | PNG                           |
 * | ic13   | 128×128 @2x    | PNG                           |
 * | ic14   | 256×256 @2x    | PNG                           |
 * | info   | -              | 文件元信息（plist）            |
 */

/** 单个 ICNS 块：保留原始 payload 字节，调用方可按需替换或保留 */
export interface IcnsBlock {
  /** 四字节 OSType 标识符，如 'ic07'、'ic08'、'info' */
  osType: string
  /** 块原始 payload（不含 8 字节块头） */
  data: Buffer
}

/**
 * 兼容旧 API 的入口结构：将多张 PNG 直接打包为 ICNS。
 * 仍保留主要是为了向后兼容；新代码请使用 {@link parseIcns} + {@link packIcns}
 * 以在原 ICNS 基础上仅替换需要的帧。
 */
export interface IcnsEntry {
  osType: string
  png: Buffer
}

/**
 * 解析 .icns 二进制为 OSType 块序列，保留原始顺序与原始 payload。
 *
 * 对损坏 / 截断文件做了容错：遇到非法块长度即停止，已解析的块仍可使用。
 *
 * @param buf 完整 .icns 文件内容
 * @returns 所有块列表（包含 PNG、ARGB、info 等任意 OSType）
 */
export function parseIcns(buf: Buffer): IcnsBlock[] {
  if (buf.length < 8 || buf.readUInt32BE(0) !== ICNS_MAGIC) {
    throw new Error('Invalid ICNS file: bad magic')
  }
  // 头部声明长度若大于实际长度，以实际长度为上界，防止越界读取
  const declared = buf.readUInt32BE(4)
  const end = Math.min(declared, buf.length)

  const blocks: IcnsBlock[] = []
  let off = 8
  while (off + 8 <= end) {
    const osType = buf.slice(off, off + 4).toString('ascii')
    const blockLen = buf.readUInt32BE(off + 4)
    // 块头声明长度至少 8 字节；越界则视为损坏，提前结束
    if (blockLen < 8 || off + blockLen > end)
      break
    const data = buf.slice(off + 8, off + blockLen)
    blocks.push({ osType, data })
    off += blockLen
  }
  return blocks
}

/**
 * 将一组 OSType 块按原始顺序重新打包为标准 .icns 文件。
 *
 * 与 {@link parseIcns} 配对使用即可实现“原图保留 + 局部帧替换”：
 *   const blocks = parseIcns(srcBuf)
 *   for (const b of blocks) if (isPng(b.data)) b.data = await renderBadgedPng(b.data, num)
 *   const out = packIcns(blocks)
 *
 * @param blocks 任意顺序的块列表（建议保留原顺序，部分系统对块顺序敏感）
 */
export function packIcns(blocks: IcnsBlock[]): Buffer {
  const built = blocks.map(({ osType, data }) => {
    const header = Buffer.alloc(8)
    // OSType 必须恰好 4 个 ASCII 字符，长度不足以空格补齐
    header.write(osType.slice(0, 4).padEnd(4, ' '), 0, 4, 'ascii')
    header.writeUInt32BE(8 + data.length, 4)
    return Buffer.concat([header, data])
  })

  const body = Buffer.concat(built)

  // 全局 8 字节文件头：magic + 总文件长度
  const fileHeader = Buffer.alloc(8)
  fileHeader.writeUInt32BE(ICNS_MAGIC, 0)
  fileHeader.writeUInt32BE(8 + body.length, 4)

  return Buffer.concat([fileHeader, body])
}

/**
 * 将多张 PNG 直接打包为 ICNS 文件（向后兼容入口）。
 *
 * 内部实现转调 {@link packIcns}；推荐新代码改用 `parseIcns + packIcns` 在
 * 原始 .icns 基础上保留风格、仅替换需要的帧。
 *
 * @param entries 各尺寸图像条目，建议至少传入 ic07(128) + ic08(256)
 */
export function pngsToIcns(entries: IcnsEntry[]): Buffer {
  return packIcns(entries.map(({ osType, png }) => ({ osType, data: png })))
}

/** 简易 PNG 头判定：用于在 ICNS 块中识别 PNG 帧并跳过 ARGB / info 块 */
export function isPngBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 8
    && buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4E
    && buf[3] === 0x47
    && buf[4] === 0x0D
    && buf[5] === 0x0A
    && buf[6] === 0x1A
    && buf[7] === 0x0A
  )
}
