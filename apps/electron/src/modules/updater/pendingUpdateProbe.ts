import { app } from 'electron'
import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isPackaged } from '/@/constants/common'
import { fileExists } from '/@/utils'

export interface PendingUpdateCache {
  version: string
  installerPath: string
  fileName: string
  sha512: string
  isAdminRightsRequired: boolean
  cacheDir: string
}

interface CachedUpdateInfo {
  fileName?: string
  sha512?: string
  isAdminRightsRequired?: boolean
}

function getAppBaseCachePath() {
  const home = homedir()
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
  }
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Caches')
  }
  return process.env.XDG_CACHE_HOME || join(home, '.cache')
}

async function resolveUpdaterCacheDirName() {
  const configPath = join(process.resourcesPath, 'app-update.yml')

  try {
    const content = await readFile(configPath, 'utf-8')
    const matched = content.match(/^\s*updaterCacheDirName:\s*['"]?([^'"\n]+)['"]?\s*$/m)
    if (matched?.[1]) {
      return matched[1].trim()
    }
  }
  catch (error) {
    console.warn('[pendingUpdateProbe] Failed to read app-update config:', error)
  }

  return app.getName()
}

/** 探测 electron-updater 本地 pending 缓存，纯磁盘 IO，不联网 */
export async function probeLocalPendingUpdate(pendingVersion: string): Promise<PendingUpdateCache | null> {
  if (!isPackaged) {
    return null
  }

  try {
    const cacheDir = join(getAppBaseCachePath(), await resolveUpdaterCacheDirName())
    const pendingDir = join(cacheDir, 'pending')
    const updateInfoPath = join(pendingDir, 'update-info.json')

    if (!await fileExists(updateInfoPath)) {
      return null
    }

    const cachedInfo = JSON.parse(await readFile(updateInfoPath, 'utf-8')) as CachedUpdateInfo
    if (!cachedInfo.fileName) {
      return null
    }

    const installerPath = join(pendingDir, cachedInfo.fileName)
    if (!await fileExists(installerPath)) {
      return null
    }

    return {
      version: pendingVersion,
      installerPath,
      fileName: cachedInfo.fileName,
      sha512: cachedInfo.sha512 ?? '',
      isAdminRightsRequired: cachedInfo.isAdminRightsRequired === true,
      cacheDir,
    }
  }
  catch (error) {
    console.warn('[pendingUpdateProbe] probe failed:', error)
    return null
  }
}
