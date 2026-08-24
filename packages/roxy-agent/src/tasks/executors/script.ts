import type { ResolvedTaskWindow, TaskExecutorResult } from '../types'
import type { TaskScriptRun } from '@/database/tasks'
import type { SandboxRunResult } from '@/services/sandboxService'
import type { ResolvedTemplate } from '@/services/templateService'
import fs from 'node:fs/promises'
import { isLoginRequired } from '@/core/sandbox/script-entry'
import { profileLeaseRegistry } from '@/core/profiles/profileLeaseRegistry'
import {
  publishTaskMonitorTaskFinished,
  publishTaskMonitorTaskStarted,
} from '@/core/task-monitor'
import { createRunId } from '@/runtime/tools/roxy_script_run'
import { resolveExecutableScriptSource } from '@/runtime/tools/script_source'
import { startSandboxScriptRun } from '@/services/sandboxService'
import { persistTaskArtifacts } from '@/services/taskArtifacts'
import {
  recordTaskExecutionEvent,
  taskArtifacts,
} from '@/services/taskExecutionDetails'
import { DEFAULT_SCRIPT_TASK_CONCURRENCY } from '../constants'
import { TASK_ERROR_CODES } from '../errorCodes'
import { sandboxFiles } from '../types'
import { closeTaskBrowserWindows } from '../windowLifecycle'

export interface PreparedTaskScript {
  scriptPath: string
  assetSlug: string
  sha512: string
  cleanup?: () => Promise<void>
}

export interface ScriptExecutionPlan {
  taskLogId: string
  taskName: string
  prepared: PreparedTaskScript
  windows: ResolvedTaskWindow[]
  scriptRuns: TaskScriptRun[]
  params: unknown
  concurrency: number
  closeWindows?: (windows: ResolvedTaskWindow[]) => Promise<string[]>
}

interface ScriptUnitResult {
  scriptRun: TaskScriptRun
  windowKey: string
  result?: SandboxRunResult
}

function scriptUnitSucceeded(unit: ScriptUnitResult): boolean {
  return unit.result?.status === 'done' && !isLoginRequired(unit.result.returnValue)
}

function windowLabel(window: ResolvedTaskWindow | undefined, fallback: string): string {
  if (!window) {
    return fallback
  }
  if (window.windowName) {
    return window.windowName
  }
  if (window.windowSortNum !== undefined) {
    return String(window.windowSortNum)
  }
  return window.dirId
}

async function readRunLog(filePath: string | undefined): Promise<string> {
  if (!filePath) {
    return ''
  }
  return fs.readFile(filePath, 'utf8').catch(() => '')
}

function requiredMetadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Script template is missing metadata.${key}`)
  }

  return value.trim()
}

export async function prepareTaskScript(
  template: ResolvedTemplate,
  signal?: AbortSignal,
): Promise<PreparedTaskScript> {
  if (template.kind !== 'script') {
    throw new Error('Template is not a Script template')
  }

  const ossUrl = requiredMetadataString(template.metadata, 'ossUrl')
  const sha512 = requiredMetadataString(template.metadata, 'sha512')
  const slugValue = template.metadata.slug
  const fallbackAssetSlug = typeof slugValue === 'string' && slugValue.trim()
    ? slugValue.trim()
    : `user-template-${template.id}`

  const source = await resolveExecutableScriptSource(ossUrl, undefined, {
    signal,
    expectedSha512: sha512,
    fallbackAssetSlug,
  })
  return {
    scriptPath: source.scriptPath,
    assetSlug: source.assetSlug,
    sha512,
    cleanup: source.cleanup,
  }
}

export function createScriptExecutionPlan(
  taskLogId: string,
  taskName: string,
  prepared: PreparedTaskScript,
  windows: ResolvedTaskWindow[],
  params: unknown,
  concurrency = DEFAULT_SCRIPT_TASK_CONCURRENCY,
): ScriptExecutionPlan {
  const executionUnitCount = Math.max(windows.length, 1)
  return {
    taskLogId,
    taskName,
    prepared,
    windows,
    params,
    concurrency,
    scriptRuns: Array.from({ length: executionUnitCount }, (_, index) => ({
      dirId: windows[index]?.dirId ?? null,
      slug: prepared.assetSlug,
      runId: createRunId(),
      fileIds: [],
    })),
  }
}

async function runUnit(
  plan: ScriptExecutionPlan,
  index: number,
  signal: AbortSignal,
): Promise<ScriptUnitResult> {
  const window = plan.windows[index]
  const scriptRun = plan.scriptRuns[index]!
  const runId = scriptRun.runId
  const windowKey = window?.dirId ?? runId
  recordTaskExecutionEvent(plan.taskLogId, {
    type: 'script.window.started',
    window: {
      key: windowKey,
      dirId: window?.dirId ?? null,
      runId,
      label: windowLabel(window, runId),
    },
  })
  try {
    const started = await startSandboxScriptRun({
      scriptPath: plan.prepared.scriptPath,
      scriptSha512: plan.prepared.sha512,
      assetSlug: plan.prepared.assetSlug,
      dirId: window?.dirId,
      runId,
      executionId: plan.taskLogId,
      profile: 'release',
      options: plan.params,
      signal,
      taskMonitor: window
        ? {
            taskId: plan.taskLogId,
            browserId: window.dirId,
            label: window.dirId,
            input: { dirId: window.dirId, runId },
          }
        : undefined,
      onLog: (event) => {
        if (event.message.startsWith('[sandbox stdout]') || event.message.startsWith('[sandbox stderr]')) {
          return
        }
        recordTaskExecutionEvent(plan.taskLogId, {
          type: 'script.log.append',
          windowKey,
          text: `${event.message}\n`,
        })
      },
    })
    const result = await started.finished
    recordTaskExecutionEvent(plan.taskLogId, {
      type: 'script.log.replace',
      windowKey,
      text: await readRunLog(result.logFilePath),
    })
    if (isLoginRequired(result.returnValue)) {
      recordTaskExecutionEvent(plan.taskLogId, {
        type: 'script.log.append',
        windowKey,
        text: `${result.returnValue}\n`,
      })
    }
    recordTaskExecutionEvent(plan.taskLogId, {
      type: 'script.window.finished',
      windowKey,
      status: result.status === 'done' && !isLoginRequired(result.returnValue)
        ? 'success'
        : (signal.aborted ? 'interrupted' : 'failed'),
      failedFiles: [],
    })
    return { scriptRun, windowKey, result }
  }
  catch (error) {
    console.error(`[task] Script execution failed runId=${runId}:`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    recordTaskExecutionEvent(plan.taskLogId, {
      type: 'script.log.append',
      windowKey,
      text: `${errorMessage}\n`,
    })
    recordTaskExecutionEvent(plan.taskLogId, {
      type: 'script.window.finished',
      windowKey,
      status: signal.aborted ? 'interrupted' : 'failed',
      failedFiles: [],
    })
    return { scriptRun, windowKey }
  }
}

export async function executeScriptTask(
  plan: ScriptExecutionPlan,
  signal: AbortSignal,
): Promise<TaskExecutorResult> {
  publishTaskMonitorTaskStarted({
    taskId: plan.taskLogId,
    title: plan.taskName,
    sourceType: 'script',
    runId: plan.taskLogId,
  })

  try {
    const unitCount = plan.scriptRuns.length
    const units: ScriptUnitResult[] = []
    const scriptRuns = plan.scriptRuns.map(run => ({ ...run, fileIds: [...run.fileIds] }))
    const scriptRunsById = new Map(scriptRuns.map(run => [run.runId, run]))
    const closedWindowDirIds = new Set<string>()
    const pending = new Map<number, Promise<ScriptUnitResult>>()
    let nextIndex = 0

    const startUnit = (index: number): void => {
      pending.set(index, runUnit(plan, index, signal))
    }

    const startAvailableUnits = (): void => {
      while (!signal.aborted && pending.size < plan.concurrency && nextIndex < unitCount) {
        startUnit(nextIndex)
        nextIndex += 1
      }
    }

    startAvailableUnits()

    while (pending.size > 0) {
      const settled = await Promise.race(
        Array.from(pending.entries(), async ([index, promise]) => ({
          index,
          result: await promise,
        })),
      )
      pending.delete(settled.index)
      units.push(settled.result)

      const window = plan.windows[settled.index]
      if (window) {
        const closeWindows = plan.closeWindows ?? closeTaskBrowserWindows
        const closed = await closeWindows([window])
        closed.forEach(dirId => closedWindowDirIds.add(dirId))
      }

      startAvailableUnits()
    }

    if (signal.aborted) {
      return {
        status: 'interrupted',
        fileIds: [],
        scriptRuns,
        closedWindowDirIds: Array.from(closedWindowDirIds),
        endReasonCode: TASK_ERROR_CODES.taskInterrupted,
      }
    }

    const executionSucceeded = units.filter(scriptUnitSucceeded)
    if (executionSucceeded.length === 0) {
      return {
        status: 'failed',
        fileIds: [],
        scriptRuns,
        closedWindowDirIds: Array.from(closedWindowDirIds),
        endReasonCode: TASK_ERROR_CODES.scriptExecutionFailed,
      }
    }

    let successfulWindows = 0
    let artifactFailures = 0
    for (const unit of units) {
      if (!scriptUnitSucceeded(unit)) {
        continue
      }
      const artifacts = await persistTaskArtifacts(
        sandboxFiles(unit.result?.artifacts || [], unit.result?.outputs || []),
      )
      const scriptRun = scriptRunsById.get(unit.scriptRun.runId)
      if (scriptRun) {
        scriptRun.fileIds = [...artifacts.fileIds]
      }
      artifactFailures += artifacts.failedFiles.length
      recordTaskExecutionEvent(plan.taskLogId, {
        type: 'artifacts.updated',
        windowKey: unit.windowKey,
        artifacts: taskArtifacts(artifacts.fileIds),
      })
      if (artifacts.failedFiles.length === 0) {
        successfulWindows++
      }
      else {
        recordTaskExecutionEvent(plan.taskLogId, {
          type: 'script.window.finished',
          windowKey: unit.windowKey,
          status: 'failed',
          failedFiles: artifacts.failedFiles,
        })
      }
    }

    if (successfulWindows === 0) {
      return {
        status: 'failed',
        fileIds: [],
        scriptRuns,
        closedWindowDirIds: Array.from(closedWindowDirIds),
        endReasonCode: artifactFailures > 0
          ? TASK_ERROR_CODES.artifactUploadPartialFailure
          : TASK_ERROR_CODES.scriptExecutionFailed,
      }
    }

    if (successfulWindows < unitCount) {
      return {
        status: 'partial_failed',
        fileIds: [],
        scriptRuns,
        closedWindowDirIds: Array.from(closedWindowDirIds),
        endReasonCode: units.some(unit => !scriptUnitSucceeded(unit))
          ? TASK_ERROR_CODES.partialWindowFailure
          : TASK_ERROR_CODES.artifactUploadPartialFailure,
      }
    }
    return {
      status: 'success',
      fileIds: [],
      scriptRuns,
      closedWindowDirIds: Array.from(closedWindowDirIds),
    }
  }
  finally {
    profileLeaseRegistry.release(plan.taskLogId)
    publishTaskMonitorTaskFinished(plan.taskLogId)
  }
}
