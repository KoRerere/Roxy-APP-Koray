import type {
  AgentLifecycleHooks,
  AgentPath,
  IAgentManager,
  IContextContributor,
  IClarificationHandler,
  IHITLHandler,
  ILogger,
  IMemoryProvider,
  IModelProvider,
  ISessionStore,
  IToolRegistry,
  ITrajectoryRecorder,
  MemoryLifecycle,
  SkillManifest,
  Summarizer,
  ToolMiddleware,
  TrimPolicy,
} from '../core/interfaces.ts'

/**
 * Opaque handle to the compiled agent state machine. Internal to the runtime.
 * The nominal brand prevents accidental assignment from `unknown` or a different
 * graph version.
 */
export type AgentGraph = { readonly __agentGraph: unique symbol }

/**
 * All dependencies needed to run the agent loop. Passed to both
 * `buildAgentGraph` (which packages them as an opaque handle) and forwarded
 * to the internal `AgentImpl`, which extracts them at construction time.
 */
export interface AgentGraphDeps {
  /** Model identifier forwarded to ChatRequest.model. */
  model: string
  /** Optional token budget forwarded to ChatRequest.maxTokens. */
  maxTokens?: number
  /** Stable base system prompt. Its discovered Skill catalog and host runtime context are system blocks; turn-varying context uses developer messages. */
  systemPrompt?: string
  provider: IModelProvider
  tools: IToolRegistry
  memory: IMemoryProvider
  hitl: IHITLHandler
  recorder: ITrajectoryRecorder
  logger: ILogger
  /** Host-specific metadata forwarded to every tool invocation. */
  toolContext?: Record<string, unknown>
  clarification?: IClarificationHandler
  hooks?: AgentLifecycleHooks
  contributors?: IContextContributor[]
  middleware?: ToolMiddleware[]
  /** Awaited write-side lifecycle for external memory systems. */
  memoryLifecycles?: MemoryLifecycle[]
  /** When set, trim history at the start of each turn and optionally summarize. */
  trimPolicy?: TrimPolicy
  /** Summarizer called with archived text when trimming removes messages. */
  summarizer?: Summarizer
  /** Model context window size in tokens, used to derive the default compaction trigger. */
  contextWindowTokens?: number
  /** Absolute token threshold that overrides the default 80% context-window trigger. */
  triggerTokens?: number
  /**
   * Durable rollout store. When set, the agent loop appends a `RolloutEvent`
   * beside each `memory.append`, so the conversation survives process exits
   * and replays back into memory on resume. Optional — omitted in ephemeral /
   * test runs (pure in-memory).
   */
  sessionStore?: ISessionStore
  /**
   * Skill manifests advertised as complete XML progressive-disclosure metadata
   * in the top-level system prompt. Explicit `name + path` selections become
   * persisted internal user-role `<skill>` messages for one turn.
   */
  skills?: SkillManifest[]
  /** Trusted path of this agent; `/root` for a root agent, parent-assigned for children. */
  agentPath?: AgentPath
  /** Manager owning this agent tree. Present on root and managed children. */
  agentManager?: IAgentManager
}

/** Package deps into the opaque AgentGraph handle. */
export function buildAgentGraph(deps: AgentGraphDeps): AgentGraph {
  return deps as unknown as AgentGraph
}

/** Extract deps from the opaque handle — only for internal runtime use. */
export function extractDeps(graph: AgentGraph): AgentGraphDeps {
  return graph as unknown as AgentGraphDeps
}
