import type { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { MAC_BADGE_MIN_SIZE, WINDOWS_BADGE_MIN_SIZE, WINDOWS_ICO_SIZES } from './badgeMetrics'
import { isPngBuffer, packIcns, parseIcns } from './icns'
import { pngsToIco } from './ico'
import { renderBadgedPng, renderIconPng } from './render'

export type BrowserIconPackFormat = 'ico' | 'icns' | 'png'

export interface PackBrowserIconPayload {
  baseIconPath: string
  badgeText: string
  badgeCss: string
  packFormat: BrowserIconPackFormat
}

/** Windows 小于该尺寸的 ICO 帧不叠加徽章文字 */
const WINDOWS_ICO_BADGE_MIN_SIZE = WINDOWS_BADGE_MIN_SIZE

/** macOS 小于该尺寸的 ICNS 帧不叠加徽章，避免数字不可辨识 */
const MAC_ICNS_BADGE_MIN_SIZE = MAC_BADGE_MIN_SIZE

/**
 * 将基底图标打包为带徽章的平台图标二进制（ICO / ICNS / PNG）。
 * 含 @napi-rs/canvas 调用，应在 BrowserIconRenderWorker 子进程或串行锁内执行。
 */
export async function packBrowserIcon(payload: PackBrowserIconPayload): Promise<Buffer> {
  const { baseIconPath, badgeText, badgeCss, packFormat } = payload
  const renderOptions = { badgeCss }

  if (packFormat === 'ico') {
    const pngs = await Promise.all(
      WINDOWS_ICO_SIZES.map(size =>
        size >= WINDOWS_ICO_BADGE_MIN_SIZE
          ? renderBadgedPng(baseIconPath, badgeText, size, renderOptions)
          : renderIconPng(baseIconPath, size),
      ),
    )
    return pngsToIco(pngs)
  }

  if (packFormat === 'icns') {
    const src = await readFile(baseIconPath)
    const blocks = parseIcns(src)

    const patched = await Promise.all(
      blocks.map(async (block) => {
        if (!isPngBuffer(block.data))
          return block

        const width = block.data.readUInt32BE(16)
        if (width < MAC_ICNS_BADGE_MIN_SIZE)
          return block

        const newPng = await renderBadgedPng(block.data, badgeText, undefined, renderOptions)
        return { osType: block.osType, data: newPng }
      }),
    )

    return packIcns(patched)
  }

  return renderBadgedPng(baseIconPath, badgeText, 128, renderOptions)
}
