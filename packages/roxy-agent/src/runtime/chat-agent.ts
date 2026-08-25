import type { RuntimeCollectedFile } from './file-collector'
import type { AgentRunEvent } from '@roxy/shared/channel'
import type {
  Agent,
  AgentInput,
  AgentLifecycleEvent,
  AgentStreamEvent,
  IHITLHandler,
  ManagedAgentBuilder,
  Message,
  SkillManifest,
  ToolDescriptor,
  ToolHandler,
} from 'roxy-agent-runtime'
import path from 'node:path'
import {
  AgentManager,
  AgentRuntime,
  CommandPermissions,
  createLogger,
  DelegateHitlHandler,
  InMemoryProvider,
  InMemoryTrajectoryRecorder,
  listAgentsTool,
  metricsPlugin,
  OpenAIResponsesProvider,
  registerBuiltinTools,
  spawnAgentTool,
  SuspendingClarificationHandler,
  ToolRegistry,
  waitAgentTool,
} from 'roxy-agent-runtime'
import { aiAgentResponsesUrl, aiAgentToken, env } from '@/config'
import { withAgentPath } from '@/core/agent-events/events'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { mcpManager } from '@/core/mcp/mcpManager'
import { createProfileSchedulerPlugin } from '@/core/profiles/profileScheduler'
import { executionCenter } from '@/core/registry/executionCenter'
import { getSkillManager } from '@/core/skillManager'
import { agentPaths } from '@/core/storage/agentPaths'
import { DEFAULT_COMMAND_ALLOW_PATTERNS, DEFAULT_COMMAND_DENY_PATTERNS } from './command-permissions'
import { createRuntimeCompactionOptions, DEEPSEEK_CONTEXT_WINDOW_TOKENS } from './compaction'
import { RuntimeEventPublisher } from './event-publisher'
import { createRuntimeFileCollector } from './file-collector'
import { filterBuiltinToolsForHostCapabilities, getHostToolCapabilities } from './host-tools'
import { ensureMemoryIndex, loadMemoryIndex, shouldLoadMemoryIndex } from './memory-index'
import { createRuntimeFilesystemMiddleware } from './middleware/filesystem'
import { createRuntimeContextMessages } from './prompt-context'
import { getRuntimeModel } from './provider'
import { withRuntimeNetworkRetry } from './retrying-provider'
import { RoxyRolloutStore } from './rollout'
import {
  createGeneralPurposeAgent,
  GENERAL_PURPOSE_AGENT_SPEC,
  generalPurposeAgentResourceKey,
} from './subagents/general-purpose-subagent'
import { createRuntimeSystemPrompt } from './system-prompt'
import { registerRuntimeScriptTools } from './tools'

interface RuntimeTool { descriptor: ToolDescriptor, handler: ToolHandler }

export function shouldEnableMetricsPlugin(envType: string | undefined): boolean {
  return envType !== 'production'
}

async function listRuntimeSkills(): Promise<SkillManifest[]> {
  return getSkillManager().listRuntimeSkillManifests()
}

/** External approval policy: runtime emits hitl_pending, while chatService owns the UI gate. */
class ChatHitlHandler extends DelegateHitlHandler implements IHITLHandler {
  constructor(private fullAccess: boolean, commandPermissions: CommandPermissions) {
    super([], { commandPermissions })
  }

  enableFullAccess(): void {
    this.fullAccess = true
  }

  needsApproval(tool: ToolDescriptor, input?: unknown): boolean {
    return !this.fullAccess && super.needsApproval(tool, input)
  }

  requestApproval() {
    return Promise.resolve({ decision: 'approve' as const })
  }
}

function addTool(registry: ToolRegistry, entry: RuntimeTool): void {
  registry.add(entry.descriptor, entry.handler)
}

export interface RuntimeChatAgentOptions {
  conversationId: string
  executionId: string
  runId?: string
  turnId: string
  fullAccess?: boolean
  commandAllowPatterns?: string[]
  commandDenyPatterns?: string[]
  signal?: AbortSignal
  taskMonitorTaskId?: string
  allowedDirIds?: string[]
  retryHandler?: () => void
  writer?: (event: AgentRunEvent) => void
}

