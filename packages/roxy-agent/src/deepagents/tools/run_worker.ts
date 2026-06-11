import type { WorkerResult } from '../../worker/protocol'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { env } from '../../config'
import { streamAdapter } from '../../server/streamAdapter'
import { clearPayloadFile, DEFAULT_WORKER_TIMEOUT_MS, WorkerRunner } from '../../worker/workerRunner'
import { workerNames } from '../prompt'

interface parallelDispatchParam { worker: string, task: string }

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

export const workerTools = [
  tool(
    async (
      input: { assignments: Array<parallelDispatchParam> },
      config: any,
    ): Promise<string> => {
      const agentScriptPath = process.env.AGENT_SCRIPT_PATH
      if (!agentScriptPath) {
        throw new Error('AGENT_SCRIPT_PATH must be set by parent process')
      }
      const checkpointDir = env.CHECKPOINT_DIR
      if (!checkpointDir) {
        throw new Error('CHECKPOINT_DIR must be set before starting worker process')
      }

      const parentRunId = `run_${Date.now()}_${randomUUID().slice(0, 8)}`
      const dispatchId = randomUUID().slice(0, 8)
      const payloadDir = path.join(checkpointDir, 'worker-payloads')
      await fs.mkdir(payloadDir, { recursive: true })

      const runners: WorkerRunner[] = []
      const workerLabelMap = new Map<string, string>()

      for (const [index, assignment] of input.assignments.entries()) {
        const workerTaskId = createWorkerTaskId(assignment.worker, dispatchId, index)
        workerLabelMap.set(workerTaskId, assignment.worker)
        const payloadPath = path.join(payloadDir, `${parentRunId}-${workerTaskId}-${randomUUID().slice(0, 8)}.json`)

        const payload = {
          protocolVersion: 1,
          workerId: workerTaskId,
          parentRunId,
          conversationId: config.conversationId,
          task: assignment.task,
          timeoutMs: DEFAULT_WORKER_TIMEOUT_MS,
          turnId: config.turnId,
        }
        await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8')

        const runner = new WorkerRunner(
          workerTaskId,
          payloadPath,
          agentScriptPath,
          DEFAULT_WORKER_TIMEOUT_MS,
          config.writer ?? (() => {}),
          config.signal,
        )
        runners.push(runner)
      }

      // Start runners with staggered delay to reduce resource contention
      for (let i = 0; i < runners.length; i++) {
        runners[i].start()
        if (i < runners.length - 1) {
          const delayMs = 1000 + Math.floor(Math.random() * 2000) // 1–3 s
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
      await clearPayloadFile(checkpointDir, parentRunId)

      if (wasAborted) {
        config.writer?.(streamAdapter.orchestratorStopped({
          status: 'failed',
          reason: 'user',
          message: 'Orchestrator stopped: User cancelled',
        }))
        throw new Error('User cancelled')
      }

      return formatWorkerResultsAsMarkdown(results)
    },
    {
      name: 'parallel_dispatch',
      description: `Dispatch tasks to multiple workers in parallel. All workers execute concurrently. Available workers: ${workerNames.join(', ')}, All worker results will be returned.`,
      schema: z.object({
        assignments: z
          .array(
            z.object({
              worker: z.enum(workerNames).describe('Worker name to dispatch to'),
              task: z.string().describe('Self-contained task description'),
            }),
          )
          .min(1, 'At least one assignment is required')
          .describe('Array of worker assignments to execute in parallel'),
      }),
    },
  ) as unknown as StructuredToolInterface,
]
