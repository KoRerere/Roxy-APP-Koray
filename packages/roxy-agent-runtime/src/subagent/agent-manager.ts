import type {
  AgentManagerOptions,
  AgentLifecycleEvent,
  AgentManagerErrorCode,
  AgentManagerErrorShape,
  AgentNodeSnapshot,
  AgentNodeStatus,
  AgentPath,
  IAgentManager,
  ManagedAgentBuildOptions,
  ManagedAgentHandle,
  Message,
  SpawnAgentReceipt,
  SpawnAgentRequest,
  SubAgentSpec,
  WaitAgentResult,
} from '../core/interfaces.ts'
import { agentNameSchema, ROOT_AGENT_PATH } from '../core/contracts/agent-manager.ts'

/** Internal mutable record for one tree node. Snapshots are projected from it. */
interface NodeRecord {
  snapshot: AgentNodeSnapshot
  parentPath?: AgentPath
  handle?: ManagedAgentHandle
  abortController: AbortController
  completionPromise: Promise<void>
  resolveCompletion: () => void
}

const TERMINAL_STATUSES: ReadonlySet<AgentNodeStatus> = new Set(['completed', 'failed', 'cancelled'])
const DEFAULT_MAX_CONCURRENT_SUBAGENTS = 10

function isTerminal(node: NodeRecord): boolean {
  return TERMINAL_STATUSES.has(node.snapshot.status)
}

/** Extract the last assistant text from a child response, mirroring the `task` tool. */
function lastAssistantText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== 'assistant') {
      continue
    }
    if (typeof m.content === 'string') {
      if (m.content.length > 0) {
        return m.content
      }
      continue
    }
    const text = m.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (text.length > 0) {
      return text
    }
  }
  return ''
}

function isWithin(path: AgentPath, ancestor: AgentPath): boolean {
  return path === ancestor || path.startsWith(ancestor + '/')
}

export class AgentManagerError extends Error implements AgentManagerErrorShape {
  readonly code: AgentManagerErrorCode
  readonly active?: number
  readonly limit?: number

  constructor(shape: AgentManagerErrorShape) {
    super(shape.message)
    this.name = 'AgentManagerError'
    this.code = shape.code
    this.active = shape.active
    this.limit = shape.limit
  }
}

/**
 * Default {@link IAgentManager} implementation.
 *
 * Owns the named agent tree for one root session. Spawns children in the
 * background (builder -> invoke), records immutable terminal snapshots, waits
 * for subtrees to settle with dynamic re-checking (descendants created during a
 * wait are included), and cascades cancellation/disposal from the root.
 *
 * State machine:
 *   starting -> running -> completed
 *                ├──────> failed
 *                └──────> cancelled
 *
 * Terminal transitions are idempotent: a late abort, builder error, or dispose
 * error never overwrites an established final status. Cleanup errors are
 * swallowed (logged via onEvent) so a successful business result stays
 * `completed`.
 */
export class AgentManager implements IAgentManager {
  private readonly nodes = new Map<AgentPath, NodeRecord>()
  private rootHandle?: ManagedAgentHandle
  private disposed = false
  private readonly waiters = new Set<() => void>()
  private readonly maxConcurrentSubagents: number
  private activeSubagents = 0

  constructor(private readonly options: AgentManagerOptions) {
    const limit = options.maxConcurrentSubagents ?? DEFAULT_MAX_CONCURRENT_SUBAGENTS
    if (!Number.isInteger(limit) || limit < 1 || limit > DEFAULT_MAX_CONCURRENT_SUBAGENTS) {
      throw new RangeError(
        `AgentManager: maxConcurrentSubagents must be an integer between 1 and ${DEFAULT_MAX_CONCURRENT_SUBAGENTS}`,
      )
    }
    this.maxConcurrentSubagents = limit
  }

  registerRoot(agent: ManagedAgentHandle): void {
    if (this.nodes.has(ROOT_AGENT_PATH)) {
      return
    }
    const abortController = new AbortController()
    let resolveCompletion: () => void
    const completionPromise = new Promise<void>((resolve) => {
      resolveCompletion = resolve
    })
    const node: NodeRecord = {
      snapshot: {
        path: ROOT_AGENT_PATH,
        name: 'root',
        agentType: 'root',
        status: 'running',
        startedAt: Date.now(),
      },
      abortController,
      handle: agent,
      completionPromise,
      resolveCompletion: () => resolveCompletion!(),
    }
    this.nodes.set(ROOT_AGENT_PATH, node)
    this.rootHandle = agent
    this.emit('agent_registered', node)
  }

