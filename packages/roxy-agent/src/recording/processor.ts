import type { RecordingEvent, RecordingSession } from './types'
import type { FileRecord } from '@/database/conversations'
import type { EnhanceResult } from '@/deepagents/agent/enhance'
import AdmZip from 'adm-zip'
import { Buffer } from 'node:buffer'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { fileManager } from '@/core/fileManager'
import { runEnhanceAgent } from '@/deepagents/agent/enhance'
import { RECORDING_PROMPT } from '@/deepagents/prompt/recording'
import { prepareEnhanceWorkspace } from './enhanceWorkspace'
import { recordingManager } from './recordingManager'
import { refineScript } from './refiner'
import { registerScriptRecord } from './registerScript'
import { generateRawSkeleton } from './skeletonGenerator'

export const SCRIPT_ENTRY_NAME = 'script.ts'

/**
 * 完整录制处理流程：skeleton → refine → enhance → save。
 * 由「停止录制」触发，从头生成脚本。
 */
export async function runRecordingProcessing(
  session: RecordingSession,
  conversationId: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const events = await loadAndValidateEvents(session, conversationId, signal)
    if (!events)
      return

    const refined = await buildRefinedScript(session, conversationId, events, signal)
    if (!refined)
      return

    if (signal?.aborted)
      return handleCancelled(conversationId, 'Cancelled before enhance agent started')

    if (!(await prepareWorkspace(session, conversationId, events, refined.refinedScript)))
      return

    await runEnhancePhase(session, conversationId, refined.refinedScriptPath, signal)
  }
  catch (err: any) {
    handleFatalError(session, conversationId, err)
  }
}

/**
 * 重试前清理上一轮 enhance agent 运行产生的产物，避免残留干扰新一轮
 *
 * 按文件名模式删除，不依赖任何写入清单：
 *  - `enhanced_script*.ts`：agent 通过 write_file 写的最终/中间脚本。
 *  - `*.log`：run_script 的诊断日志（script_*.log）。
 *  - `script-run/`：run_script 的产物输出目录（整目录递归删除，其下为
 *    {timestamp}-{runId} 形式的各次运行子目录）
 */
async function cleanupOldFiles(workspaceDir: string): Promise<void> {
  const root = path.resolve(workspaceDir)
  let entries: string[]
  try {
    entries = await fsPromises.readdir(root)
  }
  catch (err: any) {
    if (err?.code === 'ENOENT')
      return
    console.warn('[Recording] Failed to read workspace for cleanup:', err?.message ?? err)
    return
  }

  for (const name of entries) {
    const target = path.join(root, name)

    // run_script 产物输出目录（{workspace}/script-run/{ts}-{runId}/...）：整目录删除
    if (name === 'script-run') {
      await safeRm(target, { recursive: true })
      continue
    }

    // enhanced_script*.ts 与 *.log：仅删匹配的文件，不动其他文件/目录
    if ((name.startsWith('enhanced_script') && name.endsWith('.ts')) || name.endsWith('.log')) {
      await safeRm(target)
      continue
    }
  }
}

/**
 * 删除文件或目录，force 容忍不存在；失败仅告警不中断。
 * 安全：用 lstat 区分类型——符号链接仅删除链接本身（不跟随、不递归，避免误伤外部目标）；
 * 真实目录才 recursive 删除；真实文件普通删除。防止 enhance agent（执行 LLM 生成内容）
 * 在工作区植入指向外部的符号链接导致递归删除越界。
 */
async function safeRm(target: string, opts: { recursive?: boolean } = {}): Promise<void> {
  try {
    const stat = await fsPromises.lstat(target)
    // 符号链接：仅删链接本身，绝不跟随或递归（防越界删外部目标）
    if (stat.isSymbolicLink()) {
      await fsPromises.rm(target, { force: true })
      console.debug(`[Recording] Removed symlink artifact: ${target}`)
      return
    }
    // 真实目录：允许 recursive；真实文件：不带 recursive
    const rmOpts = stat.isDirectory()
      ? { force: true, ...opts }
      : { force: true }
    await fsPromises.rm(target, rmOpts)
    console.debug(`[Recording] Cleaned previous enhance artifact: ${target}`)
  }
  catch (err: any) {
    if (err?.code === 'ENOENT')
      return
    console.warn(`[Recording] Failed to clean ${target}:`, err?.message ?? err)
  }
}

