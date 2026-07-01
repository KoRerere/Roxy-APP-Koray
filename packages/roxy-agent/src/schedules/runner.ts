/**
 * 定时任务执行器：跑一次临时 agent turn。
 *
 * 设计要点（与 modes/worker.ts 的一次性 run 一致）：
 * - **不传 conversationId**：无 checkpointer、无 workspace、无 shell（FilesystemBackend）、
 *   无 interruptOn（不会卡 HITL）。完全 ephemeral，不污染任何用户会话。
 * - 合成 workerId（`sched_<scheduleId>_<runId>`），永不与 'simple' 或用户 worker 冲突；
 *   每次执行独立 playwright MCP，destroy 后清理。
 * - agent.stream → handleWorkerStream → StreamState.getLastChunkContent() 取最终文本。
 * - finally 里 destroy() 带 12s 超时守卫，成功/失败都清理。
 * - 永不抛错：异常转为 { output:'', error }，错误隔离由 engine 负责。
 */

import type { ScheduleRecord } from '@/database/schedules/types'
import { HumanMessage } from '@langchain/core/messages'
import { randomUUID } from 'node:crypto'
import { createChatAgent } from '@/deepagents/agent/chat'
import { handleWorkerStream, StreamState } from '@/deepagents/handle-stream'

const SCHEDULE_DESTROY_TIMEOUT_MS = 12_000
const SCHEDULE_RUN_TIMEOUT_MS = Number(process.env.SCHEDULE_RUN_TIMEOUT_MS) || 180_000

export interface RunScheduledTurnResult {
  output: string
  error?: string
}

/**
 * 用临时 agent 执行一次定时任务。
 * @returns 最终 AIMessage 文本；出错时 output 为空、error 填原因。永不 reject。
 */
export async function runScheduledTurn(schedule: ScheduleRecord): Promise<RunScheduledTurnResult> {
  const runId = `schedrun_${Date.now()}_${randomUUID().slice(0, 8)}`
  // 合成 workerId：与 'simple' 及用户 worker 永不冲突
  const workerId = `sched_${schedule.id}_${runId}`

  const abortController = new AbortController()
  const timeoutHandle = setTimeout(() => {
    abortController.abort(`Schedule run timed out after ${SCHEDULE_RUN_TIMEOUT_MS}ms`)
  }, SCHEDULE_RUN_TIMEOUT_MS)
  timeoutHandle.unref()

  let output = ''
  let error: string | undefined

  // createChatAgent 不传 conversationId → 走 ephemeral 路径（无 checkpointer/无 shell/无 HITL）
  let agent: any
  let destroy: (() => Promise<void>) | undefined
  try {
    ;({ agent, destroy } = await createChatAgent({ mode: 'simple', workerId }))

    const streamState = new StreamState()
    streamState.setTaskId(runId)

    const stream = await agent.stream(
      { messages: [new HumanMessage({ content: schedule.prompt })] },
      {
        tags: [runId],
        streamMode: ['messages', 'custom', 'tools'],
        signal: abortController.signal,
      } as any,
    )

    for await (const rawChunk of stream) {
      // 仅消费以驱动 StreamState 收集最终文本；事件本身丢弃
      handleWorkerStream(rawChunk, streamState)
    }

    streamState.finishThinking(Date.now())

    if (abortController.signal.aborted) {
      throw new Error(`Schedule run timed out after ${SCHEDULE_RUN_TIMEOUT_MS}ms`)
    }

    output = streamState.getLastChunkContent().trim()
  }
  catch (err: any) {
    const isAbort = err?.name === 'AbortError' || abortController.signal.aborted
    error = isAbort
      ? `Schedule run cancelled/timed out: ${err?.message ?? 'aborted'}`
      : err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
    console.error(`[schedule] run failed scheduleId=${schedule.id} runId=${runId}:`, error)
    output = ''
  }
  finally {
    clearTimeout(timeoutHandle)

    if (destroy) {
      try {
        await Promise.race([
          destroy(),
          new Promise<void>(resolve => setTimeout(resolve, SCHEDULE_DESTROY_TIMEOUT_MS)),
        ])
      }
      catch (err: any) {
        console.warn(`[schedule] destroy failed scheduleId=${schedule.id} runId=${runId}:`, err instanceof Error ? err.message : String(err))
      }
    }
  }

  return { output, error }
}