  async spawn(request: SpawnAgentRequest): Promise<SpawnAgentReceipt> {
    if (this.disposed) {
      throw new AgentManagerError({
        code: 'agent_manager_disposed',
        message: 'spawn_agent: agent manager is disposed.',
      })
    }
    // Validate caller + agent_type + name synchronously, then atomically reserve the path.
    const parent = this.nodes.get(request.parentPath)
    if (!parent) {
      throw new Error(`spawn: unknown parent path '${request.parentPath}'`)
    }
    if (isTerminal(parent)) {
      throw new AgentManagerError({
        code: 'agent_parent_terminal',
        message: `spawn_agent: parent agent '${request.parentPath}' is already ${parent.snapshot.status}.`,
      })
    }
    const spec = this.options.specs.get(request.agentType)
    if (!spec) {
      throw new Error(`spawn: unknown agent_type '${request.agentType}'`)
    }
    const nameParse = agentNameSchema.safeParse(request.name)
    if (!nameParse.success) {
      throw new Error(`spawn: invalid name '${request.name}' (must be snake_case)`)
    }
    const childPath = `${request.parentPath}/${request.name}`
    if (this.nodes.has(childPath)) {
      throw new AgentManagerError({
        code: 'agent_already_exists',
        message: `spawn_agent: agent already exists at '${childPath}'.`,
      })
    }
    if (this.activeSubagents >= this.maxConcurrentSubagents) {
      throw new AgentManagerError({
        code: 'agent_concurrency_limit_reached',
        message:
          `spawn_agent: subagent concurrency limit reached ` +
          `(${this.activeSubagents}/${this.maxConcurrentSubagents} active for this session); ` +
          'wait for an existing subagent to finish before spawning another.',
        active: this.activeSubagents,
        limit: this.maxConcurrentSubagents,
      })
    }

    // Reserve the node (starting) synchronously so concurrent same-name spawns collide here.
    this.activeSubagents++
    const abortController = new AbortController()
    let resolveCompletion: () => void
    const completionPromise = new Promise<void>((resolve) => {
      resolveCompletion = resolve
    })
    const node: NodeRecord = {
      snapshot: {
        path: childPath,
        parentPath: request.parentPath,
        name: request.name,
        agentType: request.agentType,
        status: 'starting',
        startedAt: Date.now(),
        cleanupSettled: false,
      },
      parentPath: request.parentPath,
      abortController,
      completionPromise,
      resolveCompletion: () => resolveCompletion!(),
    }
    this.nodes.set(childPath, node)
    this.emit('agent_registered', node)
    this.notifyWaiters()

    // Background build + invoke. callerSignal is intentionally NOT forwarded:
    // aborting the caller's turn never cancels the child.
    this.runChild(node, spec, request.message, request.dirIds ?? [], abortController.signal).catch(() => {
      // runChild owns all error convergence; this catch only prevents detached rejections.
    })

    return {
      path: childPath,
      name: request.name,
      agentType: request.agentType,
      status: 'starting',
    }
  }

  list(pathPrefix: AgentPath = ROOT_AGENT_PATH): AgentNodeSnapshot[] {
    const result: AgentNodeSnapshot[] = []
    for (const node of this.nodes.values()) {
      if (isWithin(node.snapshot.path, pathPrefix)) {
        result.push({ ...node.snapshot })
      }
    }
    result.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    return result
  }

  async wait(callerPath: AgentPath, timeoutMs?: number, signal?: AbortSignal): Promise<WaitAgentResult> {
    const stopController = new AbortController()
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const stopForTimeout = () => {
      timedOut = true
      stopController.abort()
    }
    const stopForCaller = () => stopController.abort()
    if (timeoutMs !== undefined) {
      timer = setTimeout(stopForTimeout, timeoutMs)
    }
    signal?.addEventListener('abort', stopForCaller, { once: true })

    try {
      await this.awaitSubtreeSettled(callerPath, stopController.signal)
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
      signal?.removeEventListener('abort', stopForCaller)
    }

    return {
      timedOut,
      agents: this.list(callerPath),
      runningPaths: this.nonTerminalDescendants(callerPath).map((n) => n.snapshot.path),
    }
  }

  cancelSubtree(path: AgentPath, reason?: unknown): void {
    for (const node of this.nodes.values()) {
      if (!isWithin(node.snapshot.path, path)) {
        continue
      }
      if (isTerminal(node)) {
        continue
      }
      this.setCancelled(node)
      node.abortController.abort(reason)
    }
    this.notifyWaiters()
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.cancelSubtree(ROOT_AGENT_PATH, 'manager disposed')
    const pending = [...this.nodes.values()]
      .filter((node) => node.snapshot.path !== ROOT_AGENT_PATH && node.snapshot.cleanupSettled !== true)
      .map((node) => node.completionPromise)
    await Promise.allSettled(pending)
    if (this.rootHandle) {
      try {
        await this.rootHandle.dispose()
      } catch {
        // Cleanup error must not surface after dispose; snapshot already terminal.
      }
      this.rootHandle = undefined
    }
  }

  // -------------------------------------------------------------------------
  // Internal: background child lifecycle
  // -------------------------------------------------------------------------