/**
 * 重试脚本生成：复用同一录制 session 的工作区（events + 已有 refined_script.ts），
 * 直接重新启动 enhance agent，避免重新录制与重新准备工作区。
 *
 * - 工作区已有 refined_script.ts（上次至少跑到 enhance）：跳过 skeleton/refine/prepare，
 *   全新启动 enhance agent。
 * - 没有 refined_script.ts（上次在 refine 之前失败/取消）：从 refine 阶段重新开始。
 */
export async function runRecordingRetry(
  session: RecordingSession,
  conversationId: string,
  signal?: AbortSignal,
): Promise<void> {
  const logPrefix = '[Recording] Retry'
  try {
    const events = await loadAndValidateEvents(session, conversationId, signal, ' (retry)')
    if (!events)
      return

    // 重试前清理上一轮 enhance agent 产生的产物（enhanced_script*.ts / *.log /
    // script-run/{ts}-{runId} 输出目录），避免残留干扰新一轮（write_file 拒绝覆盖已存在文件）。
    await cleanupOldFiles(session.workDir)

    const refinedScriptPath = path.join(session.workDir, 'refined_script.ts')
    const refinedExists = await fsPromises.stat(refinedScriptPath).then(() => true).catch(() => false)

    let refinedScriptPathResolved = refinedScriptPath
    if (refinedExists) {
      // 核心场景：复用上次 refine 产物，直接全新启动 enhance
      recordingManager.updateSession(conversationId, { refinedScriptPath })
      console.log(`${logPrefix}: reuse existing refined script → ${refinedScriptPath}`)
    }
    else {
      // 回退场景：上次在 refine 之前失败/取消，从 skeleton + refine 重新开始
      const refined = await buildRefinedScript(session, conversationId, events, signal, logPrefix)
      if (!refined)
        return
      refinedScriptPathResolved = refined.refinedScriptPath

      if (!(await prepareWorkspace(session, conversationId, events, refined.refinedScript)))
        return
    }

    await runEnhancePhase(session, conversationId, refinedScriptPathResolved, signal, logPrefix)
  }
  catch (err: any) {
    console.error(`${logPrefix} processing failed for session ${session.id}:`, err.message)
    recordingManager.updateSession(conversationId, {
      status: 'failed',
      errorMessage: err.message,
      phase: undefined,
    })
  }
}

// ============ 公共子流程 ============

/**
 * 读取并校验录制事件。空事件 / 无浏览器操作时标记 failed 并返回 null；
 * abort 时标记 cancelled 并返回 null。
 */
async function loadAndValidateEvents(
  session: RecordingSession,
  conversationId: string,
  signal?: AbortSignal,
  reasonSuffix = '',
): Promise<RecordingEvent[] | null> {
  const events = await recordingManager.readEvents(session)

  if (signal?.aborted) {
    await handleCancelled(conversationId, `Cancelled before events were read${reasonSuffix}`)
    return null
  }

  if (events.length === 0) {
    recordingManager.updateSession(conversationId, {
      status: 'failed',
      errorMessage: RECORDING_PROMPT.processing.noEvents,
      phase: undefined,
    })
    return null
  }

  const browserOps = events.filter(e => e.type === 'browser_op')
  if (browserOps.length === 0) {
    recordingManager.updateSession(conversationId, {
      status: 'failed',
      errorMessage: RECORDING_PROMPT.processing.noBrowserOps,
      phase: undefined,
    })
    return null
  }

  return events
}

