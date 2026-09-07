import type { RuntimeFileCollector } from '../file-collector'
import type { HostToolCapabilities } from '../host-tools'
import type { TaskReportWindowTracker } from '../tools/task-report-window-tracker'
import type { AiAgentModelApiFormat } from '@/api/agentApiClient'
import type { RuntimeMcpTool } from '@/core/mcp/runtimeMcpTool'
import type { AgentRunEvent } from '@roxy/shared/channel'
import type {
  Agent,
  AgentDefinition,
  AgentPath,
  AgentResponse,
  IAgentManager,
  ISessionStore,
  IToolRegistry,
  SkillManifest,
  SubAgentSpec,
} from 'roxy-agent-runtime'
import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  AgentRuntime,
  createLogger,
  FullAccessHandler,
  InMemoryProvider,
  InMemoryTrajectoryRecorder,
  mcpToolName,
  NullClarificationHandler,
  OpenAIResponsesProvider,
  registerBuiltinTools,
  ToolRegistry,
} from 'roxy-agent-runtime'
import { withAgentPath } from '@/core/agent-events/events'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { mcpManager } from '@/core/mcp/mcpManager'
import { playwrightMcpServerName } from '@/core/mcp/playwrightMcp'
import { createProfileSchedulerPlugin } from '@/core/profiles/profileScheduler'
import {
  filterBuiltinToolsForHostCapabilities,
  getHostToolCapabilities,
} from '../host-tools'
import { createRuntimeFilesystemMiddleware } from '../middleware/filesystem'
import { createGeneralPurposeAgentContextMessage, createRuntimeContextMessages } from '../prompt-context'
import { withRuntimeNetworkRetry } from '../retrying-provider'
import { RoxyRolloutStore } from '../rollout'
import { createGeneralPurposeSystemPrompt } from '../system-prompt'
import { registerRuntimeScriptTools } from '../tools'

const DEFAULT_GENERAL_PURPOSE_TIMEOUT_MS = 60 * 60 * 1000
const DELEGATION_TOOL_NAMES = new Set(['spawn_agent', 'list_agents', 'wait_agent'])
const SCRIPT_TOOL_NAMES = new Set(['roxy_script_describe', 'roxy_script_run'])
const ROOT_ONLY_TOOL_NAMES = new Set([
  'roxy_task_report',
  'roxy_save_user_template',
  'roxy_delete_user_template',
])
const PLAYWRIGHT_TOOL_PREFIX = `mcp_${playwrightMcpServerName('')}`

export const GENERAL_PURPOSE_AGENT_SPEC: SubAgentSpec = {
  agentType: 'general-purpose',
  description: 'Handle independent research, file, script, and browser work with the main agent capabilities.',
  systemPrompt: createGeneralPurposeSystemPrompt(),
  messageGuidance: 'Pass a complete self-contained task in message and only the authorized browser profile ids the child should actually use in dirIds; dirIds is an allowlist, not proof that every listed profile was used.',
}

export interface GeneralPurposeAgentMcp {
  createProfileBinding: (options: {
    bindingId: string
    executionId: string
    conversationId?: string
    allowedDirIds?: readonly string[]
    collector?: RuntimeFileCollector
    onBrowserLaunched?: (dirId: string) => void
  }) => Promise<void>
  getPlaywrightToolsForBinding: (bindingId: string) => Promise<RuntimeMcpTool[]>
  releaseProfileBinding: (bindingId: string) => Promise<void>
  invalidateProfile?: (dirId: string) => Promise<void>
}

export interface CreateGeneralPurposeAgentOptions {
  agentPath: AgentPath
  manager: IAgentManager
  message: string
  dirIds?: readonly string[]
  conversationId: string
  /** Lease owner shared by the root turn and all of its child profile bindings. */
  executionId: string
  /** Retained for compatibility with callers that name the root binding. */
  mainPlaywrightWorkerId?: string
  turnId: string
  model: string
  apiFormat?: AiAgentModelApiFormat
  apiKey: string
  baseURL?: string
  defaultHeaders?: Record<string, string>
  maxTokens?: number
  timeoutMs?: number
  rootAllowedDirIds?: readonly string[]
  inheritedToolNames?: readonly string[]
  parentTools: IToolRegistry
  workspaceDir: string
  fileCollector: RuntimeFileCollector
  writer?: (event: AgentRunEvent) => void
  sessionStore?: ISessionStore
  retryHandler?: () => void
  taskMonitorTaskId?: string
  toolContext?: Record<string, unknown>
  skills?: SkillManifest[]
  mcp?: GeneralPurposeAgentMcp
  runtimeFactory?: (definition: AgentDefinition) => Promise<Agent>
}

