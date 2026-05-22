import type { StructuredToolInterface } from '@langchain/core/tools'
import { HumanMessage } from '@langchain/core/messages'
import { tool } from 'langchain'
import { z } from 'zod'
import { streamAdapter } from '../../server/streamAdapter'
import { createChatAgent } from '../agent/chat'
import { handleStream, StreamState } from '../handle-stream'
import { workerNames } from '../prompt'

interface WorkerResult {
  worker: string
  status: 'success' | 'error'
  result: string
}

interface parallelDispatchParam { worker: string, task: string }

function formatWorkerResultsAsMarkdown(results: WorkerResult[]): string {
  const lines: string[] = ['## parallel_dispatch 执行结果\n']
  for (const r of results) {
    const statusEmoji = r.status === 'success' ? '✅' : '❌'
    lines.push(`### ${statusEmoji} Worker: ${r.worker}`)
    lines.push(`**状态**: ${r.status}`)
    lines.push('**结果**:')
    lines.push(r.result?.trim() ? r.result : '(无文本输出)')
    lines.push('')
  }
  return lines.join('\n').trim()
}

let worker_start = false

export function isWorkerStart() {
  return worker_start
}

export const workerTools = [
  tool(
    async (
      input: { assignments: Array<parallelDispatchParam> },
      config: any,
    ): Promise<string> => {
      worker_start = true
      const results: WorkerResult[] = await Promise.all(
        input.assignments.map(async (assignment: parallelDispatchParam) => {
          const workerId = assignment.worker
          try {
            const { agent, destroy } = await createChatAgent({ mode: 'simple', workerId })

            const state = {
              messages: [new HumanMessage({ content: assignment.task })],
            }

            const result = await agent.stream(state, {
              tags: [assignment.worker],
              streamMode: ['messages', 'custom', 'tools'],
              signal: config.signal,
            })

            const streamState = new StreamState()
            streamState.setTaskId(workerId)

            for await (const rawChunk of result) {
              const result = handleStream(rawChunk, streamState)
              if (Array.isArray(result)) {
                result.forEach(event => config.writer?.(event))
              }
              else if (result) {
                config.writer?.(typeof result === 'object' ? JSON.stringify(result) : result)
              }
            }

            await destroy()

            config.writer?.(streamAdapter.workerResult({
              taskId: workerId,
              status: 'success',
            }))

            return {
              worker: assignment.worker,
              status: 'success' as const,
              result: streamState.getLastChunkContent(),
            }
          }
          catch (error: any) {
            config.writer?.(streamAdapter.workerResult({
              taskId: workerId,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            }))

            return {
              worker: assignment.worker,
              status: 'error' as const,
              result: error instanceof Error ? error.message : String(error),
            }
          }
        }),
      )
      worker_start = false
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