export async function createRuntimeChatAgent(options: RuntimeChatAgentOptions): Promise<{
  agent: Agent
  setFullAccess: () => void
  createInput: (
    content: Message['content'],
    trailingMessages?: Message[],
    metadata?: Message['metadata'],
  ) => AgentInput
  destroy: () => Promise<void>
  consumeFiles: () => RuntimeCollectedFile[]
}> {
  const workerId = `chat_${options.conversationId}`
  let playwrightCreated = false
  const workspaceDir = agentPaths.sessionDir(options.conversationId)
  const fileCollector = createRuntimeFileCollector({
    artifactRoots: [agentPaths.sessionBrowserDir(options.conversationId)],
    displayRoot: workspaceDir,
  })
  // Full access is the existing UI mode. Otherwise the frontend approval gate
  // follows the standard ToolAnnotations policy for every registered tool.
  const commandPermissions = new CommandPermissions({
    allow: options.commandAllowPatterns ?? [...DEFAULT_COMMAND_ALLOW_PATTERNS],
    deny: options.commandDenyPatterns ?? [...DEFAULT_COMMAND_DENY_PATTERNS],
  })
  const hitl = new ChatHitlHandler(Boolean(options.fullAccess), commandPermissions)
  const clarification = new SuspendingClarificationHandler()
  const rollout = new RoxyRolloutStore(
    path.dirname(agentPaths.sessionDir(options.conversationId)),
    sessionId => agentPaths.sessionRollout(sessionId),
  )
  const memory = new InMemoryProvider()
  let pendingMemoryIndex: string | undefined

  try {
    if (options.signal?.aborted) {
      throw new DOMException('User cancelled', 'AbortError')
    }

    const existingRollout = await rollout.read(options.conversationId)
    try {
      await ensureMemoryIndex(agentPaths.memoryIndexFile)
      if (shouldLoadMemoryIndex(existingRollout)) {
        pendingMemoryIndex = await loadMemoryIndex(agentPaths.memoryIndexFile)
      }
    }
    catch (error) {
      console.warn(
        `[memory] Failed to initialize ${agentPaths.memoryDir}:`,
        error instanceof Error ? error.message : String(error),
      )
    }

    await mcpManager.createProfileBinding({
      bindingId: workerId,
      executionId: options.executionId,
      conversationId: options.conversationId,
      allowedDirIds: options.allowedDirIds,
      collector: fileCollector,
      owner: {
        runId: options.runId ?? options.executionId,
        taskId: options.taskMonitorTaskId,
        sourceType: options.allowedDirIds ? 'task' : 'chat',
      },
    })
    playwrightCreated = true

    const mcpTools = await mcpManager.getToolsForBinding(workerId, true, { includeFaq: false })
    const skills = await listRuntimeSkills()
    const { model, headers, modelInfo } = await getRuntimeModel({
      conversationId: options.conversationId,
      turnId: options.turnId,
      signal: options.signal,
    })

    const registry = new ToolRegistry()
    const generalPurposeAgentSpecs = [GENERAL_PURPOSE_AGENT_SPEC]
    const managedBuilder: ManagedAgentBuilder = async (spec, childOptions) => {
      const child = await createGeneralPurposeAgent({
        agentPath: childOptions.path,
        manager: childOptions.manager,
        message: childOptions.message,
        dirIds: childOptions.dirIds,
        conversationId: options.conversationId,
        executionId: options.executionId,
        mainPlaywrightWorkerId: workerId,
        turnId: options.turnId,
        model,
        apiFormat: modelInfo.api_format,
        apiKey: aiAgentToken,
        baseURL: aiAgentResponsesUrl,
        defaultHeaders: headers,
        maxTokens: spec.maxTokens,
        rootAllowedDirIds: options.allowedDirIds,
        inheritedToolNames: spec.tools,
        parentTools: registry,
        workspaceDir: path.join(workspaceDir, 'agents'),
        fileCollector,
        sessionStore: rollout,
        writer: options.writer,
        retryHandler: options.retryHandler,
        taskMonitorTaskId: options.taskMonitorTaskId,
        toolContext: {
          turnId: options.turnId,
          taskMonitorTaskId: options.taskMonitorTaskId,
        },
        skills,
      })
      await rollout.append(options.conversationId, {
        type: 'subagent_delegated',
        childSessionId: child.agent.sessionId,
        name: childOptions.name,
        ts: Date.now(),
      })
      return {
        invoke: (_message, signal) => child.invoke(signal),
        stream: (_message, signal) => child.stream(signal),
        dispose: () => child.dispose(),
      }
    }

    const agentExecutionId = (agentPath: string) => generalPurposeAgentResourceKey(options.conversationId, agentPath)
    let agentManager!: AgentManager
    const childPublishers = new Map<string, RuntimeEventPublisher>()
    const onAgentStream = (agentPath: string, event: AgentStreamEvent) => {
      let publisher = childPublishers.get(agentPath)
      if (!publisher) {
        publisher = new RuntimeEventPublisher(options.writer ?? (() => {}), {
          emitDone: false,
          agentPath,
        })
        childPublishers.set(agentPath, publisher)
      }
      publisher.handle(event)
    }

    const onAgentLifecycle = (event: AgentLifecycleEvent) => {
      options.writer?.(streamEvents.agentLifecycle({
        agentPath: event.agentPath,
        parentAgentPath: event.parentAgentPath,
        agentName: event.agentName,
        agentType: event.agentType,
        status: event.status,
        startedAt: event.startedAt,
        finishedAt: event.finishedAt,
        report: event.report,
        error: event.error,
      }))
      if (event.agentPath === '/root') {
        return
      }

      const executionId = agentExecutionId(event.agentPath)
      if (event.type === 'agent_registered') {
        executionCenter.register({
          id: executionId,
          source: 'worker',
          conversationId: options.conversationId,
          parentId: event.parentAgentPath === '/root'
            ? (options.runId ?? options.turnId)
            : event.parentAgentPath ? agentExecutionId(event.parentAgentPath) : (options.runId ?? options.turnId),
          title: event.agentName,
          metadata: { agentPath: event.agentPath, agentType: event.agentType },
          cancel: () => {
            agentManager.cancelSubtree(event.agentPath, 'user')
            return true
          },
        })
      }
      else if (event.type === 'agent_started') {
        executionCenter.start(executionId)
      }
      else if (event.type === 'agent_completed') {
        executionCenter.finish(executionId, 'completed', { report: event.report })
      }
      else if (event.type === 'agent_cancelled') {
        executionCenter.finish(executionId, 'cancelled')
      }
      else if (event.type === 'agent_failed') {
        executionCenter.finish(executionId, 'failed', { error: event.error })
      }
    }
    agentManager = new AgentManager({
      specs: new Map(generalPurposeAgentSpecs.map(spec => [spec.agentType, spec])),
      builder: managedBuilder,
      onEvent: onAgentLifecycle,
      onStream: onAgentStream,
    })

    const hostToolCapabilities = getHostToolCapabilities()
    for (const builtin of filterBuiltinToolsForHostCapabilities(registerBuiltinTools({
      enableTodos: true,
      commandPermissions,
      hitl,
      clarificationHandler: clarification,
      customToolNames: ['apply_patch'],
    }), hostToolCapabilities)) {
      addTool(registry, builtin)
    }

    // Browser MCP calls remain directly executable in phase one; approval is
    // reserved for local mutation and script execution.
    for (const tool of mcpTools) {
      addTool(registry, tool)
    }
    registerRuntimeScriptTools(registry, {
      workspaceDir,
      fileCollector,
      taskMonitorTaskId: options.taskMonitorTaskId,
      executionId: options.executionId,
    })
    for (const tool of [spawnAgentTool({ specs: generalPurposeAgentSpecs }), listAgentsTool(), waitAgentTool()]) {
      addTool(registry, tool)
    }

    const sessionId = options.conversationId
    const runtimeProvider = withRuntimeNetworkRetry(new OpenAIResponsesProvider({
      model,
      apiKey: aiAgentToken,
      baseURL: aiAgentResponsesUrl,
      defaultHeaders: headers,
      contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
      customToolNames: ['apply_patch'],
      // DeepSeek executes web search server-side through Responses API.
      // Keep it out of the local tool registry so the model does not receive
      // the legacy web_fetch HTTP tool as a competing implementation.
      additionalTools: [{ type: 'web_search' }],
    }), {
      onRetry: (event) => {
        options.retryHandler?.()
        options.writer?.(withAgentPath(streamEvents.retryEvent(event), '/root'))
      },
    })
    // Compaction summaries are plain text requests; keep server-side search
    // tools out of this auxiliary call to reduce protocol surface and cost.
    const summaryProvider = withRuntimeNetworkRetry(new OpenAIResponsesProvider({
      model,
      apiKey: aiAgentToken,
      baseURL: aiAgentResponsesUrl,
      defaultHeaders: headers,
      contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
    }), {
      onRetry: event => options.writer?.(withAgentPath(streamEvents.retryEvent(event), '/root')),
    })
    const compaction = createRuntimeCompactionOptions(summaryProvider, model)
    const modelMeta = (modelInfo?.meta ?? {}) as Record<string, unknown>
    const metricsDir = path.join(workspaceDir, 'metrics')
    const observabilityPlugins = shouldEnableMetricsPlugin(env.ENV_TYPE)
      ? [metricsPlugin({
          outputDir: metricsDir,
          pricing: {
            inputPerMillionTokens: numberMeta(modelMeta, 'input_price_per_million_tokens'),
            outputPerMillionTokens: numberMeta(modelMeta, 'output_price_per_million_tokens'),
            pointsPerCostUnit: numberMeta(modelMeta, 'points_per_cost_unit') ?? 1,
          },
        })]
      : []
    const agent = await AgentRuntime.create({
      sessionId,
      model,
      systemPrompt: createRuntimeSystemPrompt({
        apiFormat: modelInfo.api_format,
        hasRipgrep: hostToolCapabilities.hasRipgrep,
      }),
      provider: runtimeProvider,
      contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
      skills,
      memory,
      tools: registry,
      hitl,
      clarification,
      recorder: new InMemoryTrajectoryRecorder(),
      logger: createLogger({ scope: `chat:${options.conversationId}` }),
      sessionStore: rollout,
      agentManager,
      middleware: [createRuntimeFilesystemMiddleware({
        workspaceDir,
        additionalWriteRoots: [agentPaths.memoryDir],
        ignoredArtifactRoots: [agentPaths.memoryDir],
        collector: fileCollector,
      })],
      ...compaction,
      plugins: [...observabilityPlugins, createProfileSchedulerPlugin({
        ownerId: options.executionId,
        taskId: options.taskMonitorTaskId,
        workerId,
        conversationId: options.conversationId,
        allowedDirIds: options.allowedDirIds,
        releaseOnDispose: false,
        onProfileClosed: dirId => mcpManager.invalidateProfile(dirId),
      })],
      toolContext: {
        conversationId: options.conversationId,
        turnId: options.turnId,
        taskMonitorTaskId: options.taskMonitorTaskId,
        writer: options.writer,
        toolCall: { id: undefined },
      },
    })

    return {
      agent,
      setFullAccess: () => hitl.enableFullAccess(),
      createInput: (
        content: Message['content'],
        trailingMessages: Message[] = [],
        metadata?: Message['metadata'],
      ) => {
        const memoryIndex = pendingMemoryIndex
        pendingMemoryIndex = undefined
        const input: Message[] = [
          ...createRuntimeContextMessages({
            workingDirectory: workspaceDir,
            recordingPath: agentPaths.sessionRecordingLog(options.conversationId),
            memoryDirectory: agentPaths.memoryDir,
            memoryIndexFile: agentPaths.memoryIndexFile,
            ...(memoryIndex !== undefined ? { memoryIndex } : {}),
          }),
          { role: 'user', content, ...(metadata ? { metadata } : {}) },
        ]
        return trailingMessages.length > 0 ? { input, trailingMessages } : input
      },
      consumeFiles: fileCollector.consume,
      destroy: async () => {
        childPublishers.clear()
        await agent.dispose()
        if (playwrightCreated) {
          mcpManager.releaseProfileBinding(workerId)
          await mcpManager.releaseExecution(options.executionId)
        }
      },
    }
  }
  catch (error) {
    if (playwrightCreated) {
      mcpManager.releaseProfileBinding(workerId)
      await mcpManager.releaseExecution(options.executionId)
    }
    throw error
  }
}

function numberMeta(meta: Record<string, unknown>, key: string): number | undefined {
  const value = meta[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