export interface GeneralPurposeAgentHandle {
  resourceKey: string
  dirIds: string[]
  task: string
  agent: Agent
  invoke: (signal?: AbortSignal) => Promise<AgentResponse>
  stream: (signal?: AbortSignal) => AsyncIterable<import('roxy-agent-runtime').AgentStreamEvent>
  dispose: () => Promise<void>
}

export function generalPurposeAgentResourceKey(conversationId: string, agentPath: AgentPath): string {
  return `agent_${createHash('sha256').update(conversationId).update('\0').update(agentPath).digest('hex').slice(0, 24)}`
}

function normalizeDirIds(values: readonly string[]): string[] {
  const normalized = values.map(value => value.trim())
  if (normalized.some(value => value.length === 0)) {
    throw new Error('general-purpose dirIds must contain only non-empty strings')
  }
  return [...new Set(normalized)]
}

function normalizeInheritedToolNames(
  parentTools: IToolRegistry,
  values?: readonly string[],
): Set<string> | undefined {
  if (values === undefined) {
    return undefined
  }

  const names = values.map(value => value.trim())
  if (names.some(name => name.length === 0)) {
    throw new Error('general-purpose inherited tool names must be non-empty strings')
  }

  for (const name of names) {
    if (!parentTools.resolve(name)) {
      throw new Error(`general-purpose inherited tool '${name}' is not registered on the main agent`)
    }
  }

  return new Set(names)
}

function shouldInheritTool(name: string, allowlist?: ReadonlySet<string>): boolean {
  return !DELEGATION_TOOL_NAMES.has(name)
    && !ROOT_ONLY_TOOL_NAMES.has(name)
    && !name.startsWith(PLAYWRIGHT_TOOL_PREFIX)
    && (allowlist === undefined || allowlist.has(name))
}

function registerInheritedTools(
  registry: ToolRegistry,
  options: CreateGeneralPurposeAgentOptions,
  workspaceDir: string,
  allowedDirIds: readonly string[],
  inheritedToolNames?: ReadonlySet<string>,
  hostToolCapabilities: HostToolCapabilities = getHostToolCapabilities(),
): { clarification: NullClarificationHandler, hitl: FullAccessHandler } {
  const clarification = new NullClarificationHandler()
  const hitl = new FullAccessHandler()
  const useApplyPatch = shouldInheritTool('apply_patch', inheritedToolNames)
    && options.parentTools.resolve('apply_patch') !== undefined
  const childBuiltins = filterBuiltinToolsForHostCapabilities(registerBuiltinTools({
    enableTodos: true,
    clarificationHandler: clarification,
    hitl,
    customToolNames: useApplyPatch ? ['apply_patch'] : [],
  }), hostToolCapabilities)
  const childBuiltinNames = new Set(childBuiltins.map(tool => tool.descriptor.name))

  // Rebuild builtin handlers so they use the child's runtime context instead
  // of reusing closures owned by the root agent.
  for (const tool of childBuiltins) {
    if (options.parentTools.resolve(tool.descriptor.name) && shouldInheritTool(tool.descriptor.name, inheritedToolNames)) {
      registry.add(tool.descriptor, tool.handler)
    }
  }

  for (const descriptor of options.parentTools.all()) {
    if (childBuiltinNames.has(descriptor.name) || SCRIPT_TOOL_NAMES.has(descriptor.name)) {
      continue
    }
    if (!shouldInheritTool(descriptor.name, inheritedToolNames)) {
      continue
    }

    const tool = options.parentTools.resolve(descriptor.name)
    if (tool) {
      registry.add(tool.descriptor, tool.handler)
    }
  }

  const childScriptTools = new ToolRegistry()
  registerRuntimeScriptTools(childScriptTools, {
    ephemeral: true,
    allowedDirIds,
    executionId: options.executionId,
    workspaceDir,
    fileCollector: options.fileCollector,
    taskMonitorTaskId: options.taskMonitorTaskId,
    onBrowserLaunched: dirId => (options.toolContext?.taskReportWindowTracker as TaskReportWindowTracker | undefined)?.record([dirId]),
  })

  for (const name of SCRIPT_TOOL_NAMES) {
    if (!options.parentTools.resolve(name) || !shouldInheritTool(name, inheritedToolNames)) {
      continue
    }
    const tool = childScriptTools.resolve(name)
    if (tool) {
      registry.add(tool.descriptor, tool.handler)
    }
  }

  return { clarification, hitl }
}

