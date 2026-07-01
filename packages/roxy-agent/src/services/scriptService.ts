import type { SandboxArtifact, StartedSandboxScriptRun } from './sandboxService'
import type { Response } from 'express'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { AI_AGENT_API, AiAgentHttpError } from '@/api'
import { fileManager } from '@/core/fileManager'
import { t } from '@/core/i18n'
import { ScriptStore } from '@/database/conversations'
import { getOccupiedSandboxDirIds, startSandboxScriptRun } from './sandboxService'

interface ArtifactInfo {
  fileName: string
  size: number
  mimeType: string
  fileId?: string
}

const MIME_MAP: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  txt: 'text/plain',
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  md: 'text/markdown',
  xml: 'application/xml',
  zip: 'application/zip',
}

function extToMime(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().slice(1)
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

async function saveSandboxArtifacts(artifacts: SandboxArtifact[]): Promise<ArtifactInfo[]> {
  const results: ArtifactInfo[] = []
  for (const a of artifacts) {
    const mimeType = extToMime(a.fileName)
    const displayName = a.relPath ?? a.fileName
    try {
      const buffer = await fsPromises.readFile(a.localPath)
      const record = await fileManager.saveBuffer({
        buffer,
        fileName: displayName,
        mimeType,
        source: 'script-artifact',
        uploadNow: true,
      })
      results.push({ fileName: displayName, size: a.size, mimeType, fileId: record?.file_id })
    }
    catch {
      results.push({ fileName: displayName, size: a.size, mimeType })
    }
  }
  return results
}

export type ScriptRunStatus = 'running' | 'done' | 'failed' | 'killed' | 'timeout'

interface LogEntry {
  type: 'log'
  level?: string
  message: string
  timestamp: number
}

interface RunRecord {
  runId: string
  scriptName: string
  scriptUrl: string
  dirId: string
  cdpUrl: string
  status: ScriptRunStatus
  run: StartedSandboxScriptRun
  logs: LogEntry[]
  artifacts: ArtifactInfo[]
  /** SSE response objects waiting for events */
  sseClients: Response[]
  exitCode: number | null
}

/** runId → RunRecord */
const runRegistry = new Map<string, RunRecord>()

function sseWrite(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function broadcastToClients(record: RunRecord, event: string, data: unknown): void {
  for (const client of record.sseClients) {
    try {
      sseWrite(client, event, data)
    }
    catch {
      // client already disconnected
    }
  }
}

async function terminateRun(record: RunRecord, status: ScriptRunStatus, exitCode: number | null, rawArtifacts: SandboxArtifact[]): Promise<void> {
  record.status = status
  record.exitCode = exitCode

  const artifacts = status === 'done' ? await saveSandboxArtifacts(rawArtifacts) : []
  record.artifacts = artifacts

  broadcastToClients(record, 'done', {
    runId: record.runId,
    status,
    exitCode,
    artifacts: artifacts.map(a => ({ fileName: a.fileName, size: a.size, fileId: a.fileId })),
  })

  // close all SSE connections
  for (const client of record.sseClients) {
    try {
      client.end()
    }
    catch {
      // ignore
    }
  }
  record.sseClients = []
}

export function getOccupiedDirIds(): string[] {
  return getOccupiedSandboxDirIds()
}

export interface StartScriptRunOptions {
  scriptName: string
  scriptUrl: string
  dirId: string
}

export interface StartScriptRunResult {
  runId: string
  cdpUrl: string
}

export async function startScriptRun(opts: StartScriptRunOptions): Promise<StartScriptRunResult> {
  const { scriptName, scriptUrl, dirId } = opts

  const pendingLogs: LogEntry[] = []

  const run = await startSandboxScriptRun({
    scriptPath: scriptUrl,
    dirId,
    profile: 'release',
    onLog: (msg) => {
      const entry: LogEntry = { type: 'log', level: msg.level, message: msg.message, timestamp: Date.now() }
      const record = runRegistry.get(msg.runId)
      if (record) {
        record.logs.push(entry)
        broadcastToClients(record, 'log', { runId: msg.runId, level: entry.level, message: entry.message })
      }
      else {
        pendingLogs.push(entry)
      }
    },
  })

  console.info(`[scriptRun] Worker PID: ${run.worker.pid}, runId: ${run.runId}, dirId: ${dirId}`)

  const record: RunRecord = {
    runId: run.runId,
    scriptName,
    scriptUrl,
    dirId,
    cdpUrl: run.cdpUrl!,
    status: 'running',
    run,
    logs: pendingLogs,
    artifacts: [],
    sseClients: [],
    exitCode: null,
  }

  runRegistry.set(run.runId, record)

  void run.finished.then((result) => {
    return terminateRun(record, result.status, result.exitCode, result.artifacts)
  })

  return { runId: run.runId, cdpUrl: run.cdpUrl! }
}

export interface ScriptRunStatusResult {
  runId: string
  scriptName: string
  dirId: string
  status: ScriptRunStatus
  exitCode: number | null
  logs: LogEntry[]
}

export function getRunStatus(runId: string): ScriptRunStatusResult | null {
  const record = runRegistry.get(runId)
  if (!record)
    return null

  return {
    runId: record.runId,
    scriptName: record.scriptName,
    dirId: record.dirId,
    status: record.status,
    exitCode: record.exitCode,
    logs: record.logs,
  }
}

/**
 * Subscribe an SSE response to live events for a given runId.
 * Immediately replays buffered logs, then streams new events until the run ends
 * or the client disconnects.
 */
export function subscribeScriptRun(runId: string, res: Response): boolean {
  const record = runRegistry.get(runId)
  if (!record)
    return false

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Replay buffered logs
  for (const entry of record.logs) {
    sseWrite(res, 'log', { runId, level: entry.level, message: entry.message })
  }

  // If already finished, send done immediately
  if (record.status !== 'running') {
    sseWrite(res, 'done', {
      runId,
      status: record.status,
      exitCode: record.exitCode,
      artifacts: record.artifacts.map(a => ({ fileName: a.fileName, size: a.size, fileId: a.fileId })),
    })
    res.end()
    return true
  }

  record.sseClients.push(res)

  res.on('close', () => {
    const idx = record.sseClients.indexOf(res)
    if (idx !== -1)
      record.sseClients.splice(idx, 1)
  })

  return true
}

export function stopScriptRun(runId: string): boolean {
  const record = runRegistry.get(runId)
  if (!record || record.status !== 'running')
    return false

  record.run.stop()
  return true
}

/**
 * 后端脚本同步分页大小。
 * 后端 /v1/user/scripts 的 limit 上限为 200，取 100 兼顾单页大小与请求次数。
 */
const SYNC_PAGE_SIZE = 100

/**
 * 从后端 /v1/user/scripts 分页拉取当前用户的全部脚本，并 upsert 到本地 scripts/files 表。
 *
 * 设计要点：
 * - 以后端为真相源：后端返回的每条脚本都会更新或插入本地（见 ScriptStore.upsertFromBackend）。
 * - 保留本地独有：后端没有的本地脚本不删除，避免丢失尚未同步到后端的本地脚本（如后端 create 失败时）。
 * - 不抛错：任何网络/后端/单条 upsert 异常都吞掉并记录，避免阻塞前端列表加载。返回已成功同步的条数。
 */
export async function syncScriptsFromBackend(): Promise<{ synced: number, error?: string }> {
  let offset = 0
  let total = 0
  let synced = 0

  do {
    let page
    try {
      page = await AI_AGENT_API.scripts.list({ limit: SYNC_PAGE_SIZE, offset })
    }
    catch (err: any) {
      console.warn(`[scriptSync] fetch backend scripts failed at offset=${offset}: ${err?.message}`)
      return { synced, error: err?.message || t('script.syncFailed') }
    }

    const items = page?.items ?? []
    total = page?.total ?? items.length
    console.log(`[scriptSync] get ${items.length} scripts`)

    for (const dto of items) {
      try {
        ScriptStore.upsertFromBackend(dto)
        synced += 1
      }
      catch (err: any) {
        console.warn(`[scriptSync] upsert script "${dto?.name}" failed: ${err?.message}`)
      }
    }

    offset += items.length
    // 防御：后端返回空 items（异常或已到末尾）时立即退出，避免死循环
    if (items.length === 0)
      break
  } while (offset < total)

  return { synced }
}

export interface CascadeResult {
  ok: boolean
  msg?: string
}

export async function deleteScriptCascade(localId: string): Promise<CascadeResult> {
  const rec = ScriptStore.getById(localId)
  if (!rec)
    return { ok: false, msg: `Script ${localId} not found` }

  if (rec.remote_id != null) {
    try {
      await AI_AGENT_API.scripts.delete(rec.remote_id)
    }
    catch (err: any) {
      if (err instanceof AiAgentHttpError) {
        // 404：云端已不存在，幂等放行继续删本地；其他状态码：后端拒绝，本地不删
        if (err.status !== 404)
          return { ok: false, msg: t('script.cloudDeleteFailed', { detail: err.message }) }
      }
      else {
        // 原生网络/连接错误（fetch 直接抛出，非 HTTP 响应错误）
        return { ok: false, msg: t('script.cloudDeleteFailedNetwork', { detail: err?.message || t('common.networkError') }) }
      }
    }
  }

  const deleted = ScriptStore.delete(localId)
  return deleted ? { ok: true } : { ok: false, msg: `Script ${localId} not found` }
}

export async function updateScriptCascade(
  localId: string,
  patch: { name?: string, description?: string },
): Promise<CascadeResult> {
  const rec = ScriptStore.getById(localId)
  if (!rec)
    return { ok: false, msg: `Script ${localId} not found` }

  if (rec.remote_id != null) {
    try {
      await AI_AGENT_API.scripts.update(rec.remote_id, patch)
    }
    catch (err: any) {
      if (err instanceof AiAgentHttpError) {
        if (err.status !== 404)
          return { ok: false, msg: t('script.cloudUpdateFailed', { detail: err.message }) }
      }
      else {
        return { ok: false, msg: t('script.cloudUpdateFailedNetwork', { detail: err?.message || t('common.networkError') }) }
      }
    }
  }

  try {
    const updated = ScriptStore.update(localId, patch)
    return updated ? { ok: true } : { ok: false, msg: `Script ${localId} not found` }
  }
  catch {
    // 本地 name UNIQUE 约束冲突等
    return { ok: false, msg: t('script.localUpdateFailed') }
  }
}
