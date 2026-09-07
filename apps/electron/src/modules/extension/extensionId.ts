import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

/**
 * 计算 unpacked extension ID。
 *
 * Chromium 会直接对 FilePath 的底层字节做 SHA-256：POSIX 为 UTF-8，Windows 为
 * UTF-16LE（且仅将盘符标准化为大写）。此前将每个 JS 字符拼接 NUL 后再 UTF-8
 * 编码，恰好模拟了部分 ASCII Windows 路径，却会在 macOS/Linux 上计算出错误 ID。
 */
export function genExtensionID(
  options: { type: 'path' | 'key', input: string },
  platform: NodeJS.Platform = process.platform,
) {
  const kIdSize = 16
  const isPath = options.type === 'path'
  const pathInput = platform === 'win32'
    ? options.input.replace(/^([a-z]):/, (_, drive: string) => `${drive.toUpperCase()}:`)
    : options.input
  const bytes = isPath
    ? Buffer.from(pathInput, platform === 'win32' ? 'utf16le' : 'utf8')
    : Buffer.from(options.input, 'base64')
  const hashString = crypto.createHash('sha256').update(bytes).digest().subarray(0, kIdSize).toString('hex')
  return hashString.replace(/[0-9a-f]/g, char => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(char, 16)))
}
