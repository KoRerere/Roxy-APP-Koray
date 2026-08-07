import type { WorkerResultStatus } from '../core/worker/protocol'
import type { AgentRunEvent } from '@roxy/shared/channel'
import { HumanMessage } from '@langchain/core/messages'
import { streamEvents } from '../core/agent-events/streamEvents'
import { startResourceMonitor } from '../core/diagnostics/resourceMonitor'
import { writePerfmon } from '../core/logger'
import { loadWorkerPayload } from '../core/worker/payload'
import {
  closeIpcAndExit,
  sendEvent,
  sendHeartbeat,
  sendReady,
  sendResult,
  WORKER_HEARTBEAT_INTERVAL_MS,
} from '../core/worker/protocol'
import { createChatAgent } from '../deepagents/agent/chat'
import { handleWorkerStream, StreamState } from '../deepagents/handle-stream'

const WORKER_DESTROY_TIMEOUT_MS = 12_000

export async function runWorkerMode(): Promise<() => Promise<void>> {
  const payload = await loadWorkerPayload()

  const { workerId, task, timeoutMs, conversationId, turnId, dispatchTaskId, allowedDirIds } = payload
  const writer = (event: AgentRunEvent) => sendEvent(workerId, event)

  console.log(`[worker] Starting workerId=${workerId} pid=${process.pid} timeoutMs=${timeoutMs}`)

  const abortController = new AbortController()
  const startedAt = Date.now()
  let failureReason: string | null = null
  let finalStatus: WorkerResultStatus = 'failed'
  let finalResult = ''
  let finalError: string | null = 'Worker ended without result'
  let delivered = false

  // Listen for cancel from parent
  process.on('message', (msg: any) => {
    if (msg?.type === 'cancel') {
      console.log(`[worker] Received cancel reason=${msg.reason}`)
      failureReason = msg.message ?? `Worker cancelled: ${msg.reason}`
      abortController.abort(failureReason)
    }
  })

  // Send ready after payload is loaded — parent will unlink the file on receipt
  sendReady(workerId)

  const heartbeatHandle = setInterval(() => {
    sendHeartbeat(workerId)
  }, WORKER_HEARTBEAT_INTERVAL_MS)
  heartbeatHandle.unref()

  // Worker-side timeout (belt-and-suspenders alongside parent timer)
  const timeoutHandle = setTimeout(() => {
    failureReason = `Worker timed out after ${timeoutMs}ms`
    abortController.abort(failureReason)
  }, timeoutMs)
  timeoutHandle.unref()

  const stopResourceMonitor = startResourceMonitor({
    label: 'worker',
    intervalMs: 15_000,
    receiver: writePerfmon,
  })

  let agent, destroy
  try {
    ;({ agent, destroy } = await createChatAgent({
      role: 'worker',
      workerId,
      conversationId,
      turnId,
      taskMonitorTaskId: dispatchTaskId ?? workerId,
      allowedDirIds,
      onRetry: info => writer(streamEvents.workerRetryEvent({ taskId: workerId, ...info })),
    }))

    const streamState = new StreamState()
    streamState.setTaskId(workerId)

    const stream = await agent.stream(
      { messages: [new HumanMessage({ content: task })] },
      {
        tags: [workerId],
        streamMode: ['messages', 'custom', 'tools'],
        signal: abortController.signal,
        taskMonitorTaskId: workerId,
        writer,
      } as any,
    )

    for await (const rawChunk of stream) {
      const events = handleWorkerStream(rawChunk, streamState)
      for (const event of events) {
        writer(event)
      }
    }

    const finishedThinking = streamState.finishThinking(Date.now())
    if (finishedThinking) {
      writer(streamEvents.thinkingCompleteEvent(finishedThinking))
    }

    if (abortController.signal.aborted) {
      throw new Error(failureReason ?? 'Worker cancelled')
    }

    finalStatus = 'success'
    finalResult = streamState.getLastChunkContent()
    finalError = null
  }
  catch (error: any) {
    const isAbort = error?.name === 'AbortError' || abortController.signal.aborted
    const errorMessage = failureReason
      ?? (isAbort ? 'Worker cancelled' : error instanceof Error ? `${error.message}\n${error.stack}` : String(error))

    console.error('[worker] Run ended status=failed', errorMessage)
    finalStatus = 'failed'
    finalResult = ''
    finalError = errorMessage
  }
  finally {
    clearTimeout(timeoutHandle)
    clearInterval(heartbeatHandle)
    stopResourceMonitor()

    delivered = await sendResult({
      workerId,
      status: finalStatus,
      result: finalResult,
      error: finalError,
      durationMs: Date.now() - startedAt,
    })

    if (destroy) {
      try {
        const destroyWithTimeout = Promise.race([
          destroy(),
          new Promise<void>(resolve => setTimeout(resolve, WORKER_DESTROY_TIMEOUT_MS)),
        ])
        await destroyWithTimeout
      }
      catch (error: any) {
        console.warn('[worker] destroy failed during shutdown:', error instanceof Error ? error.message : String(error))
      }
    }
  }

  closeIpcAndExit(delivered && finalStatus === 'success' ? 0 : 1)

  /**
   * Return a no-op shutdown; closeIpcAndExit has already disconnected IPC and
   * scheduled a fallback process exit after the final result was flushed.
   */
  return async function shutdown() {}
}
