import type { SandboxAgentToHostMessage, SandboxHostEvent } from '@/core/sandbox/host-protocol'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { installProcessFaultGuards } from '@/core/processFaultGuard'
import { parseSandboxAgentToHostMessage, SANDBOX_HOST_PROTOCOL_VERSION } from '@/core/sandbox/host-protocol'
import { SandboxRunSession } from '@/core/sandbox/sandbox-run-session'

interface ActiveRun {
  session: SandboxRunSession
  finished: Promise<void>
}

const HEARTBEAT_INTERVAL_MS = 1_000
const SHUTDOWN_GRACE_MS = 5_000

function requireHostGeneration(): string {
  const generation = process.env.SANDBOX_HOST_GENERATION?.trim()
  if (!generation) {
    throw new Error('SANDBOX_HOST_GENERATION is required in sandbox host mode')
  }
  if (!process.send) {
    throw new Error('Sandbox Host requires a child-process IPC channel')
  }
  return generation
}

export async function runSandboxMode(): Promise<() => Promise<void>> {
  const generation = requireHostGeneration()
  const startedAt = Date.now()
  const runs = new Map<string, ActiveRun>()
  const eventLoop = monitorEventLoopDelay({ resolution: 20 })
  eventLoop.enable()
  let draining = false
  let stopping = false

  const send = (message: SandboxHostEvent): void => {
    if (!process.send || !process.connected) {
      return
    }
    process.send({
      ...message,
      protocolVersion: SANDBOX_HOST_PROTOCOL_VERSION,
      generation,
    })
  }

  const maybeExitAfterDrain = (): void => {
    if (draining && runs.size === 0 && !stopping) {
      stopping = true
      process.exit(0)
    }
  }

  const handleProcessFault = (error: unknown, kind: 'uncaughtException' | 'unhandledRejection'): void => {
    if (stopping) {
      return
    }
    const normalized = error instanceof Error ? error : new Error(String(error))
    send({
      type: 'run.diagnostic',
      message: `Sandbox Host ${kind} captured; host remains alive: ${normalized.message}`,
    })
    for (const [runId, run] of runs) {
      send({
        type: 'run.diagnostic',
        runId,
        message: `Sandbox run aborted after Sandbox Host ${kind}: ${normalized.message}`,
      })
      run.session.abort(normalized)
    }
  }

  const startRun = (message: Extract<SandboxAgentToHostMessage, { type: 'run.start' }>): void => {
    if (draining || stopping) {
      send({ type: 'run.diagnostic', runId: message.runId, message: 'Sandbox Host is draining' })
      return
    }
    if (runs.has(message.runId)) {
      send({ type: 'run.diagnostic', runId: message.runId, message: 'Duplicate sandbox runId' })
      return
    }

    const runReceivedAt = Date.now()
    console.debug(`[sandbox] run=${message.runId} received activeRuns=${runs.size + 1}`)
    send({ type: 'run.phase', runId: message.runId, phase: 'run_received', timestamp: runReceivedAt })

    const session = new SandboxRunSession({
      runId: message.runId,
      payload: message.payload,
      emit: (event) => {
        if (event.type === 'log') {
          send({ type: 'run.log', runId: message.runId, level: event.level, message: event.message })
        }
        else if (event.type === 'phase') {
          console.debug(`[sandbox] run=${message.runId} phase=${event.phase} elapsedMs=${Date.now() - runReceivedAt}`)
          send({ type: 'run.phase', runId: message.runId, phase: event.phase, timestamp: event.timestamp })
        }
        else {
          send({
            type: 'rpc.llm.request',
            runId: message.runId,
            requestId: event.requestId,
            request: event.request,
          })
        }
      },
    })

    send({ type: 'run.started', runId: message.runId })
    const finished = session.run()
      .then((result) => {
        console.debug(`[sandbox] run=${message.runId} finished status=${result.status} durationMs=${Date.now() - runReceivedAt}`)
        send({ type: 'run.phase', runId: message.runId, phase: 'run_finished', timestamp: Date.now() })
        send({ type: 'run.finished', runId: message.runId, result })
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : String(error)
        send({
          type: 'run.finished',
          runId: message.runId,
          result: {
            status: 'failed',
            exitCode: 1,
            artifactPaths: [],
            storageChanges: [],
            error: messageText,
          },
        })
      })
      .finally(() => {
        runs.delete(message.runId)
        maybeExitAfterDrain()
      })

    runs.set(message.runId, { session, finished })
  }

  const onMessage = (raw: unknown): void => {
    let message: SandboxAgentToHostMessage
    try {
      message = parseSandboxAgentToHostMessage(raw)
    }
    catch (error) {
      send({ type: 'run.diagnostic', message: `Invalid Sandbox Host message: ${error instanceof Error ? error.message : String(error)}` })
      return
    }

    if (message.generation !== generation) {
      send({ type: 'run.diagnostic', message: `Ignored message for stale generation ${message.generation}` })
      return
    }

    switch (message.type) {
      case 'run.start':
        startRun(message)
        break
      case 'run.abort':
        runs.get(message.runId)?.session.abort(message.reason)
        break
      case 'rpc.llm.response':
        runs.get(message.runId)?.session.handleLlmResponse(message.requestId, message)
        break
      case 'host.drain':
        draining = true
        maybeExitAfterDrain()
        break
      case 'host.shutdown':
        void shutdown(message.reason).finally(() => process.exit(0))
        break
    }
  }

  const heartbeat = setInterval(() => {
    const memory = process.memoryUsage()
    send({
      type: 'host.heartbeat',
      pid: process.pid,
      timestamp: Date.now(),
      activeRuns: runs.size,
      memory: { rss: memory.rss, heapUsed: memory.heapUsed, external: memory.external },
      eventLoopDelayMs: Number((eventLoop.max / 1e6).toFixed(1)),
    })
    eventLoop.reset()
  }, HEARTBEAT_INTERVAL_MS)
  heartbeat.unref()

  const uninstallProcessFaultGuards = installProcessFaultGuards({
    label: `sandbox:${generation}`,
    onFault: fault => handleProcessFault(fault.error, fault.kind),
  })

  process.on('message', onMessage)

  async function shutdown(reason: unknown = 'shutdown'): Promise<void> {
    if (stopping) {
      return
    }
    stopping = true
    draining = true
    uninstallProcessFaultGuards()
    clearInterval(heartbeat)
    eventLoop.disable()
    process.off('message', onMessage)
    for (const run of runs.values()) {
      run.session.abort(reason)
    }
    await Promise.race([
      Promise.allSettled(Array.from(runs.values(), run => run.finished)),
      new Promise<void>(resolve => setTimeout(resolve, SHUTDOWN_GRACE_MS)),
    ])
  }

  send({ type: 'host.ready', pid: process.pid, startedAt })
  return () => shutdown('signal')
}