  private async runChild(
    node: NodeRecord,
    spec: SubAgentSpec,
    message: string,
    dirIds: string[],
    signal: AbortSignal,
  ): Promise<void> {
    let handle: ManagedAgentHandle | undefined
    try {
      const buildOptions: ManagedAgentBuildOptions = {
        manager: this,
        path: node.snapshot.path,
        parentPath: node.parentPath ?? ROOT_AGENT_PATH,
        name: node.snapshot.name,
        agentType: node.snapshot.agentType,
        message,
        dirIds,
        signal,
      }
      handle = await this.options.builder(spec, buildOptions)
      node.handle = handle
      if (isTerminal(node)) {
        return
      }
      this.setRunning(node)
      let report: string
      if (handle.stream) {
        const textPartsByCall = new Map<number, string[]>()
        let lastTextCallIndex = -1
        for await (const event of handle.stream(message, signal)) {
          this.options.onStream?.(node.snapshot.path, event)
          if (event.type === 'text') {
            lastTextCallIndex = Math.max(lastTextCallIndex, event.callIndex)
            const parts = textPartsByCall.get(event.callIndex) ?? []
            parts.push(event.delta)
            textPartsByCall.set(event.callIndex, parts)
          }
        }
        report = lastTextCallIndex >= 0 ? (textPartsByCall.get(lastTextCallIndex)?.join('') ?? '') : ''
      } else {
        const response = await handle.invoke(message, signal)
        report = lastAssistantText(response.messages)
      }
      if (isTerminal(node)) {
        return
      }
      this.setCompleted(node, report)
    } catch (err) {
      if (!isTerminal(node)) {
        if (signal.aborted) {
          this.setCancelled(node)
        } else {
          this.setFailed(node, err)
        }
      }
    } finally {
      if (handle) {
        const cleanupError = await this.disposeHandle(handle)
        if (cleanupError) {
          node.snapshot.cleanupError = cleanupError
        }
      }
      node.handle = undefined
      node.snapshot.cleanupSettled = true
      this.activeSubagents--
      node.resolveCompletion()
      this.notifyWaiters()
    }
  }

  private async disposeHandle(handle: ManagedAgentHandle): Promise<string | undefined> {
    try {
      await handle.dispose()
      return undefined
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  private setRunning(node: NodeRecord): void {
    if (isTerminal(node)) {
      return
    }
    node.snapshot.status = 'running'
    this.emit('agent_started', node)
  }

  private setCompleted(node: NodeRecord, report: string): void {
    if (isTerminal(node)) {
      return
    }
    node.snapshot.status = 'completed'
    node.snapshot.finishedAt = Date.now()
    node.snapshot.report = report
    this.emit('agent_completed', node)
    this.notifyWaiters()
  }

  private setFailed(node: NodeRecord, err: unknown): void {
    if (isTerminal(node)) {
      return
    }
    node.snapshot.status = 'failed'
    node.snapshot.finishedAt = Date.now()
    node.snapshot.error = err instanceof Error ? err.message : String(err)
    this.emit('agent_failed', node)
    this.notifyWaiters()
  }

  private setCancelled(node: NodeRecord): void {
    if (isTerminal(node)) {
      return
    }
    node.snapshot.status = 'cancelled'
    node.snapshot.finishedAt = Date.now()
    this.emit('agent_cancelled', node)
    this.notifyWaiters()
  }

  // -------------------------------------------------------------------------
  // Internal: subtree wait
  // -------------------------------------------------------------------------

  private nonTerminalDescendants(path: AgentPath): NodeRecord[] {
    const prefix = path + '/'
    const result: NodeRecord[] = []
    for (const node of this.nodes.values()) {
      if (node.snapshot.path.startsWith(prefix) && !isTerminal(node)) {
        result.push(node)
      }
    }
    return result
  }

  private awaitSubtreeSettled(callerPath: AgentPath, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      const step = () => {
        if (signal.aborted) {
          resolve()
          return
        }
        const nonTerminal = this.nonTerminalDescendants(callerPath)
        if (nonTerminal.length === 0) {
          resolve()
          return
        }
        let woken = false
        const wake = () => {
          if (woken) {
            return
          }
          woken = true
          this.waiters.delete(wake)
          signal.removeEventListener('abort', wake)
          step()
        }
        this.waiters.add(wake)
        signal.addEventListener('abort', wake, { once: true })
        Promise.race(nonTerminal.map((n) => n.completionPromise)).then(wake)
      }
      step()
    })
  }

  private notifyWaiters(): void {
    // Snapshot before iteration: a waiter's step() may add or remove waiters.
    const snapshot = Array.from(this.waiters)
    for (const w of snapshot) {
      w()
    }
  }

  private emit(type: AgentLifecycleEvent['type'], node: NodeRecord): void {
    try {
      this.options.onEvent?.({
        type,
        agentPath: node.snapshot.path,
        parentAgentPath: node.parentPath,
        agentName: node.snapshot.name,
        agentType: node.snapshot.agentType,
        status: node.snapshot.status,
        startedAt: node.snapshot.startedAt,
        finishedAt: node.snapshot.finishedAt,
        report: node.snapshot.report,
        error: node.snapshot.error,
      })
    } catch {
      // Observability must not change the child business result or cleanup.
    }
  }
}
