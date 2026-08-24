import type { LocalFileActionResult } from '@roxy/electron-preload'
import path from 'node:path'

interface LocalPathStat {
  isDirectory: () => boolean
  isFile: () => boolean
}

interface LocalFileActionDependencies {
  copyFile: (sourcePath: string, targetPath: string) => Promise<void>
  openPath: (targetPath: string) => Promise<string>
  showSaveDialog: (defaultPath: string) => Promise<{ canceled: boolean, filePath?: string }>
  stat: (targetPath: string) => Promise<LocalPathStat>
}

interface LocalFileActionOptions {
  fileName?: string
  sourcePath: string
}

export async function openOrDownloadLocalPath(
  options: LocalFileActionOptions,
  dependencies: LocalFileActionDependencies,
): Promise<LocalFileActionResult> {
  const sourceStat = await dependencies.stat(options.sourcePath)
  if (sourceStat.isDirectory()) {
    const errorMessage = await dependencies.openPath(options.sourcePath)
    if (errorMessage) {
      throw new Error(`Failed to open local directory: ${errorMessage}`)
    }

    return {
      action: 'opened-directory',
      canceled: false,
      filePath: options.sourcePath,
    }
  }

  if (!sourceStat.isFile()) {
    throw new Error('Local path is not a file or directory')
  }

  const { canceled, filePath: targetPath } = await dependencies.showSaveDialog(
    options.fileName || path.basename(options.sourcePath),
  )
  if (canceled || !targetPath) {
    return {
      action: 'downloaded-file',
      canceled: true,
    }
  }

  await dependencies.copyFile(options.sourcePath, targetPath)
  return {
    action: 'downloaded-file',
    canceled: false,
    filePath: targetPath,
  }
}
