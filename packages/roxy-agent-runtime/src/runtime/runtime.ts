import { randomUUID } from 'node:crypto'
import type { ZodType } from 'zod'
import type {
  Agent,
  AgentInput,
  AgentDefinition,
  AgentResponse,
  AgentStreamEvent,
  ApprovalResult,
  ClarificationResult,
  IAgentManager,
  ManagedAgentHandle,
  StructuredAgent,
  StructuredOutputOptions,
} from '../core/interfaces.ts'
import { ROOT_AGENT_PATH } from '../core/contracts/agent-manager.ts'
import { replayIntoMemory } from '../memory/replay.ts'
import { AgentImpl } from './agent.ts'
import { buildAgentGraph } from './graph.ts'
import { assemblePlugins, mergeHooks } from './plugin_assembler.ts'

/**
 * Public lifecycle owner for one assembled Agent session.
 *
 * Use {@link AgentRuntime.create}; setup is asynchronous because plugins and
 * durable session replay must complete before the instance can be invoked.
 */
export class AgentRuntime implements Agent {
  readonly id: string
  readonly sessionId: string
  /** Manager owning this agent's tree, when the host registered one. */
  readonly agentManager: IAgentManager | undefined

  private constructor(
    private readonly agent: AgentImpl,
    agentManager: IAgentManager | undefined,
    private readonly isRoot: boolean,
  ) {
    this.id = agent.id
    this.sessionId = agent.sessionId
    this.agentManager = agentManager
  }

  static async create(definition: AgentDefinition): Promise<AgentRuntime> {
    const sessionId = definition.sessionId ?? randomUUID()
    const agentId = definition.agentId ?? randomUUID()

    const plugins = await assemblePlugins(definition.plugins ?? [], definition.logger, definition.clarification)
    for (const tool of plugins.tools) {
      definition.tools.add(tool.descriptor, tool.handler)
    }
    const hooks = mergeHooks([...plugins.hooks, ...(definition.hooks ? [definition.hooks] : [])])

    if (definition.sessionStore) {
      const replayed = await replayIntoMemory(definition.sessionStore, definition.memory, sessionId)
      if (replayed.isNew) {
        await definition.sessionStore.append(sessionId, {
          type: 'session_start',
          sessionId,
          createdAt: Date.now(),
        })
      }
    }

    // Agent tree: a root agent owns a manager (registers /root and cascades
    // dispose); a managed child reuses its parent's manager under a
    // parent-assigned path. Agents assembled without a manager have no tree
    // identity and no spawn/list/wait tools.
    const agentManager = definition.agentManager
    const agentPath = definition.agentPath ?? (agentManager ? ROOT_AGENT_PATH : undefined)
    const isRoot = agentPath === ROOT_AGENT_PATH && !!agentManager

    const graph = buildAgentGraph({
      model: definition.model,
      maxTokens: definition.maxTokens,
      systemPrompt: definition.systemPrompt,
      provider: definition.provider,
      tools: definition.tools,
      memory: definition.memory,
      hitl: definition.hitl,
      recorder: definition.recorder,
      logger: definition.logger,
      toolContext: definition.toolContext,
      clarification: definition.clarification,
      hooks,
      contributors: [...(definition.contributors ?? []), ...plugins.contributors],
      middleware: [...(definition.middleware ?? []), ...plugins.middleware],
      memoryLifecycles: plugins.memoryLifecycles,
      trimPolicy: definition.trimPolicy,
      summarizer: definition.summarizer,
      contextWindowTokens: definition.contextWindowTokens ?? definition.provider.contextWindowTokens,
      triggerTokens: definition.triggerTokens,
      sessionStore: definition.sessionStore,
      skills: definition.skills,
      agentPath,
      agentManager,
    })

    const agent = new AgentImpl(graph, {}, agentId, sessionId)
    for (const callback of plugins.disposeCallbacks) {
      agent.addDisposeCallback(callback)
    }
    if (definition.onDispose) {
      agent.addDisposeCallback(definition.onDispose)
    }
    if (isRoot && agentManager) {
      const rootHandle: ManagedAgentHandle = {
        invoke: (message, signal) => agent.invoke(message, signal),
        dispose: () => agent.dispose(),
      }
      agentManager.registerRoot(rootHandle)
      // Tearing down the root agent tears down the whole tree.
      agent.addDisposeCallback(() => agentManager.dispose())
    }
    return new AgentRuntime(agent, agentManager, isRoot)
  }

  async invoke(input: AgentInput, signal?: AbortSignal): Promise<AgentResponse> {
    const stopTree = () => this.cancelRootTree(signal?.reason)
    if (signal?.aborted) {
      stopTree()
    } else {
      signal?.addEventListener('abort', stopTree, { once: true })
    }
    try {
      return await this.agent.invoke(input, signal)
    } finally {
      signal?.removeEventListener('abort', stopTree)
    }
  }

  stream(input: AgentInput, signal?: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const agent = this.agent
    const stopTree = () => this.cancelRootTree(signal?.reason)
    return {
      async *[Symbol.asyncIterator]() {
        if (signal?.aborted) {
          stopTree()
        } else {
          signal?.addEventListener('abort', stopTree, { once: true })
        }
        try {
          yield* agent.stream(input, signal)
        } finally {
          signal?.removeEventListener('abort', stopTree)
        }
      },
    }
  }

  structured<T>(schema: ZodType<T>, options?: StructuredOutputOptions): StructuredAgent<T> {
    return this.agent.structured(schema, options)
  }

  resume(traceId: string, decision: ApprovalResult): void {
    this.agent.resume(traceId, decision)
  }

  clarify(traceId: string, result: ClarificationResult): void {
    this.agent.clarify(traceId, result)
  }

  cancelPending(reason?: string): void {
    this.agent.cancelPending(reason)
  }

  dispose(): Promise<void> {
    return this.agent.dispose()
  }

  private cancelRootTree(reason?: unknown): void {
    if (this.isRoot) {
      this.agentManager?.cancelSubtree(ROOT_AGENT_PATH, reason)
    }
  }
}