/**
 * 生成 raw skeleton → refine locator 稳定化 → 写入工作区 refined_script.ts。
 * 返回 refinedScript 内容与路径；abort 时标记 cancelled 并返回 null。
 */
async function buildRefinedScript(
  session: RecordingSession,
  conversationId: string,
  events: RecordingEvent[],
  signal?: AbortSignal,
  logPrefix = '[Recording]',
): Promise<{ refinedScript: string, refinedScriptPath: string } | null> {
  // 1. 生成 raw skeleton
  recordingManager.updateSession(conversationId, { phase: 'skeleton' })
  const { script: rawScript, operationCount, warnings } = generateRawSkeleton(events, session)
  if (warnings.length > 0)
    console.warn(`${logPrefix} Skeleton warnings:`, warnings)

  const rawSkeletonPath = path.join(session.workDir, 'raw_skeleton.ts')
  await fsPromises.writeFile(rawSkeletonPath, rawScript, 'utf-8')
  recordingManager.updateSession(conversationId, { rawSkeletonPath })
  console.log(`${logPrefix} Raw skeleton generated: ${operationCount} ops → ${rawSkeletonPath}`)

  if (signal?.aborted) {
    await handleCancelled(conversationId, 'Cancelled after skeleton generation')
    return null
  }

  // 2. Refine：locator 稳定化
  recordingManager.updateSession(conversationId, { phase: 'refine' })
  const { refinedScript, modified, summary: refineSummary } = await refineScript(
    rawScript,
    events,
    session,
    conversationId,
    signal,
  )

  if (signal?.aborted) {
    // Refine 被中止：不保存任何产物（不写 refined_script、不入库）
    await handleCancelled(conversationId, 'Cancelled during/after refinement')
    return null
  }

  const refinedScriptPath = path.join(session.workDir, 'refined_script.ts')
  await fsPromises.writeFile(refinedScriptPath, refinedScript, 'utf-8')
  recordingManager.updateSession(conversationId, { refinedScriptPath })
  console.log(`${logPrefix} Refine done (modified=${modified}): ${refineSummary}`)

  return { refinedScript, refinedScriptPath }
}

/**
 * 准备 enhance 工作区（conversation.jsonl / recording_summary.md，refined_script.ts 已存在不覆盖）。
 * 失败时标记 failed 并返回 false。
 */
async function prepareWorkspace(
  session: RecordingSession,
  conversationId: string,
  events: RecordingEvent[],
  refinedScript: string,
): Promise<boolean> {
  try {
    await prepareEnhanceWorkspace(session, events, refinedScript)
    return true
  }
  catch (err: any) {
    console.error('[Recording] Failed to prepare enhance workspace:', err.message)
    recordingManager.updateSession(conversationId, {
      status: 'failed',
      phase: 'done',
      errorMessage: RECORDING_PROMPT.processing.prepareWorkspaceFailed(err.message),
    })
    return false
  }
}

/**
 * 运行 enhance agent 并保存 / 登记最终脚本。
 * - 成功（enhance 调用 save_script）：写 enhanced_script → saveScript → registerScriptRecord → 标 done。
 * - 未调 save_script 或返回失败：不保存任何产物，标 failed。
 * - abort：标 cancelled，不保存。
 * - enhance 抛错：标 failed，不保存。
 */
