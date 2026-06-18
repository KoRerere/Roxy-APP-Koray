import type { PackBrowserIconPayload } from './pack'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { packBrowserIcon } from './pack'

export interface WriteBrowserIconPayload extends PackBrowserIconPayload {
  iconPath: string
  metaPath: string
  cacheVersion: number
}

/** 渲染图标并原子写入目标路径，同时更新 meta 缓存文件 */
export async function writeBrowserIconFile(payload: WriteBrowserIconPayload): Promise<void> {
  const { iconPath, metaPath, cacheVersion, badgeText, ...packPayload } = payload
  const buf = await packBrowserIcon({ ...packPayload, badgeText })

  await mkdir(dirname(iconPath), { recursive: true })

  const tmp = `${iconPath}.tmp`
  await writeFile(tmp, buf)
  await rename(tmp, iconPath)
  await writeFile(metaPath, JSON.stringify({ version: cacheVersion, badge: badgeText }), 'utf8')
}
