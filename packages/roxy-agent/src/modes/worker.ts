import type { WorkerResultStatus } from '../core/worker/protocol'
import { HumanMessage } from '@langchain/core/messages'
import { env } from '../config'
import { streamAdapter } from '../core/sse/streamAdapter'
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
  if (!env.CHECKPOINT_DIR) {
    throw new Error('CHECKPOINT_DIR must be set before starting worker process')
  }

  const payload = await loadWorkerPayload()

  const { workerId, task, timeoutMs, conversationId, turnId } = payload

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

  let agent, destroy
  try {
    ;({ agent, destroy } = await createChatAgent({
      mode: 'simple',
      workerId,
      conversationId,
      turnId,
      // worker 内模型调用网络中断也自动重试；经 IPC 回传 worker_retry（带 taskId），前端据此停计时 / 截断块、不展示提示
      onRetry: info => sendEvent(workerId, streamAdapter.workerRetryEvent({ taskId: workerId, ...info })),
    }))

    const streamState = new StreamState()
    streamState.setTaskId(workerId)

    const stream = await agent.stream(
      { messages: [new HumanMessage({ content: task })] },
      {
        tags: [workerId],
        streamMode: ['messages', 'custom', 'tools'],
        signal: abortController.signal,
      } as any,
    )

    for await (const rawChunk of stream) {
      const events = handleWorkerStream(rawChunk, streamState)
      for (const event of events) {
        sendEvent(workerId, event)
      }
    }

    const finishedThinking = streamState.finishThinking(Date.now())
    if (finishedThinking) {
      sendEvent(workerId, streamAdapter.thinkingCompleteEvent(finishedThinking))
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