export async function createGeneralPurposeAgent(
  options: CreateGeneralPurposeAgentOptions,
): Promise<GeneralPurposeAgentHandle> {
  const task = options.message.trim()
  if (!task) {
    throw new Error('general-purpose message must be a non-empty task')
  }
  if (!options.executionId.trim()) {
    throw new Error('general-purpose requires the current executionId')
  }
  if (!options.turnId.trim()) {
    throw new Error('general-purpose requires the current turnId')
  }

  const requestedDirIds = normalizeDirIds(options.dirIds ?? [])
  const rootAllowedDirIds = options.rootAllowedDirIds ? normalizeDirIds(options.rootAllowedDirIds) : undefined
  const inheritedToolNames = normalizeInheritedToolNames(options.parentTools, options.inheritedToolNames)
  const rootAllowed = rootAllowedDirIds ? new Set(rootAllowedDirIds) : undefined
  const unauthorizedDirIds = rootAllowed ? requestedDirIds.filter(dirId => !rootAllowed.has(dirId)) : []
  if (unauthorizedDirIds.length > 0) {
    throw new Error(`general-purpose dirIds '${unauthorizedDirIds.join(', ')}' are outside the root agent window allowlist`)
  }
  const allowedDirIds = requestedDirIds.length > 0 ? requestedDirIds : (rootAllowedDirIds ?? [])
  const taskReportWindowTracker = options.toolContext?.taskReportWindowTracker as TaskReportWindowTracker | undefined

  const resourceKey = generalPurposeAgentResourceKey(options.conversationId, options.agentPath)
  const childPlaywrightServerName = playwrightMcpServerName(resourceKey)
  const childLaunchToolName = mcpToolName(childPlaywrightServerName, 'roxy_browser_launch')
  const mcp = options.mcp ?? mcpManager
  const runtimeFactory = options.runtimeFactory ?? AgentRuntime.create
  let profileBindingCreated = false
  let agent: Agent | undefined
  let disposed = false

  try {
    await mcp.createProfileBinding({
      bindingId: resourceKey,
      executionId: options.executionId,
      conversationId: options.conversationId,
      allowedDirIds,
      collector: options.fileCollector,
      onBrowserLaunched: dirId => taskReportWindowTracker?.record([dirId]),
    })
    profileBindingCreated = true

    const registry = new ToolRegistry()
    const workspaceDir = path.join(options.workspaceDir, resourceKey)
    const rolloutSessionId = `${resourceKey}_${createHash('sha256').update(options.turnId).digest('hex').slice(0, 16)}`
    const hostToolCapabilities = getHostToolCapabilities()
    const { clarification, hitl } = registerInheritedTools(
      registry,
      options,
      workspaceDir,
      allowedDirIds,
      inheritedToolNames,
      hostToolCapabilities,
    )

    const playwrightTools = await mcp.getPlaywrightToolsForBinding(resourceKey)
    for (const tool of playwrightTools) {
      registry.add(tool.descriptor, tool.handler)
    }
    const useApplyPatch = registry.resolve('apply_patch') !== undefined

    agent = await runtimeFactory({
      sessionId: rolloutSessionId,
      model: options.model,
      maxTokens: options.maxTokens ?? 8192,
      systemPrompt: createGeneralPurposeSystemPrompt({
        apiFormat: options.apiFormat,
        enableApplyPatch: useApplyPatch,
        hasRipgrep: hostToolCapabilities.hasRipgrep,
      }),
      provider: withRuntimeNetworkRetry(
        new OpenAIResponsesProvider({
          model: options.model,
          apiKey: options.apiKey,
          ...(options.baseURL ? { baseURL: options.baseURL } : {}),
          ...(options.defaultHeaders ? { defaultHeaders: options.defaultHeaders } : {}),
          customToolNames: useApplyPatch ? ['apply_patch'] : [],
        }),
        {
          onRetry: (event) => {
            options.retryHandler?.()
            options.writer?.(withAgentPath(
              streamEvents.workerRetryEvent({
                taskId: resourceKey,
                attempt: event.attempt,
                maxAttempts: event.maxAttempts,
                reason: event.reason,
              }),
              options.agentPath,
            ))
          },
        },
      ),
      memory: new InMemoryProvider(),
      sessionStore: options.sessionStore ?? new RoxyRolloutStore(options.workspaceDir),
      tools: registry,
      middleware: [createRuntimeFilesystemMiddleware({
        workspaceDir,
        displayRoot: path.dirname(options.workspaceDir),
        collector: options.fileCollector,
        workerId: resourceKey,
        agentPath: options.agentPath,
      })],
      hitl,
      clarification,
      recorder: new InMemoryTrajectoryRecorder(),
      logger: createLogger({ scope: `general-purpose-agent:${resourceKey}` }),
      agentManager: options.manager,
      agentPath: options.agentPath,
      skills: options.skills,
      toolContext: {
        workerId: resourceKey,
        conversationId: options.conversationId,
        dirIds: allowedDirIds,
        writer: (event: AgentRunEvent) => options.writer?.(withAgentPath(event, options.agentPath)),
        ...options.toolContext,
      },
      plugins: [
        createProfileSchedulerPlugin({
          ownerId: options.executionId,
          workerId: resourceKey,
          conversationId: options.conversationId,
          allowedDirIds,
          releaseOnDispose: false,
          onProfileClosed: dirId => mcp.invalidateProfile?.(dirId),
        }),
      ],
    })

    const createInput = () => [
      ...createRuntimeContextMessages({ workingDirectory: workspaceDir }),
      createGeneralPurposeAgentContextMessage({
        launchToolName: childLaunchToolName,
        assignedDirIds: allowedDirIds,
      }),
      { role: 'user' as const, content: task },
    ]

    return {
      resourceKey,
      dirIds: allowedDirIds,
      task,
      agent,
      invoke: async (signal) => {
        const controller = new AbortController()
        let timedOut = false
        const abortFromParent = () => controller.abort(signal?.reason)
        signal?.addEventListener('abort', abortFromParent, { once: true })
        if (signal?.aborted) {
          abortFromParent()
        }
        const timer = setTimeout(() => {
          timedOut = true
          controller.abort(new Error('general-purpose agent timed out'))
        }, options.timeoutMs ?? DEFAULT_GENERAL_PURPOSE_TIMEOUT_MS)

        try {
          const response = await agent!.invoke(createInput(), controller.signal)
          if (timedOut) {
            throw new Error('general-purpose agent timed out')
          }
          return response
        }
        catch (error) {
          if (timedOut) {
            throw new Error('general-purpose agent timed out', { cause: error })
          }
          throw error
        }
        finally {
          clearTimeout(timer)
          signal?.removeEventListener('abort', abortFromParent)
        }
      },
      async* stream(signal) {
        const controller = new AbortController()
        let timedOut = false
        const abortFromParent = () => controller.abort(signal?.reason)
        signal?.addEventListener('abort', abortFromParent, { once: true })
        if (signal?.aborted) {
          abortFromParent()
        }
        const timer = setTimeout(() => {
          timedOut = true
          controller.abort(new Error('general-purpose agent timed out'))
        }, options.timeoutMs ?? DEFAULT_GENERAL_PURPOSE_TIMEOUT_MS)

        try {
          for await (const event of agent!.stream(createInput(), controller.signal)) {
            yield event
          }
          if (timedOut) {
            throw new Error('general-purpose agent timed out')
          }
        }
        finally {
          clearTimeout(timer)
          signal?.removeEventListener('abort', abortFromParent)
        }
      },
      dispose: async () => {
        if (disposed) {
          return
        }
        disposed = true
        try {
          await agent?.dispose()
        }
        finally {
          if (profileBindingCreated) {
            await mcp.releaseProfileBinding(resourceKey)
          }
        }
      },
    }
  }
  catch (error) {
    await agent?.dispose().catch(() => {})
    if (profileBindingCreated) {
      await mcp.releaseProfileBinding(resourceKey)
    }
    throw error
  }
}
