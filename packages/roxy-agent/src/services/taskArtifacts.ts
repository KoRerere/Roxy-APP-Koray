import type { TaskArtifactCandidate, TaskArtifactSaveResult } from '@/tasks/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { extToMime, fileManager } from '@/core/fileManager'

function displayName(candidate: TaskArtifactCandidate): string {
  const source = (candidate.displayName ?? candidate.realPath).replace(/\\/g, '/')
  return path.posix.basename(source) || 'task-artifact'
}

export async function persistTaskArtifacts(
  candidates: TaskArtifactCandidate[],
): Promise<TaskArtifactSaveResult> {
  const fileIds: string[] = []
  const failedFiles: string[] = []
  const uniquePaths = new Set<string>()

  for (const candidate of candidates) {
    const realPath = path.resolve(candidate.realPath)
    if (uniquePaths.has(realPath)) {
      continue
    }
    uniquePaths.add(realPath)

    const fileName = displayName(candidate)
    try {
      const buffer = await fs.readFile(realPath)
      const record = await fileManager.saveBuffer({
        buffer,
        fileName,
        mimeType: extToMime(fileName) ?? 'application/octet-stream',
        source: 'task',
        uploadNow: true,
      })
      fileIds.push(record.file_id)
      if (!record.oss_url)
        failedFiles.push(fileName)
    }
    catch (error) {
      console.warn(`[task] Failed to persist artifact ${realPath}:`, error)
      failedFiles.push(fileName)
    }
  }

  return { fileIds, failedFiles }
}