async function runEnhancePhase(
  session: RecordingSession,
  conversationId: string,
  refinedScriptPath: string,
  signal?: AbortSignal,
  logPrefix = '[Recording]',
): Promise<void> {
  recordingManager.updateSession(conversationId, { phase: 'enhance' })

  let enhancedScriptPath: string | undefined
  let uploadRecord: FileRecord | undefined
  let enhanceResult: EnhanceResult
  try {
    enhanceResult = await runEnhanceAgent(
      session.workDir,
      session.id,
      conversationId,
      session.primaryDirId,
      signal,
    )

    const enhanceSummary = enhanceResult.summary

    // enhance 被取消：不保存
    if (signal?.aborted) {
      return handleCancelled(conversationId, 'Cancelled during enhance')
    }

    if (enhanceResult.ok && enhanceResult.enhancedScript) {
      enhancedScriptPath = path.join(session.workDir, 'enhanced_script.ts')
      await fsPromises.writeFile(enhancedScriptPath, enhanceResult.enhancedScript, 'utf-8')

      // 保存产物：本地 files 入库 + OSS 上传（zip）
      uploadRecord = await saveScript(session.id, enhanceResult.enhancedScript)
      if (!uploadRecord) {
        // 保存失败（本地入库失败）：不留半成品，标记 failed
        throw new Error('Failed to save final script artifact (local persist failed)')
      }
      console.log(`${logPrefix} Enhance done (source=${enhanceResult.source}): ${enhancedScriptPath}`)
      console.log(`${logPrefix} Final script saved: fileId=${uploadRecord.file_id} oss=${uploadRecord.oss_url}`)
      console.log(`${logPrefix} Enhance summary: ${enhanceSummary ?? '(无)'}`)
    }
    else {
      // enhance 未调 save_script 或返回失败：不保存任何产物，标记 failed
      const enhanceErrorMessage = enhanceResult.errorMessage ?? 'Enhance did not produce a final script'
      console.warn(`${logPrefix} Enhance did not produce a final script: ${enhanceErrorMessage}`)
      console.warn(`${logPrefix} Enhance summary: ${enhanceSummary ?? '(无)'}`)
      recordingManager.updateSession(conversationId, {
        status: 'failed',
        phase: 'done',
        errorMessage: enhanceErrorMessage,
        completedAt: Date.now(),
      })
      return
    }
  }
  catch (err: any) {
    console.error(`${logPrefix} Enhance agent failed:`, err.message)
    recordingManager.updateSession(conversationId, {
      status: 'failed',
      phase: 'done',
      errorMessage: `Enhance agent failed: ${err.message}`,
      completedAt: Date.now(),
    })
    return
  }

  await registerScriptRecord(uploadRecord, {
    sessionId: session.id,
    conversationId,
    dirId: session.primaryDirId,
    optionsSchema: enhanceResult.optionsSchema,
  })

  recordingManager.updateSession(conversationId, {
    status: 'done',
    phase: 'done',
    refinedScriptPath,
    enhancedScriptPath,
    finalScriptPath: enhancedScriptPath,
    finalScriptFileId: uploadRecord.file_id,
    ...(uploadRecord.oss_url ? { finalScriptOssUrl: uploadRecord.oss_url } : {}),
    completedAt: Date.now(),
  })

  console.log(`${logPrefix} Session ${session.id} completed. Script: ${enhancedScriptPath}`)
}

async function handleCancelled(
  conversationId: string,
  reason: string,
): Promise<void> {
  console.log(`[Recording] Processing cancelled: ${reason}`)

  recordingManager.updateSession(conversationId, {
    status: 'cancelled',
    completedAt: Date.now(),
  })
}

/** 外层未预期异常兜底：标记 failed */
function handleFatalError(
  session: RecordingSession,
  conversationId: string,
  err: any,
): void {
  console.error(`[Recording] Processing failed for session ${session.id}:`, err.message)
  recordingManager.updateSession(conversationId, {
    status: 'failed',
    errorMessage: err.message,
    phase: undefined,
  })
}

async function saveScript(recordingId: string, script: string): Promise<FileRecord | undefined> {
  try {
    const zip = new AdmZip()
    zip.addFile(SCRIPT_ENTRY_NAME, Buffer.from(script, 'utf-8'))
    return fileManager.saveBufferWithRemote({
      buffer: zip.toBuffer(),
      fileName: `recording_${recordingId}.zip`,
      mimeType: 'application/zip',
      source: 'recording',
      prefix: 'recording',
    })
  }
  catch (err: any) {
    console.warn(`[Recording] Failed to save final script artifact:`, err?.message ?? err)
    return undefined
  }
}
