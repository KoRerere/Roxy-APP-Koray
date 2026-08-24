import type { TaskErrorCode } from './errorCodes'
import type { TaskLogStatus, TaskScriptRun, TaskTriggerType } from '@/database/tasks'
import type { CollectedFile } from '@/runtime/file-collector-store'
import type { SandboxArtifact, SandboxRunOutput } from '@/services/sandboxService'

export interface ResolvedTaskWindow {
  id: number
  dirId: string
  windowName?: string
  windowSortNum?: number
}

export interface TaskRunTrigger {
  triggerType: TaskTriggerType
  scheduledAt?: string | null
}

export interface TaskArtifactCandidate {
  realPath: string
  displayName?: string
}

export interface TaskArtifactSaveResult {
  fileIds: string[]
  failedFiles: string[]
}

export interface TaskExecutorResult {
  status: Extract<TaskLogStatus, 'success' | 'partial_failed' | 'failed' | 'interrupted'>
  conversationId?: string
  fileIds: string[]
  scriptRuns?: TaskScriptRun[]
  closedWindowDirIds?: string[]
  endReasonCode?: TaskErrorCode
}

export function sandboxFiles(
  artifacts: SandboxArtifact[],
  outputs: SandboxRunOutput[],
): TaskArtifactCandidate[] {
  return [
    ...artifacts.map(file => ({
      realPath: file.localPath,
      displayName: file.relPath ?? file.fileName,
    })),
    ...outputs
      .filter(file => file.type !== 'log')
      .map(file => ({
        realPath: file.path,
      })),
  ]
}

export function collectedFiles(files: CollectedFile[]): TaskArtifactCandidate[] {
  return files.map(file => ({
    realPath: file.realPath,
    displayName: file.displayName ?? file.virtualPath,
  }))
}
