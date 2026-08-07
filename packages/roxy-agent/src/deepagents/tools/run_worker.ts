import type { WorkerResult } from '../../core/worker/protocol'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { agentPaths } from '@/core/storage/agentPaths'
import { publishTaskMonitorTaskFinished, publishTaskMonitorTaskStarted } from '@/core/task-monitor'
import { MAX_PARALLEL_WORKERS } from '@/tasks/constants'
import { clearPayloadFile, DEFAULT_WORKER_TIMEOUT_MS, WorkerRunner } from '../../core/worker/workerRunner'
import { workerNames } from '../prompt'

const parallelDispatchSchema = z.object({
  assignments: z
    .array(
      z.object({
        worker: z.enum(workerNames).describe('Worker name to dispatch to'),
        task: z.string().describe('Self-contained task description'),
        title: z.string().describe('Short one-line description about the task delegated to worker'),
        dirId: z
          .string()
          .min(1)
          .describe('Required. The single browser profile dirId this worker is bound to. Resolve profile_name / profile_serialNo / other profile refs into a real dirId with roxy_list_browsers BEFORE dispatching. The worker is hard-bound to this window and cannot touch any other window.'),
      }),
    )
    .min(1, 'At least one assignment is required')
    .max(MAX_PARALLEL_WORKERS, `At most ${MAX_PARALLEL_WORKERS} assignments are allowed`)
    .describe('Array of worker assignments to execute in parallel'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Worker timeout in milliseconds for all assignments. Defaults to 3600000 (1 hour).'),
})

function formatWorkerResultsAsMarkdown(results: WorkerResult[]): string {
  const lines: string[] = ['## parallel_dispatch 执行结果\n']
  for (const r of results) {
    const statusEmoji = r.status === 'success' ? '✅' : '❌'
    lines.push(`### ${statusEmoji} Worker: ${r.worker}`)
    lines.push(`**状态**: ${r.status}`)
    if (r.error)
      lines.push(`**错误**: ${r.error}`)
    lines.push('**结果**:')
    lines.push(r.result?.trim() ? r.result : '(无文本输出)')
    lines.push(`**耗时**: ${r.durationMs}ms | exitCode: ${r.exitCode ?? 'N/A'} | signal: ${r.signal ?? 'N/A'}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

function createWorkerTaskId(workerName: string, dispatchId: string, index: number): string {
  return `${workerName}-${dispatchId}-${index}`
}

export function createWorkerTools(conversationId: string): StructuredToolInterface[] {
  return [
    tool(
      async (
        input: z.infer<typeof parallelDispatchSchema>,
        config: any,
      ): Promise<string> => {
        const agentScriptPath = process.env.AGENT_SCRIPT_PATH
        if (!agentScriptPath) {
          throw new Error('AGENT_SCRIPT_PATH must be set by parent process')
        }

        const turnId = typeof config.turnId === 'string'
          ? config.turnId
          : typeof config.configurable?.turnId === 'string'
            ? config.configurable.turnId
            : undefined

        // 一个窗口只能由一个 worker 持有，否则两个 worker 会在同一浏览器上下文里互相干扰
        const seenDirIds = new Set<string>()
        for (const assignment of input.assignments) {
          if (seenDirIds.has(assignment.dirId)) {
            return `Error: dirId ${assignment.dirId} is assigned to more than one worker. Each worker must be bound to a distinct window. Fix the assignments and dispatch again.`
          }
          seenDirIds.add(assignment.dirId)
        }

        const parentRunId = `run_${Date.now()}_${randomUUID().slice(0, 8)}`
        const dispatchId = randomUUID().slice(0, 8)
        const timeoutMs = input.timeout ?? DEFAULT_WORKER_TIMEOUT_MS

        // 整个 dispatch 共享一个 task-monitor 任务，所有 worker 的浏览器事件都挂在同一张卡片下
        publishTaskMonitorTaskStarted({
          taskId: dispatchId,
          title: input.assignments.map(a => a.title).join(' / '),
          sourceType: 'worker',
          conversationId,
          runId: dispatchId,
        })
        // worker 任务载荷是下发给 fork 子进程的临时 IPC 文件（用后由 clearPayloadFile 删除），归入 tmp/
        const payloadDir = path.join(agentPaths.tmpDir, 'worker-payloads')
        await fs.mkdir(payloadDir, { recursive: true })

        const runners: WorkerRunner[] = []
        const workerLabelMap = new Map<string, string>()

        for (const [index, assignment] of input.assignments.entries()) {
          const workerTaskId = createWorkerTaskId(assignment.worker, dispatchId, index)
          workerLabelMap.set(workerTaskId, assignment.worker)

          // 在 fork worker 子进程之前同步下发任务标题，保证 worker_dispatch 先于该 worker 的任何内部事件到达前端
          config.writer?.(streamEvents.workerDispatch({ taskId: workerTaskId, title: assignment.title }))

          const payloadPath = path.join(payloadDir, `${parentRunId}-${workerTaskId}-${randomUUID().slice(0, 8)}.json`)

          const payload = {
            protocolVersion: 1,
            workerId: workerTaskId,
            parentRunId,
            conversationId,
            task: assignment.task,
            timeoutMs,
            turnId,
            dispatchTaskId: dispatchId,
            // worker 只能操作分派给它的那个窗口
            allowedDirIds: [assignment.dirId],
          }
          await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8')

          const runner = new WorkerRunner(
            workerTaskId,
            payloadPath,
            agentScriptPath,
            timeoutMs,
            config.writer ?? (() => {}),
            config.signal,
          )
          runners.push(runner)
        }

        // Start runners with staggered delay to reduce resource contention
        for (let i = 0; i < runners.length; i++) {
          runners[i].start()
          if (i < runners.length - 1) {
            /**
             * 1–3 s
             */
            const delayMs = 1000 + Math.floor(Math.random() * 2000)
            await new Promise<void>(resolve => setTimeout(resolve, delayMs))
          }
        }

        // Wait for all workers to finish and exit
        const settled = await Promise.allSettled(runners.map(r => r.promise))

        const wasAborted = Boolean(config.signal?.aborted)

        const results: WorkerResult[] = settled.map((s) => {
          if (s.status === 'fulfilled') {
            return {
              ...s.value,
              worker: workerLabelMap.get(s.value.worker) ?? s.value.worker,
            }
          }
          // Should not happen since WorkerRunner always resolves
          return {
            worker: 'unknown',
            status: 'failed' as const,
            result: '',
            error: String(s.reason),
            exitCode: null,
            signal: null,
            durationMs: 0,
          }
        })

        // Sweep any leftover payload files for this run
        await clearPayloadFile(agentPaths.tmpDir, parentRunId)

        publishTaskMonitorTaskFinished(dispatchId)

        if (wasAborted) {
          config.writer?.(streamEvents.cancelled({
            message: 'Agent stopped: User cancelled',
          }))
          throw new Error('User cancelled')
        }

        return formatWorkerResultsAsMarkdown(results)
      },
      {
        name: 'parallel_dispatch',
        description: `Dispatch tasks to multiple workers in parallel. All workers execute concurrently. All worker results will be returned.`,
        schema: parallelDispatchSchema,
      },
    ) as unknown as StructuredToolInterface,
  ]
}
