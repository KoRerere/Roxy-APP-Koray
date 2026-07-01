/**
 * ZIP 解压工具：用于录制脚本产物（saveScript 用 AdmZip 打成单入口 zip，
 * 入口名固定为 `script.ts`）在前端下载时还原为纯文本。
 *
 * 不引入第三方依赖，基于浏览器原生 `DecompressionStream('deflate-raw')`，
 * 手写最小 ZIP 格式解析（本地文件头 + 中央目录）。
 *
 * ZIP 文件格式参考：https://en.wikipedia.org/wiki/ZIP_(file_format)
 */

const ZIP_LOCAL_HEADER_SIG = 0x04034B50
const ZIP_CENTRAL_HEADER_SIG = 0x02014B50

/** 压缩方法：0 = stored（无压缩），8 = deflated */
const METHOD_STORED = 0
const METHOD_DEFLATED = 8

/** 从中央目录查找指定入口名的未压缩内容 */
export async function extractZipEntry(zipBuffer: ArrayBuffer, entryName: string): Promise<string> {
  const bytes = new Uint8Array(zipBuffer)
  const dataView = new DataView(zipBuffer)

  const eocdOffset = findEocdOffset(bytes)
  if (eocdOffset < 0)
    throw new Error('Invalid zip: EOCD record not found')

  // End of Central Directory: 偏移 +16 是中央目录条目数，+20 是中央目录起始偏移
  const centralDirEntries = dataView.getUint16(eocdOffset + 10, true)
  let centralDirOffset = dataView.getUint32(eocdOffset + 16, true)

  const encoder = new TextEncoder()
  const nameBytes = encoder.encode(entryName)

  for (let i = 0; i < centralDirEntries; i++) {
    if (dataView.getUint32(centralDirOffset, true) !== ZIP_CENTRAL_HEADER_SIG)
      throw new Error('Invalid zip: central directory signature mismatch')

    const method = dataView.getUint16(centralDirOffset + 10, true)
    const compressedSize = dataView.getUint32(centralDirOffset + 20, true)
    const uncompressedSize = dataView.getUint32(centralDirOffset + 24, true)
    const fileNameLength = dataView.getUint16(centralDirOffset + 28, true)
    const extraFieldLength = dataView.getUint16(centralDirOffset + 30, true)
    const localHeaderOffset = dataView.getUint32(centralDirOffset + 42, true)

    const nameStart = centralDirOffset + 46
    const currentName = bytes.subarray(nameStart, nameStart + fileNameLength)

    centralDirOffset = nameStart + fileNameLength + extraFieldLength

    if (!uint8Equals(currentName, nameBytes))
      continue

    // 找到入口：定位本地文件头中的实际数据起点
    if (dataView.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_HEADER_SIG)
      throw new Error('Invalid zip: local file header signature mismatch')

    const localFileNameLength = dataView.getUint16(localHeaderOffset + 26, true)
    const localExtraFieldLength = dataView.getUint16(localHeaderOffset + 28, true)
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength
    const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize)

    const decompressed = await decompressEntry(compressedData, method, uncompressedSize)
    return new TextDecoder('utf-8').decode(decompressed)
  }

  throw new Error(`Zip entry "${entryName}" not found`)
}

/** 解压单条入口：stored 直接返回，deflated 用 DecompressionStream('deflate-raw') */
async function decompressEntry(
  compressedData: Uint8Array,
  method: number,
  uncompressedSize: number,
): Promise<Uint8Array> {
  if (method === METHOD_STORED) {
    // 无压缩：直接拷贝
    return compressedData.slice()
  }

  if (method !== METHOD_DEFLATED) {
    throw new Error(`Unsupported zip compression method: ${method}`)
  }

  // 现代浏览器 / Electron（Chromium）支持 DecompressionStream('deflate-raw')
  if (typeof DecompressionStream === 'undefined') {
    throw new TypeError('DecompressionStream is not supported in this environment')
  }

  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  // 拷贝到独立的 ArrayBuffer，避免 subarray 的 ArrayBufferLike 与 BufferSource 类型不兼容
  const inputCopy = new Uint8Array(compressedData.byteLength)
  inputCopy.set(compressedData)
  writer.write(inputCopy)
  writer.close()

  const chunks: Uint8Array[] = []
  let total = 0
  const reader = ds.readable.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    chunks.push(value)
    total += value.byteLength
  }

  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  if (uncompressedSize > 0 && result.byteLength !== uncompressedSize) {
    throw new Error(
      `Zip decompressed size mismatch: expected ${uncompressedSize}, got ${result.byteLength}`,
    )
  }

  return result
}

/** 从文件末尾反向扫描 EOCD 签名（注释区最长 64KB） */
function findEocdOffset(bytes: Uint8Array): number {
  const minOffset = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (
      bytes[i] === 0x50
      && bytes[i + 1] === 0x4B
      && bytes[i + 2] === 0x05
      && bytes[i + 3] === 0x06
    ) {
      return i
    }
  }
  return -1
}

function uint8Equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}
